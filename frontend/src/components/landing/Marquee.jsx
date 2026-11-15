import React from "react";

/** Endless scrolling band of words separated by ✦. Pauses on hover. */
const Marquee = ({ items, size = "lg", className = "" }) => {
  const loop = [...items, ...items];
  return (
    <div className={`lx-marquee is-${size} ll-on-dark ${className}`} aria-label={items.join(", ")}>
      <div className="lx-marquee-track" aria-hidden="true">
        {loop.map((word, i) => (
          <React.Fragment key={i}>
            <span className="lx-marquee-word">{word}</span>
            <span className="lx-marquee-star">✦</span>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default Marquee;
