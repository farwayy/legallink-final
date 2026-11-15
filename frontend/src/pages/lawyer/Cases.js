import React, { useState, useEffect, useMemo } from 'react';
import { ListSkeleton } from '../../components/ui/Skeleton';
import { useNavigate, useLocation } from 'react-router-dom';
import { getCaseStage, getNextHearing, getHearingsAwaitingOutcome, lastActivity, getUnread } from '../../utils/caseStage';
import { useAuth } from '../../contexts/AuthContext';
import { lawyerAPI } from '../../services/api';
import { useRealTime } from '../../contexts/RealTimeContext';
import LawyerNavbar from '../../components/LawyerNavbar';
import Footer from '../../components/Footer';
import CitizenInsights from '../../components/dashboard/CitizenInsights';
import {
  Briefcase,
  Search,
  CheckCircle2,
  FileText,
  AlertCircle,
  Building2,
  BarChart3
} from 'lucide-react';

// Hearings are stored as `hearingDates` on the Case model
const getHearings = (c) => c.hearingDates || c.hearings || [];

const ACTIVE_STATUSES = ['pending', 'assigned', 'active', 'in_progress', 'in progress'];
const CLOSED_STATUSES = ['closed', 'rejected'];

const STATUS_LABELS = {
  pending: ['Pending', 'is-warn'],
  assigned: ['Assigned', 'is-neutral'],
  active: ['Assigned', 'is-neutral'],
  in_progress: ['In progress', 'is-info'],
  'in progress': ['In progress', 'is-info'],
  resolved: ['Resolved', 'is-ok'],
  closed: ['Closed', 'is-neutral'],
  rejected: ['Rejected', 'is-danger']
};

const LawyerCases = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const [cases, setCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState(() => {
    const f = new URLSearchParams(location.search).get('filter');
    return ['active', 'resolved', 'closed'].includes(f) ? f : 'all';
  });
  const [sortBy, setSortBy] = useState(() => {
    const v = new URLSearchParams(location.search).get('sort');
    return ['updated', 'hearing', 'priority', 'oldest'].includes(v) ? v : 'updated';
  });
  const [showInsights, setShowInsights] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const { socket } = useRealTime();

  // eslint-disable-next-line no-unused-vars
  const triggerToast = (message, type = 'success') => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: '', type: 'success' });
    }, 4500);
  };

  useEffect(() => {
    fetchCases();
  }, []);

  // Real-time Socket.io listener for incoming case messages in background
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

    socket.on('case-message', handleCaseMessage);

    return () => {
      socket.off('case-message', handleCaseMessage);
    };
  }, [socket]);

  const fetchCases = async () => {
    try {
      const response = await lawyerAPI.getCases();
      setCases(response.data.cases || []);
    } catch (error) {
      console.error('Error fetching cases:', error);
    } finally {
      setLoading(false);
    }
  };

  const startOfToday = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const statusGroup = (status) => {
    const s = (status || '').toLowerCase();
    if (ACTIVE_STATUSES.includes(s)) return 'active';
    if (s === 'resolved') return 'resolved';
    if (CLOSED_STATUSES.includes(s)) return 'closed';
    return 'active';
  };

  // Stage comes from the shared rule (utils/caseStage.js), so it matches the case file
  const getStage = (c) => getCaseStage(c);

  const getHearingInfo = (c) => {
    if (statusGroup(c.status) !== 'active') {
      const past = getHearings(c).filter((h) => h.date && new Date(h.date) < new Date()).sort((a, b) => new Date(b.date) - new Date(a.date))[0];
      return past ? { date: past.date, note: 'Last hearing', soon: false } : null;
    }
    const hearings = getHearings(c)
      .filter((h) => h.date && h.status !== 'cancelled')
      .sort((a, b) => new Date(a.date) - new Date(b.date));
    const next = hearings.find((h) => new Date(h.date) >= startOfToday);
    if (next) {
      const days = Math.round((new Date(next.date).setHours(0, 0, 0, 0) - startOfToday) / 86400000);
      return {
        date: next.date,
        note: days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`,
        soon: days <= 7
      };
    }
    const awaiting = getHearingsAwaitingOutcome(c);
    if (awaiting.length) {
      const a = awaiting.sort((x, y) => new Date(y.date) - new Date(x.date))[0];
      return { date: a.date, note: 'Outcome needed', soon: true };
    }
    const last = hearings[hearings.length - 1];
    if (last) return { date: last.date, note: 'Last hearing', soon: false };
    return null;
  };

  const formatDate = (d) =>
    new Date(d).toLocaleDateString('en-PK', { day: 'numeric', month: 'short', year: 'numeric' });

  // Category list is built from the advocate's own cases, so it always matches
  const categories = useMemo(
    () => Array.from(new Set(cases.map((c) => c.category).filter(Boolean))).sort(),
    [cases]
  );

  const counts = useMemo(() => {
    const result = { all: cases.length, active: 0, resolved: 0, closed: 0 };
    cases.forEach((c) => {
      result[statusGroup(c.status)] += 1;
    });
    return result;
  }, [cases]);

  const upcomingHearingsCount = useMemo(
    () =>
      cases.filter((c) => statusGroup(c.status) === 'active').reduce(
        (sum, c) =>
          sum + getHearings(c).filter((h) => h.date && new Date(h.date) >= startOfToday && h.status !== 'cancelled').length,
        0
      ),
    [cases, startOfToday]
  );

  const filteredCases = cases.filter((c) => {
    const q = search.trim().toLowerCase();
    const matchesSearch =
      !q ||
      c.title?.toLowerCase().includes(q) ||
      c.userId?.name?.toLowerCase().includes(q) ||
      c._id?.toLowerCase().includes(q);

    const matchesCategory = categoryFilter === 'all' || c.category === categoryFilter;
    const matchesStatus = statusFilter === 'all' || statusGroup(c.status) === statusFilter;

    return matchesSearch && matchesCategory && matchesStatus;
  });

  const PRIORITY_RANK = { urgent: 0, high: 1, medium: 2, low: 3 };
  const sortedCases = [...filteredCases].sort((a, b) => {
    if (sortBy === 'hearing') {
      const na = getNextHearing(a, startOfToday);
      const nb = getNextHearing(b, startOfToday);
      if (na && nb) return new Date(na.date) - new Date(nb.date);
      if (na) return -1;
      if (nb) return 1;
      return lastActivity(b) - lastActivity(a);
    }
    if (sortBy === 'priority') {
      const d = (PRIORITY_RANK[(a.priority || 'medium').toLowerCase()] ?? 2) - (PRIORITY_RANK[(b.priority || 'medium').toLowerCase()] ?? 2);
      return d !== 0 ? d : lastActivity(b) - lastActivity(a);
    }
    if (sortBy === 'oldest') return new Date(a.createdAt) - new Date(b.createdAt);
    return lastActivity(b) - lastActivity(a);
  });

  const filtersActive = search || categoryFilter !== 'all' || statusFilter !== 'all';

  const resetFilters = () => {
    setSearch('');
    setCategoryFilter('all');
    setStatusFilter('all');
    setSortBy('updated');
  };

  const statusTabs = [
    { id: 'all', label: 'All' },
    { id: 'active', label: 'Active' },
    { id: 'resolved', label: 'Resolved' },
    { id: 'closed', label: 'Closed' }
  ];

  return (
    <>
      <LawyerNavbar />

      {toast.show && (
        <div className={`cp-toast${toast.type === 'error' ? ' is-error' : ''}`} role="status">
          {toast.type === 'error' ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
          <span>{toast.message}</span>
        </div>
      )}

      <div className="cp-page page-fade">
        {/* ── Page banner ── */}
        <section className="cp-hero is-compact ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <div className="cp-title-row">
                <span className="cp-hero-icon"><Briefcase size={22} strokeWidth={1.8} /></span>
                <div>
                  <h1 className="cp-hero-title">My cases</h1>
                  <p className="cp-hero-text" style={{ fontSize: '14.5px' }}>
                    Every matter you represent, with its stage, next hearing and status.
                  </p>
                </div>
              </div>
            </div>

            <div className="cp-summary" aria-label="Case summary">
              <div className="cp-summary-item">
                <strong>{counts.all}</strong>
                <span>Total cases</span>
              </div>
              <div className="cp-summary-item">
                <strong>{counts.active}</strong>
                <span>Active</span>
              </div>
              <div className="cp-summary-item">
                <strong>{counts.resolved}</strong>
                <span>Resolved</span>
              </div>
              <div className="cp-summary-item is-gold">
                <strong>{upcomingHearingsCount}</strong>
                <span>Upcoming hearings</span>
              </div>
            </div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Filters ── */}
          <div className="cp-toolbar">
            <div className="cp-search">
              <Search size={16} strokeWidth={1.9} />
              <input
                type="search"
                className="cp-input"
                placeholder="Search by case title, client name or reference"
                aria-label="Search cases"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="cp-seg" role="tablist" aria-label="Filter by status">
              {statusTabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={statusFilter === tab.id}
                  className={`cp-seg-btn${statusFilter === tab.id ? ' is-active' : ''}`}
                  onClick={() => setStatusFilter(tab.id)}
                >
                  {tab.label}
                  <span className="cp-tab-count">{counts[tab.id]}</span>
                </button>
              ))}
            </div>

            <select
              className="cp-select"
              aria-label="Filter by category"
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
            >
              <option value="all">All categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <label className="cp-sort">
              <span>Sort</span>
              <select className="cp-select" value={sortBy} onChange={(e) => setSortBy(e.target.value)} aria-label="Sort cases">
                <option value="updated">Latest update</option>
                <option value="hearing">Next hearing</option>
                <option value="priority">Priority</option>
                <option value="oldest">Oldest first</option>
              </select>
            </label>

            {filtersActive && (
              <button type="button" className="cp-btn-text" onClick={resetFilters}>
                Clear filters
              </button>
            )}
          </div>

          {showInsights && cases.length > 0 && (
            <div className="cp-insights-wrap">
              <CitizenInsights cases={cases} audience="counsel" />
            </div>
          )}

          {/* ── Case table ── */}
          <section className="cp-table-card">
            <div className="cp-table-head">
              <div>
                <h2 className="cp-section-title">Case register</h2>
                <span className="cp-section-sub">
                  {loading
                    ? 'Loading your cases…'
                    : `Showing ${filteredCases.length} of ${cases.length} ${cases.length === 1 ? 'case' : 'cases'}`}
                </span>
              </div>
              <button
                type="button"
                className="cp-link"
                onClick={() => setShowInsights((v) => !v)}
                aria-expanded={showInsights}
              >
                <BarChart3 size={15} strokeWidth={2.2} /> {showInsights ? 'Hide insights' : 'Show insights'}
              </button>
            </div>

            {loading ? (
              <ListSkeleton rows={5} />
            ) : filteredCases.length === 0 ? (
              <div className="cp-empty">
                <span className="cp-empty-icon">
                  {cases.length === 0 ? <Briefcase size={24} strokeWidth={1.8} /> : <Search size={24} strokeWidth={1.8} />}
                </span>
                <strong>{cases.length === 0 ? 'No cases yet' : 'No cases match these filters'}</strong>
                <p>
                  {cases.length === 0
                    ? 'Cases appear here once you accept a client inquiry or are assigned a pro bono matter by a legal aid organisation.'
                    : 'Try a different search term, status or category.'}
                </p>
                {cases.length === 0 ? (
                  <button type="button" className="cp-open-btn" onClick={() => navigate('/lawyer/dashboard')}>
                    Go to dashboard
                  </button>
                ) : (
                  <button type="button" className="cp-open-btn" onClick={resetFilters}>
                    Clear filters
                  </button>
                )}
              </div>
            ) : (
              <div className="cp-table-scroll">
                <table className="cp-table">
                  <thead>
                    <tr>
                      <th scope="col">Case</th>
                      <th scope="col">Client</th>
                      <th scope="col">Category</th>
                      <th scope="col">Stage</th>
                      <th scope="col">Hearing</th>
                      <th scope="col">Status</th>
                      <th scope="col"><span className="visually-hidden">Actions</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedCases.map((c) => {
                      const isProBono = c.caseType === 'pro_bono' || c.ngoId;
                      const stage = getStage(c);
                      const hearing = getHearingInfo(c);
                      const [statusLabel, statusClass] =
                        STATUS_LABELS[(c.status || '').toLowerCase()] || [c.status || 'Unknown', 'is-neutral'];
                      const clientName = c.userId?.name || 'Confidential client';
                      const clientInitials = clientName
                        .split(' ')
                        .filter(Boolean)
                        .slice(0, 2)
                        .map((p) => p[0].toUpperCase())
                        .join('');

                      return (
                        <tr key={c._id} onClick={() => navigate(`/case/${c._id}`)}>
                          <td>
                            <span className="cp-case-title">
                              {c.title}
                              {c.priority?.toLowerCase() === 'urgent' && <span className="cp-priority-urgent">Urgent</span>}
                              {getUnread(c, user).total > 0 && (
                                <span className="rc-new" title="New messages or documents since you last looked">
                                  {getUnread(c, user).total} new
                                </span>
                              )}
                            </span>
                            <span className="cp-case-meta">
                              <span className="cp-ref">#{c._id.slice(-6).toUpperCase()}</span>
                              {isProBono ? (
                                <span className="cp-type is-probono">
                                  <Building2 size={11} strokeWidth={2.2} />
                                  Pro bono · {c.ngoId?.name || 'Legal aid NGO'}
                                </span>
                              ) : (
                                <span className="cp-type">
                                  <Briefcase size={11} strokeWidth={2.2} />
                                  Private client
                                </span>
                              )}
                            </span>
                          </td>

                          <td>
                            <span className="cp-client">
                              <span className="cp-client-avatar">{clientInitials || 'C'}</span>
                              <span className="cp-client-name">{clientName}</span>
                            </span>
                          </td>

                          <td>{c.category || 'General'}</td>

                          <td>
                            <span className="cp-mini-stage">
                              <span className="cp-stage-bars">
                                {[1, 2, 3, 4].map((n) => (
                                  <span key={n} className={`cp-stage-bar${n <= stage.step ? ' is-on' : ''}`} />
                                ))}
                              </span>
                              <span>{stage.label}</span>
                            </span>
                          </td>

                          <td>
                            {hearing ? (
                              <span className={`cp-hearing-cell${hearing.soon ? ' is-soon' : ''}`}>
                                <strong>{formatDate(hearing.date)}</strong>
                                <span>{hearing.note}</span>
                              </span>
                            ) : (
                              <span className="cp-hearing-cell">
                                <span>No hearing yet</span>
                              </span>
                            )}
                          </td>

                          <td>
                            <span className={`cp-pill ${statusClass}`}>{statusLabel}</span>
                          </td>

                          <td style={{ textAlign: 'right' }}>
                            <button
                              type="button"
                              className="cp-open-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/case/${c._id}`);
                              }}
                            >
                              <FileText size={14} />
                              Open
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        </div>
      </div>
      <Footer showCta={false} />
    </>
  );
};

export default LawyerCases;
