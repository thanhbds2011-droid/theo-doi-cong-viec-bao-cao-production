"use client";

import { Mail, ShieldCheck, UserRound } from "lucide-react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { formatDateTime } from "@/lib/format";

export default function ProfilePage() {
  const { profile } = useAuth();
  return <ProtectedPage><AppShell title="Thông tin tài khoản">
    <section className="panel panel-pad" style={{ maxWidth: 760, margin: "0 auto" }}>
      <div className="section-head"><div><h2>{profile?.displayName || profile?.email}</h2><p>Quản trị viên thiết lập tên hiển thị để thông tin báo cáo được thống nhất.</p></div></div>
      <div className="detail-grid">
        <div className="detail-item"><span>Gmail đăng nhập</span><strong><Mail size={14} style={{verticalAlign:"middle",marginRight:5}} />{profile?.email}</strong></div>
        <div className="detail-item"><span>Quyền sử dụng</span><strong><ShieldCheck size={14} style={{verticalAlign:"middle",marginRight:5}} />{profile?.role === "admin" ? "Quản trị viên" : "Người dùng"}</strong></div>
        <div className="detail-item"><span>Tên hiển thị</span><strong><UserRound size={14} style={{verticalAlign:"middle",marginRight:5}} />{profile?.displayName || "Chưa cập nhật"}</strong></div>
        <div className="detail-item"><span>Trạng thái</span><strong>Đã được phê duyệt</strong></div>
        <div className="detail-item"><span>Đăng nhập gần nhất</span><strong>{formatDateTime(profile?.lastLoginAt)}</strong></div>
        <div className="detail-item"><span>Cập nhật hồ sơ</span><strong>{formatDateTime(profile?.updatedAt)}</strong></div>
      </div>
    </section>
  </AppShell></ProtectedPage>;
}
