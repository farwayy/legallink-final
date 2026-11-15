import React, { useCallback, useEffect, useMemo, useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import { adminAPI } from "../../services/api";

// Plain-language names for every recorded action
export const ACTION_LABELS = {
  APPROVE_LAWYER: "Approved advocate",
  REJECT_LAWYER: "Rejected advocate",
  BLOCK_LAWYER: "Blocked advocate",
  UNBLOCK_LAWYER: "Unblocked advocate",
  DELETE_LAWYER: "Deleted advocate",
  REQUEST_INFO_LAWYER: "Asked advocate for more information",
  APPROVE_NGO: "Accredited NGO",
  REJECT_NGO: "Rejected NGO",
  BLOCK_NGO: "Suspended NGO",
  UNBLOCK_NGO: "Reactivated NGO",
  REQUEST_INFO_NGO: "Asked NGO for more information",
  BLOCK_USER: "Deactivated citizen",
  UNBLOCK_USER: "Reactivated citizen",
  DELETE_USER: "Deleted citizen",
  DELETE_REVIEW: "Removed review",
  DISMISS_FLAG: "Kept reported review",
  CLOSE_DISPUTE: "Resolved dispute",
  REJECT_DISPUTE: "Dismissed dispute",
  UPDATE_DISPUTE: "Updated dispute",
  INVITE_ADMIN: "Invited admin",
  ACCEPT_INVITE: "Joined the admin team",
  REVOKE_INVITE: "Cancelled admin invitation",
  UPDATE_ADMIN: "Changed admin role",
  DEACTIVATE_ADMIN: "Deactivated admin",
  REACTIVATE_ADMIN: "Reactivated admin",
  CHANGE_PASSWORD: "Changed own password",
  CREATE_ANNOUNCEMENT: "Published announcement",
  UPDATE_ANNOUNCEMENT: "Edited announcement",
  DELETE_ANNOUNCEMENT: "Deleted announcement",
  SYSTEM: "System event",
};

const TARGET_LABELS = { Lawyer: "Advocate", NGO: "NGO", User: "Citizen", Review: "Review", Dispute: "Dispute", Admin: "Admin", Announcement: "Announcement", System: "System" };

const fmtTime = (d) =>
  new Date(d).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" });

const AuditLog = () => {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [admin, setAdmin] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 1000 };
      if (from) params.from = from;
      if (to) params.to = `${to}T23:59:59`;
      const res = await adminAPI.getAuditLogs(params);
      setLogs(res.data.logs || []);
    } catch (e) {
      setLogs([]);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    load();
  }, [load]);

  const admins = useMemo(() => [...new Set(logs.map((l) => l.adminEmail).filter(Boolean))].sort(), [logs]);
  const rows = admin === "all" ? logs : logs.filter((l) => l.adminEmail === admin);

  const group = (types) => (l) => types.includes(l.targetType);
  const tabs = [
    { key: "all", label: "All", count: rows.length },
    { key: "verification", label: "Verification", count: rows.filter(group(["Lawyer", "NGO"])).length, filter: group(["Lawyer", "NGO"]) },
    { key: "people", label: "Citizens", count: rows.filter(group(["User"])).length, filter: group(["User"]) },
    { key: "moderation", label: "Moderation", count: rows.filter(group(["Review", "Dispute"])).length, filter: group(["Review", "Dispute"]) },
    { key: "system", label: "Admins & system", count: rows.filter(group(["Admin", "Announcement", "System"])).length, filter: group(["Admin", "Announcement", "System"]) },
  ];

  const columns = [
    { key: "createdAt", header: "When", sortValue: (l) => new Date(l.createdAt).getTime(), render: (l) => <span style={{ whiteSpace: "nowrap" }}>{fmtTime(l.createdAt)}</span>, csv: (l) => new Date(l.createdAt).toISOString() },
    {
      key: "adminEmail",
      header: "Admin",
      render: (l) => (l.adminEmail && !["unknown", "system"].includes(l.adminEmail) ? l.adminEmail : <span style={{ color: "var(--ax-muted)" }}>Not recorded</span>),
    },
    { key: "action", header: "Action", sortValue: (l) => ACTION_LABELS[l.action] || l.action, render: (l) => <span style={{ whiteSpace: "nowrap" }}>{ACTION_LABELS[l.action] || l.action}</span>, csv: (l) => ACTION_LABELS[l.action] || l.action },
    {
      key: "target",
      header: "On",
      sortValue: (l) => l.targetName || "",
      render: (l) => (
        <span>
          <span className="ax-cell-title" style={{ fontWeight: 500 }}>{l.targetName || "—"}</span>
          <span className="ax-cell-sub">{TARGET_LABELS[l.targetType] || l.targetType}</span>
        </span>
      ),
      csv: (l) => `${TARGET_LABELS[l.targetType] || l.targetType}: ${l.targetName || ""}`,
    },
    {
      key: "detail",
      header: "Details",
      sortable: false,
      render: (l) => (
        <span style={{ display: "block", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "var(--ax-muted)" }} title={l.detail}>
          {l.detail || "—"}
        </span>
      ),
      csv: (l) => l.detail || "",
    },
  ];

  const open = logs.find((l) => l._id === openId) || null;

  return (
    <AdminLayout breadcrumb="Audit log" activeNav="audit-log">
      <div className="ax-head">
        <div>
          <h1>Audit log</h1>
          <p>A permanent record of every action taken by an admin. Entries can't be edited or deleted.</p>
        </div>
      </div>

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        tabs={tabs}
        searchKeys={["adminEmail", "targetName", "detail", (l) => ACTION_LABELS[l.action] || l.action]}
        searchPlaceholder="Admin, person, action, details…"
        onRowClick={(l) => setOpenId(l._id)}
        exportName="audit-log"
        emptyText="No admin actions recorded for these filters."
        defaultSort={{ key: "createdAt", dir: "desc" }}
        toolbarExtra={
          <>
            <select className="ax-select" value={admin} onChange={(e) => setAdmin(e.target.value)} aria-label="Admin">
              <option value="all">All admins</option>
              {admins.map((a) => (
                <option key={a} value={a}>{a === "unknown" ? "Not recorded" : a}</option>
              ))}
            </select>
            <input type="date" className="ax-select" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="From date" title="From" />
            <input type="date" className="ax-select" value={to} onChange={(e) => setTo(e.target.value)} aria-label="To date" title="To" />
            {(from || to || admin !== "all") && (
              <button type="button" className="ax-btn is-sm is-ghost" onClick={() => { setFrom(""); setTo(""); setAdmin("all"); }}>
                Clear filters
              </button>
            )}
          </>
        }
      />

      <SidePanel open={Boolean(open)} onClose={() => setOpenId(null)} title={open ? ACTION_LABELS[open.action] || open.action : ""} subtitle={open && fmtTime(open.createdAt)}>
        {open && (
          <dl className="ax-dl">
            <dt>Admin</dt>
            <dd>{open.adminEmail && open.adminEmail !== "unknown" ? open.adminEmail : "Not recorded"}</dd>
            <dt>On</dt>
            <dd>{TARGET_LABELS[open.targetType] || open.targetType}: {open.targetName || "—"}</dd>
            <dt>Record ID</dt>
            <dd className="ax-mono">{open.targetId || "—"}</dd>
            <dt>Details</dt>
            <dd style={{ whiteSpace: "pre-line" }}>{open.detail || "—"}</dd>
            <dt>Entry ID</dt>
            <dd className="ax-mono">{open._id}</dd>
          </dl>
        )}
      </SidePanel>
    </AdminLayout>
  );
};

export default AuditLog;
