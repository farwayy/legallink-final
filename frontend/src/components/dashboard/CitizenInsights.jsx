import React, { useMemo } from "react";
import { Link } from "react-router-dom";
import { isActiveCase, getHearings, isLiveHearing } from "../../utils/caseStage";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import { Activity, PieChart as PieIcon, CalendarDays, ArrowRight } from "lucide-react";
import { useTheme } from "../../contexts/ThemeContext";

/** Status groups shown in the donut, with brand colours */
const STATUS_GROUPS = [
  { key: "waiting", label: "Waiting", statuses: ["pending", "under_review"], color: "#D4AF37" },
  { key: "active", label: "Active", statuses: ["assigned", "in_progress"], color: "#3E705A" },
  { key: "resolved", label: "Resolved", statuses: ["resolved"], color: "#8FBFA6" },
  { key: "closed", label: "Rejected", statuses: ["rejected", "closed"], color: "#B9A88A" },
];

const ChartTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="ci-tooltip">
      {label && <strong>{label}</strong>}
      {payload.map((p) => (
        <span key={p.dataKey || p.name}>
          <i style={{ background: p.color || p.payload?.color }} /> {p.name}: <b>{p.value}</b>
        </span>
      ))}
    </div>
  );
};

/**
 * Three insight cards (used on the citizen and the advocate dashboards):
 * cases filed per month, cases by status, and upcoming hearings.
 */
const CitizenInsights = ({ cases = [], audience = "citizen" }) => {
  const isCounsel = audience === "counsel";
  const { isDark } = useTheme();
  const axis = isDark ? "#8FA39A" : "#66756D";
  const grid = isDark ? "#1C2E26" : "#E7ECE8";

  // Last 6 months, private vs pro bono
  const monthly = useMemo(() => {
    const now = new Date();
    const rows = [];
    for (let i = 5; i >= 0; i -= 1) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      rows.push({ key: `${d.getFullYear()}-${d.getMonth()}`, month: d.toLocaleDateString("en-US", { month: "short" }), Private: 0, "Pro bono": 0 });
    }
    cases.forEach((c) => {
      const d = new Date(c.createdAt);
      const row = rows.find((r) => r.key === `${d.getFullYear()}-${d.getMonth()}`);
      if (row) row[c.ngoId || c.isProBono ? "Pro bono" : "Private"] += 1;
    });
    return rows;
  }, [cases]);

  const byStatus = useMemo(
    () =>
      STATUS_GROUPS.map((g) => ({
        name: g.label,
        value: cases.filter((c) => g.statuses.includes(c.status)).length,
        color: g.color,
      })).filter((g) => g.value > 0),
    [cases]
  );

  const hearings = useMemo(() => {
    const now = new Date();
    const list = [];
    cases.filter(isActiveCase).forEach((c) =>
      getHearings(c).forEach((h) => {
        const d = new Date(h.date);
        if (!isNaN(d) && isLiveHearing(h) && d >= now) {
          list.push({ date: d, title: c.title, court: h.court || h.location || h.notes || "", caseId: c._id });
        }
      })
    );
    return list.sort((a, b) => a.date - b.date).slice(0, 4);
  }, [cases]);

  const total = cases.length;
  const filedThisPeriod = monthly.reduce((n, r) => n + r.Private + r["Pro bono"], 0);

  return (
    <section className="ci-grid" aria-label="Your case insights">
      {/* Activity */}
      <article className="cp-card ci-card ci-wide">
        <header className="ci-head">
          <span className="cp-icon-tile"><Activity size={18} strokeWidth={1.8} /></span>
          <div>
            <h2>{isCounsel ? "Caseload" : "Case activity"}</h2>
            <p>
              {filedThisPeriod} {filedThisPeriod === 1 ? (isCounsel ? "matter" : "case") : (isCounsel ? "matters" : "cases")}{" "}
              {isCounsel ? "received" : "filed"} in the last 6 months
            </p>
          </div>
          <div className="ci-legend" aria-hidden="true">
            <span><i style={{ background: "#3E705A" }} /> {isCounsel ? "Retainer" : "Private"}</span>
            <span><i style={{ background: "#D4AF37" }} /> {isCounsel ? "NGO panel" : "Pro bono"}</span>
          </div>
        </header>
        <div className="ci-chart">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={monthly} margin={{ top: 8, right: 8, left: -24, bottom: 0 }} barCategoryGap="32%">
              <CartesianGrid vertical={false} stroke={grid} strokeDasharray="3 4" />
              <XAxis dataKey="month" tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12 }} />
              <YAxis allowDecimals={false} tickLine={false} axisLine={false} tick={{ fill: axis, fontSize: 12 }} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: isDark ? "rgba(255,255,255,0.04)" : "rgba(31,69,53,0.05)" }} />
              <Bar dataKey="Private" stackId="a" fill="#3E705A" radius={[0, 0, 4, 4]} />
              <Bar dataKey="Pro bono" stackId="a" fill="#D4AF37" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      {/* Status */}
      <article className="cp-card ci-card">
        <header className="ci-head">
          <span className="cp-icon-tile"><PieIcon size={18} strokeWidth={1.8} /></span>
          <div>
            <h2>By status</h2>
            <p>{isCounsel ? "Where your matters stand" : "Where your cases stand"}</p>
          </div>
        </header>
        {total === 0 ? (
          <p className="ci-empty">No cases yet.</p>
        ) : (
          <div className="ci-donut">
            <div className="ci-donut-chart">
              <ResponsiveContainer width="100%" height={160}>
                <PieChart>
                  <Pie data={byStatus} dataKey="value" nameKey="name" innerRadius={50} outerRadius={72} paddingAngle={3} stroke="none">
                    {byStatus.map((s) => <Cell key={s.name} fill={s.color} />)}
                  </Pie>
                  <Tooltip content={<ChartTooltip />} />
                </PieChart>
              </ResponsiveContainer>
              <span className="ci-donut-total"><strong>{total}</strong><small>total</small></span>
            </div>
            <ul className="ci-status-list">
              {byStatus.map((s) => (
                <li key={s.name}>
                  <i style={{ background: s.color }} />
                  <span>{s.name}</span>
                  <b>{s.value}</b>
                </li>
              ))}
            </ul>
          </div>
        )}
      </article>

      {/* Hearings */}
      <article className="cp-card ci-card">
        <header className="ci-head">
          <span className="cp-icon-tile"><CalendarDays size={18} strokeWidth={1.8} /></span>
          <div>
            <h2>Upcoming hearings</h2>
            <p>{hearings.length ? "Next court dates" : "Nothing scheduled"}</p>
          </div>
        </header>
        {hearings.length === 0 ? (
          <p className="ci-empty">
            {isCounsel
              ? "No upcoming hearings. Add hearing dates from a case file and they will show up here."
              : "Your advocate adds hearing dates to your case file. They will show up here."}
          </p>
        ) : (
          <ul className="ci-hearings">
            {hearings.map((h, i) => (
              <li key={`${h.caseId}-${i}`}>
                <Link to={`/case/${h.caseId}`}>
                  <span className="ci-date">
                    <small>{h.date.toLocaleDateString("en-US", { month: "short" })}</small>
                    <strong>{h.date.getDate()}</strong>
                  </span>
                  <span className="ci-hearing-text">
                    <strong>{h.title}</strong>
                    <small>{h.date.toLocaleDateString("en-PK", { weekday: "long" })}{h.court ? ` · ${h.court}` : ""}</small>
                  </span>
                  <ArrowRight size={15} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </article>
    </section>
  );
};

export default CitizenInsights;
