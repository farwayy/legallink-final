import React from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Bot, CheckCircle2, Scale, ShieldCheck, Users } from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import "../styles/auth.css";

const DEFAULT_HIGHLIGHTS = [
  {
    icon: Scale,
    title: "Verified advocates",
    text: "Every counsel is checked against Pakistan Bar Council enrolment records.",
  },
  {
    icon: Users,
    title: "Pro bono legal aid",
    text: "Accredited NGOs take on cases for citizens who cannot afford representation.",
  },
  {
    icon: Bot,
    title: "Bilingual AI assistance",
    text: "Statute guidance in English and Roman Urdu, available around the clock.",
  },
];

const AuthLayout = ({
  eyebrow = "Pakistan's legal access network",
  title = (
    <>
      Justice, made <em>accessible</em>.
    </>
  ),
  description = "LegalLink connects citizens with verified advocates and accredited legal aid organisations — with every case, document and hearing managed in one secure place.",
  highlights = DEFAULT_HIGHLIGHTS,
  wide = false,
  backTo = "/",
  backLabel = "Back to home",
  children,
}) => {
  const year = new Date().getFullYear();

  return (
    <div className="auth-shell">
      {/* ---------------- Brand panel ---------------- */}
      <aside className="auth-brand ll-on-dark">
        <div className="auth-brand-bg" aria-hidden="true">
          <span className="auth-glow auth-glow-gold" />
          <span className="auth-glow auth-glow-green" />
          <span className="auth-grid" />
          <span className="auth-rings" />
          <span className="auth-sweep" />
        </div>

        <div className="auth-brand-content">
          <Link to="/" className="auth-brand-logo">
            <img src="/images/legallink-logo1.png" alt="" />
            <span>LegalLink</span>
          </Link>

          <div className="auth-brand-main">
            <div className="auth-brand-eyebrow">
              <ShieldCheck size={13} />
              <span>{eyebrow}</span>
            </div>
            <h2 className="auth-brand-title">{title}</h2>
            <p className="auth-brand-text">{description}</p>

            <ul className="auth-brand-list">
              {highlights.map(({ icon: Icon, title: itemTitle, text }) => (
                <li key={itemTitle}>
                  <span className="auth-brand-list-icon">
                    <Icon size={18} strokeWidth={1.8} />
                  </span>
                  <div>
                    <strong>{itemTitle}</strong>
                    <span>{text}</span>
                  </div>
                </li>
              ))}
            </ul>
          </div>

          <div className="auth-brand-foot">
            <div className="auth-brand-foot-badges">
              <span><CheckCircle2 size={13} /> Bar Council verified</span>
              <span><CheckCircle2 size={13} /> 256-bit encryption</span>
            </div>
            <span>© {year} LegalLink Pakistan</span>
          </div>
        </div>
      </aside>

      {/* ---------------- Form panel ---------------- */}
      <main className="auth-panel">
        <header className="auth-panel-head">
          <Link to="/" className="auth-panel-head-logo">
            <img src="/images/legallink-logo1.png" alt="" />
            <span>LegalLink</span>
          </Link>
          <div className="auth-panel-head-actions">
            <Link to={backTo} className="auth-back-link">
              <ArrowLeft size={15} />
              <span>{backLabel}</span>
            </Link>
            <ThemeToggle />
          </div>
        </header>

        <div className="auth-panel-body">
          <div className={`auth-form${wide ? " is-wide" : ""}`}>{children}</div>
        </div>

        <footer className="auth-panel-foot">
          <span>© {year} LegalLink Pakistan. All rights reserved.</span>
          <nav>
            <Link to="/about">Privacy</Link>
            <Link to="/about">Terms</Link>
            <Link to="/chatbot">Support</Link>
          </nav>
        </footer>
      </main>
    </div>
  );
};

export default AuthLayout;
