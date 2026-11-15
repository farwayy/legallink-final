import React, { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Gavel,
  MessageSquare,
  Inbox,
  Building2,
  CalendarPlus,
  ClipboardCheck,
  CheckCircle2,
  ArrowRight,
  Users
} from "lucide-react";
import {
  isActiveCase,
  getHearings,
  getHearingStatus,
  getNextHearing,
  normStatus
} from "../../utils/caseStage";

// One list of what needs the advocate's attention now, most urgent first.
// Built only from data the dashboard already has: cases, inquiries, invites.
const DAY = 86400000;

const dayWord = (days) => (days <= 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${days} days`);

// audience: "counsel" (advocate portal) or "ngo" (legal aid portal)
const TodayPriorities = ({ cases = [], pendingRequests = [], pendingInvites = [], onOpenTab, limit = 6, audience = "counsel" }) => {
  const isNgo = audience === "ngo";
  const navigate = useNavigate();

  const items = useMemo(() => {
    const out = [];
    const now = new Date();
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const active = cases.filter(isActiveCase);

    active.forEach((c) => {
      const client = c.userId?.name || "Client";

      // 1. Hearings within the next 7 days
      getHearings(c).forEach((h) => {
        if (!h.date || getHearingStatus(h, now).key !== "scheduled") return;
        const days = Math.round((new Date(h.date).setHours(0, 0, 0, 0) - today) / DAY);
        if (days < 0 || days > 7) return;
        out.push({
          id: `h-${c._id}-${h._id || h.date}`,
          rank: days <= 1 ? 0 : 3,
          tone: days <= 1 ? "urgent" : "soon",
          icon: Gavel,
          title: `${dayWord(days)}: hearing for ${c.title}`,
          meta: `${new Date(h.date).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })} · ${h.notes || client}`,
          action: "Open case",
          onClick: () => navigate(`/case/${c._id}`)
        });
      });

      // 2. Past hearings with no outcome recorded
      const awaiting = getHearings(c).filter((h) => getHearingStatus(h, now).key === "awaiting");
      if (awaiting.length) {
        const last = awaiting.sort((a, b) => new Date(b.date) - new Date(a.date))[0];
        out.push({
          id: `o-${c._id}`,
          rank: 1,
          tone: "urgent",
          icon: ClipboardCheck,
          title: `Record the outcome: ${c.title}`,
          meta: `Hearing on ${new Date(last.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })} has no outcome yet`,
          action: "Record",
          onClick: () => navigate(`/case/${c._id}`)
        });
      }

      // 3. Client wrote last and is waiting for a reply
      const msgs = c.messages || [];
      const lastMsg = msgs[msgs.length - 1];
      if (lastMsg && lastMsg.senderType === "user") {
        const when = new Date(lastMsg.timestamp || lastMsg.createdAt || c.updatedAt);
        const days = Math.max(0, Math.round((today - new Date(when).setHours(0, 0, 0, 0)) / DAY));
        out.push({
          id: `m-${c._id}`,
          rank: 2,
          tone: days >= 2 ? "urgent" : "soon",
          icon: MessageSquare,
          title: `${client} is waiting for your reply`,
          meta: `${c.title} · ${days === 0 ? "today" : days === 1 ? "yesterday" : `${days} days ago`}`,
          action: "Reply",
          onClick: () => navigate(`/case/${c._id}`)
        });
      }

      // NGO: an accepted case that still has no advocate
      if (isNgo && normStatus(c) === "pending" && !c.lawyerId) {
        out.push({
          id: `a-${c._id}`,
          rank: 1,
          tone: "urgent",
          icon: Users,
          title: `Assign an advocate: ${c.title}`,
          meta: `${client} · accepted, waiting for counsel`,
          action: "Assign",
          onClick: () => onOpenTab && onOpenTab("pending")
        });
      }

      // 4. Accepted case with nothing on the calendar
      if (normStatus(c) === "assigned" && !getNextHearing(c, now) && !awaiting.length) {
        out.push({
          id: `n-${c._id}`,
          rank: 5,
          tone: "normal",
          icon: CalendarPlus,
          title: `No hearing scheduled: ${c.title}`,
          meta: `${client} · add the first hearing or a next step`,
          action: "Schedule",
          onClick: () => navigate(`/case/${c._id}`)
        });
      }
    });

    // 5. Client inquiries
    if (pendingRequests.length) {
      out.push({
        id: "inquiries",
        rank: 2,
        tone: "soon",
        icon: Inbox,
        title: isNgo
          ? `${pendingRequests.length} aid ${pendingRequests.length === 1 ? "request needs" : "requests need"} a decision`
          : `${pendingRequests.length} client ${pendingRequests.length === 1 ? "inquiry needs" : "inquiries need"} an answer`,
        meta: isNgo ? "Accept and assign an advocate, or decline with a reason" : "Accept or decline so the citizen can move on",
        action: "Review",
        onClick: () => onOpenTab && onOpenTab("requests")
      });
    }

    // 6. NGO panel invitations
    if (pendingInvites.length) {
      out.push({
        id: "invites",
        rank: 4,
        tone: "normal",
        icon: Building2,
        title: `${pendingInvites.length} NGO panel ${pendingInvites.length === 1 ? "invitation" : "invitations"}`,
        meta: "Pro bono cases waiting for counsel",
        action: "View",
        onClick: () => onOpenTab && onOpenTab("invitations")
      });
    }

    return out.sort((a, b) => a.rank - b.rank);
  }, [cases, pendingRequests, pendingInvites, navigate, onOpenTab, isNgo]);

  const shown = items.slice(0, limit);
  const urgent = items.filter((i) => i.tone === "urgent").length;

  return (
    <section className="cp-card tp-card" aria-label="Today's priorities">
      <div className="tp-head">
        <div>
          <h2 className="cp-section-title">Today's priorities</h2>
          <span className="cp-section-sub">
            {items.length === 0
              ? "Nothing needs you right now"
              : `${items.length} ${items.length === 1 ? "item" : "items"}${urgent ? ` · ${urgent} urgent` : ""}`}
          </span>
        </div>
      </div>

      {items.length === 0 ? (
        <div className="tp-clear">
          <CheckCircle2 size={20} />
          <span>
            {isNgo
              ? "You're all caught up. New aid requests, messages and hearings will show up here."
              : "You're all caught up. New inquiries, messages and hearings will show up here."}
          </span>
        </div>
      ) : (
        <ul className="tp-list">
          {shown.map((it, i) => {
            const Icon = it.icon;
            return (
              <li key={it.id} className={`tp-item tone-${it.tone}${i === 0 ? " is-first" : ""}`}>
                <span className="tp-icon"><Icon size={17} strokeWidth={2} /></span>
                <div className="tp-text">
                  <strong>{it.title}</strong>
                  <span>{it.meta}</span>
                </div>
                <button type="button" className="tp-action" onClick={it.onClick}>
                  {it.action} <ArrowRight size={14} />
                </button>
              </li>
            );
          })}
        </ul>
      )}
      {items.length > shown.length && (
        <div className="tp-more">+ {items.length - shown.length} more in your case list</div>
      )}
    </section>
  );
};

export default TodayPriorities;
