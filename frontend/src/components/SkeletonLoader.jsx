import React from "react";

/**
 * Animated pulse skeleton components used while dashboard data loads.
 * Pure CSS-in-JS — no Tailwind dependency.
 */

const pulse = {
  animation: "sk-pulse 1.5s ease-in-out infinite",
  borderRadius: "6px",
  background: "linear-gradient(90deg, #e2e8f0 25%, #f1f5f9 50%, #e2e8f0 75%)",
  backgroundSize: "200% 100%",
};

export const Sk = ({ w = "100%", h = 16, r = 6, style = {} }) => (
  <div
    style={{
      ...pulse,
      width: w,
      height: h,
      borderRadius: r,
      ...style,
    }}
  />
);

/** One skeleton stat card */
export const SkStatCard = () => (
  <div
    style={{
      background: "#fff",
      border: "1px solid #e2e8f0",
      borderRadius: 12,
      padding: "20px 24px",
      display: "flex",
      flexDirection: "column",
      gap: 10,
    }}
  >
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
      <Sk w={40} h={40} r={8} />
      <Sk w="30%" h={12} />
    </div>
    <Sk w="50%" h={32} r={6} />
    <Sk w="70%" h={10} />
  </div>
);

/** One skeleton table row */
export const SkTableRow = ({ cols = 5 }) => (
  <tr>
    {Array.from({ length: cols }).map((_, i) => (
      <td key={i} style={{ padding: "14px 16px" }}>
        <Sk h={12} w={i === 0 ? "80%" : "60%"} />
      </td>
    ))}
  </tr>
);

/** Full dashboard skeleton — stat grid + table */
export const DashboardSkeleton = ({ cols = 5, rows = 6, cards = 4, title = "" }) => (
  <div style={{ padding: "32px 0 64px", maxWidth: 1240, margin: "0 auto" }}>
    <style>{`
      @keyframes sk-pulse {
        0% { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>

    {/* Page header ghost */}
    <div style={{ marginBottom: 28 }}>
      <Sk w={220} h={28} r={6} />
      <Sk w={320} h={12} r={4} style={{ marginTop: 10 }} />
    </div>

    {/* Stat cards ghost */}
    <div
      style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cards}, minmax(0, 1fr))`,
        gap: 16,
        marginBottom: 28,
      }}
    >
      {Array.from({ length: cards }).map((_, i) => (
        <SkStatCard key={i} />
      ))}
    </div>

    {/* Table ghost */}
    <div
      style={{
        background: "#fff",
        border: "1px solid #e2e8f0",
        borderRadius: 12,
        overflow: "hidden",
      }}
    >
      {/* Table header ghost */}
      <div
        style={{
          background: "#f8fafc",
          borderBottom: "1px solid #e2e8f0",
          padding: "14px 16px",
          display: "flex",
          gap: 24,
        }}
      >
        {Array.from({ length: cols }).map((_, i) => (
          <Sk key={i} w={80} h={10} />
        ))}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse" }}>
        <tbody>
          {Array.from({ length: rows }).map((_, i) => (
            <SkTableRow key={i} cols={cols} />
          ))}
        </tbody>
      </table>
    </div>
  </div>
);

export default DashboardSkeleton;
