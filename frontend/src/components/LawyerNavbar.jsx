import React, { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import ThemeToggle from './ThemeToggle';
import { lawyerAPI, requestAPI } from '../services/api';
import {
  LayoutDashboard,
  Briefcase,
  User,
  LogOut,
  ShieldCheck,
  Clock,
  ChevronDown,
  Inbox
} from 'lucide-react';
import '../styles/counselPortal.css';
import AnnouncementBanner from "./ui/AnnouncementBanner";

const LawyerNavbar = () => {
  const { isAuthenticated, user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [pendingInvitesCount, setPendingInvitesCount] = useState(0);
  const [pendingRequestsCount, setPendingRequestsCount] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    document.body.classList.add('lawyer-portal-active');
    return () => document.body.classList.remove('lawyer-portal-active');
  }, []);

  useEffect(() => {
    if (!isAuthenticated || user?.role !== 'lawyer') return;
    lawyerAPI.getPanelInvitations()
      .then((res) => {
        if (res.data?.pendingCount !== undefined) {
          setPendingInvitesCount(res.data.pendingCount);
        } else if (Array.isArray(res.data?.invitations)) {
          setPendingInvitesCount(res.data.invitations.filter((i) => i.status === 'pending_lawyer_approval').length);
        }
      })
      .catch(() => {});
    requestAPI.getPendingRequests()
      .then((res) => setPendingRequestsCount((res.data?.requests || []).length))
      .catch(() => {});
  }, [location.pathname, isAuthenticated, user?.role]);

  // Close the account menu on outside click, Escape or navigation
  useEffect(() => {
    if (!menuOpen) return undefined;
    const onClick = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setMenuOpen(false);
    };
    const onKey = (e) => {
      if (e.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  const handleLogout = () => {
    logout();
    navigate('/login?role=lawyer');
  };

  if (!isAuthenticated || user?.role !== 'lawyer') {
    return null;
  }

  const navLinks = [
    { to: '/lawyer/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { to: '/lawyer/cases', label: 'My Cases', icon: Briefcase },
    { to: '/lawyer/requests', label: 'Requests', icon: Inbox },
    { to: '/lawyer/profile', label: 'Profile', icon: User }
  ];

  const isVerified = !user?.verificationStatus || user.verificationStatus === 'approved';
  const displayName = (user?.name || 'Counsel').replace(/^adv(ocate)?\.?\s+/i, '');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0].toUpperCase())
    .join('');

  return (
    <>
    <nav className="cp-nav" aria-label="Counsel portal">
      <div className="cp-nav-inner">
        <Link to="/lawyer/dashboard" className="cp-brand">
          <span className="cp-brand-mark">
            <img src="/images/legallink-logo.png" alt="" />
          </span>
          <span className="cp-brand-text">
            <span className="cp-brand-name brand-signature">LegalLink</span>
            <span className="cp-brand-sub">Counsel Portal</span>
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
                className={`cp-nav-link ll-nav-item${isActive ? ' is-active' : ''}`}
                aria-current={isActive ? 'page' : undefined}
              >
                <Icon size={16} strokeWidth={1.9} />
                <span>{link.label}</span>
                {link.to === '/lawyer/requests' && pendingInvitesCount + pendingRequestsCount > 0 && (
                  <span className="cp-nav-badge" title="Inquiries and panel invitations waiting for you">
                    {pendingInvitesCount + pendingRequestsCount}
                  </span>
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
                <span className="cp-account-name">Adv. {displayName}</span>
                {isVerified ? (
                  <span className="cp-account-role is-verified">
                    <ShieldCheck size={12} strokeWidth={2.2} /> Bar Council verified
                  </span>
                ) : (
                  <span className="cp-account-role">
                    <Clock size={12} strokeWidth={2.2} /> Verification pending
                  </span>
                )}
              </span>
              <ChevronDown size={16} color="#8FA39A" />
            </button>

            {menuOpen && (
              <div className="cp-menu" role="menu">
                <div className="cp-menu-head">
                  <strong>Adv. {displayName}</strong>
                  <span>{user?.email}</span>
                </div>
                <Link to="/lawyer/profile" className="cp-menu-item" role="menuitem">
                  <User size={16} /> My profile
                </Link>
                <Link to="/lawyer/cases" className="cp-menu-item" role="menuitem">
                  <Briefcase size={16} /> My cases
                </Link>
                <Link to="/lawyer/requests" className="cp-menu-item" role="menuitem">
                  <Inbox size={16} /> Requests
                </Link>
                <button type="button" className="cp-menu-item is-danger" role="menuitem" onClick={handleLogout}>
                  <LogOut size={16} /> Sign out
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </nav>
    <AnnouncementBanner audience="lawyer" />
    </>
  );
};

export default LawyerNavbar;
