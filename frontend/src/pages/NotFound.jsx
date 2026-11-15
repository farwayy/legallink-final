import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

const DASHBOARD_MAP = {
  user:   "/user/dashboard",
  lawyer: "/lawyer/dashboard",
  ngo:    "/ngo/dashboard",
  admin:  "/admin/dashboard",
};

const NotFound = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const dashPath = isAuthenticated && user?.role ? DASHBOARD_MAP[user.role] : null;

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "linear-gradient(135deg, #0c1a12 0%, #1E3F2E 50%, #0c1a12 100%)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontFamily: "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
        padding: "24px",
        position: "relative",
        overflow: "hidden",
      }}
    >
      {/* Decorative watermark scales */}
      <div
        aria-hidden="true"
        style={{
          position: "absolute",
          inset: 0,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          pointerEvents: "none",
        }}
      >
        <svg
          viewBox="0 0 200 200"
          width="480"
          height="480"
          style={{ opacity: 0.04, color: "#D4AF37" }}
          fill="currentColor"
        >
          {/* Scales of Justice */}
          <rect x="98" y="20" width="4" height="140" />
          <rect x="60" y="20" width="80" height="5" rx="2" />
          {/* Left pan */}
          <line x1="62" y1="25" x2="40" y2="80" stroke="currentColor" strokeWidth="3" />
          <ellipse cx="40" cy="80" rx="22" ry="8" />
          {/* Right pan */}
          <line x1="138" y1="25" x2="160" y2="75" stroke="currentColor" strokeWidth="3" />
          <ellipse cx="160" cy="75" rx="22" ry="8" />
          {/* Base */}
          <rect x="80" y="158" width="40" height="8" rx="4" />
          <rect x="70" y="166" width="60" height="6" rx="3" />
        </svg>
      </div>

      {/* Subtle decorative rings */}
      {[260, 400, 560].map((size, i) => (
        <div
          key={i}
          aria-hidden="true"
          style={{
            position: "absolute",
            width: size,
            height: size,
            borderRadius: "50%",
            border: "1px solid rgba(212,175,55,0.07)",
            top: "50%",
            left: "50%",
            transform: "translate(-50%, -50%)",
            pointerEvents: "none",
          }}
        />
      ))}

      {/* Main card */}
      <div
        style={{
          position: "relative",
          zIndex: 1,
          background: "rgba(255,255,255,0.04)",
          backdropFilter: "blur(12px)",
          border: "1px solid rgba(212,175,55,0.18)",
          borderRadius: 20,
          padding: "52px 48px",
          maxWidth: 560,
          width: "100%",
          textAlign: "center",
          boxShadow: "0 24px 80px rgba(0,0,0,0.4)",
        }}
      >
        {/* Gold badge */}
        <div
          style={{
            display: "inline-flex",
            alignItems: "center",
            gap: 8,
            background: "rgba(212,175,55,0.15)",
            border: "1px solid rgba(212,175,55,0.35)",
            borderRadius: 20,
            padding: "6px 16px",
            marginBottom: 28,
          }}
        >
          <span style={{ color: "#D4AF37", fontSize: "0.78rem", fontWeight: 700, letterSpacing: "0.08em" }}>
            LEGAL LINK — COURT REGISTRY
          </span>
        </div>

        {/* 404 number */}
        <div
          style={{
            fontFamily: "Marcellus, Georgia, serif",
            fontSize: "clamp(64px, 14vw, 100px)",
            fontWeight: 900,
            lineHeight: 1,
            marginBottom: 4,
            background: "linear-gradient(135deg, #D4AF37, #f5d97a, #D4AF37)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          404
        </div>

        {/* Thin divider */}
        <div
          style={{
            width: 60,
            height: 2,
            background: "linear-gradient(90deg, transparent, #D4AF37, transparent)",
            margin: "20px auto",
          }}
        />

        <h1
          style={{
            fontFamily: "Marcellus, Georgia, serif",
            fontSize: "clamp(1.2rem, 3vw, 1.55rem)",
            color: "#ffffff",
            margin: "0 0 14px",
            fontWeight: 700,
            lineHeight: 1.3,
          }}
        >
          Legal Record Not Found
        </h1>

        <p
          style={{
            fontSize: "0.92rem",
            color: "rgba(255,255,255,0.62)",
            lineHeight: 1.7,
            margin: "0 0 36px",
            maxWidth: 400,
            marginLeft: "auto",
            marginRight: "auto",
          }}
        >
          The page or docket you are looking for has been moved, archived, or
          does not exist in our registry.
        </p>

        {/* Action buttons */}
        <div style={{ display: "flex", gap: 12, justifyContent: "center", flexWrap: "wrap" }}>
          <Link
            to="/"
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 8,
              padding: "12px 26px",
              background: "linear-gradient(135deg, #D4AF37, #b8941f)",
              color: "#0c1a12",
              borderRadius: 10,
              textDecoration: "none",
              fontSize: "0.9rem",
              fontWeight: 800,
              letterSpacing: "0.03em",
              boxShadow: "0 4px 16px rgba(212,175,55,0.35)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
            onMouseEnter={e => { e.currentTarget.style.transform = "translateY(-2px)"; e.currentTarget.style.boxShadow = "0 8px 24px rgba(212,175,55,0.45)"; }}
            onMouseLeave={e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "0 4px 16px rgba(212,175,55,0.35)"; }}
          >
            ← Return to Home
          </Link>

          {dashPath && (
            <button
              onClick={() => navigate(dashPath)}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 8,
                padding: "12px 26px",
                background: "rgba(255,255,255,0.08)",
                color: "#fff",
                border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: 10,
                fontSize: "0.9rem",
                fontWeight: 700,
                cursor: "pointer",
                transition: "background 0.15s ease",
              }}
              onMouseEnter={e => { e.currentTarget.style.background = "rgba(255,255,255,0.14)"; }}
              onMouseLeave={e => { e.currentTarget.style.background = "rgba(255,255,255,0.08)"; }}
            >
              Go to Dashboard →
            </button>
          )}
        </div>

        {/* Footer note */}
        <p style={{ marginTop: 32, fontSize: "0.75rem", color: "rgba(255,255,255,0.3)" }}>
          If you believe this is an error, please contact support.
        </p>
      </div>
    </div>
  );
};

export default NotFound;
