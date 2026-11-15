import React from "react";
import Icon from "./Icon";

/**
 * The circular "Justice Equalized" portal with rotating rings and floating badges
 * (the animation from the previous landing page).
 */
const JusticePortal = ({ image, seal, badges = [] }) => (
  <div className="lx-portal">
    <div className="lx-portal-orbit" />
    <div className="lx-portal-ring" />
    <div className="lx-portal-circle">
      <img src={image} alt="" loading="lazy" />
      <span className="lx-portal-seal">{seal}</span>
    </div>
    {badges.map((b, i) => (
      <div key={b.title} className={`lx-float-badge is-${b.pos}`} style={{ animationDelay: `${i * 1.2}s` }}>
        {b.icon === "live" ? (
          <span className="lx-live-dot" />
        ) : (
          <span className="lx-float-icon"><Icon name={b.icon} size={17} /></span>
        )}
        <span>
          <strong>{b.title}</strong>
          <small>{b.text}</small>
        </span>
      </div>
    ))}
  </div>
);

export default JusticePortal;
