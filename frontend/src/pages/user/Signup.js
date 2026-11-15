import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AuthLayout from "../../components/AuthLayout";
import GoogleSignInButton from "../../components/GoogleSignInButton";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  User,
  Phone,
  CreditCard,
  MapPin,
  ArrowRight,
  AlertCircle,
  Check,
  X,
  Bot,
  Scale,
  HeartHandshake,
  UserPlus,
  MailCheck
} from "lucide-react";
import { API_URL } from "../../config";

const UserSignup = () => {
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    cnic: "",
    address: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState({ email: "", phone: "" });
  const [checking, setChecking] = useState({ email: false, phone: false });

  // OTP state
  const [otpStep, setOtpStep] = useState(false);   // false = form, true = OTP entry
  const [otpCode, setOtpCode] = useState("");
  const [otpDevNotice, setOtpDevNotice] = useState("");
  const [sendingOtp, setSendingOtp] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);     // countdown seconds

  const { signup } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;

    // Handle CNIC formatting (auto-add dashes: XXXXX-XXXXXXX-X)
    if (name === "cnic") {
      let cleaned = value.replace(/\D/g, "");
      if (cleaned.length > 13) cleaned = cleaned.slice(0, 13);

      let formatted = "";
      if (cleaned.length <= 5) {
        formatted = cleaned;
      } else if (cleaned.length <= 12) {
        formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
      } else {
        formatted = `${cleaned.slice(0, 5)}-${cleaned.slice(5, 12)}-${cleaned.slice(12, 13)}`;
      }

      setFormData({ ...formData, [name]: formatted });
      return;
    }

    // Handle phone (+923xxxxxxxxx)
    if (name === "phone") {
      let cleaned = value.replace(/[^0-9+]/g, "");
      if (cleaned.length > 0 && !cleaned.startsWith("+")) {
        cleaned = "+" + cleaned;
      }
      if (cleaned.length > 13) cleaned = cleaned.slice(0, 13);
      setFormData({ ...formData, [name]: cleaned });
      if (fieldErrors.phone) setFieldErrors({ ...fieldErrors, phone: "" });
      return;
    }

    setFormData({ ...formData, [name]: value });
    if (fieldErrors[name]) {
      setFieldErrors({ ...fieldErrors, [name]: "" });
    }
  };

  const checkEmailExists = async () => {
    if (!formData.email) return;
    setChecking((prev) => ({ ...prev, email: true }));
    try {
      const response = await fetch(`${API_URL}/auth/check-exists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await response.json();
      if (data.exists) {
        setFieldErrors((prev) => ({ ...prev, email: data.message }));
      } else {
        setFieldErrors((prev) => ({ ...prev, email: "" }));
      }
    } catch (err) {
      console.error("Check email error:", err);
    } finally {
      setChecking((prev) => ({ ...prev, email: false }));
    }
  };

  const checkPhoneExists = async () => {
    if (!formData.phone) return;
    setChecking((prev) => ({ ...prev, phone: true }));
    try {
      const response = await fetch(`${API_URL}/auth/check-exists`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: formData.phone }),
      });
      const data = await response.json();
      if (data.exists) {
        setFieldErrors((prev) => ({ ...prev, phone: data.message }));
      } else {
        setFieldErrors((prev) => ({ ...prev, phone: "" }));
      }
    } catch (err) {
      console.error("Check phone error:", err);
    } finally {
      setChecking((prev) => ({ ...prev, phone: false }));
    }
  };

  const validateEmail = (email) => {
    const gmailRegex = /^[a-zA-Z0-9._%+-]+@gmail\.com$/;
    return gmailRegex.test(email);
  };

  const validatePhone = (phone) => {
    const phoneRegex = /^\+923[0-9]{9}$/;
    return phoneRegex.test(phone);
  };

  const validateCNIC = (cnic) => {
    const cnicRegex = /^[0-9]{5}-[0-9]{7}-[0-9]{1}$/;
    return cnicRegex.test(cnic);
  };

  // Password checklist rules
  const hasMinLength = formData.password.length >= 8;
  const hasUppercase = /[A-Z]/.test(formData.password);
  const hasNumber = /[0-9]/.test(formData.password);
  const hasSpecial = /[!@#$%^&*(),.?":{}|<>]/.test(formData.password);
  const passwordsMatch = formData.password && formData.password === formData.confirmPassword;

  // ── OTP sender ────────────────────────────────────────────────────────────
  const sendOtp = async () => {
    setSendingOtp(true);
    setError("");
    try {
      const res = await fetch(`${API_URL}/auth/user/send-otp`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: formData.email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed to send OTP.");
      setOtpStep(true);
      if (!data.emailSent && data.devCode) {
        setOtpCode(data.devCode);
        setOtpDevNotice(`Notice: Fallback OTP auto-filled for testing: ${data.devCode}`);
      } else {
        setOtpDevNotice("");
        setOtpCode("");
      }
      // Start 120-second resend timer
      setOtpTimer(120);
      const interval = setInterval(() => {
        setOtpTimer(t => { if (t <= 1) { clearInterval(interval); return 0; } return t - 1; });
      }, 1000);
    } catch (err) {
      setError(err.message);
    } finally {
      setSendingOtp(false);
    }
  };

  // ── Two-phase submit ──────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    // Phase 1: Validate form → send OTP
    if (!otpStep) {
      if (fieldErrors.email || fieldErrors.phone) {
        setError("Please resolve the highlighted field errors before submitting.");
        return;
      }
      if (!validateEmail(formData.email)) {
        setError("Email must be a valid Gmail address (example@gmail.com).");
        return;
      }
      if (!validatePhone(formData.phone)) {
        setError("Phone number must follow Pakistan format: +923xxxxxxxxx (13 characters total).");
        return;
      }
      if (!validateCNIC(formData.cnic)) {
        setError("CNIC must follow format: 12345-1234567-1 (13 digits total).");
        return;
      }
      if (!hasMinLength || !hasUppercase || !hasNumber || !hasSpecial) {
        setError("Password does not meet the mandatory security requirements.");
        return;
      }
      if (!passwordsMatch) {
        setError("Passwords do not match. Please verify both fields.");
        return;
      }
      // Already registered? Say so now, before the email code step
      try {
        const res = await fetch(`${API_URL}/auth/check-available`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role: "user", email: formData.email.trim(), cnic: formData.cnic }),
        });
        const data = await res.json();
        const taken = data.taken ? Object.values(data.taken)[0] : "";
        if (taken) {
          setError(taken);
          return;
        }
      } catch (err) {
        /* the final step checks again */
      }
      await sendOtp();
      return;
    }

    // Phase 2: Verify OTP → create account
    if (!otpCode || otpCode.length !== 6) {
      setError("Please enter the 6-digit code sent to your email.");
      return;
    }

    setLoading(true);
    const { confirmPassword, ...userData } = formData;
    const result = await signup({ ...userData, verificationCode: otpCode }, "user");

    if (result.success) {
      navigate("/user/dashboard");
    } else {
      setError(result.error || "Signup failed. Please try again.");
    }
    setLoading(false);
  };

  const policy = [
    [hasMinLength, "At least 8 characters"],
    [hasUppercase, "1 uppercase letter"],
    [hasNumber, "1 number"],
    [hasSpecial, "1 special character"],
  ];

  const field = (id, label, icon, input, extra = null) => (
    <div className="auth-field" style={{ marginBottom: 0 }}>
      <label className="auth-label" htmlFor={id}>{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon">{icon}</span>
        {input}
        {extra}
      </div>
    </div>
  );

  const spinner = (
    <span className="auth-input-action" style={{ pointerEvents: "none" }}>
      <span className="spinner-border spinner-border-sm" style={{ width: 14, height: 14 }} />
    </span>
  );

  return (
    <AuthLayout
      wide
      backTo="/signup?role=user"
      backLabel="Account types"
      eyebrow="Citizen registration"
      title={<>Legal help, <em>on your side</em>.</>}
      description="Create a free citizen account to get legal guidance, hire verified advocates and track your cases and hearings in one place."
      highlights={[
        { icon: Bot, title: "Bilingual AI legal counsel", text: "Instant statute queries and step-by-step procedural guidance." },
        { icon: Scale, title: "Verified Bar Council advocates", text: "Consult and hire High Court and district practitioners." },
        { icon: HeartHandshake, title: "Pro bono NGO access", text: "Free representation for eligible citizens through accredited NGOs." },
      ]}
    >
      <span className="auth-chip">
        <UserPlus size={12} />
        Citizen account · Free
      </span>
      <h1 className="auth-title">Create your citizen account</h1>
      <p className="auth-subtitle">Enter your details exactly as they appear on your CNIC.</p>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="signup-form-grid" style={{ marginBottom: 16 }}>
          {field("user-name", "Full name", <User size={16} />,
            <input id="user-name" type="text" name="name" className="auth-input" placeholder="e.g. Muhammad Ali"
              value={formData.name} onChange={handleChange} required />
          )}
          {field("user-cnic", "CNIC number", <CreditCard size={16} />,
            <input id="user-cnic" type="text" name="cnic" className="auth-input" placeholder="XXXXX-XXXXXXX-X"
              value={formData.cnic} onChange={handleChange} required maxLength={15} />
          )}
        </div>

        <div className="signup-form-grid" style={{ marginBottom: 16 }}>
          <div>
            {field("user-email", "Gmail address", <Mail size={16} />,
              <input id="user-email" type="email" name="email" className="auth-input" placeholder="example@gmail.com"
                value={formData.email} onChange={handleChange} onBlur={checkEmailExists} required />,
              checking.email ? spinner : null
            )}
            {fieldErrors.email && <span className="auth-error-text">{fieldErrors.email}</span>}
          </div>
          <div>
            {field("user-phone", "Mobile number", <Phone size={16} />,
              <input id="user-phone" type="tel" name="phone" className="auth-input" placeholder="+923XXXXXXXXX"
                value={formData.phone} onChange={handleChange} onBlur={checkPhoneExists} required maxLength={13} />,
              checking.phone ? spinner : null
            )}
            {fieldErrors.phone && <span className="auth-error-text">{fieldErrors.phone}</span>}
          </div>
        </div>

        <div className="auth-field">
          <label className="auth-label" htmlFor="user-address">Residential address</label>
          <div className="auth-input-wrap is-textarea">
            <textarea id="user-address" name="address" className="auth-textarea" placeholder="House / street, sector, city"
              value={formData.address} onChange={handleChange} rows="2" required />
            <span className="auth-input-icon"><MapPin size={16} /></span>
          </div>
        </div>

        <div className="signup-form-grid" style={{ marginBottom: 12 }}>
          {field("user-password", "Password", <Lock size={16} />,
            <input id="user-password" type={showPassword ? "text" : "password"} name="password" className="auth-input has-action"
              placeholder="Create a strong password" value={formData.password} onChange={handleChange} required autoComplete="new-password" />,
            <button type="button" className="auth-input-action" onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}>
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
          {field("user-confirm-password", "Confirm password", <Lock size={16} />,
            <input id="user-confirm-password" type={showConfirmPassword ? "text" : "password"} name="confirmPassword"
              className="auth-input has-action" placeholder="Repeat password" value={formData.confirmPassword}
              onChange={handleChange} required autoComplete="new-password" />,
            <button type="button" className="auth-input-action" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              aria-label={showConfirmPassword ? "Hide password" : "Show password"}>
              {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          )}
        </div>

        <div className="auth-note" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 6, justifyContent: "stretch", marginBottom: 20 }}>
          {policy.map(([ok, label]) => (
            <div key={label} className="policy-check-item" style={{ color: ok ? "#16A34A" : "var(--auth-text-3)" }}>
              {ok ? <Check size={14} strokeWidth={2.5} /> : <X size={14} />}
              <span>{label}</span>
            </div>
          ))}
        </div>

        {otpStep && (
          <div className="auth-alert auth-alert-success" style={{ display: "block", padding: "16px 18px" }}>
            {otpDevNotice ? (
              <p style={{ margin: "0 0 10px", fontSize: 12.5, fontWeight: 600, color: "inherit" }}>{otpDevNotice}</p>
            ) : (
              <p style={{ margin: "0 0 10px", fontSize: 13, color: "inherit" }}>
                <MailCheck size={15} style={{ verticalAlign: "-3px", marginRight: 6 }} />
                We sent a 6-digit code to <strong style={{ color: "inherit" }}>{formData.email}</strong>. It expires in 15 minutes.
              </p>
            )}
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              placeholder="000000"
              aria-label="Verification code"
              value={otpCode}
              onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
              className="auth-input"
              style={{ fontSize: 22, letterSpacing: "0.35em", textAlign: "center", fontWeight: 700, marginBottom: 10 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12.5 }}>
              <button type="button" className="auth-link" disabled={otpTimer > 0 || sendingOtp} onClick={sendOtp}
                style={{ background: "none", border: "none", padding: 0, opacity: otpTimer > 0 ? 0.6 : 1, cursor: otpTimer > 0 ? "default" : "pointer" }}>
                {otpTimer > 0 ? `Resend in ${otpTimer}s` : "Resend code"}
              </button>
              <button type="button" onClick={() => { setOtpStep(false); setOtpCode(""); setError(""); }}
                style={{ background: "none", border: "none", padding: 0, color: "var(--auth-text-3)", cursor: "pointer" }}>
                ← Edit details
              </button>
            </div>
          </div>
        )}

        <button type="submit" className="auth-btn" disabled={loading || sendingOtp}>
          {loading || sendingOtp ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" />
              <span>{sendingOtp ? "Sending code…" : "Creating account…"}</span>
            </>
          ) : (
            <>
              <span>{otpStep ? "Verify & create account" : "Send verification code"}</span>
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      {!otpStep && (
        <>
          <div className="auth-divider">or</div>
          <div className="auth-google">
            <GoogleSignInButton
              role="user"
              onSuccessRedirect="/user/dashboard"
              onError={(err) => setError(err)}
              text="signup_with"
            />
          </div>
        </>
      )}

      <div className="auth-switch">
        Already have an account?{" "}
        <Link to="/login?role=user" className="auth-link">Sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default UserSignup;
