import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Ban, Unlock, Trash2, ExternalLink } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import useAdminMe from "../../components/admin/useAdminMe";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import { adminAPI } from "../../services/api";
import { fmtDate, initials, fileUrl, STATUS_TONE, statusText } from "../../components/admin/helpers";

const isActive = (u) => u.isActive !== false;

const UsersList = () => {
  const { can, loaded } = useAdminMe();
  const allowed = can("moderate");
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const [users, setUsers] = useState([]);
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(params.get("open"));
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
      const [u, c] = await Promise.all([adminAPI.getUsers(), adminAPI.getCases().catch(() => null)]);
      setUsers(u.data.users || []);
      setCases(c?.data?.cases || []);
    } catch (e) {
      notify("Could not load citizens. Check that the server is running.", true);
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

  const casesOf = useMemo(() => {
    const m = {};
    cases.forEach((c) => {
      const id = c.userId?._id || c.userId;
      if (!id) return;
      (m[id] = m[id] || []).push(c);
    });
    return m;
  }, [cases]);

  const open = users.find((u) => u._id === openId) || null;
  const closePanel = () => {
    setOpenId(null);
    if (params.get("open")) {
      params.delete("open");
      setParams(params, { replace: true });
    }
  };

  const setStatus = async (rows, active) => {
    setBusy(true);
    try {
      for (const r of rows) await adminAPI.updateUserStatus(r._id, active);
      notify(`${rows.length > 1 ? `${rows.length} citizens` : rows[0].name} ${active ? "reactivated" : "deactivated"}.`);
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
      for (const r of rows) await adminAPI.deleteUser(r._id);
      notify(`${rows.length > 1 ? `${rows.length} citizens` : rows[0].name} deleted.`);
      setConfirm(null);
      closePanel();
      load();
    } catch (e) {
      notify("That didn't work. Please try again.", true);
    } finally {
      setBusy(false);
    }
  };

  const counts = {
    all: users.length,
    active: users.filter(isActive).length,
    inactive: users.filter((u) => !isActive(u)).length,
  };
  const tabs = [
    { key: "all", label: "All", count: counts.all },
    { key: "active", label: "Active", count: counts.active, filter: isActive },
    { key: "inactive", label: "Deactivated", count: counts.inactive, filter: (u) => !isActive(u) },
  ];

  const columns = [
    {
      key: "name",
      header: "Citizen",
      render: (u) => (
        <span className="ax-cell-main">
          {u.photo ? <img className="ax-avatar" src={fileUrl(u.photo)} alt="" /> : <span className="ax-avatar">{initials(u.name)}</span>}
          <span>
            <span className="ax-cell-title">{u.name}</span>
            <span className="ax-cell-sub">{u.email}</span>
          </span>
        </span>
      ),
      csv: (u) => u.name,
    },
    { key: "email", header: "Email", csv: (u) => u.email, hideInTable: true },
    { key: "phone", header: "Phone", render: (u) => u.phone || "—" },
    { key: "cnic", header: "CNIC", render: (u) => <span className="ax-mono">{u.cnic || "—"}</span> },
    { key: "cases", header: "Cases", sortValue: (u) => (casesOf[u._id] || []).length, render: (u) => (casesOf[u._id] || []).length, csv: (u) => (casesOf[u._id] || []).length },
    {
      key: "isActive",
      header: "Account",
      sortValue: (u) => (isActive(u) ? 1 : 0),
      render: (u) => <span className={`ax-pill ${isActive(u) ? "is-ok" : "is-bad"}`}>{isActive(u) ? "Active" : "Deactivated"}</span>,
      csv: (u) => (isActive(u) ? "active" : "deactivated"),
    },
    { key: "createdAt", header: "Joined", sortValue: (u) => new Date(u.createdAt).getTime(), render: (u) => fmtDate(u.createdAt), csv: (u) => fmtDate(u.createdAt) },
  ];

  const bulkActions = (rows, clear) => (
    <>
      <button type="button" className="ax-btn is-sm" onClick={() => setConfirm({ kind: "deactivate", rows, after: clear })}>
        <Ban size={14} /> Deactivate
      </button>
      <button type="button" className="ax-btn is-sm is-danger" onClick={() => setConfirm({ kind: "delete", rows, after: clear })}>
        <Trash2 size={14} /> Delete
      </button>
    </>
  );

  const COPY = {
    deactivate: (n) => ({ title: `Deactivate ${n}?`, body: "They will not be able to log in until reactivated. Their cases and messages are kept.", label: "Deactivate", danger: true }),
    reactivate: (n) => ({ title: `Reactivate ${n}?`, body: "They will be able to log in again.", label: "Reactivate", danger: false }),
    delete: (n) => ({ title: `Delete ${n} permanently?`, body: "The account is removed and cannot be restored. Deactivating is usually the safer choice.", label: "Delete permanently", danger: true }),
  };
  const copy = confirm ? COPY[confirm.kind](confirm.rows.length > 1 ? `${confirm.rows.length} citizens` : confirm.rows[0].name) : null;
  const runConfirm = async () => {
    const { kind, rows, after } = confirm;
    if (kind === "deactivate") await setStatus(rows, false);
    if (kind === "reactivate") await setStatus(rows, true);
    if (kind === "delete") await remove(rows);
    if (after) after();
  };

  const myCases = open ? casesOf[open._id] || [] : [];

  return (
    <AdminLayout breadcrumb="Citizens" activeNav="users">
      <div className="ax-head">
        <div>
          <h1>Citizens</h1>
          <p>People who use LegalLink to find advocates and legal aid.</p>
        </div>
      </div>

      {loaded && !allowed && <div className="ax-msg is-warn">Your role can view citizens but not deactivate or delete them.</div>}

      <DataTable
        rows={users}
        columns={columns}
        loading={loading}
        tabs={tabs}
        searchKeys={["name", "email", "phone", "cnic", "address"]}
        searchPlaceholder="Name, email, phone, CNIC…"
        onRowClick={(u) => setOpenId(u._id)}
        bulkActions={allowed ? bulkActions : undefined}
        exportName="citizens"
        emptyText="No citizens in this list."
        defaultSort={{ key: "createdAt", dir: "desc" }}
      />

      <SidePanel
        open={Boolean(open)}
        onClose={closePanel}
        title={open?.name}
        subtitle={open && `Citizen · joined ${fmtDate(open.createdAt)}`}
        footer={
          allowed && open && (
            <>
              <button type="button" className="ax-btn is-danger" onClick={() => setConfirm({ kind: "delete", rows: [open] })}>
                <Trash2 size={15} /> Delete
              </button>
              <span className="ax-spacer" />
              <button type="button" className="ax-btn" onClick={() => setConfirm({ kind: isActive(open) ? "deactivate" : "reactivate", rows: [open] })}>
                {isActive(open) ? <><Ban size={15} /> Deactivate</> : <><Unlock size={15} /> Reactivate</>}
              </button>
            </>
          )
        }
      >
        {open && (
          <>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 18 }}>
              {open.photo ? (
                <img className="ax-avatar" src={fileUrl(open.photo)} alt="" style={{ width: 56, height: 56 }} />
              ) : (
                <span className="ax-avatar" style={{ width: 56, height: 56, fontSize: 18 }}>{initials(open.name)}</span>
              )}
              <div>
                <span className={`ax-pill ${isActive(open) ? "is-ok" : "is-bad"}`}>{isActive(open) ? "Active" : "Deactivated"}</span>
                <div style={{ marginTop: 6, fontSize: 13, color: "var(--ax-muted)" }}>{open.email}</div>
              </div>
            </div>

            <h3 className="ax-section-title">Details</h3>
            <dl className="ax-dl">
              <dt>Phone</dt>
              <dd>{open.phone || "—"}</dd>
              <dt>CNIC</dt>
              <dd className="ax-mono">{open.cnic || "—"}</dd>
              <dt>Address</dt>
              <dd>{open.address || "—"}</dd>
              <dt>Signed up with</dt>
              <dd>{open.googleId ? "Google" : "Email and password"}</dd>
            </dl>

            <h3 className="ax-section-title">Cases ({myCases.length})</h3>
            {myCases.length === 0 ? (
              <p style={{ fontSize: 13.5, color: "var(--ax-muted)" }}>No cases filed yet.</p>
            ) : (
              <ul className="ax-queue" style={{ border: "1px solid var(--ax-border)", borderRadius: 10 }}>
                {myCases.map((c) => (
                  <li key={c._id}>
                    <span className="ax-queue-text">
                      <strong>{c.title}</strong>
                      <span>{c.category || "General"} · {c.lawyerId?.name ? `Adv. ${c.lawyerId.name.replace(/^adv\.?\s*/i, "")}` : "No advocate yet"} · {fmtDate(c.createdAt)}</span>
                    </span>
                    <span className={`ax-pill ${STATUS_TONE[c.status] || ""}`}>{statusText(c.status)}</span>
                    <button type="button" className="ax-btn is-sm" onClick={() => navigate(`/case/${c._id}`)} title="Open case file">
                      <ExternalLink size={13} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </SidePanel>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={copy?.title}
        body={copy?.body}
        confirmLabel={copy?.label}
        danger={copy?.danger}
        busy={busy}
        onConfirm={runConfirm}
        onCancel={() => setConfirm(null)}
      />
      {toast && <div className={`ax-toast${toast.error ? " is-error" : ""}`} role="status">{toast.msg}</div>}
    </AdminLayout>
  );
};

export default UsersList;
