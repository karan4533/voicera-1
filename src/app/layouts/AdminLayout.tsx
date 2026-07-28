import { useState, useCallback, useEffect } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import {
  LayoutDashboard, Users, Package,
  Activity, LogOut, X, Menu, Shield, HelpCircle, Bell,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import heuristicLabsLogo from "../../assets/heuristic-labs-logo.png";

// ── Admin nav items ────────────────────────────────────────────────────────────

const adminNavItems = [
  { icon: LayoutDashboard, label: "Overview",           path: "/admin" },
  { icon: Users,           label: "Customer Accounts",  path: "/admin/customers" },
  { icon: Package,         label: "Subscriptions",      path: "/admin/subscriptions" },
  { icon: Activity,        label: "System Health",      path: "/admin/system-health" },
];

// ── NavItem ────────────────────────────────────────────────────────────────────

function AdminNavItem({
  icon: Icon, label, path, end, onNavigate,
}: {
  icon: typeof Shield; label: string; path: string; end?: boolean; onNavigate?: () => void;
}) {
  return (
    <NavLink
      to={path}
      end={end}
      onClick={onNavigate}
      className={({ isActive }) =>
        `flex items-center gap-2.5 h-10 px-[18px] border-l-[3px] text-[13px] no-underline w-full transition-colors ${
          isActive
            ? "border-l-white/90 bg-white/15 text-white font-semibold"
            : "border-l-transparent text-white/65 font-normal hover:bg-white/10 hover:text-white/90"
        }`
      }
    >
      <Icon size={15} />
      {label}
    </NavLink>
  );
}

// ── Layout ─────────────────────────────────────────────────────────────────────

export function AdminLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    if (e.key === "Escape") {
      setSidebarOpen(false);
      setLogoutConfirm(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [handleKeyDown]);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const closeSidebar = () => setSidebarOpen(false);

  const sidebar = (
    <>
      {/* Logo + brand */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <img
          src={heuristicLabsLogo}
          alt="Voicera"
          className="h-[38px] w-[38px] object-contain shrink-0"
          style={{ filter: "brightness(0) invert(1)" }}
        />
        <span style={{ fontFamily: "Inter, sans-serif", fontWeight: 700, fontSize: 20, color: "#FFFFFF", letterSpacing: "-0.01em" }}>
          Voicera
        </span>
        <button
          type="button"
          onClick={closeSidebar}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-lg bg-white/10 lg:hidden cursor-pointer border-none"
          aria-label="Close menu"
        >
          <X size={16} color="white" />
        </button>
      </div>

      {/* Platform Admin badge */}
      <div className="mx-[18px] mb-4 px-2 py-1.5 rounded bg-white/15">
        <div className="flex items-center gap-1.5">
          <Shield size={10} className="shrink-0" style={{ color: "rgba(255,255,255,0.7)" }} />
          <span style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.7)", letterSpacing: "0.05em", textTransform: "uppercase" }}>
            Platform Admin
          </span>
        </div>
      </div>

      {/* Section label */}
      <div className="px-5 pb-2">
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Management
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5 pb-2">
        {adminNavItems.map(({ icon, label, path }) => (
          <AdminNavItem
            key={path}
            icon={icon}
            label={label}
            path={path}
            end={path === "/admin"}
            onNavigate={closeSidebar}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 pt-2">
        <button className="flex h-9 w-full items-center gap-2 border-none bg-transparent px-[18px] text-[12px] transition-colors cursor-pointer text-white/50 hover:text-white/80">
          <HelpCircle size={14} />
          Help & Support
        </button>
        {/* User info */}
        <div className="flex h-14 w-full items-center gap-2.5 px-[18px] mb-1">
          <div className="h-7 w-7 shrink-0 rounded-full flex items-center justify-center bg-white/20">
            <span className="text-[11px] font-bold uppercase text-white">
              {session?.user.name?.[0] ?? "A"}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <span className="text-[12px] font-semibold truncate max-w-[110px] text-white/90">
              {session?.user.name ?? "Platform Admin"}
            </span>
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-white/70">
              Platform Admin
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLogoutConfirm(true)}
            title="Sign out"
            aria-label="Sign out"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-white/10 hover:bg-white/20 transition-colors cursor-pointer border-none"
          >
            <LogOut size={13} color="rgba(255,255,255,0.65)" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden font-[Inter,sans-serif]" style={{ backgroundColor: "#F7F4EF" }}>
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={closeSidebar}
          aria-hidden={true}
        />
      )}

      {/* Sidebar — earthy theme */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[220px] flex-col transition-transform duration-200 lg:static lg:z-auto lg:min-w-[210px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#50381F" }}
      >
        {sidebar}
      </aside>

      {/* Main content area */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="shrink-0 border-b px-4 h-14 sm:px-6" style={{ backgroundColor: "#FFFFFF", borderColor: "#E7DFC8" }}>
          <div className="flex items-center justify-between w-full h-14">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border lg:hidden cursor-pointer hover:bg-gray-50"
                style={{ borderColor: "#E7DFC8", backgroundColor: "transparent" }}
                aria-label="Open menu"
              >
                <Menu size={18} color="#1E1A16" />
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border" style={{ borderColor: "#E7DFC8", backgroundColor: "#F7F4EF" }}>
                  <Shield size={12} style={{ color: "#50381F" }} />
                  <span className="text-[12px] font-bold" style={{ color: "#50381F" }}>Admin Console</span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-3">
              {/* Live indicator */}
              <div className="flex items-center gap-1.5">
                <div className="h-2 w-2 rounded-full animate-pulse" style={{ backgroundColor: "#4CAF50" }} />
                <span className="text-[12px] font-semibold hidden sm:inline" style={{ color: "#6B645B" }}>All Systems Operational</span>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border cursor-pointer hover:bg-gray-50 transition-colors"
                style={{ borderColor: "#E7DFC8", backgroundColor: "transparent" }}
                aria-label="Notifications"
              >
                <Bell size={15} color="#6B645B" />
              </button>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-auto p-4 sm:p-6 lg:p-7">
          <Outlet />
        </main>
      </div>

      {/* Logout confirmation dialog */}
      {logoutConfirm && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40"
          onClick={() => setLogoutConfirm(false)}
          aria-hidden={true}
        >
          <div
            className="w-[320px] rounded-xl bg-white p-6 shadow-xl"
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Confirm sign out"
          >
            <h2 className="m-0 mb-2 text-base font-bold" style={{ color: "#1E1A16" }}>Sign out?</h2>
            <p className="m-0 mb-5 text-[13px]" style={{ color: "#6B645B" }}>
              You will be returned to the login page.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setLogoutConfirm(false)}
                className="h-9 rounded-lg border px-4 text-[13px] font-semibold cursor-pointer transition-colors"
                style={{ borderColor: "#E7DFC8", color: "#1E1A16", backgroundColor: "#FFFFFF" }}
                onMouseOver={(e) => (e.currentTarget.style.backgroundColor = "#F7F4EF")}
                onMouseOut={(e) => (e.currentTarget.style.backgroundColor = "#FFFFFF")}
              >
                Cancel
              </button>
              <button
                type="button"
                id="admin-confirm-logout"
                onClick={handleLogout}
                className="h-9 rounded-lg border-none px-4 text-[13px] font-bold text-white cursor-pointer transition-colors"
                style={{ backgroundColor: "#D9534F" }}
              >
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
