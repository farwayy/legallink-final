import React from "react";
import { Link } from "react-router-dom";
import Icon from "./Icon";

/** Practice area card. Turns green on hover (or when `featured`). */
const PracticeCard = ({ icon, title, text, to, featured = false }) => (
  <Link to={to} className={`lx-pcard${featured ? " is-featured" : ""}`}>
    <span className="lx-pcard-icon"><Icon name={icon} size={22} strokeWidth={1.8} /></span>
    <h3 className="lx-pcard-title">{title}</h3>
    <p className="lx-pcard-text">{text}</p>
    <span className="lx-pcard-more">
      Explore specialists <Icon name="arrow" size={14} />
    </span>
  </Link>
);

export default PracticeCard;
