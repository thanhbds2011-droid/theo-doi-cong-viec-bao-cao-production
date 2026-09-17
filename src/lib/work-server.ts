import "server-only";

import { adminDb } from "@/lib/firebase-admin";
import { HttpError } from "@/lib/server-auth";
import type { WorkDetails, WorkType } from "@/lib/types";

export async function canonicalizeWorkDetails(
  workType: WorkType,
  details: WorkDetails,
  options: { allowInactiveCategoryId?: string } = {}
): Promise<WorkDetails> {
  if (workType === "salary") return details;

  const categoryId = String((details as any).contentCategoryId || "").trim();
  if (!categoryId) {
    throw new HttpError(400, "CATEGORY_REQUIRED", "Vui lòng chọn nội dung từ danh mục đang sử dụng.");
  }

  const snap = await adminDb().collection("categories").doc(categoryId).get();
  if (!snap.exists) {
    throw new HttpError(400, "CATEGORY_NOT_FOUND", "Danh mục đã chọn không còn tồn tại. Vui lòng chọn lại.");
  }

  const category = snap.data() as any;
  if (category.isActive !== true && categoryId !== options.allowInactiveCategoryId) {
    throw new HttpError(400, "CATEGORY_INACTIVE", "Danh mục đã chọn hiện đang bị ẩn. Vui lòng chọn nội dung khác.");
  }
  if (category.workType !== workType) {
    throw new HttpError(400, "CATEGORY_MISMATCH", "Danh mục không thuộc nhóm công việc đã chọn.");
  }

  return {
    ...(details as any),
    contentCategoryId: categoryId,
    contentLabel: String(category.label || "").trim()
  } as WorkDetails;
}
