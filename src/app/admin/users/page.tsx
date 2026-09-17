"use client";

import { ShieldCheck, UserCog, UserPlus, X } from "lucide-react";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { AppUser, UserRole, UserStatus } from "@/lib/types";

type Action = "approve" | "reject" | "disable" | "enable" | "rename" | "change_role";
const stateLabels: Record<UserStatus, string> = {
  pending: "Đang chờ phê duyệt", active: "Đã được phê duyệt",
  rejected: "Đã từ chối", disabled: "Đang tạm khóa"
};
const stateClasses: Record<UserStatus, string> = {
  pending: "tag-orange", active: "tag-green", rejected: "tag-red", disabled: "tag-gray"
};
const actionLabels: Record<Action, string> = {
  approve: "Phê duyệt", reject: "Từ chối", disable: "Tạm khóa", enable: "Mở khóa",
  rename: "Chỉnh sửa tên hiển thị", change_role: "Thay đổi quyền sử dụng"
};

function UsersContent() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const searchParams = useSearchParams();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<UserStatus | "all">("all");
  const [selected, setSelected] = useState<AppUser | null>(null);
  const [action, setAction] = useState<Action | null>(null);
  const [displayName, setDisplayName] = useState("");
  const [role, setRole] = useState<UserRole>("employee");
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const result = await apiFetch<{ok: true; users: AppUser[]}>("/api/admin/users");
      setUsers(result.users);
    } catch (error: any) {
      showToast(error.message || "Không thể tải danh sách tài khoản.", "error");
    } finally { setLoading(false); }
  }

  useEffect(() => { if (profile?.status === "active" && profile.role === "admin") void load(); }, [profile?.uid, profile?.status, profile?.role]);
  useEffect(() => {
    const status = searchParams.get("status");
    setFilter(status && ["pending", "active", "rejected", "disabled"].includes(status) ? status as UserStatus : "all");
  }, [searchParams]);
  const shown = useMemo(() => filter === "all" ? users : users.filter((u) => u.status === filter), [users, filter]);
  const highlight = searchParams.get("user");

  function open(user: AppUser, next: Action) {
    setSelected(user);
    setAction(next);
    setDisplayName(next === "approve" ? user.displayName || "" : user.displayName || "");
    setRole(user.role === "admin" ? "employee" : "admin");
    setReason("");
  }
  function close() { if (!saving) { setSelected(null); setAction(null); } }

  async function save() {
    if (!selected || !action || saving) return;
    if ((action === "approve" || action === "rename") && !displayName.trim()) {
      showToast("Vui lòng nhập tên hiển thị trước khi tiếp tục.", "error"); return;
    }
    if (["disable", "change_role"].includes(action) && !reason.trim()) {
      showToast("Vui lòng nhập lý do thực hiện thao tác này.", "error"); return;
    }
    setSaving(true);
    try {
      const result = await apiFetch<{ok: true; user: AppUser}>(`/api/admin/users/${encodeURIComponent(selected.uid)}`, {
        method: "PATCH",
        body: JSON.stringify({ action, displayName: displayName.trim(), role, reason: reason.trim() })
      });
      setUsers((prev) => prev.map((u) => u.uid === selected.uid ? result.user : u));
      const subject = result.user.displayName || result.user.googleDisplayName || result.user.email;
      showToast(`Đã ${actionLabels[action].toLocaleLowerCase("vi-VN")} tài khoản của ${subject}.`, "success");
      setSelected(null); setAction(null);
    } catch (error: any) {
      showToast(error.message || "Không thể cập nhật tài khoản. Vui lòng thử lại.", "error");
    } finally { setSaving(false); }
  }

  return <ProtectedPage adminOnly><AppShell title="Tài khoản">
    <div className="admin-toolbar">
      <div><strong>Quản lý tài khoản</strong><div className="muted small">Xem xét yêu cầu truy cập, đặt tên hiển thị và quản lý quyền sử dụng.</div></div>
      <div className="report-tools">{(["all", "pending", "active", "rejected", "disabled"] as const).map((s) =>
        <button key={s} className={filter === s ? "primary-button" : "secondary-button"} onClick={() => setFilter(s)}>
          {s === "all" ? `Tất cả (${users.length})` : `${stateLabels[s]} (${users.filter((u) => u.status === s).length})`}
        </button>)}
      </div>
    </div>
    <div className="user-grid">
      {shown.map((u) => <article className="user-card" key={u.uid} style={highlight === u.uid ? {outline: "2px solid #2563eb"} : undefined}>
        <div className="user-card-head"><span className="avatar">{u.photoURL ? <img src={u.photoURL} alt=""/> : (u.displayName || u.googleDisplayName || u.email).slice(0,1).toUpperCase()}</span>
          <div className="user-card-copy"><strong>{u.displayName || u.googleDisplayName || "Chưa đặt tên hiển thị"}</strong><span>{u.email}</span></div>
        </div>
        <div className="user-card-meta"><span className={`tag ${stateClasses[u.status]}`}>{stateLabels[u.status]}</span><span className="tag tag-blue">{u.role === "admin" ? "Quản trị viên" : "Người dùng"}</span></div>
        <div className="muted small" style={{marginTop: 12}}>Tên Google: {u.googleDisplayName || "—"}<br/>Gửi yêu cầu: {formatDateTime(u.requestedAt)}</div>
        {u.status === "rejected" && u.rejectedReason && <p className="muted small">Lý do từ chối: {u.rejectedReason}</p>}
        <div className="user-card-actions" style={{ flexWrap: "wrap" }}>
          {u.status === "pending" && <><button className="primary-button" onClick={() => open(u,"approve")}><ShieldCheck size={16}/> Phê duyệt</button><button className="secondary-button" onClick={() => open(u,"reject")}>Từ chối</button></>}
          {u.status === "active" && <><button className="secondary-button" onClick={() => open(u,"rename")}><UserCog size={16}/> Đổi tên</button><button className="secondary-button" onClick={() => open(u,"change_role")}>Đổi quyền</button><button className="secondary-button" disabled={u.uid === profile?.uid} onClick={() => open(u,"disable")}>Tạm khóa</button></>}
          {u.status === "disabled" && <><button className="primary-button" onClick={() => open(u,"enable")}>Mở khóa</button><button className="secondary-button" onClick={() => open(u,"rename")}>Đổi tên</button></>}
          {u.status === "rejected" && <button className="primary-button" onClick={() => open(u,"approve")}>Xem xét và phê duyệt</button>}
        </div>
      </article>)}
    </div>
    {!shown.length && !loading && <div className="panel empty-state"><UserPlus size={34}/><h3>Không có tài khoản</h3><p>Chưa có tài khoản phù hợp với lựa chọn hiện tại.</p></div>}

    {selected && action && <div className="modal-backdrop" role="presentation" onMouseDown={(event) => {if (event.target === event.currentTarget) close();}}>
      <section className="modal small" role="dialog" aria-modal="true" aria-label={actionLabels[action]}>
        <header className="modal-head"><div><h3>{actionLabels[action]} tài khoản</h3><span className="muted small">{selected.email}</span></div><button type="button" className="modal-close" aria-label="Đóng" disabled={saving} onClick={close}><X size={18}/></button></header>
        <div className="modal-body">
          <div className="detail-item wide"><span>Tên tài khoản Google</span><strong>{selected.googleDisplayName || "Chưa có tên"}</strong></div>
          <div className="form-grid" style={{marginTop: 16}}>
            {(action === "approve" || action === "rename") && <label className="field field-wide"><span>Tên hiển thị <b>*</b></span><input maxLength={160} autoFocus value={displayName} onChange={(e) => setDisplayName(e.target.value)} placeholder="Nhập họ và tên người sử dụng"/></label>}
            {action === "approve" && <p className="field-wide muted small">Tài khoản sẽ được cấp quyền Người dùng. Nếu cần cấp quyền quản trị, hãy thực hiện thao tác riêng sau khi phê duyệt.</p>}
            {action === "change_role" && <label className="field field-wide"><span>Quyền sử dụng mới</span><select value={role} onChange={(e) => setRole(e.target.value as UserRole)}><option value="employee">Người dùng</option><option value="admin">Quản trị viên</option></select></label>}
            {action === "reject" && <p className="field-wide muted small">Tài khoản sẽ không thể sử dụng ứng dụng sau khi bị từ chối.</p>}
            {action === "disable" && <p className="field-wide muted small">Người dùng sẽ mất quyền truy cập ngay sau khi tài khoản được tạm khóa.</p>}
            {action === "enable" && <p className="field-wide muted small">Người dùng sẽ được phép truy cập ứng dụng trở lại.</p>}
            {action === "change_role" && <p className="field-wide muted small">Hãy kiểm tra kỹ trước khi cấp hoặc thu hồi quyền quản trị viên.</p>}
            {(["reject", "disable", "enable", "rename", "change_role"] as Action[]).includes(action) && <label className="field field-wide"><span>Lý do {(["disable", "change_role"] as Action[]).includes(action) ? "*" : "(không bắt buộc)"}</span><textarea rows={3} maxLength={1000} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Nhập lý do để lưu trong lịch sử thay đổi"/></label>}
          </div>
        </div>
        <footer className="modal-foot"><button type="button" className="secondary-button" disabled={saving} onClick={close}>Hủy</button><button type="button" className="primary-button" disabled={saving} onClick={save}>{saving ? "Đang xử lý..." : `Xác nhận ${actionLabels[action].toLocaleLowerCase("vi-VN")}`}</button></footer>
      </section>
    </div>}
  </AppShell></ProtectedPage>;
}

export default function AdminUsersPage() {
  return <Suspense fallback={<div className="full-loader"><div className="spinner"/><span>Đang tải tài khoản...</span></div>}><UsersContent/></Suspense>;
}
