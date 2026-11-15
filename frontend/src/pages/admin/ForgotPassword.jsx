import React, { useState } from "react";
import { Link } from "react-router-dom";
import { authAPI } from "../../services/api";
import AuthLayout from "../../components/AuthLayout";
import {
  Mail,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  KeyRound,
  Clock,
  Activity,
  ShieldCheck,
  FileCheck,
  ArrowRight
} from "lucide-react";

const ADMIN_LAYOUT = {
  eyebrow: "Administration console",
  title: <>Platform <em>governance</em>.</>,
  description: "Restricted access for LegalLink administrators who verify advocates, accredit legal aid organisations and oversee platform integrity.",
  highlights: [
    { icon: FileCheck, title: "Credential verification", text: "Review Bar Council and NGO registration documents." },
    { icon: Activity, title: "Platform oversight", text: "Monitor cases, disputes and flagged reviews in real time." },
    { icon: ShieldCheck, title: "Audited access", text: "Every administrative action is recorded in the audit log." },
  ],
};

const AdminForgotPassword = () => {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim()) {
      setError("Please enter your registered system administrator email address.");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.forgotPassword({
        email: email.trim(),
        role: "admin"
      });

      if (response.data?.success) {
        setSubmitted(true);
      } else {
        setError(response.data?.message || "Failed to process administrator password recovery.");
      }
    } catch (err) {
      console.error("Admin forgot password error:", err);
      const errorMessage =
        err.response?.data?.message ||
        "No registered administrator account found with this email. Unauthorized recovery attempts are logged.";
      setError(errorMessage);
      setSubmitted(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthLayout {...ADMIN_LAYOUT} backTo="/admin/login" backLabel="Back to sign in">
      <span className="auth-chip">
        <KeyRound size={12} />
        Administrator recovery
      </span>
      <h1 className="auth-title">Reset administrator password</h1>
      <p className="auth-subtitle">Enter your administrator email and we'll send a single-use reset link.</p>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {submitted ? (
        <>
          <div className="auth-alert auth-alert-success" role="status">
            <CheckCircle2 size={17} />
            <div>
              <strong style={{ display: "block", color: "inherit" }}>Check your inbox</strong>
              <span>
                A reset link has been sent to <strong style={{ color: "inherit" }}>{email}</strong>. It expires in 30 minutes.
              </span>
            </div>
          </div>
          <Link to="/admin/login" className="auth-btn" style={{ marginBottom: 10 }}>
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
            Use a different email
          </button>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          <div className="auth-field">
            <label htmlFor="admin-reset-email" className="auth-label">Administrator email</label>
            <div className="auth-input-wrap">
              <span className="auth-input-icon"><Mail size={17} /></span>
              <input
                id="admin-reset-email"
                type="email"
                autoComplete="email"
                className="auth-input"
                placeholder="admin@legallink.pk"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </div>

          <div className="auth-note" style={{ justifyContent: "flex-start", marginBottom: 16 }}>
            <Clock size={16} />
            <span>Reset links expire after 30 minutes and can be used once.</span>
          </div>

          <button type="submit" className="auth-btn" disabled={loading}>
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
        <Link to="/admin/login" className="auth-link">Back to sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default AdminForgotPassword;
