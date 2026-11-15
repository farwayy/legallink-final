import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { ProfilePageSkeleton } from '../components/ui/Skeleton';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { userAPI, subscriptionAPI, reviewAPI, requestAPI } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { 
  Star, 
  Flag, 
  ShieldCheck, 
  Scale, 
  MessageSquare, 
  CornerDownRight, 
  Info, 
  Clock, 
  CheckCircle2, 
  Check,
  ArrowRight,
  ArrowLeft,
  MapPin,
  Briefcase,
  Languages,
  Lock
} from 'lucide-react';
import '../styles/counselPortal.css';
import PaymentCheckout from '../components/PaymentCheckout';
import { notify } from '../components/Toast';
import { API_ORIGIN } from "../config";

const LawyerProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { isAuthenticated, user } = useAuth();
  const { isDark } = useTheme();
  const [lawyer, setLawyer] = useState(null);
  const [loading, setLoading] = useState(true);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [showDemoCheckout, setShowDemoCheckout] = useState(false);
  const [checkoutPackage, setCheckoutPackage] = useState('gold');
  const [hasAccess, setHasAccess] = useState(false);
  const [activeSubscription, setActiveSubscription] = useState(null);

  // Representation Inquiry State (Pay-After-Acceptance Architecture)
  const [showInquiryModal, setShowInquiryModal] = useState(false);
  const [inquiryPackage, setInquiryPackage] = useState('gold'); // 'gold' | 'platinum'
  const [inquiryTitle, setInquiryTitle] = useState('');
  const [inquiryCategory, setInquiryCategory] = useState('Civil Litigation');
  const [inquiryDescription, setInquiryDescription] = useState('');
  const [submittingInquiry, setSubmittingInquiry] = useState(false);
  const [inquiryToast, setInquiryToast] = useState({ show: false, message: '', type: 'success' });
  const [existingInquiry, setExistingInquiry] = useState(null);

  // Reviews State (FR_18)
  const [reviews, setReviews] = useState([]);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const [reviewsSort, setReviewsSort] = useState("recent"); // recent | highest | lowest
  const [starDistribution, setStarDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [totalReviewCount, setTotalReviewCount] = useState(0);
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyComment, setReplyComment] = useState("");
  const [submittingReply, setSubmittingReply] = useState(false);
  const [reportModalReview, setReportModalReview] = useState(null);
  const [reportReason, setReportReason] = useState("");
  const [reportingReview, setReportingReview] = useState(false);

  useEffect(() => {
    fetchLawyerProfile();
    checkExistingSubscription();
    checkExistingInquiries();
    fetchReviews("recent");
  }, [id, isAuthenticated]);

  const checkExistingInquiries = async () => {
    if (!isAuthenticated || user?.role !== 'user') return;
    try {
      const res = await requestAPI.getMyRequests();
      const requests = res.data?.requests || [];
      const match = requests.find(r => 
        (String(r.lawyerId?._id || r.lawyerId) === String(id)) && 
        ['pending', 'accepted_awaiting_payment'].includes(r.status)
      );
      if (match) {
        setExistingInquiry(match);
      }
    } catch (err) {
      console.warn("Error checking existing inquiries:", err);
    }
  };

  const fetchReviews = async (sortOrder = reviewsSort) => {
    try {
      setReviewsLoading(true);
      const res = await reviewAPI.getLawyerReviews(id, { sort: sortOrder });
      setReviews(res.data?.reviews || []);
      if (res.data?.starDistribution) {
        setStarDistribution(res.data.starDistribution);
      }
      if (typeof res.data?.count === 'number') {
        setTotalReviewCount(res.data.count);
      }
    } catch (error) {
      console.error('Error fetching lawyer reviews:', error);
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
      setReviews(prev => prev.map(r => r._id === reviewId ? { ...r, reply: updatedReview?.reply || { comment: replyComment.trim(), repliedAt: new Date(), authorName: lawyer?.name || 'Advocate', authorRole: 'lawyer' } } : r));
      setReplyingReviewId(null);
      setReplyComment("");
      notify("Your reply is now public on your profile.", "success");
    } catch (err) {
      console.error("Error posting review reply:", err);
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
      fetchLawyerProfile();
    } catch (err) {
      console.error("Error reporting review:", err);
      notify(err.response?.data?.message || "Couldn't send the report. Please try again.", "error");
    } finally {
      setReportingReview(false);
    }
  };

  const fetchLawyerProfile = async () => {
    try {
      const response = await userAPI.getLawyerById(id);
      setLawyer(response.data);
    } catch (error) {
      console.error('Error fetching lawyer:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitInquiry = async (e) => {
    e.preventDefault();
    if (!inquiryTitle.trim() || !inquiryDescription.trim()) {
      notify("Add a title and a short description of your matter.", "error");
      return;
    }

    setSubmittingInquiry(true);
    try {
      const pkg = inquiryPackage || 'gold';
      const fee = pkg === 'platinum' ? 45000 : 25000;

      const res = await requestAPI.sendRequest({
        lawyerId: lawyer._id,
        packageType: pkg,
        amount: fee,
        title: inquiryTitle.trim(),
        description: inquiryDescription.trim(),
        category: inquiryCategory
      });

      if (res.data?.success) {
        setShowInquiryModal(false);
        setInquiryTitle('');
        setInquiryDescription('');
        setExistingInquiry(res.data.request || { status: 'pending', packageType: pkg, amount: fee });
        setInquiryToast({
          show: true,
          message: `Your representation inquiry has been sent to Advocate ${lawyer.name}! Counsel will review your matter. Zero upfront payment required today.`,
          type: 'success'
        });
        setTimeout(() => {
          setInquiryToast({ show: false, message: '', type: 'success' });
        }, 6000);
      }
    } catch (err) {
      console.error("Error submitting representation inquiry:", err);
      notify(err.response?.data?.message || "Couldn't send your inquiry. Please try again.", "error");
    } finally {
      setSubmittingInquiry(false);
    }
  };

  const checkExistingSubscription = async () => {
    if (!isAuthenticated || user?.role !== 'user') return;

    try {
      const response = await subscriptionAPI.checkAccess(id);
      if (response.data.hasAccess) {
        setHasAccess(true);
        setActiveSubscription(response.data.subscription);
      }
    } catch (error) {
      console.error('Error checking subscription:', error);
    }
  };

  const handleViewProfile = () => {
    if (!isAuthenticated) {
      navigate('/user/login');
    } else if (existingInquiry?.status === 'accepted_awaiting_payment') {
      setCheckoutPackage(existingInquiry.packageType || 'gold');
      setShowDemoCheckout(true);
    } else if (existingInquiry?.status === 'pending') {
      notify(`${lawyer?.name || 'The advocate'} is still reviewing your inquiry. Nothing has been charged, and we'll notify you when they reply.`, "info");
    } else if (!hasAccess) {
      setShowInquiryModal(true);
    }
  };

  const handleSelectPackage = (pkg) => {
    setInquiryPackage(pkg);
    setShowPaymentModal(false);
    setShowInquiryModal(true);
  };

  const handleDemoPaymentSuccess = async (paymentData) => {
    try {
      if (existingInquiry && existingInquiry.status === 'accepted_awaiting_payment') {
        const res = await requestAPI.completePayment(existingInquiry._id, {
          transactionId: paymentData.transactionId,
          paymentMethod: 'demo'
        });
        if (res.data?.success && res.data?.caseId) {
          setShowDemoCheckout(false);
          navigate(`/case/${res.data.caseId}`);
          return;
        }
      }

      // Fallback direct subscription creation
      const response = await subscriptionAPI.createSubscription({
        lawyerId: id,
        packageType: paymentData.packageType,
        amount: paymentData.amount,
        transactionId: paymentData.transactionId,
        paymentMethod: 'demo',
        paymentStatus: 'completed'
      });

      if (response.data.success) {
        setHasAccess(true);
        setCheckoutPackage(paymentData.packageType);
        setActiveSubscription(response.data.subscription);
        setShowDemoCheckout(false);
        setShowPaymentModal(false);
      }
    } catch (error) {
      console.error('Demo payment error:', error);
      notify(error.response?.data?.message || 'The payment didn\'t go through. Please try again.', 'error');
    }
  };

  const closeModal = () => {
    setShowPaymentModal(false);
    setShowInquiryModal(false);
  };

  const getPhotoUrl = (photoPath) => {
    if (!photoPath) return null;
    if (photoPath.startsWith('http')) return photoPath;
    return `${API_ORIGIN}${photoPath}`;
  };

  const formatPhoneForWhatsApp = (phone) => {
    if (!phone) return '#';
    return phone.replace(/\D/g, '');
  };

  if (loading) return (
    <div className="ll-user-page">
      <Navbar />
      <ProfilePageSkeleton />
    </div>
  );

  if (!lawyer) return (
    <div className="ll-user-page">
      <Navbar />
      <div className="container text-center py-5">
        <h2>Advocate Not Found</h2>
        <Link to="/lawyers" className="ll-btn-3d ll-btn-3d-primary mt-3">Browse Advocates</Link>
      </div>
      <Footer />
    </div>
  );

  const reviewCount = totalReviewCount || reviews.length;
  const ratingValue = reviewCount > 0
    ? (lawyer.rating ? Number(lawyer.rating) : reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length)
    : 0;
  const initials = (lawyer.name || 'A').replace(/^adv(ocate)?\.?\s+/i, '').split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase();
  const displayName = (lawyer.name || '').replace(/^adv(ocate)?\.?\s+/i, '');
  const photo = getPhotoUrl(lawyer.photo);
  const fmt = (d) => d ? new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' }) : '';
  const Stars = ({ value, size = 14 }) => (
    <span className="cp-stars" aria-label={`${value} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star key={s} size={size} fill={s <= Math.round(value) ? '#D4AF37' : 'none'} color={s <= Math.round(value) ? '#C9A24B' : '#94A3B8'} strokeWidth={1.8} />
      ))}
    </span>
  );

  // Hire / retainer action shown in the banner and the side card
  const renderHireAction = (compact = false) => {
    if (hasAccess) {
      return (
        <span className="cp-pill is-ok"><CheckCircle2 size={14} /> {activeSubscription?.packageType ? `${activeSubscription.packageType.charAt(0).toUpperCase()}${activeSubscription.packageType.slice(1)} retainer active` : 'Retainer active'}</span>
      );
    }
    if (existingInquiry?.status === 'pending') {
      return <span className="cp-pill is-warn"><Clock size={14} /> Inquiry under review</span>;
    }
    if (existingInquiry?.status === 'accepted_awaiting_payment') {
      return (
        <button type="button" className="cp-btn-gold" onClick={() => { setCheckoutPackage(existingInquiry.packageType || 'gold'); setShowDemoCheckout(true); }}>
          Pay PKR {Number(existingInquiry.amount || 25000).toLocaleString()} &amp; open case <ArrowRight size={16} />
        </button>
      );
    }
    return (
      <button type="button" className="cp-btn-gold" onClick={handleViewProfile}>
        {isAuthenticated ? (compact ? 'Request representation' : `Request ${displayName}`) : 'Log in to hire'} <ArrowRight size={16} />
      </button>
    );
  };

  return (
    <>
      <Navbar />
      <div className="cp-page pub-profile">
        {inquiryToast.show && (
          <div className="cp-toast" role="status">
            <CheckCircle2 size={18} />
            <span>{inquiryToast.message}</span>
          </div>
        )}

        {/* ── Identity banner ── */}
        <section className="cp-hero is-compact cp-profile-hero ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <Link to="/lawyers" className="pub-back"><ArrowLeft size={15} /> All advocates</Link>
              <div className="cp-identity">
                <span className="cp-identity-photo">
                  {photo ? <img src={photo} alt={lawyer.name} /> : initials}
                </span>
                <div className="cp-identity-text">
                  <span className="cp-chip"><ShieldCheck size={13} strokeWidth={2.2} /> Bar Council verified advocate</span>
                  <h1 className="cp-hero-title">Adv. <span>{displayName}</span></h1>
                  <div className="cp-identity-meta">
                    <span><MapPin size={14} /> {lawyer.location || 'Pakistan'}</span>
                    <span><Briefcase size={14} /> {lawyer.experience || 0}+ years in practice</span>
                    {reviewCount > 0 && (
                      <span><Stars value={ratingValue} size={13} /> {ratingValue.toFixed(1)} ({reviewCount})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
            <div className="cp-hero-side">{renderHireAction()}</div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Figures ── */}
          <section className="cp-stats" data-reveal aria-label="Advocate summary">
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Briefcase size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Experience</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{lawyer.experience || 0}+</span>
                <span className="cp-stat-note">Years in practice</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Scale size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Matters handled</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{lawyer.totalCases || 0}</span>
                <span className="cp-stat-note">On LegalLink</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Star size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Client rating</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{reviewCount > 0 ? ratingValue.toFixed(1) : '—'}</span>
                <span className="cp-stat-note">{reviewCount > 0 ? `${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</span>
              </div>
            </div>
            <div className="cp-stat">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Languages size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Practice areas</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{lawyer.specialization?.length || 0}</span>
                <span className="cp-stat-note">{lawyer.specialization?.[0] || 'General practice'}</span>
              </div>
            </div>
          </section>

          <div className="cp-layout">
            <div className="pub-col" data-reveal>
              {/* About */}
              <section className="cp-card cp-card-pad">
                <h2 className="cp-section-title" style={{ fontSize: 19 }}>About</h2>
                <p className="cp-bio">
                  {lawyer.bio && lawyer.bio.length > 3
                    ? lawyer.bio
                    : `Adv. ${displayName} is a Bar Council–verified advocate with ${lawyer.experience || 0}+ years of practice${lawyer.specialization?.length ? ` in ${lawyer.specialization.join(', ')}` : ''}.`}
                </p>
                {lawyer.specialization?.length > 0 && (
                  <>
                    <span className="cp-subhead">Practice areas</span>
                    <div className="cp-chips">
                      {lawyer.specialization.map((spec) => (
                        <span key={spec} className="cp-chip-soft">{spec}</span>
                      ))}
                    </div>
                  </>
                )}
              </section>

              {/* Reviews */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div>
                    <h2 className="cp-section-title" style={{ fontSize: 19 }}>Client reviews</h2>
                    <span className="cp-section-sub">Only citizens whose case was resolved can leave a review</span>
                  </div>
                  {reviews.length > 1 && (
                    <div className="cp-seg" role="tablist" aria-label="Sort reviews">
                      {[['recent', 'Recent'], ['highest', 'Highest'], ['lowest', 'Lowest']].map(([key, label]) => (
                        <button key={key} type="button" className={`cp-seg-btn${reviewsSort === key ? ' is-active' : ''}`} onClick={() => handleSortChange(key)}>
                          {label}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className="cp-reviews-summary">
                  <div className="cp-score">
                    <span className="cp-score-value">{reviewCount > 0 ? ratingValue.toFixed(1) : '—'}</span>
                    <Stars value={ratingValue} size={17} />
                    <span className="cp-score-sub">{reviewCount > 0 ? `Based on ${reviewCount} ${reviewCount === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}</span>
                  </div>
                  <div className="cp-bars">
                    {[5, 4, 3, 2, 1].map((n) => {
                      const count = starDistribution[n] || 0;
                      const pct = reviewCount > 0 ? Math.round((count / reviewCount) * 100) : 0;
                      return (
                        <div className="cp-bar-row" key={n}>
                          <span>{n} <Star size={11} fill="#D4AF37" color="#C9A24B" /></span>
                          <span className="cp-bar-track"><span className="cp-bar-fill" style={{ width: `${pct}%`, display: 'block' }} /></span>
                          <span>{count}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {reviewsLoading ? (
                  <div aria-busy="true">
                    <div className="cp-skeleton-row" style={{ margin: '8px 0' }} />
                    <div className="cp-skeleton-row" style={{ margin: '8px 0', width: '70%' }} />
                  </div>
                ) : reviews.length === 0 ? (
                  <div className="cp-empty" style={{ padding: '28px 20px' }}>
                    <span className="cp-empty-icon"><MessageSquare size={24} strokeWidth={1.8} /></span>
                    <strong>No client reviews yet</strong>
                    <p>Reviews appear here once a citizen's case with this advocate is resolved.</p>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {reviews.map((rev) => {
                      const clientName = rev.userId?.name || 'Verified citizen';
                      const isOwnLawyer = user?.role === 'lawyer' && (user?.id === lawyer?._id || user?._id === lawyer?._id);
                      const hasReply = rev.reply && rev.reply.comment && rev.reply.comment.trim();
                      const isReplying = replyingReviewId === rev._id;
                      return (
                        <article key={rev._id} className="cp-review">
                          <div className="cp-review-top">
                            <div className="cp-review-who">
                              <span className="cp-client-avatar">{clientName.charAt(0).toUpperCase()}</span>
                              <div>
                                <span className="cp-review-name">{clientName}</span>
                                <span className="cp-verified"><ShieldCheck size={11} /> Verified client</span>
                                <div className="cp-review-date">
                                  {fmt(rev.createdAt)}
                                  {rev.isEdited && ' · edited'}
                                  {rev.caseId?.title && ` · ${rev.caseId.title}`}
                                </div>
                              </div>
                            </div>
                            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 10 }}>
                              <Stars value={rev.rating} size={14} />
                              <button
                                type="button"
                                className="pub-report"
                                title="Report this review"
                                onClick={() => { setReportModalReview(rev); setReportReason(''); }}
                              >
                                <Flag size={13} /> Report
                              </button>
                            </span>
                          </div>
                          <p className="cp-review-text">{rev.comment}</p>

                          {hasReply && (
                            <div className="cp-reply">
                              <div className="cp-reply-head">
                                <strong><Scale size={14} /> Response from Adv. {(rev.reply.authorName || displayName).replace(/^adv(ocate)?\.?\s+/i, '')}</strong>
                                <span>{fmt(rev.reply.repliedAt)}</span>
                              </div>
                              <p>{rev.reply.comment}</p>
                            </div>
                          )}

                          {isOwnLawyer && !hasReply && !isReplying && (
                            <div>
                              <button type="button" className="cp-btn-outline is-small" onClick={() => { setReplyingReviewId(rev._id); setReplyComment(''); }}>
                                <MessageSquare size={14} /> Reply publicly
                              </button>
                            </div>
                          )}

                          {isReplying && (
                            <div className="cp-reply-form">
                              <label className="cp-label" htmlFor={`reply-${rev._id}`}><CornerDownRight size={14} /> Public reply (can't be edited after publishing)</label>
                              <textarea
                                id={`reply-${rev._id}`}
                                className="cp-textarea"
                                maxLength={1000}
                                value={replyComment}
                                onChange={(e) => setReplyComment(e.target.value)}
                                placeholder={`Respond to ${clientName}'s feedback…`}
                              />
                              <div className="cp-reply-actions">
                                <button type="button" className="cp-btn-outline is-small" onClick={() => { setReplyingReviewId(null); setReplyComment(''); }} disabled={submittingReply}>Cancel</button>
                                <button type="button" className="cp-btn-primary" onClick={() => handlePostReply(rev._id)} disabled={submittingReply || !replyComment.trim()}>
                                  {submittingReply ? <><span className="btn-spinner" />Publishing…</> : 'Publish reply'}
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
              {/* Hire card */}
              <section className="cp-card cp-card-pad pub-hire">
                <h2 className="cp-card-title">Work with this advocate</h2>
                {hasAccess ? (
                  <p className="pub-note">Your retainer is active. Contact details are unlocked below and your case is in your dashboard.</p>
                ) : existingInquiry?.status === 'pending' ? (
                  <p className="pub-note">
                    You sent a <strong className="is-cap">{(existingInquiry.packageType || 'gold')}</strong> inquiry on {fmt(existingInquiry.createdAt)}. Nothing is charged until the advocate accepts.
                  </p>
                ) : existingInquiry?.status === 'accepted_awaiting_payment' ? (
                  <p className="pub-note">
                    Adv. {displayName} accepted your <strong className="is-cap">{existingInquiry.packageType || 'gold'}</strong> inquiry. Pay to open your case.
                  </p>
                ) : (
                  <p className="pub-note">Describe your matter and the advocate will review it. <strong>You only pay if they accept.</strong></p>
                )}
                <div className="pub-hire-action">{renderHireAction(true)}</div>
                <ul className="pub-ticks">
                  <li><Check size={14} /> Bar Council verified</li>
                  <li><Check size={14} /> No upfront payment</li>
                  <li><Check size={14} /> Hearings &amp; documents in one place</li>
                </ul>
              </section>

              {/* Contact */}
              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Contact</h2>
                {!hasAccess && (
                  <p className="pub-locked"><Lock size={14} /> Unlocked once your retainer is active</p>
                )}
                <dl className="cp-dl">
                  <div className="cp-dl-row">
                    <dt>Phone / WhatsApp</dt>
                    <dd>
                      {hasAccess ? (
                        <a href={`https://wa.me/${formatPhoneForWhatsApp(lawyer.phone)}`} target="_blank" rel="noopener noreferrer" className="pub-link">{lawyer.phone}</a>
                      ) : <span className="pub-mask">•••• •••••••</span>}
                    </dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Email</dt>
                    <dd>{hasAccess ? lawyer.email : <span className="pub-mask">••••••@••••</span>}</dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Office</dt>
                    <dd>{hasAccess ? (lawyer.officeAddress || `${lawyer.location || ''}, Pakistan`) : <span className="pub-mask">•••••••••</span>}</dd>
                  </div>
                </dl>
              </section>

              {/* Credentials */}
              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Credentials</h2>
                <dl className="cp-dl">
                  <div className="cp-dl-row">
                    <dt>Bar Council ID</dt>
                    <dd className="is-mono">{hasAccess ? lawyer.barCouncilId : <span className="pub-mask">PBC-•••••</span>}</dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Verification</dt>
                    <dd><span className="cp-pill is-ok">Verified</span></dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Languages</dt>
                    <dd>{lawyer.languages?.length ? lawyer.languages.join(', ') : 'English, Urdu'}</dd>
                  </div>
                </dl>
              </section>
            </aside>
          </div>
        </div>
      </div>

      {/* Report Review Modal */}
      {reportModalReview && (
        <div className="payment-overlay">
          <div className="payment-modal" style={{ maxWidth: '440px' }}>
            <button className="close-btn" onClick={() => setReportModalReview(null)}>✕</button>
            <div className="d-flex align-items-center gap-2 mb-3">
              <Flag size={20} color="#DC2626" />
              <h4 className="fw-bold mb-0">Report Review</h4>
            </div>
            <p className="text-muted small mb-3">
              Flag this review if it contains inappropriate content, spam, or violates community guidelines. It will be submitted for administrative review.
            </p>
            <form onSubmit={handleReportReview}>
              <div className="mb-3">
                <label className="form-label small fw-bold">Reason for reporting *</label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Describe why this review should be moderated..."
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                />
              </div>
              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setReportModalReview(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-danger"
                  disabled={reportingReview}
                >
                  {reportingReview ? <><span className="btn-spinner" />Submitting…</> : 'Submit Report'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Choose Package Modal (Step 1 Selection) */}
      {showPaymentModal && !hasAccess && isAuthenticated && (
        <div className="payment-overlay" onClick={closeModal}>
          <div className="payment-modal" style={{ maxWidth: '560px' }} onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={closeModal}>✕</button>

            <div className="text-center mb-4">
              <span className="badge mb-2" style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '4px 12px', borderRadius: '50px', fontSize: '11.5px', fontWeight: 600 }}>
                Retainer Model • Zero Upfront Payment
              </span>
              <h2 className="fw-bold mb-1" style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontSize: '22px' }}>Choose Retainer Tier</h2>
              <p className="text-muted small mb-0">Select an engagement tier to submit your representation inquiry to Advocate {lawyer.name}.</p>
            </div>

            <div className="row g-3">
              <div className="col-md-6">
                <div 
                  className="package-card gold h-100 d-flex flex-column justify-content-between p-3" 
                  onClick={() => handleSelectPackage('gold')}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease' }}
                >
                  <div>
                    <h3 className="fw-bold mb-1" style={{ fontSize: '17px', color: isDark ? '#F8FAFC' : '#0F172A' }}>Gold Package</h3>
                    <div className="price my-2" style={{ fontSize: '20px', fontWeight: 800, color: '#C5A059' }}>PKR 25,000</div>
                    <ul className="list-unstyled text-start small mb-3" style={{ fontSize: '12px', lineHeight: '1.6', color: '#475569' }}>
                      <li>✓ Direct lawyer contact info</li>
                      <li>✓ Verified WhatsApp & phone</li>
                      <li>✓ File representation request</li>
                      <li>✓ 30-day inquiry access</li>
                    </ul>
                  </div>
                  <button className="btn-gold py-2" style={{ fontSize: '12.5px', fontWeight: 600 }}>
                    Select & Submit Inquiry
                  </button>
                </div>
              </div>

              <div className="col-md-6">
                <div 
                  className="package-card platinum h-100 d-flex flex-column justify-content-between p-3" 
                  onClick={() => handleSelectPackage('platinum')}
                  style={{ cursor: 'pointer', transition: 'all 0.2s ease', borderColor: '#C5A059' }}
                >
                  <div>
                    <h3 className="fw-bold mb-1" style={{ fontSize: '17px', color: isDark ? '#F8FAFC' : '#0F172A' }}>Platinum Package</h3>
                    <div className="price my-2" style={{ fontSize: '20px', fontWeight: 800, color: '#0A3622' }}>PKR 45,000</div>
                    <ul className="list-unstyled text-start small mb-3" style={{ fontSize: '12px', lineHeight: '1.6', color: '#475569' }}>
                      <li>✓ Priority legal representation</li>
                      <li>✓ Unlimited consultation notes</li>
                      <li>✓ Court calendar alerts</li>
                      <li>✓ Strategic legal analysis</li>
                    </ul>
                  </div>
                  <button className="btn-platinum py-2" style={{ fontSize: '12.5px', fontWeight: 600, backgroundColor: '#0A3622', color: '#FFFFFF' }}>
                    Select & Submit Inquiry
                  </button>
                </div>
              </div>
            </div>

            <p className="text-center text-muted small mt-3 mb-0" style={{ fontSize: '11.5px' }}>
              No payment required today. Counsel reviews and formally accepts your inquiry before payment is processed.
            </p>
          </div>
        </div>
      )}

      {/* Clean Submit Representation Inquiry Modal (Realistic Legal Flow) */}
      {showInquiryModal && isAuthenticated && (
        <div className="payment-overlay" onClick={() => setShowInquiryModal(false)}>
          <div 
            className="payment-modal" 
            style={{ maxWidth: '580px', width: '92%', maxHeight: '90vh', overflowY: 'auto' }}
            onClick={(e) => e.stopPropagation()}
          >
            <button className="close-btn" onClick={() => setShowInquiryModal(false)}>✕</button>

            {/* Header */}
            <div className="text-center mb-3">
              <span 
                className="badge mb-2" 
                style={{ backgroundColor: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0', padding: '4px 12px', borderRadius: '50px', fontSize: '11.5px', fontWeight: 600 }}
              >
                Zero Upfront Payment • Retainer Inquiry
              </span>
              <h3 className="fw-bold mb-1" style={{ color: isDark ? '#F8FAFC' : '#0F172A', fontSize: '22px' }}>
                Submit Representation Inquiry
              </h3>
              <p className="text-muted small mb-0">
                Inquire with <strong>Advocate {lawyer.name}</strong> for professional legal representation.
              </p>
            </div>

            {/* Package Selector Tabs */}
            <div className="row g-2 mb-3">
              <div className="col-6">
                <div
                  onClick={() => setInquiryPackage('gold')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: inquiryPackage === 'gold' ? '2px solid #C5A059' : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0'),
                    backgroundColor: inquiryPackage === 'gold' ? (isDark ? '#261D09' : '#FFFDF5') : (isDark ? '#111A27' : '#FFFFFF'),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: isDark ? '#F8FAFC' : '#0F172A' }}>Gold Package</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: '#C5A059', margin: '2px 0' }}>PKR 25,000</div>
                  <div style={{ fontSize: '11px', color: isDark ? '#94A3B8' : '#64748B' }}>Standard Retainer</div>
                </div>
              </div>
              <div className="col-6">
                <div
                  onClick={() => setInquiryPackage('platinum')}
                  style={{
                    padding: '12px',
                    borderRadius: '12px',
                    border: inquiryPackage === 'platinum' ? '2px solid #1E3F2E' : (isDark ? '1px solid rgba(255,255,255,0.1)' : '1px solid #E2E8F0'),
                    backgroundColor: inquiryPackage === 'platinum' ? (isDark ? '#052E16' : '#F0FDF4') : (isDark ? '#111A27' : '#FFFFFF'),
                    cursor: 'pointer',
                    transition: 'all 0.2s ease',
                    textAlign: 'center'
                  }}
                >
                  <div style={{ fontSize: '13px', fontWeight: 700, color: isDark ? '#F8FAFC' : '#0F172A' }}>Platinum Package</div>
                  <div style={{ fontSize: '16px', fontWeight: 800, color: isDark ? '#10B981' : '#1E3F2E', margin: '2px 0' }}>PKR 45,000</div>
                  <div style={{ fontSize: '11px', color: isDark ? '#94A3B8' : '#64748B' }}>Comprehensive Retainer</div>
                </div>
              </div>
            </div>

            {/* Package Features List */}
            <div 
              className="p-3 mb-3" 
              style={{ backgroundColor: isDark ? '#0D1520' : '#F8FAFC', borderRadius: '10px', border: isDark ? '1px solid rgba(255,255,255,0.08)' : '1px solid #E2E8F0' }}
            >
              <div style={{ fontSize: '11.5px', fontWeight: 700, color: isDark ? '#CBD5E1' : '#475569', textTransform: 'uppercase', marginBottom: '8px', letterSpacing: '0.5px' }}>
                {inquiryPackage === 'platinum' ? 'Platinum Tier Features:' : 'Gold Tier Features:'}
              </div>
              <ul className="list-unstyled mb-0" style={{ fontSize: '12.5px', color: isDark ? '#E2E8F0' : '#334155', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {inquiryPackage === 'platinum' ? (
                  <>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Priority formal representation rights & dedicated private docket</span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Comprehensive statutory analysis, written briefs & pleading preparation</span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Priority court calendar alerts, hearing logs & evidence tracking</span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Direct consultation & real-time counsel messaging thread</span>
                    </li>
                  </>
                ) : (
                  <>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Official representation rights & dedicated private case docket</span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Direct counsel consultation & case thread messaging</span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Case record review & scheduled court hearings timeline</span>
                    </li>
                    <li className="d-flex align-items-center gap-2">
                      <Check size={14} color="#16a34a" strokeWidth={2.5} />
                      <span>Verified WhatsApp & direct phone contact upon acceptance</span>
                    </li>
                  </>
                )}
              </ul>
            </div>

            {/* Prominent Info Badge */}
            <div 
              className="p-3 mb-3 d-flex align-items-start gap-2" 
              style={{ 
                backgroundColor: '#EFF6FF', 
                border: '1px solid #BFDBFE', 
                borderRadius: '10px',
                color: '#1E40AF',
                fontSize: '12.5px',
                lineHeight: '1.5'
              }}
            >
              <Info size={18} style={{ flexShrink: 0, marginTop: '2px' }} />
              <div>
                <strong>No Upfront Payment Required.</strong> You will only complete payment after Advocate {lawyer.name} reviews and formally accepts your inquiry.
              </div>
            </div>

            {/* Inquiry Form */}
            <form onSubmit={handleSubmitInquiry}>
              <div className="mb-3">
                <label className="form-label small fw-bold mb-1" style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  Case Title / Subject *
                </label>
                <input
                  type="text"
                  className="form-control"
                  required
                  placeholder="e.g. Commercial Lease Contract Dispute or Property Partition"
                  value={inquiryTitle}
                  onChange={(e) => setInquiryTitle(e.target.value)}
                  style={{ fontSize: '13.5px', borderRadius: '8px' }}
                />
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold mb-1" style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  Legal Domain / Practice Area
                </label>
                <select
                  className="form-select"
                  value={inquiryCategory}
                  onChange={(e) => setInquiryCategory(e.target.value)}
                  style={{ fontSize: '13.5px', borderRadius: '8px' }}
                >
                  <option value="Civil Litigation">Civil Litigation</option>
                  <option value="Criminal Defense">Criminal Defense</option>
                  <option value="Family Law">Family Law</option>
                  <option value="Property & Real Estate">Property & Real Estate</option>
                  <option value="Corporate & Commercial">Corporate & Commercial</option>
                  <option value="Labor & Employment">Labor & Employment</option>
                  <option value="Constitutional Law">Constitutional Law</option>
                  <option value="Tax & Customs">Tax & Customs</option>
                  <option value="General Legal Consultation">General Legal Consultation</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="form-label small fw-bold mb-1" style={{ color: isDark ? '#F8FAFC' : '#0F172A' }}>
                  Brief Summary of Legal Issue & Case Facts *
                </label>
                <textarea
                  className="form-control"
                  rows={3}
                  required
                  placeholder="Outline the key facts, dispute timeline, opposing party, and required legal assistance..."
                  value={inquiryDescription}
                  onChange={(e) => setInquiryDescription(e.target.value)}
                  style={{ fontSize: '13.5px', borderRadius: '8px' }}
                />
                <div className="form-text small" style={{ fontSize: '11.5px', color: '#64748B' }}>
                  This brief will be securely transmitted directly to Advocate {lawyer.name}'s dashboard.
                </div>
              </div>

              <div className="d-flex justify-content-end gap-2 pt-2">
                <button
                  type="button"
                  className="btn btn-light"
                  onClick={() => setShowInquiryModal(false)}
                  disabled={submittingInquiry}
                  style={{ borderRadius: '8px', fontSize: '13.5px' }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn"
                  disabled={submittingInquiry}
                  style={{
                    backgroundColor: '#1E3F2E',
                    color: '#FFFFFF',
                    fontWeight: 700,
                    fontSize: '14px',
                    borderRadius: '8px',
                    padding: '10px 20px',
                    border: 'none',
                    boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
                  }}
                >
                  {submittingInquiry ? <><span className="btn-spinner" />Sending inquiry…</> : 'Send inquiry (nothing to pay today)'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Demo Payment Gateway Modal */}
      <PaymentCheckout
        isOpen={showDemoCheckout}
        onClose={() => setShowDemoCheckout(false)}
        inquiry={existingInquiry ? { ...existingInquiry, packageType: existingInquiry.packageType || checkoutPackage } : null}
        lawyer={lawyer}
        currentUser={user}
        onDemoSuccess={handleDemoPaymentSuccess}
      />

      <style>
        {`
          .payment-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.85);
            display: flex;
            align-items: center;
            justify-content: center;
            z-index: 9999;
          }
          .payment-modal {
            background: white;
            border-radius: 24px;
            padding: 30px;
            max-width: 500px;
            width: 90%;
            position: relative;
          }
          .close-btn {
            position: absolute;
            top: 15px;
            right: 20px;
            background: none;
            border: none;
            font-size: 24px;
            cursor: pointer;
          }
          .back-btn {
            background: none;
            border: none;
            color: #D4AF37;
            margin-bottom: 15px;
            cursor: pointer;
          }
          .package-card {
            border: 2px solid #e0e0e0;
            border-radius: 16px;
            padding: 20px;
            text-align: center;
            cursor: pointer;
          }
          .package-card:hover { border-color: #D4AF37; }
          .price { font-size: 28px; font-weight: bold; color: #D4AF37; margin: 15px 0; }
          .btn-gold, .btn-platinum { background: #D4AF37; color: #000; border: none; padding: 10px; border-radius: 25px; width: 100%; margin-top: 10px; cursor: pointer; }
          .payment-methods { display: flex; gap: 15px; margin: 20px 0; }
          .payment-methods div { border: 2px solid #e0e0e0; border-radius: 12px; padding: 12px; text-align: center; cursor: pointer; flex: 1; }
          .payment-methods div:hover { border-color: #D4AF37; }
          .account-details input { width: 100%; padding: 12px; margin: 10px 0; border: 1px solid #ddd; border-radius: 8px; }
          .btn-pay { background: #D4AF37; color: #000; border: none; padding: 14px; border-radius: 30px; width: 100%; margin-top: 15px; cursor: pointer; font-weight: 600; }
          .demo-note { font-size: 11px; text-align: center; color: #888; margin-top: 15px; }

          /* 3D and Dark Theme Styling */
          html.dark .card, [data-theme="dark"] .card {
            background-color: var(--ll-bg-card) !important;
            color: var(--ll-text-primary) !important;
            border: 1px solid var(--ll-border) !important;
            box-shadow: var(--ll-shadow-3d) !important;
          }
          html.dark .card-body, [data-theme="dark"] .card-body {
            color: var(--ll-text-primary) !important;
          }
          html.dark .text-muted, [data-theme="dark"] .text-muted {
            color: var(--ll-text-muted) !important;
          }
          html.dark h1, html.dark h2, html.dark h3, html.dark h4, html.dark h5,
          [data-theme="dark"] h1, [data-theme="dark"] h2, [data-theme="dark"] h3, [data-theme="dark"] h4, [data-theme="dark"] h5 {
            color: var(--ll-text-primary) !important;
          }
          html.dark .modal-content, [data-theme="dark"] .modal-content {
            background-color: var(--ll-bg-surface) !important;
            color: var(--ll-text-primary) !important;
            border-color: var(--ll-border) !important;
          }
          html.dark .package-card, [data-theme="dark"] .package-card {
            background-color: var(--ll-bg-surface-elevated) !important;
            border-color: var(--ll-border) !important;
            color: var(--ll-text-primary) !important;
          }
          html.dark .package-card:hover, [data-theme="dark"] .package-card:hover {
            border-color: var(--ll-brand-gold) !important;
            transform: translateY(-4px);
            box-shadow: 0 12px 24px rgba(0,0,0,0.5), 0 0 15px rgba(212,175,55,0.2) !important;
          }
          html.dark input, html.dark textarea, html.dark select,
          [data-theme="dark"] input, [data-theme="dark"] textarea, [data-theme="dark"] select {
            background-color: var(--ll-bg-input) !important;
            color: var(--ll-text-primary) !important;
            border-color: var(--ll-border) !important;
          }
          .card {
            transition: transform 0.35s cubic-bezier(0.165, 0.84, 0.44, 1), box-shadow 0.35s ease, border-color 0.3s ease;
          }
          .card:hover {
            transform: translateY(-4px);
            box-shadow: var(--ll-shadow-3d-hover) !important;
          }
        `}
      </style>
      <Footer />
    </>
  );
};

export default LawyerProfile;