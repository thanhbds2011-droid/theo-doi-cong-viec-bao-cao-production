"use client";

import Link from "next/link";
import { Bell, CheckCheck } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/components/AuthProvider";
import { subscribeNotifications } from "@/lib/client-data";
import type { AppNotification } from "@/lib/types";
import { formatDateTime } from "@/lib/format";
import { apiFetch } from "@/lib/api-client";
import { useToast } from "@/components/ToastProvider";

export function NotificationBell() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!profile?.uid || profile.status !== "active") return;
    return subscribeNotifications(profile.uid, setItems);
  }, [profile?.uid, profile?.status]);

  const unread = useMemo(() => items.filter((item) => !item.read).length, [items]);

  async function markRead(id: string) {
    try {
      await apiFetch(`/api/notifications/${id}/read`, { method: "POST" });
    } catch (error: any) {
      showToast(error.message || "Không thể cập nhật thông báo.", "error");
    }
  }

  async function markAll() {
    try {
      await apiFetch("/api/notifications/read-all", { method: "POST" });
      showToast("Đã đánh dấu tất cả thông báo là đã đọc.", "success");
    } catch (error: any) {
      showToast(error.message || "Không thể cập nhật thông báo.", "error");
    }
  }

  return (
    <div className="notification-wrap">
      <button className="icon-button" aria-label="Thông báo" onClick={() => setOpen((v) => !v)}>
        <Bell size={20} />
        {unread > 0 && <span className="notification-badge">{unread > 99 ? "99+" : unread}</span>}
      </button>
      {open && (
        <div className="notification-popover">
          <div className="popover-head">
            <strong>Thông báo</strong>
            {unread > 0 && <button className="text-button" onClick={markAll}><CheckCheck size={15} /> Đã đọc tất cả</button>}
          </div>
          <div className="notification-list compact-scroll">
            {items.slice(0, 7).map((item) => (
              <button
                key={item.id}
                className={`notification-item ${item.read ? "" : "unread"}`}
                onClick={async () => {
                  if (!item.read) await markRead(item.id);
                  setOpen(false);
                  if (item.relatedUserUid && profile?.role === "admin") {
                    window.location.href = `/admin/users?status=pending&user=${encodeURIComponent(item.relatedUserUid)}`;
                  } else if (item.relatedRecordId) {
                    window.location.href = profile?.role === "admin" ? `/admin/data?record=${encodeURIComponent(item.relatedRecordId)}` : `/work?record=${encodeURIComponent(item.relatedRecordId)}`;
                  }
                }}
              >
                <span className="notification-dot" />
                <span className="notification-copy">
                  <strong>{item.title}</strong>
                  <span>{item.message}</span>
                  <small>{formatDateTime(item.createdAt)}</small>
                </span>
              </button>
            ))}
            {!items.length && <div className="empty-mini">Chưa có thông báo.</div>}
          </div>
          <Link className="popover-footer" href="/notifications" onClick={() => setOpen(false)}>Xem tất cả thông báo</Link>
        </div>
      )}
    </div>
  );
}
