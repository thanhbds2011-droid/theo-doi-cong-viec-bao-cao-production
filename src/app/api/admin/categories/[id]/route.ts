import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireAdmin } from "@/lib/server-auth";
import { writeAudit } from "@/lib/audit-server";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(request: Request, context: Ctx) {
  try {
    const { profile } = await requireAdmin(request);
    const { id } = await context.params;
    const body = await request.json();
    const db = adminDb();
    const ref = db.collection("categories").doc(id);
    const snap = await ref.get();
    if (!snap.exists) throw new HttpError(404, "NOT_FOUND", "Không tìm thấy danh mục.");
    const before = snap.data() as any;
    const patch: any = { updatedAt: new Date().toISOString() };
    if (body?.label !== undefined) {
      const label = String(body.label).trim();
      if (!label || label.length > 700) throw new HttpError(400, "VALIDATION_ERROR", "Tên danh mục không hợp lệ.");
      patch.label = label;
    }
    if (body?.isActive !== undefined) patch.isActive = Boolean(body.isActive);
    if (body?.sortOrder !== undefined) patch.sortOrder = Number(body.sortOrder || 0);
    await ref.update(patch);
    const after = { ...before, ...patch };
    await writeAudit({ action: "category_update", entityType: "category", entityId: id, reason: String(body?.reason || "Cập nhật danh mục"), before, after }, profile);
    return Response.json({ ok: true, category: { id, ...after } });
  } catch (error) {
    return jsonError(error);
  }
}
