import React, { useState, useEffect, useRef } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { ngoAPI } from "../services/api";
import ThemeToggle from "./ThemeToggle";
import {
  LayoutDashboard,
  Building,
  Globe,
  LogOut,
  ShieldCheck,
  Clock,
  ChevronDown,
  Briefcase,
  Inbox,
  Users
} from "lucide-react";
import "../styles/counselPortal.css";
import AnnouncementBanner from "./ui/AnnouncementBanner";

const NGONavbar = () => {
  const { logout, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [menuOpen, setMenuOpen] = useState(false);
  const [pendingAid, setPendingAid] = useState(0);
  const menuRef = useRef(null);

  // Count of aid requests waiting for a decision, shown on the Requests link
  useEffect(() => {
    if (user?.role !== "ngo") return;
    ngoAPI
      .getAidRequests("pending")
      .then((res) => setPendingAid((res.data?.requests || []).filter((r) => r.status === "pending").length))
      .catch(() => {});
  }, [location.pathname, user?.role]);

  // Close the account menu on outside click, Escape or navigation
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate("/login?role=ngo");
  };

  const navLinks = [
    { to: "/ngo/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { to: "/ngo/cases", label: "Cases", icon: Briefcase },
    { to: "/ngo/requests", label: "Requests", icon: Inbox },
    { to: "/ngo/panel", label: "Panel", icon: Users },
    { to: "/ngo/profile", label: "Organisation", icon: Building }
  ];

  const orgName = user?.name || "Legal aid organisation";
  const isVerified = !user?.verificationStatus || user.verificationStatus === "approved";
  const initials = orgName
    .split(" ")
    .filter((w) => w && /[A-Za-z]/.test(w[0]))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "NG";

  return (
    <>
    <nav className="cp-nav" aria-label="Legal aid portal">
      <div className="cp-nav-inner">
        <Link to="/ngo/dashboard" className="cp-brand">
          <span className="cp-brand-mark">
            <img src="/images/legallink-logo.png" alt="" />
          </span>
          <span className="cp-brand-text">
            <span className="cp-brand-name brand-signature">LegalLink</span>
            <span className="cp-brand-sub">Legal Aid Portal</span>
          </span>
        </Link>

        <div className="cp-nav-links">
          {navLinks.map((link) => {
            const Icon = link.icon;
            const isActive = location.pathname === link.to;
            return (
              <Link
                key={link.to}
                to={link.to}
                className={`cp-nav-link ll-nav-item${isActive ? " is-active" : ""}`}
                aria-current={isActive ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.9} />
                <span>{link.label}</span>
                {link.to === "/ngo/requests" && pendingAid > 0 && (
                  <span className="cp-nav-badge" title="Aid requests waiting for a decision">{pendingAid}</span>
                )}
              </Link>
            );
          })}
        </div>

        <div className="cp-nav-actions">
          <ThemeToggle />

          <div className="cp-account" ref={menuRef}>
            <button
              type="button"
              className="cp-account-btn"
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Account menu"
            >
              <span className="cp-avatar">{initials}</span>
              <span className="cp-account-text">
                <span className="cp-account-name">{orgName}</span>
                {isVerified ? (
                  <span className="cp-account-role is-verified">
                    <ShieldCheck size={12} strokeWidth={2.2} /> Accredited partner
                  </span>
                ) : (
                  <span className="cp-account-role">
                    <Clock size={12} strokeWidth={2.2} /> Accreditation pending
                  </span>
                )}
              </span>
              <ChevronDown size={16} color="#8FA39A" />
            </button>

            {menuOpen && (
              <div className="cp-menu" role="menu">
                <div className="cp-menu-head">
                  <strong>{orgName}</strong>
                  <span>{user?.email}</span>
                </div>
                <Link to="/ngo/profile" className="cp-menu-item" role="menuitem">
                  <Building size={16} /> Organisation profile
                </Link>
                <a href="/ngos" target="_blank" rel="noopener noreferrer" className="cp-menu-item" role="menuitem">
                  <Globe size={16} /> Public directory
                </a>
                <button type="button" className="cp-menu-item is-danger" role="menuitem" onClick={handleLogout}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
    <AnnouncementBanner audience="ngo" />
    </>
  );
};

export default NGONavbar;
