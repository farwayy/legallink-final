import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Scale, Building2, ShieldAlert, Star, RefreshCw, Download, CheckCircle2, ArrowUpRight } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import { adminAPI, reviewAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { downloadCSV } from "../../components/admin/csv";
import { daysSince, waitingLabel } from "../../components/admin/helpers";
import { ACTION_LABELS } from "./AuditLog";

const LATE_AFTER_DAYS = 2; // anything waiting longer than this is shown in red

const STATUS_GROUPS = [
  { key: "pending", label: "Pending", match: ["pending", "under_review"], color: "var(--ax-chart-3)" },
  { key: "active", label: "Active", match: ["assigned", "in_progress"], color: "var(--ax-chart-2)" },
  { key: "resolved", label: "Resolved", match: ["resolved", "closed"], color: "var(--ax-chart-1)" },
  { key: "rejected", label: "Rejected", match: ["rejected"], color: "var(--ax-chart-4)" },
];

// Same wording as the audit log, starting lower-case to read as a sentence
const auditText = (action) => {
  const label = ACTION_LABELS[action];
  return label ? label.charAt(0).toLowerCase() + label.slice(1) : String(action || "").toLowerCase().replace(/_/g, " ");
};

const Dashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState({ stats: {}, lawyers: [], ngos: [], cases: [], users: [], disputes: [], reviews: [], logs: [] });

  const load = useCallback(async () => {
    setLoading(true);
    const [s, l, n, c, u, d, r, a] = await Promise.all([
      adminAPI.getStats().catch(() => null),
      adminAPI.getLawyers().catch(() => null),
      adminAPI.getNGOs().catch(() => null),
      adminAPI.getCases().catch(() => null),
      adminAPI.getUsers().catch(() => null),
      adminAPI.getDisputes().catch(() => null),
      reviewAPI.getFlaggedReviews().catch(() => null),
      adminAPI.getAuditLogs({ limit: 8 }).catch(() => null),
    ]);
    setData({
      stats: s?.data || {},
      lawyers: l?.data?.lawyers || [],
      ngos: n?.data?.ngos || [],
      cases: c?.data?.cases || [],
      users: u?.data?.users || [],
      disputes: d?.data?.disputes || [],
      reviews: r?.data?.reviews || [],
      logs: a?.data?.logs || [],
    });
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const { lawyers, ngos, cases, users, disputes, reviews, logs, stats } = data;
  const in30 = (d) => d && daysSince(d) <= 30;

  const pendingLawyers = lawyers.filter((l) => l.verificationStatus === "pending");
  const pendingNGOs = ngos.filter((n) => (n.verificationStatus || n.status) === "pending");
  const openDisputes = disputes.filter((x) => ["open", "under_review"].includes(x.status));
  const activeCases = cases.filter((x) => ["assigned", "in_progress", "under_review"].includes(x.status));
  const resolvedCases = cases.filter((x) => ["resolved", "closed"].includes(x.status));

  // ── Needs attention: everything waiting, oldest first ──
  const queue = useMemo(
    () =>
      [
        ...pendingLawyers.map((x) => ({ id: x._id, icon: Scale, title: x.name, sub: `Advocate application · ${(x.specialization || []).slice(0, 2).join(", ") || "General"}`, at: x.createdAt, action: "Review", to: `/admin/lawyers?open=${x._id}` })),
        ...pendingNGOs.map((x) => ({ id: x._id, icon: Building2, title: x.name, sub: `NGO accreditation · ${x.city || "Pakistan"}`, at: x.createdAt, action: "Review", to: `/admin/ngos?open=${x._id}` })),
        ...openDisputes.map((x) => ({ id: x._id, icon: ShieldAlert, title: x.caseId?.title || "Case dispute", sub: `Dispute · ${x.category || "General"} · ${x.userId?.name || "Citizen"}`, at: x.createdAt, action: "Investigate", to: "/admin/disputes" })),
        ...reviews.map((x) => ({ id: x._id, icon: Star, title: `${x.rating || "–"}★ review flagged`, sub: x.flagReason || "Reported by a user", at: x.flaggedAt || x.createdAt, action: "Moderate", to: "/admin/reviews" })),
      ].sort((a, b) => new Date(a.at) - new Date(b.at)),
    [pendingLawyers, pendingNGOs, openDisputes, reviews]
  );
  const lateCount = queue.filter((q) => daysSince(q.at) > LATE_AFTER_DAYS).length;

  // ── Growth: new citizens, advocates and cases per month (last 8 months) ──
  const growth = useMemo(() => {
    const months = [];
    const now = new Date();
    for (let i = 7; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      months.push({ y: d.getFullYear(), m: d.getMonth(), label: d.toLocaleString("en-US", { month: "short" }), citizens: 0, advocates: 0, cases: 0 });
    }
    const bump = (list, key) =>
      list.forEach((x) => {
        const d = new Date(x.createdAt);
        const slot = months.find((m) => m.y === d.getFullYear() && m.m === d.getMonth());
        if (slot) slot[key] += 1;
      });
    bump(users, "citizens");
    bump(lawyers, "advocates");
    bump(cases, "cases");
    return months;
  }, [users, lawyers, cases]);

  const statusData = STATUS_GROUPS.map((g) => ({ ...g, value: cases.filter((c) => g.match.includes(c.status)).length })).filter((g) => g.value > 0);

  const categories = useMemo(() => {
    const m = {};
    cases.forEach((c) => {
      const k = c.category || "Other";
      m[k] = (m[k] || 0) + 1;
    });
    return Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 6);
  }, [cases]);
  const maxCat = Math.max(1, ...categories.map((c) => c[1]));

  const kpis = [
    { label: "Citizens", value: users.length || stats.totalUsers || 0, delta: `+${users.filter((x) => in30(x.createdAt)).length} in 30 days`, up: true, to: "/admin/users" },
    { label: "Verified advocates", value: lawyers.filter((l) => l.verificationStatus === "approved").length, delta: pendingLawyers.length ? `${pendingLawyers.length} waiting for review` : "None waiting", warn: pendingLawyers.length > 0, to: "/admin/lawyers" },
    { label: "Accredited NGOs", value: ngos.filter((n) => (n.verificationStatus || n.status) === "approved").length, delta: pendingNGOs.length ? `${pendingNGOs.length} waiting for review` : "None waiting", warn: pendingNGOs.length > 0, to: "/admin/ngos" },
    { label: "Active cases", value: activeCases.length, delta: `+${cases.filter((x) => in30(x.createdAt)).length} filed in 30 days`, up: true, to: "/admin/cases" },
    { label: "Resolution rate", value: cases.length ? `${Math.round((resolvedCases.length / cases.length) * 100)}%` : "—", delta: `${resolvedCases.length} of ${cases.length} cases resolved`, to: "/admin/cases" },
  ];

  const exportSummary = () => {
    downloadCSV(`legallink-summary-${new Date().toISOString().slice(0, 10)}.csv`, ["Metric", "Value", "Note"], [
      ...kpis.map((k) => [k.label, k.value, k.delta]),
      ["Open disputes", openDisputes.length, ""],
      ["Flagged reviews", reviews.length, ""],
      ...growth.map((g) => [`New in ${g.label} ${g.y}`, `${g.citizens} citizens, ${g.advocates} advocates, ${g.cases} cases`, ""]),
      ...categories.map(([k, v]) => [`Cases: ${k}`, v, ""]),
    ]);
  };

  const hour = new Date().getHours();
  const greet = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  return (
    <AdminLayout breadcrumb="Dashboard" activeNav="dashboard">
      <div className="ax-head">
        <div>
          <h1>Dashboard</h1>
          <p>
            {greet}, {user?.name?.split(" ")[0] || "admin"}.{" "}
            {queue.length ? `${queue.length} item${queue.length === 1 ? "" : "s"} need${queue.length === 1 ? "s" : ""} attention${lateCount ? `, ${lateCount} waiting more than ${LATE_AFTER_DAYS} days` : ""}.` : "Nothing is waiting for you."}
          </p>
        </div>
        <div className="ax-head-actions">
          <button type="button" className="ax-btn" onClick={exportSummary}>
            <Download size={15} /> Export summary
          </button>
          <button type="button" className="ax-btn" onClick={load} disabled={loading} aria-busy={loading}>
            <RefreshCw size={15} className={loading ? "ax-spin" : ""} /> Refresh
          </button>
        </div>
      </div>

      {/* KPI strip */}
      <section className="ax-panel ax-kpis" aria-label="Key figures">
        {kpis.map((k) => (
          <button key={k.label} type="button" className="ax-kpi" onClick={() => navigate(k.to)}>
            <span className="ax-kpi-label">{k.label}</span>
            <span className="ax-kpi-value">{loading ? <span className="sk" style={{ width: 60, height: 26 }} /> : k.value}</span>
            <span className={`ax-kpi-delta${k.warn ? " is-warn" : k.up ? " is-up" : ""}`}>
              {k.up && <ArrowUpRight size={13} />}
              {k.delta}
            </span>
          </button>
        ))}
      </section>

      <div className="ax-grid-2">
        {/* Needs attention */}
        <section className="ax-panel">
          <div className="ax-panel-head">
            <h2>Needs attention</h2>
            <span>Oldest first</span>
          </div>
          {loading ? (
            <div className="ax-panel-body">
              {[0, 1, 2].map((i) => (
                <span key={i} className="sk sk-line" style={{ width: `${80 - i * 15}%`, marginBottom: 14 }} />
              ))}
            </div>
          ) : queue.length === 0 ? (
            <div className="ax-empty">
              <CheckCircle2 size={22} />
              Every application, dispute and report has been handled.
            </div>
          ) : (
            <ul className="ax-queue">
              {queue.slice(0, 8).map((q) => {
                const Icon = q.icon;
                const late = daysSince(q.at) > LATE_AFTER_DAYS;
                return (
                  <li key={q.id}>
                    <span className={`ax-queue-icon${late ? " is-bad" : " is-warn"}`}>
                      <Icon size={16} />
                    </span>
                    <span className="ax-queue-text">
                      <strong>{q.title}</strong>
                      <span>{q.sub}</span>
                    </span>
                    <span className={`ax-age${late ? " is-late" : ""}`} title="Waiting for">
                      {waitingLabel(q.at)}
                    </span>
                    <button type="button" className="ax-btn is-sm" onClick={() => navigate(q.to)}>
                      {q.action}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {queue.length > 8 && (
            <div className="ax-pager" style={{ justifyContent: "flex-start" }}>
              {queue.length - 8} more in the Advocates, NGOs, Disputes and Flagged reviews pages
            </div>
          )}
        </section>

        {/* Recent admin activity */}
        <section className="ax-panel">
          <div className="ax-panel-head">
            <h2>Recent admin activity</h2>
            <button type="button" className="ax-btn is-sm is-ghost" onClick={() => navigate("/admin/audit-log")}>
              Audit log
            </button>
          </div>
          {logs.length === 0 ? (
            <div className="ax-empty">No admin actions recorded yet.</div>
          ) : (
            <ul className="ax-feed">
              {logs.slice(0, 6).map((l) => (
                <li key={l._id}>
                  <strong style={{ color: "var(--ax-text)" }}>{l.adminEmail && l.adminEmail !== "unknown" ? l.adminEmail.split("@")[0] : "An admin"}</strong>{" "}
                  {auditText(l.action)} <strong style={{ color: "var(--ax-text)" }}>{l.targetName}</strong>
                  <time>{new Date(l.createdAt).toLocaleString("en-PK", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}</time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <div className="ax-grid-3">
        {/* Growth */}
        <section className="ax-panel">
          <div className="ax-panel-head">
            <h2>Growth</h2>
            <div className="ax-legend">
              <span><i style={{ background: "var(--ax-chart-1)" }} />Citizens</span>
              <span><i style={{ background: "var(--ax-chart-3)" }} />Advocates</span>
              <span><i style={{ background: "var(--ax-chart-2)" }} />Cases</span>
            </div>
          </div>
          <div className="ax-panel-body" style={{ height: 250 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={growth} margin={{ top: 6, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--ax-border)" vertical={false} />
                <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--ax-muted)" }} axisLine={false} tickLine={false} />
                <YAxis allowDecimals={false} tick={{ fontSize: 11, fill: "var(--ax-muted)" }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--ax-border)", background: "var(--ax-surface)", fontSize: 12.5 }} />
                <Area type="monotone" dataKey="citizens" name="Citizens" stroke="var(--ax-chart-1)" fill="var(--ax-chart-1)" fillOpacity={0.12} strokeWidth={2} />
                <Area type="monotone" dataKey="advocates" name="Advocates" stroke="var(--ax-chart-3)" fill="var(--ax-chart-3)" fillOpacity={0.1} strokeWidth={2} />
                <Area type="monotone" dataKey="cases" name="Cases" stroke="var(--ax-chart-2)" fill="var(--ax-chart-2)" fillOpacity={0.12} strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Cases by status */}
        <section className="ax-panel">
          <div className="ax-panel-head">
            <h2>Cases by status</h2>
            <span>{cases.length} total</span>
          </div>
          <div className="ax-panel-body" style={{ display: "flex", alignItems: "center", gap: 16, height: 250 }}>
            {statusData.length === 0 ? (
              <div className="ax-empty" style={{ flex: 1 }}>No cases yet.</div>
            ) : (
              <>
                <div style={{ width: 150, height: 150, flexShrink: 0 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={statusData} dataKey="value" nameKey="label" innerRadius={46} outerRadius={70} paddingAngle={2} stroke="none">
                        {statusData.map((s) => (
                          <Cell key={s.key} fill={s.color} />
                        ))}
                      </Pie>
                      <Tooltip contentStyle={{ borderRadius: 8, border: "1px solid var(--ax-border)", background: "var(--ax-surface)", fontSize: 12.5 }} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <ul className="ax-bars" style={{ flex: 1 }}>
                  {statusData.map((s) => (
                    <li key={s.key} style={{ gridTemplateColumns: "1fr auto" }}>
                      <span><i style={{ display: "inline-block", width: 9, height: 9, borderRadius: 3, background: s.color, marginRight: 8 }} />{s.label}</span>
                      <b>{s.value}</b>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
        </section>

        {/* Cases by practice area */}
        <section className="ax-panel">
          <div className="ax-panel-head">
            <h2>Cases by practice area</h2>
          </div>
          <div className="ax-panel-body" style={{ height: 250 }}>
            {categories.length === 0 ? (
              <div className="ax-empty">No cases yet.</div>
            ) : (
              <ul className="ax-bars">
                {categories.map(([k, v]) => (
                  <li key={k}>
                    <span title={k}>{k}</span>
                    <span className="ax-bar-track"><span className="ax-bar-fill" style={{ width: `${(v / maxCat) * 100}%`, display: "block" }} /></span>
                    <b>{v}</b>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>
    </AdminLayout>
  );
};

export default Dashboard;
