import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, X, Ban, Unlock, Trash2, ExternalLink, FileText, MessageSquareWarning } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import useAdminMe from "../../components/admin/useAdminMe";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { adminAPI } from "../../services/api";
import { useFileLink } from "../../services/files";
import { fmtDate, waitingLabel, daysSince, initials, fileUrl, isPdf, isImage, STATUS_TONE, statusText } from "../../components/admin/helpers";

// Ready-made reasons so rejections are consistent and quick
const REJECT_REASONS = [
  "Bar Council ID could not be verified",
  "Uploaded licence is unclear or unreadable",
  "Name does not match the CNIC",
  "Licence has expired",
  "Duplicate account",
];
const INFO_REQUESTS = [
  "Please upload a clearer copy of your Bar Council licence",
  "Please upload the back side of your licence",
  "Please confirm your Bar Council enrolment number",
];

const CHECKLIST = [
  "Name matches the CNIC and the Bar Council licence",
  "Bar Council ID matches the licence",
  "Licence is valid and readable",
  "Practice areas and experience look reasonable",
];

const Photo = ({ l, size = 30 }) =>
  l.photo ? (
    <img className="ax-avatar" src={fileUrl(l.photo)} alt="" style={{ width: size, height: size }} />
  ) : (
    <span className="ax-avatar" style={{ width: size, height: size }}>{initials(l.name)}</span>
  );

const LawyersList = () => {
  const { can, loaded } = useAdminMe();
  const allowed = can("verify");
  const [params, setParams] = useSearchParams();
  const [lawyers, setLawyers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(params.get("open"));
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);
  const [confirm, setConfirm] = useState(null); // { kind, rows }
  const [decision, setDecision] = useState(null); // "reject" | "info" | null
  const [reason, setReason] = useState("");
  const [checks, setChecks] = useState({});

  const notify = (msg, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getLawyers();
      setLawyers(res.data.lawyers || []);
    } catch (e) {
      notify("Could not load advocates. Check that the server is running.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // ?open=<id> from search, the bell or the dashboard
  useEffect(() => {
    const id = params.get("open");
    if (id) setOpenId(id);
  }, [params]);

  const open = lawyers.find((l) => l._id === openId) || null;
  const closePanel = () => {
    setOpenId(null);
    setDecision(null);
    setReason("");
    setChecks({});
    if (params.get("open")) {
      params.delete("open");
      setParams(params, { replace: true });
    }
  };

  // ── Actions ──
  const verify = async (rows, status, why = "") => {
    setBusy(true);
    try {
      for (const r of rows) await adminAPI.verifyLawyer(r._id, status, why);
      notify(
        rows.length > 1
          ? `${rows.length} advocates ${status === "approved" ? "approved" : "rejected"}.`
          : `${rows[0].name} ${status === "approved" ? "approved" : "rejected"}.`
      );
      closePanel();
      setConfirm(null);
      load();
    } catch (e) {
      notify("That didn't work. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const requestInfo = async (row, message) => {
    setBusy(true);
    try {
      await adminAPI.requestLawyerInfo(row._id, message);
      notify(`Request sent to ${row.name}. The application stays pending.`);
      setDecision(null);
      setReason("");
      load();
    } catch (e) {
      notify("Could not send the request. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const setBlocked = async (rows, blocked) => {
    setBusy(true);
    try {
      for (const r of rows) await adminAPI.blockLawyer(r._id, blocked);
      notify(`${rows.length > 1 ? `${rows.length} advocates` : rows[0].name} ${blocked ? "blocked" : "unblocked"}.`);
      setConfirm(null);
      load();
    } catch (e) {
      notify("That didn't work. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (rows) => {
    setBusy(true);
    try {
      for (const r of rows) await adminAPI.deleteLawyer(r._id);
      notify(`${rows.length > 1 ? `${rows.length} advocates` : rows[0].name} deleted.`);
      setConfirm(null);
      closePanel();
      load();
    } catch (e) {
      notify("That didn't work. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  // ── Table ──
  const counts = useMemo(
    () => ({
      all: lawyers.length,
      pending: lawyers.filter((l) => l.verificationStatus === "pending").length,
      approved: lawyers.filter((l) => l.verificationStatus === "approved").length,
      rejected: lawyers.filter((l) => l.verificationStatus === "rejected").length,
      blocked: lawyers.filter((l) => l.isBlocked).length,
    }),
    [lawyers]
  );

  const tabs = [
    { key: "pending", label: "Waiting for review", count: counts.pending, filter: (l) => l.verificationStatus === "pending" },
    { key: "approved", label: "Approved", count: counts.approved, filter: (l) => l.verificationStatus === "approved" },
    { key: "rejected", label: "Rejected", count: counts.rejected, filter: (l) => l.verificationStatus === "rejected" },
    { key: "blocked", label: "Blocked", count: counts.blocked, filter: (l) => l.isBlocked },
    { key: "all", label: "All", count: counts.all },
  ];
  const initialTab = params.get("status") || (counts.pending ? "pending" : "all");

  const columns = [
    {
      key: "name",
      header: "Advocate",
      render: (l) => (
        <span className="ax-cell-main">
          <Photo l={l} />
          <span>
            <span className="ax-cell-title">{l.name}</span>
            <span className="ax-cell-sub">{l.email}</span>
          </span>
        </span>
      ),
      csv: (l) => l.name,
    },
    { key: "email", header: "Email", csv: (l) => l.email, hideInTable: true },
    { key: "barCouncilId", header: "Bar Council ID", render: (l) => <span className="ax-mono">{l.barCouncilId || "—"}</span> },
    {
      key: "specialization",
      header: "Practice areas",
      sortValue: (l) => (l.specialization || [])[0] || "",
      render: (l) => (l.specialization || []).slice(0, 2).map((s) => <span key={s} className="ax-tag" style={{ marginRight: 4 }}>{s}</span>),
      csv: (l) => (l.specialization || []).join("; "),
    },
    { key: "experience", header: "Experience", sortValue: (l) => Number(l.experience) || 0, render: (l) => `${l.experience || 0} yrs`, csv: (l) => l.experience },
    {
      key: "verificationStatus",
      header: "Status",
      render: (l) => (
        <span className={`ax-pill ${l.isBlocked ? "is-bad" : STATUS_TONE[l.verificationStatus] || ""}`}>
          {l.isBlocked ? "Blocked" : statusText(l.verificationStatus)}
        </span>
      ),
      csv: (l) => (l.isBlocked ? "blocked" : l.verificationStatus),
    },
    {
      key: "createdAt",
      header: "Applied",
      sortValue: (l) => new Date(l.createdAt).getTime(),
      render: (l) =>
        l.verificationStatus === "pending" ? (
          <span className={`ax-age${daysSince(l.createdAt) > 2 ? " is-late" : ""}`}>Waiting {waitingLabel(l.createdAt).toLowerCase()}</span>
        ) : (
          fmtDate(l.createdAt)
        ),
      csv: (l) => fmtDate(l.createdAt),
    },
  ];

  const bulkActions = (rows, clear) => {
    const pending = rows.filter((r) => r.verificationStatus === "pending");
    return (
      <>
        {pending.length > 0 && (
          <button type="button" className="ax-btn is-sm is-primary" onClick={() => setConfirm({ kind: "approve", rows: pending, after: clear })}>
            <Check size={14} /> Approve {pending.length}
          </button>
        )}
        <button type="button" className="ax-btn is-sm" onClick={() => setConfirm({ kind: "block", rows, after: clear })}>
          <Ban size={14} /> Block
        </button>
        <button type="button" className="ax-btn is-sm is-danger" onClick={() => setConfirm({ kind: "delete", rows, after: clear })}>
          <Trash2 size={14} /> Delete
        </button>
      </>
    );
  };

  // ── Side panel content ──
  // Documents are private: the server gives a short-lived link to admins only
  const rawDoc = open?.officialDocument || "";
  const { url: docUrl, error: docError, loading: docLoading } = useFileLink(rawDoc);
  const isPending = open?.verificationStatus === "pending";
  const allChecked = CHECKLIST.every((_, i) => checks[i]);

  const panelFooter = open && (
    <>
      {isPending ? (
        decision ? (
          <>
            <button type="button" className="ax-btn" onClick={() => { setDecision(null); setReason(""); }} disabled={busy}>Back</button>
            <span className="ax-spacer" />
            {decision === "reject" ? (
              <button type="button" className="ax-btn is-danger-solid" disabled={!reason.trim() || busy} aria-busy={busy} onClick={() => verify([open], "rejected", reason.trim())}>
                {busy && <span className="btn-spinner" />} Reject application
              </button>
            ) : (
              <button type="button" className="ax-btn is-primary" disabled={!reason.trim() || busy} aria-busy={busy} onClick={() => requestInfo(open, reason.trim())}>
                {busy && <span className="btn-spinner" />} Send request
              </button>
            )}
          </>
        ) : (
          <>
            <button type="button" className="ax-btn is-danger" onClick={() => setDecision("reject")}>
              <X size={15} /> Reject
            </button>
            <button type="button" className="ax-btn" onClick={() => setDecision("info")}>
              <MessageSquareWarning size={15} /> Request more info
            </button>
            <span className="ax-spacer" />
            <button
              type="button"
              className="ax-btn is-primary"
              disabled={busy || !allChecked}
              title={allChecked ? "" : "Tick every check first"}
              aria-busy={busy}
              onClick={() => verify([open], "approved")}
            >
              {busy && <span className="btn-spinner" />}
              <Check size={15} /> Approve advocate
            </button>
          </>
        )
      ) : (
        <>
          <button type="button" className="ax-btn is-danger" onClick={() => setConfirm({ kind: "delete", rows: [open] })}>
            <Trash2 size={15} /> Delete
          </button>
          <span className="ax-spacer" />
          {open.verificationStatus === "rejected" && (
            <button type="button" className="ax-btn" onClick={() => verify([open], "approved")} disabled={busy}>
              <Check size={15} /> Approve after all
            </button>
          )}
          <button type="button" className="ax-btn" onClick={() => setConfirm({ kind: open.isBlocked ? "unblock" : "block", rows: [open] })}>
            {open.isBlocked ? <><Unlock size={15} /> Unblock</> : <><Ban size={15} /> Block</>}
          </button>
        </>
      )}
    </>
  );

  const CONFIRM_COPY = {
    approve: (n) => ({ title: `Approve ${n}?`, body: "They will appear in Find Advocates and can receive client inquiries. Each one gets an approval email.", label: "Approve", danger: false }),
    block: (n) => ({ title: `Block ${n}?`, body: "They will be signed out, hidden from Find Advocates, and unable to log in until unblocked.", label: "Block", danger: true }),
    unblock: (n) => ({ title: `Unblock ${n}?`, body: "They will be able to log in and appear in Find Advocates again.", label: "Unblock", danger: false }),
    delete: (n) => ({ title: `Delete ${n} permanently?`, body: "Their account and profile are removed. This cannot be undone. Blocking is usually the safer choice.", label: "Delete permanently", danger: true }),
  };
  const confirmCopy = confirm ? CONFIRM_COPY[confirm.kind](confirm.rows.length > 1 ? `${confirm.rows.length} advocates` : confirm.rows[0].name) : null;
  const runConfirm = async () => {
    const { kind, rows, after } = confirm;
    if (kind === "approve") await verify(rows, "approved");
    if (kind === "block") await setBlocked(rows, true);
    if (kind === "unblock") await setBlocked(rows, false);
    if (kind === "delete") await remove(rows);
    if (after) after();
  };

  return (
    <AdminLayout breadcrumb="Advocates" activeNav="lawyers">
      <div className="ax-head">
        <div>
          <h1>Advocates</h1>
          <p>Review applications against Bar Council records and manage advocate accounts.</p>
        </div>
      </div>

      {loaded && !allowed && <div className="ax-msg is-warn">Your role can view advocates but not approve, reject or block them.</div>}

      <DataTable
        rows={lawyers}
        columns={columns}
        loading={loading}
        tabs={tabs}
        initialTab={initialTab}
        searchKeys={["name", "email", "barCouncilId", "cnic", (l) => (l.specialization || []).join(" ")]}
        searchPlaceholder="Name, email, Bar Council ID, CNIC…"
        onRowClick={(l) => setOpenId(l._id)}
        bulkActions={allowed ? bulkActions : undefined}
        exportName="advocates"
        emptyText="No advocates in this list."
        defaultSort={{ key: "createdAt", dir: "asc" }}
      />

      {/* ── Detail / verification panel ── */}
      <SidePanel
        open={Boolean(open)}
        onClose={closePanel}
        wide={isPending}
        title={open?.name}
        subtitle={
          open &&
          (isPending
            ? `Advocate application · waiting ${waitingLabel(open.createdAt).toLowerCase()}`
            : `${statusText(open.verificationStatus)} advocate${open.isBlocked ? " · blocked" : ""} · joined ${fmtDate(open.createdAt)}`)
        }
        footer={allowed ? panelFooter : null}
      >
        {open && (
          <div className={isPending ? "ax-review" : ""}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <Photo l={open} size={56} />
                <div>
                  <span className={`ax-pill ${open.isBlocked ? "is-bad" : STATUS_TONE[open.verificationStatus] || ""}`}>
                    {open.isBlocked ? "Blocked" : statusText(open.verificationStatus)}
                  </span>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--ax-muted)" }}>{open.email}</div>
                </div>
              </div>

              <h3 className="ax-section-title">Credentials</h3>
              <dl className="ax-dl">
                <dt>Bar Council ID</dt>
                <dd className="ax-mono">{open.barCouncilId || "—"}</dd>
                <dt>CNIC</dt>
                <dd className="ax-mono">{open.cnic || "—"}</dd>
                <dt>Practising in</dt>
                <dd>{(open.stateOfPractice || []).join(", ") || "—"}</dd>
                <dt>Experience</dt>
                <dd>{open.experience || 0} years</dd>
                <dt>Practice areas</dt>
                <dd>{(open.specialization || []).join(", ") || "—"}</dd>
                <dt>Languages</dt>
                <dd>{(open.languages || []).join(", ") || "—"}</dd>
              </dl>

              <h3 className="ax-section-title">Contact</h3>
              <dl className="ax-dl">
                <dt>Phone</dt>
                <dd>{open.phone || "—"}</dd>
                <dt>Office</dt>
                <dd>{open.officeAddress || "—"}</dd>
              </dl>

              {!isPending && (
                <>
                  <h3 className="ax-section-title">On LegalLink</h3>
                  <dl className="ax-dl">
                    <dt>Rating</dt>
                    <dd>{open.rating ? `${Number(open.rating).toFixed(1)} from ${open.totalReviews || 0} reviews` : "No reviews yet"}</dd>
                    <dt>Cases</dt>
                    <dd>{open.totalCases || 0}</dd>
                    {open.rejectionReason && (
                      <>
                        <dt>Last note</dt>
                        <dd>{open.rejectionReason}</dd>
                      </>
                    )}
                  </dl>
                </>
              )}

              {isPending && open.infoRequest?.message && (
                <p style={{ fontSize: 13, padding: "10px 12px", borderRadius: 8, background: "var(--ax-warn-bg)", color: "var(--ax-warn)", marginBottom: 20 }}>
                  More information requested {fmtDate(open.infoRequest.at)}: {open.infoRequest.message}
                </p>
              )}

              {open.bio && (
                <>
                  <h3 className="ax-section-title">About</h3>
                  <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ax-text-2)", marginBottom: 20 }}>{open.bio}</p>
                </>
              )}

              {isPending && !decision && (
                <>
                  <h3 className="ax-section-title">Before approving, confirm</h3>
                  <ul className="ax-checklist">
                    {CHECKLIST.map((c, i) => (
                      <li key={c}>
                        <label>
                          <input type="checkbox" checked={Boolean(checks[i])} onChange={(e) => setChecks((s) => ({ ...s, [i]: e.target.checked }))} />
                          {c}
                        </label>
                      </li>
                    ))}
                  </ul>
                </>
              )}

              {isPending && decision && (
                <>
                  <h3 className="ax-section-title">{decision === "reject" ? "Reason for rejecting" : "What do you need from them?"}</h3>
                  <p style={{ fontSize: 13, color: "var(--ax-muted)", margin: "0 0 10px" }}>
                    {decision === "reject" ? "The advocate sees this in the rejection email." : "The advocate gets this by email. The application stays pending."}
                  </p>
                  <div className="ax-chips">
                    {(decision === "reject" ? REJECT_REASONS : INFO_REQUESTS).map((r) => (
                      <button key={r} type="button" className={`ax-chip-btn${reason === r ? " is-on" : ""}`} onClick={() => setReason(r)}>
                        {r}
                      </button>
                    ))}
                  </div>
                  <textarea className="ax-textarea" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Write or edit the message…" />
                </>
              )}
            </div>

            {/* Document */}
            <div className="ax-doc" style={isPending ? null : { minHeight: 380 }}>
              <div className="ax-doc-head">
                <span><FileText size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Bar Council licence</span>
                {docUrl && (
                  <a className="ax-btn is-sm" href={docUrl} target="_blank" rel="noopener noreferrer">
                    <ExternalLink size={13} /> Open
                  </a>
                )}
              </div>
              {!rawDoc ? (
                <div className="ax-doc-missing">No document was uploaded with this application.</div>
              ) : docLoading ? (
                <div className="ax-doc-missing">Loading the document…</div>
              ) : docError ? (
                <div className="ax-doc-missing">{docError}</div>
              ) : isImage(rawDoc) ? (
                <img src={docUrl} alt="Bar Council licence" />
              ) : isPdf(rawDoc) ? (
                <iframe src={docUrl} title="Bar Council licence" />
              ) : (
                <div className="ax-doc-missing">
                  This file type can't be previewed here.
                  <br />
                  Use “Open” to view it in a new tab.
                </div>
              )}
            </div>
          </div>
        )}
      </SidePanel>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirmCopy?.title}
        body={confirmCopy?.body}
        confirmLabel={confirmCopy?.label}
        danger={confirmCopy?.danger}
        busy={busy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />

      {toast && <div className={`ax-toast${toast.error ? " is-error" : ""}`} role="status">{toast.msg}</div>}
    </AdminLayout>
  );
};

export default LawyersList;
