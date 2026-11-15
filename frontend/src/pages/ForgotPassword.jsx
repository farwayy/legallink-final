import React, { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { authAPI } from "../services/api";
import AuthLayout from "../components/AuthLayout";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Scale,
  Building2,
  User,
  ShieldCheck,
  KeyRound,
  Clock,
  ArrowRight
} from "lucide-react";

const ROLE_CONFIG = {
  user: {
    label: "Citizen / Client",
    shortLabel: "Citizen",
    loginPath: "/login?role=user",
    icon: User,
    badge: "Public Access"
  },
  lawyer: {
    label: "Legal Counsel / Lawyer",
    shortLabel: "Advocate",
    loginPath: "/login?role=lawyer",
    icon: Scale,
    badge: "Advocate Bar"
  },
  ngo: {
    label: "Legal Aid Society (NGO)",
    shortLabel: "Legal Aid",
    loginPath: "/login?role=ngo",
    icon: Building2,
    badge: "Pro Bono Portal"
  }
};

const ForgotPassword = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get("role") || "user";
  const [role, setRole] = useState(
    ["user", "lawyer", "ngo"].includes(initialRole) ? initialRole : "user"
  );
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setSearchParams({ role: newRole });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.forgotPassword({
        email: email.trim(),
        role: role
      });

      if (response.data?.success) {
        setSubmitted(true);
      } else {
        setError(response.data?.message || "Failed to process password reset request.");
      }
    } catch (err) {
      console.error("Forgot password error:", err);
      // Explicit feedback: display 404 or backend message in clear red alert
      const errorMessage =
        err.response?.data?.message ||
        "No registered account found with this email for the selected role. Please check your email or select the correct account type.";
      setError(errorMessage);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  const currentRoleConfig = ROLE_CONFIG[role] || ROLE_CONFIG.user;

  return (
    <AuthLayout
      backTo={currentRoleConfig.loginPath}
      backLabel="Back to sign in"
      eyebrow="Account recovery"
      title={<>Regain access, <em>securely</em>.</>}
      description="Password resets are verified against the account type you select, and each reset link can only be used once."
      highlights={[
        { icon: ShieldCheck, title: "Encrypted, single-use links", text: "Reset tokens are signed and invalidated as soon as they are used." },
        { icon: Clock, title: "30-minute expiry", text: "Unused links expire automatically to protect your account." },
        { icon: KeyRound, title: "Role-isolated recovery", text: "Citizen, advocate and NGO accounts are recovered separately." },
      ]}
    >
      <span className="auth-chip">
        <KeyRound size={12} />
        Password assistance
      </span>
      <h1 className="auth-title">Reset your password</h1>
      <p className="auth-subtitle">
        Choose your account type and enter your registered email. We'll send you a secure reset link.
      </p>

      {!submitted && (
        <div className="auth-segmented" role="tablist" aria-label="Account type">
          {Object.entries(ROLE_CONFIG).map(([key, config]) => {
            const Icon = config.icon;
            const active = role === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                className={`auth-segment${active ? " is-active" : ""}`}
                onClick={() => handleRoleChange(key)}
              >
                <Icon size={15} />
                <span>{config.shortLabel}</span>
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} />
          <div>
            <strong style={{ display: "block", color: "inherit" }}>Couldn't send the reset link</strong>
            <span>{error}</span>
          </div>
        </div>
      )}

      {submitted ? (
        <>
          <div className="auth-alert auth-alert-success" role="status">
            <CheckCircle2 size={17} />
            <div>
              <strong style={{ display: "block", color: "inherit" }}>Check your inbox</strong>
              <span>
                We've sent a reset link to <strong style={{ color: "inherit" }}>{email}</strong> for your{" "}
                {currentRoleConfig.shortLabel.toLowerCase()} account. It expires in 30 minutes — check your spam folder if you
                don't see it.
              </span>
            </div>
          </div>
          <Link to={currentRoleConfig.loginPath} className="auth-btn" style={{ marginBottom: 10 }}>
            <ArrowLeft size={17} />
            <span>Return to sign in</span>
          </Link>
          <button
            type="button"
            className="auth-btn auth-btn-outline"
            onClick={() => {
              setSubmitted(false);
              setEmail("");
            }}
          >
            Use a different email or account type
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="reset-email" className="auth-label">Email address</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon"><Mail size={17} /></span>
              <input
                id="reset-email"
                type="email"
                autoComplete="email"
                className="auth-input"
                placeholder="name@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: 8 }}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                <span>Sending link…</span>
              </>
            ) : (
              <>
                <span>Send reset link</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
      )}

      <div className="auth-switch">
        Remembered it?{" "}
        <Link to={currentRoleConfig.loginPath} className="auth-link">Back to sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default ForgotPassword;
