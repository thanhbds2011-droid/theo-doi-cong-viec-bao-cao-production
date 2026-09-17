"use client";

import { Eye, FileClock, X } from "lucide-react";
import { useEffect, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useToast } from "@/components/ToastProvider";
import { fetchAudits } from "@/lib/client-data";
import { formatDateTime } from "@/lib/format";
import type { AuditEntry } from "@/lib/types";

const actionLabel: Record<AuditEntry["action"], string> = {
  work_create: "Tạo công việc",
  work_update: "Chỉnh sửa công việc",
  work_delete: "Xóa công việc",
  account_update: "Cập nhật tài khoản",
  category_create: "Tạo danh mục",
  category_update: "Cập nhật danh mục",
  system_reset: "Đặt lại dữ liệu"
};

const keyLabel: Record<string,string> = {
  displayName: "Tên hiển thị",
  status: "Trạng thái",
  role: "Vai trò",
  workDate: "Ngày thực hiện",
  workType: "Loại công việc",
  organization: "Tên đơn vị",
  quantity: "Số lượng",
  contentLabel: "Nội dung",
  tphs: "TPHS",
  resultDate: "Ngày kết quả",
  time: "Thời gian",
  trainingInstitution: "Cơ sở đào tạo",
  isActive: "Trạng thái danh mục",
  label: "Tên danh mục",
  approvedAt: "Ngày phê duyệt",
  rejectedAt: "Ngày từ chối",
  disabledAt: "Ngày tạm khóa",
  rejectedReason: "Lý do từ chối",
  googleDisplayName: "Tên tài khoản Google",
  email: "Gmail đăng nhập",
  requestedAt: "Ngày gửi yêu cầu",
  lastLoginAt: "Lần đăng nhập gần nhất"
};

function flatten(value: unknown, prefix = ""): Record<string,string> {
  if (!value || typeof value !== "object") return {};
  const out: Record<string,string> = {};
  for (const [key, raw] of Object.entries(value as Record<string,unknown>)) {
    if (["updatedAt","updatedBy","createdAt","createdBy","attachments","ownerUid","employeeId","ownerDisplayName","workYear","workMonth","uid","approvedBy","rejectedBy","onboardingNotifiedAt","photoURL"].includes(key)) continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (raw && typeof raw === "object" && !Array.isArray(raw)) Object.assign(out, flatten(raw, path));
    else if (raw !== undefined) {
      if (raw === null) out[path] = "—";
      else if (key === "role") out[path] = raw === "admin" ? "Quản trị viên" : "Người dùng";
      else if (key === "status") out[path] = ({pending:"Đang chờ phê duyệt",active:"Đã được phê duyệt",rejected:"Đã từ chối",disabled:"Đang tạm khóa"} as Record<string,string>)[String(raw)] || "—";
      else if (key === "isActive") out[path] = raw === true ? "Đang sử dụng" : "Đã ẩn";
      else if (key === "workType") out[path] = ({salary:"Lương",bhxh:"Bảo hiểm xã hội",tax:"Thuế",other:"Các nội dung khác",vocational:"Học nghề"} as Record<string,string>)[String(raw)] || "—";
      else out[path] = String(raw);
    }
  }
  return out;
}

function diff(entry: AuditEntry) {
  const before = flatten(entry.before);
  const after = flatten(entry.after);
  const keys = Array.from(new Set([...Object.keys(before), ...Object.keys(after)]));
  return keys.filter((k) => before[k] !== after[k] && !!keyLabel[k.split(".").pop() || k]).map((k) => ({ key: k, label: keyLabel[k.split(".").pop() || k], before: before[k] ?? "—", after: after[k] ?? "—" }));
}

export default function AdminAuditPage() {
  const { showToast } = useToast();
  const [items, setItems] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  useEffect(() => {
    fetchAudits(200)
      .then(setItems)
      .catch((error: any) => showToast(error.message || "Không tải được lịch sử chỉnh sửa.", "error"))
      .finally(() => setLoading(false));
  }, [showToast]);

  return <ProtectedPage adminOnly><AppShell title="Lịch sử chỉnh sửa">
    <div className="admin-toolbar"><div><strong>Lịch sử thay đổi</strong><div className="muted small">Theo dõi ai đã thao tác, thời điểm và lý do. Người dùng không thể sửa hoặc xóa lịch sử thay đổi.</div></div></div>
    <div className="audit-list">
      {items.map((item) => <article className="audit-row" key={item.id}><div className="audit-icon"><FileClock size={18}/></div><div className="audit-copy"><strong>{actionLabel[item.action]} · {item.actorDisplayName}</strong><span>{item.reason || "Không có lý do bổ sung"}</span><small>{formatDateTime(item.createdAt)}</small></div><button className="table-action" onClick={()=>setSelected(item)} title="Xem chi tiết"><Eye size={16}/></button></article>)}
      {!items.length && !loading && <div className="panel empty-state"><FileClock size={34}/><h3>Chưa có lịch sử</h3><p>Các thao tác tạo/sửa/xóa/quản trị sẽ được ghi tại đây.</p></div>}
    </div>
    {selected && <div className="modal-backdrop"><section className="modal"><header className="modal-head"><div><h3>{actionLabel[selected.action]}</h3><span className="muted small">{selected.actorDisplayName} · {formatDateTime(selected.createdAt)}</span></div><button className="modal-close" onClick={()=>setSelected(null)}><X size={18}/></button></header><div className="modal-body">
      <div className="detail-grid"><div className="detail-item"><span>Người thao tác</span><strong>{selected.actorDisplayName}</strong></div><div className="detail-item"><span>Thời điểm</span><strong>{formatDateTime(selected.createdAt)}</strong></div><div className="detail-item wide"><span>Lý do</span><strong>{selected.reason || "—"}</strong></div></div>
      <div style={{marginTop:16}}><strong>Thay đổi</strong><div className="category-grid" style={{marginTop:10}}>{diff(selected).map((d)=><div className="category-card" key={d.key}><div className="category-card-copy"><strong>{d.label}</strong><span>Trước: {d.before}</span><span>Sau: {d.after}</span></div></div>)}</div>{!diff(selected).length && <div className="muted small" style={{marginTop:10}}>Không có trường hiển thị nào thay đổi hoặc đây là sự kiện tạo/xóa hệ thống.</div>}</div>
    </div><footer className="modal-foot"><button className="secondary-button" onClick={()=>setSelected(null)}>Đóng</button></footer></section></div>}
  </AppShell></ProtectedPage>;
}
