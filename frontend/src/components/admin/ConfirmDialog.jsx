import React from "react";

/** Small confirmation dialog for destructive or important actions. */
const ConfirmDialog = ({ open, title, body, confirmLabel = "Confirm", danger = false, busy = false, onConfirm, onCancel, children }) => {
  if (!open) return null;
  return (
    <div className="ax-dialog" role="alertdialog" aria-modal="true" onClick={onCancel}>
      <div className="ax-dialog-box" onClick={(e) => e.stopPropagation()}>
        <h3>{title}</h3>
        {body && <p>{body}</p>}
        {children}
        <div className="ax-dialog-actions">
          <button type="button" className="ax-btn" onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={`ax-btn ${danger ? "is-danger-solid" : "is-primary"}`} onClick={onConfirm} disabled={busy} aria-busy={busy}>
            {busy && <span className="btn-spinner" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ConfirmDialog;
