"use client";

import { Download, Eye, Filter, Printer } from "lucide-react";
import { useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { fetchAllWorkRecords } from "@/lib/client-data";
import { formatDate, getContent, getOrganization, monthRange } from "@/lib/format";
import { WORK_TYPE_LABELS } from "@/lib/constants";
import type { WorkRecord, WorkType } from "@/lib/types";
import { WorkRecordDialog } from "@/components/WorkRecordDialog";
import { useToast } from "@/components/ToastProvider";

function csvEscape(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export default function ReportsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const range = useMemo(() => monthRange(), []);
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [type, setType] = useState<WorkType | "">("");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WorkRecord | null>(null);

  async function run() {
    if (!profile) return;
    if (from && to && from > to) {
      showToast("Từ ngày không được lớn hơn Đến ngày.", "error");
      return;
    }
    setLoading(true);
    try {
      const result = await fetchAllWorkRecords({ role: "employee", uid: profile.uid, from, to, workType: type, direction: "asc" });
      setRecords(result);
    } catch (error: any) {
      showToast(error.message || "Không thể tổng hợp báo cáo.", "error");
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(() => Object.fromEntries(Object.keys(WORK_TYPE_LABELS).map((k) => [k, records.filter((r) => r.workType === k).length])) as Record<WorkType, number>, [records]);

  function exportCsv() {
    if (!records.length) return;
    const rows = [
      ["STT","Tên nhân viên","Ngày","Nhóm","Số lượng","Tên đơn vị/Cơ sở","Nội dung","Thời gian"],
      ...records.map((r, index) => {
        const d = r.details as any;
        return [index + 1, r.ownerDisplayName, formatDate(r.workDate), WORK_TYPE_LABELS[r.workType], r.workType === "salary" ? d.quantity : "", getOrganization(r), getContent(r), r.workType === "vocational" ? d.time || "" : ""];
      })
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(csvEscape).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-${from}-${to}.csv`;
    document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
  }

  return (
    <ProtectedPage>
      <AppShell title="Báo cáo">
        <div className="filter-bar">
          <label className="field"><span>Từ ngày</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label>
          <label className="field"><span>Đến ngày</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label>
          <label className="field"><span>Loại công việc</span><select value={type} onChange={(e) => setType(e.target.value as WorkType | "")}><option value="">Tất cả</option>{Object.entries(WORK_TYPE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="filter-actions"><button className="primary-button" disabled={loading} onClick={run}><Filter size={17} /> {loading ? "Đang tổng hợp..." : "Xem báo cáo"}</button></div>
        </div>

        {!!records.length && <>
          <div className="report-summary">
            {(Object.keys(WORK_TYPE_LABELS) as WorkType[]).map((workType) => <div className="summary-mini" key={workType}><span>{WORK_TYPE_LABELS[workType]}</span><strong>{counts[workType] || 0}</strong></div>)}
          </div>
          <div className="admin-toolbar"><div><strong>{records.length} công việc</strong><div className="muted small">{formatDate(from)} → {formatDate(to)}</div></div><div className="report-tools"><button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> In</button><button className="secondary-button" onClick={exportCsv}><Download size={16} /> Xuất CSV</button></div></div>
        </>}

        <section className="panel data-panel">
          <div className="table-wrap">
            <table className="data-table">
              <thead><tr><th>STT</th><th>Ngày</th><th>Nhóm</th><th>Số lượng</th><th>Tên đơn vị/Cơ sở</th><th>Nội dung</th><th>Thời gian</th><th></th></tr></thead>
              <tbody>{records.map((r,index) => { const d = r.details as any; return <tr key={r.id}><td>{index+1}</td><td>{formatDate(r.workDate)}</td><td>{WORK_TYPE_LABELS[r.workType]}</td><td>{r.workType === "salary" ? d.quantity : "—"}</td><td>{getOrganization(r)}</td><td>{getContent(r)}</td><td>{r.workType === "vocational" ? d.time || "—" : "—"}</td><td><button className="table-action" onClick={() => setSelected(r)}><Eye size={16} /></button></td></tr>; })}</tbody>
            </table>
          </div>
          <div className="mobile-records">{records.map((r,index) => <article className="record-card" key={r.id}><div className="record-card-head"><strong>#{index+1} · {WORK_TYPE_LABELS[r.workType]}</strong><small>{formatDate(r.workDate)}</small></div><div className="record-card-body"><b>{getOrganization(r)}</b><br />{getContent(r)}</div><div className="record-card-actions"><button className="secondary-button" onClick={() => setSelected(r)}><Eye size={16} /> Chi tiết</button></div></article>)}</div>
          {!records.length && !loading && <div className="empty-state"><Filter size={34} /><h3>Chọn thời gian để lập báo cáo</h3><p>Hệ thống chỉ lấy dữ liệu của tài khoản đang đăng nhập.</p></div>}
        </section>

        {selected && <WorkRecordDialog record={selected} mode="detail" onClose={() => setSelected(null)} onUpdated={(next) => setRecords((prev) => prev.map((r) => r.id === next.id ? next : r))} />}
      </AppShell>
    </ProtectedPage>
  );
}
