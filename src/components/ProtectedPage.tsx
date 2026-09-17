"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/AuthProvider";
import { LoginScreen } from "@/components/LoginScreen";
import { AccessState } from "@/components/AccessState";

export function ProtectedPage({ children, adminOnly = false }: { children: React.ReactNode; adminOnly?: boolean }) {
  const { firebaseUser, profile, loading, error, refreshProfile, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && adminOnly && profile?.status === "active" && profile.role !== "admin") router.replace("/dashboard");
  }, [loading, adminOnly, profile, router]);

  if (loading) return <div className="full-loader"><div className="spinner" /><span>Đang tải ứng dụng...</span></div>;
  if (!firebaseUser) return <LoginScreen />;
  if (!profile && error) {
    return (
      <main className="access-page">
        <section className="access-card">
          <div className="state-icon">!</div>
          <h1>Không thể tải tài khoản</h1>
          <p>{error}</p>
          <div className="form-actions end">
            <button className="secondary-button" onClick={logout}>Đăng xuất</button>
            <button className="primary-button" onClick={() => void refreshProfile().catch(() => undefined)}>Thử lại</button>
          </div>
        </section>
      </main>
    );
  }
  if (!profile || profile.status !== "active") return <AccessState />;
  if (adminOnly && profile.role !== "admin") return <div className="full-loader">Đang chuyển trang...</div>;
  return <>{children}</>;
}
