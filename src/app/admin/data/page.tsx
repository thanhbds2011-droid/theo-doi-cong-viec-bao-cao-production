"use client";

import { Database, Eye, Filter, Pencil, Trash2 } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { WorkRecordDialog } from "@/components/WorkRecordDialog";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api-client";
import { fetchActiveEmployees, fetchWorkRecords } from "@/lib/client-data";
import { formatDate, getContent, getOrganization, monthRange } from "@/lib/format";
import { PAGE_SIZE, WORK_TYPE_LABELS } from "@/lib/constants";
import type { AppUser, WorkRecord, WorkType } from "@/lib/types";

function AdminDataContent() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const range = useMemo(() => monthRange(), []);
  const [employees, setEmployees] = useState<AppUser[]>([]);
  const [ownerUid, setOwnerUid] = useState("");
  const [from, setFrom] = useState(range.from);
  const [to, setTo] = useState(range.to);
  const [type, setType] = useState<WorkType | "">("");
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [cursor, setCursor] = useState<any>(null);
  const [more, setMore] = useState(true);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<WorkRecord | null>(null);
  const [mode, setMode] = useState<"detail"|"edit">("detail");
  const [resetting, setResetting] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const [resetPhrase, setResetPhrase] = useState("");
  const [resetReason, setResetReason] = useState("Chuẩn bị dữ liệu mới");

  useEffect(() => { if (profile?.role === "admin") fetchActiveEmployees().then(setEmployees).catch(() => showToast("Không tải được danh sách nhân viên.", "error")); }, [profile?.uid]);
  useEffect(() => { if (profile?.role === "admin") load(true); }, [profile?.uid]);
  useEffect(() => {
    const id = searchParams.get("record");
    if (!id || !profile || profile.role !== "admin") return;
    const found = records.find((r) => r.id === id);
    if (found) { setSelected(found); setMode("detail"); return; }
    apiFetch<{ ok: true; record: WorkRecord }>(`/api/work-records/${encodeURIComponent(id)}`)
      .then((result) => { setSelected(result.record); setMode("detail"); })
      .catch(() => undefined);
  }, [records, searchParams, profile?.uid, profile?.role]);

  async function load(reset = true) {
    if (!profile || profile.role !== "admin") return;
    if (from && to && from > to) { showToast("Từ ngày không được lớn hơn Đến ngày.", "error"); return; }
    setLoading(true);
    try {
      const result = await fetchWorkRecords({ role:"admin", uid:profile.uid, ownerUid: ownerUid || undefined, from, to, workType:type, pageSize:PAGE_SIZE, cursor: reset?null:cursor });
      setRecords((prev)=>reset?result.records:[...prev,...result.records]);
      setCursor(result.cursor); setMore(result.records.length === PAGE_SIZE);
    } catch (error:any) { showToast(error.message || "Không tải được dữ liệu.", "error"); }
    finally { setLoading(false); }
  }

  function replace(next: WorkRecord) { setRecords((prev)=>prev.map((r)=>r.id===next.id?next:r)); }
  function removeSelected() { if (!selected) return; setRecords((prev)=>prev.filter((r)=>r.id!==selected.id)); }

  async function resetData() {
    if (resetting) return;
    if (resetPhrase !== "XOA TOAN BO DU LIEU") { showToast("Cụm từ xác nhận chưa đúng.", "error"); return; }
    setResetting(true);
    try {
      for (const stage of ["workRecords","files","notifications"] as const) {
        let done = false;
        while (!done) {
          const result = await apiFetch<{ok:true;done:boolean;deleted:number}>("/api/admin/reset", { method:"POST", body: JSON.stringify({ confirmation: resetPhrase, reason: resetReason.trim() || "Đặt lại dữ liệu nghiệp vụ", stage }) });
          done = result.done;
        }
      }
      setRecords([]); setResetOpen(false); setResetPhrase("");
      showToast("Đã làm sạch dữ liệu nghiệp vụ. Tài khoản và danh mục được giữ nguyên.", "success");
    } catch (error:any) { showToast(error.message || "Không thể đặt lại dữ liệu.", "error"); }
    finally { setResetting(false); }
  }

  return <ProtectedPage adminOnly><AppShell title="Toàn bộ dữ liệu">
    <div className="filter-bar">
      <label className="field"><span>Người dùng</span><select value={ownerUid} onChange={(e)=>setOwnerUid(e.target.value)}><option value="">Tất cả người dùng</option>{employees.map((u)=><option key={u.uid} value={u.uid}>{u.displayName || u.email}</option>)}</select></label>
      <label className="field"><span>Từ ngày</span><input type="date" value={from} onChange={(e)=>setFrom(e.target.value)}/></label>
      <label className="field"><span>Đến ngày</span><input type="date" value={to} onChange={(e)=>setTo(e.target.value)}/></label>
      <label className="field"><span>Loại công việc</span><select value={type} onChange={(e)=>setType(e.target.value as any)}><option value="">Tất cả</option>{Object.entries(WORK_TYPE_LABELS).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></label>
      <div className="filter-actions"><button className="primary-button" disabled={loading} onClick={()=>load(true)}><Filter size={16}/> {loading?"Đang lọc...":"Lọc"}</button></div>
    </div>

    <section className="panel data-panel">
      <div className="table-wrap"><table className="data-table"><thead><tr><th>Ngày</th><th>Người dùng</th><th>Nhóm</th><th>Đơn vị/Cơ sở</th><th>Nội dung</th><th>Tệp</th><th></th></tr></thead><tbody>{records.map((r)=><tr key={r.id}><td>{formatDate(r.workDate)}</td><td>{r.ownerDisplayName}</td><td>{WORK_TYPE_LABELS[r.workType]}</td><td>{getOrganization(r)}</td><td className="cell-main"><strong>{getContent(r)}</strong></td><td>{r.attachments?.length||0}</td><td><div className="table-actions"><button className="table-action" onClick={()=>{setSelected(r);setMode("detail")}}><Eye size={16}/></button><button className="table-action" onClick={()=>{setSelected(r);setMode("edit")}}><Pencil size={16}/></button><button className="table-action danger" onClick={()=>{setSelected(r);setMode("detail")}}><Trash2 size={16}/></button></div></td></tr>)}</tbody></table></div>
      <div className="mobile-records">{records.map((r)=><article className="record-card" key={r.id}><div className="record-card-head"><strong>{r.ownerDisplayName}</strong><small>{formatDate(r.workDate)}</small></div><div className="record-card-body"><b>{WORK_TYPE_LABELS[r.workType]} · {getOrganization(r)}</b><br/>{getContent(r)}</div><div className="record-card-actions"><button className="secondary-button" onClick={()=>{setSelected(r);setMode("detail")}}><Eye size={16}/> Chi tiết</button><button className="primary-button" onClick={()=>{setSelected(r);setMode("edit")}}><Pencil size={16}/> Sửa</button></div></article>)}</div>
      {!records.length && !loading && <div className="empty-state"><Database size={34}/><h3>Không có dữ liệu</h3><p>Hãy thay đổi bộ lọc hoặc chờ người dùng nhập công việc.</p></div>}
      {more && records.length>0 && <div className="load-more"><button className="secondary-button" disabled={loading} onClick={()=>load(false)}>{loading?"Đang tải...":"Tải thêm"}</button></div>}
    </section>

    <section className="danger-zone"><h3>Vùng thao tác nguy hiểm</h3><p>Việc đặt lại chỉ xóa dữ liệu công việc, thông tin tệp đính kèm và thông báo. Tài khoản, danh mục và tệp gốc đã lưu được giữ nguyên.</p><button className="danger-button" disabled={resetting} onClick={()=>setResetOpen(true)}><Trash2 size={16}/> Xóa sạch dữ liệu nghiệp vụ</button></section>

    {selected && <WorkRecordDialog record={selected} mode={mode} allowDelete onClose={()=>setSelected(null)} onUpdated={replace} onDeleted={removeSelected}/>} 

    {resetOpen && <div className="modal-backdrop"><section className="modal small"><header className="modal-head"><h3>Xác nhận xóa sạch dữ liệu nghiệp vụ</h3><button className="modal-close" onClick={()=>setResetOpen(false)}>×</button></header><div className="modal-body"><div className="danger-zone"><h3>Thao tác không thể hoàn tác trong ứng dụng</h3><p>Các công việc, thông tin tệp đính kèm và thông báo sẽ bị xóa khỏi ứng dụng. Tài khoản, danh mục và tệp gốc vẫn được giữ lại.</p></div><div className="form-grid" style={{marginTop:16}}><label className="field field-wide"><span>Nhập chính xác <b>XOA TOAN BO DU LIEU</b></span><input value={resetPhrase} onChange={(e)=>setResetPhrase(e.target.value)} /></label><label className="field field-wide"><span>Lý do</span><textarea rows={3} value={resetReason} onChange={(e)=>setResetReason(e.target.value)} /></label></div></div><footer className="modal-foot"><button className="secondary-button" onClick={()=>setResetOpen(false)}>Hủy</button><button className="danger-button" disabled={resetting||resetPhrase!=="XOA TOAN BO DU LIEU"} onClick={resetData}>{resetting?"Đang xóa...":"Xác nhận xóa"}</button></footer></section></div>}
  </AppShell></ProtectedPage>;
}

export default function AdminDataPage() {
  return (
    <Suspense fallback={<div className="full-loader"><div className="spinner" /><span>Đang tải dữ liệu...</span></div>}>
      <AdminDataContent />
    </Suspense>
  );
}
