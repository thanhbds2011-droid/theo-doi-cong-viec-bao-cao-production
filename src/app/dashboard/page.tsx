"use client";

import Link from "next/link";
import { CalendarDays, FileText, Plus, Rows3, Sparkles } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { ProtectedPage } from "@/components/ProtectedPage";
import { AppShell } from "@/components/AppShell";
import { WorkTypeIcon } from "@/components/WorkTypeIcon";
import { useAuth } from "@/components/AuthProvider";
import { useToast } from "@/components/ToastProvider";
import { fetchWorkRecords } from "@/lib/client-data";
import { formatDate, getWorkSummary, monthRange, todayIso } from "@/lib/format";
import { WORK_TYPE_LABELS } from "@/lib/constants";
import type { WorkRecord, WorkType } from "@/lib/types";

const types: WorkType[] = ["salary", "bhxh", "tax", "other", "vocational"];

function startOfWeekIso() {
  const d = new Date();
  const day = d.getDay() || 7;
  d.setHours(0,0,0,0);
  d.setDate(d.getDate() - day + 1);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const date = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${date}`;
}

export default function DashboardPage() {
  const { profile } = useAuth();
  const { showToast } = useToast();
  const [records, setRecords] = useState<WorkRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!profile || profile.status !== "active") return;
    const range = monthRange();
    setLoading(true);
    fetchWorkRecords({ role: "employee", uid: profile.uid, from: range.from, to: range.to, pageSize: 200 })
      .then((result) => setRecords(result.records))
      .catch((error: any) => showToast(error.message || "Không tải được dữ liệu trang chủ.", "error"))
      .finally(() => setLoading(false));
  }, [profile]);

  const today = todayIso();
  const weekStart = startOfWeekIso();
  const todayCount = records.filter((r) => r.workDate === today).length;
  const weekCount = records.filter((r) => r.workDate >= weekStart && r.workDate <= today).length;
  const attachmentCount = records.reduce((sum, r) => sum + (r.attachments?.length || 0), 0);
  const breakdown = useMemo(() => types.map((type) => ({ type, count: records.filter((r) => r.workType === type).length })), [records]);
  const max = Math.max(1, ...breakdown.map((item) => item.count));

  return (
    <ProtectedPage>
      <AppShell title="Trang chủ">
        <div className="hero-row">
          <div className="hero-copy">
            <h2>Xin chào, {profile?.displayName || "bạn"} 👋</h2>
            <p>Tổng quan từ tối đa 200 công việc gần đây trong tháng của bạn.</p>
          </div>
          <Link href="/work/new" className="primary-button quick-add"><Plus size={18} /> Thêm công việc</Link>
        </div>

        <div className="kpi-grid">
          <div className="kpi-card"><div className="kpi-icon"><Rows3 size={20} /></div><strong>{loading ? "…" : records.length}</strong><span>Công việc gần đây trong tháng</span></div>
          <div className="kpi-card green"><div className="kpi-icon"><CalendarDays size={20} /></div><strong>{loading ? "…" : todayCount}</strong><span>Công việc hôm nay</span></div>
          <div className="kpi-card orange"><div className="kpi-icon"><Sparkles size={20} /></div><strong>{loading ? "…" : weekCount}</strong><span>Công việc tuần này</span></div>
          <div className="kpi-card purple"><div className="kpi-icon"><FileText size={20} /></div><strong>{loading ? "…" : attachmentCount}</strong><span>Tệp đính kèm</span></div>
        </div>

        <div className="dashboard-grid">
          <section className="panel panel-pad">
            <div className="section-head"><div><h3>Công việc gần đây</h3><p>Các bản ghi mới nhất trong tháng.</p></div><Link href="/work" className="text-button">Xem tất cả</Link></div>
            <div className="recent-list">
              {records.slice(0, 7).map((record) => (
                <Link href={`/work?record=${encodeURIComponent(record.id)}`} className="recent-row" key={record.id}>
                  <span className={`type-badge-icon type-${record.workType}`}><WorkTypeIcon type={record.workType} size={18} /></span>
                  <span className="recent-copy"><strong>{WORK_TYPE_LABELS[record.workType]}</strong><span>{getWorkSummary(record)}</span></span>
                  <span className="recent-date">{formatDate(record.workDate)}</span>
                </Link>
              ))}
              {!loading && !records.length && <div className="empty-state"><Rows3 size={34} /><h3>Chưa có công việc trong tháng</h3><p>Bấm “Thêm công việc” để tạo bản ghi đầu tiên.</p></div>}
            </div>
          </section>

          <section className="panel panel-pad">
            <div className="section-head"><div><h3>Nhóm công việc</h3><p>Phân bổ theo 5 nghiệp vụ đã chốt.</p></div></div>
            <div className="breakdown-list">
              {breakdown.map((item) => (
                <div className="breakdown-row" key={item.type}><span>{WORK_TYPE_LABELS[item.type]}</span><div className="breakdown-bar"><div className="breakdown-fill" style={{ width: `${(item.count / max) * 100}%` }} /></div><b>{item.count}</b></div>
              ))}
            </div>
          </section>
        </div>
      </AppShell>
    </ProtectedPage>
  );
}
