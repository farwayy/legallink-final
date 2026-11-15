import React from "react";

/**
 * Section title in the "*Italic* Regular" style.
 * `light` = white text (for use on the green gradient).
 */
const SectionHeading = ({ kicker, accent, title, as: Tag = "h2", light = false, center = false, className = "" }) => (
  <div className={`lx-heading${light ? " is-light" : ""}${center ? " is-center" : ""} ${className}`}>
    {kicker && <div className="lx-kicker">{kicker}</div>}
    <Tag className="lx-h2">
      {accent && <em>{accent}</em>} {title}
    </Tag>
  </div>
);

export default SectionHeading;
