import React, { useCallback, useEffect, useState } from "react";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from "lucide-react";
import "../styles/toast.css";

/**
 * Small messages in the corner of the screen, used across LegalLink instead
 * of the browser's "localhost says…" pop-ups.
 *
 *   import { notify } from "../components/Toast";
 *   notify("Inquiry accepted.", "success");   // "success" | "error" | "warning" | "info"
 *
 * Real-time updates (RealTimeContext) use the same "show-toast" event.
 */
export const notify = (message, type = "success") => {
  if (!message) return;
  window.dispatchEvent(new CustomEvent("show-toast", { detail: { message, type: String(type || "info").toLowerCase() } }));
};

const ICONS = { success: CheckCircle2, error: AlertCircle, warning: AlertTriangle, info: Info };
const SHOW_FOR = { success: 4500, info: 5000, warning: 6500, error: 7000 };
let seq = 0;

export const ToastContainer = () => {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => setToasts((list) => list.filter((t) => t.id !== id)), []);

  useEffect(() => {
    const onShow = (event) => {
      const { message, type = "info" } = event.detail || {};
      if (!message) return;
      const kind = ICONS[type] ? type : "info";
      const id = ++seq;
      // Keep at most 3 on screen, newest at the bottom
      setToasts((list) => [...list.filter((t) => t.message !== message).slice(-2), { id, message, type: kind }]);
      setTimeout(() => dismiss(id), SHOW_FOR[kind]);
    };
    window.addEventListener("show-toast", onShow);
    return () => window.removeEventListener("show-toast", onShow);
  }, [dismiss]);

  if (toasts.length === 0) return null;

  return (
    <div className="ll-toasts" aria-live="polite">
      {toasts.map((t) => {
        const Icon = ICONS[t.type];
        return (
          <div key={t.id} className={`ll-toast is-${t.type}`} role={t.type === "error" ? "alert" : "status"}>
            <Icon size={18} className="ll-toast-icon" aria-hidden="true" />
            <span className="ll-toast-text">{t.message}</span>
            <button type="button" className="ll-toast-x" onClick={() => dismiss(t.id)} aria-label="Dismiss">
              <X size={15} />
            </button>
          </div>
        );
      })}
    </div>
  );
};

export default ToastContainer;
