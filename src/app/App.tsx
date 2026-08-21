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
import { AgentLibraryPage } from "./pages/AgentLibraryPage";
import { CustomizePage } from "./pages/CustomizePage";
import { AnalyticsPage } from "./pages/AnalyticsPage";
import { TeamPage } from "./pages/TeamPage";
import { KnowledgePage } from "./pages/KnowledgePage";

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
  if (loading) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", minHeight: "100vh", background: "#FAFAF9" }}>
        <div style={{ width: 36, height: 36, borderRadius: "50%", border: "3px solid #E2DDD5", borderTopColor: "#50381F", animation: "spin 0.75s linear infinite" }} />
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
      </div>
    );
  }
  if (session) {
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
              {/* PRD: Login → Dashboard → Library → Configure → My Agents
                  Ops: Live Calls ↔ Call Analytics ↔ Outbound Campaign · Team */}
              <Route index element={<DashboardPage />} />
              <Route path="library" element={<AgentLibraryPage />} />
              <Route
                path="configure"
                element={
                  <RoleRoute allowedRoles={["customer_admin"]}>
                    <CustomizePage />
                  </RoleRoute>
                }
              />
              <Route path="agents" element={<AgentsPage />} />
              <Route path="live-calls" element={<LiveCallsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="knowledge" element={<KnowledgePage />} />
              <Route
                path="campaigns"
                element={
                  <RoleRoute allowedRoles={["customer_admin"]}>
                    <CallRemindersPage />
                  </RoleRoute>
                }
              />
              <Route
                path="team"
                element={
                  <RoleRoute allowedRoles={["customer_admin"]}>
                    <TeamPage />
                  </RoleRoute>
                }
              />
              <Route path="usage" element={<UsagePage />} />

              {/* Legacy redirects */}
              <Route path="customize" element={<Navigate to="/dashboard/configure" replace />} />
              <Route path="call-reminders" element={<Navigate to="/dashboard/campaigns" replace />} />
              <Route path="monitoring" element={<Navigate to="/dashboard" replace />} />
              <Route path="settings" element={<Navigate to="/dashboard/configure" replace />} />
            </Route>

            {/* ── Catch-all → login (RoleRoute handles authenticated redirects) ─ */}
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AgentProvider>
    </AuthProvider>
  );
}
