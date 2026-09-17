"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LoginScreen } from "@/components/LoginScreen";
import { AccessState } from "@/components/AccessState";

export default function HomePage() {
  const { firebaseUser, profile, loading, error, refreshProfile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading || !profile || profile.status !== "active") return;
    router.replace(profile.role === "admin" ? "/admin" : "/dashboard");
  }, [loading, profile, router]);

  if (loading) return <div className="full-loader"><div className="spinner" /><span>Đang mở ứng dụng...</span></div>;
  if (!firebaseUser) return <LoginScreen />;
  if (!profile && error) return <main className="access-page"><section className="access-card"><div className="state-icon">!</div><h1>Không thể tải tài khoản</h1><p>{error}</p><div className="form-actions end"><button className="secondary-button" onClick={logout}>Đăng xuất</button><button className="primary-button" onClick={() => void refreshProfile().catch(() => undefined)}>Thử lại</button></div></section></main>;
  if (!profile || profile.status !== "active") return <AccessState />;
  return <div className="full-loader"><div className="spinner" /><span>Đang chuyển trang...</span></div>;
}
