import { NavLink, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  AlertTriangle,
  ScrollText,
  UserSearch,
  MailCheck,
  Settings,
  CalendarClock,
  LogOut,
} from "lucide-react";
import { getMe, logout } from "@/api";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/tickets", icon: Ticket, label: "Tickets" },
  { to: "/employees", icon: UserSearch, label: "Employee Search" },
  { to: "/approvals", icon: MailCheck, label: "Approvals" },
  { to: "/schedules", icon: CalendarClock, label: "Schedules" },
  { to: "/anomalies", icon: AlertTriangle, label: "Anomalies" },
  { to: "/audit-log", icon: ScrollText, label: "Audit Log" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export function Sidebar() {
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
    <aside className="flex h-full w-60 flex-col flex-shrink-0 bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg flex-shrink-0">
          <img
            src="/Jira_Logo.svg"
            alt="Jira Automation"
            className="h-8 w-8 object-contain"
          />
        </div>
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-none truncate">Jira Automation</p>
          <p className="text-[11px] mt-0.5 truncate text-slate-400">
            Admin Dashboard
          </p>
        </div>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto py-4 px-3">
        <p className="px-3 mb-2 text-[10px] font-semibold uppercase tracking-widest text-slate-400">
          Navigation
        </p>
        <ul className="space-y-0.5">
          {NAV.map(({ to, icon: Icon, label }) => (
            <li key={to}>
              <NavLink
                to={to}
                end={to === "/"}
                className={({ isActive }) =>
                  cn(
                    "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-150",
                    isActive
                      ? "bg-blue-600 text-white shadow-md"
                      : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                  )
                }
              >
                <Icon className="h-5 w-5 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          {me.data?.picture ? (
            <img
              src={me.data.picture}
              alt=""
              referrerPolicy="no-referrer"
              className="h-7 w-7 flex-shrink-0 rounded-full object-cover"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 flex-shrink-0">
              <span className="text-xs font-bold text-blue-600">
                {(me.data?.email ?? "?").charAt(0).toUpperCase()}
              </span>
            </div>
          )}
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-slate-900 truncate">{me.data?.email ?? "..."}</p>
            <p className="text-[10px] truncate text-slate-400">Administrator</p>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </aside>
  );
}
