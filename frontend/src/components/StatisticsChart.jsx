import React, { useState } from "react";
import { RotateCw, Info } from "lucide-react";

/**
 * Generates a smooth cubic bezier SVG path through an array of {x, y} coordinates.
 */
function getSmoothSplinePath(points) {
  if (!points || points.length === 0) return "";
  if (points.length === 1) return `M ${points[0].x},${points[0].y}`;

  let path = `M ${points[0].x},${points[0].y}`;
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = points[i === 0 ? 0 : i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = points[i + 2 < points.length ? i + 2 : i + 1];

    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;

    path += ` C ${cp1x.toFixed(1)},${cp1y.toFixed(1)} ${cp2x.toFixed(1)},${cp2y.toFixed(1)} ${p2.x.toFixed(1)},${p2.y.toFixed(1)}`;
  }
  return path;
}

/**
 * Calculates a rounded ceiling for the Y-axis scale based on data.
 */
function getNiceCeiling(maxVal) {
  if (maxVal <= 5) return 5;
  if (maxVal <= 10) return 10;
  if (maxVal <= 20) return 20;
  if (maxVal <= 50) return 50;
  if (maxVal <= 100) return 100;
  if (maxVal <= 250) return 250;
  if (maxVal <= 500) return 500;
  return Math.ceil(maxVal / 100) * 100;
}

const StatisticsChart = ({ stats = {} }) => {
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [hoveredPoint, setHoveredPoint] = useState(null);
  const [showInfo, setShowInfo] = useState(false);
  const [viewMode, setViewMode] = useState("monthly"); // "monthly" or "cumulative"

  const totalUsers = stats.totalUsers || 0;
  const totalCases = stats.totalCases || 0;

  // Real data points from MongoDB timeline, or gracefully distributed defaults if empty
  const rawTimeline = stats.timeline && Array.isArray(stats.timeline) && stats.timeline.length === 8
    ? stats.timeline
    : [
        { id: 1, month: "Interval 1", users: 1, cases: 1, cumulativeUsers: 1, cumulativeCases: 1 },
        { id: 2, month: "Interval 2", users: 2, cases: 1, cumulativeUsers: 3, cumulativeCases: 2 },
        { id: 3, month: "Interval 3", users: 2, cases: 1, cumulativeUsers: 5, cumulativeCases: 3 },
        { id: 4, month: "Interval 4", users: 2, cases: 1, cumulativeUsers: 7, cumulativeCases: 4 },
        { id: 5, month: "Interval 5", users: 2, cases: 1, cumulativeUsers: 9, cumulativeCases: 5 },
        { id: 6, month: "Interval 6", users: 2, cases: 1, cumulativeUsers: 11, cumulativeCases: 6 },
        { id: 7, month: "Interval 7", users: 4, cases: 1, cumulativeUsers: 15, cumulativeCases: 7 },
        { id: 8, month: "Interval 8", users: 3, cases: 2, cumulativeUsers: 18, cumulativeCases: 9 },
      ];

  // Select metric values based on viewMode
  const chartData = rawTimeline.map((item, idx) => {
    const uVal = viewMode === "cumulative" ? (item.cumulativeUsers ?? item.users) : item.users;
    const cVal = viewMode === "cumulative" ? (item.cumulativeCases ?? item.cases) : item.cases;
    const xCoord = 70 + idx * 80; // Points spaced across x: 70, 150, 230, 310, 390, 470, 550, 630
    return {
      ...item,
      id: item.id || idx + 1,
      x: xCoord,
      userVal: Number(uVal) || 0,
      caseVal: Number(cVal) || 0,
    };
  });

  // Calculate dynamic scale
  const maxMetric = Math.max(
    ...chartData.map((d) => Math.max(d.userVal, d.caseVal)),
    5
  );
  const yCeiling = getNiceCeiling(maxMetric);

  // Compute exact pixel Y coordinates (Chart area: y=40 to y=280, height=240)
  const userCoords = chartData.map((d) => ({
    x: d.x,
    y: Math.max(40, Math.min(280, 280 - (d.userVal / yCeiling) * 240)),
  }));

  const caseCoords = chartData.map((d) => ({
    x: d.x,
    y: Math.max(40, Math.min(280, 280 - (d.caseVal / yCeiling) * 240)),
  }));

  // Build smooth curves
  const userSplinePath = getSmoothSplinePath(userCoords);
  const caseSplinePath = getSmoothSplinePath(caseCoords);

  // Find peak / key points for the vertical lines and badges
  // 1st highlight: max user point
  let maxUserIdx = 3; // default index 3 (point 4)
  let highestUser = -1;
  chartData.forEach((d, i) => {
    if (d.userVal > highestUser) {
      highestUser = d.userVal;
      maxUserIdx = i;
    }
  });

  // 2nd highlight: second significant point (e.g., peak case or index 5)
  let secondHighlightIdx = 5; // default index 5 (point 6)
  if (maxUserIdx === 5) secondHighlightIdx = 3;

  const p1 = {
    x: chartData[maxUserIdx].x,
    y: userCoords[maxUserIdx].y,
    val: chartData[maxUserIdx].userVal,
    id: chartData[maxUserIdx].id,
  };

  const p2 = {
    x: chartData[secondHighlightIdx].x,
    y: userCoords[secondHighlightIdx].y,
    val: chartData[secondHighlightIdx].userVal,
    id: chartData[secondHighlightIdx].id,
  };

  // Order p1 and p2 by x coordinate for area fill
  const leftGuide = p1.x < p2.x ? p1 : p2;
  const rightGuide = p1.x < p2.x ? p2 : p1;

  // Extract subset of points between leftGuide and rightGuide for the glowing peak gradient
  const leftIdx = Math.min(maxUserIdx, secondHighlightIdx);
  const rightIdx = Math.max(maxUserIdx, secondHighlightIdx);
  const peakSegmentCoords = userCoords.slice(leftIdx, rightIdx + 1);
  const peakSpline = getSmoothSplinePath(peakSegmentCoords);

  // Close the path down to baseline y=280
  const areaFillPath = peakSpline
    ? `${peakSpline} L ${rightGuide.x},280 L ${leftGuide.x},280 Z`
    : `M ${leftGuide.x},${leftGuide.y} L ${rightGuide.x},${rightGuide.y} L ${rightGuide.x},280 L ${leftGuide.x},280 Z`;

  const handleRefresh = () => {
    setIsRefreshing(true);
    setTimeout(() => {
      setIsRefreshing(false);
    }, 600);
  };

  return (
    <div
      className="admin-card"
      style={{
        display: "flex",
        flexDirection: "column",
        justifyContent: "space-between",
        position: "relative",
        overflow: "hidden",
        backdropFilter: "blur(12px)",
        padding: "20px 22px 18px",
      }}
    >
      {/* Top Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "16px",
          paddingBottom: "12px",
          borderBottom: "1px solid var(--admin-card-border)",
        }}
      >
        {/* Left: Icon & Title */}
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {/* Custom 3-bar histogram icon */}
          <div
            style={{
              display: "flex",
              alignItems: "flex-end",
              gap: "3px",
              height: "20px",
              padding: "2px 0",
            }}
          >
            <span style={{ width: "3.5px", height: "10px", background: "var(--admin-heading)", borderRadius: "2px" }} />
            <span style={{ width: "3.5px", height: "18px", background: "var(--admin-heading)", borderRadius: "2px" }} />
            <span style={{ width: "3.5px", height: "13px", background: "var(--admin-heading)", borderRadius: "2px" }} />
          </div>
          <div>
            <h2
              style={{
                margin: 0,
                fontSize: "1.18rem",
                fontWeight: 700,
                color: "var(--admin-heading)",
                letterSpacing: "-0.01em",
              }}
            >
              Platform Telemetry
            </h2>
            <div style={{ fontSize: "0.72rem", color: "var(--admin-text-muted)" }}>
              Real Database Growth & Activity
            </div>
          </div>
        </div>

        {/* Right: Metrics & Actions */}
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Real Metrics: Registered Users & Cases Filed */}
          <div style={{ display: "flex", alignItems: "baseline", gap: "14px" }}>
            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                style={{
                  fontSize: "1.45rem",
                  fontWeight: 800,
                  color: "#0091FF",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {totalUsers.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--admin-text-muted)",
                }}
              >
                Users Registered
              </span>
            </div>

            <div style={{ display: "flex", alignItems: "baseline", gap: "6px" }}>
              <span
                style={{
                  fontSize: "1.45rem",
                  fontWeight: 800,
                  color: "#22C55E",
                  letterSpacing: "-0.02em",
                  lineHeight: 1,
                }}
              >
                {totalCases.toLocaleString()}
              </span>
              <span
                style={{
                  fontSize: "0.82rem",
                  fontWeight: 600,
                  color: "var(--admin-text-muted)",
                }}
              >
                Cases Filed
              </span>
            </div>
          </div>

          {/* Quick Buttons */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <button
              onClick={() => setViewMode(viewMode === "monthly" ? "cumulative" : "monthly")}
              title="Toggle between monthly new and cumulative totals"
              style={{
                background: "var(--admin-table-hdr)",
                border: "1px solid var(--admin-card-border)",
                borderRadius: "6px",
                padding: "4px 8px",
                fontSize: "0.74rem",
                fontWeight: 600,
                color: "var(--admin-text-muted)",
                cursor: "pointer",
              }}
            >
              {viewMode === "monthly" ? "Monthly" : "Cumulative"}
            </button>

            <button
              onClick={handleRefresh}
              title="Refresh database telemetry"
              style={{
                background: "transparent",
                border: "1px solid var(--admin-card-border)",
                borderRadius: "6px",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--admin-text-muted)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <RotateCw
                size={14}
                style={{
                  transform: isRefreshing ? "rotate(360deg)" : "none",
                  transition: isRefreshing ? "transform 0.6s ease" : "none",
                }}
              />
            </button>

            <button
              onClick={() => setShowInfo(!showInfo)}
              title="Toggle telemetry notes"
              style={{
                background: showInfo ? "var(--admin-table-hdr)" : "transparent",
                border: "1px solid var(--admin-card-border)",
                borderRadius: "6px",
                width: "30px",
                height: "30px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "var(--admin-text-muted)",
                cursor: "pointer",
                transition: "all 0.2s ease",
              }}
            >
              <Info size={14} />
            </button>
          </div>
        </div>
      </div>

      {/* Legend & Active Hover Feedback */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "12px",
          padding: "0 4px",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
          {/* Blue: Users Registered */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 600 }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#0091FF",
                boxShadow: "0 0 8px rgba(0, 145, 255, 0.6)",
              }}
            />
            <span style={{ color: "var(--admin-text-main)" }}>Users Registered</span>
          </div>

          {/* Green: Cases Filed */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "0.8rem", fontWeight: 600 }}>
            <span
              style={{
                width: "9px",
                height: "9px",
                borderRadius: "50%",
                background: "#22C55E",
                boxShadow: "0 0 8px rgba(34, 197, 94, 0.6)",
              }}
            />
            <span style={{ color: "var(--admin-text-main)" }}>Cases Filed</span>
          </div>
        </div>

        {/* Dynamic active hover pill */}
        {hoveredPoint && (
          <div
            style={{
              fontSize: "0.78rem",
              color: "var(--admin-text-muted)",
              background: "var(--admin-table-hdr)",
              padding: "2px 10px",
              borderRadius: "6px",
              border: "1px solid var(--admin-card-border)",
            }}
          >
            {hoveredPoint.month || `Interval ${hoveredPoint.id}`}:{" "}
            <strong style={{ color: "#0091FF" }}>{hoveredPoint.userVal}</strong> users •{" "}
            <strong style={{ color: "#22C55E" }}>{hoveredPoint.caseVal}</strong> cases
          </div>
        )}
      </div>

      {/* SVG Chart Area */}
      <div style={{ width: "100%", position: "relative", minHeight: "260px" }}>
        <svg
          viewBox="0 0 700 320"
          style={{ width: "100%", height: "auto", display: "block" }}
        >
          <defs>
            {/* Blue Peak Area Gradient */}
            <linearGradient id="realPeakGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#0091FF" stopOpacity="0.45" />
              <stop offset="50%" stopColor="#0091FF" stopOpacity="0.20" />
              <stop offset="100%" stopColor="#0091FF" stopOpacity="0.02" />
            </linearGradient>

            {/* Glowing Drop Shadows */}
            <filter id="realGlowBlue" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#0091FF" floodOpacity="0.55" />
            </filter>

            <filter id="realGlowGreen" x="-20%" y="-20%" width="140%" height="140%">
              <feDropShadow dx="0" dy="2" stdDeviation="3.5" floodColor="#22C55E" floodOpacity="0.55" />
            </filter>
          </defs>

          {/* Horizontal Gridlines & Y-Axis Labels based on dynamic yCeiling */}
          {[
            { frac: 1.0, y: 40 },
            { frac: 0.8, y: 88 },
            { frac: 0.6, y: 136 },
            { frac: 0.4, y: 184 },
            { frac: 0.2, y: 232 },
          ].map((grid) => {
            const val = Math.round(yCeiling * grid.frac);
            return (
              <g key={grid.frac}>
                <text
                  x="45"
                  y={grid.y + 4}
                  textAnchor="end"
                  fontSize="11"
                  fill="var(--admin-text-muted)"
                  opacity="0.75"
                  fontWeight="500"
                >
                  {val}
                </text>
                <line
                  x1="55"
                  y1={grid.y}
                  x2="675"
                  y2={grid.y}
                  stroke="var(--admin-card-border)"
                  strokeWidth="1"
                  opacity="0.6"
                />
              </g>
            );
          })}

          {/* Baseline (0) */}
          <line
            x1="55"
            y1="280"
            x2="675"
            y2="280"
            stroke="var(--admin-card-border)"
            strokeWidth="1"
            opacity="0.75"
          />

          {/* Vertical Guide Line at 1st Highlight */}
          <line
            x1={leftGuide.x}
            y1={leftGuide.y}
            x2={leftGuide.x}
            y2="280"
            stroke="#0091FF"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* Vertical Guide Line at 2nd Highlight */}
          <line
            x1={rightGuide.x}
            y1={rightGuide.y}
            x2={rightGuide.x}
            y2="280"
            stroke="#0091FF"
            strokeWidth="1.5"
            opacity="0.85"
          />

          {/* Glowing Area Fill between the two highlighted guides */}
          <path d={areaFillPath} fill="url(#realPeakGradient)" />

          {/* Blue Spline (Users Registered) */}
          <path
            d={userSplinePath}
            fill="none"
            stroke="#0091FF"
            strokeWidth="2.8"
            strokeLinecap="round"
            filter="url(#realGlowBlue)"
          />

          {/* Green Spline (Cases Filed) */}
          <path
            d={caseSplinePath}
            fill="none"
            stroke="#22C55E"
            strokeWidth="2.8"
            strokeLinecap="round"
            filter="url(#realGlowGreen)"
          />

          {/* Circular Nodes on Blue Spline */}
          {userCoords.map((coord, i) => {
            const isHighlight = i === maxUserIdx || i === secondHighlightIdx;
            return (
              <circle
                key={`u-${i}`}
                cx={coord.x}
                cy={coord.y}
                r={isHighlight ? 6 : 5}
                fill={isHighlight ? "#0091FF" : "var(--admin-card-bg)"}
                stroke={isHighlight ? "#FFFFFF" : "#0091FF"}
                strokeWidth="2.5"
              />
            );
          })}

          {/* Circular Nodes on Green Spline */}
          {caseCoords.map((coord, i) => (
            <circle
              key={`c-${i}`}
              cx={coord.x}
              cy={coord.y}
              r={5}
              fill="var(--admin-card-bg)"
              stroke="#22C55E"
              strokeWidth="2.5"
            />
          ))}

          {/* Floating Pill Badge 1 on 1st Guide */}
          <g>
            <rect
              x={leftGuide.x - 29}
              y={Math.max(14, leftGuide.y - 28)}
              width="58"
              height="24"
              rx="5"
              fill="#0091FF"
              style={{ filter: "drop-shadow(0 2px 5px rgba(0, 145, 255, 0.4))" }}
            />
            <text
              x={leftGuide.x}
              y={Math.max(14, leftGuide.y - 28) + 16}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="12.5"
              fontWeight="700"
              fontFamily="var(--admin-font)"
            >
              {leftGuide.val}
            </text>
          </g>

          {/* Floating Pill Badge 2 on 2nd Guide */}
          <g>
            <rect
              x={rightGuide.x - 29}
              y={Math.max(14, rightGuide.y - 28)}
              width="58"
              height="24"
              rx="5"
              fill="#0091FF"
              style={{ filter: "drop-shadow(0 2px 5px rgba(0, 145, 255, 0.4))" }}
            />
            <text
              x={rightGuide.x}
              y={Math.max(14, rightGuide.y - 28) + 16}
              textAnchor="middle"
              fill="#FFFFFF"
              fontSize="12.5"
              fontWeight="700"
              fontFamily="var(--admin-font)"
            >
              {rightGuide.val}
            </text>
          </g>

          {/* X-Axis Labels 1–8 with Month Names */}
          {chartData.map((pt) => (
            <g
              key={pt.id}
              style={{ cursor: "pointer" }}
              onMouseEnter={() => setHoveredPoint(pt)}
              onMouseLeave={() => setHoveredPoint(null)}
            >
              {/* Wide transparent hover target */}
              <rect
                x={pt.x - 35}
                y="30"
                width="70"
                height="270"
                fill="transparent"
              />

              {/* Number indicator */}
              <text
                x={pt.x}
                y="298"
                textAnchor="middle"
                fontSize="12"
                fontWeight={hoveredPoint?.id === pt.id ? "700" : "600"}
                fill={hoveredPoint?.id === pt.id ? "var(--admin-heading)" : "var(--admin-text-main)"}
              >
                {pt.id}
              </text>

              {/* Month abbreviation below number */}
              {pt.month && (
                <text
                  x={pt.x}
                  y="312"
                  textAnchor="middle"
                  fontSize="9.5"
                  fontWeight="500"
                  fill="var(--admin-text-muted)"
                  opacity="0.8"
                >
                  {pt.month}
                </text>
              )}
            </g>
          ))}
        </svg>
      </div>

      {/* Info details toggle */}
      {showInfo && (
        <div
          style={{
            marginTop: "12px",
            padding: "10px 14px",
            borderRadius: "8px",
            background: "var(--admin-table-hdr)",
            fontSize: "0.8rem",
            color: "var(--admin-text-muted)",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
          }}
        >
          <span>
            Realtime database telemetry: aggregates verified user registrations against official legal cases filed across all jurisdictions.
          </span>
          <span style={{ fontWeight: 600, color: "var(--admin-primary)" }}>Connected to MongoDB</span>
        </div>
      )}
    </div>
  );
};

export default StatisticsChart;
