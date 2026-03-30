import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import AppLayout from "@/components/AppLayout";
import PwaInstallPrompt from "@/components/PwaInstallPrompt";
import Login from "@/pages/Login";
import Dashboard from "@/pages/Dashboard";
import UsersManagement from "@/pages/UsersManagement";
import Groups from "@/pages/Groups";
import GroupDetail from "@/pages/GroupDetail";
import ShareLinks from "@/pages/ShareLinks";
import PublicForm from "@/pages/PublicForm";
import TrackingPage from "@/pages/TrackingPage";
import PublicStats from "@/pages/PublicStats";
import Profile from "@/pages/Profile";
import AppSettings from "@/pages/AppSettings";
import Komisi from "@/pages/Komisi";
import CommissionDashboard from "@/pages/CommissionDashboard";
import OwnerBilling from "@/pages/OwnerBilling";
import BillingManagement from "@/pages/BillingManagement";
import PaymentMethodsManagement from "@/pages/PaymentMethodsManagement";
import OwnerPaymentMethods from "@/pages/OwnerPaymentMethods";
import UmkmDashboard from "@/pages/UmkmDashboard";
import Register from "@/pages/Register";
import Pricing from "@/pages/Pricing";
import NotFound from "@/pages/NotFound";
import { ReactNode } from "react";

const queryClient = new QueryClient();

function ProtectedRoute({ children, allowedRoles }: { children: ReactNode; allowedRoles?: string[] }) {
  const { user, role, loading } = useAuth();

  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (!user) return <Navigate to="/login" replace />;
  if (role === "umkm") {
    if (allowedRoles && !allowedRoles.includes("umkm")) return <Navigate to="/umkm" replace />;
    return <AppLayout>{children}</AppLayout>;
  }
  if (allowedRoles && role && !allowedRoles.includes(role)) return <Navigate to="/dashboard" replace />;

  return <AppLayout>{children}</AppLayout>;
}

function AuthRoute({ children }: { children: ReactNode }) {
  const { user, role, loading } = useAuth();
  if (loading) return <div className="flex min-h-screen items-center justify-center text-muted-foreground">Memuat...</div>;
  if (user) {
    if (role === "umkm") return <Navigate to="/umkm" replace />;
    return <Navigate to="/dashboard" replace />;
  }
  return <>{children}</>;
}

const AppRoutes = () => (
  <>
    <Routes>
      <Route path="/login" element={<AuthRoute><Login /></AuthRoute>} />
      <Route path="/register" element={<AuthRoute><Register /></AuthRoute>} />
      <Route path="/public-form/:token" element={<PublicForm />} />
      <Route path="/f/:slug" element={<PublicForm />} />
      <Route path="/tracking" element={<TrackingPage />} />
      <Route path="/tracking/:code" element={<TrackingPage />} />
      <Route path="/statistik" element={<PublicStats />} />
      <Route path="/pricing" element={<Pricing />} />
      <Route path="/" element={<Navigate to="/dashboard" replace />} />
      <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />
      <Route path="/users" element={<ProtectedRoute allowedRoles={["super_admin", "owner"]}><UsersManagement /></ProtectedRoute>} />
      <Route path="/groups" element={<ProtectedRoute><Groups /></ProtectedRoute>} />
      <Route path="/groups/:id" element={<ProtectedRoute><GroupDetail /></ProtectedRoute>} />
      <Route path="/share" element={<ProtectedRoute><ShareLinks /></ProtectedRoute>} />
      <Route path="/komisi" element={<ProtectedRoute><Komisi /></ProtectedRoute>} />
      <Route path="/commission-dashboard" element={<ProtectedRoute allowedRoles={["super_admin"]}><CommissionDashboard /></ProtectedRoute>} />
      <Route path="/billing" element={<ProtectedRoute allowedRoles={["owner"]}><OwnerBilling /></ProtectedRoute>} />
      <Route path="/billing-management" element={<ProtectedRoute allowedRoles={["super_admin"]}><BillingManagement /></ProtectedRoute>} />
      <Route path="/payment-methods" element={<ProtectedRoute allowedRoles={["super_admin"]}><PaymentMethodsManagement /></ProtectedRoute>} />
      <Route path="/owner-payment-methods" element={<ProtectedRoute allowedRoles={["owner"]}><OwnerPaymentMethods /></ProtectedRoute>} />
      <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
      <Route path="/settings" element={<ProtectedRoute allowedRoles={["super_admin", "owner"]}><AppSettings /></ProtectedRoute>} />
      <Route path="/umkm" element={<ProtectedRoute allowedRoles={["umkm"]}><UmkmDashboard /></ProtectedRoute>} />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <PwaInstallPrompt />
  </>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider defaultTheme="light" attribute="class">
      <TooltipProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter>
          <AuthProvider>
            <AppRoutes />
          </AuthProvider>
        </BrowserRouter>
      </TooltipProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
