import ThemeToggle from "./ThemeToggle";
import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";
import { ArrowLeft, Scale } from "lucide-react";

const NGOAuthHeader = ({ title = "Legal Aid & Pro Bono Portal" }) => {
  const { isDark } = useTheme();

  return (
    <header
      style={{
        height: 56,
        backgroundColor: isDark ? "#0F172A" : "#FFFFFF",
        borderBottom: `1px solid ${isDark ? "#334155" : "#E5E7EB"}`,
        padding: "0 24px",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        position: "sticky",
        top: 0,
        zIndex: 1000,
        boxShadow: "0 1px 2px rgba(0,0,0,0.03)",
        transition: "background-color 0.2s, border-color 0.2s"
      }}
    >
      {/* Left: Logo + Portal Brand */}
      <Link
        to="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          textDecoration: "none",
        }}
      >
        <img
          src="/images/legallink-logo1.png"
          alt="LegalLink Logo"
          style={{
            height: "36px",
            width: "auto",
            objectFit: "contain"
          }}
        />
        <div style={{ display: "flex", alignItems: "baseline", gap: 8 }}>
          <span
            style={{
              fontFamily: "var(--font-serif, 'Playfair Display', serif)",
              fontSize: "1.25rem",
              fontWeight: 700,
              color: isDark ? "#F8FAFC" : "#1E3F2E",
              letterSpacing: "0.02em",
              lineHeight: 1
            }}
          >
            LegalLink
          </span>
          <span
            style={{
              fontSize: "0.78rem",
              color: isDark ? "#94A3B8" : "#64748B",
              fontWeight: 500
            }}
          >
            {title}
          </span>
        </div>
      </Link>

      {/* Right: Theme Toggle + Back to Home */}
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <ThemeToggle />

        <Link
          to="/"
          style={{
            display: "flex",
            alignItems: "center",
            gap: 6,
            fontSize: "0.84rem",
            color: isDark ? "#94A3B8" : "#6B7280",
            textDecoration: "none",
            fontWeight: 500,
            transition: "color 0.15s ease"
          }}
          onMouseEnter={(e) => (e.target.style.color = "#059669")}
          onMouseLeave={(e) => (e.target.style.color = isDark ? "#94A3B8" : "#6B7280")}
        >
          <ArrowLeft size={15} />
          <span>Back to Home</span>
        </Link>
      </div>
    </header>
  );
};

export default NGOAuthHeader;
