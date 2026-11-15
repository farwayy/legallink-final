import React from "react";
import { FolderOpen, Scale, FileText, AlertCircle, Search, PlusCircle } from "lucide-react";
import { Link } from "react-router-dom";

/**
 * Universal empty-state visual component.
 *
 * Props:
 *  icon        – "folder" | "scale" | "file" | "alert" | "search"  (default: "folder")
 *  title       – Main heading  (required)
 *  description – Supporting text
 *  action      – { label, to, onClick }  (optional CTA)
 *  compact     – smaller padding when true
 */

const ICONS = {
  folder: FolderOpen,
  scale:  Scale,
  file:   FileText,
  alert:  AlertCircle,
  search: Search,
  plus:   PlusCircle,
};

const ACCENT_COLORS = {
  folder: { ring: "#dbeafe", icon: "#3b82f6" },
  scale:  { ring: "#d1fae5", icon: "#059669" },
  file:   { ring: "#ede9fe", icon: "#7c3aed" },
  alert:  { ring: "#fee2e2", icon: "#dc2626" },
  search: { ring: "#fef3c7", icon: "#d97706" },
  plus:   { ring: "#dcfce7", icon: "#16a34a" },
};

const EmptyState = ({
  icon = "folder",
  title,
  description,
  action,
  compact = false,
}) => {
  const Icon   = ICONS[icon]    || FolderOpen;
  const colors = ACCENT_COLORS[icon] || ACCENT_COLORS.folder;

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: compact ? "36px 24px" : "72px 24px",
        textAlign: "center",
      }}
    >
      {/* Icon circle */}
      <div
        style={{
          width: compact ? 56 : 72,
          height: compact ? 56 : 72,
          borderRadius: "50%",
          background: colors.ring,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          marginBottom: 16,
        }}
      >
        <Icon
          size={compact ? 24 : 32}
          color={colors.icon}
          strokeWidth={1.5}
        />
      </div>

      <h3
        style={{
          fontFamily: "var(--font-serif)",
          fontSize: compact ? "1rem" : "1.2rem",
          fontWeight: 700,
          color: "var(--ll-text-primary)",
          margin: "0 0 8px",
        }}
      >
        {title}
      </h3>

      {description && (
        <p
          style={{
            fontSize: compact ? "0.82rem" : "0.9rem",
            color: "var(--ll-text-muted)",
            maxWidth: 380,
            lineHeight: 1.6,
            margin: "0 0 20px",
          }}
        >
          {description}
        </p>
      )}

      {action &&
        (action.to ? (
          <Link
            to={action.to}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              background: "#0A3622",
              color: "#fff",
              borderRadius: 8,
              textDecoration: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
            }}
          >
            {action.label}
          </Link>
        ) : (
          <button
            onClick={action.onClick}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: 6,
              padding: "10px 20px",
              background: "#0A3622",
              color: "#fff",
              borderRadius: 8,
              border: "none",
              fontSize: "0.88rem",
              fontWeight: 700,
              cursor: "pointer",
            }}
          >
            {action.label}
          </button>
        ))}
    </div>
  );
};

export default EmptyState;
