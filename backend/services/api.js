import axios from 'axios';

const API_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: API_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Auth APIs
export const authAPI = {
  userSignup: (data) => api.post('/auth/user/signup', data),
  userLogin: (data) => api.post('/auth/user/login', data),
  lawyerSignup: (data) => api.post('/auth/lawyer/signup', data),
  lawyerLogin: (data) => api.post('/auth/lawyer/login', data),
  adminLogin: (data) => api.post('/auth/admin/login', data),
  getMe: () => api.get('/auth/me'),
};

// Verification APIs
export const verificationAPI = {
  sendCode: (phone, email) => api.post('/auth/send-verification', { phone, email }),
};

// User APIs
export const userAPI = {
  getProfile: () => api.get('/user/profile'),
  updateProfile: (data) => api.put('/user/profile', data),
  getLawyers: (params) => api.get('/user/lawyers', { params }),
  getLawyerById: (id) => api.get(`/user/lawyers/${id}`),
  getCases: () => api.get('/user/cases'),
  createCase: (data) => api.post('/user/cases', data),
  getCaseById: (id) => api.get(`/user/cases/${id}`),
  addMessage: (id, message) => api.post(`/user/cases/${id}/messages`, { message }),
  getStats: () => api.get('/user/dashboard/stats'),
  getTemplates: () => api.get('/user/templates'),
  getTemplate: (id) => api.get(`/user/templates/${id}`),
};

// Lawyer APIs
export const lawyerAPI = {
  getProfile: () => api.get('/lawyer/profile'),
  updateProfile: (data) => api.put('/lawyer/profile', data),
  getCases: (status) => api.get('/lawyer/cases', { params: { status } }),
  getAvailableCases: () => api.get('/lawyer/cases/pending/available'),
  acceptCase: (id) => api.post(`/lawyer/cases/${id}/accept`),
  getCaseById: (id) => api.get(`/lawyer/cases/${id}`),
  updateCaseStatus: (id, status, notes) => api.patch(`/lawyer/cases/${id}/status`, { status, notes }),
  addMessage: (id, message) => api.post(`/lawyer/cases/${id}/messages`, { message }),
  getStats: () => api.get('/lawyer/dashboard/stats'),
};

// Admin APIs
export const adminAPI = {
  getStats: () => api.get('/admin/dashboard/stats'),
  getUsers: () => api.get('/admin/users'),
  updateUserStatus: (id, isActive) => api.patch(`/admin/users/${id}/status`, { isActive }),
  deleteUser: (id) => api.delete(`/admin/users/${id}`),
  getLawyers: (status) => api.get(`/admin/lawyers${status ? `?status=${status}` : ''}`),
  verifyLawyer: (id, verificationStatus, rejectionReason = '') => 
    api.patch(`/admin/lawyers/${id}/verify`, { verificationStatus, rejectionReason }),
  blockLawyer: (id, isBlocked) => api.patch(`/admin/lawyers/${id}/block`, { isBlocked }),
  deleteLawyer: (id) => api.delete(`/admin/lawyers/${id}`),
  getCases: () => api.get('/admin/cases'),
};

// Case APIs
export const caseAPI = {
  createCase: (data) => api.post('/cases', data),
  getMyCases: () => api.get('/cases/my-cases'),
  getCase: (id) => api.get(`/cases/${id}`),
  updateStatus: (id, status) => api.patch(`/cases/${id}/status`, { status }),
  addMessage: (id, message) => api.post(`/cases/${id}/messages`, { message }),
};

export default api;