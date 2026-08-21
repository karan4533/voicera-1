import type { ReactNode } from "react";
import { Navigate } from "react-router";
import { useAuth } from "../context/AuthContext";
import { SuspendedAccountScreen } from "./SuspendedAccountScreen";
import type { UserRole } from "../lib/auth";

function FullPageSpinner() {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "100vh",
        backgroundColor: "#FAFAF9",
      }}
    >
      <div
        style={{
          width: 36,
          height: 36,
          borderRadius: "50%",
          border: "3px solid #E2DDD5",
          borderTopColor: "#50381F",
          animation: "spin 0.75s linear infinite",
        }}
      />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

interface RoleRouteProps {
  children: ReactNode;
  allowedRoles: UserRole[];
}

export function RoleRoute({ children, allowedRoles }: RoleRouteProps) {
  const { session, loading } = useAuth();

  if (loading) return <FullPageSpinner />;

  if (!session) return <Navigate to="/login" replace />;

  if (allowedRoles.includes(session.user.role)) {
    const isCustomer = session.user.role === "customer_admin" || session.user.role === "customer_user";
    if (isCustomer && session.user.orgStatus === "suspended") {
      return <SuspendedAccountScreen />;
    }
    return <>{children}</>;
  }

  if (session.user.role === "platform_admin") {
    return <Navigate to="/admin" replace />;
  }
  return <Navigate to="/dashboard" replace />;
}
