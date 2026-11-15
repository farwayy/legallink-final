import React, { useEffect, useState } from "react";
import { Link, NavLink, useNavigate } from "react-router-dom";
import { Menu, X } from "lucide-react";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import ThemeToggle from "../ThemeToggle";
import { images, navLinks, cssVars } from "../../design/design";
import "../../styles/home.css";
import AutoReveal from "../ui/AutoReveal";

/** Where each signed-in role's portal lives. */
const PORTALS = {
  ngo: { to: "/ngo/dashboard", label: "NGO Portal" },
  lawyer: { to: "/lawyer/dashboard", label: "Counsel Portal" },
  admin: { to: "/admin/dashboard", label: "Admin Panel" },
  super_admin: { to: "/admin/dashboard", label: "Admin Panel" },
  user: { to: "/user/dashboard", label: "My Dashboard" },
};

const readRole = (user) => {
  try {
    const stored = localStorage.getItem("role") || localStorage.getItem("userRole");
    if (stored) return stored.toLowerCase();
    const u = JSON.parse(localStorage.getItem("user") || "null");
    if (u?.role) return u.role.toLowerCase();
  } catch (e) {
    /* ignore */
  }
  return (user?.role || "user").toLowerCase();
};

/**
 * Site navigation, used on every public page.
 * variant="overlay" (landing page): transparent over the green hero, turns solid on scroll.
 * variant="solid" (all other pages): solid green bar that sticks to the top.
 */
const LandingNav = ({ variant = "overlay" }) => {
  const { isAuthenticated, user, logout } = useAuth();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const signedIn = isAuthenticated || Boolean(localStorage.getItem("token"));
  const portal = PORTALS[readRole(user)] || PORTALS.user;

  const handleLogout = () => {
    localStorage.clear();
    try {
      if (logout) {
        logout("/login");
        return;
      }
    } catch (e) {
      /* fall through */
    }
    navigate("/login");
  };

  return (
    <>
    <AutoReveal />
    <header
      className={`lx-nav ll-on-dark${variant === "solid" ? " is-static" : ""}${scrolled ? " is-solid" : ""}${open ? " is-open" : ""}`}
      style={cssVars(isDark)}
    >
      <div className="lx-wrap lx-nav-inner">
        <Link to="/" className="lx-brand" onClick={() => setOpen(false)}>
          <img src={images.logo} alt="" />
          <span className="brand-signature">LegalLink</span>
        </Link>

        <nav className="lx-nav-links" aria-label="Main">
          {navLinks.map((l) => (
            <NavLink key={l.to} to={l.to} end className="lx-nav-link" onClick={() => setOpen(false)}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="lx-nav-actions">
          <ThemeToggle className="lx-nav-toggle" />
          {signedIn ? (
            <>
              <button type="button" className="lx-nav-text" onClick={handleLogout}>Log out</button>
              <Link to={portal.to} className="lx-nav-cta">{portal.label}</Link>
            </>
          ) : (
            <>
              <Link to="/login" className="lx-nav-text">Log in</Link>
              <Link to="/signup" className="lx-nav-cta">Get Legal Help</Link>
            </>
          )}
          <button
            type="button"
            className="lx-nav-burger"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
          >
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
      </div>
    </header>
    </>
  );
};

export default LandingNav;
