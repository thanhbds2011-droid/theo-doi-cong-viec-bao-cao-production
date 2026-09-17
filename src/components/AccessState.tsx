"use client";

import { Clock3, LogOut, ShieldX } from "lucide-react";
import { useAuth } from "@/components/AuthProvider";

export function AccessState() {
  const { profile, logout } = useAuth();
  if (!profile) return null;

  const config = {
    pending: {
      icon: <Clock3 size={38} />,
      title: "Yêu cầu truy cập đang chờ phê duyệt",
      message: "Yêu cầu sử dụng hệ thống của bạn đã được gửi. Quản trị viên sẽ xem xét và phê duyệt tài khoản. Bạn chưa thể sử dụng các chức năng trong thời gian chờ."
    },
    rejected: {
      icon: <ShieldX size={38} />,
      title: "Yêu cầu truy cập chưa được chấp thuận",
      message: "Vui lòng liên hệ quản trị viên nếu bạn cho rằng đây là nhầm lẫn."
    },
    disabled: {
      icon: <ShieldX size={38} />,
      title: "Tài khoản của bạn đang tạm khóa",
      message: "Quyền truy cập đã bị tạm khóa. Vui lòng liên hệ quản trị viên để được hỗ trợ."
    }
  } as const;

  const state = config[profile.status as keyof typeof config];
  if (!state) return null;

  return (
    <main className="access-page">
      <section className="access-card">
        <div className="state-icon">{state.icon}</div>
        <h1>{state.title}</h1>
        <p>{state.message}</p>
        <div className="identity-box">
          <strong>{profile.googleDisplayName || profile.email}</strong>
          <span>{profile.email}</span>
        </div>
        <button className="secondary-button" onClick={logout}><LogOut size={18} /> Đăng xuất</button>
      </section>
    </main>
  );
}
