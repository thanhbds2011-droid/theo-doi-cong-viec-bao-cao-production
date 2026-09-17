"use client";

import { Eye, Filter, Pencil, Rows3 } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { WorkTypeIcon } from "@/components/WorkTypeIcon";
import { WorkRecordDialog } from "@/components/WorkRecordDialog";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { fetchWorkRecords } from "@/lib/client-data";
import { apiFetch } from "@/lib/api-client";
import { formatDate, getContent, getOrganization, monthRange } from "@/lib/format";
import { PAGE_SIZE, WORK_TYPE_LABELS } from "@/lib/constants";
import type { WorkRecord, WorkType } from "@/lib/types";

function WorkListContent() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const initialRange = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(initialRange.from);
  const [to, setTo] = useState(initialRange.to);
  const [type, setType] = useState<WorkType | "">("");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [more, setMore] = useState(true);
  const [selected, setSelected] = useState<WorkRecord | null>(null);
  const [mode, setMode] = useState<"detail" | "edit">("detail");

  async function load(reset = true) {
    if (!profile || profile.status !== "active") return;
    if (from && to && from > to) {
      showToast("Từ ngày không được lớn hơn Đến ngày.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchWorkRecords({ role: "employee", uid: profile.uid, from, to, workType: type, pageSize: PAGE_SIZE, cursor: reset ? null : cursor });
      setRecords((prev) => reset ? result.records : [...prev, ...result.records]);
      setCursor(result.cursor);
      setMore(result.records.length === PAGE_SIZE);
    } catch (error: any) {
      showToast(error.message || "Không tải được danh sách công việc.", "error");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { if (profile?.status === "active") load(true); }, [profile?.uid]);

  useEffect(() => {
    const id = searchParams.get("record");
    if (!id || !profile || profile.status !== "active") return;
    const found = records.find((r) => r.id === id);
    if (found) { setSelected(found); setMode("detail"); return; }
    apiFetch<{ ok: true; record: WorkRecord }>(`/api/work-records/${encodeURIComponent(id)}`)
      .then((result) => {
        if (result.record.ownerUid !== profile.uid) {
          showToast("Công việc này không thuộc danh sách cá nhân của bạn. Hãy mở trong mục Dữ liệu quản trị.", "error");
          return;
        }
        setSelected(result.record); setMode("detail");
      })
      .catch((error: any) => showToast(error.message || "Không mở được công việc.", "error"));
  }, [records, searchParams, profile?.uid, profile?.status]);

  function open(record: WorkRecord, nextMode: "detail" | "edit") {
    setSelected(record);
    setMode(nextMode);
  }

  function replaceRecord(next: WorkRecord) {
    setRecords((prev) => prev.map((r) => r.id === next.id ? next : r));
  }

  return (
    <ProtectedPage>
      <AppShell title="Công việc của tôi">
        <div className="filter-bar">
          <label className="field"><span>Từ ngày</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>Đến ngày</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field"><span>Loại công việc</span><select value={type} onChange={(e) => setType(e.target.value as WorkType | "")}><option value="">Tất cả</option>{Object.entries(WORK_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="filter-actions"><button className="primary-button" disabled={loading} onClick={() => load(true)}><Filter size={17} /> {loading ? "Đang lọc..." : "Lọc"}</button></div>
        </div>

        <section className="panel data-panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>Ngày</th><th>Loại</th><th>Tên đơn vị/Cơ sở</th><th>Nội dung</th><th>Tệp</th><th>Thao tác</th></tr></thead>
              <tbody>
                {records.map((r) => <tr key={r.id}>
                  <td>{formatDate(r.workDate)}</td>
                  <td><span className="tag tag-blue"><WorkTypeIcon type={r.workType} size={13} /> {WORK_TYPE_LABELS[r.workType]}</span></td>
                  <td>{getOrganization(r)}</td>
                  <td className="cell-main"><strong>{getContent(r)}</strong><small>Cập nhật: {formatDate(r.updatedAt)}</small></td>
                  <td>{r.attachments?.length || 0}</td>
                  <td><div className="table-actions"><button className="table-action" title="Xem chi tiết" onClick={() => open(r,"detail")}><Eye size={16} /></button><button className="table-action" title="Chỉnh sửa" onClick={() => open(r,"edit")}><Pencil size={16} /></button></div></td>
                </tr>)}
              </tbody>
            </table>
          </div>

          <div className="mobile-records">
            {records.map((r) => <article className="record-card" key={r.id}>
              <div className="record-card-head"><div className="record-card-title"><span className={`type-badge-icon type-${r.workType}`}><WorkTypeIcon type={r.workType} size={18} /></span><span><strong>{WORK_TYPE_LABELS[r.workType]} · {getOrganization(r)}</strong><small>{formatDate(r.workDate)}</small></span></div></div>
              <div className="record-card-body">{getContent(r)}</div>
              <div className="record-card-actions"><button className="secondary-button" onClick={() => open(r,"detail")}><Eye size={16} /> Chi tiết</button><button className="primary-button" onClick={() => open(r,"edit")}><Pencil size={16} /> Chỉnh sửa</button></div>
            </article>)}
          </div>

          {!records.length && !loading && <div className="empty-state"><Rows3 size={34} /><h3>Chưa có dữ liệu</h3><p>Không có công việc trong khoảng thời gian đã chọn.</p></div>}
          {more && records.length > 0 && <div className="load-more"><button className="secondary-button" disabled={loading} onClick={() => load(false)}>{loading ? "Đang tải..." : "Tải thêm"}</button></div>}
        </section>

        {selected && <WorkRecordDialog record={selected} mode={mode} onClose={() => setSelected(null)} onUpdated={replaceRecord} />}
      </AppShell>
    </ProtectedPage>
  );
}

export default function WorkListPage() {
  return (
    <Suspense fallback={<div className="full-loader"><div className="spinner" /><span>Đang tải công việc...</span></div>}>
      <WorkListContent />
    </Suspense>
  );
}
