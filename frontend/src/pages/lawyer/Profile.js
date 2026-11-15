import React, { useState, useEffect } from 'react';
import { ProfilePageSkeleton } from '../../components/ui/Skeleton';
import { useNavigate } from 'react-router-dom';
import { lawyerAPI, reviewAPI } from '../../services/api';
import LawyerNavbar from '../../components/LawyerNavbar';
import Footer from '../../components/Footer';
import {
  ShieldCheck,
  Mail,
  Award,
  BookOpen,
  Edit3,
  Check,
  X,
  Scale,
  Star,
  MessageSquare,
  Send,
  CheckCircle2,
  AlertCircle,
  MapPin,
  Briefcase,
  Clock
} from 'lucide-react';
import { API_ORIGIN } from "../../config";



const Stars = ({ value, size = 15 }) => (
  <span className="cp-stars" aria-label={`${value} out of 5 stars`}>
    {[1, 2, 3, 4, 5].map((s) => (
      <Star
        key={s}
        size={size}
        fill={s <= Math.round(value) ? '#D4AF37' : 'none'}
        color={s <= Math.round(value) ? '#C9A24B' : '#94A3B8'}
        strokeWidth={1.8}
      />
    ))}
  </span>
);

const LawyersProfile = () => {
  const navigate = useNavigate();

  // Smooth-scroll to a card on this page and flash it briefly
  const scrollToSection = (id) => {
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: 'smooth' });
    el.classList.remove('cp-flash');
    void el.offsetWidth;
    el.classList.add('cp-flash');
  };
  const [profile, setProfile] = useState(null);
  const [stats, setStats] = useState({});
  const [loading, setLoading] = useState(true);
  const [isEditing, setIsEditing] = useState(false);
  const [formData, setFormData] = useState({});
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  // Same setting as the switch on the dashboard
  const [acceptingClients, setAcceptingClients] = useState(
    () => localStorage.getItem('lawyer_accepting_clients') !== 'false'
  );

  // Reviews
  const [reviews, setReviews] = useState([]);
  const [starDistribution, setStarDistribution] = useState({ 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [replyingReviewId, setReplyingReviewId] = useState(null);
  const [replyText, setReplyText] = useState('');
  const [submittingReply, setSubmittingReply] = useState(false);

  useEffect(() => {
    fetchProfile();
    lawyerAPI.getStats()
      .then((res) => setStats(res.data || {}))
      .catch(() => {});
  }, []);

  const showToast = (message, type = 'success') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const toFormData = (p) => ({
    phone: p?.phone || '',
    officeAddress: p?.officeAddress || p?.location || '',
    experience: p?.experience ?? '',
    languages: Array.isArray(p?.languages) ? p.languages.join(', ') : p?.languages || '',
    bio: p?.bio || ''
  });

  const fetchProfile = async () => {
    try {
      const response = await lawyerAPI.getProfile();
      const pData = response.data;
      setProfile(pData);
      setFormData(toFormData(pData));
      if (pData?._id) {
        fetchReviews(pData._id);
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchReviews = async (lawyerId) => {
    try {
      setLoadingReviews(true);
      const res = await reviewAPI.getLawyerReviews(lawyerId);
      setReviews(res.data?.reviews || []);
      setStarDistribution(res.data?.starDistribution || res.data?.ratingBreakdown || { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 });
      setAverageRating(res.data?.averageRating || 0);
      setTotalReviews(res.data?.totalReviews || (res.data?.reviews || []).length);
    } catch (err) {
      console.error('Error fetching lawyer reviews:', err);
    } finally {
      setLoadingReviews(false);
    }
  };

  const handleSendReply = async (reviewId) => {
    if (!replyText.trim()) return;
    setSubmittingReply(true);
    try {
      const res = await reviewAPI.replyReview(reviewId, { comment: replyText.trim() });
      const updatedReply = res.data?.review?.reply;
      setReviews((prev) => prev.map((r) => (r._id === reviewId ? { ...r, reply: updatedReply } : r)));
      setReplyingReviewId(null);
      setReplyText('');
      showToast('Your reply is now public on your profile.');
    } catch (err) {
      console.error('Error submitting reply:', err);
      showToast(err.response?.data?.message || 'Could not publish your reply. Please try again.', 'error');
    } finally {
      setSubmittingReply(false);
    }
  };

  const handleUpdate = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    const languages = String(formData.languages || '')
      .split(',')
      .map((l) => l.trim())
      .filter(Boolean);
    const payload = {
      phone: formData.phone,
      officeAddress: formData.officeAddress,
      location: formData.officeAddress,
      experience: formData.experience === '' ? undefined : Number(formData.experience),
      languages,
      bio: formData.bio
    };
    try {
      await lawyerAPI.updateProfile(payload);
      const updated = { ...profile, ...payload };
      setProfile(updated);
      setFormData(toFormData(updated));
      setIsEditing(false);
      showToast('Profile updated.');
    } catch (error) {
      console.error('Error updating profile:', error);
      showToast('Could not save your profile. Please try again.', 'error');
    } finally {
      setSaving(false);
    }
  };

  const cancelEdit = () => {
    setFormData(toFormData(profile));
    setIsEditing(false);
  };

  const toggleAcceptingClients = () => {
    const next = !acceptingClients;
    setAcceptingClients(next);
    localStorage.setItem('lawyer_accepting_clients', next ? 'true' : 'false');
  };

  const getPhotoUrl = (photoPath) => {
    if (!photoPath) return null;
    if (photoPath.startsWith('http')) return photoPath;
    return `${API_ORIGIN}${photoPath}`;
  };

  const displayName = (profile?.name || 'Counsel').replace(/^adv(ocate)?\.?\s+/i, '');
  const initials = displayName
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((n) => n[0].toUpperCase())
    .join('');

  const isVerified = !profile?.verificationStatus || profile.verificationStatus === 'approved';
  const specializations = Array.isArray(profile?.specialization) ? profile.specialization : [];
  const courts = Array.isArray(profile?.stateOfPractice) ? profile.stateOfPractice : [];
  const languageList = Array.isArray(profile?.languages) ? profile.languages : [];
  const address = profile?.officeAddress || profile?.location;
  const memberSince = profile?.createdAt
    ? new Date(profile.createdAt).toLocaleDateString('en-PK', { month: 'long', year: 'numeric' })
    : null;

  const field = (label, value, wide = false) => (
    <div className={`cp-field${wide ? ' is-wide' : ''}`}>
      <span className="cp-field-label">{label}</span>
      <span className={`cp-field-value${value ? '' : ' is-empty'}`}>{value || 'Not specified'}</span>
    </div>
  );

  if (loading) {
    return (
      <>
        <LawyerNavbar />
        <div className="cp-page">
        <ProfilePageSkeleton />
        </div>
      </>
    );
  }

  return (
    <>
      <LawyerNavbar />

      {toast && (
        <div className={`cp-toast${toast.type === 'error' ? ' is-error' : ''}`} role="status">
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="cp-page page-fade">
        {/* ── Identity banner ── */}
        <section className="cp-hero is-compact cp-profile-hero ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <div className="cp-identity">
                <span className="cp-identity-photo">
                  {profile?.photo && !photoFailed ? (
                    <img src={getPhotoUrl(profile.photo)} alt="" onError={() => setPhotoFailed(true)} />
                  ) : (
                    initials
                  )}
                </span>
                <div className="cp-identity-text">
                  {isVerified ? (
                    <span className="cp-chip"><ShieldCheck size={13} strokeWidth={2.2} /> Bar Council verified</span>
                  ) : (
                    <span className="cp-chip is-pending"><Clock size={13} strokeWidth={2.2} /> Verification {profile?.verificationStatus}</span>
                  )}
                  <h1 className="cp-hero-title">Adv. <span>{displayName}</span></h1>
                  <div className="cp-identity-meta">
                    {specializations[0] && (
                      <span><Scale size={14} /> {specializations.slice(0, 2).join(' · ')}</span>
                    )}
                    {courts[0] && (
                      <span><MapPin size={14} /> {courts.join(', ')}</span>
                    )}
                    {profile?.experience ? (
                      <span><Briefcase size={14} /> {profile.experience} years in practice</span>
                    ) : null}
                    {totalReviews > 0 && (
                      <span><Stars value={averageRating} size={13} /> {Number(averageRating).toFixed(1)} ({totalReviews})</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="cp-hero-side">
              {!isEditing ? (
                <button type="button" className="cp-btn-gold" onClick={() => setIsEditing(true)}>
                  <Edit3 size={16} strokeWidth={2.2} /> Edit profile
                </button>
              ) : (
                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                  <button type="button" className="cp-btn-ghost" onClick={cancelEdit}>
                    <X size={16} /> Cancel
                  </button>
                  <button type="button" className="cp-btn-gold" onClick={handleUpdate} disabled={saving}>
                    <Check size={16} strokeWidth={2.4} /> {saving ? <><span className="btn-spinner" />Saving…</> : 'Save changes'}
                  </button>
                </div>
              )}
            </div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Stat cards ── */}
          <section className="cp-stats" aria-label="Practice summary">
            <button type="button" className="cp-stat" onClick={() => navigate('/lawyer/cases')} title="Open My Cases">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Briefcase size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Cases on LegalLink</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{stats.totalCases ?? 0}</span>
                <span className="cp-stat-note">{stats.activeCases ?? 0} active</span>
              </div>
            </button>
            <button type="button" className="cp-stat" onClick={() => navigate('/lawyer/cases?filter=resolved')} title="Open resolved cases">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><CheckCircle2 size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Resolved cases</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{stats.resolvedCases ?? 0}</span>
                <span className="cp-stat-note">All time</span>
              </div>
            </button>
            <button type="button" className="cp-stat" onClick={() => scrollToSection('profile-reviews')} title="Jump to client reviews">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Star size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Client rating</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{totalReviews > 0 ? Number(averageRating).toFixed(1) : '—'}</span>
                <span className="cp-stat-note">
                  {totalReviews > 0 ? `${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'}` : 'No reviews yet'}
                </span>
              </div>
            </button>
            <button type="button" className="cp-stat" onClick={() => scrollToSection('profile-credentials')} title="Jump to credentials">
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Award size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Years in practice</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{profile?.experience || '—'}</span>
                <span className="cp-stat-note">{memberSince ? `On LegalLink since ${memberSince}` : 'Experience'}</span>
              </div>
            </button>
          </section>

          <div className="cp-layout">
            {/* ── Main column ── */}
            <div style={{ flex: '999 1 560px', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* About */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div className="cp-card-head-title">
                    <span className="cp-icon-tile"><BookOpen size={18} strokeWidth={1.8} /></span>
                    <h2 className="cp-section-title" style={{ fontSize: 19 }}>About</h2>
                  </div>
                </div>
                {isEditing ? (
                  <div className="cp-form-row">
                    <label className="cp-label" htmlFor="lp-bio">Professional biography</label>
                    <textarea
                      id="lp-bio"
                      className="cp-textarea"
                      value={formData.bio}
                      onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
                      placeholder="Your practice, notable experience and the clients you help."
                    />
                  </div>
                ) : profile?.bio ? (
                  <p className="cp-bio">{profile.bio}</p>
                ) : (
                  <div className="cp-empty-note">
                    No biography yet. Clients read this before sending an inquiry, so a short introduction to your practice helps.
                    <div style={{ marginTop: 12 }}>
                      <button type="button" className="cp-btn-outline is-small" onClick={() => setIsEditing(true)}>
                        <Edit3 size={14} /> Add a biography
                      </button>
                    </div>
                  </div>
                )}
              </section>

              {/* Contact */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div className="cp-card-head-title">
                    <span className="cp-icon-tile"><Mail size={18} strokeWidth={1.8} /></span>
                    <h2 className="cp-section-title" style={{ fontSize: 19 }}>Contact &amp; chambers</h2>
                  </div>
                </div>
                {isEditing ? (
                  <div className="cp-field-grid">
                    <div className="cp-form-row">
                      <label className="cp-label" htmlFor="lp-phone">Phone</label>
                      <input
                        id="lp-phone"
                        type="tel"
                        className="cp-input"
                        value={formData.phone}
                        onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                        placeholder="+92 300 1234567"
                      />
                    </div>
                    <div className="cp-form-row">
                      <label className="cp-label" htmlFor="lp-exp">Years in practice</label>
                      <input
                        id="lp-exp"
                        type="number"
                        min="0"
                        className="cp-input"
                        value={formData.experience}
                        onChange={(e) => setFormData({ ...formData, experience: e.target.value })}
                      />
                    </div>
                    <div className="cp-form-row" style={{ gridColumn: '1 / -1' }}>
                      <label className="cp-label" htmlFor="lp-address">Office / chambers address</label>
                      <input
                        id="lp-address"
                        type="text"
                        className="cp-input"
                        value={formData.officeAddress}
                        onChange={(e) => setFormData({ ...formData, officeAddress: e.target.value })}
                        placeholder="Chamber no., Bar Association building, city"
                      />
                    </div>
                    <div className="cp-form-row" style={{ gridColumn: '1 / -1' }}>
                      <label className="cp-label" htmlFor="lp-languages">Languages (separate with commas)</label>
                      <input
                        id="lp-languages"
                        type="text"
                        className="cp-input"
                        value={formData.languages}
                        onChange={(e) => setFormData({ ...formData, languages: e.target.value })}
                        placeholder="Urdu, English, Punjabi"
                      />
                    </div>
                  </div>
                ) : (
                  <div className="cp-field-grid">
                    {field('Email', profile?.email)}
                    {field('Phone', profile?.phone)}
                    {field('Office / chambers', address, true)}
                  </div>
                )}
              </section>

              {/* Practice */}
              <section className="cp-card cp-card-pad">
                <div className="cp-card-head">
                  <div className="cp-card-head-title">
                    <span className="cp-icon-tile"><Award size={18} strokeWidth={1.8} /></span>
                    <h2 className="cp-section-title" style={{ fontSize: 19 }}>Practice areas</h2>
                  </div>
                </div>
                {specializations.length > 0 ? (
                  <div className="cp-chips">
                    {specializations.map((spec) => (
                      <span key={spec} className="cp-chip-soft">{spec}</span>
                    ))}
                  </div>
                ) : (
                  <span className="cp-field-value is-empty">No practice areas listed</span>
                )}
                {!isEditing && (
                  <>
                    <span className="cp-subhead">Languages</span>
                    {languageList.length > 0 ? (
                      <div className="cp-chips">
                        {languageList.map((lang) => (
                          <span key={lang} className="cp-chip-outline">{lang}</span>
                        ))}
                      </div>
                    ) : (
                      <span className="cp-field-value is-empty">Not specified</span>
                    )}
                  </>
                )}
              </section>
            </div>

            {/* ── Side column ── */}
            <aside className="cp-aside">
              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Availability</h2>
                <div className="cp-availability" style={{ padding: '4px 0' }}>
                  <div>
                    <strong style={{ color: 'var(--cp-text)' }}>
                      {acceptingClients ? 'Accepting new clients' : 'New intakes paused'}
                    </strong>
                    <span style={{ color: 'var(--cp-muted)' }}>
                      {acceptingClients ? 'Citizens can send you inquiries' : 'Turn on to receive new inquiries'}
                    </span>
                  </div>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={acceptingClients}
                    aria-label="Accepting new clients"
                    className={`cp-switch${acceptingClients ? ' is-on' : ''}`}
                    onClick={toggleAcceptingClients}
                  />
                </div>
              </section>

              <section className="cp-card cp-card-pad" id="profile-credentials">
                <h2 className="cp-card-title">Credentials</h2>
                <dl className="cp-dl">
                  <div className="cp-dl-row">
                    <dt>Bar Council ID</dt>
                    <dd className="is-mono">{profile?.barCouncilId || 'Not specified'}</dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Courts of practice</dt>
                    <dd>{courts.length > 0 ? courts.join(', ') : 'Not specified'}</dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Experience</dt>
                    <dd>{profile?.experience ? `${profile.experience} years` : 'Not specified'}</dd>
                  </div>
                  <div className="cp-dl-row">
                    <dt>Status</dt>
                    <dd style={{ color: isVerified ? 'var(--cp-ok)' : 'var(--cp-warn)' }}>
                      {isVerified ? 'Verified' : `Verification ${profile?.verificationStatus}`}
                    </dd>
                  </div>
                </dl>
                <span className="cp-section-sub">
                  Credentials are verified by the LegalLink committee and can't be edited here.
                </span>
              </section>

              <section className="cp-card cp-card-pad">
                <h2 className="cp-card-title">Quick actions</h2>
                <button type="button" className="cp-action" onClick={() => navigate('/lawyer/cases')}>
                  <span className="cp-icon-tile"><Briefcase size={17} strokeWidth={1.9} /></span>
                  <span className="cp-action-label">Go to my cases</span>
                </button>
                <button type="button" className="cp-action" onClick={() => navigate('/lawyer/dashboard')}>
                  <span className="cp-icon-tile"><Scale size={17} strokeWidth={1.9} /></span>
                  <span className="cp-action-label">Back to dashboard</span>
                </button>
              </section>
            </aside>
          </div>

          {/* ── Reviews ── */}
          <section className="cp-card cp-card-pad" style={{ gap: 20 }} id="profile-reviews">
            <div className="cp-card-head">
              <div className="cp-card-head-title">
                <span className="cp-icon-tile"><Star size={18} strokeWidth={1.8} /></span>
                <div>
                  <h2 className="cp-section-title" style={{ fontSize: 19 }}>Client reviews</h2>
                  <span className="cp-section-sub">Only clients with a completed case can leave a review</span>
                </div>
              </div>
            </div>

            <div className="cp-reviews-summary">
              <div className="cp-score">
                <span className="cp-score-value">{totalReviews > 0 ? Number(averageRating).toFixed(1) : '—'}</span>
                <Stars value={totalReviews > 0 ? averageRating : 0} size={17} />
                <span className="cp-score-sub">
                  {totalReviews > 0
                    ? `Based on ${totalReviews} ${totalReviews === 1 ? 'review' : 'reviews'}`
                    : 'No reviews yet'}
                </span>
              </div>
              <div className="cp-bars">
                {[5, 4, 3, 2, 1].map((n) => {
                  const count = starDistribution?.[n] || 0;
                  const pct = totalReviews > 0 ? Math.round((count / totalReviews) * 100) : 0;
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

            {loadingReviews ? (
              <div aria-busy="true">
                <div className="cp-skeleton-row" style={{ margin: '8px 0' }} />
                <div className="cp-skeleton-row" style={{ margin: '8px 0', width: '70%' }} />
              </div>
            ) : reviews.length === 0 ? (
              <div className="cp-empty" style={{ padding: '32px 20px' }}>
                <span className="cp-empty-icon"><MessageSquare size={24} strokeWidth={1.8} /></span>
                <strong>No client reviews yet</strong>
                <p>When a client's case is resolved, they're invited to rate your representation. Reviews appear here and on your public profile.</p>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {reviews.map((r) => {
                  const clientName = r.userId?.name || 'Verified client';
                  const revDate = r.createdAt
                    ? new Date(r.createdAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                    : '';
                  const hasReply = r.reply && r.reply.comment && r.reply.comment.trim();
                  return (
                    <article key={r._id} className="cp-review">
                      <div className="cp-review-top">
                        <div className="cp-review-who">
                          <span className="cp-client-avatar">{clientName.charAt(0).toUpperCase()}</span>
                          <div>
                            <span className="cp-review-name">{clientName}</span>
                            <span className="cp-verified"><CheckCircle2 size={11} /> Verified client</span>
                            <div className="cp-review-date">
                              {revDate}
                              {r.isEdited && ' · edited'}
                            </div>
                          </div>
                        </div>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                          <Stars value={r.rating} size={14} />
                          <strong style={{ fontSize: 13, color: 'var(--cp-text)' }}>{r.rating}/5</strong>
                        </span>
                      </div>

                      <p className="cp-review-text">{r.comment}</p>

                      {hasReply ? (
                        <div className="cp-reply">
                          <div className="cp-reply-head">
                            <strong><Scale size={14} /> Your reply</strong>
                            <span>
                              {r.reply.repliedAt
                                ? new Date(r.reply.repliedAt).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' })
                                : 'Published'}
                            </span>
                          </div>
                          <p>{r.reply.comment}</p>
                        </div>
                      ) : replyingReviewId === r._id ? (
                        <div className="cp-reply-form">
                          <label className="cp-label" htmlFor={`reply-${r._id}`}>Public reply</label>
                          <textarea
                            id={`reply-${r._id}`}
                            className="cp-textarea"
                            value={replyText}
                            onChange={(e) => setReplyText(e.target.value)}
                            placeholder="Thank the client or respond to their feedback. Your reply is visible to everyone."
                          />
                          <div className="cp-reply-actions">
                            <button
                              type="button"
                              className="cp-btn-outline is-small"
                              onClick={() => {
                                setReplyingReviewId(null);
                                setReplyText('');
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              className="cp-btn-primary"
                              onClick={() => handleSendReply(r._id)}
                              disabled={submittingReply || !replyText.trim()}
                            >
                              <Send size={14} /> {submittingReply ? <><span className="btn-spinner" />Publishing…</> : 'Publish reply'}
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <button
                            type="button"
                            className="cp-btn-outline is-small"
                            onClick={() => {
                              setReplyingReviewId(r._id);
                              setReplyText('');
                            }}
                          >
                            <MessageSquare size={14} /> Reply publicly
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      </div>
      <Footer showCta={false} />
    </>
  );
};

export default LawyersProfile;
