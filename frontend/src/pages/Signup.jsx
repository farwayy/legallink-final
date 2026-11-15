import React, { useState } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import AuthLayout from "../components/AuthLayout";
import GoogleSignInButton from "../components/GoogleSignInButton";
import { User, Scale, Building2, ArrowRight, UserPlus, AlertCircle } from "lucide-react";

const REGISTRATION_ROLES = [
  {
    key: "user",
    label: "Citizen / Client",
    badge: "Free",
    desc: "Get legal guidance, hire verified advocates and request pro bono aid.",
    path: "/user/signup",
    cta: "Continue as Citizen",
    icon: User,
  },
  {
    key: "lawyer",
    label: "Advocate",
    badge: "Verification required",
    desc: "Register your Bar Council credentials and manage client cases.",
    path: "/lawyer/signup",
    cta: "Continue as Advocate",
    icon: Scale,
  },
  {
    key: "ngo",
    label: "Legal Aid Organisation",
    badge: "Accreditation required",
    desc: "Accredit your NGO to take on pro bono matters and assign panel advocates.",
    path: "/ngo/signup",
    cta: "Continue as Legal Aid NGO",
    icon: Building2,
  },
];

const Signup = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const initialRole = searchParams.get("role") || "user";
  const validRole = ["user", "lawyer", "ngo"].includes(initialRole) ? initialRole : "user";

  const [selectedRole, setSelectedRole] = useState(validRole);
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const active = REGISTRATION_ROLES.find((r) => r.key === selectedRole) || REGISTRATION_ROLES[0];

  const handleRoleSelect = (roleKey) => {
    setSelectedRole(roleKey);
    setSearchParams({ role: roleKey });
    setError("");
  };

  return (
    <AuthLayout>
      <span className="auth-chip">
        <UserPlus size={12} />
        New account
      </span>
      <h1 className="auth-title">Create your account</h1>
      <p className="auth-subtitle">Choose the account type that matches how you'll use LegalLink.</p>

      {error && (
        <div className="auth-alert auth-alert-error" role="alert">
          <AlertCircle size={17} />
          <span>{error}</span>
        </div>
      )}

      <div className="auth-role-list" role="radiogroup" aria-label="Account type">
        {REGISTRATION_ROLES.map((r) => {
          const Icon = r.icon;
          const isActive = selectedRole === r.key;
          return (
            <button
              key={r.key}
              type="button"
              role="radio"
              aria-checked={isActive}
              className={`auth-role-card${isActive ? " is-active" : ""}`}
              onClick={() => handleRoleSelect(r.key)}
            >
              <span className="auth-role-icon">
                <Icon size={19} />
              </span>
              <span className="auth-role-body">
                <span className="auth-role-title">{r.label}</span>
                <span className="auth-role-desc">{r.desc}</span>
              </span>
              <span className="auth-role-radio" aria-hidden="true" />
            </button>
          );
        })}
      </div>

      <button type="button" className="auth-btn" onClick={() => navigate(active.path)}>
        <span>{active.cta}</span>
        <ArrowRight size={17} />
      </button>

      {selectedRole === "user" && (
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
        <Link to={`/login?role=${selectedRole}`} className="auth-link">
          Sign in
        </Link>
      </div>
    </AuthLayout>
  );
};

export default Signup;
