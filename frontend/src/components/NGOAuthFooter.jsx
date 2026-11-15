import React from "react";
import { Link } from "react-router-dom";
import { useTheme } from "../contexts/ThemeContext";

const NGOAuthFooter = () => {
  const { isDark } = useTheme();

  return (
    <footer
      style={{
        padding: "24px 20px",
        textAlign: "center",
        borderTop: `1px solid ${isDark ? "#334155" : "#E5E7EB"}`,
        backgroundColor: isDark ? "#0B1120" : "#F9FAFB",
        color: isDark ? "#64748B" : "#9CA3AF",
        fontSize: "0.8rem",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: 8,
      }}
    >
      <div>
        © {new Date().getFullYear()} LegalLink Pakistan. Official Pro Bono & Legal Aid Network.
      </div>
      <div style={{ display: "flex", gap: 16 }}>
        <Link to="/about" style={{ color: "inherit", textDecoration: "none" }}>About Network</Link>
        <span>•</span>
        <Link to="/mission" style={{ color: "inherit", textDecoration: "none" }}>Legal Aid Charter</Link>
        <span>•</span>
        <Link to="/ngos" style={{ color: "inherit", textDecoration: "none" }}>Public Directory</Link>
      </div>
    </footer>
  );
};

export default NGOAuthFooter;
