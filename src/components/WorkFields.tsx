"use client";

import type { CategoryItem, WorkType } from "@/lib/types";

type FormState = {
  quantity: string;
  organization: string;
  contentCategoryId: string;
  contentLabel: string;
  tphs: string;
  resultDate: string;
  time: string;
  trainingInstitution: string;
};

export function WorkFields({
  workType,
  categories,
  value,
  onChange
}: {
  workType: WorkType;
  categories: CategoryItem[];
  value: FormState;
  onChange: (next: FormState) => void;
}) {
  const set = (key: keyof FormState, v: string) => onChange({ ...value, [key]: v });
  const options = categories.filter((item) => item.workType === workType && item.isActive);
  const hasCurrentCategory = !value.contentCategoryId || options.some((item) => item.id === value.contentCategoryId);

  if (workType === "salary") {
    return (
      <div className="form-grid">
        <label className="field"><span>Số lượng <b>*</b></span><input type="number" min="1" inputMode="numeric" value={value.quantity} onChange={(e) => set("quantity", e.target.value)} placeholder="Ví dụ: 3" /></label>
        <label className="field"><span>Tên đơn vị <b>*</b></span><input value={value.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Nhập tên đơn vị" /></label>
      </div>
    );
  }

  if (workType === "bhxh" || workType === "tax") {
    return (
      <div className="form-grid">
        <label className="field"><span>Tên đơn vị <b>*</b></span><input value={value.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Nhập tên đơn vị" /></label>
        <label className="field"><span>Nội dung <b>*</b></span>
          <select value={value.contentCategoryId} onChange={(e) => {
            const selected = options.find((item) => item.id === e.target.value);
            onChange({ ...value, contentCategoryId: e.target.value, contentLabel: selected?.label || "" });
          }}>
            <option value="">Chọn nội dung</option>
            {!hasCurrentCategory && value.contentCategoryId && <option value={value.contentCategoryId}>{value.contentLabel || "Danh mục cũ"} (đã ẩn)</option>}
            {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {!options.length && <small className="field-help warning">Chưa có danh mục. Vui lòng báo quản trị viên nạp danh mục ban đầu.</small>}
        </label>
        <label className="field field-wide"><span>TPHS</span><textarea value={value.tphs} onChange={(e) => set("tphs", e.target.value)} placeholder="Nhập thành phần hồ sơ nếu có" rows={3} /></label>
        <label className="field"><span>Ngày kết quả giải quyết</span><input type="date" value={value.resultDate} onChange={(e) => set("resultDate", e.target.value)} /></label>
      </div>
    );
  }

  if (workType === "other") {
    return (
      <div className="form-grid">
        <label className="field"><span>Tên đơn vị <b>*</b></span><input value={value.organization} onChange={(e) => set("organization", e.target.value)} placeholder="Nhập tên đơn vị" /></label>
        <label className="field"><span>Nội dung thực hiện <b>*</b></span>
          <select value={value.contentCategoryId} onChange={(e) => {
            const selected = options.find((item) => item.id === e.target.value);
            onChange({ ...value, contentCategoryId: e.target.value, contentLabel: selected?.label || "" });
          }}>
            <option value="">Chọn nội dung</option>
            {!hasCurrentCategory && value.contentCategoryId && <option value={value.contentCategoryId}>{value.contentLabel || "Danh mục cũ"} (đã ẩn)</option>}
            {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
          </select>
          {!options.length && <small className="field-help warning">Chưa có danh mục. Vui lòng báo quản trị viên nạp danh mục ban đầu.</small>}
        </label>
      </div>
    );
  }

  return (
    <div className="form-grid">
      <label className="field field-wide"><span>Nội dung thực hiện <b>*</b></span>
        <select value={value.contentCategoryId} onChange={(e) => {
          const selected = options.find((item) => item.id === e.target.value);
          onChange({ ...value, contentCategoryId: e.target.value, contentLabel: selected?.label || "" });
        }}>
          <option value="">Chọn nội dung</option>
          {!hasCurrentCategory && value.contentCategoryId && <option value={value.contentCategoryId}>{value.contentLabel || "Danh mục cũ"} (đã ẩn)</option>}
          {options.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}
        </select>
        {!options.length && <small className="field-help warning">Chưa có danh mục. Vui lòng báo quản trị viên nạp danh mục ban đầu.</small>}
      </label>
      <label className="field"><span>Thời gian <b>*</b></span><input value={value.time} onChange={(e) => set("time", e.target.value)} placeholder="Ví dụ: tháng 10/2026" /></label>
      <label className="field"><span>Tên cơ sở đào tạo <b>*</b></span><input value={value.trainingInstitution} onChange={(e) => set("trainingInstitution", e.target.value)} placeholder="Nhập cơ sở đào tạo" /></label>
    </div>
  );
}

export type { FormState };
