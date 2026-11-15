import React, { useState, useEffect } from "react";
import { isActiveCase, getHearings, isLiveHearing } from "../../utils/caseStage";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";
import { useRealTime } from "../../contexts/RealTimeContext";
import { userAPI, reviewAPI, requestAPI } from "../../services/api";
import Navbar from "../../components/Navbar";
import AnnouncementBanner from "../../components/ui/AnnouncementBanner";
import Footer from "../../components/Footer";
import CitizenInsights from "../../components/dashboard/CitizenInsights";
import "../../styles/counselPortal.css";
import PaymentCheckout from "../../components/PaymentCheckout";
import { DashboardSkeleton } from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";
import {
  Briefcase,
  Clock,
  CheckCircle2,
  Calendar,
  Scale,
  Building2,
  ChevronRight,
  PlusCircle,
  Search,
  Filter,
  X,
  AlertCircle,
  ArrowRight,
  Check,
  Star,
  Edit3
} from "lucide-react";

const UserDashboard = () => {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Dashboard Data State
  const [stats, setStats] = useState({
    totalCases: 0,
    activeCases: 0,
    resolvedCases: 0,
    ngoCasesCount: 0,
    lawyerCasesCount: 0,
    upcomingHearingsCount: 0
  });
  const [cases, setCases] = useState([]);
  const [inquiries, setInquiries] = useState([]);
  const [payingInquiry, setPayingInquiry] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [loading, setLoading] = useState(true);

  // Filter & Search State
  const [activeTab, setActiveTab] = useState("all"); // 'all' | 'lawyer' | 'ngo'
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Review & Rating Modal State (FR_18 & 48-Hour Window)
  const [reviewedCaseMap, setReviewedCaseMap] = useState({});
  const [reviewModalCase, setReviewModalCase] = useState(null);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewHoverRating, setReviewHoverRating] = useState(0);
  const [reviewComment, setReviewComment] = useState("");
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [isEditingReview, setIsEditingReview] = useState(false);
  const [editingReviewId, setEditingReviewId] = useState(null);

  // New Case Submission Modal State
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [creatingCase, setCreatingCase] = useState(false);
  const [createError, setCreateError] = useState("");
  const [createForm, setCreateForm] = useState({
    title: "",
    category: "Civil Litigation",
    priority: "medium",
    representationType: "lawyer", // 'lawyer' | 'ngo'
    description: "",
    documentName: "",
    documentUrl: ""
  });

  // Toast State
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const { socket } = useRealTime();

  const triggerToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4500);
  };

  // Real-time Socket.io listener for incoming case messages in citizen dashboard
  useEffect(() => {
    if (!socket) return;

    const handleCaseMessage = (data) => {
      setCases((prevCases) =>
        prevCases.map((c) => {
          if (c._id === data?.caseId) {
            const exists = c.messages?.some(
              (m) =>
                (m._id && data.message?._id && m._id === data.message._id) ||
                (m.senderId === data.message?.senderId &&
                  m.message === data.message?.message &&
                  Math.abs(new Date(m.timestamp) - new Date(data.message?.timestamp)) < 2000)
            );
            if (exists) return c;
            return {
              ...c,
              messages: [...(c.messages || []), data.message]
            };
          }
          return c;
        })
      );
    };

    socket.on("case-message", handleCaseMessage);

    return () => {
      socket.off("case-message", handleCaseMessage);
    };
  }, [socket]);

  useEffect(() => {
    fetchDashboardData();
  }, []);

  // Handle Proactive Review Prompt via URL query params (?action=review&caseId=...)
  useEffect(() => {
    if (cases.length > 0) {
      const searchParams = new URLSearchParams(window.location.search);
      const action = searchParams.get("action");
      const targetCaseId = searchParams.get("caseId");
      if (action === "review" && targetCaseId) {
        const foundCase = cases.find((c) => String(c._id) === String(targetCaseId));
        if (foundCase && ["resolved", "closed"].includes(foundCase.status)) {
          const existing = reviewedCaseMap[foundCase._id];
          if (!existing) {
            handleOpenReviewModal(foundCase, false);
          } else {
            const diffHours = (Date.now() - new Date(existing.createdAt).getTime()) / (1000 * 60 * 60);
            if (diffHours <= 48) {
              handleOpenReviewModal(foundCase, true);
            }
          }
        }
      }
    }
  }, [cases, reviewedCaseMap]);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, casesRes, reviewsRes, inquiriesRes] = await Promise.all([
        userAPI.getStats().catch(() => ({ data: {} })),
        userAPI.getCases().catch(() => ({ data: { cases: [] } })),
        reviewAPI.getMyReviews().catch(() => ({ data: { reviews: [] } })),
        requestAPI.getMyRequests().catch(() => ({ data: { requests: [] } }))
      ]);

      const casesList = casesRes.data?.cases || [];
      const statsData = statsRes.data || {};
      const reviewsList = reviewsRes.data?.reviews || [];
      const inquiriesList = inquiriesRes.data?.requests || [];

      setInquiries(inquiriesList);

      // Coming back from a cancelled card payment: reopen the checkout
      const payId = new URLSearchParams(window.location.search).get("pay");
      if (payId) {
        const toPay = inquiriesList.find((i) => i._id === payId && i.status === "accepted_awaiting_payment");
        if (toPay) {
          setPayingInquiry(toPay);
          setShowPaymentModal(true);
        }
        window.history.replaceState(null, "", window.location.pathname);
      }

      // Map existing reviews by caseId for quick lookup
      const revMap = {};
      reviewsList.forEach((r) => {
        const cId = r.caseId?._id || r.caseId;
        if (cId) revMap[cId] = r;
      });
      setReviewedCaseMap(revMap);

      // If backend stats didn't return some computed counts, compute them locally as fallback
      const totalCases = statsData.totalCases ?? casesList.length;
      // Counted from the case list with the shared rule, so every number on the page agrees
      const activeCases = casesList.filter(isActiveCase).length;
      const resolvedCases = casesList.filter((c) => ["resolved", "closed"].includes(c.status)).length;
      const ngoCasesCount =
        statsData.ngoCasesCount ??
        casesList.filter((c) => Boolean(c.ngoId) || c.caseType === "pro_bono").length;
      const lawyerCasesCount =
        statsData.lawyerCasesCount ??
        casesList.filter((c) => Boolean(c.lawyerId) && c.caseType !== "pro_bono").length;

      // Calculate upcoming court hearings
      const now = new Date();
      const upcomingHearingsCount = casesList
        .filter(isActiveCase)
        .reduce((n, c) => n + getHearings(c).filter((h) => isLiveHearing(h) && new Date(h.date) >= now).length, 0);

      setStats({
        totalCases,
        activeCases,
        resolvedCases,
        ngoCasesCount,
        lawyerCasesCount,
        upcomingHearingsCount
      });
      setCases(casesList);
    } catch (error) {
      console.error("Error fetching user dashboard data:", error);
      triggerToast("Unable to load legal matters. Please refresh.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentSuccess = async (paymentData) => {
    if (!payingInquiry) return;
    try {
      const res = await requestAPI.completePayment(payingInquiry._id, {
        transactionId: paymentData.transactionId,
        paymentMethod: paymentData.paymentMethod || "demo"
      });

      if (res.data?.success && res.data?.caseId) {
        setShowPaymentModal(false);
        const newCaseId = res.data.caseId;
        setPayingInquiry(null);
        triggerToast("Payment verified! Opening your private case docket...", "success");
        setTimeout(() => {
          navigate(`/case/${newCaseId}`);
        }, 500);
      }
    } catch (err) {
      console.error("Error completing retainer payment:", err);
      triggerToast(err.response?.data?.message || "Failed to complete payment and activate case docket", "error");
    }
  };

  // Review Modal Handlers (FR_18 & 48-Hour Edit Window)
  const handleOpenReviewModal = (caseItem, isEdit = false) => {
    setReviewModalCase(caseItem);
    const existing = reviewedCaseMap[caseItem._id];
    if (existing && isEdit) {
      const createdTime = new Date(existing.createdAt).getTime();
      const diffHours = (Date.now() - createdTime) / (1000 * 60 * 60);
      if (diffHours > 48) {
        triggerToast("The 48-hour editing window for this review has expired.", "error");
        setReviewModalCase(null);
        return;
      }
      setIsEditingReview(true);
      setEditingReviewId(existing._id);
      setReviewRating(existing.rating || 5);
      setReviewComment(existing.comment || "");
    } else {
      setIsEditingReview(false);
      setEditingReviewId(null);
      setReviewRating(existing ? existing.rating : 5);
      setReviewComment(existing ? existing.comment : "");
    }
    setReviewHoverRating(0);
    setReviewError("");
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!reviewModalCase) return;
    if (!reviewComment.trim()) {
      setReviewError("Please provide written feedback describing your experience.");
      return;
    }

    setSubmittingReview(true);
    setReviewError("");

    try {
      if (isEditingReview && editingReviewId) {
        const res = await reviewAPI.editReview(editingReviewId, {
          rating: reviewRating,
          comment: reviewComment.trim()
        });
        const updatedReview = res.data?.review;
        if (updatedReview) {
          setReviewedCaseMap((prev) => ({
            ...prev,
            [reviewModalCase._id]: updatedReview
          }));
        }
        setReviewModalCase(null);
        setIsEditingReview(false);
        setEditingReviewId(null);
        triggerToast("Review updated successfully within your 48-hour editing window.", "success");
      } else {
        const targetType = reviewModalCase.caseType === "pro_bono" || reviewModalCase.ngoId ? "ngo" : "lawyer";
        const lawyerId = reviewModalCase.lawyerId?._id || reviewModalCase.lawyerId || null;
        const ngoId = reviewModalCase.ngoId?._id || reviewModalCase.ngoId || null;

        const payload = {
          caseId: reviewModalCase._id,
          targetType,
          lawyerId: targetType === "lawyer" ? lawyerId : null,
          ngoId: targetType === "ngo" ? ngoId : null,
          rating: reviewRating,
          comment: reviewComment.trim()
        };

        const res = await reviewAPI.createReview(payload);
        const newReview = res.data?.review;
        if (newReview) {
          setReviewedCaseMap((prev) => ({
            ...prev,
            [reviewModalCase._id]: newReview
          }));
        }

        setReviewModalCase(null);
        triggerToast("Thank you! Your verified rating & review has been published.", "success");
      }
    } catch (err) {
      console.error("Error submitting/updating review:", err);
      setReviewError(err.response?.data?.message || "Failed to submit review. Please try again.");
    } finally {
      setSubmittingReview(false);
    }
  };

  // Submit new legal case
  const handleCreateCase = async (e) => {
    e.preventDefault();
    if (!createForm.title.trim() || !createForm.description.trim()) {
      setCreateError("Please enter a comprehensive case title and factual description.");
      return;
    }

    setCreatingCase(true);
    setCreateError("");

    try {
      const payload = {
        title: createForm.title.trim(),
        category: createForm.category,
        priority: createForm.priority,
        description: createForm.description.trim(),
        caseType: createForm.representationType === "ngo" ? "pro_bono" : "paid",
        documents: createForm.documentName
          ? [
              {
                name: createForm.documentName.trim(),
                url: createForm.documentUrl.trim() || "#"
              }
            ]
          : []
      };

      await userAPI.createCase(payload);
      setShowCreateModal(false);
      setCreateForm({
        title: "",
        category: "Civil Litigation",
        priority: "medium",
        representationType: "lawyer",
        description: "",
        documentName: "",
        documentUrl: ""
      });
      triggerToast("Legal case submitted successfully. Counsel assignment is in progress.", "success");
      await fetchDashboardData();
    } catch (err) {
      console.error("Error creating legal case:", err);
      setCreateError(err.response?.data?.message || "Failed to submit case. Please check your information.");
    } finally {
      setCreatingCase(false);
    }
  };

  // Filter cases based on Pill Tabs, Status Dropdown, and Search Input
  const filteredCases = cases.filter((item) => {
    // 1. Tab Filter
    const isProBono = Boolean(item.ngoId) || item.caseType === "pro_bono";
    const isPrivate = Boolean(item.lawyerId) && item.caseType !== "pro_bono";

    if (activeTab === "lawyer" && !isPrivate) return false;
    if (activeTab === "ngo" && !isProBono) return false;

    // 2. Status Filter
    if (statusFilter !== "all") {
      if (statusFilter === "in_progress") {
        if (!["in_progress", "assigned"].includes(item.status)) return false;
      } else if (item.status !== statusFilter) {
        return false;
      }
    }

    // 3. Search Query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const matchTitle = item.title?.toLowerCase().includes(q);
      const matchDesc = item.description?.toLowerCase().includes(q);
      const matchCat = item.category?.toLowerCase().includes(q);
      const matchLawyer = item.lawyerId?.name?.toLowerCase().includes(q);
      const matchNGO = item.ngoId?.name?.toLowerCase().includes(q);
      if (!matchTitle && !matchDesc && !matchCat && !matchLawyer && !matchNGO) {
        return false;
      }
    }

    return true;
  });

  // Helpers for Next Hearing
  const getHearingInfo = (caseItem) => {
    if (!caseItem.hearingDates || caseItem.hearingDates.length === 0) return null;
    const now = new Date();
    const upcoming = caseItem.hearingDates
      .filter((h) => new Date(h.date) >= now && h.status !== "cancelled")
      .sort((a, b) => new Date(a.date) - new Date(b.date));

    if (upcoming.length > 0) {
      return {
        date: new Date(upcoming[0].date).toLocaleDateString("en-US", {
          month: "short",
          day: "numeric",
          year: "numeric"
        }),
        isUpcoming: true,
        notes: upcoming[0].notes
      };
    }

    const past = [...caseItem.hearingDates].sort((a, b) => new Date(b.date) - new Date(a.date));
    return {
      date: new Date(past[0].date).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric"
      }),
      isUpcoming: false,
      notes: past[0].notes
    };
  };

  // Status Badge Styling
  const renderStatusBadge = (status) => {
    const map = {
      pending: {
        bg: "#FFFBEB",
        text: "#92400E",
        border: "#FDE68A",
        label: "Pending Review",
        icon: Clock
      },
      under_review: {
        bg: "#EFF6FF",
        text: "#1E40AF",
        border: "#BFDBFE",
        label: "Under Review",
        icon: Search
      },
      assigned: {
        bg: "#EEF2FF",
        text: "#3730A3",
        border: "#C7D2FE",
        label: "Assigned",
        icon: CheckCircle2
      },
      in_progress: {
        bg: "#ECFDF5",
        text: "#065F46",
        border: "#A7F3D0",
        label: "In Progress",
        icon: Scale
      },
      resolved: {
        bg: "#F0FDF4",
        text: "#15803D",
        border: "#BBF7D0",
        label: "Resolved",
        icon: Check
      },
      rejected: {
        bg: "#FEF2F2",
        text: "#991B1B",
        border: "#FECACA",
        label: "Rejected",
        icon: AlertCircle
      }
    };

    const cfg = map[status] || {
      bg: "#F8FAFC",
      text: "#475569",
      border: "#E2E8F0",
      label: status || "Open",
      icon: Clock
    };

    const Icon = cfg.icon;
    const tone = { pending: "is-warn", under_review: "is-info", assigned: "is-info", in_progress: "is-ok", resolved: "is-ok", rejected: "is-danger" }[status] || "is-neutral";

    return (
      <span className={`cp-pill ${tone}`}>
        <Icon size={12} strokeWidth={2.5} />
        {cfg.label}
      </span>
    );
  };

  // Priority Badge Styling
  const renderPriorityBadge = (priority) => {
    const map = {
      urgent: { tone: "is-danger", label: "Urgent" },
      high: { tone: "is-warn", label: "High priority" },
      medium: { tone: "is-neutral", label: "Medium priority" },
      low: { tone: "is-neutral", label: "Low priority" }
    };
    const cfg = map[priority?.toLowerCase()] || map.medium;
    return <span className={`cp-pill ${cfg.tone}`}>{cfg.label}</span>;
  };

  const firstName = (user?.name || "Citizen").split(" ")[0];
  // Only inquiries that still need the citizen's attention are listed
  const visibleInquiries = (inquiries || []).filter((i) => ["accepted_awaiting_payment", "pending", "rejected"].includes(i.status));
  const citizenNextHearing = (() => {
    const now = new Date();
    let best = null;
    (cases || []).filter(isActiveCase).forEach((c) => {
      getHearings(c).forEach((h) => {
        const d = new Date(h.date);
        if (!isNaN(d) && isLiveHearing(h) && d >= now && (!best || d < best.date)) {
          best = { date: d, title: c.title, court: h.court || h.location || "", caseId: c._id };
        }
      });
    });
    return best;
  })();
  const citizenDaysUntil = citizenNextHearing
    ? Math.round((new Date(citizenNextHearing.date.toDateString()) - new Date(new Date().toDateString())) / 86400000)
    : null;

  if (loading) {
    return (
      <div className="ll-user-page" style={{ minHeight: "100vh" }}>
        <Navbar />
        <div style={{ padding: "0 28px" }}>
          <DashboardSkeleton cards={4} cols={6} rows={6} />
        </div>
      </div>
    );
  }

  return (
    <div className="ll-user-page cp-page citizen-portal page-fade" style={{ minHeight: "100vh" }}>
      <Navbar />
      <AnnouncementBanner audience="user" />

      {/* Floating Notification Toast */}
      {toast.show && (
        <div
          style={{
            position: "fixed",
            bottom: "28px",
            right: "28px",
            zIndex: 9999,
            display: "flex",
            alignItems: "center",
            gap: "10px",
            backgroundColor: toast.type === "error" ? "#7F1D1D" : "#1E3F2E",
            color: "#FFFFFF",
            padding: "14px 22px",
            borderRadius: "10px",
            boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.25)",
            fontSize: "14px",
            fontWeight: 500,
            animation: "slideIn 0.3s ease"
          }}
        >
          {toast.type === "error" ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* ── Welcome banner ── */}
      <section className="cp-hero ll-on-dark citizen-hero">
        <div className="cp-hero-inner">
          <div className="cp-hero-main">
            <span className="cp-chip"><Scale size={13} strokeWidth={2.2} /> Citizen portal</span>
            <h1 className="cp-hero-title">Welcome back, <span>{firstName}</span></h1>
            <p className="cp-hero-text">
              {stats.activeCases > 0
                ? <>You have <strong>{stats.activeCases} active {stats.activeCases === 1 ? "matter" : "matters"}</strong>{stats.upcomingHearingsCount > 0 ? <> and <strong>{stats.upcomingHearingsCount} upcoming {stats.upcomingHearingsCount === 1 ? "hearing" : "hearings"}</strong></> : null}. Follow every stage, hearing and document here.</>
                : "Submit a legal matter, hire a verified advocate or request free legal aid from an accredited NGO."}
            </p>
            <div className="cp-hero-actions">
              <button type="button" className="cp-btn-gold" onClick={() => setShowCreateModal(true)}>
                <PlusCircle size={17} strokeWidth={2.2} /> Submit a new case
              </button>
              <Link to="/lawyers" className="cp-btn-ghost"><Briefcase size={16} /> Find an advocate</Link>
              <Link to="/ngos" className="cp-btn-ghost"><Building2 size={16} /> Free legal aid</Link>
            </div>
          </div>

          <div className="cp-hero-card">
            <div className="cp-hero-card-head">
              <span className="cp-eyebrow">Next hearing</span>
              {citizenNextHearing && (
                <span className="cp-tag-gold">
                  {citizenDaysUntil === 0 ? "Today" : citizenDaysUntil === 1 ? "Tomorrow" : `In ${citizenDaysUntil} days`}
                </span>
              )}
            </div>
            {citizenNextHearing ? (
              <div className="cp-hearing">
                <span className="cp-date-tile">
                  <span className="cp-date-tile-month">{citizenNextHearing.date.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                  <span className="cp-date-tile-day">{citizenNextHearing.date.getDate()}</span>
                </span>
                <span className="cp-hearing-text">
                  <span className="cp-hearing-title">{citizenNextHearing.title}</span>
                  <span className="cp-hearing-sub">
                    {citizenNextHearing.date.toLocaleDateString("en-PK", { weekday: "long" })}{citizenNextHearing.court ? ` · ${citizenNextHearing.court}` : ""}
                  </span>
                </span>
              </div>
            ) : (
              <div className="cp-hearing">
                <span className="cp-hearing-text">
                  <span className="cp-hearing-title">No hearings scheduled</span>
                  <span className="cp-hearing-sub">Your advocate adds hearing dates to your case file.</span>
                </span>
              </div>
            )}
            {citizenNextHearing && (
              <>
                <div className="cp-divider" />
                <Link to={`/case/${citizenNextHearing.caseId}`} className="citizen-hero-link">
                  Open case file <ArrowRight size={14} />
                </Link>
              </>
            )}
          </div>
        </div>
      </section>

      <main className="cp-main citizen-main">
        <section className="cp-stats" aria-label="Your cases at a glance">
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><Briefcase size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Cases filed</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-value">{stats.totalCases}</span>
              <span className="cp-stat-note">{stats.lawyerCasesCount} private · {stats.ngoCasesCount} pro bono</span>
            </div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><Clock size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Active matters</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-value">{stats.activeCases}</span>
              <span className="cp-stat-note">In progress or review</span>
            </div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><Calendar size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Upcoming hearings</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-value">{stats.upcomingHearingsCount}</span>
              <span className="cp-stat-note">Scheduled</span>
            </div>
          </div>
          <div className="cp-stat">
            <div className="cp-stat-head">
              <span className="cp-icon-tile"><CheckCircle2 size={20} strokeWidth={1.8} /></span>
              <span className="cp-stat-label">Resolved</span>
            </div>
            <div className="cp-stat-row">
              <span className="cp-stat-value">{stats.resolvedCases}</span>
              <span className="cp-stat-note">Concluded</span>
            </div>
          </div>
        </section>

        <CitizenInsights cases={cases} />

        {/* ========================================================= */}
        {/* INQUIRIES & RETAINER OFFERS BANNER / SECTION              */}
        {/* ========================================================= */}
        {visibleInquiries.length > 0 && (
          <section style={{ marginBottom: "32px" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "16px", flexWrap: "wrap", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "10px",
                    backgroundColor: "#FFFBEB",
                    color: "#D97706",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Clock size={20} strokeWidth={2} />
                </div>
                <div>
                  <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--ll-text-primary)", margin: 0 }}>
                    Inquiries & Retainer Offers
                  </h3>
                  <p style={{ fontSize: "13px", color: "var(--ll-text-secondary)", margin: 0 }}>
                    Track your legal representation inquiries and activate cases upon counsel acceptance.
                  </p>
                </div>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: "600",
                  padding: "4px 10px",
                  borderRadius: "9999px",
                  backgroundColor: "#F1F5F9",
                  color: "#475569"
                }}
              >
                {visibleInquiries.length} {visibleInquiries.length === 1 ? "Inquiry" : "Inquiries"}
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {visibleInquiries.map((inq) => {
                const lawyerName = inq.lawyerId?.name || "Legal Counsel";
                const pkgName = (inq.packageType || "gold").toUpperCase();
                const feeAmount = inq.amount || (inq.packageType === "platinum" ? 45000 : 25000);

                if (inq.status === "accepted_awaiting_payment") {
                  return (
                    <div
                      key={inq._id}
                      style={{
                        backgroundColor: "#F0FDF4",
                        border: "2px solid #86EFAC",
                        borderRadius: "14px",
                        padding: "20px 24px",
                        boxShadow: "0 4px 12px rgba(22, 101, 52, 0.08)",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "18px"
                      }}
                    >
                      <div style={{ maxWidth: "720px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "8px", flexWrap: "wrap" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "9999px",
                              fontSize: "12px",
                              fontWeight: 700,
                              backgroundColor: "#DCFCE7",
                              color: "#15803D",
                              border: "1px solid #86EFAC"
                            }}
                          >
                            <Scale size={13} style={{ display: "inline-block", marginRight: "4px" }} />
                            Offer Accepted
                          </span>
                          <span style={{ fontSize: "12px", color: "#166534", fontWeight: 600 }}>
                            {pkgName} Retainer Package • PKR {Number(feeAmount).toLocaleString()}
                          </span>
                        </div>
                        <h4 style={{ fontSize: "17px", fontWeight: "700", color: "#14532D", margin: "0 0 6px 0" }}>
                          Advocate {lawyerName} has accepted your inquiry for {pkgName} Package!
                        </h4>
                        <p style={{ fontSize: "13.5px", color: "#166534", margin: "0 0 6px 0", lineHeight: 1.5 }}>
                          Complete payment to activate formal representation and open your private case docket.
                        </p>
                        <div style={{ fontSize: "12.5px", color: "#475569" }}>
                          Matter Title: <strong>{inq.title || "Legal Representation"}</strong> &bull; Category: <strong>{inq.category || "General Consultation"}</strong>
                        </div>
                      </div>

                      <div>
                        <button
                          onClick={() => {
                            setPayingInquiry(inq);
                            setShowPaymentModal(true);
                          }}
                          style={{
                            backgroundColor: "#1E3F2E",
                            color: "#FFFFFF",
                            border: "none",
                            padding: "12px 24px",
                            borderRadius: "10px",
                            fontWeight: 700,
                            fontSize: "14px",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            boxShadow: "0 4px 8px rgba(0, 0, 0, 0.15)",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#142A1F")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#1E3F2E")}
                        >
                          <span>Pay PKR {Number(feeAmount).toLocaleString()} & Activate Case</span>
                          <ArrowRight size={16} />
                        </button>
                      </div>
                    </div>
                  );
                }

                if (inq.status === "pending") {
                  return (
                    <div
                      key={inq._id}
                      style={{
                        backgroundColor: "var(--ll-bg-surface)",
                        border: "1px solid var(--ll-border)",
                        borderRadius: "14px",
                        padding: "18px 22px",
                        boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "14px"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "9999px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: "#FFFBEB",
                              color: "#92400E",
                              border: "1px solid #FDE68A"
                            }}
                          >
                            ⏳ Under Counsel Review
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--ll-text-secondary)" }}>
                            Submitted {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 style={{ fontSize: "16px", fontWeight: "700", color: "var(--ll-text-primary)", margin: "0 0 4px 0" }}>
                          {inq.title || `Inquiry for ${pkgName} Package`}
                        </h4>
                        <p style={{ fontSize: "13px", color: "#475569", margin: 0 }}>
                          Submitted to <strong>Advocate {lawyerName}</strong> ({pkgName} Retainer • Proposed Fee: PKR {Number(feeAmount).toLocaleString()}). Zero upfront charges.
                        </p>
                      </div>

                      <div style={{ fontSize: "12.5px", color: "var(--ll-text-secondary)", backgroundColor: "#F8FAFC", padding: "6px 14px", borderRadius: "8px", border: "1px solid var(--ll-border)" }}>
                        <span>Awaiting counsel review</span>
                      </div>
                    </div>
                  );
                }

                if (inq.status === "rejected") {
                  return (
                    <div
                      key={inq._id}
                      style={{
                        backgroundColor: "#F8FAFC",
                        border: "1px solid var(--ll-border)",
                        borderRadius: "14px",
                        padding: "16px 20px",
                        display: "flex",
                        flexWrap: "wrap",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "12px"
                      }}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                          <span
                            style={{
                              padding: "3px 10px",
                              borderRadius: "9999px",
                              fontSize: "12px",
                              fontWeight: 600,
                              backgroundColor: "#F1F5F9",
                              color: "#475569",
                              border: "1px solid #CBD5E1"
                            }}
                          >
                            Inquiry Declined
                          </span>
                          <span style={{ fontSize: "12px", color: "var(--ll-text-secondary)" }}>
                            {new Date(inq.createdAt).toLocaleDateString()}
                          </span>
                        </div>
                        <h4 style={{ fontSize: "15px", fontWeight: "600", color: "#334155", margin: "0 0 4px 0" }}>
                          Advocate {lawyerName} was unable to accept representation
                        </h4>
                        <p style={{ fontSize: "13px", color: "var(--ll-text-secondary)", margin: 0 }}>
                          {inq.rejectionReason 
                            ? `Counsel note: "${inq.rejectionReason}". ` 
                            : "Counsel was unavailable due to current caseload capacity. "}
                          Zero fees were charged to your account.
                        </p>
                      </div>

                      <Link
                        to="/lawyers"
                        style={{
                          color: "#1E3F2E",
                          fontSize: "13px",
                          fontWeight: 600,
                          textDecoration: "none",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px"
                        }}
                      >
                        <span>Browse other advocates</span>
                        <ChevronRight size={14} />
                      </Link>
                    </div>
                  );
                }

                return null;
              })}
            </div>
          </section>
        )}

        {/* ========================================================= */}
        {/* C. CASE FILTER TABS & SEARCH CONTROLS                     */}
        {/* ========================================================= */}
        <section
          style={{
            backgroundColor: "var(--ll-bg-surface)",
            border: "1px solid var(--ll-border)",
            borderRadius: "16px",
            padding: "20px 24px",
            marginBottom: "24px",
            boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
          }}
        >
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "18px"
            }}
          >
            {/* Pill Navigation Tabs */}
            <div
              style={{
                display: "flex",
                gap: "8px",
                flexWrap: "wrap",
                backgroundColor: "#F1F5F9",
                padding: "4px",
                borderRadius: "10px"
              }}
            >
              {/* Tab 1: All Cases */}
              <button
                onClick={() => setActiveTab("all")}
                style={{
                  backgroundColor: activeTab === "all" ? "#FFFFFF" : "transparent",
                  color: activeTab === "all" ? "#1E3F2E" : "#64748B",
                  fontWeight: activeTab === "all" ? 700 : 500,
                  fontSize: "13.5px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: activeTab === "all" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <span>All Cases</span>
                <span
                  style={{
                    backgroundColor: activeTab === "all" ? "#1E3F2E" : "#CBD5E1",
                    color: activeTab === "all" ? "#FFFFFF" : "#334155",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "9999px"
                  }}
                >
                  {cases.length}
                </span>
              </button>

              {/* Tab 2: Lawyer Cases (Private Counsel) */}
              <button
                onClick={() => setActiveTab("lawyer")}
                style={{
                  backgroundColor: activeTab === "lawyer" ? "#FFFFFF" : "transparent",
                  color: activeTab === "lawyer" ? "#1E3F2E" : "#64748B",
                  fontWeight: activeTab === "lawyer" ? 700 : 500,
                  fontSize: "13.5px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: activeTab === "lawyer" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <Briefcase size={14} />
                <span>Lawyer Cases (Private Counsel)</span>
                <span
                  style={{
                    backgroundColor: activeTab === "lawyer" ? "#1E3F2E" : "#CBD5E1",
                    color: activeTab === "lawyer" ? "#FFFFFF" : "#334155",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "9999px"
                  }}
                >
                  {cases.filter((c) => Boolean(c.lawyerId) && c.caseType !== "pro_bono").length}
                </span>
              </button>

              {/* Tab 3: NGO Pro Bono Cases (Free Legal Aid) */}
              <button
                onClick={() => setActiveTab("ngo")}
                style={{
                  backgroundColor: activeTab === "ngo" ? "#FFFFFF" : "transparent",
                  color: activeTab === "ngo" ? "#0F766E" : "#64748B",
                  fontWeight: activeTab === "ngo" ? 700 : 500,
                  fontSize: "13.5px",
                  padding: "8px 16px",
                  borderRadius: "8px",
                  border: "none",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  boxShadow: activeTab === "ngo" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
                  transition: "all 0.15s ease"
                }}
              >
                <Building2 size={14} />
                <span>NGO Pro Bono Cases (Free Legal Aid)</span>
                <span
                  style={{
                    backgroundColor: activeTab === "ngo" ? "#0F766E" : "#CBD5E1",
                    color: activeTab === "ngo" ? "#FFFFFF" : "#334155",
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 7px",
                    borderRadius: "9999px"
                  }}
                >
                  {cases.filter((c) => Boolean(c.ngoId) || c.caseType === "pro_bono").length}
                </span>
              </button>
            </div>

            {/* Status Filter & Search Input */}
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap", alignItems: "center" }}>
              {/* Status Dropdown */}
              <div style={{ position: "relative" }}>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  style={{
                    appearance: "none",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "8px 34px 8px 14px",
                    fontSize: "13.5px",
                    color: "#1E293B",
                    fontWeight: 500,
                    cursor: "pointer",
                    outline: "none"
                  }}
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending Review</option>
                  <option value="under_review">Under Review</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In Progress</option>
                  <option value="resolved">Resolved</option>
                  <option value="rejected">Rejected</option>
                </select>
                <div style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "var(--ll-text-secondary)" }}>
                  <Filter size={13} />
                </div>
              </div>

              {/* Search Box */}
              <div style={{ position: "relative" }}>
                <input
                  type="text"
                  placeholder="Search by case title, lawyer or NGO..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "8px 14px 8px 34px",
                    fontSize: "13.5px",
                    color: "#1E293B",
                    width: "260px",
                    outline: "none"
                  }}
                />
                <div style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", pointerEvents: "none", color: "#66756D" }}>
                  <Search size={14} />
                </div>
                {searchQuery && (
                  <button
                    onClick={() => setSearchQuery("")}
                    style={{
                      position: "absolute",
                      right: "8px",
                      top: "50%",
                      transform: "translateY(-50%)",
                      background: "transparent",
                      border: "none",
                      color: "#66756D",
                      cursor: "pointer",
                      padding: "2px"
                    }}
                  >
                    <X size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>

        {/* ========================================================= */}
        {/* D. CASE CARDS LIST / STRUCTURED MODERN VIEW               */}
        {/* ========================================================= */}
        {filteredCases.length === 0 ? (
          <div
            style={{
              backgroundColor: "var(--ll-bg-surface)",
              border: "1px solid var(--ll-border)",
              borderRadius: "16px",
              boxShadow: "0 1px 3px rgba(0, 0, 0, 0.03)"
            }}
          >
            <EmptyState
              icon="folder"
              title={searchQuery || statusFilter !== "all" || activeTab !== "all" ? "No Matching Cases" : "No Legal Cases Yet"}
              description={searchQuery || statusFilter !== "all" || activeTab !== "all"
                ? "No legal matters match your active filter criteria. Try resetting filters or adjusting search keywords."
                : "Need legal representation? Submit a new case to hire a verified private lawyer or apply for free pro bono aid through accredited NGOs."}
              action={!(searchQuery || statusFilter !== "all" || activeTab !== "all") ? {
                label: "Submit New Legal Case",
                onClick: () => setShowCreateModal(true)
              } : undefined}
            />
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {filteredCases.map((caseItem) => {
              const isProBono = Boolean(caseItem.ngoId) || caseItem.caseType === "pro_bono";
              const hearing = getHearingInfo(caseItem);

              return (
                <div
                  key={caseItem._id}
                  style={{
                    backgroundColor: "var(--ll-bg-surface)",
                    border: "1px solid var(--ll-border)",
                    borderRadius: "14px",
                    padding: "24px",
                    boxShadow: "0 1px 3px rgba(0, 0, 0, 0.04)",
                    transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease",
                    display: "flex",
                    flexDirection: "column",
                    gap: "18px"
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = isProBono ? "#0F766E" : "#1E3F2E";
                    e.currentTarget.style.boxShadow = "0 6px 16px -2px rgba(15, 23, 42, 0.08)";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = "#E2E8F0";
                    e.currentTarget.style.boxShadow = "0 1px 3px rgba(0, 0, 0, 0.04)";
                  }}
                >
                  {/* Top Bar: Case Category, Priority, Reference, and Status */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      borderBottom: "1px solid #F1F5F9",
                      paddingBottom: "14px"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                      {/* Case Category Tag */}
                      <span
                        style={{
                          backgroundColor: "#ECFDF5",
                          color: "#065F46",
                          border: "1px solid #A7F3D0",
                          fontSize: "12px",
                          fontWeight: 600,
                          padding: "3px 10px",
                          borderRadius: "9999px"
                        }}
                      >
                        {caseItem.category || "General Legal Matter"}
                      </span>

                      {/* Representation Type Tag */}
                      {isProBono ? (
                        <span
                          style={{
                            backgroundColor: "#CCFBF1",
                            color: "#115E59",
                            border: "1px solid #99F6E4",
                            fontSize: "12px",
                            fontWeight: 700,
                            padding: "3px 10px",
                            borderRadius: "9999px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                        >
                          <Building2 size={12} />
                          <span>Pro Bono Legal Aid</span>
                        </span>
                      ) : (
                        <span
                          style={{
                            backgroundColor: "#F1F5F9",
                            color: "#334155",
                            border: "1px solid #CBD5E1",
                            fontSize: "12px",
                            fontWeight: 600,
                            padding: "3px 10px",
                            borderRadius: "9999px",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px"
                          }}
                        >
                          <Briefcase size={12} />
                          <span>Private Counsel</span>
                        </span>
                      )}

                      {/* Priority Badge */}
                      {renderPriorityBadge(caseItem.priority)}

                      {/* Reference / Filing Date */}
                      <span style={{ fontSize: "12px", color: "#66756D" }}>
                        REF: #{caseItem._id.slice(-6).toUpperCase()} • Filed{" "}
                        {new Date(caseItem.createdAt).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric"
                        })}
                      </span>
                    </div>

                    {/* Status Pill */}
                    <div>{renderStatusBadge(caseItem.status)}</div>
                  </div>

                  {/* Middle Content: Title, Description, and Counsel Block */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "20px",
                      alignItems: "center"
                    }}
                  >
                    {/* Left: Title & Description */}
                    <div>
                      <h3
                        style={{
                          fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)",
                          fontSize: "19px",
                          fontWeight: 700,
                          color: "var(--ll-text-primary)",
                          margin: "0 0 6px 0",
                          lineHeight: 1.3
                        }}
                      >
                        {caseItem.title}
                      </h3>
                      <p
                        style={{
                          color: "#475569",
                          fontSize: "14px",
                          lineHeight: 1.55,
                          margin: 0,
                          display: "-webkit-box",
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: "vertical",
                          overflow: "hidden"
                        }}
                      >
                        {caseItem.description}
                      </p>
                    </div>

                    {/* Right: Counsel Assigned Block */}
                    <div
                      style={{
                        backgroundColor: "#F8FAFC",
                        border: "1px solid var(--ll-border)",
                        borderRadius: "10px",
                        padding: "12px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px"
                      }}
                    >
                      {/* Counsel Avatar / Icon */}
                      {caseItem.lawyerId ? (
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            backgroundColor: "#1E3F2E",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: 700,
                            fontSize: "16px",
                            flexShrink: 0
                          }}
                        >
                          {caseItem.lawyerId.name?.charAt(0) || "L"}
                        </div>
                      ) : caseItem.ngoId ? (
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            backgroundColor: "#0F766E",
                            color: "#FFFFFF",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          <Building2 size={22} />
                        </div>
                      ) : (
                        <div
                          style={{
                            width: "44px",
                            height: "44px",
                            borderRadius: "50%",
                            backgroundColor: "#FEF3C7",
                            color: "#D97706",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            flexShrink: 0
                          }}
                        >
                          <Clock size={22} />
                        </div>
                      )}

                      {/* Counsel Details */}
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#66756D", letterSpacing: "0.04em" }}>
                          Assigned Counsel
                        </div>
                        {caseItem.lawyerId ? (
                          <>
                            <div style={{ fontSize: "14.5px", fontWeight: 700, color: "var(--ll-text-primary)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              Adv. {caseItem.lawyerId.name}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span style={{ fontSize: "12px", color: "var(--ll-text-secondary)" }}>
                                {caseItem.lawyerId.specialization?.[0] || "Advocate High Court"}
                              </span>
                              {caseItem.lawyerId.barCouncilId && (
                                <span
                                  style={{
                                    backgroundColor: "#FEF3C7",
                                    color: "#92400E",
                                    fontSize: "10px",
                                    fontWeight: 700,
                                    padding: "1px 6px",
                                    borderRadius: "4px"
                                  }}
                                >
                                  BAR VERIFIED
                                </span>
                              )}
                            </div>
                          </>
                        ) : caseItem.ngoId ? (
                          <>
                            <div style={{ fontSize: "14.5px", fontWeight: 700, color: "#0F766E", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                              {caseItem.ngoId.name}
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "2px" }}>
                              <span style={{ fontSize: "12px", color: "var(--ll-text-secondary)" }}>
                                {caseItem.ngoId.city ? `${caseItem.ngoId.city} • ` : ""}Free Legal Aid
                              </span>
                              <span
                                style={{
                                  backgroundColor: "#CCFBF1",
                                  color: "#115E59",
                                  fontSize: "10px",
                                  fontWeight: 700,
                                  padding: "1px 6px",
                                  borderRadius: "4px"
                                }}
                              >
                                ACCREDITED NGO
                              </span>
                            </div>
                          </>
                        ) : (
                          <>
                            <div style={{ fontSize: "14px", fontWeight: 600, color: "#D97706" }}>
                              Awaiting Counsel Allocation
                            </div>
                            <div style={{ fontSize: "12px", color: "var(--ll-text-secondary)" }}>
                              Under administrative review
                            </div>
                          </>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Bottom Bar: Next Hearing Chip + Action Button */}
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "12px",
                      paddingTop: "12px",
                      borderTop: "1px solid #F8FAFC"
                    }}
                  >
                    {/* Hearing Date Chip */}
                    <div>
                      {hearing ? (
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "8px",
                            backgroundColor: hearing.isUpcoming ? "#FBF5E6" : "#F7F8F5",
                            border: `1px solid ${hearing.isUpcoming ? "#EAD9A8" : "#E4E8E3"}`,
                            color: hearing.isUpcoming ? "#8A6410" : "#42524A",
                            padding: "6px 12px",
                            borderRadius: "8px",
                            fontSize: "13px",
                            fontWeight: 600
                          }}
                        >
                          <Calendar size={15} />
                          <span>
                            {hearing.isUpcoming ? "Next Hearing: " : "Last Hearing: "}
                            <strong>{hearing.date}</strong>
                          </span>
                        </div>
                      ) : (
                        <span style={{ fontSize: "12.5px", color: "#66756D", fontStyle: "italic" }}>
                          No court hearing scheduled yet
                        </span>
                      )}
                    </div>

                    {/* Action Buttons */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      {["resolved", "closed"].includes(caseItem.status) && (
                        reviewedCaseMap[caseItem._id] ? (
                          (() => {
                            const rev = reviewedCaseMap[caseItem._id];
                            const hoursElapsed = rev ? (Date.now() - new Date(rev.createdAt).getTime()) / (1000 * 60 * 60) : 999;
                            const isEditable = hoursElapsed <= 48;
                            const hoursRemaining = Math.max(1, Math.ceil(48 - hoursElapsed));

                            return (
                              <div style={{ display: "inline-flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "5px",
                                    backgroundColor: "#FEF9C3",
                                    color: "#854D0E",
                                    border: "1px solid #FDE047",
                                    padding: "6px 12px",
                                    borderRadius: "8px",
                                    fontSize: "12.5px",
                                    fontWeight: 700
                                  }}
                                >
                                  <Star size={13} fill="#EAB308" color="#CA8A04" />
                                  <span>Rated {rev.rating}/5</span>
                                  {rev.isEdited && (
                                    <span style={{ fontSize: "10px", color: "#A16207", fontStyle: "italic", marginLeft: "2px" }}>
                                      (edited)
                                    </span>
                                  )}
                                </span>

                                {/* Verified Client Badge */}
                                <span
                                  style={{
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px",
                                    backgroundColor: "#ECFDF5",
                                    color: "#065F46",
                                    border: "1px solid #A7F3D0",
                                    padding: "5px 10px",
                                    borderRadius: "6px",
                                    fontSize: "11.5px",
                                    fontWeight: 700
                                  }}
                                  title="Verified Client: Review substantiated by official resolved legal case file"
                                >
                                  <CheckCircle2 size={12} />
                                  <span>Verified Client</span>
                                </span>

                                {isEditable ? (
                                  <button
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenReviewModal(caseItem, true);
                                    }}
                                    style={{
                                      backgroundColor: "var(--ll-bg-surface)",
                                      color: "#1E3F2E",
                                      border: "1px solid #1E3F2E",
                                      padding: "6px 10px",
                                      borderRadius: "6px",
                                      fontWeight: 700,
                                      fontSize: "12px",
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      transition: "all 0.15s ease"
                                    }}
                                    title={`You can modify your review for another ${hoursRemaining} hours`}
                                  >
                                    <Edit3 size={12} />
                                    <span>Edit Review ({hoursRemaining}h left)</span>
                                  </button>
                                ) : (
                                  <span
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "3px",
                                      fontSize: "11px",
                                      color: "#66756D",
                                      fontWeight: 600
                                    }}
                                    title="The 48-hour editing window has concluded. Review is permanently locked."
                                  >
                                    <Clock size={11} />
                                    <span>Review Locked</span>
                                  </span>
                                )}
                              </div>
                            );
                          })()
                        ) : (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handleOpenReviewModal(caseItem, false);
                            }}
                            style={{
                              backgroundColor: "#C5A059",
                              color: "#0F2219",
                              border: "none",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              fontWeight: 700,
                              fontSize: "13px",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              transition: "all 0.15s ease",
                              boxShadow: "0 1px 3px rgba(0,0,0,0.1)"
                            }}
                            onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#D4AF37")}
                            onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#C5A059")}
                          >
                            <Star size={14} fill="#0F2219" />
                            <span>Leave a Review</span>
                          </button>
                        )
                      )}

                      <button
                        onClick={() => navigate(`/case/${caseItem._id}`)}
                        style={{
                          backgroundColor: "var(--ll-bg-surface)",
                          color: "#1E3F2E",
                          border: "1px solid #CBD5E1",
                          padding: "8px 16px",
                          borderRadius: "8px",
                          fontWeight: 600,
                          fontSize: "13.5px",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          transition: "all 0.15s ease"
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = "#1E3F2E";
                          e.currentTarget.style.color = "#FFFFFF";
                          e.currentTarget.style.borderColor = "#1E3F2E";
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = "#FFFFFF";
                          e.currentTarget.style.color = "#1E3F2E";
                          e.currentTarget.style.borderColor = "#CBD5E1";
                        }}
                      >
                        <span>View Case File & Hearings</span>
                        <ChevronRight size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* ========================================================= */}
      {/* F. CREATE NEW LEGAL CASE MODAL                            */}
      {/* ========================================================= */}
      {showCreateModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1050,
            backgroundColor: "rgba(15, 23, 42, 0.65)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowCreateModal(false);
          }}
        >
          <div
            style={{
              backgroundColor: "var(--ll-bg-surface)",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "680px",
              maxHeight: "90vh",
              overflowY: "auto",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              border: "1px solid var(--ll-border)"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: "#1E3F2E",
                color: "#FFFFFF",
                padding: "20px 24px",
                borderTopLeftRadius: "17px",
                borderTopRightRadius: "17px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <PlusCircle size={20} color="#C5A059" />
                <h3
                  style={{
                    fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)",
                    fontSize: "20px",
                    fontWeight: 700,
                    margin: 0,
                    color: "#FFFFFF"
                  }}
                >
                  Submit New Legal Matter
                </h3>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#FFFFFF",
                  cursor: "pointer"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Form */}
            <form onSubmit={handleCreateCase} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "18px" }}>
              {createError && (
                <div
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{createError}</span>
                </div>
              )}

              {/* Case Title */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Case Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g., Unlawful Eviction Notice & Tenant Rights Dispute"
                  value={createForm.title}
                  onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              {/* Row: Category & Priority */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "14px" }}>
                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Legal Category *
                  </label>
                  <select
                    value={createForm.category}
                    onChange={(e) => setCreateForm({ ...createForm, category: e.target.value })}
                    style={{
                      width: "100%",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13.5px",
                      outline: "none"
                    }}
                  >
                    <option value="Civil Litigation">Civil Litigation</option>
                    <option value="Criminal Defense">Criminal Defense</option>
                    <option value="Family & Custody">Family & Custody</option>
                    <option value="Property & Real Estate">Property & Real Estate</option>
                    <option value="Corporate & Commercial">Corporate & Commercial</option>
                    <option value="Human Rights">Human Rights</option>
                    <option value="Labor & Employment">Labor & Employment</option>
                    <option value="Domestic Violence">Domestic Violence</option>
                    <option value="Consumer Protection">Consumer Protection</option>
                    <option value="Cybercrime">Cybercrime</option>
                    <option value="Other">Other Legal Aid</option>
                  </select>
                </div>

                <div>
                  <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                    Urgency / Priority *
                  </label>
                  <select
                    value={createForm.priority}
                    onChange={(e) => setCreateForm({ ...createForm, priority: e.target.value })}
                    style={{
                      width: "100%",
                      backgroundColor: "#F8FAFC",
                      border: "1px solid #CBD5E1",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      fontSize: "13.5px",
                      outline: "none"
                    }}
                  >
                    <option value="low">Low (Standard review)</option>
                    <option value="medium">Medium (Regular schedule)</option>
                    <option value="high">High (Upcoming hearing)</option>
                    <option value="urgent">Urgent (Immediate notice/action)</option>
                  </select>
                </div>
              </div>

              {/* Representation Type: Lawyer vs NGO */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                  Legal Assistance Channel *
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div
                    onClick={() => setCreateForm({ ...createForm, representationType: "lawyer" })}
                    style={{
                      border: `2px solid ${createForm.representationType === "lawyer" ? "#1E3F2E" : "#E2E8F0"}`,
                      backgroundColor: createForm.representationType === "lawyer" ? "#F0FDF4" : "#FFFFFF",
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#1E3F2E", fontSize: "14px", marginBottom: "4px" }}>
                      <Briefcase size={16} />
                      <span>Private Advocate</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--ll-text-secondary)", lineHeight: 1.4 }}>
                      Retain dedicated certified counsel from our Bar Council accredited directory.
                    </p>
                  </div>

                  <div
                    onClick={() => setCreateForm({ ...createForm, representationType: "ngo" })}
                    style={{
                      border: `2px solid ${createForm.representationType === "ngo" ? "#0F766E" : "#E2E8F0"}`,
                      backgroundColor: createForm.representationType === "ngo" ? "#F0FDFA" : "#FFFFFF",
                      borderRadius: "10px",
                      padding: "14px",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: 700, color: "#0F766E", fontSize: "14px", marginBottom: "4px" }}>
                      <Building2 size={16} />
                      <span>Pro Bono NGO Aid</span>
                    </div>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--ll-text-secondary)", lineHeight: 1.4 }}>
                      Free representation provided by certified non-governmental legal aid societies.
                    </p>
                  </div>
                </div>
              </div>

              {/* Factual Description */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Case Narrative & Factual Background *
                </label>
                <textarea
                  required
                  rows={4}
                  placeholder="Detail key facts, dates, involved parties, notices received, and requested legal relief..."
                  value={createForm.description}
                  onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    outline: "none",
                    lineHeight: 1.5
                  }}
                />
              </div>

              {/* Document / Evidence Name */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Attached Evidence or Notice Title (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g., Legal Notice Copy, Eviction Memo, or Rental Agreement"
                  value={createForm.documentName}
                  onChange={(e) => setCreateForm({ ...createForm, documentName: e.target.value })}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    outline: "none"
                  }}
                />
              </div>

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  style={{
                    backgroundColor: "var(--ll-bg-surface)",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "10px 18px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creatingCase}
                  style={{
                    backgroundColor: "#1E3F2E",
                    color: "#FFFFFF",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 22px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: creatingCase ? 0.7 : 1
                  }}
                >
                  {creatingCase ? <><span className="btn-spinner" />Filing your case…</> : "File Legal Case"}
                  <ArrowRight size={16} />
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ========================================================= */}
      {/* F. CLIENT REVIEW & RATING MODAL (FR_18)                  */}
      {/* ========================================================= */}
      {reviewModalCase && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1200,
            backgroundColor: "rgba(15, 23, 42, 0.7)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "20px"
          }}
          onClick={(e) => {
            if (e.target === e.currentTarget) setReviewModalCase(null);
          }}
        >
          <div
            style={{
              backgroundColor: "var(--ll-bg-surface)",
              borderRadius: "18px",
              width: "100%",
              maxWidth: "540px",
              boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)",
              overflow: "hidden",
              border: "1px solid var(--ll-border)",
              animation: "fadeIn 0.2s ease"
            }}
          >
            {/* Modal Header */}
            <div
              style={{
                backgroundColor: "#1E3F2E",
                color: "#FFFFFF",
                padding: "20px 24px",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div
                  style={{
                    width: "36px",
                    height: "36px",
                    borderRadius: "50%",
                    backgroundColor: "rgba(197, 160, 89, 0.25)",
                    color: "#FEF08A",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center"
                  }}
                >
                  <Star size={20} fill="#FEF08A" color="#FEF08A" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: "18px", fontWeight: 700, fontFamily: "var(--font-serif, 'Playfair Display', Georgia, serif)" }}>
                    {isEditingReview ? "Edit Verified Review" : "Rate Legal Counsel"}
                  </h3>
                  <p style={{ margin: 0, fontSize: "12px", color: "#CBD5E1" }}>
                    {isEditingReview
                      ? "Editing permitted within 48h of submission • Rating changes update aggregate score"
                      : `Case #${reviewModalCase._id.slice(-6).toUpperCase()} • ${reviewModalCase.title}`}
                  </p>
                </div>
              </div>

              <button
                onClick={() => setReviewModalCase(null)}
                style={{
                  backgroundColor: "transparent",
                  border: "none",
                  color: "#FFFFFF",
                  cursor: "pointer"
                }}
              >
                <X size={20} />
              </button>
            </div>

            {/* Review Form */}
            <form onSubmit={handleSubmitReview} style={{ padding: "24px", display: "flex", flexDirection: "column", gap: "20px" }}>
              {reviewError && (
                <div
                  style={{
                    backgroundColor: "#FEF2F2",
                    border: "1px solid #FECACA",
                    color: "#991B1B",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    fontSize: "13.5px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px"
                  }}
                >
                  <AlertCircle size={16} />
                  <span>{reviewError}</span>
                </div>
              )}

              {/* Counsel Recipient Summary */}
              <div
                style={{
                  backgroundColor: "#F8FAFC",
                  border: "1px solid var(--ll-border)",
                  borderRadius: "10px",
                  padding: "12px 16px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px"
                }}
              >
                <div
                  style={{
                    width: "40px",
                    height: "40px",
                    borderRadius: "50%",
                    backgroundColor: reviewModalCase.ngoId ? "#0F766E" : "#1E3F2E",
                    color: "#FFFFFF",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontWeight: 700
                  }}
                >
                  {reviewModalCase.ngoId ? <Building2 size={20} /> : (reviewModalCase.lawyerId?.name?.charAt(0) || "L")}
                </div>
                <div>
                  <div style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: 700, color: "#66756D" }}>
                    Reviewing Counsel
                  </div>
                  <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--ll-text-primary)" }}>
                    {reviewModalCase.ngoId ? reviewModalCase.ngoId.name : `Adv. ${reviewModalCase.lawyerId?.name || "Assigned Lawyer"}`}
                  </div>
                </div>
              </div>

              {/* Star Rating Interactive Selector */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "8px" }}>
                  Overall Rating *
                </label>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  {[1, 2, 3, 4, 5].map((starVal) => {
                    const active = (reviewHoverRating || reviewRating) >= starVal;
                    return (
                      <button
                        type="button"
                        key={starVal}
                        onMouseEnter={() => setReviewHoverRating(starVal)}
                        onMouseLeave={() => setReviewHoverRating(0)}
                        onClick={() => setReviewRating(starVal)}
                        style={{
                          backgroundColor: "transparent",
                          border: "none",
                          padding: "4px",
                          cursor: "pointer",
                          transition: "transform 0.1s ease",
                          transform: (reviewHoverRating || reviewRating) >= starVal ? "scale(1.15)" : "scale(1)"
                        }}
                      >
                        <Star
                          size={32}
                          fill={active ? "#EAB308" : "transparent"}
                          color={active ? "#CA8A04" : "#CBD5E1"}
                          strokeWidth={1.75}
                        />
                      </button>
                    );
                  })}
                  <span style={{ marginLeft: "8px", fontSize: "15px", fontWeight: 700, color: "#854D0E" }}>
                    {reviewHoverRating || reviewRating} / 5 Stars
                  </span>
                </div>
              </div>

              {/* Comment Textarea */}
              <div>
                <label style={{ display: "block", fontSize: "13px", fontWeight: 700, color: "#334155", marginBottom: "6px" }}>
                  Written Feedback & Experience *
                </label>
                <textarea
                  required
                  rows={4}
                  maxLength={1000}
                  placeholder="Describe your experience with this legal counsel (e.g., responsiveness, court representation, legal clarity)..."
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  style={{
                    width: "100%",
                    boxSizing: "border-box",
                    backgroundColor: "#F8FAFC",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "10px 14px",
                    fontSize: "14px",
                    outline: "none",
                    lineHeight: 1.5
                  }}
                />
                <div style={{ textAlign: "right", fontSize: "11px", color: "#66756D", marginTop: "4px" }}>
                  {reviewComment.length} / 1000 characters
                </div>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setReviewModalCase(null)}
                  style={{
                    backgroundColor: "var(--ll-bg-surface)",
                    border: "1px solid #CBD5E1",
                    borderRadius: "8px",
                    padding: "10px 18px",
                    fontSize: "14px",
                    fontWeight: 600,
                    color: "#475569",
                    cursor: "pointer"
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReview}
                  style={{
                    backgroundColor: "#C5A059",
                    color: "#0F2219",
                    border: "none",
                    borderRadius: "8px",
                    padding: "10px 22px",
                    fontSize: "14px",
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "8px",
                    opacity: submittingReview ? 0.7 : 1
                  }}
                >
                  {submittingReview ? (
                    <><span className="btn-spinner" />{isEditingReview ? "Saving changes…" : "Publishing review…"}</>
                  ) : (
                    <>{isEditingReview ? "Update Review" : "Publish Review"} <Star size={16} fill="#0F2219" /></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Payment for accepted inquiries (Stripe card checkout, or the demo screen without Stripe) */}
      <PaymentCheckout
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setPayingInquiry(null);
        }}
        inquiry={payingInquiry}
        lawyer={payingInquiry?.lawyerId}
        currentUser={user}
        onDemoSuccess={handlePaymentSuccess}
      />
      <Footer showCta={false} />
    </div>
  );
};

export default UserDashboard;