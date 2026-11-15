import React, { useMemo } from "react";
import { FilePlus2, CreditCard, RefreshCw, UserCheck, UserMinus, Calendar, Gavel, FileText, MessageSquare } from "lucide-react";
import { STATUS_LABELS } from "../../utils/caseStage";

/**
 * Everything that happened on a case, newest first, grouped by day.
 * Built from the case record: filing, payment, status changes, advocates
 * assigned or removed, hearings, documents and messages.
 */

const nameOf = (p, fallback) => (p && typeof p === "object" && p.name ? p.name : fallback);
const ts = (d) => (d ? new Date(d).getTime() : 0);
const fmtDay = (d) => {
  const day = new Date(d);
  const today = new Date();
  const yest = new Date();
  yest.setDate(today.getDate() - 1);
  if (day.toDateString() === today.toDateString()) return "Today";
  if (day.toDateString() === yest.toDateString()) return "Yesterday";
  return day.toLocaleDateString("en-PK", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
};
const fmtTime = (d) => new Date(d).toLocaleTimeString("en-PK", { hour: "numeric", minute: "2-digit" });
const fmtDate = (d) => new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });
const label = (s) => STATUS_LABELS[String(s || "").toLowerCase()] || s;

export const buildTimeline = (c) => {
  if (!c) return [];
  const events = [];
  const client = nameOf(c.userId, "The client");
  const counsel = nameOf(c.lawyerId, "the advocate");
  const created = c.createdAt;
  const paidCase = c.caseType === "paid" && c.paymentStatus === "completed";

  // Filed / paid
  if (paidCase) {
    events.push({
      at: created,
      kind: "paid",
      icon: CreditCard,
      title: `Paid${c.packageType ? ` for the ${c.packageType.charAt(0).toUpperCase()}${c.packageType.slice(1)} package` : ""} and case opened`,
      text: `${client} paid and ${counsel} was assigned.`,
    });
  } else {
    events.push({ at: created, kind: "filed", icon: FilePlus2, title: "Case filed", text: `${client} opened this case${c.caseType === "pro_bono" ? " for free legal aid" : ""}.` });
  }

  // Status changes (skip the first entry if it's just the starting status)
  (c.statusHistory || []).forEach((h, i) => {
    if (i === 0 && Math.abs(ts(h.at) - ts(created)) < 60 * 1000) return;
    events.push({ at: h.at, kind: "status", icon: RefreshCw, title: `Status changed to ${label(h.status)}`, status: h.status });
  });

  // Advocates assigned or removed (NGO panel)
  (c.assignments || []).forEach((a) => {
    const who = nameOf(a.lawyerId, "An advocate");
    if (a.assignedAt) events.push({ at: a.assignedAt, kind: "assigned", icon: UserCheck, title: `${who} assigned`, text: a.reason || "" });
    if (a.unassignedAt) events.push({ at: a.unassignedAt, kind: "removed", icon: UserMinus, title: `${who} no longer on the case`, text: a.reason || "" });
  });

  // Hearings
  (c.hearingDates || c.hearings || []).forEach((h) => {
    if (!h || !h.date) return;
    events.push({
      at: h.createdAt || h.date,
      kind: "hearing",
      icon: Calendar,
      title: `Hearing scheduled for ${fmtDate(h.date)}`,
      text: [h.court, h.notes].filter(Boolean).join(" · "),
    });
    const held = ["completed", "concluded"].includes(h.status) || (h.outcome && ts(h.date) < Date.now());
    if (held) {
      events.push({ at: h.updatedAt && ts(h.updatedAt) > ts(h.date) ? h.updatedAt : h.date, kind: "outcome", icon: Gavel, title: "Hearing held", text: h.outcome || "" });
    } else if (h.status === "adjourned") {
      events.push({ at: h.updatedAt || h.date, kind: "outcome", icon: Gavel, title: "Hearing adjourned", text: h.outcome || h.notes || "" });
    }
  });

  // Documents
  (c.documents || []).forEach((d) => {
    events.push({ at: d.uploadedAt || created, kind: "document", icon: FileText, title: `${d.uploadedBy || "Someone"} added a document`, text: d.name || "Document" });
  });

  // Messages: one entry per day so the list stays readable
  const byDay = {};
  (c.messages || []).forEach((m) => {
    const key = new Date(m.timestamp || created).toDateString();
    (byDay[key] = byDay[key] || []).push(m);
  });
  Object.values(byDay).forEach((list) => {
    const last = list.reduce((a, b) => (ts(b.timestamp) > ts(a.timestamp) ? b : a));
    const who = [...new Set(list.map((m) => m.senderRoleLabel || ({ user: "Client", lawyer: "Advocate", ngo: "NGO", admin: "Admin" }[m.senderType] || "Someone")))];
    events.push({
      at: last.timestamp,
      kind: "message",
      icon: MessageSquare,
      title: `${list.length} message${list.length === 1 ? "" : "s"}`,
      text: `From ${who.join(" and ")}`,
    });
  });

  return events.filter((e) => e.at).sort((a, b) => ts(b.at) - ts(a.at));
};

const CaseTimeline = ({ caseData, onOpenMessages }) => {
  const events = useMemo(() => buildTimeline(caseData), [caseData]);

  const groups = useMemo(() => {
    const out = [];
    events.forEach((e) => {
      const day = fmtDay(e.at);
      if (!out.length || out[out.length - 1].day !== day) out.push({ day, items: [] });
      out[out.length - 1].items.push(e);
    });
    return out;
  }, [events]);

  if (!events.length) return <p className="tl-empty">Nothing has happened on this case yet.</p>;

  return (
    <div className="tl">
      {groups.map((g) => (
        <section key={g.day} className="tl-day">
          <h4 className="tl-day-title">{g.day}</h4>
          <ol className="tl-list">
            {g.items.map((e, i) => (
              <li key={`${e.kind}-${i}-${ts(e.at)}`} className={`tl-item is-${e.kind}`}>
                <span className="tl-dot" aria-hidden="true">
                  <e.icon size={14} />
                </span>
                <div className="tl-body">
                  <div className="tl-row">
                    <strong>{e.title}</strong>
                    <time dateTime={new Date(e.at).toISOString()}>{fmtTime(e.at)}</time>
                  </div>
                  {e.text && <p>{e.text}</p>}
                  {e.kind === "message" && onOpenMessages && (
                    <button type="button" className="tl-link" onClick={onOpenMessages}>Open messages</button>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </section>
      ))}
    </div>
  );
};

export default CaseTimeline;
