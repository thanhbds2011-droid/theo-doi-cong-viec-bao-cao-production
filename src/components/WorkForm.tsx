"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { ArrowLeft, ArrowRight, Check, FileUp } from "lucide-react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api-client";
import { fetchCategories } from "@/lib/client-data";
import { MAX_UPLOAD_BYTES, WORK_TYPE_LABELS } from "@/lib/constants";
import { todayIso } from "@/lib/format";
import type { CategoryItem, WorkRecord, WorkType } from "@/lib/types";
import { WorkTypeIcon } from "@/components/WorkTypeIcon";
import { WorkFields, type FormState } from "@/components/WorkFields";

const types: WorkType[] = ["salary", "bhxh", "tax", "other", "vocational"];
const emptyState: FormState = { quantity: "", organization: "", contentCategoryId: "", contentLabel: "", tphs: "", resultDate: "", time: "", trainingInstitution: "" };

export function WorkForm() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [workType, setWorkType] = useState<WorkType | null>(null);
  const [workDate, setWorkDate] = useState(todayIso());
  const [form, setForm] = useState<FormState>(emptyState);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const recordRequestIdRef = useRef("");
  const fileRequestIdRef = useRef("");

  useEffect(() => { fetchCategories().then(setCategories).catch(() => showToast("Không tải được danh mục.", "error")); }, [showToast]);

  const supportsFile = workType === "salary" || workType === "bhxh" || workType === "tax";
  const details = useMemo(() => {
    if (workType === "salary") return { quantity: Number(form.quantity), organization: form.organization };
    if (workType === "bhxh" || workType === "tax") return { organization: form.organization, contentCategoryId: form.contentCategoryId, contentLabel: form.contentLabel, tphs: form.tphs, resultDate: form.resultDate };
    if (workType === "other") return { organization: form.organization, contentCategoryId: form.contentCategoryId, contentLabel: form.contentLabel };
    return { contentCategoryId: form.contentCategoryId, contentLabel: form.contentLabel, time: form.time, trainingInstitution: form.trainingInstitution };
  }, [workType, form]);

  function canContinue() {
    if (!workType) return false;
    if (!workDate) return false;
    if (workType === "salary") return Number(form.quantity) > 0 && form.organization.trim();
    if (workType === "bhxh" || workType === "tax") return form.organization.trim() && form.contentLabel.trim();
    if (workType === "other") return form.organization.trim() && form.contentLabel.trim();
    return form.contentLabel.trim() && form.time.trim() && form.trainingInstitution.trim();
  }

  async function save() {
    if (saving || !workType || !canContinue()) return;
    setSaving(true);
    let recordSaved = false;
    try {
      if (!recordRequestIdRef.current) recordRequestIdRef.current = crypto.randomUUID();
      const response = await apiFetch<{ ok: true; record: WorkRecord }>("/api/work-records", {
        method: "POST",
        body: JSON.stringify({ requestId: recordRequestIdRef.current, workDate, workType, details })
      });
      recordSaved = true;

      if (file) {
        if (!fileRequestIdRef.current) fileRequestIdRef.current = crypto.randomUUID();
        const data = new FormData();
        data.set("file", file);
        data.set("workRecordId", response.record.id);
        data.set("requestId", fileRequestIdRef.current);
        await apiFetch("/api/files/upload", { method: "POST", body: data });
      }

      showToast("Đã lưu công việc thành công.", "success");
      router.push("/work");
      router.refresh();
    } catch (error: any) {
      showToast(
        recordSaved
          ? `Công việc đã được lưu nhưng tệp đính kèm chưa hoàn tất. ${error.message || "Vui lòng thử lưu lại để hệ thống tiếp tục tải tệp."}`
          : (error.message || "Không thể lưu công việc."),
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel add-work-panel">
      <div className="stepper">
        {[1, 2, 3].map((n) => <div key={n} className={`step ${step >= n ? "active" : ""}`}><span>{step > n ? <Check size={14} /> : n}</span><small>{n === 1 ? "Chọn loại" : n === 2 ? "Nhập thông tin" : "Xác nhận"}</small></div>)}
      </div>

      {step === 1 && (
        <div className="form-section">
          <div className="section-head"><div><h2>Chọn loại công việc</h2><p>Chọn đúng nhóm để hệ thống chỉ hiển thị các trường cần thiết.</p></div></div>
          <div className="work-type-grid">
            {types.map((type) => <button key={type} className={`work-type-tile ${workType === type ? "selected" : ""}`} onClick={() => { setWorkType(type); setForm(emptyState); setFile(null); }}><span className={`type-icon type-${type}`}><WorkTypeIcon type={type} size={22} /></span><span><strong>{WORK_TYPE_LABELS[type]}</strong><small>Nhập thông tin {WORK_TYPE_LABELS[type].toLowerCase()}</small></span><span className="tile-arrow">›</span></button>)}
          </div>
          <div className="form-actions end"><button className="primary-button" disabled={!workType} onClick={() => setStep(2)}>Tiếp tục <ArrowRight size={18} /></button></div>
        </div>
      )}

      {step === 2 && workType && (
        <div className="form-section">
          <div className="section-head"><div><h2>Nhập thông tin công việc</h2><p>{WORK_TYPE_LABELS[workType]} · Người thực hiện: <strong>{profile?.displayName}</strong></p></div></div>
          <div className="form-grid">
            <label className="field"><span>Ngày thực hiện <b>*</b></span><input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></label>
            <label className="field"><span>Người thực hiện</span><input value={profile?.displayName || ""} readOnly /></label>
          </div>
          <WorkFields workType={workType} categories={categories} value={form} onChange={setForm} />
          {supportsFile && (
            <label className="file-field">
              <FileUp size={20} /><span><strong>{file ? file.name : workType === "salary" ? "Chọn tệp bảng lương" : "Chọn tệp kết quả"}</strong><small>PDF, Office, ảnh... tối đa 3 MB</small></span>
              <input type="file" hidden onChange={(e) => {
                const next = e.target.files?.[0] || null;
                if (next && next.size > MAX_UPLOAD_BYTES) { showToast("Mỗi tệp tối đa 3 MB.", "error"); e.target.value = ""; return; }
                setFile(next);
                fileRequestIdRef.current = next ? crypto.randomUUID() : "";
              }} />
            </label>
          )}
          <div className="form-actions"><button className="secondary-button" onClick={() => setStep(1)}><ArrowLeft size={18} /> Quay lại</button><button className="primary-button" disabled={!canContinue()} onClick={() => setStep(3)}>Tiếp tục <ArrowRight size={18} /></button></div>
        </div>
      )}

      {step === 3 && workType && (
        <div className="form-section">
          <div className="section-head"><div><h2>Xác nhận thông tin</h2><p>Kiểm tra trước khi lưu. Bạn có thể chỉnh sửa sau nhưng phải nhập lý do.</p></div></div>
          <div className="review-card">
            <div><span>Loại công việc</span><strong>{WORK_TYPE_LABELS[workType]}</strong></div>
            <div><span>Ngày thực hiện</span><strong>{workDate.split("-").reverse().join("/")}</strong></div>
            <div><span>Người thực hiện</span><strong>{profile?.displayName}</strong></div>
            {Object.entries(details)
              .filter(([key, value]) => key !== "contentCategoryId" && value !== "" && value !== undefined)
              .map(([key, value]) => <div key={key}><span>{key === "organization" ? "Tên đơn vị" : key === "quantity" ? "Số lượng" : key === "contentLabel" ? "Nội dung" : key === "tphs" ? "TPHS" : key === "resultDate" ? "Ngày kết quả" : key === "time" ? "Thời gian" : key === "trainingInstitution" ? "Cơ sở đào tạo" : "Thông tin"}</span><strong>{key === "resultDate" ? String(value).split("-").reverse().join("/") : String(value)}</strong></div>)}
            {file && <div><span>Tệp đính kèm</span><strong>{file.name}</strong></div>}
          </div>
          <div className="form-actions"><button className="secondary-button" disabled={saving} onClick={() => setStep(2)}><ArrowLeft size={18} /> Chỉnh sửa</button><button className="primary-button" disabled={saving} onClick={save}>{saving ? <><span className="button-spinner" /> Đang lưu...</> : <><Check size={18} /> Lưu công việc</>}</button></div>
        </div>
      )}
    </section>
  );
}
