import type { WorkDetails, WorkType } from "@/lib/types";
import { HttpError } from "@/lib/server-auth";

const WORK_TYPES: WorkType[] = ["salary", "bhxh", "tax", "other", "vocational"];

function text(value: unknown, label: string, required = true, max = 500) {
  const result = String(value ?? "").trim();
  if (required && !result) throw new HttpError(400, "VALIDATION_ERROR", `${label} không được để trống.`);
  if (result.length > max) throw new HttpError(400, "VALIDATION_ERROR", `${label} quá dài.`);
  return result;
}

function dateString(value: unknown, label: string, required = true) {
  const result = text(value, label, required, 10);
  if (!result && !required) return "";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(result)) throw new HttpError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  const d = new Date(`${result}T00:00:00Z`);
  if (Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== result) {
    throw new HttpError(400, "VALIDATION_ERROR", `${label} không hợp lệ.`);
  }
  return result;
}

export function validateWorkInput(body: any) {
  const workType = String(body?.workType || "") as WorkType;
  if (!WORK_TYPES.includes(workType)) throw new HttpError(400, "VALIDATION_ERROR", "Loại công việc không hợp lệ.");
  const workDate = dateString(body?.workDate, "Ngày thực hiện");
  const d = body?.details || {};
  let details: WorkDetails;

  if (workType === "salary") {
    const quantity = Number(d.quantity);
    if (!Number.isInteger(quantity) || quantity <= 0 || quantity > 100000) {
      throw new HttpError(400, "VALIDATION_ERROR", "Số lượng phải là số nguyên lớn hơn 0.");
    }
    details = { quantity, organization: text(d.organization, "Tên đơn vị", true, 250) };
  } else if (workType === "bhxh" || workType === "tax") {
    details = {
      organization: text(d.organization, "Tên đơn vị", true, 250),
      contentCategoryId: text(d.contentCategoryId, "Mã danh mục", false, 200) || undefined,
      contentLabel: text(d.contentLabel, "Nội dung", true, 500),
      tphs: text(d.tphs, "TPHS", false, 1200) || undefined,
      resultDate: dateString(d.resultDate, "Ngày kết quả giải quyết", false) || undefined
    };
  } else if (workType === "other") {
    details = {
      organization: text(d.organization, "Tên đơn vị", true, 250),
      contentCategoryId: text(d.contentCategoryId, "Mã danh mục", false, 200) || undefined,
      contentLabel: text(d.contentLabel, "Nội dung thực hiện", true, 700)
    };
  } else {
    details = {
      contentCategoryId: text(d.contentCategoryId, "Mã danh mục", false, 200) || undefined,
      contentLabel: text(d.contentLabel, "Nội dung thực hiện", true, 700),
      time: text(d.time, "Thời gian", true, 120),
      trainingInstitution: text(d.trainingInstitution, "Tên cơ sở đào tạo", true, 250)
    };
  }

  return { workType, workDate, details };
}
