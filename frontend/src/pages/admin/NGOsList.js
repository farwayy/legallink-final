import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, X, Ban, Unlock, ExternalLink, FileText, MessageSquareWarning } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import useAdminMe from "../../components/admin/useAdminMe";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { adminAPI } from "../../services/api";
import { useFileLink } from "../../services/files";
import { fmtDate, waitingLabel, daysSince, initials, isPdf, isImage, STATUS_TONE, statusText } from "../../components/admin/helpers";

// Ready-made reasons so rejections are consistent and quick
const REJECT_REASONS = [
  "Registration number could not be verified",
  "Registration certificate is unclear or unreadable",
  "Organisation does not provide legal aid services",
  "Focal person details are incomplete",
  "Duplicate account",
];
const INFO_REQUESTS = [
  "Please upload a clearer copy of your registration certificate",
  "Please share the focal person's CNIC",
  "Please describe the legal aid services you provide",
];

const CHECKLIST = [
  "Organisation name matches the registration certificate",
  "Registration number matches the certificate",
  "Certificate is valid and readable",
  "Focal person and contact details are complete",
];

const Photo = ({ l, size = 30 }) => (
  <span className="ax-avatar" style={{ width: size, height: size, borderRadius: 8 }}>{initials(l.name)}</span>
);

const statusOf = (n) => n.verificationStatus || n.status || "pending";

const NGOsList = () => {
  const { can, loaded } = useAdminMe();
  const allowed = can("verify");
  const [params, setParams] = useSearchParams();
  const [lawyers, setLawyers] = useState([]); // organisations
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
      const res = await adminAPI.getNGOs();
      setLawyers(res.data.ngos || []);
    } catch (e) {
      notify("Could not load organisations. Check that the server is running.", true);
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
      for (const r of rows) await adminAPI.verifyNGO(r._id, status, why);
      notify(
        rows.length > 1
          ? `${rows.length} organisations ${status === "approved" ? "accredited" : "rejected"}.`
          : `${rows[0].name} ${status === "approved" ? "accredited" : "rejected"}.`
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
      await adminAPI.requestNGOInfo(row._id, message);
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
      for (const r of rows) await adminAPI.toggleNGOStatus(r._id, blocked);
      notify(`${rows.length > 1 ? `${rows.length} organisations` : rows[0].name} ${blocked ? "suspended" : "reactivated"}.`);
      setConfirm(null);
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
      pending: lawyers.filter((l) => statusOf(l) === "pending").length,
      approved: lawyers.filter((l) => statusOf(l) === "approved").length,
      rejected: lawyers.filter((l) => statusOf(l) === "rejected").length,
      blocked: lawyers.filter((l) => l.isBlocked).length,
    }),
    [lawyers]
  );

  const tabs = [
    { key: "pending", label: "Waiting for review", count: counts.pending, filter: (l) => statusOf(l) === "pending" },
    { key: "approved", label: "Accredited", count: counts.approved, filter: (l) => statusOf(l) === "approved" },
    { key: "rejected", label: "Rejected", count: counts.rejected, filter: (l) => statusOf(l) === "rejected" },
    { key: "blocked", label: "Suspended", count: counts.blocked, filter: (l) => l.isBlocked },
    { key: "all", label: "All", count: counts.all },
  ];
  const initialTab = params.get("status") || (counts.pending ? "pending" : "all");

  const columns = [
    {
      key: "name",
      header: "Organisation",
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
    { key: "registrationNumber", header: "Registration no.", render: (l) => <span className="ax-mono">{l.registrationNumber || "—"}</span> },
    { key: "city", header: "City", render: (l) => `${l.city || "—"}${l.province ? `, ${l.province}` : ""}`, csv: (l) => `${l.city || ""} ${l.province || ""}` },
    {
      key: "focusAreas",
      header: "Focus areas",
      sortValue: (l) => (l.focusAreas || [])[0] || "",
      render: (l) => (l.focusAreas || []).slice(0, 2).map((s) => <span key={s} className="ax-tag" style={{ marginRight: 4 }}>{s}</span>),
      csv: (l) => (l.focusAreas || []).join("; "),
    },
    {
      key: "verificationStatus",
      header: "Status",
      sortValue: (l) => statusOf(l),
      render: (l) => (
        <span className={`ax-pill ${l.isBlocked ? "is-bad" : STATUS_TONE[statusOf(l)] || ""}`}>
          {l.isBlocked ? "Suspended" : statusOf(l) === "approved" ? "Accredited" : statusText(statusOf(l))}
        </span>
      ),
      csv: (l) => (l.isBlocked ? "suspended" : statusOf(l)),
    },
    {
      key: "createdAt",
      header: "Applied",
      sortValue: (l) => new Date(l.createdAt).getTime(),
      render: (l) =>
        statusOf(l) === "pending" ? (
          <span className={`ax-age${daysSince(l.createdAt) > 2 ? " is-late" : ""}`}>Waiting {waitingLabel(l.createdAt).toLowerCase()}</span>
        ) : (
          fmtDate(l.createdAt)
        ),
      csv: (l) => fmtDate(l.createdAt),
    },
  ];

  const bulkActions = (rows, clear) => {
    const pending = rows.filter((r) => statusOf(r) === "pending");
    return (
      <>
        {pending.length > 0 && (
          <button type="button" className="ax-btn is-sm is-primary" onClick={() => setConfirm({ kind: "approve", rows: pending, after: clear })}>
            <Check size={14} /> Accredit {pending.length}
          </button>
        )}
        <button type="button" className="ax-btn is-sm" onClick={() => setConfirm({ kind: "block", rows, after: clear })}>
          <Ban size={14} /> Suspend
        </button>
      </>
    );
  };

  // ── Side panel content ──
  // Documents are private: the server gives a short-lived link to admins only
  const rawDoc = open?.officialDocument || "";
  const { url: docUrl, error: docError, loading: docLoading } = useFileLink(rawDoc);
  const isPending = open && statusOf(open) === "pending";
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
              <Check size={15} /> Accredit organisation
            </button>
          </>
        )
      ) : (
        <>
          <span className="ax-spacer" />
          {statusOf(open) === "rejected" && (
            <button type="button" className="ax-btn" onClick={() => verify([open], "approved")} disabled={busy}>
              <Check size={15} /> Accredit after all
            </button>
          )}
          <button type="button" className="ax-btn" onClick={() => setConfirm({ kind: open.isBlocked ? "unblock" : "block", rows: [open] })}>
            {open.isBlocked ? <><Unlock size={15} /> Reactivate</> : <><Ban size={15} /> Suspend</>}
          </button>
        </>
      )}
    </>
  );

  const CONFIRM_COPY = {
    approve: (n) => ({ title: `Accredit ${n}?`, body: "They will appear in the Legal Aid directory and can receive aid requests. Each one gets an approval email.", label: "Accredit", danger: false }),
    block: (n) => ({ title: `Suspend ${n}?`, body: "They will be hidden from the Legal Aid directory and unable to log in until reactivated. Their cases stay intact.", label: "Suspend", danger: true }),
    unblock: (n) => ({ title: `Reactivate ${n}?`, body: "They will be able to log in and appear in the Legal Aid directory again.", label: "Reactivate", danger: false }),
  };
  const confirmCopy = confirm ? CONFIRM_COPY[confirm.kind](confirm.rows.length > 1 ? `${confirm.rows.length} organisations` : confirm.rows[0].name) : null;
  const runConfirm = async () => {
    const { kind, rows, after } = confirm;
    if (kind === "approve") await verify(rows, "approved");
    if (kind === "block") await setBlocked(rows, true);
    if (kind === "unblock") await setBlocked(rows, false);
    if (after) after();
  };

  return (
    <AdminLayout breadcrumb="NGOs" activeNav="ngos">
      <div className="ax-head">
        <div>
          <h1>Legal aid organisations</h1>
          <p>Review accreditation applications and manage NGO accounts.</p>
        </div>
      </div>

      {loaded && !allowed && <div className="ax-msg is-warn">Your role can view NGOs but not accredit, reject or suspend them.</div>}

      <DataTable
        rows={lawyers}
        columns={columns}
        loading={loading}
        tabs={tabs}
        initialTab={initialTab}
        searchKeys={["name", "email", "registrationNumber", "city", (l) => (l.focusAreas || []).join(" "), (l) => l.focalPerson?.name]}
        searchPlaceholder="Name, email, registration no., city…"
        onRowClick={(l) => setOpenId(l._id)}
        bulkActions={allowed ? bulkActions : undefined}
        exportName="ngos"
        emptyText="No organisations in this list."
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
            ? `Accreditation application · waiting ${waitingLabel(open.createdAt).toLowerCase()}`
            : `${statusOf(open) === "approved" ? "Accredited" : statusText(statusOf(open))} organisation${open.isBlocked ? " · suspended" : ""} · joined ${fmtDate(open.createdAt)}`)
        }
        footer={allowed ? panelFooter : null}
      >
        {open && (
          <div className={isPending ? "ax-review" : ""}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
                <Photo l={open} size={56} />
                <div>
                  <span className={`ax-pill ${open.isBlocked ? "is-bad" : STATUS_TONE[statusOf(open)] || ""}`}>
                    {open.isBlocked ? "Suspended" : statusText(statusOf(open))}
                  </span>
                  <div style={{ marginTop: 6, fontSize: 13, color: "var(--ax-muted)" }}>{open.email}</div>
                </div>
              </div>

              <h3 className="ax-section-title">Registration</h3>
              <dl className="ax-dl">
                <dt>Registration no.</dt>
                <dd className="ax-mono">{open.registrationNumber || "—"}</dd>
                <dt>Location</dt>
                <dd>{[open.address, open.city, open.province].filter(Boolean).join(", ") || "—"}</dd>
                <dt>Focus areas</dt>
                <dd>{(open.focusAreas || []).join(", ") || "—"}</dd>
                <dt>Services</dt>
                <dd>{(open.servicesOffered || []).join(", ") || "—"}</dd>
                <dt>Website</dt>
                <dd>{open.website || "—"}</dd>
              </dl>

              <h3 className="ax-section-title">Focal person</h3>
              <dl className="ax-dl">
                <dt>Name</dt>
                <dd>{open.focalPerson?.name || "—"}{open.focalPerson?.designation ? ` · ${open.focalPerson.designation}` : ""}</dd>
                <dt>CNIC</dt>
                <dd className="ax-mono">{open.focalPerson?.cnic || "—"}</dd>
                <dt>Phone</dt>
                <dd>{open.focalPerson?.phone || open.phone || "—"}</dd>
              </dl>

              {!isPending && (
                <>
                  <h3 className="ax-section-title">On LegalLink</h3>
                  <dl className="ax-dl">
                    <dt>Rating</dt>
                    <dd>{open.rating ? `${Number(open.rating).toFixed(1)} from ${open.totalReviews || 0} reviews` : "No reviews yet"}</dd>
                    <dt>Panel advocates</dt>
                    <dd>{(open.members || []).filter((m) => m.status === "active").length}</dd>
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
                    {decision === "reject" ? "The organisation sees this in the rejection email." : "The organisation gets this by email. The application stays pending."}
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
                <span><FileText size={14} style={{ verticalAlign: -2, marginRight: 6 }} />Registration certificate</span>
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
                <img src={docUrl} alt="Registration certificate" />
              ) : isPdf(rawDoc) ? (
                <iframe src={docUrl} title="Registration certificate" />
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

export default NGOsList;
