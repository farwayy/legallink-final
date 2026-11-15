import React from "react";
import { useTheme } from "../../contexts/ThemeContext";
import { cssVars } from "../../design/design";
import Icon from "./Icon";
import "../../styles/home.css";

/**
 * Green page header used at the top of every public page
 * (Find Advocates, Legal Aid, AI Assistant, Templates, About…).
 * Put the page's first card right after it with className="lx-after-hero"
 * so the card overlaps the bottom of the green band.
 */
const PageHero = ({ kicker, accent, title, text, icon = "scale", children }) => {
  const { isDark } = useTheme();
  return (
    <section className="lx-page-hero ll-on-dark" style={cssVars(isDark)}>
      <div className="lx-wrap lx-page-hero-inner">
        <div className="lx-page-hero-copy">
          {kicker && <div className="lx-kicker">{kicker}</div>}
          <h1 className="lx-page-hero-title">
            {accent && <em>{accent}</em>} {title}
          </h1>
          {text && <p className="lx-page-hero-text">{text}</p>}
          {children}
        </div>
        <span className="lx-page-hero-icon" aria-hidden="true">
          <Icon name={icon} size={150} strokeWidth={0.9} />
        </span>
      </div>
    </section>
  );
};

export default PageHero;
