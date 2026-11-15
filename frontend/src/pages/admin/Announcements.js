import React, { useCallback, useEffect, useState } from "react";
import { Plus, Trash2, Power } from "lucide-react";
import AdminLayout from "../../components/AdminLayout";
import DataTable from "../../components/admin/DataTable";
import SidePanel from "../../components/admin/SidePanel";
import ConfirmDialog from "../../components/admin/ConfirmDialog";
import useAdminMe from "../../components/admin/useAdminMe";
import { AnnouncementItem } from "../../components/ui/AnnouncementBanner";
import { adminAPI } from "../../services/api";
import { fmtDate } from "../../components/admin/helpers";

const AUDIENCES = [
  { key: "user", label: "Citizens" },
  { key: "lawyer", label: "Advocates" },
  { key: "ngo", label: "NGOs" },
];
const TONES = [
  { key: "info", label: "Information" },
  { key: "warning", label: "Warning" },
  { key: "success", label: "Good news" },
];

// <input type="datetime-local"> wants local time without a zone
const toLocalInput = (d) => {
  if (!d) return "";
  const x = new Date(d);
  const off = x.getTimezoneOffset();
  return new Date(x.getTime() - off * 60000).toISOString().slice(0, 16);
};

const statusOf = (a, now = new Date()) => {
  if (!a.isActive) return { key: "off", text: "Turned off", tone: "" };
  if (a.endsAt && new Date(a.endsAt) <= now) return { key: "ended", text: "Ended", tone: "" };
  if (a.startsAt && new Date(a.startsAt) > now) return { key: "scheduled", text: "Scheduled", tone: "is-info" };
  return { key: "live", text: "Live", tone: "is-ok" };
};

const EMPTY = { title: "", message: "", audience: ["user", "lawyer", "ngo"], tone: "info", linkUrl: "", linkText: "", startsAt: "", endsAt: "" };

const Announcements = () => {
  const { can, loaded } = useAdminMe();
  const canEdit = can("announce");
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // null | "new" | id
  const [form, setForm] = useState(EMPTY);
  const [err, setErr] = useState("");
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
      const res = await adminAPI.getAnnouncements();
      setRows(res.data.announcements || []);
    } catch (e) {
      notify("Could not load announcements.", true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const current = editing && editing !== "new" ? rows.find((r) => r._id === editing) : null;

  const openNew = () => {
    setForm(EMPTY);
    setErr("");
    setEditing("new");
  };
  const openEdit = (a) => {
    setForm({
      title: a.title,
      message: a.message || "",
      audience: a.audience || [],
      tone: a.tone || "info",
      linkUrl: a.linkUrl || "",
      linkText: a.linkText || "",
      startsAt: toLocalInput(a.startsAt),
      endsAt: toLocalInput(a.endsAt),
    });
    setErr("");
    setEditing(a._id);
  };

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));
  const toggleAudience = (key) =>
    setForm((f) => ({ ...f, audience: f.audience.includes(key) ? f.audience.filter((x) => x !== key) : [...f.audience, key] }));

  const validate = () => {
    if (!form.title.trim()) return "Add a title.";
    if (form.audience.length === 0) return "Choose who should see it.";
    if (form.linkUrl && !/^(https?:\/\/|\/)/.test(form.linkUrl.trim())) return "Links must start with https:// or / (a LegalLink page).";
    if (form.startsAt && form.endsAt && new Date(form.endsAt) <= new Date(form.startsAt)) return "The end must be after the start.";
    if (form.endsAt && new Date(form.endsAt) <= new Date()) return "The end date is already in the past.";
    return "";
  };

  const save = async (e) => {
    e.preventDefault();
    const v = validate();
    if (v) return setErr(v);
    setBusy(true);
    setErr("");
    const payload = {
      ...form,
      title: form.title.trim(),
      message: form.message.trim(),
      startsAt: form.startsAt ? new Date(form.startsAt).toISOString() : editing === "new" ? new Date().toISOString() : current?.startsAt,
      endsAt: form.endsAt ? new Date(form.endsAt).toISOString() : null,
    };
    try {
      if (editing === "new") {
        await adminAPI.createAnnouncement({ ...payload, isActive: true });
        notify(payload.startsAt && new Date(payload.startsAt) > new Date() ? "Announcement scheduled." : "Announcement published.");
      } else {
        await adminAPI.updateAnnouncement(editing, payload);
        notify("Announcement saved.");
      }
      setEditing(null);
      load();
    } catch (e2) {
      setErr(e2.response?.data?.message || "Could not save the announcement.");
    } finally {
      setBusy(false);
    }
  };

  const toggle = async (a) => {
    setBusy(true);
    try {
      await adminAPI.updateAnnouncement(a._id, { isActive: !a.isActive });
      notify(a.isActive ? "Announcement turned off." : "Announcement turned on.");
      load();
    } catch (e) {
      notify(e.response?.data?.message || "That didn't work.", true);
    } finally {
      setBusy(false);
    }
  };

  const remove = async (a) => {
    setBusy(true);
    try {
      await adminAPI.deleteAnnouncement(a._id);
      notify("Announcement deleted.");
      setConfirm(null);
      setEditing(null);
      load();
    } catch (e) {
      notify(e.response?.data?.message || "That didn't work.", true);
    } finally {
      setBusy(false);
    }
  };

  const is = (k) => (a) => statusOf(a).key === k;
  const tabs = [
    { key: "all", label: "All", count: rows.length },
    { key: "live", label: "Live", count: rows.filter(is("live")).length, filter: is("live") },
    { key: "scheduled", label: "Scheduled", count: rows.filter(is("scheduled")).length, filter: is("scheduled") },
    { key: "past", label: "Ended or off", count: rows.filter((a) => ["ended", "off"].includes(statusOf(a).key)).length, filter: (a) => ["ended", "off"].includes(statusOf(a).key) },
  ];

  const audienceText = (list = []) =>
    list.length === 3 ? "Everyone" : AUDIENCES.filter((x) => list.includes(x.key)).map((x) => x.label).join(", ") || "—";

  const columns = [
    {
      key: "title",
      header: "Announcement",
      render: (a) => (
        <span>
          <span className="ax-cell-title">{a.title}</span>
          <span className="ax-cell-sub" style={{ display: "block", maxWidth: 380, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{a.message || "—"}</span>
        </span>
      ),
    },
    { key: "message", header: "Message", hideInTable: true },
    { key: "audience", header: "Shown to", sortValue: (a) => audienceText(a.audience), render: (a) => audienceText(a.audience), csv: (a) => audienceText(a.audience) },
    {
      key: "status",
      header: "Status",
      sortValue: (a) => statusOf(a).text,
      render: (a) => {
        const s = statusOf(a);
        return <span className={`ax-pill ${s.tone}`}>{s.text}</span>;
      },
      csv: (a) => statusOf(a).text,
    },
    {
      key: "when",
      header: "Runs",
      sortValue: (a) => new Date(a.startsAt).getTime(),
      render: (a) => (
        <span style={{ whiteSpace: "nowrap" }}>
          {fmtDate(a.startsAt)} – {a.endsAt ? fmtDate(a.endsAt) : "until turned off"}
        </span>
      ),
      csv: (a) => `${fmtDate(a.startsAt)} - ${a.endsAt ? fmtDate(a.endsAt) : ""}`,
    },
    { key: "createdBy", header: "By", render: (a) => a.createdBy || "—" },
  ];

  const preview = { ...form, title: form.title || "Your title", message: form.message };

  return (
    <AdminLayout breadcrumb="Announcements" activeNav="announcements">
      <div className="ax-head">
        <div>
          <h1>Announcements</h1>
          <p>Banners shown at the top of the citizen, advocate and NGO portals.</p>
        </div>
        {canEdit && (
          <button type="button" className="ax-btn is-primary" onClick={openNew}>
            <Plus size={15} /> New announcement
          </button>
        )}
      </div>

      {loaded && !canEdit && <div className="ax-msg is-warn">Your role can view announcements but not publish or change them.</div>}

      <DataTable
        rows={rows}
        columns={columns}
        loading={loading}
        tabs={tabs}
        searchKeys={["title", "message", "createdBy"]}
        searchPlaceholder="Title or message…"
        onRowClick={openEdit}
        exportName="announcements"
        emptyText={rows.length ? "Nothing in this list." : "No announcements yet. Use them for court holidays, maintenance or new features."}
        defaultSort={{ key: "when", dir: "desc" }}
      />

      <SidePanel
        open={Boolean(editing)}
        onClose={() => setEditing(null)}
        wide
        title={editing === "new" ? "New announcement" : "Edit announcement"}
        subtitle={current ? `${statusOf(current).text} · created by ${current.createdBy || "an admin"}` : "It appears as a banner until it ends or you turn it off."}
        footer={
          canEdit && (
            <>
              {current && (
                <>
                  <button type="button" className="ax-btn is-danger" onClick={() => setConfirm(current)}>
                    <Trash2 size={15} /> Delete
                  </button>
                  <button type="button" className="ax-btn" onClick={() => toggle(current)} disabled={busy}>
                    <Power size={15} /> {current.isActive ? "Turn off" : "Turn on"}
                  </button>
                </>
              )}
              <span className="ax-spacer" />
              <button type="submit" form="an-form" className="ax-btn is-primary" disabled={busy} aria-busy={busy}>
                {busy && <span className="btn-spinner" />}
                {editing === "new" ? (form.startsAt && new Date(form.startsAt) > new Date() ? "Schedule" : "Publish") : "Save changes"}
              </button>
            </>
          )
        }
      >
        <form id="an-form" onSubmit={save}>
          <fieldset disabled={!canEdit} style={{ border: 0, padding: 0, margin: 0 }}>
            {err && <div className="ax-msg is-bad">{err}</div>}

            <div className="ax-preview-label">Preview</div>
            <div style={{ marginBottom: 20 }}>
              <AnnouncementItem a={preview} preview />
            </div>

            <label className="ax-field">
              <span>Title</span>
              <input className="ax-input" value={form.title} onChange={set("title")} maxLength={120} placeholder="Courts closed on 25 December" />
            </label>
            <label className="ax-field">
              <span>Message</span>
              <textarea className="ax-textarea" value={form.message} onChange={set("message")} maxLength={600} placeholder="Hearings on that day will be moved. Your advocate will confirm the new date." />
            </label>

            <div className="ax-field">
              <span>Show to</span>
            </div>
            <div className="ax-audience">
              {AUDIENCES.map((x) => (
                <label key={x.key} className={form.audience.includes(x.key) ? "is-on" : ""}>
                  <input type="checkbox" checked={form.audience.includes(x.key)} onChange={() => toggleAudience(x.key)} /> {x.label}
                </label>
              ))}
            </div>

            <div className="ax-field">
              <span>Type</span>
            </div>
            <div className="ax-seg" style={{ marginBottom: 16 }}>
              {TONES.map((t) => (
                <button key={t.key} type="button" className={form.tone === t.key ? "is-on" : ""} onClick={() => setForm((f) => ({ ...f, tone: t.key }))}>
                  {t.label}
                </button>
              ))}
            </div>

            <div className="ax-form-row">
              <label className="ax-field">
                <span>Starts</span>
                <input className="ax-input" type="datetime-local" value={form.startsAt} onChange={set("startsAt")} />
              </label>
              <label className="ax-field">
                <span>Ends</span>
                <input className="ax-input" type="datetime-local" value={form.endsAt} onChange={set("endsAt")} />
              </label>
            </div>
            <p className="ax-hint">Leave Starts empty to publish now, and Ends empty to keep it up until you turn it off.</p>

            <div className="ax-form-row">
              <label className="ax-field">
                <span>Link (optional)</span>
                <input className="ax-input" value={form.linkUrl} onChange={set("linkUrl")} placeholder="/lawyers or https://…" />
              </label>
              <label className="ax-field">
                <span>Link text</span>
                <input className="ax-input" value={form.linkText} onChange={set("linkText")} maxLength={40} placeholder="Learn more" />
              </label>
            </div>
          </fieldset>
        </form>
      </SidePanel>

      <ConfirmDialog
        open={Boolean(confirm)}
        title={`Delete “${confirm?.title}”?`}
        body="It disappears from every portal straight away. To hide it for now and keep it, turn it off instead."
        confirmLabel="Delete"
        danger
        busy={busy}
        onConfirm={() => remove(confirm)}
        onCancel={() => setConfirm(null)}
      />
      {toast && <div className={`ax-toast${toast.error ? " is-error" : ""}`} role="status">{toast.msg}</div>}
    </AdminLayout>
  );
};

export default Announcements;
