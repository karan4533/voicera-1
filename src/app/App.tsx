import { BrowserRouter, Routes, Route, Navigate } from "react-router";
import { AuthProvider } from "./context/AuthContext";
import { AgentProvider } from "./context/AgentContext";
import { RoleRoute } from "./components/RoleRoute";
import { LoginScreen } from "./components/LoginScreen";

// ── Customer workspace ─────────────────────────────────────────────────────────
import { DashboardLayout } from "./layouts/DashboardLayout";
import { DashboardPage } from "./pages/DashboardPage";
import { LiveCallsPage } from "./pages/LiveCallsPage";
import { CallRemindersPage } from "./pages/CallRemindersPage";
import { AgentsPage } from "./pages/AgentsPage";
import { CustomizePage } from "./pages/CustomizePage";

// ── Admin Console ──────────────────────────────────────────────────────────────
import { AdminLayout } from "./layouts/AdminLayout";
import { AdminOverviewPage } from "./pages/admin/AdminOverviewPage";
import { CustomerAccountsPage } from "./pages/admin/CustomerAccountsPage";
import { SubscriptionsPage } from "./pages/admin/SubscriptionsPage";
import { PlatformAnalyticsPage } from "./pages/admin/PlatformAnalyticsPage";
import { SystemHealthPage } from "./pages/admin/SystemHealthPage";
import { SecurityPage } from "./pages/admin/SecurityPage";
import { UsagePage } from "./pages/UsagePage";

import { useAuth } from "./context/AuthContext";

/** Redirects already-authenticated users away from the login page. */
function GuestRoute({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (session) {
    // Send to the correct home based on role
    return <Navigate to={session.user.role === "platform_admin" ? "/admin" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
      <AgentProvider>
        <BrowserRouter>
          <Routes>
            {/* ── Public ───────────────────────────────────────────────────── */}
            <Route
              path="/login"
              element={
                <GuestRoute>
                  <LoginScreen />
                </GuestRoute>
              }
            />

            {/* ── Platform Admin Console ───────────────────────────────────── */}
            <Route
              path="/admin"
              element={
                <RoleRoute allowedRoles={["platform_admin"]}>
                  <AdminLayout />
                </RoleRoute>
              }
            >
              <Route index element={<AdminOverviewPage />} />
              <Route path="customers"   element={<CustomerAccountsPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="analytics"   element={<PlatformAnalyticsPage />} />
              <Route path="system-health" element={<SystemHealthPage />} />
              <Route path="security"    element={<SecurityPage />} />
            </Route>

            {/* ── Customer Workspace ───────────────────────────────────────── */}
            <Route
              path="/dashboard"
              element={
                <RoleRoute allowedRoles={["customer_admin", "customer_user"]}>
                  <DashboardLayout />
                </RoleRoute>
              }
            >
              {/* Default → Dashboard & Analytics */}
              <Route index element={<DashboardPage />} />

              {/* Agent management & configuration */}
              <Route path="agents"   element={<AgentsPage />} />
              <Route
                path="customize"
                element={
                  <RoleRoute allowedRoles={["customer_admin"]}>
                    <CustomizePage />
                  </RoleRoute>
                }
              />
              <Route path="usage" element={<UsagePage />} />

              {/* Call management — customer_user is view-only */}
              <Route
                path="call-reminders"
                element={
                  <RoleRoute allowedRoles={["customer_admin"]}>
                    <CallRemindersPage />
                  </RoleRoute>
                }
              />
              <Route path="live-calls"     element={<LiveCallsPage />} />

              {/* Legacy redirects — keep old URLs working */}
              <Route path="monitoring" element={<Navigate to="/dashboard" replace />} />
              <Route path="analytics"  element={<Navigate to="/dashboard" replace />} />
              <Route path="settings"   element={<CustomizePage />} />
            </Route>

            {/* ── Catch-all ────────────────────────────────────────────────── */}
            {/* RoleRoute will handle the role-correct redirect once session loads */}
            <Route path="*" element={<Navigate to="/dashboard" replace />} />
          </Routes>
        </BrowserRouter>
      </AgentProvider>
    </AuthProvider>
  );
}
