import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider, useAuth } from "@/hooks/useAuth";
import { ThemeProvider } from "next-themes";
import { NotificationInitializer } from "@/components/NotificationInitializer";
import { CopilotWidget } from "@/components/CopilotWidget";
import { CommandPalette } from "@/components/CommandPalette";
import Landing from "./pages/Landing";
import Auth from "./pages/Auth";
import Onboarding from "./pages/Onboarding";
import ValidatePlan from "./pages/ValidatePlan";
import Dashboard from "./pages/Dashboard";
import PlanDetail from "./pages/PlanDetail";
import SharedPlan from "./pages/SharedPlan";
import SharedCalendar from "./pages/SharedCalendar";
import Integrations from "./pages/Integrations";
import CalendarPage from "./pages/CalendarPage";
import ResetPassword from "./pages/ResetPassword";
import BusinessPlans from "./pages/BusinessPlans";
import BusinessPlanDetail from "./pages/BusinessPlanDetail";
import SharedBusinessPlan from "./pages/SharedBusinessPlan";
import BusinessModels from "./pages/BusinessModels";
import BusinessModelDetail from "./pages/BusinessModelDetail";
import SharedBusinessModel from "./pages/SharedBusinessModel";
import Budgets from "./pages/Budgets";
import BudgetDetail from "./pages/BudgetDetail";
import SharedBudget from "./pages/SharedBudget";
import CoherenceDashboard from "./pages/CoherenceDashboard";
import ChecksPage from "./pages/ChecksPage";
import ProgressReports from "./pages/ProgressReports";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  return <>{children}</>;
}

const AppRoutes = () => (
  <BrowserRouter>
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/auth" element={<Auth />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/share/:token" element={<SharedPlan />} />
      <Route path="/calendar/share/:token" element={<SharedCalendar />} />
      <Route path="/business-plan/share/:token" element={<SharedBusinessPlan />} />
      <Route path="/business-model/share/:token" element={<SharedBusinessModel />} />
      <Route path="/budget/share/:token" element={<SharedBudget />} />
      <Route
        path="/onboarding"
        element={
          <ProtectedRoute>
            <Onboarding />
          </ProtectedRoute>
        }
      />
      <Route
        path="/validate-plan"
        element={
          <ProtectedRoute>
            <ValidatePlan />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <Dashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/plan/:id"
        element={
          <ProtectedRoute>
            <PlanDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <CalendarPage />
          </ProtectedRoute>
        }
      />
      <Route
        path="/integrations"
        element={
          <ProtectedRoute>
            <Integrations />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-plans"
        element={
          <ProtectedRoute>
            <BusinessPlans />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-plan/:id"
        element={
          <ProtectedRoute>
            <BusinessPlanDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-models"
        element={
          <ProtectedRoute>
            <BusinessModels />
          </ProtectedRoute>
        }
      />
      <Route
        path="/business-model/:id"
        element={
          <ProtectedRoute>
            <BusinessModelDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/budgets"
        element={
          <ProtectedRoute>
            <Budgets />
          </ProtectedRoute>
        }
      />
      <Route
        path="/budget/:id"
        element={
          <ProtectedRoute>
            <BudgetDetail />
          </ProtectedRoute>
        }
      />
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <ProgressReports />
          </ProtectedRoute>
        }
      />
      <Route
        path="/coherence"
        element={
          <ProtectedRoute>
            <CoherenceDashboard />
          </ProtectedRoute>
        }
      />
      <Route path="*" element={<NotFound />} />
    </Routes>
    <CopilotWidget />
    <CommandPalette />
  </BrowserRouter>
);

const App = () => (
  <QueryClientProvider client={queryClient}>
    <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
      <AuthProvider>
        <TooltipProvider>
          <Toaster />
          <Sonner />
          <NotificationInitializer />
          <AppRoutes />
        </TooltipProvider>
      </AuthProvider>
    </ThemeProvider>
  </QueryClientProvider>
);

export default App;
