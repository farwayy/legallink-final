import React from "react";

/** One step of the "How it works" row. */
const StepCard = ({ num, accent, title, text, image }) => (
  <div className="lx-step">
    <span className="lx-step-num">{num}</span>
    {image && <img className="lx-step-img" src={image} alt="" loading="lazy" />}
    <h3 className="lx-step-title">
      <em>{accent}</em> {title}
    </h3>
    <p className="lx-step-text">{text}</p>
  </div>
);

export default StepCard;
