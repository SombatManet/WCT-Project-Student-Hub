import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { ProtectedRoute } from "@/components/ProtectedRoute";
import Login from "./pages/Login";
import Register from "./pages/Register";
import Index from "./pages/Index";
import About from "./pages/About";
import Contact from "./pages/Contact";
import Services from "./pages/Services";
import ForgotPassword from "./pages/ForgotPassword";
import ResetPassword from "./pages/ResetPassword";
import Dashboard from "./pages/Dashboard";
import Classes from "./pages/Classes";
import Assignments from "./pages/Assignments";
import Quizzes from "./pages/Quizzes";
import Messages from "./pages/Messages";
import Profile from "./pages/Profile";
import NotFound from "./pages/NotFound";
import AdminDashboard from "./pages/admin/AdminDashboard";
import UserManagement from "./pages/admin/UserManagement";
import ClassManagement from "./pages/admin/ClassManagement";
import QuizManagement from "./pages/admin/QuizManagement";
import AssignmentManagement from "./pages/admin/AssignmentManagement";
import ContactMessages from "./pages/admin/ContactMessages";
import AdminUserProfile from "./pages/admin/AdminUserProfile";
import AdminClassDetail from "./pages/admin/AdminClassDetail";

const queryClient = new QueryClient();

// Create a component for the root redirect
const RootRedirect = () => {
  const { user } = useAuth();
  
  if (!user) return <Index />;
  
  // Redirect based on user role - only admin goes to /admin, others go to /dashboard
  switch (user.role) {
    case "admin":
      return <Navigate to="/admin" replace />;
    default:
      return <Navigate to="/dashboard" replace />; // Students and teachers go to dashboard
  }
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <Routes>
            <Route path="/" element={<RootRedirect />} />
            <Route path="/login" element={<Login />} />
            <Route path="/register" element={<Register />} />
            {/* Public information pages */}
            <Route path="/about" element={<About />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/services" element={<Services />} />
            {/* Password reset */}
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route
              path="/dashboard"
              element={
                <ProtectedRoute>
                  <Dashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/classes"
              element={
                <ProtectedRoute>
                  <Classes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/assignments"
              element={
                <ProtectedRoute>
                  <Assignments />
                </ProtectedRoute>
              }
            />
            <Route
              path="/quizzes"
              element={
                <ProtectedRoute>
                  <Quizzes />
                </ProtectedRoute>
              }
            />
            <Route
              path="/messages"
              element={
                <ProtectedRoute>
                  <Messages />
                </ProtectedRoute>
              }
            />
            <Route
              path="/profile"
              element={
                <ProtectedRoute>
                  <Profile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <AdminDashboard />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <UserManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/users/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <AdminUserProfile />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <ClassManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/classes/:id"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <AdminClassDetail />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/quizzes"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <QuizManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/assignments"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <AssignmentManagement />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/contact"
              element={
                <ProtectedRoute allowedRoles={["admin", "superadmin"]}>
                  <ContactMessages />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;