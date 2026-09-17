import { adminDb } from "@/lib/firebase-admin";
import { HttpError, jsonError, requireAdmin } from "@/lib/server-auth";
import { writeAudit } from "@/lib/audit-server";
import type { WorkType } from "@/lib/types";

export const runtime = "nodejs";

const allowed = new Set<WorkType>(["bhxh", "tax", "other", "vocational"]);

export async function POST(request: Request) {
  try {
    const { profile } = await requireAdmin(request);
    const body = await request.json();
    const workType = String(body?.workType || "") as WorkType;
    const label = String(body?.label || "").trim();
    if (!allowed.has(workType)) throw new HttpError(400, "VALIDATION_ERROR", "Nhóm danh mục không hợp lệ.");
    if (!label || label.length > 700) throw new HttpError(400, "VALIDATION_ERROR", "Tên danh mục không hợp lệ.");
    const now = new Date().toISOString();
    const ref = adminDb().collection("categories").doc();
    const data = { workType, label, isActive: true, sortOrder: Number(body?.sortOrder || 100), createdAt: now, updatedAt: now };
    await ref.set(data);
    await writeAudit({ action: "category_create", entityType: "category", entityId: ref.id, after: data }, profile);
    return Response.json({ ok: true, category: { id: ref.id, ...data } }, { status: 201 });
  } catch (error) {
    return jsonError(error);
  }
}
