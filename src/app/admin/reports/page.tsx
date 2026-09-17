"use client";

import { Download, Eye, Filter, Printer } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { fetchActiveEmployees, fetchAllWorkRecords } from "@/lib/client-data";
import { formatDate, getContent, getOrganization, monthRange } from "@/lib/format";
import { WORK_TYPE_LABELS } from "@/lib/constants";
import type { AppUser, WorkRecord, WorkType } from "@/lib/types";
import { WorkRecordDialog } from "@/components/WorkRecordDialog";

function esc(value: unknown) {
  let text = String(value ?? "");
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

function monthToRange(value: string) {
  const [year, month] = value.split("-").map(Number);
  if (!year || !month) return null;
  const end = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return { from: `${year}-${String(month).padStart(2, "0")}-01`, to: `${year}-${String(month).padStart(2, "0")}-${String(end).padStart(2, "0")}` };
}

export default function AdminReportsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const range = useMemo(() => monthRange(), []);
  const currentMonth = range.from.slice(0, 7);
  const currentYear = range.from.slice(0, 4);

  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [ownerUid, setOwnerUid] = useState("");
  const [periodMode, setPeriodMode] = useState<"range" | "month" | "year">("range");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [month, setMonth] = useState(currentMonth);
  const [year, setYear] = useState(currentYear);
  const [type, setType] = useState<WorkType | "">("");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WorkRecord | null>(null);
  const [reportRange, setReportRange] = useState(range);

  useEffect(() => {
    if (profile?.role !== "admin") return;
    fetchActiveEmployees()
      .then(setEmployees)
      .catch((error: any) => showToast(error.message || "Không tải được danh sách nhân viên.", "error"));
  }, [profile?.uid, profile?.role, showToast]);

  function resolveRange() {
    if (periodMode === "month") {
      const result = monthToRange(month);
      if (!result) throw new Error("Vui lòng chọn tháng hợp lệ.");
      return result;
    }
    if (periodMode === "year") {
      if (!/^\d{4}$/.test(year)) throw new Error("Vui lòng nhập năm hợp lệ.");
      return { from: `${year}-01-01`, to: `${year}-12-31` };
    }
    if (!from || !to || from > to) throw new Error("Khoảng ngày không hợp lệ.");
    return { from, to };
  }

  async function run() {
    if (!profile) return;
    setLoading(true);
    try {
      const resolved = resolveRange();
      const result = await fetchAllWorkRecords({
        role: "admin",
        uid: profile.uid,
        ownerUid: ownerUid || undefined,
        from: resolved.from,
        to: resolved.to,
        workType: type,
        direction: "asc"
      });
      setReportRange(resolved);
      setRecords(result);
    } catch (error: any) {
      showToast(error.message || "Không thể tổng hợp báo cáo.", "error");
    } finally {
      setLoading(false);
    }
  }

  const counts = useMemo(
    () => Object.fromEntries(Object.keys(WORK_TYPE_LABELS).map((key) => [key, records.filter((record) => record.workType === key).length])) as Record<WorkType, number>,
    [records]
  );

  function exportCsv() {
    if (!records.length) return;
    const rows = [
      ["STT", "Tên nhân viên", "Ngày", "Nhóm", "Số lượng", "Tên đơn vị/Cơ sở", "Nội dung", "Thời gian"],
      ...records.map((record, index) => {
        const details = record.details as any;
        return [
          index + 1,
          record.ownerDisplayName,
          formatDate(record.workDate),
          WORK_TYPE_LABELS[record.workType],
          record.workType === "salary" ? details.quantity : "",
          getOrganization(record),
          getContent(record),
          record.workType === "vocational" ? details.time || "" : ""
        ];
      })
    ];
    const csv = "\uFEFF" + rows.map((row) => row.map(esc).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `bao-cao-admin-${reportRange.from}-${reportRange.to}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <ProtectedPage adminOnly>
      <AppShell title="Báo cáo tổng hợp">
        <div className="filter-bar">
          <label className="field"><span>Người dùng</span><select value={ownerUid} onChange={(e) => setOwnerUid(e.target.value)}><option value="">Tất cả người dùng</option>{employees.map((user) => <option key={user.uid} value={user.uid}>{user.displayName || user.email}</option>)}</select></label>
          <label className="field"><span>Thời gian</span><select value={periodMode} onChange={(e) => setPeriodMode(e.target.value as "range" | "month" | "year")}><option value="range">Khoảng ngày</option><option value="month">Theo tháng</option><option value="year">Theo năm</option></select></label>
          {periodMode === "range" && <><label className="field"><span>Từ ngày</span><input type="date" value={from} onChange={(e) => setFrom(e.target.value)} /></label><label className="field"><span>Đến ngày</span><input type="date" value={to} onChange={(e) => setTo(e.target.value)} /></label></>}
          {periodMode === "month" && <label className="field"><span>Tháng</span><input type="month" value={month} onChange={(e) => setMonth(e.target.value)} /></label>}
          {periodMode === "year" && <label className="field"><span>Năm</span><input type="number" min="2000" max="2100" value={year} onChange={(e) => setYear(e.target.value)} /></label>}
          <label className="field"><span>Loại công việc</span><select value={type} onChange={(e) => setType(e.target.value as WorkType | "")}><option value="">Tất cả</option>{Object.entries(WORK_TYPE_LABELS).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label>
          <div className="filter-actions"><button className="primary-button" disabled={loading} onClick={run}><Filter size={16} />{loading ? "Đang tổng hợp..." : "Xem báo cáo"}</button></div>
        </div>

        {!!records.length && <>
          <div className="report-summary">{(Object.keys(WORK_TYPE_LABELS) as WorkType[]).map((workType) => <div className="summary-mini" key={workType}><span>{WORK_TYPE_LABELS[workType]}</span><strong>{counts[workType] || 0}</strong></div>)}</div>
          <div className="admin-toolbar"><div><strong>{records.length} công việc</strong><div className="muted small">{ownerUid ? employees.find((user) => user.uid === ownerUid)?.displayName : "Tất cả người dùng"} · {formatDate(reportRange.from)} → {formatDate(reportRange.to)}</div></div><div className="report-tools"><button className="secondary-button" onClick={() => window.print()}><Printer size={16} /> In</button><button className="secondary-button" onClick={exportCsv}><Download size={16} /> Xuất CSV</button></div></div>
        </>}

        <section className="panel data-panel">
          <div className="table-wrap"><table className="data-table"><thead><tr><th>STT</th><th>Người dùng</th><th>Ngày</th><th>Nhóm</th><th>Số lượng</th><th>Đơn vị/Cơ sở</th><th>Nội dung</th><th>Thời gian</th><th></th></tr></thead><tbody>{records.map((record, index) => { const details = record.details as any; return <tr key={record.id}><td>{index + 1}</td><td>{record.ownerDisplayName}</td><td>{formatDate(record.workDate)}</td><td>{WORK_TYPE_LABELS[record.workType]}</td><td>{record.workType === "salary" ? details.quantity : "—"}</td><td>{getOrganization(record)}</td><td>{getContent(record)}</td><td>{record.workType === "vocational" ? details.time || "—" : "—"}</td><td><button className="table-action" onClick={() => setSelected(record)}><Eye size={16} /></button></td></tr>; })}</tbody></table></div>
          <div className="mobile-records">{records.map((record, index) => <article className="record-card" key={record.id}><div className="record-card-head"><strong>#{index + 1} · {record.ownerDisplayName}</strong><small>{formatDate(record.workDate)}</small></div><div className="record-card-body"><b>{WORK_TYPE_LABELS[record.workType]} · {getOrganization(record)}</b><br />{getContent(record)}{record.workType === "vocational" ? <><br /><span className="muted small">Thời gian: {String((record.details as any).time || "—")}</span></> : null}</div><div className="record-card-actions"><button className="secondary-button" onClick={() => setSelected(record)}><Eye size={16} /> Chi tiết</button></div></article>)}</div>
          {!records.length && !loading && <div className="empty-state"><Filter size={34} /><h3>Chọn điều kiện báo cáo</h3><p>Quản trị viên có thể xem một người dùng hoặc toàn bộ hệ thống theo khoảng ngày, tháng hoặc năm.</p></div>}
        </section>

        {selected && <WorkRecordDialog record={selected} mode="detail" allowDelete onClose={() => setSelected(null)} onUpdated={(next) => setRecords((previous) => previous.map((record) => record.id === next.id ? next : record))} onDeleted={() => setRecords((previous) => previous.filter((record) => record.id !== selected.id))} />}
      </AppShell>
    </ProtectedPage>
  );
}
