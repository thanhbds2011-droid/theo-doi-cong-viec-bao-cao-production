"use client";

import { Plus, RefreshCw, Tags, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api-client";
import { fetchCategories } from "@/lib/client-data";
import { WORK_TYPE_LABELS } from "@/lib/constants";
import type { CategoryItem, WorkType } from "@/lib/types";

const manageable: Exclude<WorkType,"salary">[] = ["bhxh","tax","other","vocational"];

export default function AdminCategoriesPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<CategoryItem[]>([]);
  const [filter, setFilter] = useState<Exclude<WorkType,"salary"> | "all">("all");
  const [selected, setSelected] = useState<CategoryItem | null>(null);
  const [creating, setCreating] = useState(false);
  const [workType, setWorkType] = useState<Exclude<WorkType,"salary">>("bhxh");
  const [label, setLabel] = useState("");
  const [active, setActive] = useState(true);
  const [sortOrder, setSortOrder] = useState(100);
  const [saving, setSaving] = useState(false);
  const [seedConfirmOpen, setSeedConfirmOpen] = useState(false);
  const [seeding, setSeeding] = useState(false);

  async function load() {
    try { setItems(await fetchCategories(true)); }
    catch { showToast("Không tải được danh mục.", "error"); }
  }
  useEffect(() => { load(); }, []);
  const shown = useMemo(() => filter === "all" ? items : items.filter((i) => i.workType === filter), [items, filter]);

  function openCreate() { setCreating(true); setSelected(null); setWorkType("bhxh"); setLabel(""); setActive(true); setSortOrder(100); }
  function openEdit(item: CategoryItem) { setCreating(false); setSelected(item); setWorkType(item.workType as Exclude<WorkType,"salary">); setLabel(item.label); setActive(item.isActive); setSortOrder(item.sortOrder); }

  async function seed() {
    if (seeding) return;
    setSeeding(true);
    try {
      const result = await apiFetch<{ok:true;count:number}>("/api/admin/categories/seed", { method:"POST" });
      await load();
      setSeedConfirmOpen(false);
      showToast(`Đã nạp ${result.count} mục danh mục ban đầu.`, "success");
    } catch (error:any) {
      showToast(error.message || "Không thể nạp danh mục.", "error");
    } finally {
      setSeeding(false);
    }
  }

  async function save() {
    if (saving) return;
    if (!label.trim()) { showToast("Tên danh mục không được để trống.", "error"); return; }
    setSaving(true);
    try {
      if (creating) {
        const result = await apiFetch<{ok:true;category:CategoryItem}>("/api/admin/categories", { method:"POST", body: JSON.stringify({ workType, label: label.trim(), sortOrder }) });
        setItems((prev) => [...prev, result.category]);
      } else if (selected) {
        const result = await apiFetch<{ok:true;category:CategoryItem}>(`/api/admin/categories/${selected.id}`, { method:"PATCH", body: JSON.stringify({ label: label.trim(), isActive: active, sortOrder, reason: "Quản trị viên cập nhật danh mục" }) });
        setItems((prev) => prev.map((i) => i.id === selected.id ? result.category : i));
      }
      setSelected(null); setCreating(false); showToast("Đã lưu danh mục.", "success");
    } catch (error:any) { showToast(error.message || "Không thể lưu danh mục.", "error"); }
    finally { setSaving(false); }
  }

  return <ProtectedPage adminOnly><AppShell title="Danh mục">
    <div className="admin-toolbar"><div><strong>Danh mục nghiệp vụ</strong><div className="muted small">Quản trị viên có thể thêm, sửa, ẩn và kích hoạt lại nội dung sử dụng trong biểu mẫu.</div></div><div className="report-tools"><button className="secondary-button" onClick={()=>setSeedConfirmOpen(true)}><RefreshCw size={16}/> Nạp danh mục ban đầu</button><button className="primary-button" onClick={openCreate}><Plus size={16}/> Thêm danh mục</button></div></div>
    <div className="filter-bar">{(["all",...manageable] as const).map((t) => <button key={t} className={filter===t?"primary-button":"secondary-button"} onClick={() => setFilter(t as any)}>{t === "all" ? `Tất cả (${items.length})` : `${WORK_TYPE_LABELS[t]} (${items.filter((i)=>i.workType===t).length})`}</button>)}</div>
    <div className="category-grid">{shown.map((item) => <article className="category-card" key={item.id}><div className="category-card-copy"><strong>{item.label}</strong><span>{WORK_TYPE_LABELS[item.workType]} · Thứ tự {item.sortOrder}</span></div><div className="table-actions"><span className={`tag ${item.isActive?"tag-green":"tag-gray"}`}>{item.isActive?"Đang dùng":"Đã ẩn"}</span><button className="table-action" onClick={()=>openEdit(item)}><Tags size={16}/></button></div></article>)}</div>
    {!shown.length && <div className="panel empty-state"><Tags size={34}/><h3>Chưa có danh mục</h3><p>Bấm “Nạp danh mục ban đầu” để dùng danh mục nghiệp vụ ban đầu.</p></div>}


    {seedConfirmOpen && <div className="modal-backdrop"><section className="modal small"><header className="modal-head"><div><h3>Nạp danh mục ban đầu</h3><span className="muted small">Hệ thống sẽ bổ sung danh mục có sẵn. Những nội dung đã nhập không bị xóa.</span></div><button className="modal-close" onClick={()=>setSeedConfirmOpen(false)} disabled={seeding}><X size={18}/></button></header><div className="modal-body"><p style={{margin:0}}>Các mục trùng mã sẽ được cập nhật; danh mục hiện có không bị xóa. Bạn có muốn tiếp tục?</p></div><footer className="modal-foot"><button className="secondary-button" onClick={()=>setSeedConfirmOpen(false)} disabled={seeding}>Hủy</button><button className="primary-button" onClick={seed} disabled={seeding}>{seeding?"Đang nạp...":"Xác nhận nạp"}</button></footer></section></div>}
    {(selected || creating) && <div className="modal-backdrop"><section className="modal small"><header className="modal-head"><h3>{creating?"Thêm danh mục":"Chỉnh sửa danh mục"}</h3><button className="modal-close" onClick={()=>{setSelected(null);setCreating(false)}}><X size={18}/></button></header><div className="modal-body"><div className="form-grid">
      <label className="field"><span>Nhóm nghiệp vụ</span><select value={workType} disabled={!creating} onChange={(e)=>setWorkType(e.target.value as any)}>{manageable.map((t)=><option key={t} value={t}>{WORK_TYPE_LABELS[t]}</option>)}</select></label>
      <label className="field"><span>Thứ tự</span><input type="number" value={sortOrder} onChange={(e)=>setSortOrder(Number(e.target.value||0))}/></label>
      <label className="field field-wide"><span>Nội dung <b>*</b></span><textarea rows={4} value={label} onChange={(e)=>setLabel(e.target.value)}/></label>
      {!creating && <label className="field"><span>Trạng thái</span><select value={active?"1":"0"} onChange={(e)=>setActive(e.target.value==="1")}><option value="1">Đang sử dụng</option><option value="0">Ẩn khỏi người dùng</option></select></label>}
    </div></div><footer className="modal-foot"><button className="secondary-button" onClick={()=>{setSelected(null);setCreating(false)}}>Hủy</button><button className="primary-button" disabled={saving} onClick={save}>{saving?"Đang lưu...":"Lưu danh mục"}</button></footer></section></div>}
  </AppShell></ProtectedPage>;
}
