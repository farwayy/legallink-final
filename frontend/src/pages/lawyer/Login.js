import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import SimpleNavbar from "../../components/simpleNavbar";
import {
  Mail,
  Lock,
  Eye,
  EyeOff,
  ArrowRight,
  AlertCircle,
  Clock,
  Scale,
  Briefcase,
  Calendar,
  Sparkles
} from "lucide-react";

const LawyerLogin = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const result = await login({ email, password }, "lawyer");

    if (result.success) {
      navigate("/lawyer/dashboard");
    } else {
      setError(result.error || "Invalid credentials. Please verify your official email and password.");
    }
    setLoading(false);
  };

  const isPendingError =
    error.toLowerCase().includes("pending") ||
    error.toLowerCase().includes("review") ||
    error.toLowerCase().includes("approval");

  return (
    <>
      <SimpleNavbar />

      <style>{`
        .lawyer-auth-split-wrap {
          min-height: calc(100vh - 72px);
          background-color: #F8FAFC;
          background-image: radial-gradient(#E2E8F0 1px, transparent 1px);
          background-size: 24px 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 48px 16px;
          font-family: var(--font-sans, Inter, sans-serif);
          transition: background-color 0.2s ease;
        }

        html.dark .lawyer-auth-split-wrap,
        [data-theme="dark"] .lawyer-auth-split-wrap {
          background-color: #090D16 !important;
          background-image: radial-gradient(#1E293B 1px, transparent 1px) !important;
        }

        .lawyer-auth-split-container {
          display: grid;
          grid-template-columns: 1fr 1.25fr;
          max-width: 1040px;
          width: 100%;
          background-color: #FFFFFF;
          border-radius: 16px;
          border: 1px solid #E2E8F0;
          box-shadow: 0 10px 25px -5px rgba(30, 63, 46, 0.08), 0 8px 10px -6px rgba(30, 63, 46, 0.04);
          overflow: hidden;
          transition: background-color 0.2s ease, border-color 0.2s ease;
        }

        html.dark .lawyer-auth-split-container,
        [data-theme="dark"] .lawyer-auth-split-container {
          background-color: #0F172A !important;
          border-color: #334155 !important;
          box-shadow: 0 20px 30px -10px rgba(0, 0, 0, 0.5) !important;
        }

        .lawyer-auth-left-panel {
          background-color: #1E3F2E;
          background-image: 
            radial-gradient(circle at 15% 20%, rgba(197, 160, 89, 0.16) 0%, transparent 45%),
            linear-gradient(145deg, #1E3F2E 0%, #152E22 100%);
          color: #FFFFFF;
          padding: 48px 40px;
          display: flex;
          flex-direction: column;
          justifyContent: space-between;
          position: relative;
        }

        .lawyer-auth-right-panel {
          padding: 44px 40px;
          display: flex;
          flex-direction: column;
          justifyContent: center;
          background-color: #FFFFFF;
          transition: background-color 0.2s ease;
        }

        html.dark .lawyer-auth-right-panel,
        [data-theme="dark"] .lawyer-auth-right-panel {
          background-color: #0F172A !important;
        }

        .auth-label {
          display: block;
          font-size: 13.5px;
          font-weight: 600;
          color: #334155;
          margin-bottom: 7px;
          transition: color 0.2s ease;
        }

        html.dark .auth-label,
        [data-theme="dark"] .auth-label {
          color: #E2E8F0 !important;
        }

        .auth-input {
          width: 100%;
          height: 46px;
          padding: 10px 14px 10px 42px;
          font-size: 14.5px;
          border-radius: 8px;
          border: 1px solid #CBD5E1;
          background-color: #FFFFFF;
          color: #0F172A;
          outline: none;
          box-sizing: border-box;
          transition: border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.2s ease, color 0.2s ease;
        }

        .auth-input::placeholder {
          color: #94A3B8;
        }

        .auth-input:focus {
          border-color: #1E3F2E;
          box-shadow: 0 0 0 3px rgba(30, 63, 46, 0.12);
        }

        html.dark .auth-input,
        [data-theme="dark"] .auth-input {
          background-color: #1E293B !important;
          border-color: #475569 !important;
          color: #FFFFFF !important;
        }

        html.dark .auth-input::placeholder,
        [data-theme="dark"] .auth-input::placeholder {
          color: #94A3B8 !important;
        }

        html.dark .auth-input:focus,
        [data-theme="dark"] .auth-input:focus {
          border-color: #10B981 !important;
          box-shadow: 0 0 0 3px rgba(16, 185, 129, 0.2) !important;
        }

        .auth-link-gold {
          color: #1E3F2E;
          font-weight: 600;
          text-decoration: none;
          transition: color 0.15s ease;
        }

        .auth-link-gold:hover {
          color: #152E22;
          text-decoration: underline;
        }

        html.dark .auth-link-gold,
        [data-theme="dark"] .auth-link-gold {
          color: #FBBF24 !important;
        }

        html.dark .auth-link-gold:hover,
        [data-theme="dark"] .auth-link-gold:hover {
          color: #FCD34D !important;
        }

        .auth-card-title {
          font-family: var(--font-serif, 'Playfair Display', serif);
          font-size: 24px;
          fontWeight: 700;
          color: #0F172A;
          margin: 0 0 6px 0;
          transition: color 0.2s ease;
        }

        html.dark .auth-card-title,
        [data-theme="dark"] .auth-card-title {
          color: #F8FAFC !important;
        }

        .auth-card-sub {
          font-size: 13.5px;
          color: #64748B;
          margin: 0;
          line-height: 1.5;
          transition: color 0.2s ease;
        }

        html.dark .auth-card-sub,
        [data-theme="dark"] .auth-card-sub {
          color: #94A3B8 !important;
        }

        @media (max-width: 860px) {
          .lawyer-auth-split-container {
            grid-template-columns: 1fr;
            max-width: 520px;
          }

          .lawyer-auth-left-panel {
            padding: 36px 24px;
          }

          .lawyer-auth-right-panel {
            padding: 32px 24px;
          }
        }
      `}</style>

      <div className="lawyer-auth-split-wrap">
        <div className="lawyer-auth-split-container">
          {/* Left Branded Showcase Panel */}
          <div className="lawyer-auth-left-panel">
            <div>
              {/* Crest / Logo */}
              <div style={{ display: "inline-flex", alignItems: "center", gap: "12px", marginBottom: "28px" }}>
                <img
                  src="/images/logo.png"
                  alt="LegalLink Logo"
                  style={{
                    height: "48px",
                    width: "auto",
                    objectFit: "contain",
                    filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.25))"
                  }}
                />
                <div>
                  <span
                    style={{
                      fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                      fontSize: "23px",
                      fontWeight: 700,
                      letterSpacing: "0.5px",
                      color: "#FFFFFF",
                      display: "block",
                      lineHeight: 1.1
                    }}
                  >
                    LegalLink
                  </span>
                  <span
                    style={{
                      fontSize: "11px",
                      textTransform: "uppercase",
                      letterSpacing: "1.2px",
                      color: "#C5A059",
                      fontWeight: 600,
                      display: "block",
                      marginTop: "3px"
                    }}
                  >
                    ADVOCATE DESK
                  </span>
                </div>
              </div>

              {/* Title & Description */}
              <h2
                style={{
                  fontFamily: "var(--font-serif, 'Playfair Display', serif)",
                  fontSize: "26px",
                  lineHeight: 1.3,
                  fontWeight: 700,
                  color: "#FFFFFF",
                  marginBottom: "14px"
                }}
              >
                Advocate & Legal Counsel Portal
              </h2>
              <p style={{ fontSize: "14px", color: "#CBD5E1", lineHeight: 1.6, marginBottom: "32px" }}>
                The professional judicial workspace for bar practitioners across Pakistan. Manage client inquiries, court schedules, and verified digital briefs.
              </p>

              {/* Advocate Highlights */}
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      color: "#C5A059",
                      backgroundColor: "rgba(197, 160, 89, 0.15)",
                      padding: "6px",
                      borderRadius: "6px",
                      flexShrink: 0,
                      marginTop: "1px"
                    }}
                  >
                    <Scale size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#FFFFFF", display: "block" }}>
                      Bar Council Accreditation
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#94A3B8", lineHeight: 1.4 }}>
                      Verified credential badges for High Court & District Court advocates.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      color: "#C5A059",
                      backgroundColor: "rgba(197, 160, 89, 0.15)",
                      padding: "6px",
                      borderRadius: "6px",
                      flexShrink: 0,
                      marginTop: "1px"
                    }}
                  >
                    <Briefcase size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#FFFFFF", display: "block" }}>
                      Active Citizen Case Inquiries
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#94A3B8", lineHeight: 1.4 }}>
                      Direct case routing, retainer contracts, and pre-screened client briefs.
                    </span>
                  </div>
                </div>

                <div style={{ display: "flex", alignItems: "flex-start", gap: "12px" }}>
                  <div
                    style={{
                      color: "#C5A059",
                      backgroundColor: "rgba(197, 160, 89, 0.15)",
                      padding: "6px",
                      borderRadius: "6px",
                      flexShrink: 0,
                      marginTop: "1px"
                    }}
                  >
                    <Calendar size={18} strokeWidth={2} />
                  </div>
                  <div>
                    <span style={{ fontSize: "13.5px", fontWeight: 600, color: "#FFFFFF", display: "block" }}>
                      Court Hearing Management
                    </span>
                    <span style={{ fontSize: "12.5px", color: "#94A3B8", lineHeight: 1.4 }}>
                      Real-time hearing tracking, court date reminders, and document vault.
                    </span>
                  </div>
                </div>
              </div>
            </div>

            <div
              style={{
                marginTop: "36px",
                paddingTop: "18px",
                borderTop: "1px solid rgba(255, 255, 255, 0.12)",
                fontSize: "12px",
                color: "#94A3B8",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}
            >
              <Sparkles size={14} color="#C5A059" />
              <span>Accredited Bar Counsel Network • Pakistan</span>
            </div>
          </div>

          {/* Right Form Panel */}
          <div className="lawyer-auth-right-panel">
            <div style={{ marginBottom: "26px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.8px",
                    color: isDark ? "#86EFAC" : "#1E3F2E",
                    backgroundColor: isDark ? "#132E20" : "#F0FDF4",
                    border: isDark ? "1px solid #1B4D36" : "1px solid #BBF7D0",
                    padding: "4px 10px",
                    borderRadius: "20px"
                  }}
                >
                  Advocate Portal Access
                </span>
                <span style={{ fontSize: "12px", color: isDark ? "#94A3B8" : "#64748B", fontWeight: 500 }}>
                  Role: <strong style={{ color: isDark ? "#FBBF24" : "#1E3F2E" }}>Counsel</strong>
                </span>
              </div>

              <h1 className="auth-card-title">Welcome Back, Counselor</h1>
              <p className="auth-card-sub">
                Enter your credentials to access your judicial briefs, hearings, and client consultations.
              </p>
            </div>

            {/* Error / Status Alert */}
            {error && (
              <div
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: "12px",
                  backgroundColor: isPendingError
                    ? isDark ? "rgba(180, 83, 9, 0.25)" : "#FFFBEB"
                    : isDark ? "rgba(153, 27, 27, 0.25)" : "#FEF2F2",
                  border: isPendingError
                    ? isDark ? "1px solid #B45309" : "1px solid #FDE68A"
                    : isDark ? "1px solid #991B1B" : "1px solid #FECACA",
                  borderRadius: "10px",
                  padding: "14px 16px",
                  marginBottom: "22px",
                  color: isPendingError
                    ? isDark ? "#FDE68A" : "#92400E"
                    : isDark ? "#FCA5A5" : "#991B1B",
                  fontSize: "13.5px",
                  lineHeight: 1.45
                }}
              >
                {isPendingError ? (
                  <Clock size={20} style={{ flexShrink: 0, marginTop: "1px", color: "#F59E0B" }} />
                ) : (
                  <AlertCircle size={20} style={{ flexShrink: 0, marginTop: "1px", color: "#DC2626" }} />
                )}
                <div>
                  {isPendingError && (
                    <strong style={{ display: "block", marginBottom: "2px" }}>
                      Accreditation Status Pending
                    </strong>
                  )}
                  <span>{error}</span>
                </div>
              </div>
            )}

            <form onSubmit={handleSubmit}>
              {/* Email */}
              <div style={{ marginBottom: "20px" }}>
                <label className="auth-label" htmlFor="lawyer-email">
                  Official Email Address
                </label>
                <div style={{ position: "relative" }}>
                  <input
                    id="lawyer-email"
                    type="email"
                    className="auth-input"
                    placeholder="counsel@lawchamber.pk"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <Mail size={18} strokeWidth={1.75} />
                  </div>
                </div>
              </div>

              {/* Password */}
              <div style={{ marginBottom: "24px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "7px" }}>
                  <label className="auth-label" htmlFor="lawyer-password" style={{ marginBottom: 0 }}>
                    Password
                  </label>
                  <Link
                    to="/forgot-password?role=lawyer"
                    className="auth-link-gold"
                    style={{ fontSize: "12.5px" }}
                  >
                    Forgot Password?
                  </Link>
                </div>
                <div style={{ position: "relative" }}>
                  <input
                    id="lawyer-password"
                    type={showPassword ? "text" : "password"}
                    className="auth-input"
                    placeholder="Enter your account password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    style={{ paddingRight: "42px" }}
                  />
                  <div
                    style={{
                      position: "absolute",
                      left: "14px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center"
                    }}
                  >
                    <Lock size={18} strokeWidth={1.75} />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: "absolute",
                      right: "12px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "none",
                      border: "none",
                      color: isDark ? "#CBD5E1" : "#64748B",
                      cursor: "pointer",
                      padding: 0,
                      display: "flex",
                      alignItems: "center"
                    }}
                    aria-label="Toggle password visibility"
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                style={{
                  width: "100%",
                  backgroundColor: "#1E3F2E",
                  color: "#FFFFFF",
                  border: isDark ? "1px solid #2D5F44" : "none",
                  padding: "13px 20px",
                  borderRadius: "8px",
                  fontSize: "15px",
                  fontWeight: 600,
                  cursor: loading ? "not-allowed" : "pointer",
                  opacity: loading ? 0.75 : 1,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  transition: "all 0.15s ease",
                  marginBottom: "22px",
                  boxShadow: "0 1px 2px rgba(0, 0, 0, 0.05)"
                }}
                onMouseOver={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = isDark ? "#254D37" : "#152E22";
                }}
                onMouseOut={(e) => {
                  if (!loading) e.currentTarget.style.backgroundColor = "#1E3F2E";
                }}
              >
                {loading ? (
                  <>
                    <div
                      className="spinner-border spinner-border-sm"
                      role="status"
                      style={{ width: "16px", height: "16px" }}
                    />
                    <span>Authenticating Counsel...</span>
                  </>
                ) : (
                  <>
                    <span>Sign In to Advocate Portal</span>
                    <ArrowRight size={17} />
                  </>
                )}
              </button>

              <div
                style={{
                  display: "flex",
                  justifyContent: "center",
                  alignItems: "center",
                  paddingTop: "18px",
                  borderTop: isDark ? "1px solid #1E293B" : "1px solid #F1F5F9",
                  fontSize: "13.5px",
                  color: isDark ? "#94A3B8" : "#64748B"
                }}
              >
                <span>New advocate on LegalLink? </span>
                <Link
                  to="/lawyer/signup"
                  className="auth-link-gold"
                  style={{ marginLeft: "6px" }}
                >
                  Apply for Accreditation &rarr;
                </Link>
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
};

export default LawyerLogin;