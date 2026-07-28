import { useEffect, useState, useCallback } from "react";
import { Outlet, NavLink, useNavigate } from "react-router";
import {
  Bot, LayoutDashboard, Sliders, BellRing, Phone,
  Bell, Menu, X, LogOut, HelpCircle, Building2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { AgentSwitcher } from "../components/AgentSwitcher";
import { getSystemHealth } from "../lib/api";
import heuristicLabsLogoLight from "../../assets/heuristic-labs-logo-light.png";

// ── Sidebar nav items ──────────────────────────────────────────────────────────

const navItems = [
  { icon: Bot,           label: "Agents",               path: "/dashboard/agents" },
  { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
  { icon: Sliders,       label: "Customize Agent",   path: "/dashboard/customize" },
  { icon: BellRing,      label: "Call Scheduler",       path: "/dashboard/call-reminders" },
  { icon: Phone,         label: "Live Calls",           path: "/dashboard/live-calls" },
];

// ── NavItem ────────────────────────────────────────────────────────────────────

function NavItem({ icon: Icon, label, path, end, onNavigate }: {
  icon: typeof Phone; label: string; path: string; end?: boolean; onNavigate?: () => void;
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

export function DashboardLayout() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const [health, setHealth] = useState({ status: "healthy", activeCalls: 0, avgLatency: 420 });
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);

  useEffect(() => {
    const load = () => getSystemHealth().then(setHealth);
    load();
    const id = setInterval(load, 5000);
    return () => clearInterval(id);
  }, []);

  // Close sidebar on Escape key
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
      {/* Logo */}
      <div className="flex items-center gap-3 px-5 pt-6 pb-5">
        <img
          src={heuristicLabsLogoLight}
          alt="Voicera"
          className="h-[38px] w-[38px] object-contain shrink-0"
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

      {/* Section label */}
      <div className="px-5 pb-2">
        <span style={{ fontSize: 10, fontWeight: 600, color: "rgba(255,255,255,0.4)", textTransform: "uppercase", letterSpacing: "0.1em" }}>
          Navigation
        </span>
      </div>

      <nav className="flex flex-1 flex-col gap-0.5">
        {navItems.map(({ icon, label, path }) => (
          <NavItem
            key={path}
            icon={icon}
            label={label}
            path={path}
            end={path === "/dashboard"}
            onNavigate={closeSidebar}
          />
        ))}
      </nav>

      {/* Footer */}
      <div className="border-t border-white/10 pt-2">
        <button className="flex h-9 w-full items-center gap-2 border-none bg-transparent px-[18px] text-white/50 cursor-pointer text-[12px] hover:text-white/80 transition-colors">
          <HelpCircle size={14} />
          Help & Support
        </button>

        {/* User info row */}
        <div className="flex h-14 w-full items-center gap-2.5 px-[18px] mb-1">
          <div className="h-7 w-7 shrink-0 rounded-full bg-white/20 flex items-center justify-center">
            <span className="text-[11px] font-bold text-white uppercase">
              {session?.user.name?.[0] ?? "A"}
            </span>
          </div>
          <div className="flex min-w-0 flex-1 flex-col items-start">
            <span className="text-[12px] font-semibold text-white/90 truncate max-w-[110px]">
              {session?.user.name ?? "Admin User"}
            </span>
            <span className="max-w-[110px] truncate text-[10px] text-white/45">
              {session?.user.email ?? ""}
            </span>
            {/* Role badge */}
            <span className="mt-0.5 text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-white/15 text-white/70">
              {session?.user.role === "customer_admin" ? "Customer Admin" :
               session?.user.role === "customer_user"  ? "Customer User"  :
               "Workspace"}
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

        {/* Org identifier */}
        {session?.user.orgId && (
          <div className="flex items-center gap-1.5 px-[18px] pb-2">
            <Building2 size={10} className="text-white/30 shrink-0" />
            <span className="text-[10px] text-white/30 truncate font-mono">{session.user.orgId}</span>
          </div>
        )}
      </div>
    </>
  );

  return (
    <div className="flex h-[100dvh] w-full overflow-hidden bg-[#F7F4EF] font-[Inter,sans-serif]">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          onClick={closeSidebar}
          aria-hidden={true}
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-50 flex h-full w-[220px] flex-col transition-transform duration-200 lg:static lg:z-auto lg:min-w-[210px] lg:translate-x-0 ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
        style={{ backgroundColor: "#50381F" }}
      >
        {sidebar}
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="shrink-0 border-b border-[#E2DDD5] bg-white px-4 h-14 sm:px-6">
          <div className="flex items-center justify-between w-full h-14">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => setSidebarOpen(true)}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-[#E2DDD5] bg-white lg:hidden cursor-pointer"
                aria-label="Open menu"
              >
                <Menu size={18} color="#7A746C" />
              </button>
              <div className="hidden sm:flex items-center gap-2">
                <span className="text-[12px] font-medium text-[#9E9890]">Active Agent:</span>
                <AgentSwitcher />
              </div>
            </div>

            <div className="flex items-center gap-3 sm:gap-5">
              <div className="flex items-center gap-1.5">
                <div className={`h-2 w-2 rounded-full ${health.status === "healthy" ? "bg-[#22C55E]" : "bg-[#F59E0B]"}`} />
                <span className="text-[12px] font-medium text-[#7A746C] hidden sm:inline">
                  {health.status === "healthy" ? "System Healthy" : "Degraded"}
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="text-[12px] font-semibold text-[#50381F] bg-[#EDE4D8] px-2.5 py-0.5 rounded-full">
                  {health.activeCalls} Active
                </span>
              </div>
              <button
                type="button"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD5] bg-white cursor-pointer hover:border-[#C9B99E] transition-colors"
                aria-label="Notifications"
              >
                <Bell size={15} className="text-[#7A746C]" />
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
            <h2 className="m-0 mb-2 text-base font-bold text-[#1E1A14]">Sign out?</h2>
            <p className="m-0 mb-5 text-[13px] text-[#7A746C]">
              You will be returned to the login page.
            </p>
            <div className="flex gap-3 justify-end">
              <button
                type="button"
                onClick={() => setLogoutConfirm(false)}
                className="h-9 rounded-lg border border-[#E2DDD5] bg-white px-4 text-[13px] font-medium text-[#1E1A14] cursor-pointer hover:bg-[#F7F4EF] transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                id="confirm-logout"
                onClick={handleLogout}
                className="h-9 rounded-lg border-none bg-[#DC2626] px-4 text-[13px] font-semibold text-white cursor-pointer hover:bg-[#B91C1C] transition-colors"
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
