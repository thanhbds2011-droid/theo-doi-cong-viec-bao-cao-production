import { adminDb } from "@/lib/firebase-admin";
import { jsonError, requireAdmin } from "@/lib/server-auth";
import { writeAudit } from "@/lib/audit-server";
import { INITIAL_CATEGORIES } from "@/lib/initial-categories";

export const runtime = "nodejs";

function slug(input: string) {
  return input
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
}

export async function POST(request: Request) {
  try {
    const { profile } = await requireAdmin(request);
    const db = adminDb();
    const now = new Date().toISOString();
    const batch = db.batch();
    INITIAL_CATEGORIES.forEach((item, index) => {
      const id = `${item.workType}-${String(index + 1).padStart(2, "0")}-${slug(item.label)}`;
      batch.set(
        db.collection("categories").doc(id),
        { ...item, isActive: true, createdAt: now, updatedAt: now },
        { merge: true }
      );
    });
    await batch.commit();
    await writeAudit(
      {
        action: "category_update",
        entityType: "category",
        entityId: "__seed__",
        reason: "Nạp/cập nhật danh mục nghiệp vụ ban đầu",
        before: null,
        after: { count: INITIAL_CATEGORIES.length }
      },
      profile
    );
    return Response.json({ ok: true, count: INITIAL_CATEGORIES.length });
  } catch (error) {
    return jsonError(error);
  }
}
