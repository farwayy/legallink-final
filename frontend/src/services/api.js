import axios from "axios";
import { API_URL } from "../config";

const api = axios.create({
  baseURL: API_URL,
  headers: {
    "Content-Type": "application/json",
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem("token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// If an admin blocks or deactivates this account, sign out on the next request
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401 && error.response?.data?.accountDisabled) {
      const message = error.response.data.message || "Your account is no longer active.";
      const role = localStorage.getItem("userRole") || "";
      localStorage.removeItem("token");
      localStorage.removeItem("user");
      localStorage.removeItem("userRole");
      try {
        sessionStorage.setItem("ll_signed_out_reason", message);
      } catch (e) {
        /* ignore */
      }
      window.location.href = role === "admin" ? "/admin/login" : "/login";
    }
    return Promise.reject(error);
  },
);

// Subscription APIs
export const subscriptionAPI = {
  checkAccess: (lawyerId) => api.get(`/subscriptions/check/${lawyerId}`),
  createSubscription: (data) => api.post('/subscriptions/create', data),
  getUserSubscriptions: () => api.get('/subscriptions/my-subscriptions'),
};


// Auth APIs
export const authAPI = {
  userSignup: (data) => api.post("/auth/user/signup", data),
  userLogin: (data) => api.post("/auth/user/login", data),
  googleLogin: (data) => api.post("/auth/google", data),
  lawyerSignup: (data) => api.post("/auth/lawyer/signup", data),
  lawyerLogin: (data) => api.post("/auth/lawyer/login", data),
  adminLogin: (data) => api.post("/auth/admin/login", data),
  getMe: () => api.get("/auth/me"),
  forgotPassword: (data) => api.post("/auth/forgot-password", data),
  resetPassword: (data) => api.post("/auth/reset-password", data),
};

// User APIs
export const userAPI = {
  getProfile: () => api.get("/users/profile"),
  updateProfile: (data) => api.put("/users/profile", data),
  getLawyers: (params) => api.get("/users/lawyers", { params }),
  getLawyerById: (id) => api.get(`/users/lawyers/${id}`),
  getCases: () => api.get("/users/cases"),
  createCase: (data) => api.post("/users/cases", data),
  getCaseById: (id) => api.get(`/users/cases/${id}`),
  addMessage: (id, message) =>
    api.post(`/cases/${id}/messages`, { message }),
  getStats: () => api.get("/users/dashboard/stats"),
  getTemplates: () => api.get("/users/templates"),
  getTemplate: (id) => api.get(`/users/templates/${id}`),
};

// Lawyer APIs
export const lawyerAPI = {
  getProfile: () => api.get("/lawyer/profile"),
  updateProfile: (data) => api.put("/lawyer/profile", data),
  getCases: (status) => api.get("/lawyer/cases", { params: { status } }),
  getAvailableCases: () => api.get("/lawyer/cases/pending/available"),
  acceptCase: (id) => api.post(`/lawyer/cases/${id}/accept`),
  getCaseById: (id) => api.get(`/lawyer/cases/${id}`),
  updateCaseStatus: (id, status, notes) =>
    api.patch(`/lawyer/cases/${id}/status`, { status, notes }),
  addMessage: (id, message) =>
    api.post(`/cases/${id}/messages`, { message }),
  getStats: () => api.get("/lawyer/dashboard/stats"),
  addHearing: (caseId, data) =>
    api.post(`/lawyer/cases/${caseId}/hearing`, data),
  updateHearing: (caseId, hearingId, data) =>
    api.patch(`/lawyer/cases/${caseId}/hearing/${hearingId}`, data),
  updateCaseAnalysis: (caseId, analysis) =>
    api.patch(`/lawyer/cases/${caseId}/analysis`, { analysis }),
  // Panel Invitations
  getPanelInvitations: () => api.get("/lawyer/panel-invitations"),
  respondPanelInvitation: (membershipId, action) =>
    api.post(`/lawyer/panel-invitations/${membershipId}/respond`, { action }),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get("/admin/dashboard/stats"),
  getUsers: () => api.get("/admin/users"),
  updateUserStatus: (id, isActive) =>
    api.patch(`/admin/users/${id}/status`, { isActive }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getLawyers: (status) =>
    api.get(`/admin/lawyers${status ? `?status=${status}` : ""}`),
  verifyLawyer: (id, verificationStatus, rejectionReason) =>
    api.patch(`/admin/lawyers/${id}/verify`, { verificationStatus, rejectionReason }),
  blockLawyer: (id, isBlocked) =>
    api.patch(`/admin/lawyers/${id}/block`, { isBlocked }),
  deleteLawyer: (id) => api.delete(`/admin/lawyers/${id}`),
  requestLawyerInfo: (id, message) => api.patch(`/admin/lawyers/${id}/request-info`, { message }),
  requestNGOInfo: (id, message) => api.patch(`/admin/ngos/${id}/request-info`, { message }),
  getCases: (params) => api.get("/admin/cases", { params }),
  // NGO Management
  getNGOs: (status) =>
    api.get(`/admin/ngos${status ? `?status=${status}` : ""}`),
  verifyNGO: (id, verificationStatus, rejectionReason) =>
    api.put(`/admin/ngos/${id}/verify`, { verificationStatus, rejectionReason }),
  toggleNGOStatus: (id, isBlocked) =>
    api.put(`/admin/ngos/${id}/toggle-status`, { isBlocked }),
  // Audit Logs
  getAuditLogs: (params) => api.get("/admin/audit-logs", { params }),
  // Disputes (admin)
  getDisputes: (params) => api.get("/disputes/admin", { params }),
  updateDisputeStatus: (id, status, adminNote) =>
    api.patch(`/disputes/admin/${id}/status`, { status, adminNote }),
  // My account
  getMe: () => api.get("/admin/me"),
  updateMe: (data) => api.patch("/admin/me", data),
  changePassword: (currentPassword, newPassword) =>
    api.patch("/admin/me/password", { currentPassword, newPassword }),
  // Admin team
  getTeam: () => api.get("/admin/team"),
  inviteAdmin: (email, role) => api.post("/admin/team/invite", { email, role }),
  resendInvite: (id) => api.post(`/admin/team/${id}/resend`),
  updateAdmin: (id, data) => api.patch(`/admin/team/${id}`, data),
  revokeInvite: (id) => api.delete(`/admin/team/${id}`),
  // Invitation (public: used on the accept-invite page)
  checkInvite: (token) => api.get(`/admin/invite/${token}`),
  acceptInvite: (token, name, password) =>
    api.post(`/admin/invite/${token}/accept`, { name, password }),
  // Announcements
  getAnnouncements: () => api.get("/admin/announcements"),
  createAnnouncement: (data) => api.post("/admin/announcements", data),
  updateAnnouncement: (id, data) => api.patch(`/admin/announcements/${id}`, data),
  deleteAnnouncement: (id) => api.delete(`/admin/announcements/${id}`),
};

// Banner announcements shown in the citizen, advocate and NGO portals
export const announcementAPI = {
  getActive: (audience) => api.get("/admin/announcements/active", { params: { audience } }),
};

// Card payments (Stripe Checkout)
export const paymentAPI = {
  getConfig: () => api.get("/payments/config"),
  createCheckout: (requestId) => api.post("/payments/checkout", { requestId }),
  getSession: (sessionId) => api.get(`/payments/session/${sessionId}`),
  getAdminPayments: () => api.get("/payments/admin"),
};

// Dispute APIs (citizen)
export const disputeAPI = {
  fileDispute: (data) => api.post("/disputes", data),
  getMyDisputes: () => api.get("/disputes/mine"),
};


// Case APIs
export const caseAPI = {
  createCase: (data) => api.post("/users/cases", data),
  getMyCases: () => api.get("/users/cases"),
  getCase: (id) => api.get(`/cases/${id}`),
  updateStatus: (id, status, notes) => api.patch(`/cases/${id}/status`, { status, notes }),
  addMessage: (id, message) => api.post(`/cases/${id}/messages`, { message }),
  addHearing: (id, data) => api.post(`/cases/${id}/hearing`, data),
  updateHearing: (caseId, hearingId, data) => api.patch(`/cases/${caseId}/hearing/${hearingId}`, data),
  updateAnalysis: (id, analysis) => api.patch(`/cases/${id}/analysis`, { analysis }),
  uploadDocument: (id, formData) =>
    api.post(`/cases/${id}/documents`, formData, {
      headers: { "Content-Type": "multipart/form-data" },
    }),
  attachDocument: (id, data) => api.post(`/cases/${id}/documents`, data),
  markSeen: (id, section) => api.post(`/cases/${id}/seen`, { section }),
};

export const requestAPI = {
  sendRequest: (data) => api.post('/requests/send', data),
  getPendingRequests: () => api.get('/requests/pending'),
  getMyRequests: () => api.get('/requests/my-requests'),
  acceptRequest: (id) => api.post(`/requests/${id}/accept`),
  rejectRequest: (id, reason) => api.post(`/requests/${id}/reject`, { rejectionReason: reason }),
  completePayment: (id, data) => api.post(`/requests/${id}/complete-payment`, data),
};

// NGO APIs
export const ngoAPI = {
  // Public
  getDirectory: (params) => api.get('/ngo/directory', { params }),
  getNGOById: (id) => api.get(`/ngo/directory/${id}`),
  requestAid: (ngoId, data) => api.post(`/ngo/request-aid/${ngoId}`, data),
  // Auth
  login: (data) => api.post('/ngo/login', data),
  register: (formData) =>
    api.post('/ngo/register', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    }),
  // Protected - NGO portal
  getProfile: () => api.get('/ngo/profile'),
  updateProfile: (data) => api.put('/ngo/profile', data),
  getCases: (status) => api.get('/ngo/cases', { params: { status } }),
  getStats: () => api.get('/ngo/dashboard/stats'),
  updateCaseStatus: (id, status) => api.put(`/ngo/cases/${id}/status`, { status }),
  addHearing: (id, data) => api.post(`/ngo/cases/${id}/hearing`, data),
  sendMessage: (id, message) => api.post(`/cases/${id}/messages`, { message }),
  addMessage: (id, message) => api.post(`/cases/${id}/messages`, { message }),
  // Aid Request management (NGO portal)
  getAidRequests: (status) => api.get('/ngo/aid-requests', { params: status ? { status } : {} }),
  acceptAidRequest: (id, lawyerId) => api.post(`/ngo/aid-requests/${id}/accept`, { lawyerId }),
  rejectAidRequest: (id, rejectionReason) => api.post(`/ngo/aid-requests/${id}/reject`, { rejectionReason }),
  // Panel Advocates management
  getMembers: () => api.get('/ngo/members'),
  inviteMember: (data) => api.post('/ngo/members/invite', data),
  updateMemberStatus: (id, status) => api.patch(`/ngo/members/${id}/status`, { status }),
  // Case Reassignment
  reassignCase: (id, lawyerId, reason) => api.patch(`/ngo/cases/${id}/reassign`, { lawyerId, reason }),
  // Citizen aid-request tracking
  getMyAidRequests: () => api.get('/ngo/my-aid-requests'),
};


// Review & Rating APIs (FR_18)
export const reviewAPI = {
  createReview: (data) => api.post('/reviews', data),
  editReview: (id, data) => api.patch(`/reviews/${id}`, data),
  replyReview: (id, data) => api.post(`/reviews/${id}/reply`, data),
  getMyReviews: () => api.get('/reviews/my-reviews'),
  getLawyerReviews: (lawyerId, params) => api.get(`/reviews/lawyer/${lawyerId}`, { params }),
  getNGOReviews: (ngoId, params) => api.get(`/reviews/ngo/${ngoId}`, { params }),
  getStarDistribution: (targetType, targetId) => api.get(`/reviews/distribution/${targetType}/${targetId}`),
  flagReview: (id, reason) => api.patch(`/reviews/${id}/flag`, { reason }),
  getFlaggedReviews: () => api.get('/reviews/flagged'),
  getAllAdminReviews: () => api.get('/reviews/admin/all'),
  dismissFlag: (id) => api.patch(`/reviews/${id}/dismiss-flag`),
  deleteReview: (id) => api.delete(`/reviews/${id}`),
};

export default api;
