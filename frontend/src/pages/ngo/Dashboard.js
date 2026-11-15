import React, { useState, useEffect, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { ngoAPI, caseAPI } from "../../services/api";
import { useAuth } from "../../contexts/AuthContext";
import { useRealTime } from "../../contexts/RealTimeContext";
import NGONavbar from "../../components/NGONavbar";
import { DashboardSkeleton } from "../../components/SkeletonLoader";
import EmptyState from "../../components/EmptyState";
import Footer from "../../components/Footer";
import TodayPriorities from "../../components/dashboard/TodayPriorities";
import { getCaseStage, getNextHearing, getUnread } from "../../utils/caseStage";
import {
  Send,
  MessageSquare,
  Users,
  UserPlus,
  Building2,
  Clock,
  Shield,
  Inbox,
  Scale,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
  RefreshCw,
  Briefcase,
  X
} from "lucide-react";

const STATUS_CONFIG = {
  pending:                 { bg: "#fef3c7", color: "#92400e", label: "Pending review", border: "#fde68a", tone: "is-warn" },
  under_review:            { bg: "#eff6ff", color: "#1e40af", label: "Under review", border: "#bfdbfe", tone: "is-info" },
  assigned:                { bg: "#fdf4ff", color: "#86198f", label: "Counsel assigned", border: "#f5d0fe", tone: "is-neutral" },
  in_progress:             { bg: "#f0fdf4", color: "#166534", label: "In progress", border: "#bbf7d0", tone: "is-info" },
  resolved:                { bg: "#ecfdf5", color: "#065f46", label: "Resolved", border: "#a7f3d0", tone: "is-ok" },
  rejected:                { bg: "#fef2f2", color: "#991b1b", label: "Declined", border: "#fecaca", tone: "is-danger" },
  accepted:                { bg: "#f0fdf4", color: "#15803d", label: "Accepted", border: "#bbf7d0", tone: "is-ok" },
  pending_lawyer_approval: { bg: "#fef3c7", color: "#92400e", label: "Awaiting advocate", border: "#fde68a", tone: "is-warn" },
  active:                  { bg: "#ecfdf5", color: "#065f46", label: "Active member", border: "#a7f3d0", tone: "is-ok" },
  declined:                { bg: "#fef2f2", color: "#991b1b", label: "Declined by advocate", border: "#fecaca", tone: "is-danger" },
  inactive:                { bg: "#f3f4f6", color: "#4b5563", label: "Inactive", border: "#e5e7eb", tone: "is-neutral" }
};

// view="home"     → /ngo/dashboard : short overview (stats, priorities, recent cases)
// view="cases"    → /ngo/cases     : active, pending (needs an advocate) and hearings
// view="requests" → /ngo/requests  : citizens' legal aid requests
// view="panel"    → /ngo/panel     : panel advocates and invitations
const VIEW_TABS = {
  cases: ["active", "pending", "hearings"],
  requests: ["aid_requests"],
  panel: ["panel_advocates"]
};
const TAB_PAGE = {
  aid_requests: "/ngo/requests",
  panel_advocates: "/ngo/panel",
  active: "/ngo/cases?tab=active",
  pending: "/ngo/cases?tab=pending",
  hearings: "/ngo/cases?tab=hearings"
};

const PAGE_COPY = {
  home: { title: "", text: "", listTitle: "", listSub: "" },
  cases: {
    title: "Cases",
    text: "Pro bono matters your organisation is handling, cases still waiting for an advocate, and hearings.",
    listTitle: "Your cases",
    listSub: "Open a case to see its file, hearings, documents and messages"
  },
  requests: {
    title: "Aid requests",
    text: "Citizens asking for free legal help. Accept a request and assign an advocate, or decline it with a reason.",
    listTitle: "Requests from citizens",
    listSub: "Newest first"
  },
  panel: {
    title: "Panel advocates",
    text: "Verified advocates who take on your organisation's pro bono cases.",
    listTitle: "Your panel",
    listSub: "Active members and pending invitations"
  }
};

const NGODashboard = ({ view = "home" }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const [stats, setStats] = useState({ totalCases: 0, activeCases: 0, resolvedCases: 0, pendingRequests: 0 });
  const [cases, setCases] = useState([]);
  const [aidRequests, setAidRequests] = useState([]);
  const [members, setMembers] = useState([]);
  const pickTab = () => {
    const allowed = VIEW_TABS[view] || [];
    const fromUrl = new URLSearchParams(location.search).get("tab");
    return allowed.includes(fromUrl) ? fromUrl : allowed[0] || "active";
  };
  const [tab, setTab] = useState(pickTab); // aid_requests | panel_advocates | pending | active | hearings
  const [loading, setLoading] = useState(true);
  const [modalCase, setModalCase] = useState(null);
  const [modalType, setModalType] = useState(""); // status | hearing | message | reject | accept_aid | reassign | invite_advocate
  const [formInput, setFormInput] = useState({ status: "", hearingDate: "", hearingNotes: "", hearingOutcome: "", message: "", rejectionReason: "" });
  const [selectedLawyerId, setSelectedLawyerId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [inviteForm, setInviteForm] = useState({ identifier: "", designation: "Staff Advocate", role: "staff_advocate" });
  const [actionLoading, setActionLoading] = useState(false);
  const [toast, setToast] = useState("");

  const { user } = useAuth();
  const { socket } = useRealTime();
  const ngoChatEndRef = useRef(null);

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 3500);
  };

  // Real-time Socket.io listener for incoming case messages in NGO Dashboard
  useEffect(() => {
    if (!socket) return;
    if (modalCase?._id && modalType === "message") {
      socket.emit("join-case", modalCase._id);
    }

    const handleCaseMessage = (data) => {
      if (modalCase && data?.caseId === modalCase._id) {
        setModalCase((prev) => {
          if (!prev) return prev;
          const exists = prev.messages?.some(
            (m) =>
              (m._id && data.message?._id && m._id === data.message._id) ||
              (m.senderId === data.message?.senderId &&
                m.message === data.message?.message &&
                Math.abs(new Date(m.timestamp) - new Date(data.message?.timestamp)) < 2000)
          );
          if (exists) return prev;
          return {
            ...prev,
            messages: [...(prev.messages || []), data.message]
          };
        });
      }

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
      if (modalCase?._id && modalType === "message") {
        socket.emit("leave-case", modalCase._id);
      }
      socket.off("case-message", handleCaseMessage);
    };
  }, [socket, modalCase?._id, modalType]);

  useEffect(() => {
    if (modalCase?.messages && ngoChatEndRef.current) {
      ngoChatEndRef.current.scrollTop = ngoChatEndRef.current.scrollHeight;
    }
  }, [modalCase?.messages]);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statsRes, casesRes, aidRes, membersRes] = await Promise.all([
        ngoAPI.getStats(),
        ngoAPI.getCases(),
        ngoAPI.getAidRequests(),
        ngoAPI.getMembers().catch(err => { console.warn("Failed fetching panel members:", err); return { data: { members: [] } }; })
      ]);
      setStats(statsRes.data || { totalCases: 0, activeCases: 0, resolvedCases: 0, pendingRequests: 0 });
      setCases(casesRes.data.cases || []);
      setAidRequests(aidRes.data.requests || []);
      setMembers(membersRes.data.members || []);
    } catch (e) {
      console.error("Dashboard load error:", e);
      showToast("Notice: Connecting to active case repository.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []); // eslint-disable-line

  // Keep the open tab in step with the address (?tab=pending etc.)
  useEffect(() => {
    if (view === "home") return;
    setTab(pickTab());
  }, [location.search, view]); // eslint-disable-line

  // Each work queue lives on its own page
  const goTo = (id) => {
    if (view !== "home" && (VIEW_TABS[view] || []).includes(id)) {
      setTab(id);
      if (view === "cases") navigate(`/ngo/cases?tab=${id}`, { replace: true });
      return;
    }
    navigate(TAB_PAGE[id] || "/ngo/dashboard");
  };

  const filteredCases = () => {
    if (tab === "aid_requests" || tab === "panel_advocates") return [];
    if (tab === "pending")  return cases.filter(c => c.status === "pending");
    if (tab === "active")   return cases.filter(c => ["under_review", "assigned", "in_progress"].includes(c.status));
    if (tab === "hearings") return cases.filter(c => c.hearingDates && c.hearingDates.length > 0);
    return cases;
  };

  const handleOpenAcceptAid = (aidReq) => {
    setModalCase(aidReq);
    setModalType("accept_aid");
    setSelectedLawyerId("");
  };

  const handleConfirmAcceptAid = async () => {
    if (!modalCase) return;
    setActionLoading(true);
    try {
      const lawyerIdToAssign = selectedLawyerId && selectedLawyerId.trim() !== "" ? selectedLawyerId : undefined;
      const res = await ngoAPI.acceptAidRequest(modalCase._id, lawyerIdToAssign);
      const assignedName = res.data?.case?.assignments?.[0]?.lawyerName;
      if (assignedName) {
        showToast(`Aid request accepted. Case opened and assigned to Adv. ${assignedName}.`);
      } else {
        showToast(`Aid request accepted. Case opened for ${modalCase.userId?.name || 'citizen'}.`);
      }
      closeModal();
      fetchData();
    } catch (e) {
      console.error("Failed to accept aid request:", e);
      showToast(e.response?.data?.message || "Failed to accept aid request.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenReassign = (c) => {
    setModalCase(c);
    setModalType("reassign");
    setSelectedLawyerId(c.lawyerId?._id || c.lawyerId || "");
    setReassignReason("");
  };

  const handleConfirmReassign = async () => {
    if (!modalCase || !selectedLawyerId) return;
    if (!reassignReason.trim()) {
      showToast("Reason for reassignment is required.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await ngoAPI.reassignCase(modalCase._id, selectedLawyerId, reassignReason.trim());
      showToast(res.data?.message || "Legal aid counsel reassigned successfully.");
      closeModal();
      fetchData();
    } catch (e) {
      console.error("Reassign error:", e);
      showToast(e.response?.data?.message || "Failed to reassign counsel.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleOpenInviteModal = () => {
    setInviteForm({ identifier: "", designation: "Staff Advocate", role: "staff_advocate" });
    setModalCase(null);
    setModalType("invite_advocate");
  };

  const handleSendInvite = async (e) => {
    if (e) e.preventDefault();
    if (!inviteForm.identifier.trim()) {
      showToast("Please enter a Bar Council ID or registered email.");
      return;
    }
    setActionLoading(true);
    try {
      const res = await ngoAPI.inviteMember(inviteForm);
      showToast(res.data?.message || "Panel invitation sent successfully. Awaiting advocate acceptance.");
      closeModal();
      fetchData();
    } catch (e) {
      console.error("Invite error:", e);
      showToast(e.response?.data?.message || "Failed to send panel invitation.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeactivateMember = async (membershipId) => {
    setActionLoading(true);
    try {
      await ngoAPI.updateMemberStatus(membershipId, "inactive");
      showToast("Panel advocate membership deactivated.");
      fetchData();
    } catch (e) {
      console.error("Deactivate member error:", e);
      showToast(e.response?.data?.message || "Failed to deactivate member.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleRejectAidRequest = async () => {
    setActionLoading(true);
    try {
      await ngoAPI.rejectAidRequest(modalCase._id, formInput.rejectionReason);
      showToast("Aid request declined.");
      closeModal();
      fetchData();
    } catch (e) {
      showToast("Failed to reject aid request.");
    } finally {
      setActionLoading(false);
    }
  };

  const openModal = (c, type) => {
    setModalCase(c);
    setModalType(type);
    setFormInput({
      status: c?.status || "",
      hearingDate: "",
      hearingNotes: "",
      hearingOutcome: "",
      message: ""
    });
    if (type === "message" && c) {
      caseAPI.getCase(c._id)
        .then((res) => {
          if (res.data) setModalCase(res.data);
        })
        .catch((err) => console.error("Error refreshing case for chat:", err));
    }
  };

  const closeModal = () => {
    setModalCase(null);
    setModalType("");
    setSelectedLawyerId("");
    setReassignReason("");
    setInviteForm({ identifier: "", designation: "Staff Advocate", role: "staff_advocate" });
  };

  const handleStatusUpdate = async () => {
    if (!formInput.status) return;
    setActionLoading(true);
    try {
      await ngoAPI.updateCaseStatus(modalCase._id, formInput.status);
      showToast("Case status updated successfully.");
      closeModal();
      fetchData();
    } catch (e) {
      showToast("Failed to update status. Please try again.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleHearing = async () => {
    if (!formInput.hearingDate) return;
    setActionLoading(true);
    try {
      await ngoAPI.addHearing(modalCase._id, {
        date: formInput.hearingDate,
        notes: formInput.hearingNotes,
        outcome: formInput.hearingOutcome
      });
      showToast("Court hearing scheduled successfully.");
      closeModal();
      fetchData();
    } catch (e) {
      showToast("Failed to record hearing date.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleMessage = async () => {
    if (!formInput.message.trim() || !modalCase) return;
    setActionLoading(true);
    const msgText = formInput.message.trim();
    try {
      const res = await ngoAPI.sendMessage(modalCase._id, msgText);
      const updatedMessages = res.data?.case?.messages || [
        ...(modalCase.messages || []),
        {
          senderId: user?.id,
          senderType: "ngo",
          message: msgText,
          timestamp: new Date()
        }
      ];
      setModalCase((prev) => ({
        ...prev,
        messages: updatedMessages
      }));
      setCases((prevCases) =>
        prevCases.map((c) =>
          c._id === modalCase._id ? { ...c, messages: updatedMessages } : c
        )
      );
      setFormInput((prev) => ({ ...prev, message: "" }));
      showToast("Message dispatched to client.");
    } catch (e) {
      showToast("Failed to transmit message.");
    } finally {
      setActionLoading(false);
    }
  };

  const activeMembersCount = members.filter((m) => m.status === "active").length;
  const pendingAidCount = aidRequests.filter((r) => r.status === "pending").length;
  const pendingInvitesCount = members.filter((m) => m.status === "pending_lawyer_approval").length;
  const activeCaseCount = cases.filter((c) => ["under_review", "assigned", "in_progress"].includes(c.status)).length;
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const upcomingHearings = cases
    .flatMap((c) => (c.hearingDates || []).map((h) => ({ ...h, caseTitle: c.title, clientName: c.userId?.name })))
    .filter((h) => h.date && new Date(h.date) >= startOfToday && h.status !== "cancelled")
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const nextHearing = upcomingHearings[0];
  const daysUntilNext = nextHearing
    ? Math.round((new Date(nextHearing.date).setHours(0, 0, 0, 0) - startOfToday) / 86400000)
    : null;
  const isVerified = !user?.verificationStatus || user.verificationStatus === "approved";
  const hour = new Date().getHours();
  const greeting = hour < 12 ? "Good morning" : hour < 17 ? "Good afternoon" : "Good evening";

  const tabs = [
    { id: "aid_requests", label: "Aid requests", count: pendingAidCount, alert: pendingAidCount > 0 },
    { id: "panel_advocates", label: "Panel advocates", count: members.length },
    { id: "pending", label: "Pending cases", count: cases.filter((c) => c.status === "pending").length },
    { id: "active", label: "Active cases", count: activeCaseCount },
    { id: "hearings", label: "Hearings", count: cases.filter((c) => c.hearingDates && c.hearingDates.length > 0).length }
  ];

  const viewTabs = (VIEW_TABS[view] || []).map((id) => tabs.find((t) => t.id === id)).filter(Boolean);
  const recentCases = cases
    .filter((c) => ["under_review", "assigned", "in_progress"].includes(c.status))
    .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt))
    .slice(0, 4);

  if (loading) {
    return (
      <>
        <NGONavbar />
        <div className="cp-page" style={{ padding: "0 24px" }}>
          <DashboardSkeleton cards={4} cols={5} rows={6} />
        </div>
      </>
    );
  }

  return (
    <>
      <NGONavbar />
      <style>{`
        /* Tables, buttons and modals use the shared portal colours (counselPortal.css) */
        .ngo-portal .ngo-table-card { background: transparent; }

        .ngo-table {
          width: 100%;
          min-width: 820px;
          border-collapse: collapse;
          text-align: left;
          font-size: 13.5px;
        }
        .ngo-table th {
          padding: 12px 18px;
          background: var(--cp-subtle);
          border-bottom: 1px solid var(--cp-border);
          color: var(--cp-muted);
          font-size: 11.5px;
          font-weight: 600;
          letter-spacing: 0.06em;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .ngo-table td {
          padding: 16px 18px;
          border-bottom: 1px solid var(--cp-border);
          color: var(--cp-text-2);
          vertical-align: middle;
        }
        .ngo-table tbody tr { transition: background-color 0.15s ease; }
        .ngo-table tbody tr:hover td { background: var(--cp-subtle); }
        .ngo-table tbody tr:last-child td { border-bottom: none; }

        .ngo-case-title { font-size: 14.5px; font-weight: 600 !important; color: var(--cp-text) !important; margin-bottom: 3px; }

        .ngo-cat-pill {
          display: inline-flex;
          padding: 3px 9px;
          border-radius: 6px;
          background: var(--cp-gold-tint);
          color: var(--cp-gold);
          font-size: 12px;
          font-weight: 600;
          white-space: nowrap;
        }

        .ngo-action-btn-row { display: flex; gap: 6px; justify-content: flex-end; flex-wrap: wrap; }

        .ngo-tbl-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          min-height: 34px;
          padding: 0 12px;
          border-radius: 8px;
          border: 1px solid var(--cp-border-strong);
          background: var(--cp-surface);
          color: var(--cp-text) !important;
          font-family: inherit;
          font-size: 12.5px;
          font-weight: 600;
          white-space: nowrap;
          cursor: pointer;
          transition: border-color 0.15s ease, background-color 0.15s ease;
        }
        .ngo-tbl-btn:hover { border-color: var(--cp-gold); background: var(--cp-gold-tint); }
        .ngo-tbl-btn:disabled { opacity: 0.6; cursor: not-allowed; }
        .ngo-tbl-btn.primary { background: #1E3F2E; border-color: #1E3F2E; color: #FFFFFF !important; }
        .ngo-tbl-btn.primary:hover { background: #152E22; border-color: #152E22; }
        html[data-theme="dark"] .ngo-tbl-btn.primary { background: #C9A24B; border-color: #C9A24B; color: #0B1A13 !important; }
        html[data-theme="dark"] .ngo-tbl-btn.primary:hover { background: #D9B45E; border-color: #D9B45E; }

        /* Modals */
        .ngo-modal-bg {
          position: fixed;
          inset: 0;
          background: rgba(7, 17, 13, 0.6);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2500;
          padding: 20px;
        }
        .ngo-modal-box {
          width: 100%;
          max-width: 540px;
          max-height: calc(100vh - 40px);
          overflow-y: auto;
          background: var(--cp-surface);
          border: 1px solid var(--cp-border);
          border-radius: 16px;
          box-shadow: 0 24px 48px -12px rgba(0, 0, 0, 0.45);
          color: var(--cp-text);
        }
        .ngo-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          gap: 12px;
          padding: 18px 22px;
          border-bottom: 1px solid var(--cp-border);
          background: var(--cp-subtle);
        }
        .ngo-modal-title {
          margin: 0;
          font-family: var(--font-serif, "Playfair Display", Georgia, serif);
          font-size: 1.2rem;
          font-weight: 700;
          color: var(--cp-text) !important;
        }
        .ngo-modal-close {
          width: 34px;
          height: 34px;
          display: flex;
          align-items: center;
          justify-content: center;
          border: none;
          border-radius: 8px;
          background: transparent;
          color: var(--cp-muted);
          cursor: pointer;
        }
        .ngo-modal-close:hover { background: var(--cp-border); color: var(--cp-text); }
        .ngo-modal-body { padding: 22px; }
        .ngo-modal-body label { color: var(--cp-text-2) !important; }
        .ngo-modal-body select,
        .ngo-modal-body input,
        .ngo-modal-body textarea {
          width: 100%;
          min-height: 42px;
          border-radius: 10px !important;
          border: 1px solid var(--cp-border-strong) !important;
          background-color: var(--cp-subtle) !important;
          color: var(--cp-text) !important;
          font-family: inherit;
        }
        .ngo-modal-body select:focus,
        .ngo-modal-body input:focus,
        .ngo-modal-body textarea:focus {
          outline: none;
          border-color: var(--cp-gold) !important;
          box-shadow: 0 0 0 3px var(--cp-gold-tint);
        }
      `}</style>

      <div className="cp-page ngo-portal page-fade">
        {view === "home" ? (
          <>
        {/* ── Welcome banner ── */}
        <section className="cp-hero ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              {isVerified ? (
                <span className="cp-chip">
                  <CheckCircle2 size={13} strokeWidth={2.2} /> Accredited legal aid partner
                </span>
              ) : (
                <span className="cp-chip is-pending">
                  <AlertTriangle size={13} strokeWidth={2.2} /> Accreditation {user?.verificationStatus || "under review"}
                </span>
              )}

              <h1 className="cp-hero-title">
                {greeting}, <span>{user?.name || "Legal aid team"}</span>
              </h1>

              <p className="cp-hero-text">
                You have <strong>{pendingAidCount} aid {pendingAidCount === 1 ? "request" : "requests"}</strong> waiting for a decision,{" "}
                <strong>{activeCaseCount} active {activeCaseCount === 1 ? "case" : "cases"}</strong> and{" "}
                <strong>{activeMembersCount} panel {activeMembersCount === 1 ? "advocate" : "advocates"}</strong>.
              </p>

              <div className="cp-hero-actions">
                {pendingAidCount > 0 ? (
                  <button type="button" className="cp-btn-gold" onClick={() => goTo("aid_requests")}>
                    Review {pendingAidCount} aid {pendingAidCount === 1 ? "request" : "requests"} <ArrowRight size={16} strokeWidth={2.2} />
                  </button>
                ) : (
                  <button type="button" className="cp-btn-gold" onClick={() => goTo("active")}>
                    Open active cases <ArrowRight size={16} strokeWidth={2.2} />
                  </button>
                )}
                <button type="button" className="cp-btn-ghost" onClick={handleOpenInviteModal}>
                  <UserPlus size={16} /> Invite an advocate
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
                    <span className="cp-hearing-sub">Hearings your panel advocates record will appear here.</span>
                  </span>
                </div>
              )}

              <div className="cp-divider" />

              <div className="cp-availability">
                <div>
                  <strong>Panel strength</strong>
                  <span>
                    {activeMembersCount} active
                    {pendingInvitesCount > 0 ? ` · ${pendingInvitesCount} invitation${pendingInvitesCount === 1 ? "" : "s"} pending` : ""}
                  </span>
                </div>
                <button type="button" className="cp-btn-ghost" style={{ minHeight: 38, padding: "0 14px", fontSize: 13 }} onClick={() => goTo("panel_advocates")}>
                  Manage
                </button>
              </div>
            </div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Stat cards ── */}
          <section className="cp-stats" aria-label="Summary">
            <button type="button" className="cp-stat" onClick={() => goTo("aid_requests")}>
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Inbox size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Total intakes</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{stats.totalCases ?? 0}</span>
                <span className="cp-stat-note">All time</span>
              </div>
            </button>

            <button type="button" className="cp-stat" onClick={() => goTo("active")}>
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Scale size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Active pro bono</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{stats.activeCases ?? 0}</span>
                <span className="cp-stat-note">{(stats.resolvedCases ?? 0)} resolved</span>
              </div>
            </button>

            <button type="button" className="cp-stat" onClick={() => goTo("panel_advocates")}>
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Users size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Panel advocates</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{activeMembersCount}</span>
                <span className={`cp-stat-note${pendingInvitesCount > 0 ? " is-warn" : ""}`}>
                  {pendingInvitesCount > 0 ? `${pendingInvitesCount} invite${pendingInvitesCount === 1 ? "" : "s"} pending` : "Active members"}
                </span>
              </div>
            </button>

            <button type="button" className="cp-stat" onClick={() => goTo("aid_requests")}>
              <div className="cp-stat-head">
                <span className="cp-icon-tile"><Clock size={20} strokeWidth={1.8} /></span>
                <span className="cp-stat-label">Pending requests</span>
              </div>
              <div className="cp-stat-row">
                <span className="cp-stat-value">{stats.pendingRequests ?? pendingAidCount}</span>
                <span className={`cp-stat-note${pendingAidCount > 0 ? " is-warn" : ""}`}>
                  {pendingAidCount > 0 ? "Awaiting decision" : "All handled"}
                </span>
              </div>
            </button>
          </section>

          <div className="cp-layout">
            <div className="cp-home-main cp-home-grid">
              <TodayPriorities
                audience="ngo"
                cases={cases}
                pendingRequests={aidRequests.filter((r) => r.status === "pending")}
                onOpenTab={(id) => goTo(id === "requests" ? "aid_requests" : id)}
                limit={5}
              />

              {/* ── Recent cases (short list; everything else is on the Cases page) ── */}
              <section className="cp-card rc-card" aria-label="Recent cases">
                <div className="tp-head">
                  <div>
                    <h2 className="cp-section-title">Recent cases</h2>
                    <span className="cp-section-sub">Latest active pro bono matters</span>
                  </div>
                  <button type="button" className="cp-link" onClick={() => goTo("active")}>
                    All cases <ArrowRight size={15} strokeWidth={2.2} />
                  </button>
                </div>
                {recentCases.length === 0 ? (
                  <div className="tp-clear">
                    <Briefcase size={18} />
                    <span>No active cases yet. Accept an aid request and assign an advocate to get started.</span>
                  </div>
                ) : (
                  <ul className="rc-list">
                    {recentCases.map((c) => {
                      const stage = getCaseStage(c);
                      const next = getNextHearing(c, startOfToday);
                      const fresh = getUnread(c, user).total;
                      return (
                        <li key={c._id} className="rc-row">
                          <button type="button" className="rc-open" onClick={() => navigate(`/case/${c._id}`)}>
                            <span className="rc-main">
                              <strong>
                                {c.title}
                                {fresh > 0 && <span className="rc-new">{fresh} new</span>}
                              </strong>
                              <span>
                                {c.userId?.name || "Client"} · {c.lawyerId?.name ? `Adv. ${c.lawyerId.name.replace(/^adv\.?\s*/i, "")}` : "No advocate yet"}
                              </span>
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
                            <span className="rc-hearing" />
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
        ) : (
          <>
        <section className="cp-hero is-compact ll-on-dark">
          <div className="cp-hero-inner">
            <div className="cp-hero-main">
              <div className="cp-title-row">
                <span className="cp-hero-icon">
                  {view === "requests" ? <Inbox size={22} strokeWidth={1.8} /> : view === "panel" ? <Users size={22} strokeWidth={1.8} /> : <Briefcase size={22} strokeWidth={1.8} />}
                </span>
                <div>
                  <h1 className="cp-hero-title">{PAGE_COPY[view].title}</h1>
                  <p className="cp-hero-text">{PAGE_COPY[view].text}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="cp-main">
          {/* ── Work queues ── */}
          <section className="cp-matters rq-page ngo-queue">
            {view !== "panel" && (
            <div className="cp-matters-head">
              <div>
                <h2 className="cp-section-title">{PAGE_COPY[view].listTitle}</h2>
                <span className="cp-section-sub">{PAGE_COPY[view].listSub}</span>
              </div>
              <button type="button" className="cp-link" onClick={fetchData}>
                <RefreshCw size={14} strokeWidth={2.2} /> Refresh
              </button>
            </div>
            )}

            {viewTabs.length > 1 && (
            <div className="cp-tabs" role="tablist" aria-label="Work queues">
              {viewTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={tab === t.id}
                  className={`cp-tab${tab === t.id ? " is-active" : ""}`}
                  onClick={() => goTo(t.id)}
                >
                  {t.label}
                  <span className={`cp-tab-count${t.alert && tab !== t.id ? " is-alert" : ""}`}>{t.count}</span>
                </button>
              ))}
            </div>
            )}

            <div className="cp-matters-body" style={{ padding: "18px 0 0" }}>
          <div className="ngo-table-card">
            {loading ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#6b7280" }}>
                
                <div>Synchronizing active matter records...</div>
              </div>
            ) : tab === "aid_requests" ? (
              /* ── Aid Requests Table ── */
              aidRequests.length === 0 ? (
                <div style={{ textAlign: "center", padding: "60px 20px" }}>
                  
                  <h4 style={{ fontFamily: "var(--font-serif)", color: "var(--ll-text-primary)", marginBottom: 6 }}>No Aid Requests Yet</h4>
                  <p style={{ color: "#6b7280", fontSize: "0.88rem", margin: 0 }}>
                    Citizens will appear here when they request pro bono aid from your organization.
                  </p>
                </div>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="ngo-table">
                    <thead>
                      <tr>
                        <th>Request Title &amp; Reference</th>
                        <th>Category</th>
                        <th>Citizen / Applicant</th>
                        <th>Status</th>
                        <th>Submitted</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aidRequests.map((r) => {
                        const st = STATUS_CONFIG[r.status] || STATUS_CONFIG.pending;
                        return (
                          <tr key={r._id}>
                            <td>
                              <div className="ngo-case-title" style={{ fontWeight: 700, color: "var(--ll-text-primary)" }}>{r.title}</div>
                              <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>ID: {r._id.slice(-6).toUpperCase()}</div>
                            </td>
                            <td><span className="ngo-cat-pill">{r.category || "General Aid"}</span></td>
                            <td>
                              <div style={{ fontWeight: 600 }}>{r.userId?.name || "Anonymous"}</div>
                              <div style={{ fontSize: "0.76rem", color: "#6b7280" }}>{r.userId?.email || "Confidential"}</div>
                            </td>
                            <td>
                              <span className={`cp-pill ${st.tone}`}>
                                {st.label || r.status}
                              </span>
                            </td>
                            <td style={{ color: "#6b7280", fontSize: "0.82rem" }}>
                              {new Date(r.createdAt).toLocaleDateString("en-GB")}
                            </td>
                            <td>
                              <div className="ngo-action-btn-row" style={{ justifyContent: "flex-end" }}>
                                {r.status === "pending" && (
                                  <>
                                    <button
                                      className="ngo-tbl-btn primary"
                                      disabled={actionLoading}
                                      onClick={() => handleOpenAcceptAid(r)}
                                      title="Accept request and optionally assign handling advocate"
                                    >
                                      Accept
                                    </button>
                                    <button
                                      className="ngo-tbl-btn"
                                      style={{ borderColor: "#ef4444", color: "#ef4444" }}
                                      onClick={() => { setModalCase(r); setModalType("reject"); setFormInput(f => ({ ...f, rejectionReason: "" })); }}
                                    >
                                      Decline
                                    </button>
                                  </>
                                )}
                                {r.status !== "pending" && (
                                  <span style={{ color: "#6b7280", fontSize: "0.82rem", fontStyle: "italic" }}>
                                    {r.status === "accepted" ? "Accepted → Case opened" : "Declined"}
                                  </span>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )
            ) : tab === "panel_advocates" ? (
              /* ── Panel Advocates Table ── */
              <div>
                <div style={{ padding: "18px 24px", borderBottom: "1px solid #e5e7eb", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <h4 style={{ fontFamily: "var(--font-serif)", color: "var(--ll-text-primary)", margin: "0 0 4px", fontSize: "1.15rem", fontWeight: 700 }}>
                      Pro Bono Legal Aid Panel
                    </h4>
                    <p style={{ margin: 0, fontSize: "0.84rem", color: "#6b7280" }}>
                      Enrolled advocates authorized to represent citizens in pro bono matters under your organization.
                    </p>
                  </div>
                  <button
                    className="ngo-tbl-btn primary"
                    style={{ display: "inline-flex", alignItems: "center", gap: 6, padding: "8px 16px" }}
                    onClick={handleOpenInviteModal}
                  >
                    <UserPlus size={15} />
                    <span>Invite panel advocate</span>
                  </button>
                </div>

                {members.length === 0 ? (
                  <div style={{ padding: "32px 20px" }}>
                    <EmptyState
                      icon="users"
                      title="No Panel Advocates Enrolled"
                      description="Invite verified advocates by Bar Council ID or email to build your Pro Bono Legal Aid Panel. Once enrolled, you can assign them to represent citizens in court."
                      action={{ label: "Send Panel Invitation", onClick: handleOpenInviteModal }}
                    />
                  </div>
                ) : (
                  <div style={{ overflowX: "auto" }}>
                    <table className="ngo-table">
                      <thead>
                        <tr>
                          <th>Advocate Name</th>
                          <th>Bar Council ID</th>
                          <th>Practice Specialty</th>
                          <th>Designation &amp; Role</th>
                          <th>Status</th>
                          <th style={{ textAlign: "right" }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {members.map((m) => {
                          const lawyer = m.lawyerId || {};
                          const st = STATUS_CONFIG[m.status] || STATUS_CONFIG.pending_lawyer_approval;
                          const roleLabel = (m.role || "staff_advocate").replace("_", " ").toUpperCase();

                          return (
                            <tr key={m._id}>
                              <td>
                                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                                  <div
                                    style={{
                                      width: 36,
                                      height: 36,
                                      borderRadius: "50%",
                                      backgroundColor: "#0A3622",
                                      color: "#ffffff",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontWeight: 700,
                                      fontSize: "13px",
                                      flexShrink: 0
                                    }}
                                  >
                                    {lawyer.photo ? (
                                      <img
                                        src={lawyer.photo}
                                        alt={lawyer.name}
                                        style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                                      />
                                    ) : lawyer.name ? (
                                      lawyer.name.charAt(0).toUpperCase()
                                    ) : (
                                      "A"
                                    )}
                                  </div>
                                  <div>
                                    <div style={{ fontWeight: 700, color: "var(--ll-text-primary)" }}>
                                      Adv. {lawyer.name || "Advocate"}
                                    </div>
                                    <div style={{ fontSize: "0.76rem", color: "#6b7280" }}>
                                      {lawyer.email || lawyer.phone || "No contact on file"}
                                    </div>
                                  </div>
                                </div>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, fontFamily: "monospace", color: "#1e293b", fontSize: "0.85rem" }}>
                                  {lawyer.barCouncilId || "Pending Verification"}
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                                  {lawyer.city || "Pakistan"}
                                </div>
                              </td>
                              <td>
                                <span className="ngo-cat-pill">
                                  {Array.isArray(lawyer.specialization)
                                    ? lawyer.specialization.join(", ")
                                    : lawyer.specialization || "General Practice"}
                                </span>
                              </td>
                              <td>
                                <div style={{ fontWeight: 600, color: "#0F172A", fontSize: "0.88rem" }}>
                                  {m.designation || "Staff Advocate"}
                                </div>
                                <div style={{ fontSize: "0.74rem", color: "#64748B", letterSpacing: "0.4px" }}>
                                  {roleLabel}
                                </div>
                              </td>
                              <td>
                                <span
                                  className={`cp-pill ${st.tone}`}
                                >
                                  {st.label}
                                </span>
                              </td>
                              <td>
                                <div className="ngo-action-btn-row" style={{ justifyContent: "flex-end" }}>
                                  {m.status === "active" && (
                                    <button
                                      className="ngo-tbl-btn"
                                      style={{ borderColor: "#ef4444", color: "#dc2626" }}
                                      disabled={actionLoading}
                                      onClick={() => handleDeactivateMember(m._id)}
                                      title="Remove advocate from active legal aid panel"
                                    >
                                      Deactivate
                                    </button>
                                  )}
                                  {m.status === "pending_lawyer_approval" && (
                                    <button
                                      className="ngo-tbl-btn"
                                      style={{ borderColor: "#d1d5db", color: "#64748B" }}
                                      disabled={actionLoading}
                                      onClick={() => handleDeactivateMember(m._id)}
                                      title="Withdraw pending invitation"
                                    >
                                      Withdraw Invite
                                    </button>
                                  )}
                                  {(m.status === "declined" || m.status === "inactive") && (
                                    <span style={{ fontSize: "0.78rem", color: "#94a3b8", fontStyle: "italic" }}>
                                      Inactive
                                    </span>
                                  )}
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : filteredCases().length === 0 ? (
              <EmptyState
                icon="folder"
                title="No Records in This Category"
                description={`There are currently no matters categorized under "${tab}". All incoming intakes will appear here automatically.`}
              />
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="ngo-table">
                  <thead>
                    <tr>
                      <th>Case Title &amp; Reference</th>
                      <th>Category</th>
                      <th>Citizen / Applicant</th>
                      <th>Assigned Counsel</th>
                      <th>Status</th>
                      <th>Next Hearing</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredCases().map((c) => {
                      const st = STATUS_CONFIG[c.status] || STATUS_CONFIG.pending;
                      const nextHearing =
                        c.hearingDates && c.hearingDates.length > 0
                          ? new Date(c.hearingDates[c.hearingDates.length - 1].date).toLocaleDateString("en-GB")
                          : "Not Scheduled";

                      return (
                        <tr key={c._id}>
                          <td>
                            <div className="ngo-case-title" style={{ fontWeight: 700, color: "var(--ll-text-primary)" }}>{c.title}</div>
                            <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                              ID: {c._id.slice(-6).toUpperCase()}
                            </div>
                          </td>
                          <td>
                            <span className="ngo-cat-pill">
                              {c.category || "General Aid"}
                            </span>
                          </td>
                          <td>
                            <div style={{ fontWeight: 600 }}>{c.user?.name || "Anonymous Citizen"}</div>
                            <div style={{ fontSize: "0.76rem", color: "#6b7280" }}>
                              {c.user?.email || c.user?.phone || "Confidential"}
                            </div>
                          </td>
                          <td>
                            {c.lawyerId ? (
                              <div>
                                <div style={{ fontWeight: 600, color: "var(--ll-brand-green)", display: "flex", alignItems: "center", gap: 5 }}>
                                  <Shield size={13} color="#0A3622" />
                                  <span>Adv. {c.lawyerId.name}</span>
                                </div>
                                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                                  ID: {c.lawyerId.barCouncilId || "Counsel"}
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#d97706", fontSize: "0.82rem", fontStyle: "italic", display: "inline-flex", alignItems: "center", gap: 4 }}>
                                <Clock size={12} />
                                <span>To Be Assigned</span>
                              </span>
                            )}
                          </td>
                          <td>
                            <span
                              className={`cp-pill ${st.tone}`}
                            >
                              {st.label}
                            </span>
                          </td>
                          <td>
                            <span style={{ color: nextHearing !== "Not Scheduled" ? "#0A3622" : "#6b7280", fontWeight: 600 }}>
                              {nextHearing}
                            </span>
                          </td>
                          <td>
                            <div className="ngo-action-btn-row" style={{ justifyContent: "flex-end" }}>
                              <button
                                className="ngo-tbl-btn primary"
                                onClick={() => navigate(`/case/${c._id}`)}
                              >
                                View Record
                              </button>
                              <button
                                className="ngo-tbl-btn"
                                onClick={() => handleOpenReassign(c)}
                                title="Assign or transfer case advocate"
                              >
                                {c.lawyerId ? "Reassign Counsel" : "Assign Counsel"}
                              </button>
                              <button
                                className="ngo-tbl-btn"
                                onClick={() => openModal(c, "status")}
                              >
                                Status
                              </button>
                              <button
                                className="ngo-tbl-btn"
                                onClick={() => openModal(c, "hearing")}
                              >
                                Hearing
                              </button>
                              <button
                                className="ngo-tbl-btn"
                                onClick={() => openModal(c, "message")}
                              >
                                Chat
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
            </div>
          </section>
        </div>
          </>
        )}

        {/* ── Status Update Modal ── */}
        {modalType === "status" && modalCase && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <h3 className="ngo-modal-title">Update Legal Matter Status</h3>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <p style={{ fontSize: "0.88rem", color: "#4b5563", marginBottom: 16 }}>
                  Case: <strong>{modalCase.title}</strong>
                </p>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    New Administrative / Legal Status
                  </label>
                  <select
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" }}
                    value={formInput.status}
                    onChange={(e) => setFormInput({ ...formInput, status: e.target.value })}
                  >
                    <option value="pending">Pending Evaluation</option>
                    <option value="under_review">Under Formal Evaluation</option>
                    <option value="assigned">Counsel Assigned</option>
                    <option value="in_progress">In Active Litigation / Defense</option>
                    <option value="resolved">Disposed / Resolved</option>
                    <option value="rejected">Intake Declined</option>
                  </select>
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Cancel</button>
                  <button className="ngo-tbl-btn primary" onClick={handleStatusUpdate} disabled={actionLoading}>
                    {actionLoading ? <><span className="btn-spinner" />Updating…</> : "Confirm Status Update"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Hearing Modal ── */}
        {modalType === "hearing" && modalCase && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <h3 className="ngo-modal-title">Record / Schedule Hearing Date</h3>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <p style={{ fontSize: "0.88rem", color: "#4b5563", marginBottom: 16 }}>
                  Case: <strong>{modalCase.title}</strong>
                </p>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Court Hearing Date *
                  </label>
                  <input
                    type="date"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={formInput.hearingDate}
                    onChange={(e) => setFormInput({ ...formInput, hearingDate: e.target.value })}
                    required
                  />
                </div>
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Hearing Directives / Cause Notes
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Court of Civil Judge, Lahore - Arguments on Stay Application"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={formInput.hearingNotes}
                    onChange={(e) => setFormInput({ ...formInput, hearingNotes: e.target.value })}
                  />
                </div>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Courtroom Outcome / Order Summary
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Summary of judicial order passed or adjourned date reasons..."
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={formInput.hearingOutcome}
                    onChange={(e) => setFormInput({ ...formInput, hearingOutcome: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Cancel</button>
                  <button className="ngo-tbl-btn primary" onClick={handleHearing} disabled={actionLoading}>
                    {actionLoading ? <><span className="btn-spinner" />Scheduling…</> : "Save Hearing Record"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Client Message Modal ── */}
        {modalType === "message" && modalCase && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" style={{ maxWidth: 640 }} onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <MessageSquare size={18} color="#0A3622" />
                  <h3 className="ngo-modal-title">Direct Communications with Client</h3>
                </div>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                  <div style={{ fontSize: "0.85rem", color: "#4b5563" }}>
                    Matter: <strong>{modalCase.title}</strong> • Client: <strong>{modalCase.user?.name || "Applicant Citizen"}</strong>
                  </div>
                  <span style={{ fontSize: "0.75rem", color: "#059669", display: "flex", alignItems: "center", gap: 4, fontWeight: 600 }}>
                    <span style={{ width: 6, height: 6, borderRadius: "50%", backgroundColor: "#10B981", display: "inline-block" }}></span>
                    Live Channel Active
                  </span>
                </div>

                {/* Message Log Thread */}
                <div
                  ref={ngoChatEndRef}
                  style={{
                    backgroundColor: "#f8fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: 14,
                    maxHeight: 250,
                    overflowY: "auto",
                    display: "flex",
                    flexDirection: "column",
                    gap: 10,
                    marginBottom: 16
                  }}
                >
                  {modalCase.messages && modalCase.messages.length > 0 ? (
                    modalCase.messages.map((m, idx) => {
                      const isMe = m.senderType === "ngo" || m.senderId === user?.id;
                      return (
                        <div
                          key={idx}
                          style={{
                            alignSelf: isMe ? "flex-end" : "flex-start",
                            maxWidth: "80%",
                            backgroundColor: isMe ? "#1E3F2E" : "#ffffff",
                            color: isMe ? "#ffffff" : "#0f172a",
                            border: isMe ? "none" : "1px solid #e2e8f0",
                            borderRadius: 8,
                            padding: "8px 12px",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
                          }}
                        >
                          <div style={{ fontSize: "0.72rem", opacity: 0.8, marginBottom: 2 }}>
                            {isMe ? "You (NGO Representative)" : `${modalCase.user?.name || "Client"}`}
                            {" • "}
                            {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                          </div>
                          <div style={{ fontSize: "0.85rem", lineHeight: 1.4 }}>{m.message}</div>
                        </div>
                      );
                    })
                  ) : (
                    <div style={{ textAlign: "center", color: "#94a3b8", fontSize: "0.82rem", padding: "16px 0" }}>
                      No direct communications recorded yet. Dispatch instructions, document requests, or hearing updates below.
                    </div>
                  )}
                </div>

                {/* Message Input Box */}
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    handleMessage();
                  }}
                  style={{ display: "flex", gap: 8 }}
                >
                  <input
                    type="text"
                    placeholder="Enter official instructions, requested documents, or next steps..."
                    style={{ flex: 1, padding: "10px 14px", border: "1px solid #d1d5db", borderRadius: 8, fontSize: "0.88rem", outline: "none" }}
                    value={formInput.message}
                    onChange={(e) => setFormInput({ ...formInput, message: e.target.value })}
                  />
                  <button
                    type="submit"
                    className="ngo-tbl-btn primary"
                    disabled={actionLoading || !formInput.message.trim()}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "10px 18px",
                      opacity: actionLoading || !formInput.message.trim() ? 0.6 : 1
                    }}
                  >
                    <span>{actionLoading ? <><span className="btn-spinner" />Sending…</> : "Send"}</span>
                    <Send size={14} />
                  </button>
                </form>

                <div style={{ display: "flex", justifyContent: "flex-end", marginTop: 14 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Close Channel</button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Reject Aid Request Modal ── */}
        {modalType === "reject" && modalCase && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <h3 className="ngo-modal-title">Decline Aid Request</h3>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <p style={{ fontSize: "0.88rem", color: "#4b5563", marginBottom: 16 }}>
                  Declining request: <strong>{modalCase.title}</strong> from <strong>{modalCase.userId?.name || 'citizen'}</strong>.
                </p>
                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Reason for Declining (Optional)
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Case falls outside our current service areas, capacity constraints..."
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={formInput.rejectionReason}
                    onChange={(e) => setFormInput({ ...formInput, rejectionReason: e.target.value })}
                  />
                </div>
                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Cancel</button>
                  <button
                    className="ngo-tbl-btn"
                    style={{ background: "#ef4444", borderColor: "#ef4444", color: "#fff" }}
                    onClick={handleRejectAidRequest}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <><span className="btn-spinner" />Declining…</> : "Confirm Decline"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Accept Aid Request Modal with Optional Counsel Assignment ── */}
        {modalType === "accept_aid" && modalCase && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Building2 size={18} color="#0A3622" />
                  <h3 className="ngo-modal-title">Accept Aid Request &amp; Open Case</h3>
                </div>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <p style={{ fontSize: "0.88rem", color: "#4b5563", marginBottom: 16 }}>
                  Matter: <strong>{modalCase.title}</strong> • Applicant: <strong>{modalCase.userId?.name || "Citizen"}</strong>
                </p>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Assign Handling Advocate (Optional)
                  </label>
                  <select
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" }}
                    value={selectedLawyerId}
                    onChange={(e) => setSelectedLawyerId(e.target.value)}
                  >
                    <option value="">-- To Be Assigned (Leave Unassigned for Now) --</option>
                    {members
                      .filter((m) => m.status === "active" && m.lawyerId)
                      .map((m) => (
                        <option key={m.lawyerId._id} value={m.lawyerId._id}>
                          Adv. {m.lawyerId.name} ({m.designation} • Bar ID: {m.lawyerId.barCouncilId})
                        </option>
                      ))}
                  </select>
                  <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 6 }}>
                    Only verified lawyers with an <strong>active</strong> panel membership appear in this roster. If assigned, the advocate will receive immediate docket assignment notifications.
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Cancel</button>
                  <button
                    className="ngo-tbl-btn primary"
                    onClick={handleConfirmAcceptAid}
                    disabled={actionLoading}
                  >
                    {actionLoading ? <><span className="btn-spinner" />Processing…</> : "Confirm & Open Case"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Reassign Legal Counsel Modal ── */}
        {modalType === "reassign" && modalCase && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <Users size={18} color="#0A3622" />
                  <h3 className="ngo-modal-title">
                    {modalCase.lawyerId ? "Reassign Legal Counsel" : "Assign Handling Legal Counsel"}
                  </h3>
                </div>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <div style={{ fontSize: "0.85rem", color: "#4b5563", marginBottom: 14 }}>
                  Case: <strong>{modalCase.title}</strong>
                  <br />
                  Current Counsel:{" "}
                  <strong>
                    {modalCase.lawyerId
                      ? `Adv. ${modalCase.lawyerId.name} (Bar ID: ${modalCase.lawyerId.barCouncilId || "N/A"})`
                      : "Unassigned (Awaiting NGO Staff Assignment)"}
                  </strong>
                </div>

                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Select Advocate from Active Panel *
                  </label>
                  <select
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" }}
                    value={selectedLawyerId}
                    onChange={(e) => setSelectedLawyerId(e.target.value)}
                    required
                  >
                    <option value="">-- Choose Active Panel Advocate --</option>
                    {members
                      .filter((m) => m.status === "active" && m.lawyerId && m.lawyerId._id !== (modalCase.lawyerId?._id || modalCase.lawyerId))
                      .map((m) => (
                        <option key={m.lawyerId._id} value={m.lawyerId._id}>
                          Adv. {m.lawyerId.name} ({m.designation} • Bar ID: {m.lawyerId.barCouncilId})
                        </option>
                      ))}
                  </select>
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Reason for Assignment / Reassignment *
                  </label>
                  <textarea
                    rows={3}
                    placeholder="e.g. Schedule conflict with court appearance; transfer to specialist counsel..."
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={reassignReason}
                    onChange={(e) => setReassignReason(e.target.value)}
                    required
                  />
                  <div style={{ fontSize: "0.78rem", color: "#6b7280", marginTop: 4 }}>
                    This reason is recorded in the official counsel chain-of-custody docket and dispatched to the citizen and advocates.
                  </div>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Cancel</button>
                  <button
                    className="ngo-tbl-btn primary"
                    onClick={handleConfirmReassign}
                    disabled={actionLoading || !selectedLawyerId || !reassignReason.trim()}
                  >
                    {actionLoading ? "Updating Counsel..." : "Confirm Assignment"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Invite Panel Advocate Modal ── */}
        {modalType === "invite_advocate" && (
          <div className="ngo-modal-bg" onClick={closeModal}>
            <div className="ngo-modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="ngo-modal-header">
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <UserPlus size={18} color="#0A3622" />
                  <h3 className="ngo-modal-title">Invite Advocate to Legal Aid Panel</h3>
                </div>
                <button className="ngo-modal-close" onClick={closeModal} aria-label="Close"><X size={18} /></button>
              </div>
              <div className="ngo-modal-body">
                <div
                  style={{
                    backgroundColor: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    borderRadius: 8,
                    padding: "10px 14px",
                    marginBottom: 16,
                    fontSize: "0.82rem",
                    color: "#1e40af",
                    lineHeight: 1.4
                  }}
                >
                  <strong>Consent-Based Enrollment:</strong> Sending this invitation notifies the advocate immediately. The advocate must review and explicitly accept from their dashboard before they can be assigned to cases.
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Bar Council ID or Registered Email *
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. BC-12345/LHR or lawyer@legallink.pk"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={inviteForm.identifier}
                    onChange={(e) => setInviteForm({ ...inviteForm, identifier: e.target.value })}
                    required
                  />
                </div>

                <div style={{ marginBottom: 14 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Designation / Title Offered
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Senior Pro Bono Counsel, Bail Specialist, Staff Advocate"
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem", boxSizing: "border-box" }}
                    value={inviteForm.designation}
                    onChange={(e) => setInviteForm({ ...inviteForm, designation: e.target.value })}
                  />
                </div>

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: "block", fontSize: "0.82rem", fontWeight: 600, color: "#374151", marginBottom: 6 }}>
                    Panel Engagement Role
                  </label>
                  <select
                    style={{ width: "100%", padding: "10px 12px", border: "1px solid #d1d5db", borderRadius: 6, fontSize: "0.9rem" }}
                    value={inviteForm.role}
                    onChange={(e) => setInviteForm({ ...inviteForm, role: e.target.value })}
                  >
                    <option value="staff_advocate">Staff Advocate (In-House Legal Aid)</option>
                    <option value="panel_volunteer">Panel Volunteer (Pro Bono Volunteer)</option>
                    <option value="lead_counsel">Lead Counsel (Senior Oversight)</option>
                  </select>
                </div>

                <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                  <button className="ngo-tbl-btn" onClick={closeModal}>Cancel</button>
                  <button
                    className="ngo-tbl-btn primary"
                    onClick={handleSendInvite}
                    disabled={actionLoading || !inviteForm.identifier.trim()}
                  >
                    {actionLoading ? <><span className="btn-spinner" />Sending…</> : "Send Panel Invitation"}
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Toast Alert */}
        {toast && (
          <div className="cp-toast" role="status">
            <CheckCircle2 size={18} />
            <span>{toast}</span>
          </div>
        )}
      </div>
      <Footer showCta={false} />
    </>
  );
};

export default NGODashboard;
