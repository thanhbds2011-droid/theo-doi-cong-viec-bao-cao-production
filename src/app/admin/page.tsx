"use client";

import Link from "next/link";
import { Database, FileClock, Tags, UserCheck, UserPlus, Users } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { apiFetch } from "@/lib/api-client";
import { fetchWorkRecords } from "@/lib/client-data";
import { monthRange } from "@/lib/format";
import type { AppUser, WorkRecord } from "@/lib/types";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";

export default function AdminDashboardPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [users, setUsers] = useState<AppUser[]>([]);
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || profile.role !== "admin" || profile.status !== "active") return;
    const range = monthRange();
    Promise.all([
      apiFetch<{ ok: true; users: AppUser[] }>("/api/admin/users").then((r) => r.users),
      fetchWorkRecords({ role: "admin", uid: profile.uid, from: range.from, to: range.to, pageSize: 300 }).then((r) => r.records)
    ]).then(([u, w]) => { setUsers(u); setRecords(w); })
      .catch((error: any) => showToast(error.message || "Không tải được dữ liệu quản trị.", "error"))
      .finally(() => setLoading(false));
  }, [profile?.uid]);

  const employees = users.filter((u) => u.role === "employee");
  const pending = users.filter((u) => u.status === "pending").length;
  const activeEmployees = employees.filter((u) => u.status === "active").length;
  const files = records.reduce((sum, r) => sum + (r.attachments?.length || 0), 0);
  const latestPending = useMemo(() => users.filter((u) => u.status === "pending").slice(0, 6), [users]);

  return (
    <ProtectedPage adminOnly>
      <AppShell title="Quản trị">
        <div className="hero-row"><div className="hero-copy"><h2>Tổng quan hệ thống</h2><p>Quản lý tài khoản, dữ liệu, danh mục và lịch sử chỉnh sửa trong một nơi.</p></div><Link href="/admin/users" className="primary-button"><Users size={17} /> Quản lý tài khoản</Link></div>
        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-icon"><UserPlus size={20} /></div><strong>{loading ? "…" : pending}</strong><span>Tài khoản chờ duyệt</span></div>
          <div className="kpi-card green"><div className="kpi-icon"><UserCheck size={20} /></div><strong>{loading ? "…" : activeEmployees}</strong><span>Người dùng đang hoạt động</span></div>
          <div className="kpi-card orange"><div className="kpi-icon"><Database size={20} /></div><strong>{loading ? "…" : records.length}</strong><span>Công việc gần đây trong tháng</span></div>
          <div className="kpi-card purple"><div className="kpi-icon"><FileClock size={20} /></div><strong>{loading ? "…" : files}</strong><span>Tệp trong các công việc gần đây</span></div>
        </div>

        <div className="dashboard-grid">
          <section className="panel panel-pad">
            <div className="section-head"><div><h3>Yêu cầu tài khoản mới</h3><p>Gmail mới chỉ được sử dụng ứng dụng sau khi quản trị viên phê duyệt và đặt tên hiển thị.</p></div><Link href="/admin/users" className="text-button">Xem tất cả</Link></div>
            <div className="recent-list">
              {latestPending.map((u) => <Link href="/admin/users" className="recent-row" key={u.uid}><span className="avatar">{(u.googleDisplayName || u.email).slice(0,1).toUpperCase()}</span><span className="recent-copy"><strong>{u.googleDisplayName || "Chưa có tên Google"}</strong><span>{u.email}</span></span><span className="tag tag-orange">Chờ duyệt</span></Link>)}
              {!latestPending.length && !loading && <div className="empty-state"><UserCheck size={34} /><h3>Không có tài khoản chờ duyệt</h3><p>Tất cả yêu cầu hiện tại đã được xử lý.</p></div>}
            </div>
          </section>
          <section className="panel panel-pad">
            <div className="section-head"><div><h3>Truy cập nhanh</h3><p>Các khu vực quản trị thường dùng.</p></div></div>
            <div className="recent-list">
              <Link className="recent-row" href="/admin/data"><span className="type-badge-icon type-bhxh"><Database size={18} /></span><span className="recent-copy"><strong>Toàn bộ dữ liệu</strong><span>Lọc, xem, sửa và xóa theo quyền quản trị viên</span></span></Link>
              <Link className="recent-row" href="/admin/categories"><span className="type-badge-icon type-other"><Tags size={18} /></span><span className="recent-copy"><strong>Danh mục nghiệp vụ</strong><span>Nạp danh mục ban đầu, thêm/sửa/ẩn danh mục</span></span></Link>
              <Link className="recent-row" href="/admin/audit"><span className="type-badge-icon type-salary"><FileClock size={18} /></span><span className="recent-copy"><strong>Lịch sử chỉnh sửa</strong><span>Xem lý do và nội dung trước và sau khi thay đổi</span></span></Link>
            </div>
          </section>
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
