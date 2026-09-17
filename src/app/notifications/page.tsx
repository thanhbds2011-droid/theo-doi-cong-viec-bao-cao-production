"use client";

import { Bell, CheckCheck, ExternalLink } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { subscribeNotifications } from "@/lib/client-data";
import { apiFetch } from "@/lib/api-client";
import { formatDateTime } from "@/lib/format";
import type { AppNotification } from "@/lib/types";

export default function NotificationsPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [filter, setFilter] = useState<"all" | "unread">("all");

  useEffect(() => {
    if (!profile?.uid || profile.status !== "active") return;
    return subscribeNotifications(profile.uid, setItems);
  }, [profile?.uid, profile?.status]);

  const shown = useMemo(() => filter === "unread" ? items.filter((i) => !i.read) : items, [items, filter]);
  const unread = items.filter((i) => !i.read).length;

  async function markRead(item: AppNotification) {
    try {
      if (!item.read) await apiFetch(`/api/notifications/${item.id}/read`, { method: "POST" });
      if (item.relatedUserUid && profile?.role === "admin") {
        router.push(`/admin/users?status=pending&user=${encodeURIComponent(item.relatedUserUid)}`);
      } else if (item.relatedRecordId) {
        router.push(profile?.role === "admin" ? `/admin/data?record=${encodeURIComponent(item.relatedRecordId)}` : `/work?record=${encodeURIComponent(item.relatedRecordId)}`);
      }
    } catch (error: any) {
      showToast(error.message || "Không thể cập nhật thông báo.", "error");
    }
  }

  async function markAll() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      showToast("Đã đánh dấu tất cả là đã đọc.", "success");
    } catch (error: any) {
      showToast(error.message || "Không thể cập nhật thông báo.", "error");
    }
  }

  return (
    <ProtectedPage>
      <AppShell title="Thông báo">
        <div className="admin-toolbar">
          <div><strong>Trung tâm thông báo</strong><div className="muted small">{unread} thông báo chưa đọc</div></div>
          <div className="report-tools"><button className={filter === "all" ? "primary-button" : "secondary-button"} onClick={() => setFilter("all")}>Tất cả</button><button className={filter === "unread" ? "primary-button" : "secondary-button"} onClick={() => setFilter("unread")}>Chưa đọc</button>{unread > 0 && <button className="secondary-button" onClick={markAll}><CheckCheck size={16} /> Đã đọc tất cả</button>}</div>
        </div>
        <div className="notifications-page-list">
          {shown.map((item) => <article className={`notification-card ${item.read ? "" : "unread"}`} key={item.id}>
            <div className="notification-card-icon"><Bell size={19} /></div>
            <div className="notification-card-copy"><strong>{item.title}</strong><p>{item.message}</p><small>{formatDateTime(item.createdAt)}</small></div>
            <button className="secondary-button" onClick={() => markRead(item)}>{(item.relatedRecordId || item.relatedUserUid) ? <><ExternalLink size={15} /> Mở</> : item.read ? "Đã đọc" : "Đánh dấu đã đọc"}</button>
          </article>)}
          {!shown.length && <div className="panel empty-state"><Bell size={34} /><h3>Chưa có thông báo</h3><p>Thông báo tài khoản và các sự kiện nội bộ sẽ xuất hiện tại đây.</p></div>}
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
