import React from "react";
import { Link } from "react-router-dom";
import SectionHeading from "./SectionHeading";
import Button from "./Button";
import Marquee from "./Marquee";
import { useTheme } from "../../contexts/ThemeContext";
import { contact, cta, footer, practiceTicker, cssVars } from "../../design/design";
import "../../styles/home.css";

/** Green footer with the closing call-to-action, link columns and a ticker. Used on every public page. */
const LandingFooter = ({ showCta = true }) => {
  const { isDark } = useTheme();
  return (
  <footer className="lx-footer ll-on-dark" style={cssVars(isDark)}>
    <div className="lx-wrap">
      {showCta && (
      <div className="lx-cta">
        <SectionHeading kicker={cta.kicker} accent={cta.accent} title={cta.title} light />
        <div className="lx-cta-actions">
          <Button variant="white" to={cta.primary.to}>{cta.primary.label}</Button>
          <Button variant="glass" href={cta.secondary.href} icon="chat" iconRight={null}>
            {cta.secondary.label}
          </Button>
        </div>
      </div>
      )}

      <div className="lx-footer-grid">
        <div>
          <div className="lx-footer-sig brand-signature">LegalLink</div>
          <p className="lx-footer-blurb">{footer.blurb}</p>
        </div>
        {footer.columns.map((col) => (
          <div key={col.title}>
            <h4 className="lx-footer-title">{col.title}</h4>
            <ul className="lx-footer-list">
              {col.links.map((l) => (
                <li key={l.to}><Link to={l.to}>{l.label}</Link></li>
              ))}
            </ul>
          </div>
        ))}
        <div>
          <h4 className="lx-footer-title">Contact</h4>
          <ul className="lx-footer-list">
            <li><a href={contact.whatsapp} target="_blank" rel="noopener noreferrer">WhatsApp helpline</a></li>
            <li><a href={`mailto:${contact.email}`}>{contact.email}</a></li>
            <li>{contact.hours}</li>
          </ul>
        </div>
      </div>

      <div className="lx-footer-bar">
        <span>© {new Date().getFullYear()} LegalLink. All rights reserved.</span>
        <span>{footer.legal}</span>
      </div>
    </div>
    <Marquee items={practiceTicker} size="sm" />
  </footer>
  );
};

export default LandingFooter;
