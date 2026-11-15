import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import AuthLayout from "../../components/AuthLayout";
import {
  ShieldCheck,
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Activity,
  FileCheck
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

const AdminLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login({ email, password }, "admin");

    if (result.success) {
      navigate("/admin/dashboard");
    } else {
      setError(result.error || "Invalid administrator credentials. Access denied.");
    }
    setLoading(false);
  };

  return (
    <AuthLayout {...ADMIN_LAYOUT}>
      <span className="auth-chip">
        <ShieldCheck size={12} />
        Restricted access
      </span>
      <h1 className="auth-title">Administrator sign in</h1>
      <p className="auth-subtitle">Authorised LegalLink staff only. Sign-in attempts are logged.</p>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="auth-field">
          <label className="auth-label" htmlFor="admin-email">Administrator email</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><Mail size={17} /></span>
            <input
              id="admin-email"
              type="email"
              autoComplete="username"
              className="auth-input"
              placeholder="admin@legallink.pk"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label className="auth-label" htmlFor="admin-password">Password</label>
            <Link to="/admin/forgot-password" className="auth-link" style={{ fontSize: "12.5px" }}>
              Forgot password?
            </Link>
          </div>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><Lock size={17} /></span>
            <input
              id="admin-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="auth-input has-action"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <button
              type="button"
              className="auth-input-action"
              onClick={() => setShowPassword(!showPassword)}
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
            </button>
          </div>
        </div>

        <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: 8 }}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" />
              <span>Verifying…</span>
            </>
          ) : (
            <>
              <span>Sign in to console</span>
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      <div className="auth-switch">
        Not an administrator?{" "}
        <Link to="/login" className="auth-link">Go to user sign in</Link>
      </div>
    </AuthLayout>
  );
};

export default AdminLogin;
