import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireActiveUser } from "@/lib/server-auth";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(request: Request, context: Ctx) {
  try {
    const { profile } = await requireActiveUser(request);
    const { id } = await context.params;
    const db = adminDb();
    const snap = await db.collection("files").doc(id).get();
    if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy file.");
    const metadata = snap.data() as any;
    if (metadata.archived === true) throw new HttpError(410, "FILE_ARCHIVED", "File này đã được lưu trữ và không còn gắn với dữ liệu đang hoạt động.");
    if (metadata.ownerUid !== profile.uid && profile.role !== "admin") {
      throw new HttpError(403, "FORBIDDEN", "Bạn không có quyền xem file này.");
    }
    // Một tệp không còn thuộc công việc đang tồn tại không được truy cập qua liên kết cũ.
    const recordSnap = await db.collection("workRecords").doc(String(metadata.workRecordId || "")).get();
    if (!recordSnap.exists || recordSnap.data()?.ownerUid !== metadata.ownerUid) {
      throw new HttpError(404, "NOT_FOUND", "Tệp này không còn thuộc công việc đang sử dụng.");
    }

    const gatewayUrl = process.env.APPS_SCRIPT_DRIVE_URL;
    const secret = process.env.APP_SHARED_SECRET;
    if (!gatewayUrl || !secret) throw new HttpError(500, "DRIVE_NOT_CONFIGURED", "Chưa cấu hình cổng Google Drive.");

    const response = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ secret, action: "getFile", fileId: metadata.driveFileId }),
      redirect: "follow",
      cache: "no-store"
    });
    const payload = await response.json();
    if (!payload?.ok || !payload?.file?.base64) {
      throw new HttpError(502, "DRIVE_READ_FAILED", payload?.error?.message || "Không thể đọc file từ Google Drive.");
    }

    const bytes = Buffer.from(payload.file.base64, "base64");
    const disposition = new URL(request.url).searchParams.get("download") === "1" ? "attachment" : "inline";
    const safeName = String(payload.file.fileName || metadata.fileName || "file").replace(/[\r\n\"]/g, "_");
    return new Response(bytes, {
      status: 200,
      headers: {
        "Content-Type": payload.file.mimeType || metadata.mimeType || "application/octet-stream",
        "Content-Length": String(bytes.length),
        "Content-Disposition": `${disposition}; filename*=UTF-8''${encodeURIComponent(safeName)}`,
        "Cache-Control": "private, no-store, max-age=0"
      }
    });
  } catch (error) {
    return jsonError(error);
  }
}
