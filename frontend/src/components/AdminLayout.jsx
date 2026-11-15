import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  LayoutDashboard,
  Scale,
  Building2,
  Users,
  Briefcase,
  CreditCard,
  ShieldAlert,
  Star,
  Megaphone,
  ScrollText,
  Settings,
  Bell,
  LogOut,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  ChevronRight,
  KeyRound,
} from "lucide-react";
import ThemeToggle from "./ThemeToggle";
import { useAuth } from "../contexts/AuthContext";
import { adminAPI, reviewAPI } from "../services/api";
import useAdminMe, { ROLE_LABELS, clearAdminMe } from "./admin/useAdminMe";
import "../styles/admin.css";
import "../styles/adminx.css";

const COLLAPSE_KEY = "ll_admin_sidebar_collapsed";

// Sidebar structure. `count` keys are filled from live data.
const NAV = [
  { group: "Overview", items: [{ key: "dashboard", aliases: ["overview"], label: "Dashboard", to: "/admin/dashboard", icon: LayoutDashboard }] },
  {
    group: "Verification",
    items: [
      { key: "lawyers", label: "Advocates", to: "/admin/lawyers", icon: Scale, count: "lawyers" },
      { key: "ngos", label: "NGOs", to: "/admin/ngos", icon: Building2, count: "ngos" },
    ],
  },
  { group: "People", items: [{ key: "users", label: "Citizens", to: "/admin/users", icon: Users }] },
  {
    group: "Operations",
    items: [
      { key: "cases", label: "Cases", to: "/admin/cases", icon: Briefcase },
      { key: "payments", label: "Payments", to: "/admin/payments", icon: CreditCard },
      { key: "disputes", label: "Disputes", to: "/admin/disputes", icon: ShieldAlert, count: "disputes" },
      { key: "reviews", aliases: ["flagged-reviews"], label: "Flagged reviews", to: "/admin/reviews", icon: Star, count: "reviews" },
    ],
  },
  {
    group: "System",
    items: [
      { key: "announcements", label: "Announcements", to: "/admin/announcements", icon: Megaphone },
      { key: "audit-log", aliases: ["logs"], label: "Audit log", to: "/admin/audit-log", icon: ScrollText },
      { key: "settings", label: "Settings", to: "/admin/settings", icon: Settings },
    ],
  },
];

const initialsOf = (name = "") =>
  name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("") || "AD";

const ago = (d) => {
  if (!d) return "";
  const h = Math.floor((Date.now() - new Date(d).getTime()) / 3600000);
  if (h < 1) return "just now";
  if (h < 24) return `${h}h ago`;
  const days = Math.floor(h / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
};

/**
 * Admin console shell: collapsible sidebar (remembered), top bar with global
 * search, live notifications and the account menu. Pages pass `breadcrumb` and
 * `activeNav`, exactly as before.
 */
const NAV_SCROLL_KEY = "ll_admin_nav_scroll";

const AdminLayout = ({ children, breadcrumb = "Overview", activeNav = "overview" }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(COLLAPSE_KEY) === "1";
    } catch (e) {
      return false;
    }
  });
  const [mobileOpen, setMobileOpen] = useState(false);
  const [openMenu, setOpenMenu] = useState(null); // "bell" | "account" | null
  const [counts, setCounts] = useState({});
  const [alerts, setAlerts] = useState([]);

  // Search
  const [query, setQuery] = useState("");
  const [searchOpen, setSearchOpen] = useState(false);
  const [index, setIndex] = useState(null);
  const [activeResult, setActiveResult] = useState(0);
  const searchRef = useRef(null);
  const inputRef = useRef(null);
  const menuRef = useRef(null);
  const navRef = useRef(null);

  // Each admin page mounts its own layout, so keep the sidebar's scroll
  // position between pages instead of jumping back to the top.
  useLayoutEffect(() => {
    const nav = navRef.current;
    if (!nav) return;
    try {
      const saved = Number(sessionStorage.getItem(NAV_SCROLL_KEY) || 0);
      if (saved) nav.scrollTop = saved;
    } catch (e) {
      /* ignore */
    }
    // Make sure the current page's link is visible
    const active = nav.querySelector(".ax-nav-item.is-active");
    if (active) {
      const a = active.getBoundingClientRect();
      const n = nav.getBoundingClientRect();
      if (a.top < n.top || a.bottom > n.bottom) active.scrollIntoView({ block: "nearest" });
    }
  }, []);
  const saveNavScroll = () => {
    try {
      sessionStorage.setItem(NAV_SCROLL_KEY, String(navRef.current?.scrollTop || 0));
    } catch (e) {
      /* ignore */
    }
  };

  // Name and role come from the server (falls back to the saved login)
  const { me, error: meError } = useAdminMe();
  const adminName = me?.name || (user?.role === "admin" ? user?.name : "") || "Administrator";
  const adminEmail = me?.email || (user?.role === "admin" ? user?.email || "" : "");
  const roleLabel = ROLE_LABELS[me?.role] || "Administrator";

  // Deactivated admins (or expired sessions) are sent back to sign in
  useEffect(() => {
    if (meError === 401) handleLogout();
  }, [meError]); // eslint-disable-line react-hooks/exhaustive-deps

  const toggleCollapsed = () => {
    setCollapsed((c) => {
      try {
        localStorage.setItem(COLLAPSE_KEY, c ? "0" : "1");
      } catch (e) {
        /* ignore */
      }
      return !c;
    });
  };

  useEffect(() => {
    setMobileOpen(false);
    setOpenMenu(null);
    setSearchOpen(false);
  }, [location.pathname]);

  // ── Live counts for the sidebar and the bell ──
  const loadCounts = useCallback(async () => {
    const [lawyers, ngos, disputes, reviews] = await Promise.all([
      adminAPI.getLawyers("pending").catch(() => null),
      adminAPI.getNGOs("pending").catch(() => null),
      adminAPI.getDisputes().catch(() => null),
      reviewAPI.getFlaggedReviews().catch(() => null),
    ]);
    const pl = (lawyers?.data?.lawyers || []).filter((l) => l.verificationStatus === "pending");
    const pn = (ngos?.data?.ngos || []).filter((n) => (n.verificationStatus || n.status) === "pending");
    const od = (disputes?.data?.disputes || []).filter((d) => ["open", "under_review"].includes(d.status));
    const fr = reviews?.data?.reviews || [];
    setCounts({ lawyers: pl.length, ngos: pn.length, disputes: od.length, reviews: fr.length });
    setAlerts(
      [
        ...pl.map((l) => ({ id: `l${l._id}`, icon: Scale, text: `${l.name} applied as an advocate`, at: l.createdAt, to: `/admin/lawyers?open=${l._id}` })),
        ...pn.map((n) => ({ id: `n${n._id}`, icon: Building2, text: `${n.name} applied for NGO accreditation`, at: n.createdAt, to: `/admin/ngos?open=${n._id}` })),
        ...od.map((d) => ({ id: `d${d._id}`, icon: ShieldAlert, text: `New dispute: ${d.category || "case issue"}`, at: d.createdAt, to: "/admin/disputes" })),
        ...fr.map((r) => ({ id: `r${r._id}`, icon: Star, text: `A review was flagged${r.flagReason ? `: ${r.flagReason}` : ""}`, at: r.flaggedAt || r.createdAt, to: "/admin/reviews" })),
      ]
        .sort((a, b) => new Date(b.at) - new Date(a.at))
        .slice(0, 12)
    );
  }, []);

  useEffect(() => {
    loadCounts();
    const t = setInterval(loadCounts, 60000);
    return () => clearInterval(t);
  }, [loadCounts, location.pathname]);

  // ── Close menus on outside click / Escape; Ctrl+K focuses search ──
  useEffect(() => {
    const onDown = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) setOpenMenu(null);
      if (searchRef.current && !searchRef.current.contains(e.target)) setSearchOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpenMenu(null);
        setSearchOpen(false);
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        inputRef.current?.focus();
      }
    };
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, []);

  // ── Global search: load everything once, filter as you type ──
  const ensureIndex = async () => {
    if (index) return;
    const [u, l, n, c] = await Promise.all([
      adminAPI.getUsers().catch(() => null),
      adminAPI.getLawyers().catch(() => null),
      adminAPI.getNGOs().catch(() => null),
      adminAPI.getCases().catch(() => null),
    ]);
    setIndex({
      Citizens: (u?.data?.users || u?.data || []).map((x) => ({ id: x._id, title: x.name, sub: x.email, to: `/admin/users?open=${x._id}`, hay: `${x.name} ${x.email} ${x.cnic || ""} ${x.phone || ""}` })),
      Advocates: (l?.data?.lawyers || []).map((x) => ({ id: x._id, title: x.name, sub: `${x.email} · ${x.barCouncilId || ""}`, to: `/admin/lawyers?open=${x._id}`, hay: `${x.name} ${x.email} ${x.barCouncilId || ""} ${x.cnic || ""}` })),
      NGOs: (n?.data?.ngos || []).map((x) => ({ id: x._id, title: x.name, sub: `${x.city || ""} · ${x.registrationNumber || ""}`, to: `/admin/ngos?open=${x._id}`, hay: `${x.name} ${x.email} ${x.registrationNumber || ""} ${x.city || ""}` })),
      Cases: (c?.data?.cases || []).map((x) => ({ id: x._id, title: x.title, sub: `${x.category || ""} · #${String(x._id).slice(-6).toUpperCase()}`, to: `/admin/cases?open=${x._id}`, hay: `${x.title} ${x.category || ""} ${x._id} ${x.userId?.name || ""}` })),
    });
  };

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!index || q.length < 2) return [];
    const out = [];
    Object.entries(index).forEach(([group, list]) => {
      list
        .filter((x) => x.hay.toLowerCase().includes(q))
        .slice(0, 5)
        .forEach((x) => out.push({ ...x, group }));
    });
    return out;
  }, [index, query]);

  const go = (to) => {
    setSearchOpen(false);
    setQuery("");
    navigate(to);
  };

  const onSearchKey = (e) => {
    if (!results.length) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveResult((i) => Math.min(i + 1, results.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveResult((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      go(results[activeResult].to);
    }
  };

  const handleLogout = () => {
    clearAdminMe();
    if (logout) logout("/admin/login");
    localStorage.removeItem("token");
    localStorage.removeItem("user");
    localStorage.removeItem("userRole");
    navigate("/admin/login");
  };

  const isActive = (item) => activeNav === item.key || item.aliases?.includes(activeNav);
  const totalAlerts = alerts.length;

  return (
    <div className={`ax-root${collapsed ? " is-collapsed" : ""}${mobileOpen ? " is-mobile-open" : ""}`}>
      {mobileOpen && <div className="ax-scrim" style={{ zIndex: 35 }} onClick={() => setMobileOpen(false)} />}

      {/* ───────── Sidebar ───────── */}
      <aside className="ax-side" aria-label="Admin navigation">
        <Link to="/admin/dashboard" className="ax-brand">
          <img src="/images/legallink-logo.png" alt="" />
          <span className="ax-brand-text">
            <strong>LegalLink</strong>
            <span>Admin console</span>
          </span>
        </Link>

        <nav className="ax-nav" ref={navRef} onScroll={saveNavScroll}>
          {NAV.map((g) => (
            <div key={g.group} className="ax-nav-group">
              <div className="ax-nav-label">{g.group}</div>
              {g.items.map((item) => {
                const Icon = item.icon;
                const n = item.count ? counts[item.count] || 0 : 0;
                return (
                  <Link
                    key={item.key}
                    to={item.to}
                    data-label={item.label}
                    className={`ax-nav-item${isActive(item) ? " is-active" : ""}`}
                    aria-current={isActive(item) ? "page" : undefined}
                  >
                    <Icon size={18} strokeWidth={1.9} />
                    <span className="ax-nav-text">{item.label}</span>
                    {n > 0 && <span className="ax-nav-count" title={`${n} waiting`}>{n}</span>}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="ax-side-foot">
          <span className="ax-avatar" title={adminName}>{initialsOf(adminName)}</span>
          <span className="ax-side-who">
            <strong>{adminName}</strong>
            <span>{roleLabel}</span>
          </span>
          <button type="button" className="ax-side-out" onClick={handleLogout} aria-label="Sign out" title="Sign out">
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ───────── Main ───────── */}
      <div className="ax-main">
        <header className="ax-top">
          <button
            type="button"
            className="ax-icon-btn d-none d-lg-grid"
            onClick={toggleCollapsed}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <button type="button" className="ax-icon-btn d-lg-none" onClick={() => setMobileOpen(true)} aria-label="Open menu">
            <Menu size={17} />
          </button>

          <div className="ax-crumbs">
            <span>Admin</span>
            <ChevronRight size={14} />
            <strong>{breadcrumb}</strong>
          </div>

          <div className="ax-search" ref={searchRef}>
            <Search size={15} />
            <input
              ref={inputRef}
              value={query}
              onChange={(e) => {
                setQuery(e.target.value);
                setActiveResult(0);
                setSearchOpen(true);
              }}
              onFocus={() => {
                ensureIndex();
                setSearchOpen(true);
              }}
              onKeyDown={onSearchKey}
              placeholder="Search people, NGOs, cases…"
              aria-label="Search"
            />
            <span className="ax-kbd">Ctrl K</span>
            {searchOpen && query.trim().length >= 2 && (
              <div className="ax-search-results" role="listbox">
                {!index ? (
                  <div className="ax-search-empty">Loading…</div>
                ) : results.length === 0 ? (
                  <div className="ax-search-empty">Nothing matches “{query}”.</div>
                ) : (
                  results.map((r, i) => (
                    <React.Fragment key={`${r.group}-${r.id}`}>
                      {(i === 0 || results[i - 1].group !== r.group) && <div className="ax-search-group">{r.group}</div>}
                      <button
                        type="button"
                        role="option"
                        aria-selected={i === activeResult}
                        className={`ax-search-item${i === activeResult ? " is-on" : ""}`}
                        onMouseEnter={() => setActiveResult(i)}
                        onClick={() => go(r.to)}
                      >
                        <span>
                          {r.title}
                          <small>{r.sub}</small>
                        </span>
                      </button>
                    </React.Fragment>
                  ))
                )}
              </div>
            )}
          </div>

          <div className="ax-top-actions" ref={menuRef}>
            <ThemeToggle />

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="ax-icon-btn"
                onClick={() => setOpenMenu(openMenu === "bell" ? null : "bell")}
                aria-label={`Notifications${totalAlerts ? `, ${totalAlerts} waiting` : ""}`}
                aria-expanded={openMenu === "bell"}
              >
                <Bell size={17} />
                {totalAlerts > 0 && <span className="ax-dot">{totalAlerts > 9 ? "9+" : totalAlerts}</span>}
              </button>
              {openMenu === "bell" && (
                <div className="ax-menu" role="menu" style={{ width: 340 }}>
                  <div className="ax-menu-head">
                    <strong>Needs your attention</strong>
                    <span>{totalAlerts ? `${totalAlerts} item${totalAlerts === 1 ? "" : "s"} waiting` : "Nothing waiting"}</span>
                  </div>
                  {alerts.length === 0 ? (
                    <div className="ax-search-empty">You're all caught up.</div>
                  ) : (
                    <div style={{ maxHeight: 360, overflowY: "auto" }}>
                      {alerts.map((a) => {
                        const Icon = a.icon;
                        return (
                          <button key={a.id} type="button" className="ax-menu-item" onClick={() => go(a.to)}>
                            <Icon size={16} style={{ flexShrink: 0, color: "var(--ax-muted)" }} />
                            <span style={{ flex: 1, minWidth: 0 }}>
                              {a.text}
                              <small style={{ display: "block", color: "var(--ax-muted)", fontSize: 12 }}>{ago(a.at)}</small>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div style={{ position: "relative" }}>
              <button
                type="button"
                className="ax-account-btn"
                onClick={() => setOpenMenu(openMenu === "account" ? null : "account")}
                aria-expanded={openMenu === "account"}
              >
                <span className="ax-avatar">{initialsOf(adminName)}</span>
                <span className="d-none d-md-inline">{adminName.split(" ")[0]}</span>
              </button>
              {openMenu === "account" && (
                <div className="ax-menu" role="menu" style={{ width: 240 }}>
                  <div className="ax-menu-head">
                    <strong>{adminName}</strong>
                    <span>{adminEmail}</span>
                    <span className="ax-role-chip">{roleLabel}</span>
                  </div>
                  <Link to="/admin/settings?tab=security" className="ax-menu-item" role="menuitem">
                    <KeyRound size={16} /> Change password
                  </Link>
                  <Link to="/admin/settings" className="ax-menu-item" role="menuitem">
                    <Settings size={16} /> Settings
                  </Link>
                  <button type="button" className="ax-menu-item is-danger" role="menuitem" onClick={handleLogout}>
                    <LogOut size={16} /> Sign out
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <main className="ax-content">{children}</main>
      </div>
    </div>
  );
};

export default AdminLayout;
