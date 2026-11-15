import React, { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { useRealTime } from "../contexts/RealTimeContext";
import { caseAPI, disputeAPI, reviewAPI } from "../services/api";

// Portal-specific Navbars
import Navbar from "../components/Navbar";
import "../styles/counselPortal.css";
import LawyerNavbar from "../components/LawyerNavbar";
import NGONavbar from "../components/NGONavbar";
import AdminNavbar from "../components/AdminNavbar";

import EmptyState from "../components/EmptyState";
import { Sk } from "../components/SkeletonLoader";
import AnimatedStepper from "../components/AnimatedStepper";
import { openFile } from "../services/files";
import CaseTimeline from "../components/case/CaseTimeline";
import { notify } from "../components/Toast";
import { getCaseStage, getHearingStatus, isLiveHearing, getUnread, withSeen } from "../utils/caseStage";

import {
  History,
  Scale,
  Briefcase,
  Calendar,
  Clock,
  UserCheck,
  CheckCircle2,
  AlertCircle,
  FileText,
  Send,
  Upload,
  ExternalLink,
  ArrowLeft,
  User,
  Phone,
  Mail,
  Shield,
  MessageSquare,
  Star,
  AlertTriangle,
  X,
  Plus,
  Edit3,
  MoreHorizontal,
  ArrowRight,
  Building2,
  Paperclip,
  CheckCircle,
  FileCheck,
  FolderOpen,
  Lock,
  FileClock,
  ChevronDown,
  ChevronUp
} from "lucide-react";

export default function CaseDetails() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { socket } = useRealTime();

  // Primary state
  const [caseData, setCaseData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState(null);

  // Mobile layout state: "overview" | "hearings" | "docket" | "chat"
  const [activeTab, setActiveTab] = useState("overview");
  const [chatOpen, setChatOpen] = useState(false);
  const [factsOpen, setFactsOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);

  // Chat message input & sending state
  const [chatInput, setChatInput] = useState("");
  const [sendingMsg, setSendingMsg] = useState(false);
  const [chatFeedback, setChatFeedback] = useState(null);
  const messagesEndRef = useRef(null);

  // Inline action states & Modals
  const [showHearingModal, setShowHearingModal] = useState(false);
  const [hearingForm, setHearingForm] = useState({
    date: "",
    notes: "",
    outcome: "",
    status: "scheduled"
  });
  const [submittingHearing, setSubmittingHearing] = useState(false);
  const [hearingFeedback, setHearingFeedback] = useState(null);

  const [showEditHearingModal, setShowEditHearingModal] = useState(false);
  const [editingHearingId, setEditingHearingId] = useState(null);
  const [editHearingForm, setEditHearingForm] = useState({
    date: "",
    notes: "",
    outcome: "",
    status: "scheduled"
  });
  const [submittingEditHearing, setSubmittingEditHearing] = useState(false);
  const [editHearingFeedback, setEditHearingFeedback] = useState(null);

  const [showAnalysisModal, setShowAnalysisModal] = useState(false);
  const [analysisText, setAnalysisText] = useState("");
  const [submittingAnalysis, setSubmittingAnalysis] = useState(false);
  const [analysisFeedback, setAnalysisFeedback] = useState(null);

  const [showUploadModal, setShowUploadModal] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [docName, setDocName] = useState("");
  const [docUrl, setDocUrl] = useState("");
  const [uploadMode, setUploadMode] = useState("file"); // "file" | "url"
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [uploadFeedback, setUploadFeedback] = useState(null);

  const [showStatusModal, setShowStatusModal] = useState(false);
  const [newStatus, setNewStatus] = useState("");
  const [statusNotes, setStatusNotes] = useState("");
  const [updatingStatus, setUpdatingStatus] = useState(false);
  const [statusFeedback, setStatusFeedback] = useState(null);
  const [showAssignmentHistory, setShowAssignmentHistory] = useState(true);

  const [showDisputeModal, setShowDisputeModal] = useState(false);
  const [disputeForm, setDisputeForm] = useState({
    title: "",
    reason: "Abandoned Case",
    description: ""
  });
  const [submittingDispute, setSubmittingDispute] = useState(false);
  const [disputeFeedback, setDisputeFeedback] = useState(null);

  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewForm, setReviewForm] = useState({
    rating: 5,
    title: "",
    comment: ""
  });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewFeedback, setReviewFeedback] = useState(null);

  // Role permissions
  const role = user?.role || "user";
  const isCounsel = role === "lawyer" || role === "ngo";
  const isAdmin = role === "admin";
  const canManageCase = isCounsel || isAdmin;
  const isCitizen = role === "user";

  // Fresh Case Fetcher on mount / id change
  const fetchCase = async () => {
    try {
      setLoading(true);
      setFetchError(null);
      const res = await caseAPI.getCase(id);
      const data = res.data;
      setCaseData(data);
      setNewStatus(data.status || "pending");
      setAnalysisText(data.caseAnalysis || data.analysis || "");
    } catch (err) {
      console.error("Error fetching case file:", err);
      const status = err.response?.status;
      if (status === 403) {
        setFetchError({
          code: 403,
          title: "Access Restricted Docket",
          message: "You are not authorized to access this confidential case docket. Access is strictly limited to the verified client, assigned legal counsel, and judicial administrators."
        });
      } else if (status === 404) {
        setFetchError({
          code: 404,
          title: "Docket Not Found",
          message: `Case docket reference #${id} could not be located in the central registry.`
        });
      } else {
        setFetchError({
          code: 500,
          title: "Registry Connection Failure",
          message: err.response?.data?.message || "An unexpected error occurred while synchronizing docket records."
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      fetchCase();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Real-time Socket.IO synchronization
  useEffect(() => {
    if (!socket || !id) return;

    // Join dedicated case room
    socket.emit("join-case", id);

    const handleCaseMessage = (payload) => {
      if (payload?.caseId === id && payload.message) {
        setCaseData((prev) => {
          if (!prev) return prev;
          const currentMsgs = prev.messages || [];
          const exists = currentMsgs.some(
            (m) =>
              (m._id && payload.message._id && m._id === payload.message._id) ||
              (m.senderId === payload.message.senderId &&
                m.message === payload.message.message &&
                Math.abs(new Date(m.timestamp) - new Date(payload.message.timestamp)) < 2000)
          );
          if (exists) return prev;
          return {
            ...prev,
            messages: [...currentMsgs, payload.message]
          };
        });
      }
    };

    const handleStatusUpdated = (payload) => {
      if (payload?.caseId === id) {
        setCaseData((prev) => (prev ? { ...prev, status: payload.status } : prev));
        setNewStatus(payload.status);
      }
    };

    const handleHearingAdded = (payload) => {
      if (payload?.caseId === id && payload.hearing) {
        setCaseData((prev) => {
          if (!prev) return prev;
          const prevHearings = prev.hearings || prev.hearingDates || [];
          return {
            ...prev,
            hearings: [...prevHearings, payload.hearing],
            hearingDates: [...prevHearings, payload.hearing]
          };
        });
      }
    };

    const handleHearingUpdated = (payload) => {
      if (payload?.caseId === id && payload.hearing) {
        setCaseData((prev) => {
          if (!prev) return prev;
          const targetHId = payload.hearingId || payload.hearing._id;
          const updateList = (list) =>
            (list || []).map((h) =>
              String(h._id) === String(targetHId) ? { ...h, ...payload.hearing } : h
            );
          return {
            ...prev,
            hearings: updateList(prev.hearings),
            hearingDates: updateList(prev.hearingDates)
          };
        });
      }
    };

    const handleDocumentAdded = (payload) => {
      if (payload?.caseId === id && payload.document) {
        setCaseData((prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            documents: [...(prev.documents || []), payload.document]
          };
        });
      }
    };

    socket.on("case-message", handleCaseMessage);
    socket.on("case-status-updated", handleStatusUpdated);
    socket.on("case-hearing-added", handleHearingAdded);
    socket.on("case-hearing-updated", handleHearingUpdated);
    socket.on("case-document-added", handleDocumentAdded);

    return () => {
      socket.emit("leave-case", id);
      socket.off("case-message", handleCaseMessage);
      socket.off("case-status-updated", handleStatusUpdated);
      socket.off("case-hearing-added", handleHearingAdded);
      socket.off("case-hearing-updated", handleHearingUpdated);
      socket.off("case-document-added", handleDocumentAdded);
    };
  }, [socket, id]);

  // Auto-scroll chat to latest message
  useEffect(() => {
    const list = messagesEndRef.current?.parentElement;
    if (list) list.scrollTop = list.scrollHeight;
  }, [caseData?.messages, chatOpen]);

  // Close the chat panel / menu with Escape
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") {
        setChatOpen(false);
        setMoreOpen(false);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Back to dashboard route
  const getDashboardRoute = () => {
    if (role === "lawyer") return "/lawyer/dashboard";
    if (role === "ngo") return "/ngo/dashboard";
    if (role === "admin") return "/admin/dashboard";
    return "/user/dashboard";
  };

  // Chat message sender
  const handleSendMessage = async (e) => {
    if (e) e.preventDefault();
    const text = chatInput.trim();
    if (!text || sendingMsg) return;

    setSendingMsg(true);
    setChatFeedback(null);
    try {
      const res = await caseAPI.addMessage(id, text);
      setChatInput("");
      if (res.data?.case) {
        setCaseData((prev) => ({
          ...prev,
          messages: res.data.case.messages || prev.messages
        }));
      }
    } catch (err) {
      console.error("Failed to send message:", err);
      setChatFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to dispatch message. Please retry."
      });
      setTimeout(() => setChatFeedback(null), 4000);
    } finally {
      setSendingMsg(false);
    }
  };

  // Add Hearing
  const handleScheduleHearing = async (e) => {
    e.preventDefault();
    if (!hearingForm.date) return;
    setSubmittingHearing(true);
    setHearingFeedback(null);
    try {
      const res = await caseAPI.addHearing(id, hearingForm);
      if (res.data?.case) {
        setCaseData((prev) => ({
          ...prev,
          hearings: res.data.case.hearingDates || prev.hearings,
          hearingDates: res.data.case.hearingDates || prev.hearingDates
        }));
      }
      setHearingFeedback({ type: "success", text: "Court hearing successfully scheduled." });
      setHearingForm({ date: "", notes: "", outcome: "", status: "scheduled" });
      setTimeout(() => {
        setShowHearingModal(false);
        setHearingFeedback(null);
      }, 1200);
    } catch (err) {
      console.error("Failed to schedule hearing:", err);
      setHearingFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to schedule court proceeding."
      });
    } finally {
      setSubmittingHearing(false);
    }
  };

  // Open Edit Hearing Proceeding Modal
  const handleOpenEditHearing = (hearing) => {
    setEditingHearingId(hearing._id);
    let dateVal = "";
    if (hearing.date) {
      const d = new Date(hearing.date);
      dateVal = !isNaN(d.getTime()) ? d.toISOString().slice(0, 16) : "";
    }
    setEditHearingForm({
      date: dateVal,
      notes: hearing.notes || "",
      outcome: hearing.outcome || "",
      status: hearing.status || "scheduled"
    });
    setEditHearingFeedback(null);
    setShowEditHearingModal(true);
  };

  // Update Hearing Proceeding Handler
  const handleUpdateHearingSubmit = async (e) => {
    e.preventDefault();
    if (!editHearingForm.date) {
      setEditHearingFeedback({ type: "error", text: "Please specify hearing date and time." });
      return;
    }
    setSubmittingEditHearing(true);
    setEditHearingFeedback(null);
    try {
      const res = await caseAPI.updateHearing(id, editingHearingId, editHearingForm);
      if (res.data?.case) {
        setCaseData((prev) => ({
          ...prev,
          hearings: res.data.case.hearingDates || prev.hearings,
          hearingDates: res.data.case.hearingDates || prev.hearingDates
        }));
      } else if (res.data?.hearing) {
        setCaseData((prev) => {
          const updateList = (list) =>
            (list || []).map((h) =>
              String(h._id) === String(editingHearingId) ? { ...h, ...res.data.hearing } : h
            );
          return {
            ...prev,
            hearings: updateList(prev.hearings),
            hearingDates: updateList(prev.hearingDates)
          };
        });
      }
      setEditHearingFeedback({ type: "success", text: "Court proceeding details updated." });
      setTimeout(() => {
        setShowEditHearingModal(false);
        setEditHearingFeedback(null);
      }, 1000);
    } catch (err) {
      console.error("Failed to update hearing proceeding:", err);
      setEditHearingFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to update hearing proceeding."
      });
    } finally {
      setSubmittingEditHearing(false);
    }
  };

  // Update Legal Strategy / Analysis
  const handleSaveAnalysis = async (e) => {
    e.preventDefault();
    setSubmittingAnalysis(true);
    setAnalysisFeedback(null);
    try {
      await caseAPI.updateAnalysis(id, analysisText);
      setCaseData((prev) => ({
        ...prev,
        caseAnalysis: analysisText,
        analysis: analysisText
      }));
      setAnalysisFeedback({ type: "success", text: "Legal docket strategy updated." });
      setTimeout(() => {
        setShowAnalysisModal(false);
        setAnalysisFeedback(null);
      }, 1200);
    } catch (err) {
      console.error("Failed to update analysis:", err);
      setAnalysisFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to update legal strategy."
      });
    } finally {
      setSubmittingAnalysis(false);
    }
  };

  // Upload Evidence / Document
  const handleUploadDocument = async (e) => {
    e.preventDefault();
    setUploadingDoc(true);
    setUploadFeedback(null);
    try {
      let res;
      if (uploadMode === "file") {
        if (!selectedFile) {
          setUploadFeedback({ type: "error", text: "Please select a file to upload." });
          setUploadingDoc(false);
          return;
        }
        const formData = new FormData();
        formData.append("file", selectedFile);
        if (docName) formData.append("name", docName);
        res = await caseAPI.uploadDocument(id, formData);
      } else {
        if (!docUrl.trim()) {
          setUploadFeedback({ type: "error", text: "Please provide a valid document URL." });
          setUploadingDoc(false);
          return;
        }
        res = await caseAPI.attachDocument(id, {
          name: docName.trim() || "Vault Evidence File",
          url: docUrl.trim()
        });
      }

      if (res.data?.document) {
        setCaseData((prev) => ({
          ...prev,
          documents: [...(prev.documents || []), res.data.document]
        }));
      }
      setUploadFeedback({ type: "success", text: "Evidence document secured in case vault." });
      setSelectedFile(null);
      setDocName("");
      setDocUrl("");
      setTimeout(() => {
        setShowUploadModal(false);
        setUploadFeedback(null);
      }, 1200);
    } catch (err) {
      console.error("Failed to attach evidence:", err);
      setUploadFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to secure document in case vault."
      });
    } finally {
      setUploadingDoc(false);
    }
  };

  // Update Status
  const handleUpdateStatus = async (statusValue) => {
    setUpdatingStatus(true);
    setStatusFeedback(null);
    try {
      await caseAPI.updateStatus(id, statusValue, statusNotes);
      setCaseData((prev) => ({ ...prev, status: statusValue }));
      setNewStatus(statusValue);
      setStatusFeedback({ type: "success", text: `Case status changed to ${statusValue.replace("_", " ").toUpperCase()}` });
      setTimeout(() => {
        setShowStatusModal(false);
        setStatusFeedback(null);
      }, 1000);
    } catch (err) {
      console.error("Failed to update status:", err);
      setStatusFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to update case status."
      });
    } finally {
      setUpdatingStatus(false);
    }
  };

  // File Citizen Dispute
  const handleFileDispute = async (e) => {
    e.preventDefault();
    setSubmittingDispute(true);
    setDisputeFeedback(null);
    try {
      await disputeAPI.fileDispute({
        caseId: id,
        category: disputeForm.reason,
        description: disputeForm.title
          ? `${disputeForm.title.trim()}\n\n${disputeForm.description}`
          : disputeForm.description
      });
      setDisputeFeedback({ type: "success", text: "Dispute registered. An administrator will review your notice." });
      setTimeout(() => {
        setShowDisputeModal(false);
        setDisputeFeedback(null);
        setDisputeForm({ title: "", reason: "Abandoned Case", description: "" });
      }, 1500);
    } catch (err) {
      console.error("Failed to file dispute:", err);
      setDisputeFeedback({
        type: "error",
        text: err.response?.data?.message || "Failed to submit dispute."
      });
    } finally {
      setSubmittingDispute(false);
    }
  };

  // Submit Citizen Review
  const handleSubmitReview = async (e) => {
    e.preventDefault();
    setSubmittingReview(true);
    setReviewFeedback(null);
    try {
      const targetType = caseData.caseType === "pro_bono" || caseData.ngoId ? "ngo" : "lawyer";
      const targetId = caseData.lawyerId?._id || caseData.ngoId?._id ||
        (typeof caseData.lawyerId === 'string' ? caseData.lawyerId : null) ||
        (typeof caseData.ngoId === 'string' ? caseData.ngoId : null);
      if (!targetId) {
        throw new Error("No counsel assigned to review.");
      }
      await reviewAPI.createReview({
        caseId: id,
        targetType,
        targetId,
        rating: reviewForm.rating,
        title: reviewForm.title,
        comment: reviewForm.comment
      });
      setReviewFeedback({ type: "success", text: "Thank you! Your verified counsel review has been recorded." });
      setTimeout(() => {
        setShowReviewModal(false);
        setReviewFeedback(null);
      }, 1500);
    } catch (err) {
      console.error("Failed to submit review:", err);
      setReviewFeedback({
        type: "error",
        text: err.response?.data?.message || err.message || "Failed to submit review."
      });
    } finally {
      setSubmittingReview(false);
    }
  };

  // Helper formatting badges
  const renderStatusBadge = (status) => {
    const s = (status || "pending").toLowerCase();
    switch (s) {
      case "assigned":
        return <span className="badge-semantic badge-info"><CheckCircle2 size={12} /> Assigned</span>;
      case "in_progress":
        return <span className="badge-semantic badge-info"><Clock size={12} /> In Progress</span>;
      case "under_review":
        return <span className="badge-semantic badge-warning"><AlertCircle size={12} /> Under Review</span>;
      case "resolved":
        return <span className="badge-semantic badge-success"><CheckCircle size={12} /> Resolved</span>;
      case "closed":
        return <span className="badge-semantic badge-neutral"><FileCheck size={12} /> Closed</span>;
      default:
        return <span className="badge-semantic badge-warning"><Clock size={12} /> Pending</span>;
    }
  };

  const renderPriorityBadge = (priority) => {
    const p = (priority || "medium").toLowerCase();
    if (p === "urgent") return <span className="badge-semantic badge-danger">Urgent Priority</span>;
    if (p === "high") return <span className="badge-semantic badge-warning">High Priority</span>;
    if (p === "low") return <span className="badge-semantic badge-neutral">Low Priority</span>;
    return <span className="badge-semantic badge-info">Medium Priority</span>;
  };

  // Render Role-appropriate Navbar (Requirement 11)
  const renderNavbar = () => {
    if (role === "lawyer") return <LawyerNavbar />;
    if (role === "ngo") return <NGONavbar />;
    if (role === "admin") return <AdminNavbar />;
    return <Navbar />;
  };

  // Render Loading Skeleton State
  // ── Unread counts: items from others since I last opened each section ──
  const unread = getUnread(caseData, user);
  const seenPending = useRef({});
  const markSeen = useCallback(
    async (section) => {
      if (!caseData?._id || seenPending.current[section]) return;
      seenPending.current[section] = true;
      try {
        const res = await caseAPI.markSeen(caseData._id, section);
        const at = res?.data?.seenAt || new Date().toISOString();
        setCaseData((prev) => withSeen(prev, user, section, at));
      } catch (e) {
        /* not critical: the count simply stays until next visit */
      } finally {
        seenPending.current[section] = false;
      }
    },
    [caseData?._id, user]
  );

  useEffect(() => {
    if (activeTab === "hearings" && unread.hearings > 0) markSeen("hearings");
    if (activeTab === "documents" && unread.documents > 0) markSeen("documents");
  }, [activeTab, unread.hearings, unread.documents, markSeen]);

  useEffect(() => {
    if (chatOpen && unread.messages > 0) markSeen("messages");
  }, [chatOpen, unread.messages, markSeen]);

  if (loading) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-light)" }}>
        {renderNavbar()}
        <div className="container py-4" style={{ maxWidth: "1280px" }}>
          {/* Header Skeleton */}
          <div className="mb-4">
            <Sk w={180} h={16} r={4} style={{ marginBottom: 12 }} />
            <Sk w="60%" h={36} r={8} style={{ marginBottom: 16 }} />
            <div className="d-flex gap-2">
              <Sk w={90} h={24} r={99} />
              <Sk w={110} h={24} r={99} />
              <Sk w={130} h={24} r={99} />
            </div>
          </div>
          {/* Two-Column Skeleton */}
          <div className="row g-4">
            <div className="col-12 col-lg-8">
              <div className="d-flex flex-column gap-4">
                <div className="legal-card p-4">
                  <Sk w={200} h={20} r={4} style={{ marginBottom: 16 }} />
                  <div className="row g-3">
                    <div className="col-md-6"><Sk h={80} r={8} /></div>
                    <div className="col-md-6"><Sk h={80} r={8} /></div>
                  </div>
                </div>
                <div className="legal-card p-4">
                  <Sk w={220} h={20} r={4} style={{ marginBottom: 16 }} />
                  <Sk h={120} r={8} />
                </div>
                <div className="legal-card p-4">
                  <Sk w={180} h={20} r={4} style={{ marginBottom: 16 }} />
                  <Sk h={100} r={8} />
                </div>
              </div>
            </div>
            <div className="col-12 col-lg-4">
              <div className="legal-card p-4" style={{ height: "550px" }}>
                <Sk w={180} h={24} r={4} style={{ marginBottom: 20 }} />
                <Sk h={400} r={8} />
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Render Error State
  if (fetchError || !caseData) {
    return (
      <div style={{ minHeight: "100vh", backgroundColor: "var(--bg-light)" }}>
        {renderNavbar()}
        <div className="container py-5" style={{ maxWidth: "800px" }}>
          <div className="legal-card p-5 text-center shadow-sm">
            <div
              style={{
                width: 72,
                height: 72,
                borderRadius: "50%",
                backgroundColor: fetchError?.code === 403 ? "#FEF2F2" : "#FFFBEB",
                color: fetchError?.code === 403 ? "#DC2626" : "#D97706",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                marginBottom: 20
              }}
            >
              {fetchError?.code === 403 ? <Lock size={36} /> : <AlertTriangle size={36} />}
            </div>
            <h2 style={{ fontFamily: "var(--font-serif)", color: "var(--text-primary)", marginBottom: 12 }}>
              {fetchError?.title || "Docket Unavailable"}
            </h2>
            <p className="body-text mx-auto" style={{ maxWidth: "560px", marginBottom: 28, color: "var(--text-secondary)" }}>
              {fetchError?.message || "The requested case docket could not be retrieved."}
            </p>
            <div className="d-flex justify-content-center gap-3">
              <Link to={getDashboardRoute()} className="btn-legal-primary">
                <ArrowLeft size={16} />
                <span>Return to Dashboard</span>
              </Link>
              <button onClick={fetchCase} className="btn-legal-secondary">
                Retry Connection
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const hearingsList = caseData.hearings || caseData.hearingDates || [];
  const documentsList = caseData.documents || [];
  const messagesList = caseData.messages || [];
  const isProBono = caseData.caseType === "pro_bono" || !!caseData.ngoId;
  const assignedLawyer = caseData.lawyerId;
  const isAssigned = isProBono ? !!assignedLawyer : !!caseData.lawyerId;
  const isPendingUnassigned = !caseData.lawyerId && !caseData.ngoId;
  const currentAssignment = caseData.assignments?.find(a => a.isCurrent) || caseData.assignments?.[caseData.assignments.length - 1];
  const hasAssignmentHistory = caseData.assignments && caseData.assignments.length > 1;
  const isResolved = caseData.status === "resolved" || caseData.status === "closed";

  const sortedHearings = [...hearingsList].sort((a, b) => new Date(a.date) - new Date(b.date));
  const nowTime = new Date();
  const upcomingHearings = isResolved ? [] : sortedHearings.filter(h => isLiveHearing(h) && new Date(h.date) >= nowTime);
  const nextHearing = upcomingHearings[0];

  // Stage comes from the shared rule, so it always matches the status badge
  const caseStage = getCaseStage(caseData);
  const caseStepIndex = caseStage.step - 1;

  const judicialSteps = [
    {
      title: "Intake & Filing",
      subtitle: caseData.createdAt ? new Date(caseData.createdAt).toLocaleDateString([], { month: "short", day: "numeric" }) : "Petition Filed",
      icon: FileText,
      content: "Formal legal petition and initial cause of action submitted into the central court registry."
    },
    {
      title: "Counsel Appointed",
      subtitle: isAssigned ? (isProBono ? "NGO Panel Appointed" : "Private Retainer Active") : "Awaiting Allocation",
      icon: UserCheck,
      content: isAssigned
        ? (assignedLawyer?.name ? `Lead counsel appointed: Adv. ${assignedLawyer.name}. Case strategy underway.` : "Designated legal counsel assigned to represent matter.")
        : "Matter currently under review at the judicial desk to allocate qualified legal counsel."
    },
    {
      title: "Court Proceedings",
      subtitle: hearingsList.length > 0 ? `${hearingsList.length} Hearings Logged` : "Trial Submissions",
      icon: Calendar,
      content: hearingsList.length > 0
        ? "Matter undergoing active court trials before the judicial bench. Next hearing and trial pleadings logged."
        : "Formal evidence exchange and bench trial appearance scheduling in progress."
    },
    {
      title: "Final Disposition",
      subtitle: isResolved ? "Decree & Resolved" : "Awaiting Verdict",
      icon: FileCheck,
      content: isResolved
        ? "Case docket concluded. Final judicial order or formal decree obtained and permanently archived."
        : "Final judgment, decree, or mutual settlement to be rendered upon trial conclusion."
    }
  ];

  // ── Header actions: one main button, the rest in the ⋯ menu ──
  const actionList = [];
  if (canManageCase) {
    actionList.push({ label: "Update status", icon: CheckCircle2, onClick: () => setShowStatusModal(true) });
    if (!isResolved) {
      actionList.push({ label: "Schedule hearing", icon: Calendar, onClick: () => setShowHearingModal(true) });
      actionList.push({ label: "Revise strategy", icon: Edit3, onClick: () => setShowAnalysisModal(true) });
      actionList.push({ label: "Upload document", icon: Upload, onClick: () => setShowUploadModal(true) });
    }
  }
  if (isCitizen) {
    if (isAssigned && ["resolved", "closed"].includes(caseData.status)) {
      actionList.push({ label: "Leave a review", icon: Star, onClick: () => setShowReviewModal(true) });
    }
    if (!isResolved) {
      actionList.push({ label: "Upload document", icon: Upload, onClick: () => setShowUploadModal(true) });
    }
    actionList.push({ label: "File a dispute", icon: AlertTriangle, onClick: () => setShowDisputeModal(true), danger: true });
  }
  const primaryAction = actionList[0];
  const moreActions = actionList.slice(1);

  const counselNextStep = {
    pending: "This request is waiting for review. Accept it or ask the client for more details.",
    under_review: "Review the facts and documents, then accept or decline the matter.",
    assigned: "Contact your client, record your strategy and schedule the first hearing.",
    in_progress: "Keep hearing dates, documents and status up to date so your client can follow along.",
    resolved: "The matter is concluded. Your client can now leave a review.",
    closed: "This case is closed. Documents and messages stay available here.",
    rejected: "This request was declined.",
  };
  const nextStepText = (canManageCase ? counselNextStep : {
    pending: "We're reviewing your request. You'll be notified as soon as counsel is assigned.",
    under_review: "Your request is being reviewed. Counsel will be assigned shortly.",
    assigned: "Your counsel is preparing your case. Expect a message and a first hearing date soon.",
    in_progress: "Your case is moving through the courts. Check the Hearings tab for upcoming dates.",
    resolved: "Your case has concluded. If you were assisted, please leave a review for your counsel.",
    closed: "This case is closed. Documents and messages remain available here.",
    rejected: "This request was not accepted. You can approach another verified advocate or NGO.",
  })[caseData.status] || "Follow the progress of this case here.";

  return (
    <div
      className="cp-page case-page page-fade"
      style={{
        minHeight: "100vh",
        color: "var(--text-primary)",
        transition: "background-color 0.2s, color 0.2s"
      }}
    >
      {/* ── Role-Specific Portal Navbar ── */}
      {renderNavbar()}

      {/* ── Case header (green banner, same as the portals) ── */}
      <section className="cp-hero is-compact ll-on-dark case-hero">
        <div className="cp-hero-inner">
          <div className="cp-hero-main">
            <div className="case-crumbs">
              <button type="button" onClick={() => navigate(getDashboardRoute())} className="pub-back case-back">
                <ArrowLeft size={15} /> Back to dashboard
              </button>
              <span className="case-ref">Ref. #{(caseData._id || "").slice(-8).toUpperCase()}</span>
            </div>
            <div className="case-chips">
              <span className="cp-chip">{caseData.category || "General legal matter"}</span>
              <span className="case-chip-soft">{isProBono ? (caseData.ngoId ? "Pro bono · NGO aid" : "Pro bono") : "Private counsel"}</span>
              {renderPriorityBadge(caseData.priority)}
            </div>
            <h1 className="cp-hero-title">{caseData.title}</h1>
            <div className="cp-identity-meta">
              <span><Calendar size={14} /> Filed {new Date(caseData.createdAt).toLocaleDateString("en-PK", { month: "short", day: "numeric", year: "numeric" })}</span>
              <span><Scale size={14} /> Stage {caseStage.step} of 4 · {caseStage.title}</span>
            </div>
          </div>
          <div className="cp-hero-side case-hero-side">
            <div className="case-status">
              <span className="case-status-label">Status</span>
              {renderStatusBadge(caseData.status)}
            </div>
            <div className="case-actions">
              {primaryAction && (
                <button type="button" className="cp-btn-gold" onClick={primaryAction.onClick}>
                  <primaryAction.icon size={15} /> {primaryAction.label}
                </button>
              )}
              {moreActions.length > 0 && (
                <div className="case-more">
                  <button
                    type="button"
                    className="case-more-btn"
                    aria-haspopup="menu"
                    aria-expanded={moreOpen}
                    aria-label="More actions"
                    onClick={() => setMoreOpen((v) => !v)}
                  >
                    <MoreHorizontal size={18} />
                  </button>
                  {moreOpen && (
                    <>
                      <div className="case-more-scrim" onClick={() => setMoreOpen(false)} />
                      <div className="case-more-menu" role="menu">
                        {moreActions.map((act) => (
                          <button
                            key={act.label}
                            type="button"
                            role="menuitem"
                            className={act.danger ? "is-danger" : ""}
                            onClick={() => {
                              setMoreOpen(false);
                              act.onClick();
                            }}
                          >
                            <act.icon size={15} /> {act.label}
                          </button>
                        ))}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="case-tabs-wrap">
          <nav className="case-tabs" role="tablist" aria-label="Case sections">
            {[
              { key: "overview", label: "Overview", icon: FileText },
              { key: "hearings", label: "Hearings", icon: Calendar, count: unread.hearings },
              { key: "documents", label: "Documents", icon: Briefcase, count: unread.documents },
              { key: "activity", label: "Activity", icon: History },
            ].map((t) => (
              <button
                key={t.key}
                type="button"
                role="tab"
                aria-selected={activeTab === t.key}
                className={`case-tab${activeTab === t.key ? " is-active" : ""}`}
                onClick={() => setActiveTab(t.key)}
              >
                <t.icon size={15} /> {t.label}
                {t.count > 0 && <span className="case-tab-count is-unread" title={`${t.count} new`}>{t.count}</span>}
              </button>
            ))}
            <button type="button" className="case-tab is-chat" onClick={() => setChatOpen(true)}>
              <MessageSquare size={15} /> Messages
              {unread.messages > 0 && <span className="case-tab-count is-unread" title={`${unread.messages} unread`}>{unread.messages}</span>}
            </button>
          </nav>
        </div>
      </section>

      {/* ── Main Content Area ── */}
      <main className="container py-4 case-main" style={{ maxWidth: "1280px" }}>
        <div className="row g-4">
          {/* ========================================================
              LEFT COLUMN (65% width) - Legal Dossier
              ======================================================== */}
          <div className="col-12">
            <div className="d-flex flex-column gap-4">
        {/* ── What happens next (short callout) ── */}
        {activeTab === "overview" && (
          <div className="case-callout">
            <span className="case-callout-icon"><ArrowRight size={16} /></span>
            <div>
              <strong>What happens next</strong>
              <p>{nextStepText}</p>
            </div>
          </div>
        )}

        {/* ── Judicial Lifecycle Progress Stepper ── */}
        {activeTab === "overview" && (
        <div>
          <div
            style={{
              backgroundColor: "var(--bg-card)",
              border: "1px solid var(--border-hairline)",
              borderRadius: "16px",
              padding: "20px 24px 22px",
              boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
            }}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 flex-wrap gap-2">
              <div className="d-flex align-items-center gap-2">
                <Scale size={18} color="var(--primary-brand)" />
                <h3 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                  Judicial Matter Progression & Docket Status
                </h3>
              </div>
              <span
                style={{
                  fontSize: "11.5px",
                  fontWeight: "700",
                  color: "var(--primary-brand)",
                  backgroundColor: "var(--primary-tint, #F0FDF4)",
                  border: "1px solid rgba(30, 63, 46, 0.2)",
                  padding: "3px 10px",
                  borderRadius: "9999px",
                  letterSpacing: "0.5px"
                }}
              >
                STAGE {caseStage.step} OF 4 • {caseStage.title.toUpperCase()}
              </span>
            </div>

            <AnimatedStepper
              steps={judicialSteps}
              activeStep={caseStepIndex}
              allowClickNavigation={false}
              showFooter={false}
            />
          </div>
        </div>
        )}

              {/* CARD 1: Case Particulars (Client & Counsel Side-by-Side) */}
              {activeTab === "overview" && (
                <div className="legal-card p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                      <Briefcase size={18} color="var(--primary-brand)" />
                      <span>Case Particulars & Legal Parties</span>
                    </h3>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                      Matter Docket #{caseData._id?.slice(-6).toUpperCase()}
                    </span>
                  </div>

                  <div className="row g-3 mb-4">
                    {/* Client Particulars Box */}
                    <div className="col-12 col-md-6">
                      <div
                        style={{
                          backgroundColor: "var(--bg-light)",
                          border: "1px solid var(--border-hairline)",
                          borderRadius: "10px",
                          padding: "16px",
                          height: "100%"
                        }}
                      >
                        <div className="d-flex align-items-center gap-2 mb-3">
                          <div
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "50%",
                              backgroundColor: "var(--cp-gold-tint)",
                              color: "var(--cp-gold)",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "14px"
                            }}
                          >
                            {caseData.userId?.name ? caseData.userId.name.charAt(0).toUpperCase() : <User size={18} />}
                          </div>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              CLIENT / APPLICANT
                            </span>
                            <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                              {caseData.userId?.name || "Client Name Confidential"}
                            </h4>
                          </div>
                        </div>

                        <div className="d-flex flex-column gap-2" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                          {caseData.userId?.phone && (
                            <div className="d-flex align-items-center gap-2">
                              <Phone size={14} color="var(--text-muted)" />
                              <span>{caseData.userId.phone}</span>
                            </div>
                          )}
                          {caseData.userId?.email && (
                            <div className="d-flex align-items-center gap-2">
                              <Mail size={14} color="var(--text-muted)" />
                              <span>{caseData.userId.email}</span>
                            </div>
                          )}
                          {caseData.userId?.cnic && (
                            <div className="d-flex align-items-center gap-2">
                              <Shield size={14} color="var(--text-muted)" />
                              <span>CNIC: {caseData.userId.cnic}</span>
                            </div>
                          )}
                          {!caseData.userId?.phone && !caseData.userId?.email && (
                            <span style={{ color: "var(--text-muted)", fontStyle: "italic" }}>
                              Protected confidential citizen profile
                            </span>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Assigned Counsel Particulars Box (or Awaiting state) */}
                    <div className="col-12 col-md-6">
                      <div
                        style={{
                          backgroundColor: "var(--bg-light)",
                          border: `1px solid ${isAssigned ? "var(--border-hairline)" : "#FDE68A"}`,
                          borderRadius: "10px",
                          padding: "16px",
                          height: "100%"
                        }}
                      >
                        {isAssigned ? (
                          <>
                            <div className="d-flex align-items-center gap-2 mb-2">
                              <div
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "50%",
                                  backgroundColor: isProBono ? "#ECFDF5" : "var(--primary-tint)",
                                  color: isProBono ? "#059669" : "var(--primary-brand)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  fontWeight: "700",
                                  fontSize: "14px",
                                  overflow: "hidden",
                                  flexShrink: 0
                                }}
                              >
                                {assignedLawyer?.photo ? (
                                  <img
                                    src={assignedLawyer.photo}
                                    alt={assignedLawyer.name}
                                    style={{ width: "100%", height: "100%", borderRadius: "50%", objectFit: "cover" }}
                                  />
                                ) : (
                                  <Scale size={18} />
                                )}
                              </div>
                              <div style={{ minWidth: 0 }}>
                                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                  {isProBono ? "ASSIGNED PRO BONO COUNSEL" : "ASSIGNED ADVOCATE COUNSEL"}
                                </span>
                                <h4 style={{ fontSize: "15px", fontWeight: "700", color: "var(--text-primary)", margin: 0, textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                                  {assignedLawyer?.name ? (assignedLawyer.name.startsWith("Adv") ? assignedLawyer.name : `Adv. ${assignedLawyer.name}`) : "Licensed Advocate"}
                                </h4>
                              </div>
                            </div>

                            {/* Secondary Badge */}
                            <div className="mb-2.5">
                              {isProBono ? (
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: "#ECFDF5",
                                    color: "#065F46",
                                    border: "1px solid #A7F3D0",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    padding: "3px 8px",
                                    borderRadius: "12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}
                                >
                                  <Building2 size={12} />
                                  Representing {caseData.ngoId?.name || "Legal Aid NGO"}
                                </span>
                              ) : (
                                <span
                                  className="badge"
                                  style={{
                                    backgroundColor: "var(--primary-tint, #EEF2FF)",
                                    color: "var(--primary-brand, #1E3A8A)",
                                    border: "1px solid rgba(30, 58, 138, 0.2)",
                                    fontSize: "11px",
                                    fontWeight: "600",
                                    padding: "3px 8px",
                                    borderRadius: "12px",
                                    display: "inline-flex",
                                    alignItems: "center",
                                    gap: "4px"
                                  }}
                                >
                                  <Briefcase size={12} />
                                  Private Retainer Counsel
                                </span>
                              )}
                            </div>

                            <div className="d-flex flex-column gap-2" style={{ fontSize: "13px", color: "var(--text-secondary)" }}>
                              {assignedLawyer?.barCouncilId && (
                                <div className="d-flex align-items-center gap-2">
                                  <Shield size={14} color="var(--primary-brand)" />
                                  <span>Bar Council ID: <strong>{assignedLawyer.barCouncilId}</strong></span>
                                </div>
                              )}
                              {isProBono && currentAssignment?.reason && (
                                <div className="d-flex align-items-center gap-2">
                                  <Briefcase size={14} color="var(--text-muted)" />
                                  <span>Assignment Note: {currentAssignment.reason}</span>
                                </div>
                              )}
                              {assignedLawyer?.specialization && (
                                <div className="d-flex align-items-center gap-2">
                                  <Briefcase size={14} color="var(--text-muted)" />
                                  <span>Practice: {assignedLawyer.specialization}</span>
                                </div>
                              )}
                              {isProBono && caseData.ngoId?.focalPerson && (
                                <div className="d-flex align-items-center gap-2">
                                  <User size={14} color="var(--text-muted)" />
                                  <span>
                                    NGO Focal Person:{" "}
                                    {typeof caseData.ngoId.focalPerson === "object"
                                      ? caseData.ngoId.focalPerson.name
                                        ? `${caseData.ngoId.focalPerson.name}${caseData.ngoId.focalPerson.designation ? ` (${caseData.ngoId.focalPerson.designation})` : ""}`
                                        : "Assigned Representative"
                                      : caseData.ngoId.focalPerson}
                                  </span>
                                </div>
                              )}
                              {assignedLawyer?.phone && (
                                <div className="d-flex align-items-center gap-2">
                                  <Phone size={14} color="var(--text-muted)" />
                                  <span>{assignedLawyer.phone}</span>
                                </div>
                              )}
                              {assignedLawyer?.email && (
                                <div className="d-flex align-items-center gap-2">
                                  <Mail size={14} color="var(--text-muted)" />
                                  <span>{assignedLawyer.email}</span>
                                </div>
                              )}
                            </div>
                          </>
                        ) : isPendingUnassigned ? (
                          // Institutional Unassigned State for Pending Unassigned Case
                          <div className="d-flex flex-column justify-content-center align-items-center text-center py-3" style={{ height: "100%" }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                backgroundColor: "#FEF3C7",
                                color: "#D97706",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 10
                              }}
                            >
                              <Clock size={22} />
                            </div>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#92400E", marginBottom: 4 }}>
                              Awaiting Counsel Allocation • Pending Review
                            </span>
                            <p style={{ fontSize: "12.5px", color: "#78350F", margin: 0, maxWidth: "270px", lineHeight: 1.4 }}>
                              This legal docket is currently pending institutional intake. Verified legal aid NGOs and advocate counsel are reviewing case details to accept representation.
                            </p>
                          </div>
                        ) : isProBono ? (
                          // Institutional Unassigned State for Pro Bono Case with NGO accepted
                          <div className="d-flex flex-column justify-content-center align-items-center text-center py-3" style={{ height: "100%" }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                backgroundColor: "#FEF3C7",
                                color: "#D97706",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 10
                              }}
                            >
                              <Clock size={22} />
                            </div>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#92400E", marginBottom: 4 }}>
                              Representing Counsel: Awaiting NGO Staff Assignment
                            </span>
                            <p style={{ fontSize: "12.5px", color: "#78350F", margin: 0, maxWidth: "270px", lineHeight: 1.4 }}>
                              {caseData.ngoId?.name ? `${caseData.ngoId.name} has accepted this case file. A designated pro bono advocate from their legal aid panel will be assigned shortly.` : "A designated pro bono advocate will be assigned shortly."}
                            </p>
                          </div>
                        ) : (
                          // Institutional Unassigned State for Private Case
                          <div className="d-flex flex-column justify-content-center align-items-center text-center py-3" style={{ height: "100%" }}>
                            <div
                              style={{
                                width: 44,
                                height: 44,
                                borderRadius: "50%",
                                backgroundColor: "#FEF3C7",
                                color: "#D97706",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                marginBottom: 10
                              }}
                            >
                              <Clock size={22} />
                            </div>
                            <span style={{ fontSize: "14px", fontWeight: "700", color: "#92400E", marginBottom: 4 }}>
                              Awaiting Legal Counsel Assignment
                            </span>
                            <p style={{ fontSize: "12.5px", color: "#78350F", margin: 0, maxWidth: "260px", lineHeight: 1.4 }}>
                              This matter is currently under review by our judicial intake desk. Verified counsel will be appointed shortly.
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Case Facts Brief */}
                  <div style={{ backgroundColor: "var(--bg-light)", border: "1px solid var(--border-hairline)", borderRadius: "10px", padding: "16px" }}>
                    <div className="d-flex align-items-center gap-2 mb-2">
                      <FileText size={16} color="var(--primary-brand)" />
                      <span style={{ fontSize: "13px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-secondary)" }}>
                        Statement of Facts & Case Narrative
                      </span>
                    </div>
                    <p
                      className={`case-facts${factsOpen ? " is-open" : ""}`}
                      style={{ fontSize: "14px", lineHeight: 1.65, color: "var(--text-secondary)", margin: 0, whiteSpace: "pre-line" }}
                    >
                      {caseData.description || "No formal brief narrative filed for this case."}
                    </p>
                    {(caseData.description || "").length > 260 && (
                      <button type="button" className="case-readmore" onClick={() => setFactsOpen((v) => !v)} aria-expanded={factsOpen}>
                        {factsOpen ? "Show less" : "Read more"}
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* CARD 2: Court Hearing Proceedings Timeline */}
              {activeTab === "hearings" && (
                <div className="legal-card p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <Calendar size={18} color="var(--primary-brand)" />
                      <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                        Court Hearing Proceedings Timeline
                      </h3>
                      <span className="badge-semantic badge-neutral">
                        {hearingsList.length} Proceedings
                      </span>
                    </div>

                    {canManageCase && !isResolved && (
                      <button
                        onClick={() => setShowHearingModal(true)}
                        className="btn-legal-primary"
                        style={{ padding: "6px 14px", fontSize: "13px" }}
                      >
                        <Plus size={15} />
                        <span>Schedule Next Hearing</span>
                      </button>
                    )}
                  </div>

                  {hearingsList.length === 0 ? (
                    <EmptyState
                      icon="scale"
                      title="No Court Hearings Scheduled"
                      description="Courtroom proceedings and next appearance notices will appear here once scheduled by your assigned legal counsel."
                      compact
                      action={
                        canManageCase && !isResolved
                          ? {
                              label: "Schedule First Hearing",
                              onClick: () => setShowHearingModal(true)
                            }
                          : null
                      }
                    />
                  ) : (
                    <div>
                      {/* Highlighted next hearing */}
                      {nextHearing && (
                        <div className="case-next-banner">
                          <span className="cp-date-tile">
                            <span className="cp-date-tile-month">
                              {new Date(nextHearing.date).toLocaleDateString("en-US", { month: "short" }).toUpperCase()}
                            </span>
                            <span className="cp-date-tile-day">{new Date(nextHearing.date).getDate()}</span>
                          </span>
                          <div className="case-next-banner-body">
                            <div className="case-next-banner-top">
                              <span className="case-next-banner-label">Next hearing</span>
                              <span className="case-next-banner-time">
                                {new Date(nextHearing.date).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            </div>
                            <div className="case-next-banner-date">
                              {new Date(nextHearing.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" })}
                            </div>
                            {nextHearing.notes && (
                              <div className="case-next-banner-notes">
                                <strong>Purpose: </strong>{nextHearing.notes}
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      <ul className="case-hearing-list">
                        {[...sortedHearings].reverse().map((h, idx) => {
                          const hDate = new Date(h.date);
                          const hs = getHearingStatus(h);
                          const isPast = hDate < nowTime;
                          return (
                            <li key={h._id || idx} className={`case-hearing is-${hs.key}`}>
                              <span className="cp-date-tile">
                                <span className="cp-date-tile-month">{hDate.toLocaleDateString("en-US", { month: "short" }).toUpperCase()}</span>
                                <span className="cp-date-tile-day">{hDate.getDate()}</span>
                              </span>
                              <div className="case-hearing-body">
                                <div className="case-hearing-top">
                                  <strong className="case-hearing-title">{h.notes || "Court hearing"}</strong>
                                  <span className={`case-hstatus tone-${hs.tone}`}>{hs.label}</span>
                                </div>
                                <div className="case-hearing-when">
                                  {hDate.toLocaleDateString("en-PK", { weekday: "short", day: "numeric", month: "short", year: "numeric" })}
                                  {" · "}
                                  {hDate.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}
                                </div>
                                {h.outcome ? (
                                  <div className="case-hearing-outcome">
                                    <span>Outcome</span>
                                    <p>{h.outcome}</p>
                                  </div>
                                ) : isPast && hs.key !== "cancelled" ? (
                                  <div className="case-hearing-missing">
                                    {canManageCase ? "Outcome not recorded yet. Add what happened so your client can follow." : "Your advocate has not recorded the outcome yet."}
                                  </div>
                                ) : null}
                              </div>
                              {canManageCase && !isResolved && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenEditHearing(h)}
                                  className="case-hearing-edit"
                                  title="Edit date, notes, outcome or status"
                                >
                                  <Edit3 size={13} />
                                  <span>{isPast && !h.outcome ? "Record outcome" : "Edit"}</span>
                                </button>
                              )}
                            </li>
                          );
                        })}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* CARD: Counsel Chain-of-Custody Timeline */}
              {hasAssignmentHistory && activeTab === "hearings" && (
                <div className="legal-card p-4">
                  <div
                    className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom"
                    style={{ cursor: "pointer", userSelect: "none" }}
                    onClick={() => setShowAssignmentHistory(!showAssignmentHistory)}
                  >
                    <div className="d-flex align-items-center gap-2">
                      <FileClock size={18} color="var(--primary-brand)" />
                      <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                        Counsel Assignment History
                      </h3>
                      <span className="badge-semantic badge-neutral">
                        {caseData.assignments.length} Records
                      </span>
                    </div>

                    <button
                      type="button"
                      className="btn btn-sm btn-link p-0 text-decoration-none"
                      style={{ color: "var(--text-muted)" }}
                      aria-label="Toggle Counsel Assignment History"
                    >
                      {showAssignmentHistory ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
                    </button>
                  </div>

                  {showAssignmentHistory && (
                    <div style={{ position: "relative", paddingLeft: "26px", margin: "14px 0" }}>
                      {/* Vertical line connecting assignments */}
                      <div
                        style={{
                          position: "absolute",
                          left: "8px",
                          top: "10px",
                          bottom: "10px",
                          width: "2px",
                          backgroundColor: "var(--border-hairline)"
                        }}
                      />

                      <div className="d-flex flex-column gap-3">
                        {[...caseData.assignments].reverse().map((assign, idx) => {
                          const isCurrent = assign.isCurrent;
                          const assignDate = assign.assignedAt ? new Date(assign.assignedAt) : null;
                          const unassignDate = assign.unassignedAt ? new Date(assign.unassignedAt) : null;

                          return (
                            <div key={assign._id || idx} style={{ position: "relative" }}>
                              {/* Milestone Dot */}
                              <div
                                style={{
                                  position: "absolute",
                                  left: "-26px",
                                  top: "8px",
                                  width: "18px",
                                  height: "18px",
                                  borderRadius: "50%",
                                  backgroundColor: isCurrent ? "#059669" : "var(--text-muted)",
                                  border: "3px solid var(--bg-card)",
                                  boxShadow: "0 0 0 1px var(--border-hairline)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center"
                                }}
                              />

                              <div
                                style={{
                                  backgroundColor: "var(--bg-light)",
                                  border: `1px solid ${isCurrent ? "rgba(5, 150, 105, 0.3)" : "var(--border-hairline)"}`,
                                  borderRadius: "10px",
                                  padding: "16px"
                                }}
                              >
                                <div className="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-2">
                                  <div className="d-flex align-items-center gap-2">
                                    <Scale size={15} color={isCurrent ? "#059669" : "var(--text-muted)"} />
                                    <strong style={{ fontSize: "14.5px", color: "var(--text-primary)" }}>
                                      {assign.lawyerName}
                                    </strong>
                                    {assign.barCouncilId && (
                                      <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
                                        ({assign.barCouncilId})
                                      </span>
                                    )}
                                  </div>
                                  <span
                                    style={{
                                      fontSize: "11px",
                                      fontWeight: "600",
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      backgroundColor: isCurrent ? "#ECFDF5" : "var(--bg-card)",
                                      color: isCurrent ? "#065F46" : "var(--text-muted)",
                                      border: `1px solid ${isCurrent ? "#A7F3D0" : "var(--border-hairline)"}`
                                    }}
                                  >
                                    {isCurrent ? "Current Handling Counsel" : "Previous Counsel"}
                                  </span>
                                </div>

                                <div className="d-flex flex-wrap gap-3 mb-2" style={{ fontSize: "12.5px", color: "var(--text-secondary)" }}>
                                  <div>
                                    <strong>Assigned:</strong> {assignDate ? assignDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Initial"}
                                  </div>
                                  {unassignDate && (
                                    <div>
                                      <strong>Relieved:</strong> {unassignDate.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
                                    </div>
                                  )}
                                </div>

                                {assign.reason && (
                                  <div
                                    style={{
                                      fontSize: "13px",
                                      color: "var(--text-secondary)",
                                      backgroundColor: "var(--bg-card)",
                                      padding: "8px 12px",
                                      borderRadius: "6px",
                                      borderLeft: `3px solid ${isCurrent ? "#059669" : "var(--text-muted)"}`
                                    }}
                                  >
                                    <strong>Assignment Note / Reason: </strong>
                                    <span>{assign.reason}</span>
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeTab === "activity" && (
                <div className="legal-card p-4">
                  <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom">
                    <History size={18} color="var(--cp-green, #1E3F2E)" />
                    <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>Case activity</h3>
                  </div>
                  <CaseTimeline caseData={caseData} onOpenMessages={() => setChatOpen(true)} />
                </div>
              )}

              {/* CARD 3: Counsel Legal Analysis & Strategy */}
              {activeTab === "documents" && (
                <div className="legal-card p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <Scale size={18} color="var(--accent-gold, #C5A059)" />
                      <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                        Counsel Legal Analysis & Strategy Docket
                      </h3>
                    </div>

                    {canManageCase && (
                      <button
                        onClick={() => setShowAnalysisModal(true)}
                        className="btn-legal-secondary"
                        style={{ padding: "6px 14px", fontSize: "13px" }}
                      >
                        <Edit3 size={14} />
                        <span>Edit Strategy</span>
                      </button>
                    )}
                  </div>

                  {caseData.caseAnalysis || caseData.analysis ? (
                    <div
                      style={{
                        backgroundColor: "var(--bg-light)",
                        border: "1px solid var(--border-hairline)",
                        borderRadius: "10px",
                        padding: "18px",
                        lineHeight: 1.7,
                        fontSize: "14px",
                        color: "var(--text-primary)",
                        whiteSpace: "pre-line"
                      }}
                    >
                      <div className="d-flex align-items-center gap-2 mb-3 pb-2 border-bottom text-muted" style={{ fontSize: "12px" }}>
                        <Shield size={14} color="var(--primary-brand)" />
                        <span>OFFICIAL PRIVILEGED LEGAL COUNSEL ASSESSMENT</span>
                      </div>
                      {caseData.caseAnalysis || caseData.analysis}
                    </div>
                  ) : (
                    <div
                      style={{
                        backgroundColor: "var(--bg-light)",
                        border: "1px dashed var(--border-hairline)",
                        borderRadius: "10px",
                        padding: "32px 20px",
                        textAlign: "center"
                      }}
                    >
                      <FileText size={32} color="var(--text-muted)" className="mb-2" />
                      <h5 style={{ fontSize: "15px", fontWeight: 600, color: "var(--text-primary)", marginBottom: 6 }}>
                        No Formal Legal Strategy Recorded Yet
                      </h5>
                      <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0, maxWidth: "450px", marginLeft: "auto", marginRight: "auto" }}>
                        {canManageCase
                          ? "Formulate legal precedents, case strategy, and counsel observations for this matter docket."
                          : "Your assigned legal advocate has not yet submitted a formal strategy assessment for this docket."}
                      </p>
                      {canManageCase && (
                        <button
                          onClick={() => setShowAnalysisModal(true)}
                          className="btn-legal-primary mt-3"
                          style={{ padding: "7px 16px", fontSize: "13px" }}
                        >
                          <Plus size={14} />
                          <span>Formulate Legal Strategy</span>
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* CARD 4: Attached Evidence & Document Vault */}
              {activeTab === "documents" && (
                <div className="legal-card p-4">
                  <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
                    <div className="d-flex align-items-center gap-2">
                      <FolderOpen size={18} color="var(--primary-brand)" />
                      <h3 style={{ fontSize: "17px", fontWeight: "700", color: "var(--text-primary)", margin: 0 }}>
                        Attached Evidence & Document Vault
                      </h3>
                      <span className="badge-semantic badge-neutral">
                        {documentsList.length} Files
                      </span>
                    </div>

                    <button
                      onClick={() => setShowUploadModal(true)}
                      className="btn-legal-primary"
                      style={{ padding: "6px 14px", fontSize: "13px" }}
                    >
                      <Upload size={14} />
                      <span>Upload Evidence</span>
                    </button>
                  </div>

                  {documentsList.length === 0 ? (
                    <EmptyState
                      icon="file"
                      title="No Evidence Documents Attached"
                      description="Both client and counsel can upload relevant evidence, affidavits, contracts, and filings."
                      compact
                      action={{
                        label: "Upload First Document",
                        onClick: () => setShowUploadModal(true)
                      }}
                    />
                  ) : (
                    <div className="row g-3">
                      {documentsList.map((doc, idx) => (
                        <div key={idx} className="col-12 col-md-6">
                          <div
                            style={{
                              backgroundColor: "var(--bg-light)",
                              border: "1px solid var(--border-hairline)",
                              borderRadius: "10px",
                              padding: "14px",
                              display: "flex",
                              flexDirection: "column",
                              justifyContent: "space-between",
                              height: "100%",
                              transition: "border-color 0.15s ease"
                            }}
                          >
                            <div className="d-flex align-items-start gap-3 mb-2">
                              <div
                                style={{
                                  width: "38px",
                                  height: "38px",
                                  borderRadius: "8px",
                                  backgroundColor: "var(--cp-gold-tint)",
                                  color: "var(--cp-gold)",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  flexShrink: 0
                                }}
                              >
                                <Paperclip size={18} />
                              </div>
                              <div style={{ minWidth: 0, flex: 1 }}>
                                <div
                                  style={{
                                    fontSize: "14px",
                                    fontWeight: "600",
                                    color: "var(--text-primary)",
                                    overflow: "hidden",
                                    textOverflow: "ellipsis",
                                    whiteSpace: "nowrap"
                                  }}
                                  title={doc.name}
                                >
                                  {doc.name || `Evidence Document #${idx + 1}`}
                                </div>
                                <div className="d-flex align-items-center gap-2 mt-1" style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                                  <span>{doc.fileSize || "Vault File"}</span>
                                  {doc.uploadedBy && (
                                    <>
                                      <span>•</span>
                                      <span title={`Uploaded by: ${doc.uploadedBy}`}>By: {doc.uploadedBy}</span>
                                    </>
                                  )}
                                  {doc.uploadedAt && (
                                    <>
                                      <span>•</span>
                                      <span>{new Date(doc.uploadedAt).toLocaleDateString()}</span>
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>

                            <div className="d-flex justify-content-end gap-2 mt-2 pt-2 border-top">
                              <button
                                type="button"
                                onClick={() => openFile(doc.url, (msg) => notify(msg, "error"))}
                                disabled={!doc.url}
                                className="btn-legal-secondary"
                                style={{ padding: "5px 12px", fontSize: "12.5px" }}
                              >
                                <ExternalLink size={13} />
                                <span>Preview / Download</span>
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>

        </div>
      </main>

      {/* ── Messages panel (slides in from the right) ── */}
      {chatOpen && <div className="case-chat-scrim" onClick={() => setChatOpen(false)} />}
      <aside className={`case-chat-drawer${chatOpen ? " is-open" : ""}`} aria-hidden={!chatOpen} aria-label="Case messages">
              {/* Sticky Chat Card */}
              <div
                className="legal-card"
                style={{
                  display: "flex",
                  flexDirection: "column",
                  height: "640px",
                  overflow: "hidden"
                }}
              >
                {/* Chat Card Header */}
                <div
                  className="ll-on-dark"
                  style={{
                    backgroundColor: "#1E3F2E",
                    color: "#FFFFFF",
                    padding: "16px 20px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}
                >
                  <div className="d-flex align-items-center gap-2">
                    <MessageSquare size={18} color="var(--accent-gold, #C5A059)" />
                    <div>
                      <h4 style={{ fontSize: "15px", fontWeight: "700", margin: 0, color: "#FFFFFF" }}>
                        Case messages
                      </h4>
                      <div className="d-flex align-items-center gap-1.5" style={{ fontSize: "11px", color: "#CBD5E1" }}>
                        <span
                          style={{
                            width: "7px",
                            height: "7px",
                            borderRadius: "50%",
                            backgroundColor: "#10B981"
                          }}
                        />
                        <span>{canManageCase ? "Private between you and your client" : "Private between you and your counsel"}</span>
                      </div>
                    </div>
                  </div>
                  <button type="button" className="case-chat-close" onClick={() => setChatOpen(false)} aria-label="Close messages">
                    <X size={18} />
                  </button>
                </div>

                {/* Message Bubble Stream */}
                <div
                  style={{
                    flex: 1,
                    overflowY: "auto",
                    padding: "16px",
                    backgroundColor: "var(--bg-light)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "12px"
                  }}
                >
                  {messagesList.length === 0 ? (
                    <div className="d-flex flex-column align-items-center justify-content-center text-center h-100 my-auto py-5">
                      <div
                        style={{
                          width: 48,
                          height: 48,
                          borderRadius: "50%",
                          backgroundColor: isPendingUnassigned ? "#FEF3C7" : "rgba(30, 63, 46, 0.08)",
                          color: isPendingUnassigned ? "#D97706" : "var(--primary-brand)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          marginBottom: 10
                        }}
                      >
                        {isPendingUnassigned ? <Clock size={22} /> : <MessageSquare size={22} />}
                      </div>
                      <h6 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: 4 }}>
                        {isPendingUnassigned ? "Communications Channel On Hold" : "Direct Communications Channel"}
                      </h6>
                      <p style={{ fontSize: "12.5px", color: "var(--text-muted)", maxWidth: "260px", margin: 0 }}>
                        {isPendingUnassigned
                          ? "Direct communications channel will open once counsel is formally assigned to this docket."
                          : "Send a message to commence encrypted consultation between client and legal counsel."}
                      </p>
                    </div>
                  ) : (
                    messagesList.map((m, idx) => {
                      const isMe = m.senderId?.toString() === user?.id?.toString() || m.senderId === user?._id;
                      let roleLabel = m.senderRoleLabel;
                      if (!roleLabel) {
                        if (m.senderType === "ngo") {
                          const ngoName = caseData.ngoId?.name || "Legal Aid NGO";
                          roleLabel = `${ngoName} • Legal Aid Officer`;
                        } else if (isProBono && m.senderType === "lawyer") {
                          const advName = caseData.lawyerId?.name
                            ? (caseData.lawyerId.name.startsWith("Adv") ? caseData.lawyerId.name : `Adv. ${caseData.lawyerId.name}`)
                            : "Advocate";
                          const ngoName = caseData.ngoId?.name || "Legal Aid NGO";
                          roleLabel = `${advName} • Panel Counsel (${ngoName})`;
                        } else if (m.senderType === "lawyer") {
                          const advName = caseData.lawyerId?.name
                            ? (caseData.lawyerId.name.startsWith("Adv") ? caseData.lawyerId.name : `Adv. ${caseData.lawyerId.name}`)
                            : "Advocate Counsel";
                          roleLabel = `${advName} • Retainer Counsel`;
                        } else if (m.senderType === "admin") {
                          roleLabel = "Judicial Registrar • Administrator";
                        } else {
                          roleLabel = caseData.userId?.name ? `${caseData.userId.name} • Client` : "Petitioner / Client";
                        }
                      }

                      return (
                        <div
                          key={idx}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            alignItems: isMe ? "flex-end" : "flex-start",
                            maxWidth: "88%",
                            alignSelf: isMe ? "flex-end" : "flex-start"
                          }}
                        >
                          <div className="d-flex align-items-center gap-1.5 mb-1" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            <span style={{ fontWeight: 600 }}>{isMe ? "You" : roleLabel}</span>
                            <span>•</span>
                            <span>
                              {new Date(m.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                            </span>
                          </div>

                          <div
                            style={{
                              background: isMe ? "linear-gradient(135deg, #2C5A46, #163428)" : "var(--bg-card)",
                              color: isMe ? "#FFFFFF" : "var(--text-primary)",
                              border: isMe ? "none" : "1px solid var(--border-hairline)",
                              borderRadius: isMe ? "14px 14px 2px 14px" : "14px 14px 14px 2px",
                              padding: "10px 14px",
                              fontSize: "13.5px",
                              lineHeight: 1.5,
                              boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
                              wordBreak: "break-word"
                            }}
                          >
                            {/* Safe text rendering (no HTML injection) */}
                            {m.message}
                          </div>
                        </div>
                      );
                    })
                  )}
                  <div ref={messagesEndRef} />
                </div>

                {/* Inline chat error feedback */}
                {chatFeedback && (
                  <div
                    style={{
                      padding: "6px 12px",
                      fontSize: "12px",
                      backgroundColor: "#FEF2F2",
                      color: "#DC2626",
                      borderTop: "1px solid #FECACA"
                    }}
                  >
                    {chatFeedback.text}
                  </div>
                )}

                {/* Chat Input Bar or Resolved Archive Banner or Pending Unassigned Banner */}
                {isResolved ? (
                  <div
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#F0FDF4",
                      borderTop: "1px solid #BBF7D0",
                      color: "#166534",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontWeight: "500",
                      lineHeight: 1.4
                    }}
                  >
                    <CheckCircle size={18} style={{ flexShrink: 0, color: "#16A34A" }} />
                    <span>This case docket has been officially resolved and archived. Legal communications and records are preserved in read-only mode for legal compliance.</span>
                  </div>
                ) : isPendingUnassigned ? (
                  <div
                    style={{
                      padding: "14px 16px",
                      backgroundColor: "#FEF3C7",
                      borderTop: "1px solid #FDE68A",
                      color: "#92400E",
                      fontSize: "13px",
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      fontWeight: "500",
                      lineHeight: 1.4
                    }}
                  >
                    <Clock size={18} style={{ flexShrink: 0, color: "#D97706" }} />
                    <span>Direct communications channel will open once counsel is formally assigned to this docket.</span>
                  </div>
                ) : (
                  <form
                    onSubmit={handleSendMessage}
                    style={{
                      padding: "12px 14px",
                      backgroundColor: "var(--bg-card)",
                      borderTop: "1px solid var(--border-hairline)",
                      display: "flex",
                      gap: "8px",
                      alignItems: "center"
                    }}
                  >
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Type legal correspondence..."
                      disabled={sendingMsg}
                      style={{
                        flex: 1,
                        height: "40px",
                        padding: "8px 12px",
                        fontSize: "13.5px",
                        border: "1px solid var(--border-hairline)",
                        borderRadius: "8px",
                        backgroundColor: "var(--bg-light)",
                        color: "var(--text-primary)",
                        outline: "none"
                      }}
                    />
                    <button
                      type="submit"
                      disabled={!chatInput.trim() || sendingMsg}
                      className="btn-legal-primary"
                      style={{
                        height: "40px",
                        padding: "0 16px",
                        fontSize: "13px",
                        opacity: !chatInput.trim() || sendingMsg ? 0.6 : 1
                      }}
                    >
                      {sendingMsg ? (
                        <span className="spinner-border spinner-border-sm" role="status" />
                      ) : (
                        <>
                          <span>Send</span>
                          <Send size={14} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>

      </aside>

      {/* ── Floating Messages button ── */}
      {!chatOpen && (
        <button type="button" className="case-chat-fab" onClick={() => setChatOpen(true)} aria-label="Open messages">
          <MessageSquare size={19} />
          <span>Messages</span>
          {unread.messages > 0 && <span className="case-tab-count is-unread">{unread.messages}</span>}
        </button>
      )}

      {/* ========================================================
          MODALS WITH INLINE PER-ACTION FEEDBACK (Requirement 9)
          ======================================================== */}

      {/* 1. Schedule Hearing Modal */}
      {showHearingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowHearingModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                Schedule Court Hearing Proceeding
              </h4>
              <button
                onClick={() => setShowHearingModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {hearingFeedback && (
              <div
                className={`alert ${hearingFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {hearingFeedback.text}
              </div>
            )}

            <form onSubmit={handleScheduleHearing}>
              <div className="mb-3">
                <label className="legal-label">Hearing Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={hearingForm.date}
                  onChange={(e) => setHearingForm({ ...hearingForm, date: e.target.value })}
                  className="legal-input"
                />
              </div>

              <div className="mb-3">
                <label className="legal-label">Proceeding Status</label>
                <select
                  value={hearingForm.status}
                  onChange={(e) => setHearingForm({ ...hearingForm, status: e.target.value })}
                  className="legal-input"
                >
                  <option value="scheduled">Scheduled Appearance</option>
                  <option value="concluded">Concluded</option>
                  <option value="adjourned">Adjourned</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="legal-label">Bench Notes & Preparation Directions</label>
                <textarea
                  rows={3}
                  value={hearingForm.notes}
                  onChange={(e) => setHearingForm({ ...hearingForm, notes: e.target.value })}
                  placeholder="Record court room, presiding judge, witness requirements..."
                  className="legal-input"
                  style={{ height: "auto", minHeight: "80px" }}
                />
              </div>

              <div className="mb-4">
                <label className="legal-label">Judge Ruling / Order Outcome (if concluded)</label>
                <input
                  type="text"
                  value={hearingForm.outcome}
                  onChange={(e) => setHearingForm({ ...hearingForm, outcome: e.target.value })}
                  placeholder="e.g. Interim injunction granted; next notice issued"
                  className="legal-input"
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowHearingModal(false)}
                  className="btn-legal-secondary"
                  disabled={submittingHearing}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-legal-primary" disabled={submittingHearing}>
                  {submittingHearing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      <span>Scheduling...</span>
                    </>
                  ) : (
                    <span>Confirm Hearing</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 1b. Edit Hearing Proceeding Modal */}
      {showEditHearingModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowEditHearingModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                Edit Proceeding / Record Judicial Outcome
              </h4>
              <button
                onClick={() => setShowEditHearingModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {editHearingFeedback && (
              <div
                className={`alert ${editHearingFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {editHearingFeedback.text}
              </div>
            )}

            <form onSubmit={handleUpdateHearingSubmit}>
              <div className="mb-3">
                <label className="legal-label">Hearing Date & Time *</label>
                <input
                  type="datetime-local"
                  required
                  value={editHearingForm.date}
                  onChange={(e) => setEditHearingForm({ ...editHearingForm, date: e.target.value })}
                  className="legal-input"
                />
              </div>

              <div className="mb-3">
                <label className="legal-label">Proceeding Status</label>
                <select
                  value={editHearingForm.status}
                  onChange={(e) => setEditHearingForm({ ...editHearingForm, status: e.target.value })}
                  className="legal-input"
                >
                  <option value="scheduled">Scheduled Appearance</option>
                  <option value="concluded">Concluded</option>
                  <option value="adjourned">Adjourned</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>

              <div className="mb-3">
                <label className="legal-label">Bench Notes & Preparation Directions</label>
                <textarea
                  rows={3}
                  value={editHearingForm.notes}
                  onChange={(e) => setEditHearingForm({ ...editHearingForm, notes: e.target.value })}
                  placeholder="Record courtroom, presiding judge, witness requirements..."
                  className="legal-input"
                  style={{ height: "auto", minHeight: "80px" }}
                />
              </div>

              <div className="mb-4">
                <label className="legal-label">Judge Ruling / Order Outcome</label>
                <input
                  type="text"
                  value={editHearingForm.outcome}
                  onChange={(e) => setEditHearingForm({ ...editHearingForm, outcome: e.target.value })}
                  placeholder="e.g. Interim injunction granted; next notice issued; final decree passed"
                  className="legal-input"
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowEditHearingModal(false)}
                  className="btn-legal-secondary"
                  disabled={submittingEditHearing}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-legal-primary" disabled={submittingEditHearing}>
                  {submittingEditHearing ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      <span>Saving Changes...</span>
                    </>
                  ) : (
                    <span>Save Proceeding Updates</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 2. Edit Legal Strategy Modal */}
      {showAnalysisModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowAnalysisModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "600px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                Legal Strategy & Case Analysis Docket
              </h4>
              <button
                onClick={() => setShowAnalysisModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {analysisFeedback && (
              <div
                className={`alert ${analysisFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {analysisFeedback.text}
              </div>
            )}

            <form onSubmit={handleSaveAnalysis}>
              <div className="mb-3">
                <label className="legal-label">Privileged Counsel Strategy & Analysis</label>
                <textarea
                  rows={8}
                  value={analysisText}
                  onChange={(e) => setAnalysisText(e.target.value)}
                  placeholder="Detail your legal strategy, statutory provisions, precedents, defense angles, and instructions for the client..."
                  className="legal-input"
                  style={{ height: "auto", minHeight: "180px", lineHeight: 1.6 }}
                  required
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowAnalysisModal(false)}
                  className="btn-legal-secondary"
                  disabled={submittingAnalysis}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-legal-primary" disabled={submittingAnalysis}>
                  {submittingAnalysis ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    <span>Save Legal Strategy</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 3. Upload Evidence Modal */}
      {showUploadModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowUploadModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                Upload Case Evidence / Documentation
              </h4>
              <button
                onClick={() => setShowUploadModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {uploadFeedback && (
              <div
                className={`alert ${uploadFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {uploadFeedback.text}
              </div>
            )}

            <div className="d-flex gap-2 mb-3">
              <button
                type="button"
                className={`btn ${uploadMode === "file" ? "btn-legal-primary" : "btn-legal-secondary"}`}
                style={{ flex: 1, padding: "7px 12px", fontSize: "13px" }}
                onClick={() => setUploadMode("file")}
              >
                Upload File from Device
              </button>
              <button
                type="button"
                className={`btn ${uploadMode === "url" ? "btn-legal-primary" : "btn-legal-secondary"}`}
                style={{ flex: 1, padding: "7px 12px", fontSize: "13px" }}
                onClick={() => setUploadMode("url")}
              >
                Link External URL
              </button>
            </div>

            <form onSubmit={handleUploadDocument}>
              <div className="mb-3">
                <label className="legal-label">Document Title / Label</label>
                <input
                  type="text"
                  value={docName}
                  onChange={(e) => setDocName(e.target.value)}
                  placeholder="e.g. Affidavit of Witness, Sale Deed Annexure A"
                  className="legal-input"
                />
              </div>

              {uploadMode === "file" ? (
                <div className="mb-4">
                  <label className="legal-label">Select File (PDF, DOCX, PNG, JPG - max 15MB) *</label>
                  <input
                    type="file"
                    required
                    onChange={(e) => setSelectedFile(e.target.files[0])}
                    className="legal-input"
                    style={{ padding: "8px" }}
                  />
                  {selectedFile && (
                    <div className="mt-1 text-muted" style={{ fontSize: "12px" }}>
                      Selected: {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                    </div>
                  )}
                </div>
              ) : (
                <div className="mb-4">
                  <label className="legal-label">Document Web URL / Cloud Link *</label>
                  <input
                    type="url"
                    required
                    value={docUrl}
                    onChange={(e) => setDocUrl(e.target.value)}
                    placeholder="https://drive.google.com/..."
                    className="legal-input"
                  />
                </div>
              )}

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowUploadModal(false)}
                  className="btn-legal-secondary"
                  disabled={uploadingDoc}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-legal-primary" disabled={uploadingDoc}>
                  {uploadingDoc ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      <span>Uploading...</span>
                    </>
                  ) : (
                    <span>Attach Evidence</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 4. Update Status Modal */}
      {showStatusModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowStatusModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "460px", width: "100%" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                Update Matter Status
              </h4>
              <button
                onClick={() => setShowStatusModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {statusFeedback && (
              <div
                className={`alert ${statusFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {statusFeedback.text}
              </div>
            )}

            <div className="mb-3">
              <label className="legal-label">Target Legal Status</label>
              <select
                value={newStatus}
                onChange={(e) => setNewStatus(e.target.value)}
                className="legal-input"
              >
                <option value="pending">Pending</option>
                <option value="assigned">Assigned Counsel</option>
                <option value="in_progress">In Progress</option>
                <option value="under_review">Under Review</option>
                <option value="resolved">Resolved</option>
                <option value="closed">Closed</option>
              </select>
            </div>

            <div className="mb-4">
              <label className="legal-label">Transition Notes (Optional)</label>
              <textarea
                rows={2}
                value={statusNotes}
                onChange={(e) => setStatusNotes(e.target.value)}
                placeholder="Reason or judicial outcome triggering status update..."
                className="legal-input"
                style={{ height: "auto", minHeight: "60px" }}
              />
            </div>

            <div className="d-flex justify-content-end gap-2">
              <button
                type="button"
                onClick={() => setShowStatusModal(false)}
                className="btn-legal-secondary"
                disabled={updatingStatus}
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => handleUpdateStatus(newStatus)}
                className="btn-legal-primary"
                disabled={updatingStatus}
              >
                {updatingStatus ? (
                  <>
                    <span className="spinner-border spinner-border-sm me-2" role="status" />
                    <span>Updating...</span>
                  </>
                ) : (
                  <span>Save Status</span>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 5. Citizen File Dispute Modal */}
      {showDisputeModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowDisputeModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "520px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <AlertTriangle size={20} color="#DC2626" />
                <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                  File Formal Dispute or Complaint
                </h4>
              </div>
              <button
                onClick={() => setShowDisputeModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {disputeFeedback && (
              <div
                className={`alert ${disputeFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {disputeFeedback.text}
              </div>
            )}

            <form onSubmit={handleFileDispute}>
              <div className="mb-3">
                <label className="legal-label">Dispute Subject / Headline *</label>
                <input
                  type="text"
                  required
                  value={disputeForm.title}
                  onChange={(e) => setDisputeForm({ ...disputeForm, title: e.target.value })}
                  placeholder="e.g. Counsel not responding to urgent court queries"
                  className="legal-input"
                />
              </div>

              <div className="mb-3">
                <label className="legal-label">Category of Grievance</label>
                <select
                  value={disputeForm.reason}
                  onChange={(e) => setDisputeForm({ ...disputeForm, reason: e.target.value })}
                  className="legal-input"
                >
                  {/* Values must match the Dispute.category enum on the backend */}
                  <option value="Abandoned Case">Unresponsive / Abandoned Case</option>
                  <option value="Poor Representation">Quality of Legal Representation</option>
                  <option value="Overcharging / Fee Dispute">Financial & Billing Discrepancy</option>
                  <option value="Misconduct">Ethical Breach or Misconduct</option>
                  <option value="Breach of Confidentiality">Breach of Confidentiality</option>
                  <option value="Harassment">Harassment</option>
                  <option value="Other">Other Dispute Reason</option>
                </select>
              </div>

              <div className="mb-4">
                <label className="legal-label">Statement of Facts & Evidence *</label>
                <textarea
                  rows={4}
                  required
                  value={disputeForm.description}
                  onChange={(e) => setDisputeForm({ ...disputeForm, description: e.target.value })}
                  placeholder="Describe your dispute chronologically so judicial administration can investigate..."
                  className="legal-input"
                  style={{ height: "auto", minHeight: "100px" }}
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowDisputeModal(false)}
                  className="btn-legal-secondary"
                  disabled={submittingDispute}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-legal-primary"
                  style={{ backgroundColor: "#DC2626", borderColor: "#DC2626" }}
                  disabled={submittingDispute}
                >
                  {submittingDispute ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Dispute Notice</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 6. Citizen Review Counsel Modal */}
      {showReviewModal && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1100,
            backgroundColor: "rgba(15, 23, 42, 0.5)",
            backdropFilter: "blur(3px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}
          onClick={() => setShowReviewModal(false)}
        >
          <div
            className="legal-card p-4"
            style={{ maxWidth: "500px", width: "100%", maxHeight: "90vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="d-flex justify-content-between align-items-center mb-3 pb-2 border-bottom">
              <div className="d-flex align-items-center gap-2">
                <Star size={20} color="#D97706" fill="#D97706" />
                <h4 style={{ fontFamily: "var(--font-serif)", fontSize: "18px", margin: 0, color: "var(--text-primary)" }}>
                  Submit Counsel Review & Rating
                </h4>
              </div>
              <button
                onClick={() => setShowReviewModal(false)}
                style={{ background: "none", border: "none", cursor: "pointer", color: "var(--text-muted)" }}
              >
                <X size={20} />
              </button>
            </div>

            {reviewFeedback && (
              <div
                className={`alert ${reviewFeedback.type === "success" ? "alert-success" : "alert-danger"} py-2 px-3 mb-3`}
                style={{ fontSize: "13px" }}
              >
                {reviewFeedback.text}
              </div>
            )}

            <form onSubmit={handleSubmitReview}>
              <div className="mb-3 text-center py-2">
                <label className="legal-label mb-2">Overall Experience Rating</label>
                <div className="d-flex justify-content-center gap-2">
                  {[1, 2, 3, 4, 5].map((starVal) => (
                    <button
                      key={starVal}
                      type="button"
                      onClick={() => setReviewForm({ ...reviewForm, rating: starVal })}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px"
                      }}
                    >
                      <Star
                        size={28}
                        color="#D97706"
                        fill={starVal <= reviewForm.rating ? "#D97706" : "none"}
                      />
                    </button>
                  ))}
                </div>
              </div>

              <div className="mb-3">
                <label className="legal-label">Review Headline</label>
                <input
                  type="text"
                  value={reviewForm.title}
                  onChange={(e) => setReviewForm({ ...reviewForm, title: e.target.value })}
                  placeholder="e.g. Diligent advocacy in high court proceedings"
                  className="legal-input"
                />
              </div>

              <div className="mb-4">
                <label className="legal-label">Detailed Feedback *</label>
                <textarea
                  rows={4}
                  required
                  value={reviewForm.comment}
                  onChange={(e) => setReviewForm({ ...reviewForm, comment: e.target.value })}
                  placeholder="Share details regarding communications, responsiveness, and judicial outcomes..."
                  className="legal-input"
                  style={{ height: "auto", minHeight: "100px" }}
                />
              </div>

              <div className="d-flex justify-content-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="btn-legal-secondary"
                  disabled={submittingReview}
                >
                  Cancel
                </button>
                <button type="submit" className="btn-legal-primary" disabled={submittingReview}>
                  {submittingReview ? (
                    <>
                      <span className="spinner-border spinner-border-sm me-2" role="status" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <span>Submit Verified Review</span>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
