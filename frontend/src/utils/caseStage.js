// One place that decides a case's stage, status label and hearing status.
// Every page (case file, dashboards, case lists) reads from here, so the
// stage shown always matches the status shown.

export const CASE_STAGES = [
  { step: 1, title: "Intake & review", short: "Intake" },
  { step: 2, title: "Counsel appointed", short: "Counsel appointed" },
  { step: 3, title: "Court proceedings", short: "In court" },
  { step: 4, title: "Resolved", short: "Resolved" }
];

const STATUS_STEP = {
  pending: 1,
  under_review: 1,
  rejected: 1,
  assigned: 2,
  active: 2,
  in_progress: 3,
  "in progress": 3,
  resolved: 4,
  closed: 4
};

export const STATUS_LABELS = {
  pending: "Pending",
  under_review: "Under review",
  assigned: "Assigned",
  active: "Assigned",
  in_progress: "In progress",
  "in progress": "In progress",
  resolved: "Resolved",
  closed: "Closed",
  rejected: "Not accepted"
};

export const normStatus = (c) => String((c && c.status) || "pending").toLowerCase();

export const getStatusLabel = (statusOrCase) => {
  const s = typeof statusOrCase === "string" ? statusOrCase.toLowerCase() : normStatus(statusOrCase);
  return STATUS_LABELS[s] || s.replace(/_/g, " ").replace(/^\w/, (m) => m.toUpperCase());
};

// Stage follows the status only. A hearing on the calendar does not move the
// stage by itself; the backend moves "assigned" to "in_progress" when the
// first hearing is scheduled, so both stay in step.
export const getCaseStage = (c) => {
  const s = normStatus(c);
  const step = STATUS_STEP[s] || 1;
  const stage = CASE_STAGES[step - 1];
  return { ...stage, status: s, statusLabel: getStatusLabel(s), label: stage.short };
};

export const isClosedCase = (c) => ["resolved", "closed", "rejected"].includes(normStatus(c));
export const isActiveCase = (c) => !isClosedCase(c);

export const getHearings = (c) => (c && (c.hearings || c.hearingDates)) || [];

const HEARING_META = {
  scheduled: { label: "Scheduled", tone: "info" },
  awaiting: { label: "Awaiting outcome", tone: "warning" },
  completed: { label: "Completed", tone: "success" },
  concluded: { label: "Concluded", tone: "success" },
  adjourned: { label: "Adjourned", tone: "warning" },
  cancelled: { label: "Cancelled", tone: "neutral" }
};

// A "scheduled" hearing whose date has passed is shown as "Awaiting outcome",
// so the advocate is reminded to record what happened.
export const getHearingStatus = (h, now = new Date()) => {
  const raw = String((h && h.status) || "scheduled").toLowerCase();
  const isPast = h && h.date && new Date(h.date) < now;
  const key = raw === "scheduled" && isPast ? "awaiting" : HEARING_META[raw] ? raw : "scheduled";
  return { key, ...HEARING_META[key] };
};

export const isLiveHearing = (h) => {
  const s = String((h && h.status) || "scheduled").toLowerCase();
  return s !== "cancelled";
};

// Next upcoming hearing that is not cancelled
export const getNextHearing = (c, now = new Date()) =>
  getHearings(c)
    .filter((h) => h.date && isLiveHearing(h) && new Date(h.date) >= now)
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0] || null;

// Past hearings still marked "scheduled" (outcome not recorded)
export const getHearingsAwaitingOutcome = (c, now = new Date()) =>
  getHearings(c).filter((h) => getHearingStatus(h, now).key === "awaiting");

export const lastActivity = (c) => {
  const times = [c.updatedAt, c.createdAt]
    .concat((c.messages || []).map((m) => m.timestamp || m.createdAt))
    .filter(Boolean)
    .map((d) => new Date(d).getTime());
  return times.length ? Math.max(...times) : 0;
};

// ── Unread counts ──────────────────────────────────────────────
// Counts items added by someone else after this person last opened
// that section. "seenBy" markers come from POST /cases/:id/seen.
const myIdOf = (user) => String((user && (user._id || user.id)) || "");

export const getSeenMarker = (c, user) =>
  ((c && c.seenBy) || []).find((s) => String(s.userId) === myIdOf(user)) || {};

const newerThan = (date, marker) => !!date && (!marker || new Date(date) > new Date(marker));

export const getUnread = (c, user) => {
  if (!c || !user) return { messages: 0, documents: 0, hearings: 0, total: 0 };
  const me = myIdOf(user);
  const role = user.role;
  const mk = getSeenMarker(c, user);

  const messages = (c.messages || []).filter(
    (m) => String(m.senderId || "") !== me && newerThan(m.timestamp || m.createdAt, mk.messages)
  ).length;

  const documents = (c.documents || []).filter(
    (d) => (d.uploadedByType || "user") !== role && newerThan(d.uploadedAt, mk.documents)
  ).length;

  // Only the client is told about hearing changes; counsel make them.
  // Hearings saved before timestamps existed have no updatedAt and are not counted.
  const hearings =
    role === "user"
      ? getHearings(c).filter((h) => newerThan(h.updatedAt || h.createdAt, mk.hearings) && (h.updatedAt || h.createdAt)).length
      : 0;

  return { messages, documents, hearings, total: messages + documents + hearings };
};

// Return a copy of the case with this person's marker moved to "at"
export const withSeen = (c, user, section, at) => {
  if (!c) return c;
  const me = myIdOf(user);
  const list = [...(c.seenBy || [])];
  const i = list.findIndex((s) => String(s.userId) === me);
  if (i >= 0) list[i] = { ...list[i], [section]: at };
  else list.push({ userId: me, role: user && user.role, [section]: at });
  return { ...c, seenBy: list };
};
