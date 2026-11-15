import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useRealTime } from "../../contexts/RealTimeContext";
import { lawyerAPI, requestAPI, reviewAPI } from "../../services/api";
import axios from "axios";
import LawyerNavbar from "../../components/LawyerNavbar";
import { notify } from "../../components/Toast";
import Footer from "../../components/Footer";
import TodayPriorities from "../../components/dashboard/TodayPriorities";
import { getCaseStage, isActiveCase, getNextHearing, getUnread } from "../../utils/caseStage";
import { DashboardSkeleton } from "../../components/SkeletonLoader";
import {
  Briefcase,
  Clock,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  FolderOpen,
  User,
  Phone,
  Mail,
  Tag,
  ArrowRight,
  PlusCircle,
  X,
  Check,
  MessageSquare,
  Building2
} from "lucide-react";
import { API_URL } from "../../config";

// view="home"     → /lawyer/dashboard : short overview (stats, priorities, recent cases)
// view="requests" → /lawyer/requests  : client inquiries, open cases and panel invites
const REQUEST_TABS = ["requests", "available", "invitations"];

const LawyerDashboard = ({ view = "home" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [stats, setStats] = useState({});
  const [cases, setCases] = useState([]);
  const [reviewSummary, setReviewSummary] = useState({ average: 0, total: 0 });
  const [availableCases, setAvailableCases] = useState([]);
  const [panelInvitations, setPanelInvitations] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [activeTab, setActiveTab] = useState(() => {
    const t = new URLSearchParams(location.search).get("tab");
    return REQUEST_TABS.includes(t) ? t : "requests";
  });
  const [loading, setLoading] = useState(true);
  const [pendingRequests, setPendingRequests] = useState([]);
  const [rejectModal, setRejectModal] = useState(null);
  const [rejectReason, setRejectReason] = useState("");

  // Keep the tab in step with the address (?tab=available etc.)
  useEffect(() => {
    if (view !== "requests") return;
    const t = new URLSearchParams(location.search).get("tab");
    if (REQUEST_TABS.includes(t)) setActiveTab(t);
  }, [location.search, view]);

  // Work queues live on their own page; cases live on My Cases
  const openTab = (id) => {
    if (id === "my-cases") return navigate("/lawyer/cases");
    if (view === "requests") {
      setActiveTab(id);
      navigate(`/lawyer/requests?tab=${id}`, { replace: true });
      return;
    }
    navigate(`/lawyer/requests?tab=${id}`);
  };

  const { socket } = useRealTime();

  // Real-time: keep case messages fresh so "waiting for your reply" stays correct
  useEffect(() => {
    if (!socket) return;
    const handleCaseMessage = (data) => {
      setCases((prevCases) =>
        prevCases.map((c) => {
          if (c._id !== data?.caseId) return c;
          const exists = c.messages?.some(
            (m) =>
              (m._id && data.message?._id && m._id === data.message._id) ||
              (m.senderId === data.message?.senderId &&
                m.message === data.message?.message &&
                Math.abs(new Date(m.timestamp) - new Date(data.message?.timestamp)) < 2000)
          );
          return exists ? c : { ...c, messages: [...(c.messages || []), data.message] };
        })
      );
    };
    socket.on("case-message", handleCaseMessage);
    return () => socket.off("case-message", handleCaseMessage);
  }, [socket]);

  useEffect(() => {
    fetchDashboardData();
    fetchPendingRequests();
    fetchNotifications();
    fetchPanelInvitations();
  }, []);

  const fetchPanelInvitations = async () => {
    try {
      const response = await lawyerAPI.getPanelInvitations();
      setPanelInvitations(response.data?.invitations || []);
    } catch (error) {
      console.error("Error fetching panel invitations:", error);
    }
  };

  const handleRespondPanelInvitation = async (membershipId, action) => {
    try {
      await lawyerAPI.respondPanelInvitation(membershipId, action);
      notify(action === "accept" ? "You joined the legal aid panel." : "You declined the panel invitation.", "success");
      fetchPanelInvitations();
      fetchDashboardData();
    } catch (error) {
      console.error("Error responding to panel invitation:", error);
      notify(error.response?.data?.message || "Couldn't respond to the invitation. Please try again.", "error");
    }
  };

  const fetchDashboardData = async () => {
    try {
      const [statsRes, casesRes, availableRes] = await Promise.all([
        lawyerAPI.getStats(),
        lawyerAPI.getCases(),
        lawyerAPI.getAvailableCases(),
      ]);

      setStats(statsRes.data || {});
      setCases(casesRes.data?.cases || []);
      // Live rating for the profile card (the saved login data can be out of date)
      const myId = user?._id || user?.id;
      if (myId) {
        reviewAPI
          .getLawyerReviews(myId)
          .then((r) =>
            setReviewSummary({
              average: Number(r.data?.averageRating || 0),
              total: r.data?.totalReviews || (r.data?.reviews || []).length,
            })
          )
          .catch(() => {});
      }
      setAvailableCases(availableRes.data?.cases || []);
    } catch (error) {
      console.error("Error fetching dashboard data:", error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const response = await axios.get(`${API_URL}/notifications`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      setNotifications(response.data.notifications || []);
    } catch (error) {
      console.error("Error fetching notifications:", error);
    }
  };

  const fetchPendingRequests = async () => {
    try {
      const response = await requestAPI.getPendingRequests();
      setPendingRequests(response.data.requests || []);
    } catch (error) {
      console.error("Error fetching requests:", error);
    }
  };

  const handleAcceptRequest = async (requestId) => {
    try {
      const response = await requestAPI.acceptRequest(requestId);
      if (response.data.success) {
        notify("Inquiry accepted. The client has been asked to pay, and the case opens once they do.", "success");
        fetchPendingRequests();
        fetchDashboardData();
      }
    } catch (error) {
      notify(error.response?.data?.message || "Couldn't accept the inquiry. Please try again.", "error");
    }
  };

  const handleRejectRequest = async () => {
    if (!rejectModal) return;
    try {
      const response = await requestAPI.rejectRequest(rejectModal.id, rejectReason);
      if (response.data.success) {
        notify("Inquiry declined. The client has been told and nothing was charged.", "success");
        setRejectModal(null);
        setRejectReason("");
        fetchPendingRequests();
      }
    } catch (error) {
      notify(error.response?.data?.message || "Couldn't decline the inquiry. Please try again.", "error");
    }
  };

  const handleAcceptCase = async (caseId) => {
    try {
      await lawyerAPI.acceptCase(caseId);
      fetchDashboardData();
      notify("Case accepted. It's now in your cases.", "success");
    } catch (error) {
      console.error("Error accepting case:", error);
      notify("Couldn't accept the case. Please try again.", "error");
    }
  };

  // Helper for status badge styling
  // ── Dashboard figures ──────────────────────────────────────────
  const [acceptingClients, setAcceptingClients] = useState(
    () => localStorage.getItem("lawyer_accepting_clients") !== "false"
  );

  const toggleAcceptingClients = () => {
    const next = !acceptingClients;
    setAcceptingClients(next);
    localStorage.setItem("lawyer_accepting_clients", next ? "true" : "false");
  };

  const getHearings = (c) => c.hearingDates || c.hearings || [];

  // Same rule everywhere: resolved, closed and rejected cases are not active
  const activeCaseList = cases.filter(isActiveCase);
  const activeCasesCount = activeCaseList.length;
  const resolvedCasesCount = cases.filter(c => ["resolved", "closed"].includes((c.status || "").toLowerCase())).length;
  const proBonoCount = activeCaseList.filter(c => c.caseType === "pro_bono" || c.ngoId).length;

  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcomingHearings = activeCaseList
    .flatMap((c) =>
      getHearings(c).map((h) => ({ ...h, caseId: c._id, caseTitle: c.title, clientName: c.userId?.name }))
    )
    .filter((h) => h.date && new Date(h.date) >= startOfToday && h.status !== "cancelled")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextHearing = upcomingHearings[0];
  const totalUpcomingHearings = stats.upcomingHearings ?? upcomingHearings.length;
  const daysUntilNext = nextHearing
    ? Math.round((new Date(nextHearing.date).setHours(0, 0, 0, 0) - startOfToday) / 86400000)
    : null;

  const pendingInvites = panelInvitations.filter((inv) => inv.status === "pending_lawyer_approval");

  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";
  const isVerified = !user?.verificationStatus || user.verificationStatus === "approved";
  const displayName = (user?.name || "Counsel").replace(/^adv(ocate)?\.?\s+/i, "");
  const rating = Number(reviewSummary.average || user?.rating || 0);

  // Stage comes from the shared rule (utils/caseStage.js), so it matches the case file
  const getStage = (c) => getCaseStage(c);

  const recentCases = [...activeCaseList]
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 4);

  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" });

  const tabs = [
    { id: "requests", label: "Client inquiries", count: pendingRequests.length, alert: pendingRequests.length > 0 },
    { id: "available", label: "Open cases", count: availableCases.length },
    { id: "invitations", label: "Panel invites", count: pendingInvites.length, alert: pendingInvites.length > 0 }
  ];

  if (loading && cases.length === 0) {
    return (
      <>
        <LawyerNavbar />
        <div className="cp-page" style={{ padding: "0 24px" }}>
          <DashboardSkeleton cards={4} cols={6} rows={5} />
        </div>
      </>
    );
  }

  return (
    <>
      <LawyerNavbar />

      <div className="cp-page page-fade">
        {view === "requests" ? (
          <>
        <section className="cp-hero is-compact ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <div className="cp-title-row">
                <span className="cp-hero-icon"><MessageSquare size={22} strokeWidth={1.8} /></span>
                <div>
                  <h1 className="cp-hero-title">Requests</h1>
                  <p className="cp-hero-text">Client inquiries, open cases from the community pool, and NGO panel invitations.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="cp-main">
          <section className="cp-matters rq-page">
            <div className="cp-tabs" role="tablist" aria-label="Requests">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  className={`cp-tab${activeTab === tab.id ? " is-active" : ""}`}
                  onClick={() => openTab(tab.id)}
                >
                  {tab.label}
                  <span className={`cp-tab-count${tab.alert && activeTab !== tab.id ? " is-alert" : ""}`}>{tab.count}</span>
                </button>
              ))}
            </div>

            <div className="cp-matters-body">
          {/* ── TAB 2: CITIZEN REQUESTS ── */}
          {activeTab === "requests" && (
            <div>
              {pendingRequests.length === 0 ? (
                <div className="legal-card text-center" style={{ padding: "64px 24px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      backgroundColor: "#F1F5F9",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 18px auto"
                    }}
                  >
                    <Clock size={28} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: "700", color: "#0F172A", marginBottom: "8px" }}>
                    No pending citizen inquiries
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748B", maxWidth: "460px", margin: "0 auto", lineHeight: "1.5" }}>
                    When citizens submit private representation requests or consultation bookings, they will appear here for your review and acceptance.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {pendingRequests.map((req) => {
                    const isAccepted = req.status === "accepted_awaiting_payment";
                    const pkgName = (req.packageType || "gold").toUpperCase();
                    const feeAmount = req.amount || (req.packageType === "platinum" ? 45000 : 25000);

                    return (
                      <div key={req._id} className="legal-card" style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "14px" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                              {isAccepted ? (
                                <span className="badge-semantic badge-info">Awaiting Client Payment</span>
                              ) : (
                                <span className="badge-semantic badge-warning">Pending Review</span>
                              )}
                              <span 
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  backgroundColor: req.packageType === "platinum" ? "#F0FDF4" : "#FFFDF5",
                                  color: req.packageType === "platinum" ? "#166534" : "#92400E",
                                  border: req.packageType === "platinum" ? "1px solid #BBF7D0" : "1px solid #FDE68A"
                                }}
                              >
                                {pkgName} Retainer Package • PKR {Number(feeAmount).toLocaleString()}
                              </span>
                              <span style={{ fontSize: "12px", color: "#64748B" }}>
                                {new Date(req.createdAt).toLocaleDateString()}
                              </span>
                            </div>
                            <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 6px 0" }}>
                              {req.title || req.caseDetails?.title || `Legal Representation Request (${pkgName})`}
                            </h3>
                          </div>

                          <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                            {!isAccepted ? (
                              <>
                                <button
                                  onClick={() => handleAcceptRequest(req._id)}
                                  className="btn-legal-primary"
                                  style={{ padding: "7px 16px", fontSize: "13px" }}
                                >
                                  <Check size={15} strokeWidth={2} />
                                  <span>Accept Inquiry</span>
                                </button>
                                <button
                                  onClick={() => setRejectModal({ id: req._id, name: req.userId?.name })}
                                  style={{
                                    backgroundColor: "#FFFFFF",
                                    border: "1px solid #FECACA",
                                    color: "#DC2626",
                                    padding: "7px 14px",
                                    borderRadius: "8px",
                                    fontSize: "13px",
                                    fontWeight: "500",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px"
                                  }}
                                >
                                  <X size={15} strokeWidth={2} />
                                  <span>Decline</span>
                                </button>
                              </>
                            ) : (
                              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                <span 
                                  style={{
                                    padding: "6px 14px",
                                    borderRadius: "8px",
                                    backgroundColor: "#EFF6FF",
                                    color: "#1E40AF",
                                    border: "1px solid #BFDBFE",
                                    fontSize: "13px",
                                    fontWeight: 600,
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px"
                                  }}
                                >
                                  <Clock size={15} />
                                  <span>Client Notified to Pay</span>
                                </span>
                                <button
                                  onClick={() => setRejectModal({ id: req._id, name: req.userId?.name })}
                                  style={{
                                    backgroundColor: "#FFFFFF",
                                    border: "1px solid #E2E8F0",
                                    color: "#64748B",
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    fontSize: "12.5px",
                                    cursor: "pointer"
                                  }}
                                >
                                  Decline
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Case Facts Brief */}
                        <div style={{ marginBottom: "16px" }}>
                          <div style={{ fontSize: "12px", fontWeight: "700", color: "#64748B", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "4px" }}>
                            Matter Brief & Facts:
                          </div>
                          <p style={{ fontSize: "14px", color: "#334155", lineHeight: 1.6, margin: 0, backgroundColor: "#F8FAFC", padding: "12px 14px", borderRadius: "8px", border: "1px solid #F1F5F9" }}>
                            {req.description || req.caseDetails?.description || req.message || "No detailed case brief provided by client."}
                          </p>
                        </div>

                        {/* Client Particulars */}
                        <div
                          style={{
                            backgroundColor: "#FFFFFF",
                            border: "1px solid #E2E8F0",
                            borderRadius: "8px",
                            padding: "12px 16px",
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "18px",
                            fontSize: "13px",
                            color: "#475569"
                          }}
                        >
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <User size={15} color="#64748B" />
                            <span>Client: <strong>{req.userId?.name || "Confidential Citizen"}</strong></span>
                          </div>
                          {req.userId?.phone && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Phone size={15} color="#64748B" />
                              <span>{req.userId.phone}</span>
                            </div>
                          )}
                          {req.userId?.email && (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <Mail size={15} color="#64748B" />
                              <span>{req.userId.email}</span>
                            </div>
                          )}
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Tag size={15} color="#64748B" />
                            <span>Domain: <strong>{req.category || req.caseDetails?.category || "General Legal Consultation"}</strong></span>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 3: AVAILABLE CASES POOL ── */}
          {activeTab === "available" && (
            <div>
              {availableCases.length === 0 ? (
                <div className="legal-card text-center" style={{ padding: "64px 24px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      backgroundColor: "#F1F5F9",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 18px auto"
                    }}
                  >
                    <FolderOpen size={28} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: "700", color: "#0F172A", marginBottom: "8px" }}>
                    No open cases in community pool
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748B", maxWidth: "460px", margin: "0 auto", lineHeight: "1.5" }}>
                    All pro bono and public inquiries in your jurisdiction are currently assigned. Check back later for newly submitted briefs.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {availableCases.map((c) => (
                    <div key={c._id} className="legal-card" style={{ padding: "24px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "12px", marginBottom: "12px" }}>
                        <div>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                            <span className="badge-semantic badge-info">Community Pool</span>
                            <span style={{ fontSize: "12px", fontFamily: "monospace", color: "#64748B" }}>
                              REF #{c._id.slice(-6).toUpperCase()}
                            </span>
                          </div>
                          <h3 style={{ fontSize: "18px", fontWeight: "700", color: "#0F172A", margin: "0 0 6px 0" }}>
                            {c.title}
                          </h3>
                        </div>

                        <button
                          onClick={() => handleAcceptCase(c._id)}
                          className="btn-legal-primary"
                          style={{ padding: "8px 18px", fontSize: "13.5px" }}
                        >
                          <PlusCircle size={16} />
                          <span>Accept & Assign Case</span>
                        </button>
                      </div>

                      <p style={{ fontSize: "14px", color: "#475569", lineHeight: 1.5, margin: "0 0 16px 0" }}>
                        {c.description}
                      </p>

                      <div
                        style={{
                          backgroundColor: "#F8FAFC",
                          border: "1px solid #E2E8F0",
                          borderRadius: "8px",
                          padding: "12px 16px",
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "18px",
                          fontSize: "13px",
                          color: "#475569"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <Tag size={15} color="#64748B" />
                          <span>Domain: <strong>{c.category}</strong></span>
                        </div>
                        {c.priority && (
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <span>Urgency: <strong>{c.priority}</strong></span>
                          </div>
                        )}
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <User size={15} color="#64748B" />
                          <span>Applicant: <strong>{c.userId?.name || "Anonymous Citizen"}</strong></span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ── TAB 4: PANEL INVITATIONS ── */}
          {activeTab === "invitations" && (
            <div>
              {panelInvitations.length === 0 ? (
                <div className="legal-card text-center" style={{ padding: "64px 24px" }}>
                  <div
                    style={{
                      width: "64px",
                      height: "64px",
                      borderRadius: "50%",
                      backgroundColor: "#F1F5F9",
                      color: "#94A3B8",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      margin: "0 auto 18px auto"
                    }}
                  >
                    <Building2 size={28} strokeWidth={1.5} />
                  </div>
                  <h3 style={{ fontFamily: "var(--font-serif)", fontSize: "20px", fontWeight: "700", color: "#0F172A", marginBottom: "8px" }}>
                    No Panel Invitations Yet
                  </h3>
                  <p style={{ fontSize: "14px", color: "#64748B", maxWidth: "460px", margin: "0 auto", lineHeight: "1.5" }}>
                    When accredited NGOs and Legal Aid Foundations invite you to join their Pro Bono representation roster, their invitations will appear here for your review and consent.
                  </p>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {panelInvitations.map((inv) => {
                    const isPending = inv.status === "pending_lawyer_approval";
                    const ngo = inv.ngoId || {};
                    const roleLabel = (inv.role || "staff_advocate").replace("_", " ").toUpperCase();

                    return (
                      <div key={inv._id} className="legal-card" style={{ padding: "24px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "14px", marginBottom: "14px" }}>
                          <div>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px", flexWrap: "wrap" }}>
                              {isPending ? (
                                <span className="badge-semantic badge-warning">Action Required • Pending Consent</span>
                              ) : inv.status === "active" ? (
                                <span className="badge-semantic badge-success">Enrolled on Active Panel</span>
                              ) : inv.status === "declined" ? (
                                <span className="badge-semantic badge-danger">Declined</span>
                              ) : (
                                <span className="badge-semantic badge-neutral">Inactive</span>
                              )}

                              <span
                                style={{
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  padding: "3px 10px",
                                  borderRadius: "6px",
                                  backgroundColor: "#ECFDF5",
                                  color: "#065F46",
                                  border: "1px solid #A7F3D0"
                                }}
                              >
                                {inv.designation || "Staff Advocate"} • {roleLabel}
                              </span>

                              <span style={{ fontSize: "12px", color: "#64748B" }}>
                                Invited {new Date(inv.invitedAt).toLocaleDateString()}
                              </span>
                            </div>

                            <h3 style={{ fontSize: "19px", fontWeight: "700", color: "#0F172A", margin: "0 0 4px 0", display: "flex", alignItems: "center", gap: 8 }}>
                              <Building2 size={20} color="#0A3622" />
                              <span>{ngo.name || "Legal Aid Organization"}</span>
                            </h3>

                            <div style={{ fontSize: "13px", color: "#64748B" }}>
                              Registration: <strong>{ngo.registrationNumber || "Accredited NGO"}</strong> • Jurisdiction: <strong>{ngo.city || "Pakistan"}</strong>
                            </div>
                          </div>

                          {/* Action Buttons */}
                          <div>
                            {isPending ? (
                              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                                <button
                                  onClick={() => handleRespondPanelInvitation(inv._id, "accept")}
                                  className="btn-legal-primary"
                                  style={{ padding: "7px 16px", fontSize: "13px" }}
                                >
                                  <Check size={15} strokeWidth={2} />
                                  <span>Accept Invitation</span>
                                </button>
                                <button
                                  onClick={() => handleRespondPanelInvitation(inv._id, "decline")}
                                  style={{
                                    backgroundColor: "#FFFFFF",
                                    border: "1px solid #FECACA",
                                    color: "#DC2626",
                                    padding: "7px 14px",
                                    borderRadius: "8px",
                                    fontSize: "13px",
                                    fontWeight: "500",
                                    cursor: "pointer",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "6px"
                                  }}
                                >
                                  <X size={15} strokeWidth={2} />
                                  <span>Decline</span>
                                </button>
                              </div>
                            ) : (
                              <span style={{ fontSize: "13px", color: "#64748B", fontStyle: "italic" }}>
                                Responded on {inv.respondedAt ? new Date(inv.respondedAt).toLocaleDateString() : "Record"}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Focus Areas */}
                        {ngo.focusAreas && (
                          <div style={{ backgroundColor: "#F8FAFC", border: "1px solid #E2E8F0", borderRadius: "8px", padding: "12px 16px", fontSize: "13px", color: "#475569" }}>
                            <div style={{ fontWeight: 600, color: "#1e293b", marginBottom: 4 }}>
                              Organization Focus &amp; Pro Bono Mission:
                            </div>
                            <div>
                              {Array.isArray(ngo.focusAreas) ? ngo.focusAreas.join(", ") : ngo.focusAreas}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

            </div>
          </section>
        </div>
          </>
        ) : (
          <>
        {/* ── Welcome banner ── */}
        <section className="cp-hero ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              {isVerified ? (
                <span className="cp-chip">
                  <CheckCircle2 size={13} strokeWidth={2.2} /> Bar Council verified
                </span>
              ) : (
                <span className="cp-chip is-pending">
                  <AlertTriangle size={13} strokeWidth={2.2} /> Accreditation {user?.verificationStatus || "under review"}
                </span>
              )}

              <h1 className="cp-hero-title">
                {greeting}, <span>Adv. {displayName}</span>
              </h1>

              <p className="cp-hero-text">
                {isVerified ? (
                  <>
                    You have <strong>{activeCasesCount} active {activeCasesCount === 1 ? "case" : "cases"}</strong>
                    {pendingRequests.length > 0 && (
                      <>, <strong>{pendingRequests.length} client {pendingRequests.length === 1 ? "inquiry" : "inquiries"}</strong> waiting for a reply</>
                    )}
                    {nextHearing
                      ? <> and your next hearing {daysUntilNext === 0 ? "today" : daysUntilNext === 1 ? "tomorrow" : `in ${daysUntilNext} days`}.</>
                      : <>.</>}
                  </>
                ) : (
                  <>Your profile is being reviewed by the LegalLink committee. You can accept client and pro bono work once your Bar Council credentials are verified.</>
                )}
              </p>

              <div className="cp-hero-actions">
                {pendingRequests.length > 0 ? (
                  <button type="button" className="cp-btn-gold" onClick={() => openTab("requests")}>
                    Review {pendingRequests.length} {pendingRequests.length === 1 ? "inquiry" : "inquiries"} <ArrowRight size={16} strokeWidth={2.2} />
                  </button>
                ) : (
                  <button type="button" className="cp-btn-gold" onClick={() => navigate("/lawyer/cases")}>
                    Open my cases <ArrowRight size={16} strokeWidth={2.2} />
                  </button>
                )}
                <button type="button" className="cp-btn-ghost" onClick={() => openTab("available")}>
                  Browse open cases
                </button>
              </div>
            </div>

            <div className="cp-hero-card">
              <div className="cp-hero-card-head">
                <span className="cp-eyebrow">Next hearing</span>
                {nextHearing && (
                  <span className="cp-tag-gold">
                    {daysUntilNext === 0 ? "Today" : daysUntilNext === 1 ? "Tomorrow" : `In ${daysUntilNext} days`}
                  </span>
                )}
              </div>

              {nextHearing ? (
                <div className="cp-hearing">
                  <span className="cp-date-tile">
                    <span className="cp-date-tile-month">
                      {new Date(nextHearing.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                    </span>
                    <span className="cp-date-tile-day">{new Date(nextHearing.date).getDate()}</span>
                  </span>
                  <span className="cp-hearing-text">
                    <span className="cp-hearing-title">{nextHearing.caseTitle}</span>
                    <span className="cp-hearing-sub">
                      {nextHearing.notes || "Scheduled hearing"}{nextHearing.clientName ? ` · ${nextHearing.clientName}` : ""}
                    </span>
                  </span>
                </div>
              ) : (
                <div className="cp-hearing">
                  <span className="cp-hearing-text">
                    <span className="cp-hearing-title">No hearings scheduled</span>
                    <span className="cp-hearing-sub">Add hearing dates from a case to see them here.</span>
                  </span>
                </div>
              )}

              <div className="cp-divider" />

              <div className="cp-availability">
                <div>
                  <strong>{acceptingClients ? "Accepting new clients" : "New intakes paused"}</strong>
                  <span>{acceptingClients ? "Citizens can send you inquiries" : "Turn on to receive new inquiries"}</span>
                </div>
                <button
                  type="button"
                  role="switch"
                  aria-checked={acceptingClients}
                  aria-label="Accepting new clients"
                  className={`cp-switch${acceptingClients ? " is-on" : ""}`}
                  onClick={toggleAcceptingClients}
                />
              </div>
            </div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Stat cards ── */}
          <section className="cp-stats" aria-label="Summary">
            <button type="button" className="cp-stat" onClick={() => navigate("/lawyer/cases?filter=active")} title="Open active cases">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Briefcase size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Active cases</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{activeCasesCount}</span>
                <span className="cp-stat-note">{proBonoCount > 0 ? `${proBonoCount} pro bono` : "In progress"}</span>
              </div>
            </button>

            <button type="button" className="cp-stat" onClick={() => openTab("requests")} title="Open client inquiries">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><MessageSquare size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Client inquiries</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{pendingRequests.length}</span>
                <span className={`cp-stat-note${pendingRequests.length > 0 ? " is-warn" : ""}`}>
                  {pendingRequests.length > 0 ? "Awaiting reply" : "All answered"}
                </span>
              </div>
            </button>

            <button type="button" className="cp-stat" onClick={() => navigate("/lawyer/cases?filter=active&sort=hearing")} title="Cases sorted by next hearing">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Calendar size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Upcoming hearings</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{totalUpcomingHearings}</span>
                <span className="cp-stat-note">
                  {nextHearing ? `Next on ${new Date(nextHearing.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}` : "None scheduled"}
                </span>
              </div>
            </button>

            <button type="button" className="cp-stat" onClick={() => navigate("/lawyer/cases?filter=resolved")} title="Open resolved cases">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><CheckCircle2 size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Resolved cases</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{resolvedCasesCount}</span>
                <span className={`cp-stat-note${rating > 0 ? " is-ok" : ""}`}>
                  {rating > 0 ? `Rated ${rating.toFixed(1)}` : "All time"}
                </span>
              </div>
            </button>
          </section>

          <div className="cp-layout">
            <div className="cp-home-main cp-home-grid">
              <TodayPriorities
                cases={cases}
                pendingRequests={pendingRequests}
                pendingInvites={pendingInvites}
                onOpenTab={openTab}
                limit={5}
              />

              {/* ── Recent cases (short list; full list lives on My Cases) ── */}
              <section className="cp-card rc-card" aria-label="Recent cases">
                <div className="tp-head">
                  <div>
                    <h2 className="cp-section-title">Recent cases</h2>
                    <span className="cp-section-sub">Latest active matters</span>
                  </div>
                  <button type="button" className="cp-link" onClick={() => navigate("/lawyer/cases")}>
                    All cases <ArrowRight size={15} strokeWidth={2.2} />
                  </button>
                </div>
                {recentCases.length === 0 ? (
                  <div className="tp-clear">
                    <Briefcase size={18} />
                    <span>No active cases yet. Accept a client inquiry or an open case to get started.</span>
                  </div>
                ) : (
                  <ul className="rc-list">
                    {recentCases.map((c) => {
                      const stage = getStage(c);
                      const next = getNextHearing(c, startOfToday);
                      return (
                        <li key={c._id} className="rc-row">
                          <button type="button" className="rc-open" onClick={() => navigate(`/case/${c._id}`)}>
                            <span className="rc-main">
                              <strong>
                                {c.title}
                                {getUnread(c, user).total > 0 && <span className="rc-new">{getUnread(c, user).total} new</span>}
                              </strong>
                              <span>{c.userId?.name || "Client"} · {c.category || "General"}</span>
                            </span>
                            <span className="rc-stage">
                              <span className="cp-stage-bars">
                                {[1, 2, 3, 4].map((n) => (
                                  <span key={n} className={`cp-stage-bar${n <= stage.step ? " is-on" : ""}`} />
                                ))}
                              </span>
                              <span>
                                {stage.label}
                                {next ? ` · Hearing ${new Date(next.date).toLocaleDateString("en-PK", { day: "numeric", month: "short" })}` : ""}
                              </span>
                            </span>
                            <span className="rc-hearing">
                              {next ? `Hearing ${formatDate(next.date)}` : "No hearing yet"}
                            </span>
                            <ArrowRight size={16} className="rc-chev" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </section>
            </div>

          </div>
        </div>
          </>
        )}
      </div>

      {/* ── MODAL: REJECT INQUIRY ── */}
      {rejectModal && (
        <div
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(15, 23, 42, 0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: "16px"
          }}
          onClick={() => setRejectModal(null)}
        >
          <div
            style={{
              backgroundColor: "#FFFFFF",
              borderRadius: "14px",
              padding: "26px",
              width: "100%",
              maxWidth: "460px",
              boxShadow: "0 20px 25px -5px rgba(0,0,0,0.15)",
              border: "1px solid #E2E8F0"
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h3 style={{ margin: "0 0 8px 0", fontSize: "18px", fontWeight: "700", color: "#991B1B" }}>
              Decline Representation Request
            </h3>
            <p style={{ fontSize: "14px", color: "#64748B", margin: "0 0 16px 0" }}>
              Provide a professional reason to {rejectModal.name || "the applicant"} (e.g. conflict of interest, full bench capacity, or jurisdiction).
            </p>

            <textarea
              className="legal-input"
              rows={3}
              style={{ height: "auto", minHeight: "80px", marginBottom: "20px" }}
              placeholder="Reason for declining request..."
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
            />

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
              <button className="btn-legal-secondary" onClick={() => setRejectModal(null)}>
                Cancel
              </button>
              <button
                className="btn-legal-primary"
                style={{ backgroundColor: "#DC2626" }}
                onClick={handleRejectRequest}
              >
                Confirm Decline
              </button>
            </div>
          </div>
        </div>
      )}

      <Footer showCta={false} />
    </>
  );
};

export default LawyerDashboard;
