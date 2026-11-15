import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Check, Trash2, Star, AlertTriangle } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import useAdminMe from "../../components/admin/useAdminMe";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { reviewAPI } from "../../services/api";
import { fmtDate } from "../../components/admin/helpers";

const targetName = (r) => r.lawyerId?.name || r.ngoId?.name || "—";
const Stars = ({ n = 0 }) => (
  <span style={{ display: "inline-flex", gap: 1, color: "#C9A24B" }} aria-label={`${n} out of 5`}>
    {[1, 2, 3, 4, 5].map((i) => (
      <Star key={i} size={13} fill={i <= n ? "currentColor" : "none"} strokeWidth={1.8} />
    ))}
  </span>
);

const ReviewsList = () => {
  const { can, loaded } = useAdminMe();
  const allowed = can("moderate");
  const [flagged, setFlagged] = useState([]);
  const [all, setAll] = useState([]);
  const [view, setView] = useState("flagged");
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState(null);
  const [toast, setToast] = useState(null);

  const notify = (msg, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [f, a] = await Promise.all([reviewAPI.getFlaggedReviews(), reviewAPI.getAllAdminReviews().catch(() => null)]);
      setFlagged(f.data.reviews || []);
      setAll(a?.data?.reviews || []);
    } catch (e) {
      notify("Could not load reviews. Check that the server is running.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const rows = view === "flagged" ? flagged : all;
  const open = rows.find((r) => r._id === openId) || null;

  const keep = async (list) => {
    setBusy(true);
    try {
      for (const r of list) await reviewAPI.dismissFlag(r._id);
      notify(list.length > 1 ? `${list.length} reviews kept.` : "Review kept and the report cleared.");
      setOpenId(null);
      load();
    } catch (e) {
      notify(e.response?.data?.message || "That didn't work. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (list) => {
    setBusy(true);
    try {
      for (const r of list) await reviewAPI.deleteReview(r._id);
      notify(list.length > 1 ? `${list.length} reviews removed.` : "Review removed.");
      setConfirm(null);
      setOpenId(null);
      load();
    } catch (e) {
      notify(e.response?.data?.message || "That didn't work. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const isTarget = (t) => (r) => r.targetType === t;
  const tabs = useMemo(
    () => [
      { key: "all", label: "All", count: rows.length },
      { key: "lawyer", label: "About advocates", count: rows.filter(isTarget("lawyer")).length, filter: isTarget("lawyer") },
      { key: "ngo", label: "About NGOs", count: rows.filter(isTarget("ngo")).length, filter: isTarget("ngo") },
    ],
    [rows]
  );

  const columns = [
    { key: "rating", header: "Rating", sortValue: (r) => r.rating || 0, render: (r) => <Stars n={r.rating} />, csv: (r) => r.rating },
    {
      key: "comment",
      header: "Review",
      sortable: false,
      render: (r) => (
        <span style={{ display: "block", maxWidth: 360, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={r.comment}>
          {r.comment || <em style={{ color: "var(--ax-muted)" }}>No written comment</em>}
        </span>
      ),
      csv: (r) => r.comment || "",
    },
    { key: "reviewer", header: "By", sortValue: (r) => r.userId?.name || "", render: (r) => r.userId?.name || "—", csv: (r) => r.userId?.name || "" },
    {
      key: "target",
      header: "About",
      sortValue: targetName,
      render: (r) => (
        <span>
          {targetName(r)}
          <span className="ax-cell-sub">{r.targetType === "ngo" ? "NGO" : "Advocate"}</span>
        </span>
      ),
      csv: targetName,
    },
    ...(view === "flagged"
      ? [{ key: "flagReason", header: "Reported because", render: (r) => r.flagReason || "—", csv: (r) => r.flagReason || "" }]
      : [{ key: "isFlagged", header: "Reported", sortValue: (r) => (r.isFlagged ? 1 : 0), render: (r) => (r.isFlagged ? <span className="ax-pill is-warn">Reported</span> : "—"), csv: (r) => (r.isFlagged ? "yes" : "no") }]),
    {
      key: "date",
      header: view === "flagged" ? "Reported on" : "Posted",
      sortValue: (r) => new Date(view === "flagged" ? r.flaggedAt || r.createdAt : r.createdAt).getTime(),
      render: (r) => fmtDate(view === "flagged" ? r.flaggedAt || r.createdAt : r.createdAt),
      csv: (r) => fmtDate(r.createdAt),
    },
  ];

  const bulkActions = (list, clear) => (
    <>
      {view === "flagged" && (
        <button type="button" className="ax-btn is-sm" onClick={async () => { await keep(list); clear(); }} disabled={busy}>
          <Check size={14} /> Keep
        </button>
      )}
      <button type="button" className="ax-btn is-sm is-danger" onClick={() => setConfirm({ rows: list, after: clear })}>
        <Trash2 size={14} /> Remove
      </button>
    </>
  );

  return (
    <AdminLayout breadcrumb="Flagged reviews" activeNav="reviews">
      <div className="ax-head">
        <div>
          <h1>Reviews</h1>
          <p>Reviews that people reported, and every review on LegalLink.</p>
        </div>
        <div className="ax-seg">
          <button type="button" className={view === "flagged" ? "is-on" : ""} onClick={() => setView("flagged")}>
            Reported <em>{flagged.length}</em>
          </button>
          <button type="button" className={view === "all" ? "is-on" : ""} onClick={() => setView("all")}>
            All reviews <em>{all.length}</em>
          </button>
        </div>
      </div>

      {loaded && !allowed && <div className="ax-msg is-warn">Your role can view reviews but not keep or remove them.</div>}

      <DataTable
        key={view}
        rows={rows}
        columns={columns}
        loading={loading}
        tabs={tabs}
        searchKeys={["comment", "flagReason", (r) => r.userId?.name, targetName]}
        searchPlaceholder="Review text, reviewer, advocate…"
        onRowClick={(r) => setOpenId(r._id)}
        bulkActions={allowed ? bulkActions : undefined}
        exportName={view === "flagged" ? "reported-reviews" : "reviews"}
        emptyText={view === "flagged" ? "No reported reviews. Nothing needs moderating." : "No reviews yet."}
        defaultSort={{ key: "date", dir: "desc" }}
      />

      <SidePanel
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `Review of ${targetName(open)}` : ""}
        subtitle={open && `By ${open.userId?.name || "a citizen"} · ${fmtDate(open.createdAt)}`}
        footer={
          allowed && open && (
            <>
              <button type="button" className="ax-btn is-danger" onClick={() => setConfirm({ rows: [open] })}>
                <Trash2 size={15} /> Remove review
              </button>
              <span className="ax-spacer" />
              {open.isFlagged && (
                <button type="button" className="ax-btn is-primary" onClick={() => keep([open])} disabled={busy} aria-busy={busy}>
                  {busy && <span className="btn-spinner" />}
                  <Check size={15} /> Keep review
                </button>
              )}
            </>
          )
        }
      >
        {open && (
          <>
            <Stars n={open.rating} />
            <p style={{ fontSize: 14, lineHeight: 1.65, color: "var(--ax-text)", whiteSpace: "pre-line", padding: 12, borderRadius: 8, background: "var(--ax-subtle)", margin: "12px 0 20px" }}>
              {open.comment || "No written comment."}
            </p>

            {open.isFastResolution && (
              <p style={{ display: "flex", gap: 8, fontSize: 13, padding: "10px 12px", borderRadius: 8, background: "var(--ax-warn-bg)", color: "var(--ax-warn)", marginBottom: 20 }}>
                <AlertTriangle size={16} style={{ flexShrink: 0 }} />
                The case was resolved within {open.resolutionDurationHours} hours of being filed. Very fast cases can be a sign of a fake review.
              </p>
            )}

            <dl className="ax-dl">
              <dt>About</dt>
              <dd>{targetName(open)} ({open.targetType === "ngo" ? "NGO" : "Advocate"})</dd>
              <dt>Case</dt>
              <dd>{open.caseId?.title || "—"}</dd>
              <dt>Reviewer</dt>
              <dd>{open.userId?.name || "—"}{open.userId?.email ? ` · ${open.userId.email}` : ""}</dd>
              {open.isFlagged && (
                <>
                  <dt>Reported because</dt>
                  <dd>{open.flagReason || "—"}</dd>
                  <dt>Reported by</dt>
                  <dd>{open.flaggedBy?.name || "A user"}{open.flaggedAt ? ` · ${fmtDate(open.flaggedAt)}` : ""}</dd>
                </>
              )}
              {open.reply?.text && (
                <>
                  <dt>Their reply</dt>
                  <dd>{open.reply.text}</dd>
                </>
              )}
            </dl>
          </>
        )}
      </SidePanel>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm && (confirm.rows.length > 1 ? `Remove ${confirm.rows.length} reviews?` : "Remove this review?")}
        body="Removed reviews disappear from the profile and the rating is recalculated. This cannot be undone."
        confirmLabel="Remove"
        danger
        busy={busy}
        onConfirm={async () => {
          await remove(confirm.rows);
          if (confirm.after) confirm.after();
        }}
        onCancel={() => setConfirm(null)}
      />
      {toast && <div className={`ax-toast${toast.error ? " is-error" : ""}`} role="status">{toast.msg}</div>}
    </AdminLayout>
  );
};

export default ReviewsList;
