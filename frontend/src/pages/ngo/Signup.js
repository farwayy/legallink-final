import React, { useState, useRef, useCallback } from "react";
import { Link } from "react-router-dom";
import { ngoAPI } from "../../services/api";
import AuthLayout from "../../components/AuthLayout";
import { Building2, Users, Gavel, HandHeart, Check, ArrowRight, ArrowLeft, AlertCircle, CheckCircle2, Clock } from "lucide-react";
import { API_URL } from "../../config";

const NGO_LAYOUT = {
  eyebrow: "Legal aid accreditation",
  title: <>Extend justice to <em>those who need it</em>.</>,
  description: "Accredit your organisation to receive pro bono requests from citizens, assign panel advocates and coordinate court representation nationwide.",
  highlights: [
    { icon: HandHeart, title: "Citizen aid requests", text: "Receive and triage pro bono matters from verified citizens." },
    { icon: Users, title: "Panel advocates", text: "Invite verified advocates to represent your clients." },
    { icon: Gavel, title: "Case & hearing tracking", text: "Follow every matter from intake to resolution." },
  ],
};

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

const TOTAL_STEPS = 4;

const NGOSignup = () => {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [fieldErrors, setFieldErrors] = useState([]);
  const [toast, setToast] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const toastTimerRef = useRef(null);

  // Field refs for scroll-to-error
  const refs = {
    name: useRef(null),
    registrationNumber: useRef(null),
    email: useRef(null),
    phone: useRef(null),
    province: useRef(null),
    city: useRef(null),
    address: useRef(null),
    password: useRef(null),
    confirmPassword: useRef(null),
    focalName: useRef(null),
    focalDesignation: useRef(null),
    focalCnic: useRef(null),
    focalPhone: useRef(null),
    focusAreas: useRef(null),
    servicesOffered: useRef(null),
    officialDocument: useRef(null),
  };

  const showToast = useCallback(() => {
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    setToast(true);
    toastTimerRef.current = setTimeout(() => setToast(false), 4000);
  }, []);

  const shakeAndScroll = useCallback((fieldKey) => {
    const el = refs[fieldKey]?.current;
    if (!el) return;
    el.scrollIntoView({ behavior: "smooth", block: "center" });
    el.classList.remove("ngo-shake");
    void el.offsetWidth; // reflow to restart animation
    el.classList.add("ngo-shake");
    el.style.borderColor = "#dc2626";
    el.style.boxShadow = "0 0 0 3px rgba(220,38,38,0.18)";
    setTimeout(() => {
      el.classList.remove("ngo-shake");
      el.style.borderColor = "";
      el.style.boxShadow = "";
    }, 2000);
  }, []);

  const [formData, setFormData] = useState({
    name: "",
    registrationNumber: "",
    email: "",
    password: "",
    phone: "",
    address: "",
    city: "",
    province: "",
    website: "",
    // Focal person
    focalName: "",
    focalDesignation: "",
    focalCnic: "",
    focalPhone: "",
    // Arrays
    focusAreas: [],
    servicesOffered: [],
    // Document
    officialDocument: null,
    bio: "",
    operatingHours: "09:00 AM - 05:00 PM",
  });

  // ── Pakistani CNIC Formatter & Sanitizer ─────────────────────────────────
  const formatCNIC = (raw) => {
    const digits = raw.replace(/\D/g, "").slice(0, 13);
    if (digits.length <= 5) return digits;
    if (digits.length <= 12) return `${digits.slice(0, 5)}-${digits.slice(5)}`;
    return `${digits.slice(0, 5)}-${digits.slice(5, 12)}-${digits.slice(12, 13)}`;
  };

  const handleCnicKeyDown = (e) => {
    // Allow navigation, delete, backspace, tab, copy-paste
    if (
      ["Backspace", "Delete", "Tab", "ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key) ||
      (e.ctrlKey || e.metaKey)
    ) {
      return;
    }
    // Block any non-digit
    if (!/^\d$/.test(e.key)) {
      e.preventDefault();
    }
  };

  const handleCnicChange = (e) => {
    const formatted = formatCNIC(e.target.value);
    setFormData((prev) => ({ ...prev, focalCnic: formatted }));
    setError("");
  };

  // ── Phone Input Sanitizer ───────────────────────────────────────────────
  const handlePhoneChange = (field, value) => {
    if (field === "focalPhone") {
      const cleaned = value.replace(/\D/g, "").slice(0, 11);
      setFormData((prev) => ({ ...prev, focalPhone: cleaned }));
      setError("");
      return;
    }
    // Only allow digits, plus sign and hyphens
    const cleaned = value.replace(/[^\d+-\s]/g, "");
    setFormData((prev) => ({ ...prev, [field]: cleaned }));
    setError("");
  };

  const updateField = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
    setError("");
  };

  const toggleArray = (field, value) => {
    setFormData((prev) => {
      const arr = prev[field];
      return {
        ...prev,
        [field]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value],
      };
    });
    setError("");
  };

  const handleFile = (e) => {
    if (e.target.files && e.target.files[0]) {
      setFormData({ ...formData, officialDocument: e.target.files[0] });
      setError("");
    }
  };

  // ── Password Complexity Checks ──────────────────────────────────────────
  const pwd = formData.password;
  const hasMinLength = pwd.length >= 8;
  const hasUppercase = /[A-Z]/.test(pwd);
  const hasNumber = /[0-9]/.test(pwd);
  const hasSpecial = /[!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(pwd);
  const isMatch = pwd.length > 0 && pwd === confirmPassword;
  const isPasswordValid = hasMinLength && hasUppercase && hasNumber && hasSpecial && isMatch;

  // ── Step Validation ─────────────────────────────────────────────────────
  const validateStep = () => {
    setError("");
    setFieldErrors([]);

    const errs = [];
    let firstField = null;

    if (step === 1) {
      if (!formData.name.trim()) {
        errs.push("Official Organization Name is required.");
        if (!firstField) firstField = "name";
      }
      if (!formData.registrationNumber.trim()) {
        errs.push("Government Registration / License Number is required.");
        if (!firstField) firstField = "registrationNumber";
      }
      if (!formData.email.trim() || !/\S+@\S+\.\S+/.test(formData.email)) {
        errs.push("A valid official organization email is required.");
        if (!firstField) firstField = "email";
      }
      if (!formData.phone.trim()) {
        errs.push("Official contact telephone is required.");
        if (!firstField) firstField = "phone";
      }
      if (!formData.province) {
        errs.push("Please select your province/territory.");
        if (!firstField) firstField = "province";
      }
      if (!formData.city) {
        errs.push("Please specify the principal headquarters city.");
        if (!firstField) firstField = "city";
      }
      if (!formData.address.trim()) {
        errs.push("Physical secretariat office address is required.");
        if (!firstField) firstField = "address";
      }
      if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
        errs.push("Password must satisfy all complexity criteria (8+ chars, uppercase, number, special).");
        if (!firstField) firstField = "password";
      } else if (!isMatch) {
        errs.push("Passwords do not match.");
        if (!firstField) firstField = "confirmPassword";
      }
    }

    if (step === 2) {
      if (!formData.focalName.trim()) {
        errs.push("Focal representative full name is required.");
        if (!firstField) firstField = "focalName";
      }
      if (!formData.focalDesignation.trim()) {
        errs.push("Focal representative official designation is required.");
        if (!firstField) firstField = "focalDesignation";
      }
      const cnicDigits = formData.focalCnic.replace(/\D/g, "");
      if (cnicDigits.length !== 13) {
        errs.push("CNIC must be exactly 13 digits in format XXXXX-XXXXXXX-X.");
        if (!firstField) firstField = "focalCnic";
      }
      if (!formData.focalPhone.trim()) {
        errs.push("Focal representative contact phone is required.");
        if (!firstField) firstField = "focalPhone";
      } else if (!/^03\d{9}$/.test(formData.focalPhone.trim())) {
        errs.push("Focal representative phone must be an 11-digit Pakistani mobile number starting with 03 (e.g., 03001234567).");
        if (!firstField) firstField = "focalPhone";
      }
    }

    if (step === 3) {
      if (formData.focusAreas.length === 0) {
        errs.push("Please select at least one legal focus area.");
        if (!firstField) firstField = "focusAreas";
      }
      if (formData.servicesOffered.length === 0) {
        errs.push("Please select at least one pro bono service provided.");
        if (!firstField) firstField = "servicesOffered";
      }
    }

    if (step === 4) {
      if (!formData.officialDocument) {
        errs.push("Official NGO Registration Certificate / Gazette document is required.");
        if (!firstField) firstField = "officialDocument";
      }
    }

    if (errs.length > 0) {
      setFieldErrors(errs);
      showToast();
      if (firstField) shakeAndScroll(firstField);
      return false;
    }
    return true;
  };

  // Is this email or registration number already registered? (checked on step 1)
  const [checking, setChecking] = useState(false);
  const next = async () => {
    if (!validateStep()) return;
    if (step === 1) {
      setChecking(true);
      let taken = {};
      try {
        const res = await fetch(`${API_URL}/auth/check-available`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "ngo", email: formData.email.trim(), registrationNumber: formData.registrationNumber.trim() }),
        });
        taken = (await res.json()).taken || {};
      } catch (e) {
        taken = {}; // the final submit checks again
      } finally {
        setChecking(false);
      }
      const errs = Object.values(taken);
      if (errs.length) {
        setFieldErrors(errs);
        showToast();
        shakeAndScroll(taken.email ? "email" : "registrationNumber");
        return;
      }
    }
    setStep((s) => s + 1);
  };
  const prev = () => {
    setStep((s) => s - 1);
    setError("");
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!validateStep()) return;
    if (!formData.focalPhone || !/^03\d{9}$/.test(formData.focalPhone.trim())) {
      setError("Focal representative phone must be an 11-digit Pakistani mobile number starting with 03 (e.g., 03001234567).");
      setStep(2);
      shakeAndScroll("focalPhone");
      return;
    }
    setLoading(true);
    setError("");

    try {
      const fd = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (k === "officialDocument") {
          if (v) fd.append(k, v);
        } else if (Array.isArray(v)) {
          fd.append(k, JSON.stringify(v));
        } else {
          fd.append(k, v);
        }
      });

      await ngoAPI.register(fd);
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Registration failed. Please check the provided information.");
    } finally {
      setLoading(false);
    }
  };

  const stepLabels = [
    { num: 1, title: "Organization", desc: "Identity & Credentials" },
    { num: 2, title: "Focal Person", desc: "Authorized Representative" },
    { num: 3, title: "Legal Scope", desc: "Focus Areas & Services" },
    { num: 4, title: "Verification", desc: "Certification Document" },
  ];

  return (
    <AuthLayout {...NGO_LAYOUT} wide backTo="/signup?role=ngo" backLabel="Account types">
      <style>{`
        .ngo-section-title {
          font-family: var(--font-serif, "Playfair Display", Georgia, serif);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--auth-text) !important;
          margin-bottom: 4px;
        }
        .ngo-section-sub { font-size: 0.85rem; color: var(--auth-text-3) !important; margin-bottom: 22px; }
        .ngo-form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
        .ngo-form-full { grid-column: 1 / -1; }
        .ngo-input-label { display: block; font-size: 13px; font-weight: 600; color: var(--auth-text-2); margin-bottom: 6px; }
        .ngo-input-label span { color: #DC2626; }
        .ngo-input, .ngo-select, .ngo-textarea {
          width: 100%;
          min-height: 46px;
          padding: 10px 14px;
          font-size: 14px;
          color: var(--auth-text);
          background: var(--auth-input-bg);
          border: 1px solid var(--auth-border-strong);
          border-radius: 10px;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
        }
        .ngo-input:focus, .ngo-select:focus, .ngo-textarea:focus {
          border-color: var(--auth-accent);
          box-shadow: 0 0 0 3px var(--auth-ring);
        }
        .ngo-input::placeholder, .ngo-textarea::placeholder { color: var(--auth-text-3); opacity: 0.8; }
        .ngo-input-help { font-size: 12px; color: var(--auth-text-3); margin-top: 4px; }

        .ngo-pwd-checklist {
          background: var(--auth-subtle);
          border: 1px solid var(--auth-border);
          border-radius: 10px;
          padding: 12px 14px;
          margin-top: 10px;
        }
        .ngo-pwd-rule { display: flex; align-items: center; gap: 8px; font-size: 12.5px; color: var(--auth-text-3); margin-bottom: 5px; }
        .ngo-pwd-rule:last-child { margin-bottom: 0; }
        .ngo-pwd-rule.met { color: #16A34A; font-weight: 600; }
        .ngo-pwd-icon {
          width: 16px; height: 16px; border-radius: 50%;
          display: inline-flex; align-items: center; justify-content: center;
          font-size: 10px; background: var(--auth-border); color: var(--auth-text-3);
        }
        .ngo-pwd-rule.met .ngo-pwd-icon { background: #16A34A; color: #FFFFFF; }

        .ngo-badge-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 10px; }
        .ngo-badge-option {
          display: flex; align-items: center; gap: 10px;
          background: var(--auth-surface);
          border: 1px solid var(--auth-border-strong);
          padding: 10px 14px;
          border-radius: 10px;
          cursor: pointer;
          font-size: 13.5px;
          color: var(--auth-text-2);
          transition: all 0.15s ease;
        }
        .ngo-badge-option:hover { border-color: var(--auth-accent); }
        .ngo-badge-option.selected {
          border-color: var(--auth-accent);
          box-shadow: 0 0 0 3px var(--auth-ring);
          color: var(--auth-text);
          font-weight: 600;
        }
        .ngo-custom-checkbox {
          width: 18px; height: 18px; flex-shrink: 0;
          border: 2px solid var(--auth-border-strong);
          border-radius: 5px;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; color: var(--auth-primary-text);
          transition: all 0.15s ease;
        }
        .ngo-badge-option.selected .ngo-custom-checkbox { background: var(--auth-primary); border-color: var(--auth-primary); }

        .ngo-file-box {
          border: 2px dashed var(--auth-border-strong);
          border-radius: 12px;
          background: var(--auth-subtle);
          padding: 32px 20px;
          text-align: center;
          cursor: pointer;
          color: var(--auth-text-2);
          transition: all 0.15s ease;
        }
        .ngo-file-box:hover, .ngo-file-box.has-file { border-color: var(--auth-accent); }
        .ngo-file-icon { font-size: 32px; color: var(--auth-accent); margin-bottom: 8px; }
        .ngo-file-name { font-weight: 600; color: var(--auth-accent); margin-top: 6px; font-size: 0.9rem; }

        @keyframes ngoShake {
          0%, 100% { transform: translateX(0); }
          15% { transform: translateX(-6px); }
          30% { transform: translateX(6px); }
          45% { transform: translateX(-5px); }
          60% { transform: translateX(5px); }
          75% { transform: translateX(-3px); }
          90% { transform: translateX(3px); }
        }
        .ngo-shake { animation: ngoShake 0.5s ease-in-out; }

        .ngo-toast {
          position: fixed; bottom: 28px; left: 50%; transform: translateX(-50%);
          background: #B91C1C; color: #FFFFFF;
          padding: 12px 22px; border-radius: 10px;
          font-size: 0.88rem; font-weight: 600;
          box-shadow: 0 6px 24px rgba(0, 0, 0, 0.22);
          z-index: 9999; white-space: nowrap; pointer-events: none;
          transition: opacity 0.3s ease;
        }
        .ngo-toast.hiding { opacity: 0; }

        .ngo-err-summary {
          background: #FEF2F2; border: 1px solid #FECACA;
          border-radius: 10px; padding: 12px 16px; margin-top: 20px;
        }
        .ngo-err-summary-title { font-size: 13px; font-weight: 700; color: #991B1B; margin-bottom: 6px; display: flex; align-items: center; gap: 6px; }
        .ngo-err-summary ul { margin: 0; padding-left: 18px; }
        .ngo-err-summary ul li { font-size: 12.5px; color: #991B1B; margin-bottom: 2px; line-height: 1.4; }
        html[data-theme="dark"] .ngo-err-summary { background: rgba(220, 38, 38, 0.12); border-color: rgba(248, 113, 113, 0.35); }
        html[data-theme="dark"] .ngo-err-summary-title,
        html[data-theme="dark"] .ngo-err-summary ul li { color: #FCA5A5; }

        .ngo-btn-bar {
          display: flex; justify-content: space-between; align-items: center; gap: 12px;
          margin-top: 28px; padding-top: 20px;
          border-top: 1px solid var(--auth-border);
        }
        .ngo-btn-bar .auth-btn { width: auto; }

        @media (max-width: 575.98px) {
          .ngo-form-grid { grid-template-columns: 1fr; }
          .ngo-btn-bar { flex-direction: column-reverse; align-items: stretch; }
          .ngo-btn-bar .auth-btn { width: 100%; }
        }
      `}</style>

          {submitted ? (
            <div style={{ textAlign: "center" }}>
              <span className="auth-chip"><Clock size={12} /> Under review</span>
              <h1 className="auth-title">Application submitted</h1>
              <p className="auth-subtitle">
                Thank you for registering <strong style={{ color: "var(--auth-text)" }}>{formData.name}</strong>. Our compliance team is now verifying your certification and organisation profile.
              </p>
              <div className="auth-alert auth-alert-info" style={{ textAlign: "left" }}>
                <CheckCircle2 size={17} />
                <span>
                  Accreditation review typically takes 24–48 business hours. We'll notify you at <strong style={{ color: "inherit" }}>{formData.email}</strong> once your account is activated.
                </span>
              </div>
              <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
                <Link to="/login?role=ngo" className="auth-btn" style={{ width: "auto" }}>Go to sign in</Link>
                <Link to="/ngos" className="auth-btn auth-btn-outline" style={{ width: "auto" }}>Browse NGO directory</Link>
              </div>
            </div>
          ) : (
            <>
              <span className="auth-chip"><Building2 size={12} /> Legal aid organisation</span>
              <h1 className="auth-title">Register your organisation</h1>
              <p className="auth-subtitle">Four steps. Your registration certificate will be reviewed before activation.</p>

              <div className="auth-steps" aria-label={`Step ${step} of ${TOTAL_STEPS}`}>
                {stepLabels.map((sl, i) => {
                  const state = step === sl.num ? " is-active" : step > sl.num ? " is-done" : "";
                  return (
                    <React.Fragment key={sl.num}>
                      {i > 0 && <span className={`auth-step-line${step > i ? " is-done" : ""}`} />}
                      <span className={`auth-step${state}`}>
                        <span className="auth-step-dot">{step > sl.num ? <Check size={14} strokeWidth={3} /> : sl.num}</span>
                        <span className="auth-step-label">{sl.title}</span>
                      </span>
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Form Body */}
              <div>
                {error && (
                  <div className="auth-alert auth-alert-error" role="alert">
                    <AlertCircle size={17} />
                    <span>{error}</span>
                  </div>
                )}

                {/* ── STEP 1: ORGANIZATION DETAILS ── */}
                {step === 1 && (
                  <div>
                    <h3 className="ngo-section-title">Step 1: Organization Details</h3>
                    <p className="ngo-section-sub">
                      Provide formal corporate information as registered with the registrar or relevant regulatory department.
                    </p>

                    <div className="ngo-form-grid">
                      <div className="ngo-form-full">
                        <label className="ngo-input-label">
                          Official Organization Name <span>*</span>
                        </label>
                        <input
                          ref={refs.name}
                          type="text"
                          name="name"
                          className="ngo-input"
                          placeholder="e.g. Asma Jahangir Legal Aid Cell"
                          value={formData.name}
                          onChange={updateField}
                        />
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Registration / Charter Number <span>*</span>
                        </label>
                        <input
                          ref={refs.registrationNumber}
                          type="text"
                          name="registrationNumber"
                          className="ngo-input"
                          placeholder="e.g. REG-NGO-10492-PB"
                          value={formData.registrationNumber}
                          onChange={updateField}
                        />
                        <div className="ngo-input-help">Government registration number or trust deed reference.</div>
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Official Headquarters Phone <span>*</span>
                        </label>
                        <input
                          ref={refs.phone}
                          type="text"
                          name="phone"
                          className="ngo-input"
                          placeholder="042-35889900 or 0300-1234567"
                          value={formData.phone}
                          onChange={(e) => handlePhoneChange("phone", e.target.value)}
                        />
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Official Organization Email <span>*</span>
                        </label>
                        <input
                          ref={refs.email}
                          type="email"
                          name="email"
                          className="ngo-input"
                          placeholder="contact@organization.org.pk"
                          value={formData.email}
                          onChange={updateField}
                        />
                        <div className="ngo-input-help">Will be utilized as your portal sign-in identifier.</div>
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Official Website (Optional)
                        </label>
                        <input
                          type="url"
                          name="website"
                          className="ngo-input"
                          placeholder="https://www.organization.org.pk"
                          value={formData.website}
                          onChange={updateField}
                        />
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Province / Federal Territory <span>*</span>
                        </label>
                        <select
                          ref={refs.province}
                          name="province"
                          className="ngo-input"
                          value={formData.province}
                          onChange={updateField}
                        >
                          <option value="">Select Province</option>
                          {PROVINCES.map((p) => (
                            <option key={p} value={p}>{p}</option>
                          ))}
                        </select>
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Principal City <span>*</span>
                        </label>
                        <select
                          ref={refs.city}
                          name="city"
                          className="ngo-input"
                          value={formData.city}
                          onChange={updateField}
                        >
                          <option value="">Select City</option>
                          {PAKISTAN_CITIES.map((c) => (
                            <option key={c} value={c}>{c}</option>
                          ))}
                        </select>
                      </div>

                      <div className="ngo-form-full">
                        <label className="ngo-input-label">
                          Secretariat Physical Address <span>*</span>
                        </label>
                        <input
                          ref={refs.address}
                          type="text"
                          name="address"
                          className="ngo-input"
                          placeholder="Suit No, Floor, Plaza / Building, Street, Area"
                          value={formData.address}
                          onChange={updateField}
                        />
                      </div>

                      {/* Password with Complexity Requirements */}
                      <div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <label className="ngo-input-label">
                            Portal Security Password <span>*</span>
                          </label>
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            style={{
                              background: "none",
                              border: "none",
                              color: "var(--auth-accent)",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              cursor: "pointer",
                              padding: 0,
                            }}
                          >
                            {showPassword ? "Hide" : "Show"}
                          </button>
                        </div>
                        <input
                          ref={refs.password}
                          type={showPassword ? "text" : "password"}
                          name="password"
                          className="ngo-input"
                          placeholder="Enter strong password"
                          value={formData.password}
                          onChange={updateField}
                        />
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Confirm Password <span>*</span>
                        </label>
                        <input
                          ref={refs.confirmPassword}
                          type={showPassword ? "text" : "password"}
                          className="ngo-input"
                          placeholder="Re-type your password"
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                        />
                      </div>

                      <div className="ngo-form-full">
                        <div className="ngo-pwd-checklist">
                          <div style={{ fontSize: "0.8rem", fontWeight: 700, color: "var(--auth-text)", marginBottom: 8 }}>
                            Institutional Security Standard (FR_01-03 Password Policy):
                          </div>
                          <div className="ngo-form-grid" style={{ gap: "4px 18px" }}>
                            <div className={`ngo-pwd-rule ${hasMinLength ? "met" : ""}`}>
                              <span className="ngo-pwd-icon">{hasMinLength ? "✓" : "○"}</span>
                              <span>At least 8 characters in length</span>
                            </div>
                            <div className={`ngo-pwd-rule ${hasUppercase ? "met" : ""}`}>
                              <span className="ngo-pwd-icon">{hasUppercase ? "✓" : "○"}</span>
                              <span>At least 1 uppercase letter (A–Z)</span>
                            </div>
                            <div className={`ngo-pwd-rule ${hasNumber ? "met" : ""}`}>
                              <span className="ngo-pwd-icon">{hasNumber ? "✓" : "○"}</span>
                              <span>At least 1 numeric digit (0–9)</span>
                            </div>
                            <div className={`ngo-pwd-rule ${hasSpecial ? "met" : ""}`}>
                              <span className="ngo-pwd-icon">{hasSpecial ? "✓" : "○"}</span>
                              <span>At least 1 special symbol (!@#$%^&*...)</span>
                            </div>
                            <div className={`ngo-pwd-rule ${isMatch ? "met" : ""}`}>
                              <span className="ngo-pwd-icon">{isMatch ? "✓" : "○"}</span>
                              <span>Passwords match identically</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 2: FOCAL PERSON ── */}
                {step === 2 && (
                  <div>
                    <h3 className="ngo-section-title">Step 2: Authorized Focal Representative</h3>
                    <p className="ngo-section-sub">
                      Identify the designated legal officer, director, or focal liaison authorized to manage pro-bono intakes.
                    </p>

                    <div className="ngo-form-grid">
                      <div>
                        <label className="ngo-input-label">
                          Full Legal Name <span>*</span>
                        </label>
                        <input
                          ref={refs.focalName}
                          type="text"
                          name="focalName"
                          className="ngo-input"
                          placeholder="e.g. Barrister Salman Tariq"
                          value={formData.focalName}
                          onChange={updateField}
                        />
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Official Designation <span>*</span>
                        </label>
                        <input
                          ref={refs.focalDesignation}
                          type="text"
                          name="focalDesignation"
                          className="ngo-input"
                          placeholder="e.g. Director Legal Aid / Executive Secretary"
                          value={formData.focalDesignation}
                          onChange={updateField}
                        />
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Pakistani CNIC (National Identity Card) <span>*</span>
                        </label>
                        <input
                          ref={refs.focalCnic}
                          type="text"
                          name="focalCnic"
                          className="ngo-input"
                          placeholder="35201-1234567-1"
                          value={formData.focalCnic}
                          onKeyDown={handleCnicKeyDown}
                          onChange={handleCnicChange}
                          maxLength={15}
                        />
                        <div className="ngo-input-help">
                          Numeric only. Formatted as 13 digits: <strong>XXXXX-XXXXXXX-X</strong>
                        </div>
                      </div>

                      <div>
                        <label className="ngo-input-label">
                          Direct Mobile / Telephone <span>*</span>
                        </label>
                        <input
                          ref={refs.focalPhone}
                          type="text"
                          name="focalPhone"
                          className="ngo-input"
                          placeholder="03001234567"
                          value={formData.focalPhone}
                          maxLength={11}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/\D/g, "").slice(0, 11);
                            setFormData((prev) => ({ ...prev, focalPhone: cleaned }));
                            setError("");
                          }}
                        />
                        <div className="ngo-input-help">Used for urgent court date escalation and SMS alerts (11 digits, e.g. 03001234567).</div>
                      </div>

                      <div className="ngo-form-full">
                        <label className="ngo-input-label">
                          Operating / Legal Intake Hours
                        </label>
                        <input
                          type="text"
                          name="operatingHours"
                          className="ngo-input"
                          placeholder="e.g. Monday - Friday, 09:00 AM - 05:00 PM"
                          value={formData.operatingHours}
                          onChange={updateField}
                        />
                      </div>

                      <div className="ngo-form-full">
                        <label className="ngo-input-label">
                          Institutional Mission & Background Overview
                        </label>
                        <textarea
                          name="bio"
                          className="ngo-input"
                          rows={3}
                          placeholder="Briefly describe the foundation, legal history, court achievements, and core vulnerable populations served by your organization..."
                          value={formData.bio}
                          onChange={updateField}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 3: LEGAL SCOPE & SERVICES ── */}
                {step === 3 && (
                  <div>
                    <h3 className="ngo-section-title">Step 3: Legal Focus Areas & Pro Bono Services</h3>
                    <p className="ngo-section-sub">
                      Select the specialized defense categories and legal support mechanisms your team provides to citizens.
                    </p>

                    <div ref={refs.focusAreas} style={{ marginBottom: 28 }}>
                      <label className="ngo-input-label" style={{ marginBottom: 12 }}>
                        Specialized Legal Practice & Human Rights Focus <span>*</span>
                      </label>
                      <div className="ngo-badge-grid">
                        {FOCUS_AREAS.map((area) => {
                          const isSelected = formData.focusAreas.includes(area);
                          return (
                            <div
                              key={area}
                              className={`ngo-badge-option ${isSelected ? "selected" : ""}`}
                              onClick={() => toggleArray("focusAreas", area)}
                            >
                              <div className="ngo-custom-checkbox">
                                {isSelected ? "✓" : ""}
                              </div>
                              <span>{area}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    <div ref={refs.servicesOffered}>
                      <label className="ngo-input-label" style={{ marginBottom: 12 }}>
                        Pro Bono Legal Services Rendered <span>*</span>
                      </label>
                      <div className="ngo-badge-grid">
                        {SERVICES.map((srv) => {
                          const isSelected = formData.servicesOffered.includes(srv);
                          return (
                            <div
                              key={srv}
                              className={`ngo-badge-option ${isSelected ? "selected" : ""}`}
                              onClick={() => toggleArray("servicesOffered", srv)}
                            >
                              <div className="ngo-custom-checkbox">
                                {isSelected ? "✓" : ""}
                              </div>
                              <span>{srv}</span>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                )}

                {/* ── STEP 4: VERIFICATION & CERTIFICATE ── */}
                {step === 4 && (
                  <div>
                    <h3 className="ngo-section-title">Step 4: Government Registration Certificate</h3>
                    <p className="ngo-section-sub">
                      Attach official documentation confirming legal standing (Trust Deed, Societies Registration Certificate, or SECP Section 42 License).
                    </p>

                    <div ref={refs.officialDocument} style={{ marginBottom: 24 }}>
                      <label className="ngo-input-label">
                        Official Certificate Document (PDF or Clear Scanned Image) <span>*</span>
                      </label>
                      <label className={`ngo-file-box ${formData.officialDocument ? "has-file" : ""}`}>
                        <input
                          type="file"
                          accept=".pdf,.jpg,.jpeg,.png"
                          onChange={handleFile}
                          style={{ display: "none" }}
                        />
                        <div className="ngo-file-icon"></div>
                        <div style={{ fontSize: "0.95rem", fontWeight: 600, color: "var(--auth-text)" }}>
                          {formData.officialDocument
                            ? formData.officialDocument.name
                            : "Click or Drag File to Upload Certificate"}
                        </div>
                        <div style={{ fontSize: "0.8rem", color: "var(--auth-text-3)", marginTop: 4 }}>
                          Supported file types: PDF, JPG, PNG (Max file size: 10 MB)
                        </div>
                        {formData.officialDocument && (
                          <div className="ngo-file-name">
                            ✓ Document attached successfully ({(formData.officialDocument.size / (1024 * 1024)).toFixed(2)} MB)
                          </div>
                        )}
                      </label>
                    </div>

                    <div
                      style={{
                        background: "var(--auth-subtle)",
                        border: "1px solid var(--auth-border)",
                        borderRadius: "8px",
                        padding: "16px 20px",
                        fontSize: "0.85rem",
                        color: "var(--auth-text-2)",
                        lineHeight: 1.5,
                      }}
                    >
                      <div style={{ fontWeight: 700, color: "var(--auth-text)", marginBottom: 4 }}>
                        Legal Undertaking & Institutional Attestation:
                      </div>
                      By submitting this registration, you certify that all information provided is accurate and corresponds to an authentic, legally constituted non-governmental or legal aid organization in Pakistan. Submission of fraudulent documentation is punishable under Pakistani statutory law.
                    </div>
                  </div>
                )}

                {/* ── Inline Error Summary (above buttons) ── */}
                {fieldErrors.length > 0 && (
                  <div className="ngo-err-summary">
                    <div className="ngo-err-summary-title">
                      
                      <span>Please resolve the following before continuing:</span>
                    </div>
                    <ul>
                      {fieldErrors.map((e, i) => (
                        <li key={i}>{e}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Navigation Buttons */}
                <div className="ngo-btn-bar">
                  {step > 1 ? (
                    <button type="button" className="auth-btn auth-btn-outline" onClick={prev}>
                      <ArrowLeft size={16} /> Previous
                    </button>
                  ) : (
                    <span style={{ fontSize: 13.5, color: "var(--auth-text-3)" }}>
                      Already accredited?{" "}
                      <Link to="/login?role=ngo" className="auth-link">Sign in</Link>
                    </span>
                  )}

                  {step < TOTAL_STEPS ? (
                    <button type="button" className="auth-btn" onClick={next} disabled={checking}>
                      {checking ? <><span className="btn-spinner" />Checking…</> : <>Continue <ArrowRight size={16} /></>}
                    </button>
                  ) : (
                    <button
                      type="button"
                      className="auth-btn"
                      onClick={handleSubmit}
                      disabled={loading}
                    >
                      {loading ? <><span className="btn-spinner" />Submitting registration…</> : "Submit Registration for Verification"}
                    </button>
                  )}
                </div>
              </div>
            </>
          )}

      {/* ── Bottom Toast ── */}
      {toast && (
        <div className="ngo-toast">
          Please complete all required fields to continue.
        </div>
      )}
    </AuthLayout>
  );
};

export default NGOSignup;
