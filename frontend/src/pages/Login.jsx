import React, { useState } from "react";
import { useNavigate, Link, useSearchParams } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import AuthLayout from "../components/AuthLayout";
import GoogleSignInButton from "../components/GoogleSignInButton";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Clock,
  Ban,
  User,
  Scale,
  Building2,
  ShieldCheck,
} from "lucide-react";

const ROLE_OPTIONS = [
  {
    key: "user",
    shortLabel: "Citizen",
    icon: User,
    placeholder: "you@example.com",
    dashboardPath: "/user/dashboard",
  },
  {
    key: "lawyer",
    shortLabel: "Advocate",
    icon: Scale,
    placeholder: "advocate@barcouncil.pk",
    dashboardPath: "/lawyer/dashboard",
  },
  {
    key: "ngo",
    shortLabel: "Legal Aid",
    icon: Building2,
    placeholder: "contact@legalaidsociety.org",
    dashboardPath: "/ngo/dashboard",
  },
];

const Login = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get("role") || "user";
  const validRole = ["user", "lawyer", "ngo"].includes(initialRole) ? initialRole : "user";

  const [role, setRole] = useState(validRole);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  // Shows why someone was signed out (for example, an admin deactivated the account)
  const [error, setError] = useState(() => {
    try {
      const reason = sessionStorage.getItem("ll_signed_out_reason");
      if (reason) sessionStorage.removeItem("ll_signed_out_reason");
      return reason || "";
    } catch (e) {
      return "";
    }
  });
  const [loading, setLoading] = useState(false);

  const { login } = useAuth();
  const navigate = useNavigate();

  const currentRole = ROLE_OPTIONS.find((r) => r.key === role) || ROLE_OPTIONS[0];

  const handleRoleChange = (newRole) => {
    setRole(newRole);
    setSearchParams({ role: newRole });
    setError("");
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!email.trim() || !password) {
      setError("Please provide both your registered email address and password.");
      return;
    }

    setLoading(true);
    try {
      const result = await login({ email: email.trim(), password }, role);
      if (result.success) {
        navigate(currentRole.dashboardPath);
      } else {
        setError(result.error || "Authentication failed. Please verify your credentials.");
      }
    } catch (err) {
      setError("An unexpected connection error occurred. Please verify your network and retry.");
    } finally {
      setLoading(false);
    }
  };

  const lower = error.toLowerCase();
  const isPendingError = lower.includes("pending") || lower.includes("review") || lower.includes("approval");
  const isBlockedError = lower.includes("blocked") || lower.includes("suspended");
  const AlertIcon = isPendingError ? Clock : isBlockedError ? Ban : AlertCircle;

  return (
    <AuthLayout>
      <span className="auth-chip">
        <ShieldCheck size={12} />
        Secure sign in
      </span>
      <h1 className="auth-title">Welcome back</h1>
      <p className="auth-subtitle">Sign in to continue to your LegalLink account.</p>

      {/* Account type */}
      <div className="auth-segmented" role="tablist" aria-label="Account type">
        {ROLE_OPTIONS.map((opt) => {
          const Icon = opt.icon;
          const active = role === opt.key;
          return (
            <button
              key={opt.key}
              type="button"
              role="tab"
              aria-selected={active}
              className={`auth-segment${active ? " is-active" : ""}`}
              onClick={() => handleRoleChange(opt.key)}
            >
              <Icon size={15} />
              <span>{opt.shortLabel}</span>
            </button>
          );
        })}
      </div>

      {error && (
        <div className={`auth-alert ${isPendingError ? "auth-alert-warning" : "auth-alert-error"}`} role="alert">
          <AlertIcon size={17} />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} noValidate>
        <div className="auth-field">
          <label className="auth-label" htmlFor="login-email">Email address</label>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><Mail size={17} /></span>
            <input
              id="login-email"
              type="email"
              autoComplete="email"
              className="auth-input"
              placeholder={currentRole.placeholder}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>
        </div>

        <div className="auth-field">
          <div className="auth-field-row">
            <label className="auth-label" htmlFor="login-password">Password</label>
            <Link to="/forgot-password" className="auth-link" style={{ fontSize: "12.5px" }}>
              Forgot password?
            </Link>
          </div>
          <div className="auth-input-wrap">
            <span className="auth-input-icon"><Lock size={17} /></span>
            <input
              id="login-password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              className="auth-input has-action"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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

        <button type="submit" className="auth-btn" disabled={loading} style={{ marginTop: "8px" }}>
          {loading ? (
            <>
              <span className="spinner-border spinner-border-sm" role="status" />
              <span>Signing in…</span>
            </>
          ) : (
            <>
              <span>Sign in</span>
              <ArrowRight size={17} />
            </>
          )}
        </button>
      </form>

      {role === "user" ? (
        <>
          <div className="auth-divider">or</div>
          <div className="auth-google">
            <GoogleSignInButton
              role="user"
              onSuccessRedirect="/user/dashboard"
              onError={(err) => setError(err)}
              text="signin_with"
            />
          </div>
        </>
      ) : (
        <div className="auth-note" style={{ marginTop: "18px" }}>
          <ShieldCheck size={16} />
          <span>
            {role === "lawyer"
              ? "Advocate accounts are verified against Bar Council records."
              : "Legal aid accounts are reviewed before activation."}
          </span>
        </div>
      )}

      <div className="auth-switch">
        Don't have an account?{" "}
        <Link to={`/signup?role=${role}`} className="auth-link">
          Create one
        </Link>
      </div>
    </AuthLayout>
  );
};

export default Login;
