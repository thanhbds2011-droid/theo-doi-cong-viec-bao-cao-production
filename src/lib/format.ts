import type { WorkRecord } from "@/lib/types";
import { WORK_TYPE_SHORT_LABELS } from "@/lib/constants";

export function formatDate(value?: string | null) {
  if (!value) return "—";
  const [y, m, d] = value.slice(0, 10).split("-");
  if (!y || !m || !d) return value;
  return `${d}/${m}/${y}`;
}

export function formatDateTime(value?: string | null) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

export function getWorkSummary(record: WorkRecord) {
  const details = record.details as Record<string, unknown>;
  if (record.workType === "salary") {
    return `${details.organization ?? ""} · ${details.quantity ?? 0} bảng lương`;
  }
  if (record.workType === "vocational") {
    return `${details.contentLabel ?? ""} · ${details.trainingInstitution ?? ""}`;
  }
  return `${details.contentLabel ?? ""}${details.organization ? ` · ${details.organization}` : ""}`;
}

export function getOrganization(record: WorkRecord) {
  const details = record.details as Record<string, unknown>;
  if (record.workType === "vocational") return String(details.trainingInstitution ?? "—");
  return String(details.organization ?? "—");
}

export function getContent(record: WorkRecord) {
  const details = record.details as Record<string, unknown>;
  if (record.workType === "salary") return `Số lượng: ${details.quantity ?? 0}`;
  return String(details.contentLabel ?? "—");
}

export function getTypeLabel(record: Pick<WorkRecord, "workType">) {
  return WORK_TYPE_SHORT_LABELS[record.workType];
}

export function monthRange(date = new Date()) {
  const year = date.getFullYear();
  const month = date.getMonth();
  const from = new Date(year, month, 1);
  const to = new Date(year, month + 1, 0);
  const iso = (d: Date) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };
  return { from: iso(from), to: iso(to) };
}

export function todayIso() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
