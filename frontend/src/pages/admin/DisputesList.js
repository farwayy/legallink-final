import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { ExternalLink, Save } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import useAdminMe from "../../components/admin/useAdminMe";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import { adminAPI } from "../../services/api";
import {
  fmtDate,
  waitingLabel,
  daysSince,
  STATUS_TONE,
  statusText,
} from "../../components/admin/helpers";

const STATUSES = [
  { value: "under_review", label: "Under review" },
  { value: "resolved", label: "Resolved" },
  { value: "dismissed", label: "Dismissed" },
];

const NOTE_TEMPLATES = {
  under_review: "We are looking into this and have contacted the other party.",
  resolved:
    "We reviewed the case history and took action with the advocate/organisation.",
  dismissed:
    "We reviewed the case history and found no breach of LegalLink's rules.",
};

const DisputesList = () => {
  const { can, loaded } = useAdminMe();
  const allowed = can("moderate");
  const navigate = useNavigate();
  const [disputes, setDisputes] = useState([]);
  const [names, setNames] = useState({});
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [status, setStatus] = useState("open");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState(null);

  const notify = (msg, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  };

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [d, l, n] = await Promise.all([
        adminAPI.getDisputes({ limit: 500 }),
        adminAPI.getLawyers().catch(() => null),
        adminAPI.getNGOs().catch(() => null),
      ]);
      setDisputes(d.data.disputes || []);
      const map = {};
      (l?.data?.lawyers || []).forEach((x) => (map[x._id] = x.name));
      (n?.data?.ngos || []).forEach((x) => (map[x._id] = x.name));
      setNames(map);
    } catch (e) {
      notify(
        "Could not load disputes. Check that the server is running.",
        true,
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const open = disputes.find((d) => d._id === openId) || null;
  useEffect(() => {
    if (open) {
      setStatus(open.status === "open" ? "under_review" : open.status);
      setNote(open.adminNote || "");
    }
  }, [openId]); // eslint-disable-line

  const save = async () => {
    setBusy(true);
    try {
      await adminAPI.updateDisputeStatus(open._id, status, note.trim());
      notify(`Dispute marked as ${statusText(status).toLowerCase()}.`);
      setOpenId(null);
      load();
    } catch (e) {
      notify("Could not update the dispute. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const against = (d) =>
    names[d.againstId] ||
    (d.againstType === "ngo" ? "Legal aid NGO" : "Advocate");
  const is = (s) => (d) => d.status === s;
  const tabs = useMemo(
    () => [
      {
        key: "open",
        label: "Open",
        count: disputes.filter(is("open")).length,
        filter: is("open"),
      },
      {
        key: "under_review",
        label: "Under review",
        count: disputes.filter(is("under_review")).length,
        filter: is("under_review"),
      },
      {
        key: "resolved",
        label: "Resolved",
        count: disputes.filter(is("resolved")).length,
        filter: is("resolved"),
      },
      {
        key: "dismissed",
        label: "Dismissed",
        count: disputes.filter(is("dismissed")).length,
        filter: is("dismissed"),
      },
      { key: "all", label: "All", count: disputes.length },
    ],
    [disputes],
  );

  const columns = [
    {
      key: "case",
      header: "Case",
      sortValue: (d) => d.caseId?.title || "",
      render: (d) => (
        <span>
          <span className="ax-cell-title">{d.caseId?.title || "Case"}</span>
          <span className="ax-cell-sub">{d.caseId?.category || ""}</span>
        </span>
      ),
      csv: (d) => d.caseId?.title || "",
    },
    {
      key: "category",
      header: "Issue",
      render: (d) => <span className="ax-tag">{d.category}</span>,
    },
    {
      key: "citizen",
      header: "Filed by",
      sortValue: (d) => d.userId?.name || "",
      render: (d) => d.userId?.name || "—",
      csv: (d) => d.userId?.name || "",
    },
    {
      key: "against",
      header: "Against",
      sortValue: against,
      render: (d) => (
        <span>
          {against(d)}
          <span className="ax-cell-sub">
            {d.againstType === "ngo" ? "NGO" : "Advocate"}
          </span>
        </span>
      ),
      csv: against,
    },
    {
      key: "status",
      header: "Status",
      render: (d) => (
        <span className={`ax-pill ${STATUS_TONE[d.status] || ""}`}>
          {statusText(d.status)}
        </span>
      ),
      csv: (d) => d.status,
    },
    {
      key: "createdAt",
      header: "Filed",
      sortValue: (d) => new Date(d.createdAt).getTime(),
      render: (d) =>
        ["open", "under_review"].includes(d.status) ? (
          <span
            className={`ax-age${daysSince(d.createdAt) > 2 ? " is-late" : ""}`}
          >
            Waiting {waitingLabel(d.createdAt).toLowerCase()}
          </span>
        ) : (
          fmtDate(d.createdAt)
        ),
      csv: (d) => fmtDate(d.createdAt),
    },
  ];

  return (
    <AdminLayout breadcrumb="Disputes" activeNav="disputes">
      <div className="ax-head">
        <div>
          <h1>Disputes</h1>
          <p>
            Complaints citizens have filed about an advocate or legal aid
            organisation.
          </p>
        </div>
      </div>

      {loaded && !allowed && (
        <div className="ax-msg is-warn">
          Your role can view disputes but not decide them.
        </div>
      )}

      <DataTable
        rows={disputes}
        columns={columns}
        loading={loading}
        tabs={tabs}
        initialTab={disputes.some(is("open")) ? "open" : "all"}
        searchKeys={[
          "category",
          "description",
          (d) => d.caseId?.title,
          (d) => d.userId?.name,
          against,
        ]}
        searchPlaceholder="Case, citizen, advocate, issue…"
        onRowClick={(d) => setOpenId(d._id)}
        exportName="disputes"
        emptyText="No disputes in this list."
        defaultSort={{ key: "createdAt", dir: "asc" }}
      />

      <SidePanel
        open={Boolean(open)}
        onClose={() => setOpenId(null)}
        title={open ? `${open.category}` : ""}
        subtitle={
          open &&
          `Filed ${fmtDate(open.createdAt)} by ${open.userId?.name || "a citizen"}`
        }
        footer={
          open && (
            <>
              {open.caseId?._id && (
                <button
                  type="button"
                  className="ax-btn"
                  onClick={() => navigate(`/case/${open.caseId._id}`)}
                >
                  <ExternalLink size={15} /> Open case file
                </button>
              )}
              <span className="ax-spacer" />
              {allowed && (
                <button
                  type="button"
                  className="ax-btn is-primary"
                  onClick={save}
                  disabled={
                    busy ||
                    (status === open.status && note === (open.adminNote || ""))
                  }
                  aria-busy={busy}
                >
                  {busy && <span className="btn-spinner" />}
                  <Save size={15} /> Save
                </button>
              )}
            </>
          )
        }
      >
        {open && (
          <>
            <span className={`ax-pill ${STATUS_TONE[open.status] || ""}`}>
              {statusText(open.status)}
            </span>
            <dl className="ax-dl" style={{ marginTop: 16 }}>
              <dt>Case</dt>
              <dd>
                {open.caseId?.title || "—"}
                {open.caseId?.status
                  ? ` · ${statusText(open.caseId.status)}`
                  : ""}
              </dd>
              <dt>Filed by</dt>
              <dd>
                {open.userId?.name || "—"}
                {open.userId?.email ? ` · ${open.userId.email}` : ""}
              </dd>
              <dt>Against</dt>
              <dd>
                {against(open)} (
                {open.againstType === "ngo" ? "NGO" : "Advocate"})
              </dd>
              {open.resolvedAt && (
                <>
                  <dt>Closed</dt>
                  <dd>{fmtDate(open.resolvedAt)}</dd>
                </>
              )}
            </dl>

            <h3 className="ax-section-title">What the citizen wrote</h3>
            <p
              style={{
                fontSize: 13.5,
                lineHeight: 1.6,
                color: "var(--ax-text-2)",
                whiteSpace: "pre-line",
                padding: 12,
                borderRadius: 8,
                background: "var(--ax-subtle)",
                marginBottom: 20,
              }}
            >
              {open.description}
            </p>

            {allowed && (
              <>
                <h3 className="ax-section-title">Your decision</h3>
                <label className="ax-field">
                  <span>Status</span>
                  <select
                    className="ax-select"
                    style={{ width: "100%", height: 38 }}
                    value={status}
                    onChange={(e) => setStatus(e.target.value)}
                  >
                    {STATUSES.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="ax-field">
                  <span>Note to the citizen</span>
                  {NOTE_TEMPLATES[status] && (
                    <div className="ax-chips">
                      <button
                        type="button"
                        className="ax-chip-btn"
                        onClick={() => setNote(NOTE_TEMPLATES[status])}
                      >
                        Use a suggested note
                      </button>
                    </div>
                  )}
                  <textarea
                    className="ax-textarea"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="Explain what you found and what happens next…"
                  />
                </label>
              </>
            )}
            {!allowed && open.adminNote && (
              <>
                <h3 className="ax-section-title">Admin note</h3>
                <p style={{ fontSize: 13.5, color: "var(--ax-text-2)" }}>
                  {open.adminNote}
                </p>
              </>
            )}
          </>
        )}
      </SidePanel>

      {toast && (
        <div
          className={`ax-toast${toast.error ? " is-error" : ""}`}
          role="status"
        >
          {toast.msg}
        </div>
      )}
    </AdminLayout>
  );
};

export default DisputesList;
