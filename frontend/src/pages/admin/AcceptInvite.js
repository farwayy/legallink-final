import React, { useEffect, useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ShieldCheck, User, Lock, Eye, EyeOff, ArrowRight, AlertCircle, FileCheck, Activity, Mail } from "lucide-react";
import AuthLayout from "../../components/AuthLayout";
import { useAuth } from "../../contexts/AuthContext";
import { adminAPI } from "../../services/api";

const ROLE_TEXT = {
  super_admin: { name: "Super admin", text: "Full access, including inviting and managing other admins." },
  verifier: { name: "Verifier", text: "You'll review and approve advocate and NGO applications." },
  moderator: { name: "Moderator", text: "You'll handle citizens, disputes, reviews and announcements." },
};

const LAYOUT = {
  eyebrow: "Administration console",
  title: <>Join the <em>LegalLink</em> team.</>,
  description: "You've been invited to help run LegalLink. Set your name and password to activate your admin account.",
  highlights: [
    { icon: FileCheck, title: "Your own account", text: "Every admin signs in with their own email and password." },
    { icon: Activity, title: "A clear role", text: "Your role decides which actions you can take." },
    { icon: ShieldCheck, title: "Audited access", text: "Every administrative action is recorded in the audit log." },
  ],
};

const pwOk = (pw) => pw.length >= 8 && /[A-Za-z]/.test(pw) && /\d/.test(pw);

const AcceptInvite = () => {
  const [params] = useSearchParams();
  const token = params.get("token") || "";
  const navigate = useNavigate();
  const { login } = useAuth();

  const [invite, setInvite] = useState(null);
  const [state, setState] = useState("checking"); // checking | ready | invalid
  const [problem, setProblem] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!token) {
      setProblem("This page needs the link from your invitation email.");
      setState("invalid");
      return;
    }
    adminAPI
      .checkInvite(token)
      .then((res) => {
        setInvite(res.data);
        setState("ready");
      })
      .catch((e) => {
        setProblem(e.response?.data?.message || "This invitation link is not valid.");
        setState("invalid");
      });
  }, [token]);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (name.trim().length < 2) return setError("Enter your full name.");
    if (!pwOk(password)) return setError("Use at least 8 characters with a letter and a number.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true);
    try {
      await adminAPI.acceptInvite(token, name.trim(), password);
      const result = await login({ email: invite.email, password }, "admin");
      if (result.success) navigate("/admin/dashboard");
      else navigate("/admin/login");
    } catch (err) {
      setError(err.response?.data?.message || "Could not activate your account. Please try again.");
      setBusy(false);
    }
  };

  const role = ROLE_TEXT[invite?.role];

  return (
    <AuthLayout {...LAYOUT}>
      <span className="auth-chip">
        <ShieldCheck size={12} />
        Admin invitation
      </span>

      {state === "checking" && (
        <>
          <h1 className="auth-title">Checking your invitation…</h1>
          <p className="auth-subtitle">This only takes a moment.</p>
        </>
      )}

      {state === "invalid" && (
        <>
          <h1 className="auth-title">This link can't be used</h1>
          <div className="auth-alert auth-alert-error" role="alert">
            <AlertCircle size={17} />
            <span>{problem}</span>
          </div>
          <p className="auth-subtitle">Invitation links work once and expire after 48 hours. Ask the super admin who invited you to send a new one.</p>
          <div className="auth-switch">
            Already set up?{" "}
            <Link to="/admin/login" className="auth-link">Sign in to the console</Link>
          </div>
        </>
      )}

      {state === "ready" && (
        <>
          <h1 className="auth-title">Activate your admin account</h1>
          <p className="auth-subtitle">
            {invite.invitedBy ? <>Invited by {invite.invitedBy} as <strong>{role?.name}</strong>. </> : <>You're joining as <strong>{role?.name}</strong>. </>}
            {role?.text}
          </p>

          {error && (
            <div className="auth-alert auth-alert-error" role="alert">
              <AlertCircle size={17} />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={submit}>
            <div className="auth-field">
              <label className="auth-label" htmlFor="inv-email">Email</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Mail size={17} /></span>
                <input id="inv-email" className="auth-input" value={invite.email} readOnly autoComplete="username" />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="inv-name">Full name</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><User size={17} /></span>
                <input id="inv-name" className="auth-input" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" placeholder="Your full name" required />
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="inv-password">Password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={17} /></span>
                <input
                  id="inv-password"
                  type={show ? "text" : "password"}
                  className="auth-input has-action"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="new-password"
                  placeholder="At least 8 characters, a letter and a number"
                  required
                />
                <button type="button" className="auth-input-action" onClick={() => setShow((s) => !s)} aria-label={show ? "Hide password" : "Show password"}>
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            <div className="auth-field">
              <label className="auth-label" htmlFor="inv-confirm">Confirm password</label>
              <div className="auth-input-wrap">
                <span className="auth-input-icon"><Lock size={17} /></span>
                <input
                  id="inv-confirm"
                  type={show ? "text" : "password"}
                  className="auth-input"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  autoComplete="new-password"
                  placeholder="Type it again"
                  required
                />
              </div>
            </div>

            <button type="submit" className="auth-btn" disabled={busy} style={{ marginTop: 8 }}>
              {busy ? (
                <>
                  <span className="spinner-border spinner-border-sm" role="status" />
                  <span>Activating…</span>
                </>
              ) : (
                <>
                  <span>Activate and sign in</span>
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>
        </>
      )}
    </AuthLayout>
  );
};

export default AcceptInvite;
