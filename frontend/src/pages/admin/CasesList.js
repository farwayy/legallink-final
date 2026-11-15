import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import { adminAPI } from "../../services/api";
import { fmtDate, STATUS_TONE, statusText } from "../../components/admin/helpers";
import { getCaseStage, getHearings, getNextHearing } from "../../utils/caseStage";

const isProBono = (c) => c.caseType === "pro_bono" || Boolean(c.ngoId);
const STATUS_GROUPS = {
  pending: ["pending", "under_review"],
  active: ["assigned", "in_progress"],
  resolved: ["resolved", "closed"],
  rejected: ["rejected"],
};

const CasesList = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [type, setType] = useState("all");
  const [openId, setOpenId] = useState(params.get("open"));

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getCases();
      setCases(res.data.cases || []);
    } catch (e) {
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    const id = params.get("open");
    if (id) setOpenId(id);
  }, [params]);

  const rows = useMemo(() => (type === "all" ? cases : cases.filter((c) => (type === "pro_bono" ? isProBono(c) : !isProBono(c)))), [cases, type]);
  const inGroup = (g) => (c) => STATUS_GROUPS[g].includes(c.status);
  const tabs = [
    { key: "all", label: "All", count: rows.length },
    { key: "pending", label: "Pending", count: rows.filter(inGroup("pending")).length, filter: inGroup("pending") },
    { key: "active", label: "Active", count: rows.filter(inGroup("active")).length, filter: inGroup("active") },
    { key: "resolved", label: "Resolved", count: rows.filter(inGroup("resolved")).length, filter: inGroup("resolved") },
    { key: "rejected", label: "Rejected", count: rows.filter(inGroup("rejected")).length, filter: inGroup("rejected") },
  ];

  const columns = [
    {
      key: "title",
      header: "Case",
      render: (c) => (
        <span>
          <span className="ax-cell-title">{c.title}</span>
          <span className="ax-cell-sub ax-mono">#{String(c._id).slice(-6).toUpperCase()}</span>
        </span>
      ),
      csv: (c) => c.title,
    },
    { key: "ref", header: "Reference", csv: (c) => String(c._id).slice(-6).toUpperCase(), hideInTable: true },
    { key: "category", header: "Practice area", render: (c) => <span className="ax-tag">{c.category || "General"}</span> },
    { key: "type", header: "Type", sortValue: (c) => (isProBono(c) ? "Pro bono" : "Paid"), render: (c) => (isProBono(c) ? "Pro bono" : "Paid"), csv: (c) => (isProBono(c) ? "Pro bono" : "Paid") },
    { key: "client", header: "Citizen", sortValue: (c) => c.userId?.name || "", render: (c) => c.userId?.name || "—", csv: (c) => c.userId?.name || "" },
    {
      key: "counsel",
      header: "Advocate",
      sortValue: (c) => c.lawyerId?.name || "",
      render: (c) => (c.lawyerId?.name ? c.lawyerId.name : <span style={{ color: "var(--ax-muted)" }}>Not assigned</span>),
      csv: (c) => c.lawyerId?.name || "",
    },
    {
      key: "status",
      header: "Status",
      render: (c) => <span className={`ax-pill ${STATUS_TONE[c.status] || ""}`}>{statusText(c.status)}</span>,
      csv: (c) => c.status,
    },
    { key: "createdAt", header: "Filed", sortValue: (c) => new Date(c.createdAt).getTime(), render: (c) => fmtDate(c.createdAt), csv: (c) => fmtDate(c.createdAt) },
  ];

  const open = cases.find((c) => c._id === openId) || null;
  const closePanel = () => {
    setOpenId(null);
    if (params.get("open")) {
      params.delete("open");
      setParams(params, { replace: true });
    }
  };
  const stage = open ? getCaseStage(open) : null;
  const next = open ? getNextHearing(open) : null;

  return (
    <AdminLayout breadcrumb="Cases" activeNav="cases">
      <div className="ax-head">
        <div>
          <h1>Cases</h1>
          <p>Every paid and pro bono case on LegalLink.</p>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        tabs={tabs}
        searchKeys={["title", "category", "_id", (c) => c.userId?.name, (c) => c.lawyerId?.name]}
        searchPlaceholder="Title, reference, citizen, advocate…"
        onRowClick={(c) => setOpenId(c._id)}
        exportName="cases"
        emptyText="No cases in this list."
        defaultSort={{ key: "createdAt", dir: "desc" }}
        toolbarExtra={
          <select className="ax-select" value={type} onChange={(e) => setType(e.target.value)} aria-label="Case type">
            <option value="all">All types</option>
            <option value="paid">Paid</option>
            <option value="pro_bono">Pro bono</option>
          </select>
        }
      />

      <SidePanel
        open={Boolean(open)}
        onClose={closePanel}
        title={open?.title}
        subtitle={open && `#${String(open._id).slice(-6).toUpperCase()} · filed ${fmtDate(open.createdAt)}`}
        footer={
          open && (
            <>
              <span className="ax-spacer" />
              <button type="button" className="ax-btn is-primary" onClick={() => navigate(`/case/${open._id}`)}>
                <ExternalLink size={15} /> Open case file
              </button>
            </>
          )
        }
      >
        {open && (
          <>
            <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 18 }}>
              <span className={`ax-pill ${STATUS_TONE[open.status] || ""}`}>{statusText(open.status)}</span>
              <span className="ax-tag">{open.category || "General"}</span>
              <span className="ax-tag">{isProBono(open) ? "Pro bono" : "Paid"}</span>
              {open.priority && <span className="ax-tag">Priority: {open.priority}</span>}
            </div>

            <h3 className="ax-section-title">Progress</h3>
            <dl className="ax-dl">
              <dt>Stage</dt>
              <dd>Stage {stage.step} of 4 · {stage.title}</dd>
              <dt>Next hearing</dt>
              <dd>{next ? new Date(next.date).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "None scheduled"}</dd>
              <dt>Activity</dt>
              <dd>
                {getHearings(open).length} hearings · {(open.documents || []).length} documents · {(open.messages || []).length} messages
              </dd>
            </dl>

            <h3 className="ax-section-title">People</h3>
            <dl className="ax-dl">
              <dt>Citizen</dt>
              <dd>{open.userId?.name || "—"}{open.userId?.email ? ` · ${open.userId.email}` : ""}</dd>
              <dt>Advocate</dt>
              <dd>{open.lawyerId?.name ? `${open.lawyerId.name}${open.lawyerId.email ? ` · ${open.lawyerId.email}` : ""}` : "Not assigned"}</dd>
              {isProBono(open) && (
                <>
                  <dt>Legal aid NGO</dt>
                  <dd>{open.ngoId?.name || "Assigned NGO"}</dd>
                </>
              )}
            </dl>

            {open.description && (
              <>
                <h3 className="ax-section-title">Description</h3>
                <p style={{ fontSize: 13.5, lineHeight: 1.6, color: "var(--ax-text-2)", whiteSpace: "pre-line" }}>{open.description}</p>
              </>
            )}
          </>
        )}
      </SidePanel>
    </AdminLayout>
  );
};

export default CasesList;
