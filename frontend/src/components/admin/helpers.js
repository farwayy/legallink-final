// Small helpers shared by admin pages
import { API_ORIGIN } from "../../config";
export const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "—");

export const daysSince = (d) => (d ? Math.floor((Date.now() - new Date(d).getTime()) / 86400000) : 0);

export const waitingLabel = (d) => {
  const n = daysSince(d);
  return n <= 0 ? "Today" : n === 1 ? "1 day" : `${n} days`;
};

export const initials = (name = "") =>
  name.replace(/^adv\.?\s*/i, "").split(" ").filter(Boolean).slice(0, 2).map((p) => p[0].toUpperCase()).join("") || "?";

// Uploaded files may be stored as Cloudinary URLs or local paths
export const fileUrl = (p) => {
  if (!p) return "";
  let s = String(p).replace(/\\/g, "/").trim();
  if (/^https?:\/\//.test(s)) return s;
  s = s.replace(/^\/+/, "");
  if (!s.startsWith("uploads/")) s = `uploads/${s}`;
  return `${API_ORIGIN}/${s}`;
};

export const isPdf = (url) => /\.pdf($|\?)/i.test(url || "") || /\/raw\/(upload|authenticated)\//.test(url || "");
export const isImage = (url) => /\.(png|jpe?g|webp|gif)($|\?)/i.test(url || "") || /\/image\/(upload|authenticated)\//.test(url || "");

export const STATUS_TONE = {
  approved: "is-ok",
  active: "is-ok",
  resolved: "is-ok",
  pending: "is-warn",
  open: "is-warn",
  under_review: "is-info",
  in_progress: "is-info",
  assigned: "is-info",
  rejected: "is-bad",
  blocked: "is-bad",
  dismissed: "is-bad",
  closed: "",
};

export const statusText = (s) =>
  ({
    approved: "Approved",
    pending: "Pending",
    rejected: "Rejected",
    under_review: "Under review",
    in_progress: "In progress",
    assigned: "Assigned",
    resolved: "Resolved",
    closed: "Closed",
    open: "Open",
    dismissed: "Dismissed",
    active: "Active",
    blocked: "Blocked",
  }[s] || (s ? s.replace(/_/g, " ") : "—"));
