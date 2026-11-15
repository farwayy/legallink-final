import React, { useState, useEffect } from "react";
import { ngoAPI, reviewAPI } from "../../services/api";
import NGONavbar from "../../components/NGONavbar";
import {
  Star, MessageSquare, Send, CheckCircle2, Building2, ShieldCheck, Clock, MapPin,
  Hash, Edit3, X, Check, AlertCircle, UserRound, Scale, Inbox, Layers
} from "lucide-react";

const Stars = ({ value, size = 15 }) => (
  <span className="cp-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        size={size}
        fill={s <= Math.round(value) ? "#D4AF37" : "none"}
        color={s <= Math.round(value) ? "#C9A24B" : "#94A3B8"}
        strokeWidth={1.8}
      />
    ))}
  </span>
);

const fmtDate = (d) =>
  d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "";

const FOCUS_AREAS = [
  "Human Rights", "Domestic Violence", "Child Protection",
  "Labor Rights", "Prisoner Aid", "Women Rights",
  "Refugee Rights", "Environmental Law", "Disability Rights"
];

const SERVICES = [
  "Pro Bono Legal Representation", "Legal Counseling", "Mediation",
  "Financial Bail Aid", "Document Assistance", "Court Accompaniment",
  "Awareness & Education"
];

const PROVINCES = [
  "Punjab", "Sindh", "Khyber Pakhtunkhwa", "Balochistan",
  "Islamabad Capital Territory", "Azad Jammu & Kashmir", "Gilgit-Baltistan"
];

const PAKISTAN_CITIES = [
  "Lahore", "Karachi", "Islamabad", "Rawalpindi", "Faisalabad",
  "Multan", "Peshawar", "Quetta", "Gujranwala", "Sialkot",
  "Hyderabad", "Bahawalpur", "Sargodha", "Sukkur", "Abbottabad"
];

// Read-only value, or the input when the page is in edit mode.
// Defined outside the component so inputs keep focus while typing.
const Field = ({ label, value, wide, editMode, children }) => (
  <div className={`cp-field${wide ? " is-wide" : ""}${editMode && children ? " is-editing" : ""}`}>
    <span className="cp-field-label">{label}</span>
    {editMode && children ? (
      children
    ) : (
      <span className={`cp-field-value${value ? "" : " is-empty"}`}>{value || "Not specified"}</span>
    )}
  </div>
);

const NGOProfile = () => {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState({ msg: "", type: "" });
  const [editMode, setEditMode] = useState(false);
  const [cnicError, setCnicError] = useState("");

  // Review & Star Distribution State (FR_18)
  const [reviews, setReviews] = useState([]);
  const [starDistribution, setStarDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyText, setReplyText] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast({ msg: "", type: "" }), 3500);
  };

  useEffect(() => {
    ngoAPI.getProfile()
      .then((r) => {
        const ngoData = r.data;
        setProfile(ngoData);
        setForm(buildForm(ngoData));
        if (ngoData?._id) {
          fetchNGOReviews(ngoData._id);
        }
      })
      .catch(() => showToast("Failed to load profile.", "error"))
      .finally(() => setLoading(false));
  }, []);

  const buildForm = (ngoData) => ({
          bio:             ngoData.bio || "",
          operatingHours:  ngoData.operatingHours || "",
          website:         ngoData.website || "",
          phone:           ngoData.phone || "",
          address:         ngoData.address || "",
          city:            ngoData.city || "",
          province:        ngoData.province || "",
          focusAreas:      ngoData.focusAreas || [],
          servicesOffered: ngoData.servicesOffered || [],
          isAcceptingCases: ngoData.isAcceptingCases ?? true,
          focalName:        ngoData.focalPerson?.name || "",
          focalDesignation: ngoData.focalPerson?.designation || "",
          focalCnic:        ngoData.focalPerson?.cnic || "",
          focalPhone:       ngoData.focalPerson?.phone || "",
  });

  const fetchNGOReviews = async (ngoId) => {
    setLoadingReviews(true);
    try {
      const res = await reviewAPI.getNGOReviews(ngoId);
      setReviews(res.data?.reviews || []);
      setStarDistribution(res.data?.starDistribution || res.data?.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
      setAverageRating(res.data?.averageRating || 0);
      setTotalReviews(res.data?.totalReviews || (res.data?.reviews || []).length);
    } catch (e) {
      console.error("Failed to load NGO reviews:", e);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSendReply = async (reviewId) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await reviewAPI.replyReview(reviewId, { comment: replyText.trim() });
      const updatedReply = res.data?.review?.reply;
      setReviews((prev) =>
        prev.map((r) => (r._id === reviewId ? { ...r, reply: updatedReply } : r))
      );
      setReplyingReviewId(null);
      setReplyText("");
      showToast("Public organization response published successfully.");
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to post response. Please try again.", "error");
    } finally {
      setSubmittingReply(false);
    }
  };

  // ── Pakistani CNIC Formatter & Sanitizer ─────────────────────────────────
  const formatCNIC = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  };

  const handleCnicKeyDown = (e) => {
    if (
      ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleCnicChange = (e) => {
    const formatted = formatCNIC(e.target.value);
    setForm((prev) => ({ ...prev, focalCnic: formatted }));
    const digits = formatted.replace(/\D/g, "");
    if (digits.length > 0 && digits.length !== 13) {
      setCnicError("CNIC must be exactly 13 digits in format XXXXX-XXXXXXX-X");
    } else {
      setCnicError("");
    }
  };

  const updateField = (e) => setForm({ ...form, [e.target.name]: e.target.value });

  const toggleArray = (field, value) => {
    setForm((prev) => {
      const arr = prev[field] || [];
      return { ...prev, [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] };
    });
  };

  const handleSave = async () => {
    if (form.focalCnic) {
      const digits = form.focalCnic.replace(/\D/g, "");
      if (digits.length !== 13) {
        setCnicError("CNIC must be exactly 13 digits in format XXXXX-XXXXXXX-X");
        showToast("Please correct the Focal Person CNIC number.", "error");
        return;
      }
    }

    setSaving(true);
    try {
      const payload = {
        ...form,
        focusAreas: JSON.stringify(form.focusAreas),
        servicesOffered: JSON.stringify(form.servicesOffered)
      };
      const r = await ngoAPI.updateProfile(payload);
      setProfile(r.data.ngo);
      setForm(buildForm(r.data.ngo));
      setEditMode(false);
      showToast("Organization profile updated successfully.");
    } catch (e) {
      showToast(e.response?.data?.message || "Failed to update profile.", "error");
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setForm(buildForm(profile || {}));
    setCnicError("");
    setEditMode(false);
  };

  // Intake switch saves straight away (works in view mode too)
  const [savingIntake, setSavingIntake] = useState(false);
  const toggleIntake = async () => {
    if (editMode) {
      setForm((prev) => ({ ...prev, isAcceptingCases: !prev.isAcceptingCases }));
      return;
    }
    const next = profile?.isAcceptingCases === false;
    setSavingIntake(true);
    try {
      const r = await ngoAPI.updateProfile({ isAcceptingCases: next });
      setProfile(r.data.ngo);
      setForm((prev) => ({ ...prev, isAcceptingCases: next }));
      showToast(next ? "You're now accepting new legal aid requests." : "New intakes paused.");
    } catch (e) {
      showToast(e.response?.data?.message || "Couldn't update intake status.", "error");
    } finally {
      setSavingIntake(false);
    }
  };

  const isVerified = profile?.verificationStatus === "approved";
  const accepting = editMode ? form.isAcceptingCases !== false : profile?.isAcceptingCases !== false;
  const initials = (profile?.name || "NGO")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
  const place = [profile?.city, profile?.province].filter(Boolean).join(", ");
  const focusList = editMode ? form.focusAreas || [] : profile?.focusAreas || [];
  const serviceList = editMode ? form.servicesOffered || [] : profile?.servicesOffered || [];

  const renderPills = (all, list, field) => (
    <div className="ngo-badge-cloud">
      {all.map((item) => {
        const active = list.includes(item);
        if (!editMode && !active) return null;
        return editMode ? (
          <button
            type="button"
            key={item}
            aria-pressed={active}
            className={`ngo-badge-pill selectable ${active ? "active" : "inactive"}`}
            onClick={() => toggleArray(field, item)}
          >
            {active && <Check size={13} strokeWidth={2.6} />}
            {item}
          </button>
        ) : (
          <span key={item} className="ngo-badge-pill active">{item}</span>
        );
      })}
      {!editMode && list.length === 0 && <span className="cp-field-value is-empty">None selected yet</span>}
    </div>
  );

  if (loading) {
    return (
      <>
        <NGONavbar />
        <div className="cp-page ngo-portal">
          <div className="cp-main" style={{ marginTop: 0, paddingTop: 40 }}>
            <div className="cp-card cp-card-pad" aria-busy="true">
              <div className="cp-skeleton-row" />
              <div className="cp-skeleton-row" style={{ width: "70%" }} />
              <div className="cp-skeleton-row" style={{ width: "50%" }} />
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <NGONavbar />
      <style>{`
        /* Uses the shared portal colours from counselPortal.css */
        .ngo-pcard {
          background: var(--cp-surface);
          border: 1px solid var(--cp-border);
          border-radius: 16px;
          box-shadow: var(--cp-shadow);
          padding: 22px;
        }
        .ngo-pcard-header {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 18px;
        }
        .ngo-pcard-title {
          margin: 0;
          font-family: var(--font-serif, "Playfair Display", Georgia, serif);
          font-size: 19px;
          font-weight: 700;
          color: var(--cp-text) !important;
        }
        .ngo-field-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
          gap: 14px;
        }
        .ngo-full-row { grid-column: 1 / -1; }
        .ngo-lbl {
          display: block;
          margin-bottom: 6px;
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          color: var(--cp-muted) !important;
        }
        .ngo-val-display {
          min-height: 44px;
          padding: 11px 14px;
          border-radius: 11px;
          background: var(--cp-subtle);
          border: 1px solid var(--cp-border);
          font-size: 14px;
          font-weight: 600;
          color: var(--cp-text) !important;
          word-break: break-word;
        }
        .ngo-val-display.is-empty { font-weight: 500; font-style: italic; color: var(--cp-muted) !important; }
        .ngo-inp {
          width: 100%;
          min-height: 44px;
          padding: 10px 14px;
          border-radius: 10px;
          border: 1px solid var(--cp-border-strong);
          background-color: var(--cp-subtle);
          color: var(--cp-text);
          font-family: inherit;
          font-size: 14px;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        textarea.ngo-inp { min-height: 120px; line-height: 1.6; resize: vertical; }
        .ngo-inp:focus { border-color: var(--cp-gold); box-shadow: 0 0 0 3px var(--cp-gold-tint); }
        .ngo-inp.is-invalid { border-color: #DC2626; }
        .cp-field.is-editing { padding: 0; background: none; border: none; gap: 6px; }
        .ngo-portal .cp-empty-note { display: flex; flex-direction: column; align-items: flex-start; gap: 12px; }
        .ngo-hint { margin-top: 6px; font-size: 12px; color: var(--cp-muted); }
        .ngo-hint.is-error { color: #DC2626; }
        html.dark .ngo-hint.is-error { color: #F87171; }

        .ngo-badge-cloud { display: flex; flex-wrap: wrap; gap: 8px; }
        .ngo-badge-pill {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 7px 12px;
          border-radius: 9999px;
          border: 1px solid var(--cp-border-strong);
          font-size: 13px;
          font-weight: 500;
          color: var(--cp-muted);
          background: transparent;
          user-select: none;
          transition: all 0.15s ease;
        }
        .ngo-badge-pill.active {
          border-color: transparent;
          background: var(--cp-gold-tint);
          color: var(--cp-gold);
          font-weight: 600;
        }
        .ngo-badge-pill.inactive:not(.selectable) { display: none; }
        .ngo-badge-pill.selectable { cursor: pointer; }
        .ngo-badge-pill.selectable:hover { border-color: var(--cp-gold); color: var(--cp-text); }
        .ngo-badge-pill.selectable.active:hover { color: var(--cp-gold); }
      `}</style>
      {toast.msg && (
        <div className={`cp-toast${toast.type === "error" ? " is-error" : ""}`} role="status">
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.msg}</span>
        </div>
      )}

      <div className="cp-page ngo-portal">
        {/* ── Identity banner ── */}
        <section className="cp-hero is-compact cp-profile-hero ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <div className="cp-identity">
                <span className="cp-identity-photo">{initials}</span>
                <div className="cp-identity-text">
                  {isVerified ? (
                    <span className="cp-chip"><ShieldCheck size={13} strokeWidth={2.2} /> Accredited legal aid organisation</span>
                  ) : (
                    <span className="cp-chip is-pending"><Clock size={13} strokeWidth={2.2} /> Accreditation under review</span>
                  )}
                  <h1 className="cp-hero-title"><span>{profile?.name}</span></h1>
                  <div className="cp-identity-meta">
                    {profile?.registrationNumber && (
                      <span><Hash size={14} /> Reg. {profile.registrationNumber}</span>
                    )}
                    {place && <span><MapPin size={14} /> {place}</span>}
                    {totalReviews > 0 && (
                      <span><Stars value={averageRating} size={13} /> {Number(averageRating).toFixed(1)} ({totalReviews})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="cp-hero-side">
              {!editMode ? (
                <button type="button" className="cp-btn-gold" onClick={() => setEditMode(true)}>
                  <Edit3 size={16} strokeWidth={2.2} /> Edit profile
                </button>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  <button type="button" className="cp-btn-ghost" onClick={cancelEdit}>
                    <X size={16} /> Cancel
                  </button>
                  <button type="button" className="cp-btn-gold" onClick={handleSave} disabled={saving}>
                    <Check size={16} strokeWidth={2.4} /> {saving ? <><span className="btn-spinner" />Saving…</> : "Save changes"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Summary ── */}
          <section className="cp-stats" aria-label="Organisation summary">
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Star size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Citizen rating</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{totalReviews > 0 ? Number(averageRating).toFixed(1) : "—"}</span>
                <span className="cp-stat-note">{totalReviews > 0 ? `${totalReviews} ${totalReviews === 1 ? "review" : "reviews"}` : "No reviews yet"}</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Scale size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Focus areas</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{(profile?.focusAreas || []).length}</span>
                <span className="cp-stat-note">of {FOCUS_AREAS.length} listed</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Layers size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Services offered</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{(profile?.servicesOffered || []).length}</span>
                <span className="cp-stat-note">Pro bono</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Inbox size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Citizen intake</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value" style={{ fontSize: 22 }}>{profile?.isAcceptingCases !== false ? "Open" : "Paused"}</span>
                <span className="cp-stat-note">{profile?.isAcceptingCases !== false ? "Accepting requests" : "Not accepting"}</span>
              </div>
            </div>
          </section>

          <div className="cp-layout">
            <div style={{ flex: "999 1 560px", display: "flex", flexDirection: "column", gap: 20, minWidth: 0 }}>
              {/* ── Organisation details ── */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div className="cp-card-head-title">
                    <span className="cp-icon-tile"><Building2 size={18} strokeWidth={1.8} /></span>
                    <h2 className="cp-section-title" style={{ fontSize: 19 }}>Organisation &amp; secretariat</h2>
                  </div>
                </div>
                <div className="cp-field-grid">
                  <Field editMode={editMode} label="Primary phone" value={profile?.phone}>
                    <input type="text" name="phone" className="ngo-inp" value={form.phone} onChange={updateField} />
                  </Field>
                  <Field editMode={editMode} label="Operating hours" value={profile?.operatingHours}>
                    <input type="text" name="operatingHours" className="ngo-inp" placeholder="e.g. Mon–Fri, 9:00 AM – 5:00 PM" value={form.operatingHours} onChange={updateField} />
                  </Field>
                  <Field editMode={editMode} label="Headquarters city" value={profile?.city}>
                    <select name="city" className="ngo-inp" value={form.city} onChange={updateField}>
                      <option value="">Select city</option>
                      {PAKISTAN_CITIES.map((c) => <option key={c} value={c}>{c}</option>)}
                    </select>
                  </Field>
                  <Field editMode={editMode} label="Province" value={profile?.province}>
                    <select name="province" className="ngo-inp" value={form.province} onChange={updateField}>
                      <option value="">Select province</option>
                      {PROVINCES.map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                  </Field>
                  <Field editMode={editMode} label="Secretariat address" value={profile?.address} wide>
                    <input type="text" name="address" className="ngo-inp" value={form.address} onChange={updateField} />
                  </Field>
                  <Field editMode={editMode} label="Website" value={profile?.website} wide>
                    <input type="url" name="website" className="ngo-inp" placeholder="https://" value={form.website} onChange={updateField} />
                  </Field>
                </div>

                <div className="cp-form-row">
                  <span className="cp-field-label">Mission &amp; overview</span>
                  {editMode ? (
                    <textarea name="bio" className="ngo-inp" value={form.bio} onChange={updateField}
                      placeholder="Describe your organisation, who you help and how." />
                  ) : profile?.bio ? (
                    <p className="cp-bio">{profile.bio}</p>
                  ) : (
                    <div className="cp-empty-note">
                      <span>No mission statement yet. Citizens see this on your directory listing.</span>
                      <button type="button" className="cp-btn-outline is-small" onClick={() => setEditMode(true)}>Add overview</button>
                    </div>
                  )}
                </div>
              </section>

              {/* ── Focal person ── */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div className="cp-card-head-title">
                    <span className="cp-icon-tile"><UserRound size={18} strokeWidth={1.8} /></span>
                    <div>
                      <h2 className="cp-section-title" style={{ fontSize: 19 }}>Focal representative</h2>
                      <span className="cp-section-sub">The person LegalLink and advocates contact about your cases</span>
                    </div>
                  </div>
                </div>
                <div className="cp-field-grid">
                  <Field editMode={editMode} label="Full name" value={profile?.focalPerson?.name}>
                    <input type="text" name="focalName" className="ngo-inp" value={form.focalName} onChange={updateField} />
                  </Field>
                  <Field editMode={editMode} label="Designation" value={profile?.focalPerson?.designation}>
                    <input type="text" name="focalDesignation" className="ngo-inp" value={form.focalDesignation} onChange={updateField} />
                  </Field>
                  <Field editMode={editMode} label="CNIC" value={profile?.focalPerson?.cnic}>
                    <div>
                      <input
                        type="text"
                        inputMode="numeric"
                        className={`ngo-inp${cnicError ? " is-invalid" : ""}`}
                        placeholder="35201-1234567-1"
                        value={form.focalCnic}
                        onKeyDown={handleCnicKeyDown}
                        onChange={handleCnicChange}
                        maxLength={15}
                      />
                      <div className={`ngo-hint${cnicError ? " is-error" : ""}`}>
                        {cnicError || "13 digits, formatted automatically"}
                      </div>
                    </div>
                  </Field>
                  <Field editMode={editMode} label="Direct phone" value={profile?.focalPerson?.phone}>
                    <input type="text" name="focalPhone" className="ngo-inp" value={form.focalPhone} onChange={updateField} />
                  </Field>
                </div>
              </section>

              {/* ── Practice areas ── */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div className="cp-card-head-title">
                    <span className="cp-icon-tile"><Scale size={18} strokeWidth={1.8} /></span>
                    <div>
                      <h2 className="cp-section-title" style={{ fontSize: 19 }}>Practice areas &amp; services</h2>
                      {editMode && <span className="cp-section-sub">Tap to select or remove</span>}
                    </div>
                  </div>
                </div>
                <div className="cp-form-row">
                  <span className="cp-subhead">Legal focus areas</span>
                  {renderPills(FOCUS_AREAS, focusList, "focusAreas")}
                </div>
                <div className="cp-form-row">
                  <span className="cp-subhead">Pro bono services</span>
                  {renderPills(SERVICES, serviceList, "servicesOffered")}
                </div>
              </section>
            </div>

            <aside className="cp-aside">
              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Citizen intake</h2>
                <div className="cp-availability" style={{ padding: "4px 0" }}>
                  <div>
                    <strong style={{ color: "var(--cp-text)" }}>
                      {accepting ? "Accepting new requests" : "New intakes paused"}
                    </strong>
                    <span style={{ color: "var(--cp-muted)" }}>
                      {accepting
                        ? "Citizens can request legal aid from your directory listing"
                        : "Turn on to receive new legal aid requests"}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={accepting}
                    aria-label="Accepting new legal aid requests"
                    className={`cp-switch${accepting ? " is-on" : ""}`}
                    onClick={toggleIntake}
                    disabled={savingIntake}
                  />
                </div>
              </section>

              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Registration</h2>
                <dl className="cp-dl">
                  <div className="cp-dl-row">
                    <dt>Registration no.</dt>
                    <dd className="is-mono">{profile?.registrationNumber || "Not specified"}</dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Accreditation</dt>
                    <dd>
                      <span className={`cp-pill ${isVerified ? "is-ok" : "is-warn"}`}>
                        {isVerified ? "Verified" : "Under review"}
                      </span>
                    </dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Account email</dt>
                    <dd>{profile?.email || "Not specified"}</dd>
                  </div>
                  {profile?.createdAt && (
                    <div className="cp-dl-row">
                      <dt>On LegalLink since</dt>
                      <dd>{fmtDate(profile.createdAt)}</dd>
                    </div>
                  )}
                </dl>
                <span className="cp-section-sub">
                  Name and registration details can only be changed by LegalLink administration.
                </span>
              </section>
            </aside>
          </div>

          {/* ── Reviews ── */}
          <section className="cp-card cp-card-pad" style={{ gap: 20 }}>
            <div className="cp-card-head">
              <div className="cp-card-head-title">
                <span className="cp-icon-tile"><Star size={18} strokeWidth={1.8} /></span>
                <div>
                  <h2 className="cp-section-title" style={{ fontSize: 19 }}>Citizen reviews</h2>
                  <span className="cp-section-sub">Only citizens whose pro bono matter was resolved can leave a review</span>
                </div>
              </div>
            </div>

            <div className="cp-reviews-summary">
              <div className="cp-score">
                <span className="cp-score-value">{totalReviews > 0 ? Number(averageRating).toFixed(1) : "—"}</span>
                <Stars value={totalReviews > 0 ? averageRating : 0} size={17} />
                <span className="cp-score-sub">
                  {totalReviews > 0
                    ? `Based on ${totalReviews} ${totalReviews === 1 ? "review" : "reviews"}`
                    : "No reviews yet"}
                </span>
              </div>
              <div className="cp-bars">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = starDistribution?.[n] || 0;
                  const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
                  return (
                    <div className="cp-bar-row" key={n}>
                      <span>{n} <Star size={11} fill="#D4AF37" color="#C9A24B" /></span>
                      <span className="cp-bar-track"><span className="cp-bar-fill" style={{ width: `${pct}%`, display: "block" }} /></span>
                      <span>{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            {loadingReviews ? (
              <div aria-busy="true">
                <div className="cp-skeleton-row" style={{ margin: "8px 0" }} />
                <div className="cp-skeleton-row" style={{ margin: "8px 0", width: "70%" }} />
              </div>
            ) : reviews.length === 0 ? (
              <div className="cp-empty" style={{ padding: "32px 20px" }}>
                <span className="cp-empty-icon"><MessageSquare size={24} strokeWidth={1.8} /></span>
                <strong>No citizen reviews yet</strong>
                <p>When a pro bono matter is resolved, the citizen is invited to rate your organisation. Reviews appear here and on your directory listing.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                {reviews.map((r) => {
                  const clientName = r.userId?.name || "Verified citizen";
                  const hasReply = r.reply && r.reply.comment && r.reply.comment.trim();
                  return (
                    <article key={r._id} className="cp-review">
                      <div className="cp-review-top">
                        <div className="cp-review-who">
                          <span className="cp-client-avatar">{clientName.charAt(0).toUpperCase()}</span>
                          <div>
                            <span className="cp-review-name">{clientName}</span>
                            <span className="cp-verified"><CheckCircle2 size={11} /> Verified citizen</span>
                            <div className="cp-review-date">
                              {fmtDate(r.createdAt)}
                              {r.isEdited && " · edited"}
                            </div>
                          </div>
                        </div>
                        <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                          <Stars value={r.rating} size={14} />
                          <strong style={{ fontSize: 13, color: "var(--cp-text)" }}>{r.rating}/5</strong>
                        </span>
                      </div>

                      <p className="cp-review-text">{r.comment}</p>

                      {hasReply ? (
                        <div className="cp-reply">
                          <div className="cp-reply-head">
                            <strong><Building2 size={14} /> Your organisation's reply</strong>
                            <span>{r.reply.repliedAt ? fmtDate(r.reply.repliedAt) : "Published"}</span>
                          </div>
                          <p>{r.reply.comment}</p>
                        </div>
                      ) : replyingReviewId === r._id ? (
                        <div className="cp-reply-form">
                          <label className="cp-label" htmlFor={`reply-${r._id}`}>Public reply (can't be edited after publishing)</label>
                          <textarea
                            id={`reply-${r._id}`}
                            className="cp-textarea"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Thank the citizen or respond to their feedback. Your reply is visible to everyone."
                          />
                          <div className="cp-reply-actions">
                            <button
                              type="button"
                              className="cp-btn-outline is-small"
                              onClick={() => {
                                setReplyingReviewId(null);
                                setReplyText("");
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="cp-btn-primary"
                              onClick={() => handleSendReply(r._id)}
                              disabled={submittingReply || !replyText.trim()}
                            >
                              <Send size={14} /> {submittingReply ? <><span className="btn-spinner" />Publishing…</> : "Publish reply"}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            className="cp-btn-outline is-small"
                            onClick={() => {
                              setReplyingReviewId(r._id);
                              setReplyText("");
                            }}
                          >
                            <MessageSquare size={14} /> Reply publicly
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
};

export default NGOProfile;
