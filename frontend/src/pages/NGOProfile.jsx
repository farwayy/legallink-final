import React, { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { ngoAPI, reviewAPI } from "../services/api";
import { useAuth } from "../contexts/AuthContext";
import { ProfilePageSkeleton } from "../components/ui/Skeleton";
import Navbar from "../components/Navbar";
import Footer from "../components/Footer";
import {
  Star, Flag, ShieldCheck, Building2, MessageSquare, CornerDownRight,
  ArrowLeft, ArrowRight, MapPin, Hash, Scale, HeartHandshake, Inbox, Check,
} from "lucide-react";
import "../styles/counselPortal.css";
import { notify } from "../components/Toast";

const NgoStars = ({ value = 0, size = 14 }) => (
  <span className="cp-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star key={s} size={size} fill={s <= Math.round(value) ? "#D4AF37" : "none"} color={s <= Math.round(value) ? "#C9A24B" : "#94A3B8"} strokeWidth={1.8} />
    ))}
  </span>
);

const fmtDate = (d) => (d ? new Date(d).toLocaleDateString("en-PK", { day: "numeric", month: "short", year: "numeric" }) : "");

const CATEGORIES = [
  "Human Rights",
  "Domestic Violence",
  "Child Protection",
  "Labor Rights",
  "Prisoner Aid",
  "Women Rights",
  "Property & Eviction",
  "Other Legal Aid"
];

const NGOProfilePage = () => {
  const { id } = useParams();
  const { isAuthenticated, user } = useAuth();
  const navigate = useNavigate();

  const [ngo, setNgo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [aidForm, setAidForm] = useState({ title: "", category: "", description: "" });
  const [submitting, setSubmitting] = useState(false);
  const [aidSuccess, setAidSuccess] = useState(false);
  const [aidError, setAidError] = useState("");

  // Reviews State (FR_18)
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsSort, setReviewsSort] = useState("recent");
  const [starDistribution, setStarDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [totalReviewCount, setTotalReviewCount] = useState(0);
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyComment, setReplyComment] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [reportModalReview, setReportModalReview] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportingReview, setReportingReview] = useState(false);

  useEffect(() => {
    ngoAPI
      .getNGOById(id)
      .then((r) => setNgo(r.data))
      .catch(() => setNotFound(true))
      .finally(() => setLoading(false));

    fetchReviews("recent");
  }, [id]);

  const fetchReviews = async (sortOrder = reviewsSort) => {
    try {
      setReviewsLoading(true);
      const res = await reviewAPI.getNGOReviews(id, { sort: sortOrder });
      setReviews(res.data?.reviews || []);
      if (res.data?.starDistribution) {
        setStarDistribution(res.data.starDistribution);
      }
      if (typeof res.data?.count === 'number') {
        setTotalReviewCount(res.data.count);
      }
    } catch (err) {
      console.error("Error fetching NGO reviews:", err);
    } finally {
      setReviewsLoading(false);
    }
  };

  const handleSortChange = (newSort) => {
    setReviewsSort(newSort);
    fetchReviews(newSort);
  };

  const handlePostReply = async (reviewId) => {
    if (!replyComment.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await reviewAPI.replyReview(reviewId, { comment: replyComment.trim() });
      const updatedReview = res.data?.review;
      setReviews((prev) =>
        prev.map((r) =>
          r._id === reviewId
            ? {
                ...r,
                reply: updatedReview?.reply || {
                  comment: replyComment.trim(),
                  repliedAt: new Date(),
                  authorName: ngo?.name || "Legal Aid Society",
                  authorRole: "ngo"
                }
              }
            : r
        )
      );
      setReplyingReviewId(null);
      setReplyComment("");
      notify("Your reply is now public on your profile.", "success");
    } catch (err) {
      console.error("Error posting NGO reply:", err);
      notify(err.response?.data?.message || "Couldn't post your reply. Please try again.", "error");
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleReportReview = async (e) => {
    e.preventDefault();
    if (!reportModalReview || !reportReason.trim()) return;

    setReportingReview(true);
    try {
      await reviewAPI.flagReview(reportModalReview._id, reportReason.trim());
      notify("Thanks. Our team will review this report.", "success");
      setReportModalReview(null);
      setReportReason("");
      fetchReviews();
    } catch (err) {
      console.error("Error reporting review:", err);
      notify(err.response?.data?.message || "Couldn't send the report. Please try again.", "error");
    } finally {
      setReportingReview(false);
    }
  };

  const handleAidSubmit = async (e) => {
    e.preventDefault();
    if (!aidForm.title.trim() || !aidForm.category || !aidForm.description.trim()) {
      setAidError("Please provide a case title, legal category, and factual description.");
      return;
    }
    setSubmitting(true);
    setAidError("");

    try {
      await ngoAPI.requestAid(id, aidForm);
      setAidSuccess(true);
    } catch (err) {
      setAidError(err.response?.data?.message || "Failed to submit request. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const openAidModal = () => {
    if (!isAuthenticated || user?.role !== "user") {
      navigate("/user/login");
      return;
    }
    setShowModal(true);
    setAidSuccess(false);
    setAidError("");
    setAidForm({ title: "", category: "", description: "" });
  };

  if (loading) {
    return (
      <>
        <Navbar />
        <div className="cp-page" style={{ minHeight: "70vh" }}>
          <ProfilePageSkeleton />
        </div>
        <Footer />
      </>
    );
  }

  if (notFound || !ngo) {
    return (
      <>
        <Navbar />
        <div className="cp-page" style={{ minHeight: "70vh", display: "flex", alignItems: "center", justifyContent: "center", padding: "40px 20px" }}>
          <div className="cp-card cp-empty" style={{ maxWidth: 480 }}>
            <span className="cp-empty-icon"><Building2 size={24} strokeWidth={1.8} /></span>
            <strong>Organisation not found</strong>
            <p>This organisation doesn't exist or is still being reviewed for accreditation.</p>
            <Link to="/ngos" className="cp-btn-primary" style={{ textDecoration: "none" }}><ArrowLeft size={15} /> Back to the directory</Link>
          </div>
        </div>
        <Footer />
      </>
    );
  }

  const ngoReviewCount = totalReviewCount || reviews.length;
  const ngoRating = ngoReviewCount > 0
    ? (ngo.rating ? Number(ngo.rating) : reviews.reduce((acc, r) => acc + r.rating, 0) / (reviews.length || 1))
    : 0;
  const ngoInitials = (ngo.name || "NGO").split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w.charAt(0).toUpperCase()).join("");

  return (
    <>
      <Navbar />
      <style>{`
        .ngo-prof-wrapper {
          background-color: var(--cp-page);
          min-height: 100vh;
          color: var(--cp-text);
          padding-bottom: 64px;
        }

        /* ── Header Banner ── */
        .ngo-prof-hero {
          background: #ffffff;
          border-bottom: 1px solid #e5e7eb;
          padding: 48px 24px;
        }
        .ngo-prof-container {
          max-width: 1140px;
          margin: 0 auto;
        }
        .ngo-breadcrumb {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.82rem;
          color: #6b7280;
          margin-bottom: 20px;
        }
        .ngo-breadcrumb a {
          color: #0A3622;
          text-decoration: none;
          font-weight: 600;
        }
        .ngo-hero-flex {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          flex-wrap: wrap;
          gap: 24px;
        }
        .ngo-hero-main {
          flex: 1;
          min-width: 300px;
        }
        .ngo-prof-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 4px 12px;
          border-radius: 4px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
          margin-bottom: 12px;
        }
        .ngo-prof-name {
          font-family: 'Marcellus', Georgia, serif;
          font-size: clamp(1.8rem, 3.5vw, 2.4rem);
          font-weight: 700;
          color: #0c1333;
          margin-bottom: 12px;
          line-height: 1.2;
        }
        .ngo-hero-meta {
          display: flex;
          flex-wrap: wrap;
          gap: 18px;
          font-size: 0.88rem;
          color: #4b5563;
        }
        .ngo-meta-item {
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .ngo-aid-btn {
          background: #0A3622;
          border: 1px solid #0A3622;
          color: #ffffff;
          padding: 14px 28px;
          border-radius: 8px;
          font-size: 0.95rem;
          font-weight: 700;
          cursor: pointer;
          display: inline-flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 14px rgba(10, 54, 34, 0.2);
          transition: all 0.2s ease;
        }
        .ngo-aid-btn:hover {
          background: #072618;
          transform: translateY(-1px);
          box-shadow: 0 6px 18px rgba(10, 54, 34, 0.25);
        }

        /* ── Two-Column Layout ── */
        .ngo-layout-grid {
          display: grid;
          grid-template-columns: 2fr 1fr;
          gap: 32px;
          margin-top: 36px;
        }
        @media (max-width: 900px) {
          .ngo-layout-grid {
            grid-template-columns: 1fr;
          }
        }

        .ngo-card-panel {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 30px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          margin-bottom: 24px;
        }
        .ngo-panel-header {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 18px;
          padding-bottom: 14px;
          border-bottom: 1px solid #f3f4f6;
        }
        .ngo-panel-title {
          font-family: 'Marcellus', Georgia, serif;
          font-size: 1.25rem;
          font-weight: 700;
          color: #0c1333;
          margin: 0;
        }
        .ngo-panel-text {
          font-size: 0.95rem;
          color: #374151;
          line-height: 1.7;
        }

        /* ── Tag Grid ── */
        .ngo-tags-wrap {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
        }
        .ngo-service-tag {
          background: #f0fdf4;
          color: #0A3622;
          border: 1px solid #bbf7d0;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 6px;
        }
        .ngo-focus-tag {
          background: #f8fafc;
          color: #334155;
          border: 1px solid #e2e8f0;
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
        }

        /* ── Sidebar Cards ── */
        .ngo-sidebar-card {
          background: #ffffff;
          border: 1px solid #e5e7eb;
          border-radius: 10px;
          padding: 24px;
          box-shadow: 0 1px 4px rgba(0, 0, 0, 0.04);
          margin-bottom: 24px;
        }
        .ngo-status-indicator {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 6px;
          font-size: 0.85rem;
          font-weight: 600;
          margin-bottom: 18px;
        }
        .ngo-status-indicator.accepting {
          background: #ecfdf5;
          color: #065f46;
          border: 1px solid #a7f3d0;
        }
        .ngo-status-indicator.busy {
          background: #fefce8;
          color: #854d0e;
          border: 1px solid #fef08a;
        }

        .ngo-contact-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .ngo-contact-list li {
          display: flex;
          align-items: flex-start;
          gap: 12px;
          margin-bottom: 14px;
          font-size: 0.88rem;
          color: #4b5563;
          line-height: 1.4;
        }
        .ngo-contact-list li:last-child {
          margin-bottom: 0;
        }

        /* ── Modal Dialog ── */
        .ngo-modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(12, 19, 51, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2000;
          padding: 20px;
        }
        .ngo-modal-content {
          background: #ffffff;
          border-radius: 12px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
          width: 100%;
          max-width: 580px;
          overflow: hidden;
          animation: modalFade 0.25s ease;
        }
        @keyframes modalFade {
          from { opacity: 0; transform: scale(0.96); }
          to { opacity: 1; transform: scale(1); }
        }
        .ngo-modal-header {
          padding: 22px 28px;
          border-bottom: 1px solid #e5e7eb;
          display: flex;
          justify-content: space-between;
          align-items: center;
          background: #f8f9fa;
        }
        .ngo-modal-title {
          font-family: 'Marcellus', Georgia, serif;
          font-size: 1.3rem;
          color: #0c1333;
          margin: 0;
        }
        .ngo-modal-close {
          background: none;
          border: none;
          font-size: 20px;
          color: #6b7280;
          cursor: pointer;
        }
        .ngo-modal-body {
          padding: 28px;
        }
        .ngo-modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 12px;
          margin-top: 24px;
        }

        /* 3D Animations & Transitions */
        .ngo-card-panel, .ngo-sidebar-card {
          transition: transform 0.35s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.35s ease, border-color 0.3s ease;
          border-radius: 18px !important;
        }
        .ngo-card-panel:hover, .ngo-sidebar-card:hover {
          transform: translateY(-5px);
          box-shadow: var(--ll-shadow-3d-hover) !important;
          border-color: var(--ll-brand-gold) !important;
        }

        /* Dark Theme Support */
        html.dark .ngo-prof-wrapper, [data-theme="dark"] .ngo-prof-wrapper {
          background-color: var(--ll-bg-page) !important;
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-prof-hero, [data-theme="dark"] .ngo-prof-hero {
          background: var(--ll-bg-surface) !important;
          border-color: var(--ll-border) !important;
        }
        html.dark .ngo-card-panel, [data-theme="dark"] .ngo-card-panel,
        html.dark .ngo-sidebar-card, [data-theme="dark"] .ngo-sidebar-card {
          background: var(--ll-bg-card) !important;
          border-color: var(--ll-border) !important;
          box-shadow: var(--ll-shadow-3d) !important;
        }
        html.dark .ngo-prof-name, [data-theme="dark"] .ngo-prof-name,
        html.dark .ngo-panel-title, [data-theme="dark"] .ngo-panel-title {
          color: var(--ll-text-primary) !important;
        }
        html.dark .ngo-panel-text, [data-theme="dark"] .ngo-panel-text,
        html.dark .ngo-hero-meta, [data-theme="dark"] .ngo-hero-meta {
          color: var(--ll-text-secondary) !important;
        }
        html.dark .ngo-focus-tag, [data-theme="dark"] .ngo-focus-tag {
          background: var(--ll-bg-surface-elevated) !important;
          border-color: var(--ll-border) !important;
          color: var(--ll-text-secondary) !important;
        }
        html.dark .ngo-modal-content, [data-theme="dark"] .ngo-modal-content {
          background: var(--ll-bg-surface) !important;
          border-color: var(--ll-border) !important;
          color: var(--ll-text-primary) !important;
        }
        html.dark input, html.dark textarea, html.dark select,
        [data-theme="dark"] input, [data-theme="dark"] textarea, [data-theme="dark"] select {
          background-color: var(--ll-bg-input) !important;
          color: var(--ll-text-primary) !important;
          border-color: var(--ll-border) !important;
        }
      `}</style>

      <div className="cp-page pub-profile ngo-prof-wrapper">
        {/* ── Identity banner ── */}
        <section className="cp-hero is-compact cp-profile-hero ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <Link to="/ngos" className="pub-back"><ArrowLeft size={15} /> Legal aid directory</Link>
              <div className="cp-identity">
                <span className="cp-identity-photo">{ngoInitials}</span>
                <div className="cp-identity-text">
                  <span className="cp-chip"><ShieldCheck size={13} strokeWidth={2.2} /> Accredited legal aid organisation</span>
                  <h1 className="cp-hero-title"><span>{ngo.name}</span></h1>
                  <div className="cp-identity-meta">
                    {(ngo.city || ngo.province) && (
                      <span><MapPin size={14} /> {[ngo.city, ngo.province].filter(Boolean).join(", ")}</span>
                    )}
                    {ngo.registrationNumber && <span><Hash size={14} /> Reg. {ngo.registrationNumber}</span>}
                    {ngoReviewCount > 0 && (
                      <span><NgoStars value={ngoRating} size={13} /> {ngoRating.toFixed(1)} ({ngoReviewCount})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="cp-hero-side">
              {ngo.isAcceptingCases !== false ? (
                <button type="button" className="cp-btn-gold" onClick={openAidModal}>
                  Request free legal aid <ArrowRight size={16} />
                </button>
              ) : (
                <span className="cp-pill is-warn">Not accepting new requests</span>
              )}
            </div>
          </div>
        </section>

        <div className="cp-main">
          <section className="cp-stats" data-reveal aria-label="Organisation summary">
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Star size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Citizen rating</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{ngoReviewCount > 0 ? ngoRating.toFixed(1) : "—"}</span>
                <span className="cp-stat-note">{ngoReviewCount > 0 ? `${ngoReviewCount} ${ngoReviewCount === 1 ? "review" : "reviews"}` : "No reviews yet"}</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Scale size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Focus areas</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{(ngo.focusAreas || []).length}</span>
                <span className="cp-stat-note">{(ngo.focusAreas || [])[0] || "General legal aid"}</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><HeartHandshake size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Services</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{(ngo.servicesOffered || []).length}</span>
                <span className="cp-stat-note">All free of charge</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Inbox size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Intake</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value" style={{ fontSize: 22 }}>{ngo.isAcceptingCases !== false ? "Open" : "Paused"}</span>
                <span className="cp-stat-note">{ngo.isAcceptingCases !== false ? "Accepting requests" : "Check back later"}</span>
              </div>
            </div>
          </section>

          <div className="cp-layout">
            <div className="pub-col" data-reveal>
              <section className="cp-card cp-card-pad">
                <h2 className="cp-section-title" style={{ fontSize: 19 }}>About the organisation</h2>
                <p className="cp-bio">
                  {ngo.bio && ngo.bio.length > 3
                    ? ngo.bio
                    : `${ngo.name} is an accredited legal aid organisation providing free legal help to people who can't afford a lawyer.`}
                </p>
                {(ngo.focusAreas || []).length > 0 && (
                  <>
                    <span className="cp-subhead">Legal focus areas</span>
                    <div className="cp-chips">
                      {ngo.focusAreas.map((area) => <span key={area} className="cp-chip-soft">{area}</span>)}
                    </div>
                  </>
                )}
                {(ngo.servicesOffered || []).length > 0 && (
                  <>
                    <span className="cp-subhead">Pro bono services</span>
                    <div className="cp-chips">
                      {ngo.servicesOffered.map((srv) => (
                        <span key={srv} className="cp-chip-outline pub-chip-check"><Check size={13} /> {srv}</span>
                      ))}
                    </div>
                  </>
                )}
              </section>

              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div>
                    <h2 className="cp-section-title" style={{ fontSize: 19 }}>Citizen reviews</h2>
                    <span className="cp-section-sub">Only citizens whose pro bono matter was resolved can leave a review</span>
                  </div>
                  {reviews.length > 1 && (
                    <div className="cp-seg" role="tablist" aria-label="Sort reviews">
                      {[["recent", "Recent"], ["highest", "Highest"], ["lowest", "Lowest"]].map(([key, label]) => (
                        <button key={key} type="button" className={`cp-seg-btn${reviewsSort === key ? " is-active" : ""}`} onClick={() => handleSortChange(key)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cp-reviews-summary">
                  <div className="cp-score">
                    <span className="cp-score-value">{ngoReviewCount > 0 ? ngoRating.toFixed(1) : "—"}</span>
                    <NgoStars value={ngoRating} size={17} />
                    <span className="cp-score-sub">{ngoReviewCount > 0 ? `Based on ${ngoReviewCount} ${ngoReviewCount === 1 ? "review" : "reviews"}` : "No reviews yet"}</span>
                  </div>
                  <div className="cp-bars">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const count = starDistribution[n] || 0;
                      const pct = ngoReviewCount > 0 ? Math.round((count / ngoReviewCount) * 100) : 0;
                      return (
                        <div className="cp-bar-row" key={n}>
                          <span>{n} <Star size={11} fill="#D4AF37" color="#C9A24B" /></span>
                          <span className="cp-bar-track"><span className="cp-bar-fill" style={{ width: `${pct}%`, display: "block" }} /></span>
                          <span>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {reviewsLoading ? (
                  <div aria-busy="true">
                    <div className="cp-skeleton-row" style={{ margin: "8px 0" }} />
                    <div className="cp-skeleton-row" style={{ margin: "8px 0", width: "70%" }} />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="cp-empty" style={{ padding: "28px 20px" }}>
                    <span className="cp-empty-icon"><MessageSquare size={24} strokeWidth={1.8} /></span>
                    <strong>No citizen reviews yet</strong>
                    <p>Reviews appear here once a citizen's pro bono matter with this organisation is resolved.</p>
                  </div>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
                    {reviews.map((rev) => {
                      const clientName = rev.userId?.name || "Verified citizen";
                      const isOwnNgo = user?.role === "ngo" && (String(user?.id) === String(ngo?._id) || String(user?._id) === String(ngo?._id));
                      const hasReply = rev.reply && rev.reply.comment && rev.reply.comment.trim();
                      const isReplying = replyingReviewId === rev._id;
                      return (
                        <article key={rev._id} className="cp-review">
                          <div className="cp-review-top">
                            <div className="cp-review-who">
                              <span className="cp-client-avatar">{clientName.charAt(0).toUpperCase()}</span>
                              <div>
                                <span className="cp-review-name">{clientName}</span>
                                <span className="cp-verified"><ShieldCheck size={11} /> Verified citizen</span>
                                <div className="cp-review-date">
                                  {fmtDate(rev.createdAt)}
                                  {rev.isEdited && " · edited"}
                                  {rev.caseId?.title && ` · ${rev.caseId.title}`}
                                </div>
                              </div>
                            </div>
                            <span style={{ display: "inline-flex", alignItems: "center", gap: 10 }}>
                              <NgoStars value={rev.rating} size={14} />
                              <button type="button" className="pub-report" title="Report this review" onClick={() => { setReportModalReview(rev); setReportReason(""); }}>
                                <Flag size={13} /> Report
                              </button>
                            </span>
                          </div>
                          <p className="cp-review-text">{rev.comment}</p>

                          {hasReply && (
                            <div className="cp-reply">
                              <div className="cp-reply-head">
                                <strong><Building2 size={14} /> Response from {rev.reply.authorName || ngo.name}</strong>
                                <span>{fmtDate(rev.reply.repliedAt)}</span>
                              </div>
                              <p>{rev.reply.comment}</p>
                            </div>
                          )}

                          {isOwnNgo && !hasReply && !isReplying && (
                            <div>
                              <button type="button" className="cp-btn-outline is-small" onClick={() => { setReplyingReviewId(rev._id); setReplyComment(""); }}>
                                <MessageSquare size={14} /> Reply publicly
                              </button>
                            </div>
                          )}

                          {isReplying && (
                            <div className="cp-reply-form">
                              <label className="cp-label" htmlFor={`reply-${rev._id}`}><CornerDownRight size={14} /> Public reply (can't be edited after publishing)</label>
                              <textarea id={`reply-${rev._id}`} className="cp-textarea" maxLength={1000} value={replyComment} onChange={(e) => setReplyComment(e.target.value)} placeholder={`Respond to ${clientName}'s feedback…`} />
                              <div className="cp-reply-actions">
                                <button type="button" className="cp-btn-outline is-small" onClick={() => { setReplyingReviewId(null); setReplyComment(""); }} disabled={submittingReply}>Cancel</button>
                                <button type="button" className="cp-btn-primary" onClick={() => handlePostReply(rev._id)} disabled={submittingReply || !replyComment.trim()}>
                                  {submittingReply ? <><span className="btn-spinner" />Publishing…</> : "Publish reply"}
                                </button>
                              </div>
                            </div>
                          )}
                        </article>
                      );
                    })}
                  </div>
                )}
              </section>
            </div>

            <aside className="cp-aside" data-reveal>
              <section className="cp-card cp-card-pad pub-hire">
                <h2 className="cp-card-title">Get free legal aid</h2>
                <span className={`cp-pill ${ngo.isAcceptingCases !== false ? "is-ok" : "is-warn"}`} style={{ alignSelf: "flex-start" }}>
                  {ngo.isAcceptingCases !== false ? "Accepting new requests" : "Intake paused"}
                </span>
                <p className="pub-note">
                  {ngo.isAcceptingCases !== false
                    ? <>Describe your situation and the organisation will review it. <strong>Pro bono help is free.</strong></>
                    : "This organisation isn't taking new requests right now. Try another organisation in the directory."}
                </p>
                <div className="pub-hire-action">
                  {ngo.isAcceptingCases !== false ? (
                    <button type="button" className="cp-btn-gold" onClick={openAidModal}>
                      {isAuthenticated && user?.role === "user" ? "Request free legal aid" : "Log in to request aid"} <ArrowRight size={16} />
                    </button>
                  ) : (
                    <Link to="/ngos" className="cp-btn-outline is-small" style={{ justifyContent: "center" }}>Browse other organisations</Link>
                  )}
                </div>
              </section>

              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Secretariat &amp; contact</h2>
                <dl className="cp-dl">
                  <div className="cp-dl-row"><dt>Address</dt><dd>{ngo.address || [ngo.city, ngo.province].filter(Boolean).join(", ") || "Not listed"}</dd></div>
                  <div className="cp-dl-row"><dt>Hours</dt><dd>{ngo.operatingHours || "Not listed"}</dd></div>
                  <div className="cp-dl-row"><dt>Phone</dt><dd>{ngo.phone || "Not listed"}</dd></div>
                  {ngo.email && <div className="cp-dl-row"><dt>Email</dt><dd>{ngo.email}</dd></div>}
                  {ngo.website && (
                    <div className="cp-dl-row">
                      <dt>Website</dt>
                      <dd><a className="pub-link" href={ngo.website.startsWith("http") ? ngo.website : `https://${ngo.website}`} target="_blank" rel="noreferrer">Visit website</a></dd>
                    </div>
                  )}
                </dl>
              </section>

              {ngo.focalPerson?.name && (
                <section className="cp-card cp-card-pad">
                  <h2 className="cp-card-title">Focal person</h2>
                  <div className="cp-review-who">
                    <span className="cp-client-avatar">{ngo.focalPerson.name.charAt(0).toUpperCase()}</span>
                    <div>
                      <span className="cp-review-name">{ngo.focalPerson.name}</span>
                      <div className="cp-review-date">{ngo.focalPerson.designation || "Authorised focal person"}</div>
                    </div>
                  </div>
                  <p className="pub-note" style={{ margin: 0 }}>Coordinates intake, court notifications and client onboarding.</p>
                </section>
              )}
            </aside>
          </div>
        </div>

        {/* ── Case Application Modal ── */}
        {showModal && (
          <div className="ngo-modal-backdrop" onClick={() => setShowModal(false)}>
            <div
              className="ngo-modal-content"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ngo-modal-header">
                <h3 className="ngo-modal-title">Request Pro Bono Legal Aid</h3>
                <button
                  type="button"
                  className="ngo-modal-close"
                  onClick={() => setShowModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="ngo-modal-body">
                {aidSuccess ? (
                  <div style={{ textAlign: "center", padding: "24px 10px" }}>
                    <div style={{ fontSize: "48px", color: "#059669", marginBottom: 12 }}>✓</div>
                    <h4 style={{ fontFamily: "Marcellus, Georgia, serif", fontSize: "1.4rem", color: "#0c1333", marginBottom: 8 }}>
                      Legal Aid Request Dispatched
                    </h4>
                    <p style={{ fontSize: "0.9rem", color: "#4b5563", lineHeight: 1.5, marginBottom: 20 }}>
                      Your case matter has been submitted to <strong>{ngo.name}</strong> for intake evaluation. You can monitor progress and communicate with the legal team via your Citizen Dashboard.
                    </p>
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <button
                        type="button"
                        className="ngo-aid-btn"
                        style={{ width: "100%", justifyContent: "center" }}
                        onClick={() => {
                          setShowModal(false);
                          navigate("/user/dashboard");
                        }}
                      >
                        Track Case in Citizen Dashboard →
                      </button>
                      <button
                        type="button"
                        style={{
                          background: "#ffffff",
                          border: "1px solid #d1d5db",
                          color: "#374151",
                          padding: "9px 18px",
                          borderRadius: "6px",
                          fontWeight: 500,
                          cursor: "pointer"
                        }}
                        onClick={() => setShowModal(false)}
                      >
                        Close & Stay on Profile
                      </button>
                    </div>
                  </div>
                ) : (
                  <form onSubmit={handleAidSubmit}>
                    {aidError && (
                      <div
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          color: "#991b1b",
                          padding: "10px 14px",
                          borderRadius: "6px",
                          fontSize: "0.85rem",
                          marginBottom: "16px",
                        }}
                      >
                        {aidError}
                      </div>
                    )}

                    <div style={{ marginBottom: 16 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: 6,
                        }}
                      >
                        Case / Subject Matter Title *
                      </label>
                      <input
                        type="text"
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          fontSize: "0.9rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        placeholder="e.g. Unlawful Termination Defense / Domestic Violence Custody"
                        value={aidForm.title}
                        onChange={(e) =>
                          setAidForm({ ...aidForm, title: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div style={{ marginBottom: 16 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: 6,
                        }}
                      >
                        Legal Category *
                      </label>
                      <select
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          fontSize: "0.9rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          outline: "none",
                          background: "#ffffff",
                          boxSizing: "border-box",
                        }}
                        value={aidForm.category}
                        onChange={(e) =>
                          setAidForm({ ...aidForm, category: e.target.value })
                        }
                        required
                      >
                        <option value="">Select Category</option>
                        {CATEGORIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div style={{ marginBottom: 20 }}>
                      <label
                        style={{
                          display: "block",
                          fontSize: "0.82rem",
                          fontWeight: 600,
                          color: "#374151",
                          marginBottom: 6,
                        }}
                      >
                        Summary of Case Facts & Requested Assistance *
                      </label>
                      <textarea
                        rows={4}
                        style={{
                          width: "100%",
                          padding: "10px 12px",
                          fontSize: "0.9rem",
                          border: "1px solid #d1d5db",
                          borderRadius: "6px",
                          outline: "none",
                          boxSizing: "border-box",
                        }}
                        placeholder="Please summarize the dates, opposing party, current legal/court status, and specific aid required (e.g. court representation, mediation, drafting)..."
                        value={aidForm.description}
                        onChange={(e) =>
                          setAidForm({ ...aidForm, description: e.target.value })
                        }
                        required
                      />
                    </div>

                    <div className="ngo-modal-footer">
                      <button
                        type="button"
                        style={{
                          background: "#ffffff",
                          border: "1px solid #d1d5db",
                          color: "#374151",
                          padding: "9px 18px",
                          borderRadius: "6px",
                          fontSize: "0.88rem",
                          fontWeight: 600,
                          cursor: "pointer",
                        }}
                        onClick={() => setShowModal(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="ngo-aid-btn"
                        style={{ padding: "9px 22px" }}
                        disabled={submitting}
                      >
                        {submitting ? <><span className="btn-spinner" />Sending request…</> : "Submit Case Request"}
                      </button>
                    </div>
                  </form>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Report Review Modal (FR_18) ── */}
        {reportModalReview && (
          <div className="ngo-modal-backdrop" onClick={() => setReportModalReview(null)}>
            <div
              className="ngo-modal-content"
              style={{ maxWidth: "460px" }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="ngo-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Flag size={18} color="#DC2626" />
                  <h3 className="ngo-modal-title">Report Community Review</h3>
                </div>
                <button
                  type="button"
                  className="ngo-modal-close"
                  onClick={() => setReportModalReview(null)}
                >
                  ✕
                </button>
              </div>

              <div className="ngo-modal-body">
                <p style={{ fontSize: "0.85rem", color: "#6B7280", lineHeight: 1.5, marginBottom: "16px" }}>
                  Flag this review if it contains false allegations, spam, offensive language, or violates community standards. An administrator will review and moderate it.
                </p>

                <form onSubmit={handleReportReview}>
                  <div style={{ marginBottom: "18px" }}>
                    <label
                      style={{
                        display: "block",
                        fontSize: "0.82rem",
                        fontWeight: 600,
                        color: "#374151",
                        marginBottom: "6px"
                      }}
                    >
                      Reason for Reporting *
                    </label>
                    <textarea
                      rows={3}
                      required
                      placeholder="Describe why this review should be moderated..."
                      value={reportReason}
                      onChange={(e) => setReportReason(e.target.value)}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        fontSize: "0.9rem",
                        border: "1px solid #D1D5DB",
                        borderRadius: "6px",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div className="ngo-modal-footer" style={{ marginTop: 0 }}>
                    <button
                      type="button"
                      style={{
                        background: "#FFFFFF",
                        border: "1px solid #D1D5DB",
                        color: "#374151",
                        padding: "9px 18px",
                        borderRadius: "6px",
                        fontSize: "0.88rem",
                        fontWeight: 600,
                        cursor: "pointer"
                      }}
                      onClick={() => setReportModalReview(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={reportingReview}
                      style={{
                        background: "#DC2626",
                        border: "none",
                        color: "#FFFFFF",
                        padding: "9px 20px",
                        borderRadius: "6px",
                        fontSize: "0.88rem",
                        fontWeight: 700,
                        cursor: "pointer",
                        opacity: reportingReview ? 0.7 : 1
                      }}
                    >
                      {reportingReview ? <><span className="btn-spinner" />Submitting…</> : "Submit Report"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          </div>
        )}
      </div>
      <Footer />
    </>
  );
};

export default NGOProfilePage;
