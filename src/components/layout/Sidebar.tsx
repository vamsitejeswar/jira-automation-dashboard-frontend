import { useState } from "react";
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
  PanelLeftClose,
  PanelLeftOpen,
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
  { title: "Settings", items: [{ to: "/settings", icon: Settings, label: "Settings" }] },
];

const COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

// One props-configurable inner layout, rendered twice by the exported
// Sidebar below -- a permanently visible lg:+ column (which alone can
// collapse to an icon rail, toggled by the floating button on its edge),
// and (below lg:) a slide-over drawer triggered by AppLayout's hamburger
// button, always shown expanded.
function SidebarContent({ onNavigate, collapsed = false }: { onNavigate?: () => void; collapsed?: boolean }) {
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

  // Every collapsible bit of text below stays mounted and just animates
  // opacity + max-width (+ max-height/margin for block-level ones) to 0 --
  // conditionally unmounting them instead snaps out instantly and reflows
  // whatever's left (e.g. the icon re-centering), which reads as a jerk
  // even though the aside's own width is animating smoothly.
  const fade = "overflow-hidden transition-all duration-300 ease-out";

  return (
    <>
      {/* Logo */}
      <div className="flex h-20 items-center gap-3 px-5 border-b border-slate-100 dark:border-neutral-800">
        <div className="flex items-center justify-center rounded-lg flex-shrink-0">
          <img
            src="/Jira_Logo.svg"
            alt="Jira Automation"
            className="h-14 w-14 object-contain"
          />
        </div>
        <div className={cn(fade, "min-w-0", collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100")}>
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
              <p
                className={cn(
                  fade,
                  "px-3 text-[10px] font-semibold uppercase tracking-widest text-slate-400 dark:text-neutral-500 whitespace-nowrap",
                  collapsed ? "max-h-0 opacity-0 mb-0" : "max-h-4 opacity-100 mb-1.5"
                )}
              >
                {group.title}
              </p>
            )}
            {/* Collapsed: a column flex with items-center so each li
                shrink-wraps to its NavLink's real content width (icon +
                gap, since the label's collapsed to 0) instead of
                stretching block-level to the full row width -- centers
                the icon by fixing the box's size, not by nudging it. */}
            <ul className={collapsed ? "flex flex-col items-center gap-0.5" : "space-y-0.5"}>
              {group.items.map(({ to, icon: Icon, label }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={to === "/"}
                    onClick={onNavigate}
                    title={collapsed ? label : undefined}
                    className={({ isActive }) =>
                      cn(
                        "flex items-center rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-300 ease-out",
                        collapsed ? "gap-0" : "gap-3",
                        isActive
                          ? "border-blue-600 bg-blue-50 text-blue-600 dark:border-blue-400 dark:bg-blue-500/10 dark:text-blue-400"
                          : "border-transparent text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-400 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100"
                      )
                    }
                  >
                    <Icon className="h-5 w-5 shrink-0" />
                    <span className={cn(fade, "truncate", collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100")}>
                      {label}
                    </span>
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
          <div className={cn(fade, "min-w-0", collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100")}>
            <p className="text-xs font-medium text-slate-900 truncate dark:text-neutral-100">{me.data?.name ?? me.data?.email ?? "..."}</p>
            <p className="text-[10px] truncate text-slate-400 dark:text-neutral-500">{me.data?.name ? me.data.email : "Administrator"}</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300 ml-auto"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </>
  );
}

export function Sidebar({ mobileOpen = false, onClose }: { mobileOpen?: boolean; onClose?: () => void }) {
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_STORAGE_KEY) === "1");

  function toggleCollapsed() {
    setCollapsed((prev) => {
      const next = !prev;
      localStorage.setItem(COLLAPSE_STORAGE_KEY, next ? "1" : "0");
      return next;
    });
  }

  return (
    <>
      {/* Permanent column on desktop -- hidden entirely below lg: so it
          never competes with page content for the ~390px a phone actually
          has (was previously always rendered at a fixed 240px, see
          docs/UI_BUG_REPORT.md Bug 1). Width animates between the full and
          icon-rail states rather than snapping. The toggle is a floating
          circle anchored to the header's divider line, on the aside's own
          right edge -- so it stays put (never reflows into the header)
          while everything behind it collapses. */}
      <aside
        className={cn(
          "hidden lg:flex h-full flex-shrink-0 relative bg-white border-r border-slate-200 transition-[width] duration-300 ease-out dark:bg-neutral-900 dark:border-neutral-800",
          collapsed ? "w-[92px]" : "w-60"
        )}
      >
        <div className="flex h-full w-full flex-col overflow-hidden">
          <SidebarContent collapsed={collapsed} />
        </div>
        <button
          onClick={toggleCollapsed}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="absolute -right-3.5 top-20 -translate-y-1/2 z-10 flex h-7 w-7 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition-colors hover:bg-slate-50 hover:text-slate-700 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-400 dark:hover:bg-neutral-800 dark:hover:text-neutral-200"
        >
          {collapsed ? <PanelLeftOpen className="h-3.5 w-3.5" /> : <PanelLeftClose className="h-3.5 w-3.5" />}
        </button>
      </aside>

      {/* Mobile slide-over, triggered by AppLayout's hamburger button.
          Closes on backdrop click or on picking a nav item. Always shown
          expanded -- collapsing doesn't help on a drawer that's already
          narrower than the desktop rail. */}
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
