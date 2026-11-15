import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Info, AlertTriangle, CheckCircle2, X } from "lucide-react";
import { announcementAPI } from "../../services/api";
import "../../styles/announcement.css";

const ICONS = { info: Info, warning: AlertTriangle, success: CheckCircle2 };
const DISMISS_KEY = "ll_dismissed_announcements";

const readDismissed = () => {
  try {
    return JSON.parse(localStorage.getItem(DISMISS_KEY) || "[]");
  } catch (e) {
    return [];
  }
};

// One banner. Also used by the admin console for the live preview.
export const AnnouncementItem = ({ a, onClose, preview = false }) => {
  const Icon = ICONS[a.tone] || Info;
  const internal = a.linkUrl && a.linkUrl.startsWith("/");
  return (
    <div className={`an-banner is-${a.tone || "info"}${preview ? " is-preview" : ""}`} role="status">
      <div className="an-banner-inner">
        <Icon size={18} className="an-icon" aria-hidden="true" />
        <div className="an-body">
          <strong>{a.title || "Title"}</strong>
          {a.message}
          {a.linkUrl &&
            (internal ? (
              <Link to={a.linkUrl}>{a.linkText || "Learn more"}</Link>
            ) : (
              <a href={a.linkUrl} target="_blank" rel="noopener noreferrer">{a.linkText || "Learn more"}</a>
            ))}
        </div>
        {onClose && (
          <button type="button" className="an-close" onClick={onClose} aria-label="Dismiss announcement">
            <X size={16} />
          </button>
        )}
      </div>
    </div>
  );
};

/**
 * Shows active announcements from the LegalLink team.
 * audience: "user" (citizens) | "lawyer" | "ngo"
 * A dismissed banner stays hidden until the admin edits it.
 */
const AnnouncementBanner = ({ audience }) => {
  const [items, setItems] = useState([]);
  const [dismissed, setDismissed] = useState(readDismissed);

  useEffect(() => {
    let alive = true;
    announcementAPI
      .getActive(audience)
      .then((res) => alive && setItems(res.data.announcements || []))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [audience]);

  const keyOf = (a) => `${a._id}:${a.updatedAt || ""}`;
  const dismiss = (a) => {
    const next = [...dismissed.filter((k) => !k.startsWith(`${a._id}:`)), keyOf(a)].slice(-30);
    setDismissed(next);
    try {
      localStorage.setItem(DISMISS_KEY, JSON.stringify(next));
    } catch (e) {
      /* ignore */
    }
  };

  const visible = items.filter((a) => !dismissed.includes(keyOf(a)));
  if (visible.length === 0) return null;

  return (
    <div className="an-stack">
      {visible.map((a) => (
        <AnnouncementItem key={a._id} a={a} onClose={() => dismiss(a)} />
      ))}
    </div>
  );
};

export default AnnouncementBanner;
