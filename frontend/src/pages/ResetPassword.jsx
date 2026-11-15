import React, { useState, useEffect } from "react";
import { Link, useSearchParams, useNavigate } from "react-router-dom";
import { authAPI } from "../services/api";
import AuthLayout from "../components/AuthLayout";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  ArrowRight,
  ArrowLeft,
  KeyRound,
  Clock
} from "lucide-react";

const ROLE_LOGIN_PATHS = {
  user: { path: "/login?role=user", label: "Citizen / Client Login", shortLabel: "Citizen" },
  lawyer: { path: "/login?role=lawyer", label: "Lawyer Login", shortLabel: "Advocate" },
  ngo: { path: "/login?role=ngo", label: "NGO Portal Login", shortLabel: "Legal Aid" },
  admin: { path: "/admin/login", label: "Admin Login", shortLabel: "Admin" }
};

const ResetPassword = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get("token") || "";
  const role = searchParams.get("role") || "user";

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const roleInfo = ROLE_LOGIN_PATHS[role] || ROLE_LOGIN_PATHS.user;

  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate(roleInfo.path);
      }, 3500);
      return () => clearTimeout(timer);
    }
  }, [success, navigate, roleInfo.path]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");

    if (!token) {
      setError("Password reset security token is missing from your link. Please request a new one.");
      return;
    }

    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError("Your new password needs at least 8 characters, with a letter and a number.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please verify both fields.");
      return;
    }

    setLoading(true);
    try {
      const response = await authAPI.resetPassword({
        token,
        role,
        password
      });

      if (response.data?.success) {
        setSuccess(true);
      } else {
        setError(response.data?.message || "Failed to reset password.");
      }
    } catch (err) {
      console.error("Reset password error:", err);
      setError(
        err.response?.data?.message ||
          "Password reset link is invalid or has expired. Please request a new link."
      );
    } finally {
      setLoading(false);
    }
  };

  const pwField = (id, label, value, setValue, shown, setShown, placeholder) => (
    <div className="auth-field">
      <label htmlFor={id} className="auth-label">{label}</label>
      <div className="auth-input-wrap">
        <span className="auth-input-icon"><Lock size={17} /></span>
        <input
          id={id}
          type={shown ? "text" : "password"}
          autoComplete="new-password"
          className="auth-input has-action"
          placeholder={placeholder}
          value={value}
          onChange={(e) => setValue(e.target.value)}
          disabled={!token}
        />
        <button
          type="button"
          className="auth-input-action"
          onClick={() => setShown(!shown)}
          aria-label={shown ? "Hide password" : "Show password"}
        >
          {shown ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </div>
    </div>
  );

  return (
    <AuthLayout
      backTo={roleInfo.path}
      backLabel="Back to sign in"
      eyebrow="Account recovery"
      title={<>Set a new, <em>secure</em> password.</>}
      description="Choose a password you haven't used before. Once saved, the reset link is invalidated and you can sign in straight away."
      highlights={[
        { icon: ShieldCheck, title: "Encrypted, single-use links", text: "Reset tokens are signed and invalidated as soon as they are used." },
        { icon: Clock, title: "30-minute expiry", text: "Unused links expire automatically to protect your account." },
        { icon: KeyRound, title: "Role-isolated recovery", text: "Citizen, advocate and NGO accounts are recovered separately." },
      ]}
    >
      <span className="auth-chip">
        <KeyRound size={12} />
        {roleInfo.shortLabel} account
      </span>
      <h1 className="auth-title">Create a new password</h1>
      <p className="auth-subtitle">Use at least 8 characters, with a letter and a number.</p>

      {!token && !success && (
        <div className="auth-alert auth-alert-warning" role="alert">
          <AlertCircle size={17} />
          <div>
            <strong style={{ display: "block", color: "inherit" }}>Reset link incomplete</strong>
            <span>
              This link is missing its security token.{" "}
              <Link to="/forgot-password" className="auth-link" style={{ color: "inherit" }}>
                Request a new link
              </Link>
              .
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <>
          <div className="auth-alert auth-alert-success" role="status">
            <CheckCircle2 size={17} />
            <div>
              <strong style={{ display: "block", color: "inherit" }}>Password updated</strong>
              <span>Redirecting you to {roleInfo.shortLabel.toLowerCase()} sign in…</span>
            </div>
          </div>
          <Link to={roleInfo.path} className="auth-btn">
            <span>Continue to sign in</span>
            <ArrowRight size={17} />
          </Link>
        </>
      ) : (
        <form onSubmit={handleSubmit} noValidate>
          {pwField("new-password", "New password", password, setPassword, showPassword, setShowPassword, "Enter a new password")}
          {pwField("confirm-password", "Confirm new password", confirmPassword, setConfirmPassword, showConfirmPassword, setShowConfirmPassword, "Repeat the new password")}

          <button type="submit" className="auth-btn" disabled={loading || !token} style={{ marginTop: 8 }}>
            {loading ? (
              <>
                <span className="spinner-border spinner-border-sm" role="status" />
                <span>Updating password…</span>
              </>
            ) : (
              <>
                <span>Update password</span>
                <ArrowRight size={17} />
              </>
            )}
          </button>
        </form>
      )}

      <div className="auth-switch">
        <Link to={roleInfo.path} className="auth-link" style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
          <ArrowLeft size={15} /> Back to sign in
        </Link>
      </div>
    </AuthLayout>
  );
};

export default ResetPassword;
