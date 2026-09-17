import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireAdmin } from "@/lib/server-auth";
import { createNotification } from "@/lib/notifications-server";
import type { AppUser, UserRole, UserStatus } from "@/lib/types";

export const runtime = "nodejs";
type Ctx = { params: Promise<{ uid: string }> };
type Action = "approve" | "reject" | "disable" | "enable" | "rename" | "change_role";
const allowedActions = new Set<Action>(["approve", "reject", "disable", "enable", "rename", "change_role"]);

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { profile: actor } = await requireAdmin(request);
    const { uid } = await context.params;
    const body = await request.json().catch(() => ({}));
    const action = String(body?.action || "") as Action;
    if (!allowedActions.has(action)) throw new HttpError(400, "INVALID_ACTION", "Vui lòng chọn thao tác phù hợp với trạng thái tài khoản.");
    const displayName = String(body?.displayName || "").trim();
    const reason = String(body?.reason || "").trim();
    if (reason.length > 1000) throw new HttpError(400, "VALIDATION_ERROR", "Lý do quá dài.");
    if ((action === "approve" || action === "rename") && (!displayName || displayName.length > 160)) {
      throw new HttpError(400, "VALIDATION_ERROR", "Vui lòng nhập tên hiển thị (tối đa 160 ký tự).");
    }
    if (action === "change_role" && body?.role !== "employee" && body?.role !== "admin") {
      throw new HttpError(400, "VALIDATION_ERROR", "Quyền sử dụng không hợp lệ.");
    }
    if (action === "change_role" && !reason) throw new HttpError(400, "VALIDATION_ERROR", "Vui lòng nhập lý do thay đổi quyền sử dụng.");
    if (action === "disable" && !reason) throw new HttpError(400, "VALIDATION_ERROR", "Vui lòng nhập lý do tạm khóa.");

    const db = adminDb();
    const ref = db.collection("users").doc(uid);
    const now = new Date().toISOString();
    let previous!: AppUser;
    let after!: AppUser;

    // Thay đổi hồ sơ và lưu lịch sử trong cùng một giao dịch để tránh mất nhật ký.
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy tài khoản.");
      const current = { uid: snap.id, ...(snap.data() as Omit<AppUser, "uid">) };
      const allowed: Record<Action, UserStatus[]> = {
        approve: ["pending", "rejected"], reject: ["pending"], disable: ["active"],
        enable: ["disabled"], rename: ["active", "disabled"], change_role: ["active"]
      };
      if (!allowed[action].includes(current.status)) throw new HttpError(409, "INVALID_TRANSITION", "Tài khoản đã thay đổi trạng thái. Vui lòng tải lại danh sách.");
      if (uid === actor.uid && (action === "disable" || (action === "change_role" && body.role !== "admin"))) {
        throw new HttpError(400, "SELF_LOCKOUT", "Không thể tự khóa hoặc hạ quyền tài khoản đang sử dụng.");
      }
      let patch: Partial<AppUser> = { updatedAt: now };
      if (action === "approve") patch = {
        ...patch, displayName, status: "active", role: "employee", // Cấp quyền quản trị là thao tác riêng, có xác nhận.
        employeeId: current.employeeId || `EMP-${uid.slice(0, 8).toUpperCase()}`,
        approvedAt: now, approvedBy: actor.uid, rejectedAt: null, rejectedBy: null,
        rejectedReason: null, disabledAt: null
      };
      if (action === "reject") patch = {
        ...patch, status: "rejected", rejectedAt: now, rejectedBy: actor.uid,
        rejectedReason: reason || null
      };
      if (action === "disable") patch = { ...patch, status: "disabled", disabledAt: now };
      if (action === "enable") patch = { ...patch, status: "active", disabledAt: null };
      if (action === "rename") patch = { ...patch, displayName };
      if (action === "change_role") patch = { ...patch, role: body.role as UserRole };
      if ((action === "disable" || (action === "change_role" && body.role === "employee")) && current.role === "admin") {
        // Đọc những quản trị viên khác ngay trong transaction; không được khóa/hạ quyền người cuối cùng.
        const admins = await transaction.get(db.collection("users").where("role", "==", "admin").where("status", "==", "active"));
        if (admins.docs.filter((doc) => doc.id !== uid).length === 0) {
          throw new HttpError(400, "LAST_ADMIN", "Phải còn ít nhất một quản trị viên hoạt động khác.");
        }
      }
      previous = current;
      after = { ...current, ...patch };
      const logRef = db.collection("audits").doc();
      transaction.update(ref, patch);
      transaction.create(logRef, {
        action: "account_update", entityType: "user", entityId: uid, actorUid: actor.uid,
        actorDisplayName: actor.displayName || actor.email, createdAt: now,
        reason: reason || ({ approve: "Phê duyệt tài khoản", reject: "Từ chối tài khoản", disable: "Tạm khóa tài khoản", enable: "Mở khóa tài khoản", rename: "Chỉnh sửa tên hiển thị", change_role: "Thay đổi quyền sử dụng" }[action]),
        before: current, after
      });
    });

    // Tên được sao lưu trên bản ghi để tránh nhiều lần đọc hồ sơ khi lập báo cáo.
    // Không sửa updatedAt của công việc: đổi tên tài khoản không phải chỉnh sửa nội dung công việc.
    if (previous.displayName !== after.displayName && after.displayName) {
      const records = await db.collection("workRecords").where("ownerUid", "==", uid).get();
      for (let start = 0; start < records.docs.length; start += 400) {
        const batch = db.batch();
        records.docs.slice(start, start + 400).forEach((doc) => batch.update(doc.ref, { ownerDisplayName: after.displayName }));
        await batch.commit();
      }
    }

    if (previous.status !== after.status) {
      const notices: Record<UserStatus, { title: string; message: string }> = {
        pending: { title: "Tài khoản đang chờ phê duyệt", message: "Yêu cầu của bạn đang chờ được xem xét." },
        active: { title: "Tài khoản đã được phê duyệt", message: "Bạn đã có thể sử dụng hệ thống." },
        rejected: { title: "Yêu cầu truy cập chưa được chấp thuận", message: "Bạn có thể liên hệ quản trị viên để được hỗ trợ." },
        disabled: { title: "Tài khoản đang tạm khóa", message: "Vui lòng liên hệ quản trị viên để được hỗ trợ." }
      };
      // Lỗi gửi thông báo không được làm người dùng hiểu nhầm rằng phê duyệt đã thất bại.
      await createNotification({ recipientUid: uid, type: "account", ...notices[after.status], relatedRecordId: null })
        .catch((error) => console.error("Could not send account notification", error));
    }
    return Response.json({ ok: true, user: after });
  } catch (error) {
    return jsonError(error);
  }
}
