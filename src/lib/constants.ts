import type { WorkType } from "@/lib/types";

export const APP_NAME = "Theo dõi công việc & Báo cáo";
export const APP_VERSION = process.env.NEXT_PUBLIC_APP_VERSION || "1.2.0";

export const WORK_TYPE_LABELS: Record<WorkType, string> = {
  salary: "Lương",
  bhxh: "BHXH",
  tax: "Thuế",
  other: "Các nội dung khác",
  vocational: "Học nghề"
};

export const WORK_TYPE_SHORT_LABELS: Record<WorkType, string> = {
  salary: "Lương",
  bhxh: "BHXH",
  tax: "Thuế",
  other: "Khác",
  vocational: "Học nghề"
};

export const WORK_TYPE_COLORS: Record<WorkType, string> = {
  salary: "#f59e0b",
  bhxh: "#2563eb",
  tax: "#f97316",
  other: "#7c3aed",
  vocational: "#0ea5e9"
};

export const MAX_UPLOAD_BYTES = 3 * 1024 * 1024;
export const PAGE_SIZE = 12;
