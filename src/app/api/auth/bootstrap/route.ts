import { adminDb } from "@/lib/firebase-admin";
import { jsonError, verifyRequestToken } from "@/lib/server-auth";
import { notifyNewAccount } from "@/lib/notifications-server";
import type { AppUser } from "@/lib/types";

export const runtime = "nodejs";

export async function POST(request: Request) {
  try {
    const token = await verifyRequestToken(request);
    const db = adminDb();
    const ref = db.collection("users").doc(token.uid);
    const now = new Date().toISOString();
    const email = String(token.email || "").trim().toLowerCase();
    const initialAdminEmail = String(process.env.INITIAL_ADMIN_EMAIL || "").trim().toLowerCase();
    const isInitialAdmin = Boolean(token.email_verified && email && initialAdminEmail && email === initialAdminEmail);
    let created = false;
    let profile!: AppUser;

    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) {
        const newUser: AppUser = {
          uid: token.uid, email, googleDisplayName: String(token.name || "").trim(),
          displayName: isInitialAdmin ? String(token.name || "Quản trị viên").trim() : "",
          employeeId: isInitialAdmin ? "ADMIN" : null,
          role: isInitialAdmin ? "admin" : "employee",
          status: isInitialAdmin ? "active" : "pending",
          photoURL: typeof token.picture === "string" ? token.picture : null,
          requestedAt: now, approvedAt: isInitialAdmin ? now : null,
          approvedBy: isInitialAdmin ? token.uid : null, rejectedAt: null,
          rejectedBy: null, rejectedReason: null, disabledAt: null,
          onboardingNotifiedAt: null, createdAt: now, updatedAt: now, lastLoginAt: now
        };
        const { uid: _uid, ...toStore } = newUser;
        transaction.create(ref, toStore);
        profile = newUser;
        created = true;
        return;
      }
      const current = { uid: snap.id, ...(snap.data() as Omit<AppUser, "uid">) };
      const patch: Partial<AppUser> = {
        googleDisplayName: String(token.name || current.googleDisplayName || "").trim(),
        photoURL: typeof token.picture === "string" ? token.picture : current.photoURL || null,
        lastLoginAt: now
      };
      // Chỉ khôi phục hồ sơ admin ban đầu mắc kẹt ở trạng thái chờ từ bản bootstrap cũ.
      // Không tự mở lại tài khoản đã bị khóa/từ chối hoặc tự cấp quyền sau khi bị hạ quyền có chủ ý.
      if (isInitialAdmin && current.status === "pending") {
        patch.role = "admin";
        patch.status = "active";
        patch.displayName = current.displayName || String(token.name || "Quản trị viên").trim();
        patch.employeeId = current.employeeId || "ADMIN";
        patch.approvedAt = now;
        patch.approvedBy = token.uid;
        patch.updatedAt = now;
      }
      transaction.update(ref, patch);
      profile = { ...current, ...patch };
    });

    if (profile.status === "pending" && (created || !profile.onboardingNotifiedAt)) {
      // Nếu thông báo lỗi tạm thời, không khóa đăng nhập: lần bootstrap sau sẽ thử lại.
      try {
        await notifyNewAccount(profile.uid, profile.googleDisplayName || profile.email);
        const sentAt = new Date().toISOString();
        await ref.update({ onboardingNotifiedAt: sentAt });
        profile.onboardingNotifiedAt = sentAt;
      } catch (error) {
        console.error("Could not notify admins about pending account", error);
      }
    }
    return Response.json({ ok: true, profile });
  } catch (error) {
    return jsonError(error);
  }
}
