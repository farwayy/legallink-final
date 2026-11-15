import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "./contexts/AuthContext";
import { RealTimeProvider } from "./contexts/RealTimeContext";
import { ThemeProvider } from "./contexts/ThemeContext";
import { ToastContainer } from "./components/Toast";

// Pages
import UserSignup from "./pages/user/Signup";
import UserDashboard from "./pages/user/Dashboard";
import LawyerSignup from "./pages/lawyer/Signup";
import LawyerDashboard from "./pages/lawyer/Dashboard";
import AdminLogin from "./pages/admin/Login";
import AdminDashboard from "./pages/admin/Dashboard";
import AdminCasesList from "./pages/admin/CasesList";
import AdminAuditLog from "./pages/admin/AuditLog";
import AdminDisputesList from "./pages/admin/DisputesList";
import AdminSettings from "./pages/admin/Settings";
import AdminAnnouncements from "./pages/admin/Announcements";
import AdminAcceptInvite from "./pages/admin/AcceptInvite";
import AdminPayments from "./pages/admin/Payments";
import LandingPage from "./pages/LandingPage";
import LawyerListing from "./pages/LawyerListing";
import LawyerProfile from "./pages/LawyerProfile"; // Public profile page for lawyers
import Documents from "./pages/Documents";
import ChatbotPage from "./pages/Chatbot";
import LawyersProfile from "./pages/lawyer/Profile"; // Lawyer's own profile page
import LawyerCases from "./pages/lawyer/Cases";
import UserProfile from "./pages/user/Profile";
import LawyersList from "./pages/admin/LawyersList";
import UsersList from "./pages/admin/UsersList";
import NGOsList from "./pages/admin/NGOsList";
import ReviewsList from "./pages/admin/ReviewsList";
import About from "./pages/About";
import Capabilities from "./pages/Capabilities";
import Mission from "./pages/Mission";
import Career from "./pages/Career";
import NGODirectory from "./pages/NGODirectory";
import NGOProfilePage from "./pages/NGOProfile";
import NGOSignup from "./pages/ngo/Signup";
import NGODashboard from "./pages/ngo/Dashboard";
import NGOProfile from "./pages/ngo/Profile";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import AdminForgotPassword from "./pages/admin/ForgotPassword";
import CaseDetails from "./pages/CaseDetails";
import StepperDemo from "./pages/StepperDemo";
import NotFound from "./pages/NotFound";
import PaymentResult from "./pages/PaymentResult";

const ProtectedRoute = ({ children, allowedRoles }) => {
  const { isAuthenticated, user, loading } = useAuth();

  if (loading) return <div className="text-center mt-5">Loading...</div>;
  if (!isAuthenticated) return <Navigate to="/" replace />;
  if (allowedRoles && !allowedRoles.includes(user?.role))
    return <Navigate to="/" replace />;

  return children;
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AuthProvider>
          <RealTimeProvider>
            <ToastContainer />

            {/* AIChatbot - Floating button on all pages */}

            <Routes>
              {/* Public Routes */}
              <Route path="/" element={<LandingPage />} />
              <Route path="/lawyers" element={<LawyerListing />} />
              <Route path="/lawyer/:id" element={<LawyerProfile />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/chatbot" element={<ChatbotPage />} />
              <Route path="/about" element={<About />} />
              <Route path="/capabilities" element={<Capabilities />} />
              <Route path="/mission" element={<Mission />} />
              <Route path="/career" element={<Career />} />

              {/* Unified Public Auth Routes */}
              <Route path="/login" element={<Login />} />
              <Route path="/signup" element={<Signup />} />
              <Route path="/forgot-password" element={<ForgotPassword />} />
              <Route path="/reset-password" element={<ResetPassword />} />

              {/* Legacy Login Redirects */}
              <Route path="/user/login" element={<Navigate to="/login?role=user" replace />} />
              <Route path="/lawyer/login" element={<Navigate to="/login?role=lawyer" replace />} />
              <Route path="/ngo/login" element={<Navigate to="/login?role=ngo" replace />} />

              {/* Dashboard Route Aliases */}
              <Route path="/dashboard" element={<Navigate to="/user/dashboard" replace />} />
              <Route path="/ngo-dashboard" element={<Navigate to="/ngo/dashboard" replace />} />
              <Route path="/lawyer-dashboard" element={<Navigate to="/lawyer/dashboard" replace />} />

              {/* User Routes */}
              <Route path="/user/signup" element={<UserSignup />} />
              <Route
                path="/user/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <UserDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/user/profile"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <UserProfile />
                  </ProtectedRoute>
                }
              />

              {/* Lawyer Routes */}
              <Route path="/lawyer/signup" element={<LawyerSignup />} />
              <Route path="/lawyer/profile" element={<LawyersProfile />} />
              <Route path="/lawyer/cases" element={<LawyerCases />} />
              <Route
                path="/lawyer/requests"
                element={
                  <ProtectedRoute allowedRoles={["lawyer"]}>
                    <LawyerDashboard view="requests" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/lawyer/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["lawyer"]}>
                    <LawyerDashboard />
                  </ProtectedRoute>
                }
              />

              {/* Admin Routes */}
              <Route path="/admin/login" element={<AdminLogin />} />
              <Route path="/admin/forgot-password" element={<AdminForgotPassword />} />
              <Route path="/admin/accept-invite" element={<AdminAcceptInvite />} />
              <Route
                path="/admin/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/lawyers"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <LawyersList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/users"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <UsersList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/ngos"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <NGOsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/reviews"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <ReviewsList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/cases"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminCasesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/audit-log"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminAuditLog />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/disputes"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminDisputesList />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/payments"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminPayments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/announcements"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminAnnouncements />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin/settings"
                element={
                  <ProtectedRoute allowedRoles={["admin"]}>
                    <AdminSettings />
                  </ProtectedRoute>
                }
              />

              {/* Public NGO Routes */}
              <Route path="/ngos" element={<NGODirectory />} />
              <Route path="/ngo/:id" element={<NGOProfilePage />} />

              {/* NGO Auth Routes */}
              <Route path="/ngo/signup" element={<NGOSignup />} />

              {/* NGO Portal - Protected */}
              <Route
                path="/ngo/dashboard"
                element={
                  <ProtectedRoute allowedRoles={["ngo"]}>
                    <NGODashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ngo/cases"
                element={
                  <ProtectedRoute allowedRoles={["ngo"]}>
                    <NGODashboard view="cases" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ngo/requests"
                element={
                  <ProtectedRoute allowedRoles={["ngo"]}>
                    <NGODashboard view="requests" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ngo/panel"
                element={
                  <ProtectedRoute allowedRoles={["ngo"]}>
                    <NGODashboard view="panel" />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/ngo/profile"
                element={
                  <ProtectedRoute allowedRoles={["ngo"]}>
                    <NGOProfile />
                  </ProtectedRoute>
                }
              />

              {/* Card payment result (Stripe sends the citizen back here) */}
              <Route
                path="/payment/success"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <PaymentResult />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/payment/cancelled"
                element={
                  <ProtectedRoute allowedRoles={["user"]}>
                    <PaymentResult />
                  </ProtectedRoute>
                }
              />

              {/* Dedicated Case Management Route */}
              <Route
                path="/case/:id"
                element={
                  <ProtectedRoute allowedRoles={["user", "lawyer", "ngo", "admin"]}>
                    <CaseDetails />
                  </ProtectedRoute>
                }
              />

              {/* Interactive Stepper Showcase Route */}
              <Route path="/stepper-demo" element={<StepperDemo />} />

              {/* 404 Catch-all */}
              <Route path="*" element={<NotFound />} />
            </Routes>
          </RealTimeProvider>
        </AuthProvider>
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
