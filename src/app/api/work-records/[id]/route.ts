import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireActiveUser } from "@/lib/server-auth";
import { validateWorkInput } from "@/lib/work-validation";
import { canonicalizeWorkDetails } from "@/lib/work-server";
import { createNotification, notifyActiveAdmins } from "@/lib/notifications-server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const { profile } = await requireActiveUser(request);
    const { id } = await context.params;
    const snap = await adminDb().collection("workRecords").doc(id).get();
    if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy công việc.");
    const data = snap.data() as any;
    if (data.ownerUid !== profile.uid && profile.role !== "admin") {
      throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền xem công việc này.");
    }
    return Response.json({ ok: true, record: { id: snap.id, ...data } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { profile } = await requireActiveUser(request);
    const { id } = await context.params;
    const body = await request.json();
    const reason = String(body?.reason || "").trim();
    if (!reason) throw new HttpError(400, "EDIT_REASON_REQUIRED", "Vui lòng nhập lý do chỉnh sửa.");
    if (reason.length > 1000) throw new HttpError(400, "VALIDATION_ERROR", "Lý do chỉnh sửa quá dài.");

    const validated = validateWorkInput(body);
    const { workType, workDate } = validated;
    const db = adminDb();
    const ref = db.collection("workRecords").doc(id);
    const expectedUpdatedAt = String(body?.expectedUpdatedAt || "").trim();
    if (!expectedUpdatedAt) throw new HttpError(400, "VERSION_REQUIRED", "Vui lòng tải lại công việc trước khi chỉnh sửa.");
    // Đọc trước để xác thực danh mục ngoài giao dịch. Sau đó đọc lại và kiểm tra phiên bản TRONG giao dịch.
    const initialSnap = await ref.get();
    if (!initialSnap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy công việc.");
    const initial = initialSnap.data() as any;
    if (initial.ownerUid !== profile.uid && profile.role !== "admin") {
      throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền chỉnh sửa công việc này.");
    }
    const allowInactiveCategoryId = initial.workType === workType ? String(initial.details?.contentCategoryId || "") : undefined;
    const details = await canonicalizeWorkDetails(workType, validated.details, { allowInactiveCategoryId });
    const [year, month] = workDate.split("-").map(Number);
    let before: any;
    let after: any;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(ref);
      if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy công việc.");
      before = snap.data() as any;
      if (before.ownerUid !== profile.uid && profile.role !== "admin") {
        throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền chỉnh sửa công việc này.");
      }
      if (before.updatedAt !== expectedUpdatedAt) {
        throw new HttpError(409, "CONCURRENT_EDIT", "Nội dung này vừa được cập nhật ở nơi khác. Vui lòng tải lại trước khi chỉnh sửa.");
      }
      after = {
        ...before, workDate, workYear: year, workMonth: month, workType, details,
        updatedAt: new Date().toISOString(), updatedBy: profile.uid
      };
      transaction.set(ref, after);
      transaction.create(db.collection("audits").doc(), {
        action: "work_update", entityType: "workRecord", entityId: id, reason,
        before, after, actorUid: profile.uid,
        actorDisplayName: profile.displayName || profile.email,
        createdAt: after.updatedAt
      });
    });

    if (profile.role === "employee") {
      await notifyActiveAdmins(
        "Có công việc vừa được chỉnh sửa",
        `${profile.displayName || profile.email} đã chỉnh sửa công việc. Lý do: ${reason}`,
        id
      ).catch((error) => console.error("Could not notify admins", error));
    } else if (before.ownerUid && before.ownerUid !== profile.uid) {
      await createNotification({
        recipientUid: before.ownerUid,
        type: "work",
        title: "Công việc đã được quản trị viên cập nhật",
        message: `Lý do: ${reason}`,
        relatedRecordId: id
      }).catch((error) => console.error("Could not notify owner", error));
    }

    return Response.json({ ok: true, record: { id, ...after } });
  } catch (error) {
    return jsonError(error);
  }
}

export async function DELETE(request: Request, context: Ctx) {
  try {
    const { profile } = await requireActiveUser(request);
    if (profile.role !== "admin") throw new HttpError(403, "ADMIN_REQUIRED", "Chỉ quản trị viên được xóa dữ liệu.");
    const { id } = await context.params;
    const body = await request.json().catch(() => ({}));
    const reason = String(body?.reason || "").trim();
    if (!reason) throw new HttpError(400, "DELETE_REASON_REQUIRED", "Vui lòng nhập lý do xóa.");
    if (reason.length > 1000) throw new HttpError(400, "VALIDATION_ERROR", "Lý do xóa quá dài.");

    const db = adminDb();
    const ref = db.collection("workRecords").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy công việc.");
    const before = snap.data() as any;

    const files = await db.collection("files").where("workRecordId", "==", id).get();
    if (!files.empty) {
      const batch = db.batch();
      const now = new Date().toISOString();
      files.docs.forEach((doc) => batch.update(doc.ref, { archived: true, archivedAt: now, archivedBy: profile.uid }));
      await batch.commit();
    }

    await db.runTransaction(async (transaction) => {
      const current = await transaction.get(ref);
      if (!current.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy công việc.");
      transaction.create(db.collection("audits").doc(), {
        action: "work_delete", entityType: "workRecord", entityId: id, reason,
        before: current.data(), after: null, actorUid: profile.uid,
        actorDisplayName: profile.displayName || profile.email,
        createdAt: new Date().toISOString()
      });
      transaction.delete(ref);
    });

    if (before.ownerUid && before.ownerUid !== profile.uid) {
      await createNotification({
        recipientUid: before.ownerUid,
        type: "work",
        title: "Một công việc đã được quản trị viên xóa",
        message: `Lý do: ${reason}`,
        relatedRecordId: null
      }).catch((error) => console.error("Could not notify owner", error));
    }

    return Response.json({ ok: true, archivedFiles: files.size });
  } catch (error) {
    return jsonError(error);
  }
}
