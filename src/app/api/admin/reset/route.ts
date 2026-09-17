import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireAdmin } from "@/lib/server-auth";
import { writeAudit } from "@/lib/audit-server";

export const runtime = "nodejs";

async function deleteBatch(collectionName: string, limit = 300) {
  const db = adminDb();
  const snap = await db.collection(collectionName).limit(limit).get();
  if (snap.empty) return { deleted: 0, done: true };
  const batch = db.batch();
  snap.docs.forEach((doc) => batch.delete(doc.ref));
  await batch.commit();
  return { deleted: snap.size, done: snap.size < limit };
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireAdmin(request);
    const body = await request.json();
    if (String(body?.confirmation || "") !== "XOA TOAN BO DU LIEU") {
      throw new HttpError(400, "CONFIRMATION_REQUIRED", "Cụm từ xác nhận chưa đúng.");
    }
    const stage = String(body?.stage || "workRecords");
    if (!new Set(["workRecords", "files", "notifications"]).has(stage)) {
      throw new HttpError(400, "INVALID_STAGE", "Giai đoạn reset không hợp lệ.");
    }
    const result = await deleteBatch(stage, 300);
    if (stage === "workRecords" && result.deleted > 0) {
      await writeAudit(
        {
          action: "system_reset",
          entityType: "system",
          entityId: "workRecords",
          reason: String(body?.reason || "Reset dữ liệu nghiệp vụ"),
          before: { deletedInThisBatch: result.deleted },
          after: null
        },
        profile
      );
    }
    return Response.json({ ok: true, stage, ...result, note: "File vật lý trên Google Drive được giữ lại như bản lưu an toàn; chỉ metadata ứng dụng bị xóa ở stage files." });
  } catch (error) {
    return jsonError(error);
  }
}
