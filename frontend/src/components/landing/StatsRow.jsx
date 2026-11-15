import React from "react";

/** Row of big numbers with labels, e.g. 500+ Verified advocates. */
const StatsRow = ({ items, className = "" }) => (
  <div className={`lx-stats ${className}`}>
    {items.map((s) => (
      <div className="lx-stat" key={s.label}>
        <span className="lx-stat-value">
          {s.value}
          <sup>{s.suffix}</sup>
        </span>
        <span className="lx-stat-label">{s.label}</span>
      </div>
    ))}
  </div>
);

export default StatsRow;
