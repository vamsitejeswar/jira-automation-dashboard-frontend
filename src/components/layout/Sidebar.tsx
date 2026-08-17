import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  AlertTriangle,
  UserSearch,
  MailCheck,
  Settings,
  CalendarClock,
  LogOut,
} from "lucide-react";
import { getMe, logout } from "@/api";

// Grouped by the question each answers, not by the backend concept behind
// it -- "what's true right now," "find someone," "needs a decision from
// me," "is the system healthy," in that order.
const NAV_GROUPS: { title: string | null; items: { to: string; icon: React.ElementType; label: string }[] }[] = [
  { title: null, items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }] },
  {
    title: "People & Tickets",
    items: [
      { to: "/employees", icon: UserSearch, label: "Employee Search" },
      { to: "/tickets", icon: Ticket, label: "All Tickets" },
    ],
  },
  { title: "Needs a Decision", items: [{ to: "/approvals", icon: MailCheck, label: "Approvals" }] },
  {
    title: "System Health",
    items: [
      { to: "/schedules", icon: CalendarClock, label: "Scheduled Jobs" },
      { to: "/anomalies", icon: AlertTriangle, label: "Failures & History" },
    ],
  },
  { title: null, items: [{ to: "/settings", icon: Settings, label: "Settings" }] },
];

// One props-configurable inner layout, rendered twice by the exported
// Sidebar below -- a permanently visible lg:+ column, and (below lg:) a
// slide-over drawer triggered by AppLayout's hamburger button. Sharing this
// keeps nav/logout logic in exactly one place instead of two components
// drifting apart.
function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  // Already fetched (and cached under the same key) by AuthGate on page
  // load -- this just reads that cache, no extra request.
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });

  async function handleLogout() {
    await logout();
    qc.removeQueries({ queryKey: ["me"] });
    navigate("/login", { replace: true });
  }

  return (
    <>
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 px-5 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex not-only:items-center justify-center rounded-lgflex-shrink-0">
          <img
            src="/Jira_Logo.svg"
            alt="Jira Automation"
            className="h-14 w-14 object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-none truncate dark:text-neutral-100">Jira Automation</p>
          <p className="text-[11px] mt-0.5 truncate text-slate-400 dark:text-neutral-500">
            Admin Dashboard
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-4">
        {NAV_GROUPS.map((group, gi) => (
          <div key={gi}>
            {group.title && (
              <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-neutral-500">
                {group.title}
              </p>
            )}
            <ul className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                        isActive
                          ? "bg-blue-600 text-white shadow-md"
                          : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-100"
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className="truncate">{label}</span>
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100 dark:border-neutral-800">
        <div className="flex items-center gap-2">
          {me.data?.picture ? (
            <img
              src={me.data.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 flex-shrink-0 dark:bg-blue-500/20">
              <span className="text-xs font-bold text-blue-600 dark:text-blue-400">
                {(me.data?.name ?? me.data?.email ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-900 truncate dark:text-neutral-100">{me.data?.name ?? me.data?.email ?? "..."}</p>
            <p className="text-[10px] truncate text-slate-400 dark:text-neutral-500">{me.data?.name ? me.data.email : "Administrator"}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  return (
    <>
      {/* Permanent column on desktop -- hidden entirely below lg: so it
          never competes with page content for the ~390px a phone actually
          has (was previously always rendered at a fixed 240px, see
          docs/UI_BUG_REPORT.md Bug 1). */}
      <aside className="hidden lg:flex h-full w-60 flex-col flex-shrink-0 bg-white border-r border-slate-200 dark:bg-neutral-900 dark:border-neutral-800">
        <SidebarContent />
      </aside>

      {/* Mobile slide-over, triggered by AppLayout's hamburger button.
          Closes on backdrop click or on picking a nav item. */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-black/40" onClick={onClose} />
          <aside className="relative flex h-full w-64 max-w-[80vw] flex-col bg-white border-r border-slate-200 shadow-xl dark:bg-neutral-900 dark:border-neutral-800">
            <SidebarContent onNavigate={onClose} />
          </aside>
        </div>
      )}
    </>
  );
}
