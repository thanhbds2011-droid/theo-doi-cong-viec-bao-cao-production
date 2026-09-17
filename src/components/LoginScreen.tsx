"use client";

import { GoogleAuthProvider, signInWithPopup, signInWithRedirect } from "firebase/auth";
import { BarChart3, CheckSquare2, LockKeyhole, ShieldCheck } from "lucide-react";
import { auth } from "@/lib/firebase-client";
import { APP_NAME, APP_VERSION } from "@/lib/constants";
import { useToast } from "@/components/ToastProvider";

export function LoginScreen() {
  const { showToast } = useToast();

  async function login() {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    try {
      await signInWithPopup(auth, provider);
    } catch (error: any) {
      if (["auth/popup-blocked", "auth/cancelled-popup-request"].includes(error?.code)) {
        await signInWithRedirect(auth, provider);
        return;
      }
      if (error?.code !== "auth/popup-closed-by-user") showToast("Không thể đăng nhập Google. Vui lòng thử lại.", "error");
    }
  }

  return (
    <main className="login-page">
      <section className="login-card">
        <div className="brand-mark large"><CheckSquare2 size={48} strokeWidth={2.1} /></div>
        <h1>{APP_NAME}</h1>
        <p className="login-subtitle">Đơn giản · Hiệu quả · Minh bạch</p>
        <div className="login-illustration" aria-hidden="true">
          <div className="building b1" /><div className="building b2" /><div className="building b3" />
          <div className="ground" />
        </div>
        <p className="login-message">Quản lý công việc dễ dàng<br />Kết nối · Đồng hành · Phát triển</p>
        <button className="google-button" onClick={login}>
          <span className="google-g">G</span>
          Đăng nhập với Google
        </button>
        <p className="muted small">Sử dụng tài khoản Gmail để đăng nhập</p>
        <div className="login-features">
          <div><ShieldCheck size={22} /><span>An toàn</span></div>
          <div><LockKeyhole size={22} /><span>Bảo mật</span></div>
          <div><BarChart3 size={22} /><span>Hiệu quả</span></div>
        </div>
        <p className="version-note">v{APP_VERSION}</p>
      </section>
    </main>
  );
}
