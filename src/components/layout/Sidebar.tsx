import { useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
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
  ChevronDown,
  UserPlus2,
  UserMinus2,
  Sparkles,
} from "lucide-react";
import { getMe, logout } from "@/api";
import SpecularButton from "@/components/ui/SpecularButton";
import { DiaTextReveal } from "@/components/ui/dia-text-reveal";

// External AI agent -- opens in a new tab, not a route in this app.
const AI_AGENT_URL =
  "https://vertexaisearch.cloud.google.com/home/cid/114617c1-77ec-4c8a-b23a-1af63e08ea50/r/agent/18216734042038385986/session/-?hl=en_US&_gl=1*263m0x*_ga*NTAxMzAzNzUzLjE3ODMwNzM4MDA.*_ga_WH2QY8WWF5*czE3ODc5MTI1NjUkbzIwMCRnMSR0MTc4NzkxMjU4MyRqNDIkbDAkaDA.";

// Grouped by the question each answers, not by the backend concept behind
// it -- "what's true right now," "find someone," "needs a decision from
// me," "is the system healthy," in that order.
interface NavItem {
  to: string;
  icon: React.ElementType;
  label: string;
  // "All Tickets" only -- lets someone jump straight into the Onboarding or
  // Offboarding PARENT-ticket browse mode (see Tickets.tsx's ?type= param)
  // instead of landing on the unfiltered subtask view and switching there.
  children?: { to: string; icon: React.ElementType; label: string }[];
}
const NAV_GROUPS: { title: string | null; items: NavItem[] }[] = [
  { title: null, items: [{ to: "/", icon: LayoutDashboard, label: "Dashboard" }] },
  {
    title: "People & Tickets",
    items: [
      { to: "/employees", icon: UserSearch, label: "Employee Search" },
      {
        to: "/tickets",
        icon: Ticket,
        label: "All Tickets",
        children: [
          { to: "/tickets?type=onboarding", icon: UserPlus2, label: "Onboarding" },
          { to: "/tickets?type=offboarding", icon: UserMinus2, label: "Offboarding" },
        ],
      },
    ],
  },
  { title: "Needs a Decision", items: [{ to: "/approvals", icon: MailCheck, label: "Approvals" }] },
  {
    title: "System Health",
    items: [
      { to: "/schedules", icon: CalendarClock, label: "Scheduled Jobs" },
      { to: "/anomalies", icon: AlertTriangle, label: "Anomalies & History" },
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
  const location = useLocation();
  const qc = useQueryClient();
  // Already fetched (and cached under the same key) by AuthGate on page
  // load -- this just reads that cache, no extra request.
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });

  // Which parent items (by `to`) currently have their children expanded --
  // starts open whenever the page you're already on is that item's own
  // page, so landing on /tickets?type=onboarding via a direct link (or a
  // refresh) doesn't hide the very control that got you there.
  const [expanded, setExpanded] = useState<Set<string>>(
    () => new Set(NAV_GROUPS.flatMap((g) => g.items).filter((i) => i.children && location.pathname === i.to).map((i) => i.to))
  );
  function toggleExpanded(to: string) {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(to)) next.delete(to);
      else next.add(to);
      return next;
    });
  }
  function isChildActive(childTo: string): boolean {
    const [path, search] = childTo.split("?");
    return location.pathname === path && (!search || location.search === `?${search}`);
  }

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
              {group.items.map(({ to, icon: Icon, label, children }) => (
                <li key={to}>
                  <div className="relative flex items-center">
                    <NavLink
                      to={to}
                      end={to === "/"}
                      onClick={() => {
                        // Clicking "All Tickets" itself both navigates AND
                        // toggles its own dropdown -- click again to close it,
                        // same as clicking the chevron would.
                        if (children && !collapsed) toggleExpanded(to);
                        onNavigate?.();
                      }}
                      title={collapsed ? label : undefined}
                      className={({ isActive }) =>
                        cn(
                          "flex flex-1 items-center rounded-lg border-l-2 px-3 py-2.5 text-sm font-medium transition-colors duration-300 ease-out",
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
                    {children && !collapsed && (
                      <button
                        type="button"
                        onClick={() => toggleExpanded(to)}
                        title={expanded.has(to) ? "Collapse" : "Expand"}
                        className="absolute right-1.5 flex h-6 w-6 flex-shrink-0 items-center justify-center rounded text-slate-400 hover:bg-slate-200/60 hover:text-slate-600 dark:text-neutral-500 dark:hover:bg-neutral-700/50 dark:hover:text-neutral-300"
                      >
                        <ChevronDown className={cn("h-3.5 w-3.5 transition-transform duration-200", expanded.has(to) && "rotate-180")} />
                      </button>
                    )}
                  </div>
                  {children && !collapsed && expanded.has(to) && (
                    <ul className="mt-0.5 ml-4 space-y-0.5 border-l border-slate-200 pl-3 dark:border-neutral-800">
                      {children.map(({ to: childTo, icon: ChildIcon, label: childLabel }) => (
                        <li key={childTo}>
                          <NavLink
                            to={childTo}
                            onClick={onNavigate}
                            className={cn(
                              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-300 ease-out",
                              isChildActive(childTo)
                                ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
                                : "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-neutral-500 dark:hover:bg-neutral-800/50 dark:hover:text-neutral-100"
                            )}
                          >
                            <ChildIcon className="h-5 w-5 shrink-0" />
                            <span className="truncate">{childLabel}</span>
                          </NavLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      {/* AI Assistant -- external agent link, styled after a "Write with
          AI"-style reference: a dark pill with an always-visible, slowly
          drifting multi-hue ring around its edge, sparkle icon + bold
          white label. The ring itself is a plain CSS gradient (a single
          WebGL lineColor can't paint a multi-hue rim), done with the
          classic padding-box/border-box double-background trick -- this
          wrapper supplies the gradient border, SpecularButton fills the
          inside with a near-opaque dark navy tint so only a thin ring
          shows. SpecularButton's own moving shine (white, low intensity)
          still runs on top as an extra glint layered over the static ring.
          Icon+label are wrapped in their own inline-flex row: Tailwind's
          preflight makes <svg> block-level, so without this they'd stack
          instead of sitting side by side inside SpecularButton's single
          children slot. */}
      <div className="px-3 pb-3">
        <div
          className="rounded-2xl p-[1.5px]"
          style={{
            backgroundImage:
              "linear-gradient(90deg, #2dd4bf, #3b82f6, #8b5cf6, #ec4899, #f59e0b, #2dd4bf)",
            backgroundSize: "200% 100%",
            animation: "gradient-shift 6s linear infinite",
          }}
        >
          <SpecularButton
            size="sm"
            radius={16}
            tint="#140f2e"
            tintOpacity={0.97}
            textColor="#ffffff"
            lineColor="#ffffff"
            baseColor="#312e81"
            intensity={0.6}
            shineSize={14}
            shineFade={50}
            speed={0.35}
            followMouse
            proximity={250}
            autoAnimate
            onClick={() => window.open(AI_AGENT_URL, "_blank", "noopener,noreferrer")}
            title={collapsed ? "Jira Anomaly AI" : undefined}
            className={cn("!flex w-full !justify-center !rounded-2xl !px-3 !py-2.5", collapsed && "!px-0")}
          >
            <span className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 shrink-0" />
              <span className={cn(fade, "truncate", collapsed ? "max-w-0 opacity-0" : "max-w-[10rem] opacity-100")}>
                <DiaTextReveal
                  text="Jira Anomaly AI"
                  className="text-sm font-bold"
                  colors={["#2dd4bf", "#3b82f6", "#8b5cf6", "#ec4899", "#f59e0b"]}
                  textColor="#ffffff"
                  duration={1.8}
                  delay={0.3}
                  repeat
                  repeatDelay={3}
                />
              </span>
            </span>
          </SpecularButton>
        </div>
      </div>

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
