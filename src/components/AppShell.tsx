"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  BookOpenCheck,
  CheckSquare2,
  ChevronDown,
  ClipboardList,
  Database,
  FileClock,
  Home,
  LogOut,
  Menu,
  PlusCircle,
  Settings2,
  Tags,
  UserCog,
  Users,
  X
} from "lucide-react";
import { useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { NotificationBell } from "@/components/NotificationBell";
import { APP_NAME } from "@/lib/constants";

const employeeNav = [
  { href: "/dashboard", label: "Trang chủ", icon: Home },
  { href: "/work/new", label: "Thêm công việc", icon: PlusCircle },
  { href: "/work", label: "Công việc của tôi", icon: ClipboardList },
  { href: "/reports", label: "Báo cáo", icon: BookOpenCheck }
];

const adminNav = [
  { href: "/admin", label: "Tổng quan", icon: Home },
  { href: "/admin/users", label: "Tài khoản", icon: UserCog },
  { href: "/admin/data", label: "Dữ liệu", icon: Database },
  { href: "/admin/categories", label: "Danh mục", icon: Tags },
  { href: "/admin/audit", label: "Lịch sử thay đổi", icon: FileClock },
  { href: "/admin/reports", label: "Báo cáo", icon: BookOpenCheck }
];

export function AppShell({ children, title }: { children: React.ReactNode; title?: string }) {
  const { profile, logout } = useAuth();
  const pathname = usePathname();
  const [profileOpen, setProfileOpen] = useState(false);
  const [mobileMenu, setMobileMenu] = useState(false);
  if (!profile) return null;
  const isAdminArea = pathname.startsWith("/admin");
  const nav = isAdminArea ? adminNav : employeeNav;

  return (
    <div className="app-frame">
      <aside className={`sidebar ${mobileMenu ? "mobile-open" : ""}`}>
        <div className="sidebar-brand"><CheckSquare2 size={28} /><span>{APP_NAME}</span></div>
        <nav className="sidebar-nav">
          {nav.map((item) => {
            const Icon = item.icon;
            const active = pathname === item.href || (item.href !== "/dashboard" && item.href !== "/admin" && pathname.startsWith(item.href));
            return <Link key={item.href} href={item.href} className={`nav-link ${active ? "active" : ""}`} onClick={() => setMobileMenu(false)}><Icon size={19} /><span>{item.label}</span></Link>;
          })}
          {profile.role === "admin" && !isAdminArea && <Link href="/admin" className="nav-link admin-shortcut"><Settings2 size={19} /><span>Quản trị viên</span></Link>}
          {profile.role === "admin" && isAdminArea && <Link href="/dashboard" className="nav-link admin-shortcut"><Users size={19} /><span>Công việc của tôi</span></Link>}
        </nav>
      </aside>
      {mobileMenu && <button aria-label="Đóng menu" className="mobile-overlay" onClick={() => setMobileMenu(false)} />}

      <div className="app-main">
        <header className="topbar">
          <div className="topbar-left">
            <button className="menu-button" onClick={() => setMobileMenu(true)} aria-label="Mở menu"><Menu size={22} /></button>
            <div>
              {title && <h1 className="page-title">{title}</h1>}
            </div>
          </div>
          <div className="topbar-actions">
            <NotificationBell />
            <div className="profile-wrap">
              <button className="profile-button" onClick={() => setProfileOpen((v) => !v)}>
                <span className="avatar">{profile.photoURL ? <img src={profile.photoURL} alt="" /> : (profile.displayName || profile.email).slice(0, 1).toUpperCase()}</span>
                <span className="profile-text"><strong>{profile.displayName || profile.email}</strong><small>{profile.role === "admin" ? "Quản trị viên" : "Người dùng"}</small></span>
                <ChevronDown size={16} />
              </button>
              {profileOpen && (
                <div className="profile-menu">
                  <div className="profile-menu-head"><strong>{profile.displayName || profile.email}</strong><span>{profile.email}</span></div>
                  <Link href="/profile" onClick={() => setProfileOpen(false)}><UserCog size={17} /> Thông tin tài khoản</Link>
                  <Link href="/notifications" onClick={() => setProfileOpen(false)}><Bell size={17} /> Thông báo</Link>
                  {profile.role === "admin" && <Link href="/admin" onClick={() => setProfileOpen(false)}><Settings2 size={17} /> Quản trị</Link>}
                  <button onClick={logout} className="danger-link"><LogOut size={17} /> Đăng xuất</button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="content-area">{children}</main>
      </div>

      {!isAdminArea && (
        <nav className="bottom-nav">
          <Link href="/dashboard" className={pathname === "/dashboard" ? "active" : ""}><Home size={20} /><span>Trang chủ</span></Link>
          <Link href="/work" className={pathname === "/work" ? "active" : ""}><ClipboardList size={20} /><span>Công việc</span></Link>
          <Link href="/work/new" className="add-main" aria-label="Thêm công việc"><PlusCircle size={29} /></Link>
          <Link href="/reports" className={pathname === "/reports" ? "active" : ""}><BookOpenCheck size={20} /><span>Báo cáo</span></Link>
          <Link href="/notifications" className={pathname === "/notifications" ? "active" : ""}><Bell size={20} /><span>Thông báo</span></Link>
        </nav>
      )}
    </div>
  );
}
