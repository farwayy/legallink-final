import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { User, KeyRound, Users, Eye, EyeOff, UserPlus, Copy, Check, Minus, Send, Ban, Unlock, X } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import useAdminMe, { ROLE_LABELS, ROLE_HELP, refreshAdminMe } from "../../components/admin/useAdminMe";
import { adminAPI } from "../../services/api";
import { fmtDate, initials } from "../../components/admin/helpers";

const TABS = [
  { key: "profile", label: "Profile", icon: User },
  { key: "security", label: "Password & security", icon: KeyRound },
  { key: "team", label: "Admin team", icon: Users },
];

const ROLES = ["super_admin", "verifier", "moderator"];

// What each role can do (matches backend utils/adminPermissions.js)
const MATRIX = [
  { label: "View every admin page", roles: ["super_admin", "verifier", "moderator"] },
  { label: "Approve, reject and block advocates and NGOs", roles: ["super_admin", "verifier"] },
  { label: "Deactivate or delete citizens", roles: ["super_admin", "moderator"] },
  { label: "Decide disputes, keep or remove reviews", roles: ["super_admin", "moderator"] },
  { label: "Publish announcements", roles: ["super_admin", "moderator"] },
  { label: "Invite and manage admins", roles: ["super_admin"] },
];

const STATUS_PILL = {
  active: { tone: "is-ok", text: "Active" },
  invited: { tone: "is-warn", text: "Invited" },
  deactivated: { tone: "is-bad", text: "Deactivated" },
};

const strength = (pw) => {
  let n = 0;
  if (pw.length >= 8) n += 1;
  if (/[A-Za-z]/.test(pw) && /\d/.test(pw)) n += 1;
  if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) n += 1;
  if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) n += 1;
  return n;
};
const pwOk = (pw) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

const fmtTime = (d) =>
  d ? new Date(d).toLocaleString("en-PK", { day: "numeric", month: "short", year: "numeric", hour: "numeric", minute: "2-digit" }) : "Never";

const PasswordInput = ({ value, onChange, autoComplete, id }) => {
  const [show, setShow] = useState(false);
  return (
    <div className="ax-pw">
      <input id={id} className="ax-input" type={show ? "text" : "password"} value={value} onChange={onChange} autoComplete={autoComplete} />
      <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
        {show ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
};

// ── Profile ─────────────────────────────────────────────────────────────
const ProfileTab = ({ me, notify }) => {
  const [name, setName] = useState(me?.name || "");
  const [busy, setBusy] = useState(false);
  useEffect(() => setName(me?.name || ""), [me]);

  const save = async (e) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminAPI.updateMe({ name: name.trim() });
      try {
        const saved = JSON.parse(localStorage.getItem("user") || "{}");
        localStorage.setItem("user", JSON.stringify({ ...saved, name: name.trim() }));
      } catch (err) {
        /* ignore */
      }
      await refreshAdminMe();
      notify("Profile saved.");
    } catch (err) {
      notify(err.response?.data?.message || "Could not save your profile.", true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section className="ax-panel">
      <div className="ax-panel-head">
        <h2>Profile</h2>
      </div>
      <form className="ax-panel-body" onSubmit={save}>
        <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 20 }}>
          <span className="ax-avatar" style={{ width: 52, height: 52, fontSize: 17 }}>{initials(me?.name || "A")}</span>
          <div>
            <strong style={{ display: "block", fontSize: 15 }}>{me?.name}</strong>
            <span className="ax-role-chip" style={{ marginTop: 4 }}>{ROLE_LABELS[me?.role] || "Admin"}</span>
          </div>
        </div>
        <div className="ax-form-row">
          <label className="ax-field">
            <span>Full name</span>
            <input className="ax-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
          </label>
          <label className="ax-field">
            <span>Email</span>
            <input className="ax-input" value={me?.email || ""} readOnly />
          </label>
        </div>
        <p className="ax-hint">Your email is your sign-in. To change it, ask a super admin to invite your new address.</p>
        <dl className="ax-dl">
          <dt>Role</dt>
          <dd>{ROLE_LABELS[me?.role]} · {ROLE_HELP[me?.role]}</dd>
          <dt>Last sign-in</dt>
          <dd>{fmtTime(me?.lastLoginAt)}</dd>
          <dt>Admin since</dt>
          <dd>{fmtDate(me?.createdAt)}</dd>
        </dl>
        <div className="ax-form-foot">
          <button type="submit" className="ax-btn is-primary" disabled={busy || name.trim().length < 2 || name.trim() === me?.name} aria-busy={busy}>
            {busy && <span className="btn-spinner" />} Save changes
          </button>
        </div>
      </form>
    </section>
  );
};

// ── Password & security ─────────────────────────────────────────────────
const SecurityTab = ({ me, notify }) => {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState(null);

  const score = strength(next);
  const mismatch = confirm && next !== confirm;
  const ready = current && pwOk(next) && next === confirm;

  const save = async (e) => {
    e.preventDefault();
    if (!ready) return;
    setBusy(true);
    setMsg(null);
    try {
      const res = await adminAPI.changePassword(current, next);
      if (res.data.token) localStorage.setItem("token", res.data.token);
      setCurrent("");
      setNext("");
      setConfirm("");
      setMsg({ ok: true, text: res.data.message });
      notify("Password changed.");
    } catch (err) {
      setMsg({ ok: false, text: err.response?.data?.message || "Could not change your password." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <section className="ax-panel">
        <div className="ax-panel-head">
          <h2>Change password</h2>
        </div>
        <form className="ax-panel-body" onSubmit={save} style={{ maxWidth: 460 }}>
          {msg && <div className={`ax-msg ${msg.ok ? "is-ok" : "is-bad"}`} role="status">{msg.text}</div>}
          <label className="ax-field" htmlFor="pw-current">
            <span>Current password</span>
          </label>
          <div className="ax-field" style={{ marginTop: -8 }}>
            <PasswordInput id="pw-current" value={current} onChange={(e) => setCurrent(e.target.value)} autoComplete="current-password" />
          </div>
          <label className="ax-field" htmlFor="pw-new">
            <span>New password</span>
          </label>
          <div className="ax-field" style={{ marginTop: -8 }}>
            <PasswordInput id="pw-new" value={next} onChange={(e) => setNext(e.target.value)} autoComplete="new-password" />
          </div>
          {next && (
            <div className={`ax-strength${score < 2 ? " is-weak" : ""}`} aria-hidden="true">
              {[0, 1, 2, 3].map((i) => <i key={i} className={i < score ? "is-on" : ""} />)}
            </div>
          )}
          <p className="ax-hint">At least 8 characters, with a letter and a number.</p>
          <label className="ax-field" htmlFor="pw-confirm">
            <span>Confirm new password</span>
          </label>
          <div className="ax-field" style={{ marginTop: -8 }}>
            <PasswordInput id="pw-confirm" value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" />
          </div>
          {mismatch && <p className="ax-hint" style={{ color: "var(--ax-bad)" }}>The two passwords don't match.</p>}
          <div className="ax-form-foot" style={{ justifyContent: "flex-start" }}>
            <button type="submit" className="ax-btn is-primary" disabled={!ready || busy} aria-busy={busy}>
              {busy && <span className="btn-spinner" />} Change password
            </button>
          </div>
        </form>
      </section>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <h2>Sign-in protection</h2>
        </div>
        <div className="ax-panel-body">
          <dl className="ax-dl" style={{ marginBottom: 0 }}>
            <dt>Wrong passwords</dt>
            <dd>After 5 wrong passwords in a row, sign-in is locked for 15 minutes.</dd>
            <dt>Other sessions</dt>
            <dd>Changing your password signs you out everywhere else.</dd>
            <dt>Deactivation</dt>
            <dd>A deactivated admin is signed out on their next action.</dd>
            <dt>Last sign-in</dt>
            <dd>{fmtTime(me?.lastLoginAt)}</dd>
          </dl>
        </div>
      </section>
    </>
  );
};

// ── Admin team ──────────────────────────────────────────────────────────
const TeamTab = ({ me, canManage, notify }) => {
  const [admins, setAdmins] = useState([]);
  const [loading, setLoading] = useState(true);
  const [inviteOpen, setInviteOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("verifier");
  const [busy, setBusy] = useState(false);
  const [inviteErr, setInviteErr] = useState("");
  const [link, setLink] = useState(null); // { url, emailSent, email }
  const [copied, setCopied] = useState(false);
  const [openId, setOpenId] = useState(null);
  const [panelRole, setPanelRole] = useState("");
  const [confirm, setConfirm] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await adminAPI.getTeam();
      setAdmins(res.data.admins || []);
    } catch (e) {
      notify("Could not load the admin team.", true);
    } finally {
      setLoading(false);
    }
  }, [notify]);

  useEffect(() => {
    load();
  }, [load]);

  const open = admins.find((a) => a._id === openId) || null;
  useEffect(() => {
    if (open) setPanelRole(open.role);
  }, [openId]); // eslint-disable-line

  const isSelf = (a) => a && me && String(a._id) === String(me._id);
  const activeSupers = admins.filter((a) => a.role === "super_admin" && a.status === "active").length;
  const isLastSuper = (a) => a && a.role === "super_admin" && a.status === "active" && activeSupers <= 1;

  const resetInvite = () => {
    setEmail("");
    setRole("verifier");
    setInviteErr("");
    setLink(null);
    setCopied(false);
  };

  const sendInvite = async (e) => {
    e.preventDefault();
    setBusy(true);
    setInviteErr("");
    try {
      const res = await adminAPI.inviteAdmin(email.trim(), role);
      // The panel itself shows the result, so no toast here
      setLink({ url: res.data.inviteLink, emailSent: res.data.emailSent, email: email.trim() });
      load();
    } catch (err) {
      setInviteErr(err.response?.data?.message || "Could not send the invitation.");
    } finally {
      setBusy(false);
    }
  };

  const copy = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (e) {
      window.prompt("Copy this invitation link:", url);
    }
  };

  const act = async (fn, okMsg, after) => {
    setBusy(true);
    try {
      const res = await fn();
      notify(okMsg || res.data.message);
      setConfirm(null);
      if (after) after(res);
      load();
    } catch (err) {
      notify(err.response?.data?.message || "That didn't work. Please try again.", true);
      setConfirm(null);
    } finally {
      setBusy(false);
    }
  };

  const columns = [
    {
      key: "name",
      header: "Admin",
      sortValue: (a) => a.name || a.email,
      render: (a) => (
        <span className="ax-cell-main">
          <span className="ax-avatar">{initials(a.name || a.email)}</span>
          <span>
            <span className="ax-cell-title">
              {a.name || <em style={{ fontWeight: 500, color: "var(--ax-muted)" }}>Waiting for them to accept</em>}
              {isSelf(a) && <span className="ax-role-chip" style={{ marginLeft: 8, marginTop: 0 }}>You</span>}
            </span>
            <span className="ax-cell-sub">{a.email}</span>
          </span>
        </span>
      ),
      csv: (a) => a.name,
    },
    { key: "email", header: "Email", hideInTable: true },
    { key: "role", header: "Role", sortValue: (a) => ROLE_LABELS[a.role], render: (a) => ROLE_LABELS[a.role] || a.role, csv: (a) => ROLE_LABELS[a.role] },
    {
      key: "status",
      header: "Status",
      render: (a) => {
        const expired = a.status === "invited" && a.inviteExpires && new Date(a.inviteExpires) < new Date();
        const p = expired ? { tone: "is-bad", text: "Invite expired" } : STATUS_PILL[a.status] || STATUS_PILL.active;
        return <span className={`ax-pill ${p.tone}`}>{p.text}</span>;
      },
      csv: (a) => a.status,
    },
    {
      key: "lastLoginAt",
      header: "Last sign-in",
      sortValue: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).getTime() : 0),
      render: (a) => (a.status === "invited" ? `Invited ${fmtDate(a.invitedAt)}` : fmtTime(a.lastLoginAt)),
      csv: (a) => (a.lastLoginAt ? new Date(a.lastLoginAt).toISOString() : ""),
    },
  ];

  const tabs = [
    { key: "all", label: "All", count: admins.length },
    { key: "active", label: "Active", count: admins.filter((a) => a.status === "active").length, filter: (a) => a.status === "active" },
    { key: "invited", label: "Invited", count: admins.filter((a) => a.status === "invited").length, filter: (a) => a.status === "invited" },
    { key: "deactivated", label: "Deactivated", count: admins.filter((a) => a.status === "deactivated").length, filter: (a) => a.status === "deactivated" },
  ];

  const panelFooter = open && canManage && !isSelf(open) && (
    <>
      {open.status === "invited" ? (
        <button type="button" className="ax-btn is-danger" onClick={() => setConfirm({ kind: "revoke" })}>
          <X size={15} /> Cancel invitation
        </button>
      ) : open.status === "active" ? (
        <button type="button" className="ax-btn is-danger" disabled={isLastSuper(open)} title={isLastSuper(open) ? "LegalLink needs at least one active super admin" : ""} onClick={() => setConfirm({ kind: "deactivate" })}>
          <Ban size={15} /> Deactivate
        </button>
      ) : (
        <button type="button" className="ax-btn" onClick={() => act(() => adminAPI.updateAdmin(open._id, { status: "active" }), `${open.name || open.email} reactivated.`)}>
          <Unlock size={15} /> Reactivate
        </button>
      )}
      <span className="ax-spacer" />
      {open.status === "invited" && (
        <button
          type="button"
          className="ax-btn"
          disabled={busy}
          onClick={() => act(() => adminAPI.resendInvite(open._id), null, (res) => setLink({ url: res.data.inviteLink, emailSent: res.data.emailSent, email: open.email, inPanel: true }))}
        >
          <Send size={15} /> Send again
        </button>
      )}
      <button
        type="button"
        className="ax-btn is-primary"
        disabled={busy || panelRole === open.role || (isLastSuper(open) && panelRole !== "super_admin")}
        onClick={() => setConfirm({ kind: "role" })}
      >
        Save role
      </button>
    </>
  );

  const CONFIRM = {
    revoke: {
      title: `Cancel the invitation to ${open?.email}?`,
      body: "The link they were sent will stop working. You can invite them again later.",
      label: "Cancel invitation",
      danger: true,
      run: () => act(() => adminAPI.revokeInvite(open._id), "Invitation cancelled.", () => setOpenId(null)),
    },
    deactivate: {
      title: `Deactivate ${open?.name || open?.email}?`,
      body: "They are signed out straight away and can't sign in until reactivated. Everything they did stays in the audit log.",
      label: "Deactivate",
      danger: true,
      run: () => act(() => adminAPI.updateAdmin(open._id, { status: "deactivated" }), `${open?.name || open?.email} deactivated.`),
    },
    role: {
      title: `Make ${open?.name || open?.email} a ${ROLE_LABELS[panelRole]}?`,
      body: ROLE_HELP[panelRole],
      label: "Change role",
      danger: false,
      run: () => act(() => adminAPI.updateAdmin(open._id, { role: panelRole }), "Role changed."),
    },
  };
  const c = confirm ? CONFIRM[confirm.kind] : null;

  return (
    <>
      <section className="ax-panel">
        <div className="ax-panel-head">
          <div>
            <h2>Admin team</h2>
            <span>Everyone who can sign in to this console.</span>
          </div>
          {canManage && (
            <button type="button" className="ax-btn is-primary" onClick={() => { resetInvite(); setInviteOpen(true); }}>
              <UserPlus size={15} /> Invite admin
            </button>
          )}
        </div>
        {!canManage && (
          <div className="ax-panel-body" style={{ paddingBottom: 0 }}>
            <div className="ax-msg is-warn" style={{ marginBottom: 0 }}>Only super admins can invite or change admins.</div>
          </div>
        )}
        <div style={{ padding: "4px 0 0" }}>
          <DataTable
            rows={admins}
            columns={columns}
            loading={loading}
            tabs={tabs}
            searchKeys={["name", "email", (a) => ROLE_LABELS[a.role]]}
            searchPlaceholder="Name or email…"
            onRowClick={(a) => { setLink(null); setOpenId(a._id); }}
            exportName="admin-team"
            emptyText="No admins in this list."
            defaultSort={{ key: "name", dir: "asc" }}
          />
        </div>
      </section>

      <section className="ax-panel">
        <div className="ax-panel-head">
          <h2>What each role can do</h2>
        </div>
        <div className="ax-panel-body" style={{ padding: 0, overflowX: "auto" }}>
          <table className="ax-matrix">
            <thead>
              <tr>
                <th>Action</th>
                {ROLES.map((r) => <th key={r}>{ROLE_LABELS[r]}</th>)}
              </tr>
            </thead>
            <tbody>
              {MATRIX.map((m) => (
                <tr key={m.label}>
                  <td>{m.label}</td>
                  {ROLES.map((r) => (
                    <td key={r} aria-label={m.roles.includes(r) ? "Yes" : "No"}>
                      {m.roles.includes(r) ? <Check size={16} className="ax-yes" /> : <Minus size={16} className="ax-no" />}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Invite */}
      <SidePanel
        open={inviteOpen}
        onClose={() => setInviteOpen(false)}
        title={link ? "Invitation ready" : "Invite an admin"}
        subtitle={link ? link.email : "They'll get an email with a link to set their own name and password."}
        footer={
          link ? (
            <>
              <button type="button" className="ax-btn" onClick={resetInvite}>Invite someone else</button>
              <span className="ax-spacer" />
              <button type="button" className="ax-btn is-primary" onClick={() => setInviteOpen(false)}>Done</button>
            </>
          ) : (
            <>
              <span className="ax-spacer" />
              <button type="submit" form="invite-form" className="ax-btn is-primary" disabled={busy || !email.trim()} aria-busy={busy}>
                {busy && <span className="btn-spinner" />}
                <Send size={15} /> Send invitation
              </button>
            </>
          )
        }
      >
        {link ? (
          <>
            <div className={`ax-msg ${link.emailSent ? "is-ok" : "is-warn"}`}>
              {link.emailSent
                ? `We emailed ${link.email} a link to join. It works once and expires in 48 hours.`
                : `The email couldn't be sent. Copy this link and send it to ${link.email} yourself. It works once and expires in 48 hours.`}
            </div>
            <div className="ax-linkbox">
              <code>{link.url}</code>
              <button type="button" className="ax-btn is-sm" onClick={() => copy(link.url)}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
              </button>
            </div>
            <p className="ax-hint" style={{ margin: 0 }}>Only share this link with the person you invited. Anyone with it can create this admin account.</p>
          </>
        ) : (
          <form id="invite-form" onSubmit={sendInvite}>
            {inviteErr && <div className="ax-msg is-bad">{inviteErr}</div>}
            <label className="ax-field">
              <span>Work email</span>
              <input className="ax-input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="name@legallink.com" autoFocus required />
            </label>
            <div className="ax-field">
              <span>Role</span>
            </div>
            <div className="ax-roles" role="radiogroup" aria-label="Role">
              {ROLES.map((r) => (
                <label key={r} className={`ax-role${role === r ? " is-on" : ""}`}>
                  <input type="radio" name="invite-role" value={r} checked={role === r} onChange={() => setRole(r)} />
                  <span>
                    <strong>{ROLE_LABELS[r]}</strong>
                    <span>{ROLE_HELP[r]}</span>
                  </span>
                </label>
              ))}
            </div>
            <p className="ax-hint" style={{ margin: 0 }}>Give people the smallest role that lets them do their job. You can change it later.</p>
          </form>
        )}
      </SidePanel>

      {/* Details */}
      <SidePanel
        open={Boolean(open) && !inviteOpen}
        onClose={() => setOpenId(null)}
        title={open ? open.name || open.email : ""}
        subtitle={open && (open.name ? open.email : "Invitation not accepted yet")}
        footer={panelFooter}
      >
        {open && (
          <>
            {(() => {
              const p = STATUS_PILL[open.status] || STATUS_PILL.active;
              return <span className={`ax-pill ${p.tone}`}>{p.text}</span>;
            })()}
            <dl className="ax-dl" style={{ marginTop: 16 }}>
              {open.status === "invited" ? (
                <>
                  <dt>Invited by</dt>
                  <dd>{open.invitedBy || "—"}</dd>
                  <dt>Invited on</dt>
                  <dd>{fmtTime(open.invitedAt)}</dd>
                  <dt>Link expires</dt>
                  <dd>{new Date(open.inviteExpires) < new Date() ? <span style={{ color: "var(--ax-bad)" }}>Expired. Send it again.</span> : fmtTime(open.inviteExpires)}</dd>
                </>
              ) : (
                <>
                  <dt>Last sign-in</dt>
                  <dd>{fmtTime(open.lastLoginAt)}</dd>
                  <dt>Admin since</dt>
                  <dd>{fmtDate(open.createdAt)}</dd>
                  {open.invitedBy && (
                    <>
                      <dt>Invited by</dt>
                      <dd>{open.invitedBy}</dd>
                    </>
                  )}
                </>
              )}
            </dl>

            {link?.inPanel && (
              <>
                <div className={`ax-msg ${link.emailSent ? "is-ok" : "is-warn"}`}>
                  {link.emailSent ? "A new invitation email was sent." : "The email couldn't be sent. Copy the new link below."}
                </div>
                <div className="ax-linkbox">
                  <code>{link.url}</code>
                  <button type="button" className="ax-btn is-sm" onClick={() => copy(link.url)}>
                    {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy link</>}
                  </button>
                </div>
              </>
            )}

            <h3 className="ax-section-title">Role</h3>
            {canManage && !isSelf(open) ? (
              <>
                <div className="ax-roles" role="radiogroup" aria-label="Role">
                  {ROLES.map((r) => (
                    <label key={r} className={`ax-role${panelRole === r ? " is-on" : ""}`}>
                      <input type="radio" name="panel-role" value={r} checked={panelRole === r} onChange={() => setPanelRole(r)} />
                      <span>
                        <strong>{ROLE_LABELS[r]}</strong>
                        <span>{ROLE_HELP[r]}</span>
                      </span>
                    </label>
                  ))}
                </div>
                {isLastSuper(open) && <p className="ax-hint">This is the only active super admin, so their role can't be lowered and they can't be deactivated.</p>}
              </>
            ) : (
              <p style={{ fontSize: 13.5, color: "var(--ax-text-2)" }}>
                <strong>{ROLE_LABELS[open.role]}</strong>. {ROLE_HELP[open.role]}
                {isSelf(open) && canManage && <><br /><span style={{ color: "var(--ax-muted)" }}>You can't change your own role or deactivate yourself.</span></>}
              </p>
            )}
          </>
        )}
      </SidePanel>

      <ConfirmDialog
        open={Boolean(c)}
        title={c?.title}
        body={c?.body}
        confirmLabel={c?.label}
        danger={c?.danger}
        busy={busy}
        onConfirm={() => c.run()}
        onCancel={() => setConfirm(null)}
      />
    </>
  );
};

const Settings = () => {
  const [params, setParams] = useSearchParams();
  const tab = TABS.some((t) => t.key === params.get("tab")) ? params.get("tab") : "profile";
  const { me, can } = useAdminMe();
  const [toast, setToast] = useState(null);

  const notify = useCallback((msg, error = false) => {
    setToast({ msg, error });
    setTimeout(() => setToast(null), 3500);
  }, []);

  const setTab = (key) => setParams(key === "profile" ? {} : { tab: key }, { replace: true });
  const title = useMemo(() => TABS.find((t) => t.key === tab)?.label, [tab]);

  return (
    <AdminLayout breadcrumb={`Settings · ${title}`} activeNav="settings">
      <div className="ax-head">
        <div>
          <h1>Settings</h1>
          <p>Your account, your password and the people who run LegalLink.</p>
        </div>
      </div>

      <div className="ax-settings">
        <nav className="ax-settings-tabs" aria-label="Settings sections">
          {TABS.map((t) => (
            <button key={t.key} type="button" className={tab === t.key ? "is-on" : ""} onClick={() => setTab(t.key)} aria-current={tab === t.key ? "page" : undefined}>
              <t.icon size={16} /> {t.label}
            </button>
          ))}
        </nav>
        <div className="ax-settings-body">
          {tab === "profile" && <ProfileTab me={me} notify={notify} />}
          {tab === "security" && <SecurityTab me={me} notify={notify} />}
          {tab === "team" && <TeamTab me={me} canManage={can("team")} notify={notify} />}
        </div>
      </div>

      {toast && <div className={`ax-toast${toast.error ? " is-error" : ""}`} role="status">{toast.msg}</div>}
    </AdminLayout>
  );
};

export default Settings;
