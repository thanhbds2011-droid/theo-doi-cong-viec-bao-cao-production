import { FieldValue } from "firebase-admin/firestore";
import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireActiveUser } from "@/lib/server-auth";
import { MAX_UPLOAD_BYTES } from "@/lib/constants";

export const runtime = "nodejs";

const ALLOWED_EXTENSIONS = new Set(["pdf", "xls", "xlsx", "doc", "docx", "csv", "txt", "jpg", "jpeg", "png", "webp", "heic"]);

function validateRequestId(value: unknown) {
  const requestId = String(value || "").trim();
  if (!/^[a-zA-Z0-9_-]{12,120}$/.test(requestId)) {
    throw new HttpError(400, "INVALID_REQUEST_ID", "Mã yêu cầu tải file không hợp lệ.");
  }
  return requestId;
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireActiveUser(request);
    const form = await request.formData();
    const file = form.get("file");
    const workRecordId = String(form.get("workRecordId") || "").trim();
    const requestId = validateRequestId(form.get("requestId"));

    if (!(file instanceof File)) throw new HttpError(400, "FILE_REQUIRED", "Vui lòng chọn file.");
    if (!workRecordId) throw new HttpError(400, "RECORD_REQUIRED", "Thiếu công việc liên kết.");
    if (file.size <= 0 || file.size > MAX_UPLOAD_BYTES) {
      throw new HttpError(400, "FILE_TOO_LARGE", "Mỗi file tối đa 3 MB.");
    }

    const ext = file.name.includes(".") ? file.name.split(".").pop()!.toLowerCase() : "";
    if (!ALLOWED_EXTENSIONS.has(ext)) {
      throw new HttpError(400, "FILE_TYPE_NOT_ALLOWED", "Định dạng file không được hỗ trợ.");
    }

    const db = adminDb();
    const recordRef = db.collection("workRecords").doc(workRecordId);
    const recordSnap = await recordRef.get();
    if (!recordSnap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy công việc.");
    const record = recordSnap.data() as any;
    if (record.ownerUid !== profile.uid && profile.role !== "admin") {
      throw new HttpError(403, "FORBIDDEN", "Bạn không được tải file cho công việc này.");
    }

    // Mỗi lần người dùng chọn một file, client sinh requestId ổn định. Nếu request bị retry,
    // metadata và attachment sẽ dùng cùng document id để không tạo file trùng trong ứng dụng.
    const fileDocId = `${workRecordId}_${requestId}`;
    const fileRef = db.collection("files").doc(fileDocId);
    const existing = await fileRef.get();
    if (existing.exists) {
      const metadata = existing.data() as any;
      if (metadata.archived === true) {
        throw new HttpError(409, "FILE_ARCHIVED", "Yêu cầu tải file này đã được lưu trữ. Vui lòng chọn lại file.");
      }
      const summary = {
        fileDocId: fileRef.id,
        fileName: metadata.fileName,
        mimeType: metadata.mimeType,
        size: metadata.size,
        sha256: metadata.sha256,
        uploadedAt: metadata.uploadedAt
      };
      const retryNow = new Date().toISOString();
      await recordRef.update({
        attachments: FieldValue.arrayUnion(summary),
        updatedAt: retryNow,
        updatedBy: profile.uid
      });
      return Response.json({ ok: true, file: { id: fileRef.id, ...summary }, deduplicated: true });
    }

    const gatewayUrl = process.env.APPS_SCRIPT_DRIVE_URL;
    const secret = process.env.APP_SHARED_SECRET;
    if (!gatewayUrl || !secret) throw new HttpError(500, "DRIVE_NOT_CONFIGURED", "Chưa cấu hình cổng Google Drive.");

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveResponse = await fetch(gatewayUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        secret,
        action: "upload",
        requestId,
        file: {
          name: file.name,
          mimeType: file.type || "application/octet-stream",
          base64: buffer.toString("base64")
        },
        meta: {
          ownerId: record.ownerUid,
          workRecordId,
          workType: record.workType,
          workDate: record.workDate
        }
      }),
      redirect: "follow",
      cache: "no-store"
    });

    const driveJson = await driveResponse.json().catch(() => null);
    if (!driveResponse.ok || !driveJson?.ok || !driveJson?.file?.fileId) {
      throw new HttpError(502, "DRIVE_UPLOAD_FAILED", driveJson?.error?.message || "Không thể tải file lên Google Drive.");
    }

    const now = new Date().toISOString();
    const proposedMetadata = {
      ownerUid: record.ownerUid,
      workRecordId,
      driveFileId: driveJson.file.fileId,
      fileName: driveJson.file.fileName,
      mimeType: driveJson.file.mimeType,
      size: driveJson.file.size,
      sha256: driveJson.file.sha256,
      uploadedAt: now,
      uploadedBy: profile.uid,
      archived: false,
      requestId
    };

    let metadata: any = proposedMetadata;
    let metadataCreated = false;
    await db.runTransaction(async (transaction) => {
      const snap = await transaction.get(fileRef);
      if (snap.exists) {
        metadata = snap.data();
        return;
      }
      transaction.create(fileRef, proposedMetadata);
      metadataCreated = true;
    });

    const summary = {
      fileDocId: fileRef.id,
      fileName: metadata.fileName,
      mimeType: metadata.mimeType,
      size: metadata.size,
      sha256: metadata.sha256,
      uploadedAt: metadata.uploadedAt
    };

    await recordRef.update({
      attachments: FieldValue.arrayUnion(summary),
      updatedAt: now,
      updatedBy: profile.uid
    });

    return Response.json(
      { ok: true, file: { id: fileRef.id, ...summary }, deduplicated: !metadataCreated },
      { status: metadataCreated ? 201 : 200 }
    );
  } catch (error) {
    return jsonError(error);
  }
}
