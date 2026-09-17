"use client";

import { Download, ExternalLink, FileUp, Paperclip, Save, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { useToast } from "@/components/ToastProvider";
import { apiFetch, openProtectedFile } from "@/lib/api-client";
import { fetchCategories } from "@/lib/client-data";
import { formatDate, formatDateTime, getContent, getOrganization } from "@/lib/format";
import { MAX_UPLOAD_BYTES, WORK_TYPE_LABELS } from "@/lib/constants";
import type { CategoryItem, WorkRecord, WorkType } from "@/lib/types";
import { WorkFields, type FormState } from "@/components/WorkFields";

function toForm(record: WorkRecord): FormState {
  const d = record.details as Record<string, unknown>;
  return {
    quantity: d.quantity != null ? String(d.quantity) : "",
    organization: String(d.organization || ""),
    contentCategoryId: String(d.contentCategoryId || ""),
    contentLabel: String(d.contentLabel || ""),
    tphs: String(d.tphs || ""),
    resultDate: String(d.resultDate || ""),
    time: String(d.time || ""),
    trainingInstitution: String(d.trainingInstitution || "")
  };
}

function toDetails(workType: WorkType, form: FormState) {
  if (workType === "salary") return { quantity: Number(form.quantity), organization: form.organization };
  if (workType === "bhxh" || workType === "tax") return {
    organization: form.organization,
    contentCategoryId: form.contentCategoryId || undefined,
    contentLabel: form.contentLabel,
    tphs: form.tphs || undefined,
    resultDate: form.resultDate || undefined
  };
  if (workType === "other") return {
    organization: form.organization,
    contentCategoryId: form.contentCategoryId || undefined,
    contentLabel: form.contentLabel
  };
  return {
    contentCategoryId: form.contentCategoryId || undefined,
    contentLabel: form.contentLabel,
    time: form.time,
    trainingInstitution: form.trainingInstitution
  };
}

export function WorkRecordDialog({
  record,
  mode,
  onClose,
  onUpdated,
  allowDelete = false,
  onDeleted
}: {
  record: WorkRecord;
  mode: "detail" | "edit";
  onClose: () => void;
  onUpdated?: (record: WorkRecord) => void;
  allowDelete?: boolean;
  onDeleted?: () => void;
}) {
  const { showToast } = useToast();
  const [editing, setEditing] = useState(mode === "edit");
  const [workDate, setWorkDate] = useState(record.workDate);
  const [workType, setWorkType] = useState<WorkType>(record.workType);
  const [form, setForm] = useState<FormState>(() => toForm(record));
  const [reason, setReason] = useState("");
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [newFile, setNewFile] = useState<File | null>(null);
  const fileRequestIdRef = useRef("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleteReason, setDeleteReason] = useState("");

  useEffect(() => {
    if (!editing) return;
    fetchCategories().then(setCategories).catch(() => showToast("Không tải được danh mục.", "error"));
  }, [editing, showToast]);

  const details = useMemo(() => toDetails(workType, form), [workType, form]);

  async function save() {
    if (saving) return;
    if (!reason.trim()) {
      showToast("Vui lòng nhập lý do chỉnh sửa.", "error");
      return;
    }
    setSaving(true);
    let contentSaved = false;
    try {
      const result = await apiFetch<{ ok: true; record: WorkRecord }>(`/api/work-records/${encodeURIComponent(record.id)}`, {
        method: "PATCH",
        body: JSON.stringify({
          workDate,
          workType,
          details,
          reason: reason.trim(),
          expectedUpdatedAt: record.updatedAt
        })
      });

      contentSaved = true;
      onUpdated?.(result.record);
      let updatedRecord = result.record;

      if (newFile) {
        if (!fileRequestIdRef.current) fileRequestIdRef.current = crypto.randomUUID();
        const data = new FormData();
        data.set("file", newFile);
        data.set("workRecordId", record.id);
        data.set("requestId", fileRequestIdRef.current);
        await apiFetch("/api/files/upload", { method: "POST", body: data });
        const refreshed = await apiFetch<{ ok: true; record: WorkRecord }>(`/api/work-records/${encodeURIComponent(record.id)}`);
        updatedRecord = refreshed.record;
        onUpdated?.(updatedRecord);
      }

      showToast(newFile ? "Đã cập nhật công việc và tải tệp thành công." : "Đã cập nhật công việc và lưu lịch sử chỉnh sửa.", "success");
      onClose();
    } catch (error: any) {
      if (contentSaved && newFile) {
        showToast(`Nội dung đã được cập nhật nhưng tệp chưa tải lên thành công. ${error.message || "Vui lòng mở lại công việc để thử tải tệp."}`, "error");
        onClose();
      } else {
        showToast(error.message || "Không thể cập nhật công việc.", "error");
      }
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    if (deleting) return;
    if (!deleteReason.trim()) { showToast("Vui lòng nhập lý do xóa.", "error"); return; }
    setDeleting(true);
    try {
      await apiFetch(`/api/work-records/${encodeURIComponent(record.id)}`, {
        method: "DELETE",
        body: JSON.stringify({ reason: deleteReason.trim() })
      });
      showToast("Đã xóa công việc. Tệp gốc vẫn được lưu giữ.", "success");
      onDeleted?.();
      onClose();
    } catch (error: any) {
      showToast(error.message || "Không thể xóa bản ghi.", "error");
    } finally {
      setDeleting(false);
    }
  }

  async function handleFile(fileDocId: string, download = false) {
    try {
      await openProtectedFile(fileDocId, download);
    } catch (error: any) {
      showToast(error.message || "Không thể mở file.", "error");
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={(e) => { if (e.currentTarget === e.target && !saving) onClose(); }}>
      <section className="modal" role="dialog" aria-modal="true" aria-label={editing ? "Chỉnh sửa công việc" : "Chi tiết công việc"}>
        <header className="modal-head">
          <div>
            <h3>{editing ? "Chỉnh sửa công việc" : "Chi tiết công việc"}</h3>
            <span className="muted small">{WORK_TYPE_LABELS[record.workType]} · {formatDate(record.workDate)}</span>
          </div>
          <button className="modal-close" onClick={onClose} aria-label="Đóng"><X size={19} /></button>
        </header>

        <div className="modal-body">
          {!editing ? (
            <>
              <div className="detail-grid">
                <div className="detail-item"><span>Người thực hiện</span><strong>{record.ownerDisplayName}</strong></div>
                <div className="detail-item"><span>Ngày thực hiện</span><strong>{formatDate(record.workDate)}</strong></div>
                <div className="detail-item"><span>Loại công việc</span><strong>{WORK_TYPE_LABELS[record.workType]}</strong></div>
                <div className="detail-item"><span>Tên đơn vị/Cơ sở</span><strong>{getOrganization(record)}</strong></div>
                <div className="detail-item wide"><span>Nội dung</span><strong>{getContent(record)}</strong></div>
                {record.workType === "salary" && <div className="detail-item"><span>Số lượng</span><strong>{String((record.details as any).quantity || 0)}</strong></div>}
                {(record.workType === "bhxh" || record.workType === "tax") && <>
                  <div className="detail-item wide"><span>TPHS</span><strong>{String((record.details as any).tphs || "—")}</strong></div>
                  <div className="detail-item"><span>Ngày kết quả giải quyết</span><strong>{formatDate((record.details as any).resultDate)}</strong></div>
                </>}
                {record.workType === "vocational" && <>
                  <div className="detail-item"><span>Thời gian</span><strong>{String((record.details as any).time || "—")}</strong></div>
                  <div className="detail-item"><span>Cơ sở đào tạo</span><strong>{String((record.details as any).trainingInstitution || "—")}</strong></div>
                </>}
                <div className="detail-item"><span>Tạo lúc</span><strong>{formatDateTime(record.createdAt)}</strong></div>
                <div className="detail-item"><span>Cập nhật lúc</span><strong>{formatDateTime(record.updatedAt)}</strong></div>
              </div>

              {!!record.attachments?.length && (
                <div className="attachment-list">
                  {record.attachments.map((item) => (
                    <div className="attachment-row" key={item.fileDocId}>
                      <div className="attachment-copy"><strong><Paperclip size={13} style={{ verticalAlign: "middle", marginRight: 5 }} />{item.fileName}</strong><small>{Math.ceil(item.size / 1024)} KB · {formatDateTime(item.uploadedAt)}</small></div>
                      <div className="table-actions">
                        <button className="table-action" title="Xem file" onClick={() => handleFile(item.fileDocId)}><ExternalLink size={16} /></button>
                        <button className="table-action" title="Tải file" onClick={() => handleFile(item.fileDocId, true)}><Download size={16} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <>
              <div className="form-grid">
                <label className="field"><span>Ngày thực hiện <b>*</b></span><input type="date" value={workDate} onChange={(e) => setWorkDate(e.target.value)} /></label>
                <label className="field"><span>Loại công việc <b>*</b></span>
                  <select value={workType} onChange={(e) => { setWorkType(e.target.value as WorkType); setForm({ quantity: "", organization: "", contentCategoryId: "", contentLabel: "", tphs: "", resultDate: "", time: "", trainingInstitution: "" }); }}>
                    {Object.entries(WORK_TYPE_LABELS).map(([key, label]) => <option value={key} key={key}>{label}</option>)}
                  </select>
                </label>
              </div>
              <WorkFields workType={workType} categories={categories} value={form} onChange={setForm} />
              {(workType === "salary" || workType === "bhxh" || workType === "tax") && (
                <label className="file-field">
                  <FileUp size={20} />
                  <span><strong>{newFile ? newFile.name : "Bổ sung tệp đính kèm (nếu có)"}</strong><small>PDF, Office, ảnh... tối đa 3 MB</small></span>
                  <input type="file" hidden onChange={(e) => {
                    const file = e.target.files?.[0] || null;
                    if (file && file.size > MAX_UPLOAD_BYTES) { showToast("Mỗi tệp tối đa 3 MB.", "error"); e.target.value = ""; return; }
                    setNewFile(file);
                    fileRequestIdRef.current = file ? crypto.randomUUID() : "";
                  }} />
                </label>
              )}
              <label className="field field-wide"><span>Lý do chỉnh sửa <b>*</b></span><textarea rows={4} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Ví dụ: Nhập nhầm tên đơn vị, bổ sung kết quả/file hồ sơ..." /></label>
            </>
          )}
          {allowDelete && !editing && confirmDelete && (
            <div className="danger-zone">
              <h3>Xác nhận xóa bản ghi</h3>
              <p>Chỉ quản trị viên được xóa công việc và phải ghi rõ lý do. Thao tác sẽ được lưu trong lịch sử thay đổi. Tệp gốc vẫn được lưu giữ.</p>
              <label className="field"><span>Lý do xóa <b>*</b></span><textarea rows={3} value={deleteReason} onChange={(e) => setDeleteReason(e.target.value)} placeholder="Nhập lý do xóa bản ghi" /></label>
              <div className="form-actions end"><button className="danger-button" disabled={deleting || !deleteReason.trim()} onClick={remove}>{deleting ? "Đang xóa..." : "Xác nhận xóa"}</button></div>
            </div>
          )}
        </div>

        <footer className="modal-foot">
          {allowDelete && !editing && !confirmDelete && <button className="danger-button" disabled={deleting} onClick={() => setConfirmDelete(true)}>Xóa bản ghi</button>}
          <button className="secondary-button" onClick={onClose}>Đóng</button>
          {!editing && <button className="primary-button" onClick={() => setEditing(true)}>Chỉnh sửa</button>}
          {editing && <button className="primary-button" disabled={saving || !reason.trim()} onClick={save}>{saving ? <><span className="button-spinner" /> Đang lưu...</> : <><Save size={17} /> Lưu thay đổi</>}</button>}
        </footer>
      </section>
    </div>
  );
}
