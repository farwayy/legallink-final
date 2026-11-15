import React, { useEffect, useRef } from "react";
import { X } from "lucide-react";

/** Panel that slides in from the right. Esc or the backdrop closes it. */
const SidePanel = ({ open, onClose, title, subtitle, children, footer, wide = false, headExtra = null }) => {
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setTimeout(() => ref.current?.focus(), 30);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className="ax-scrim" onClick={onClose} />
      <aside className={`ax-sheet${wide ? " is-wide" : ""}`} role="dialog" aria-modal="true" aria-label={typeof title === "string" ? title : "Details"} tabIndex={-1} ref={ref}>
        <div className="ax-sheet-head">
          <div style={{ flex: 1, minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <p>{subtitle}</p>}
          </div>
          {headExtra}
          <button type="button" className="ax-icon-btn" onClick={onClose} aria-label="Close">
            <X size={17} />
          </button>
        </div>
        <div className="ax-sheet-body">{children}</div>
        {footer && <div className="ax-sheet-foot">{footer}</div>}
      </aside>
    </>
  );
};

export default SidePanel;
