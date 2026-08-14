import { NavLink } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  LayoutDashboard,
  Ticket,
  ToggleLeft,
  AlertTriangle,
  ScrollText,
  Zap,
  UserSearch,
} from "lucide-react";

const NAV = [
  { to: "/", icon: LayoutDashboard, label: "Overview" },
  { to: "/tickets", icon: Ticket, label: "Tickets" },
  { to: "/employees", icon: UserSearch, label: "Employee Search" },
  { to: "/anomalies", icon: AlertTriangle, label: "Anomalies" },
  { to: "/audit-log", icon: ScrollText, label: "Audit Log" },
  { to: "/settings", icon: ToggleLeft, label: "Settings" },
];

export function Sidebar() {
  return (
    <aside className="flex h-full w-60 flex-col flex-shrink-0 bg-white border-r border-slate-200">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 px-5 border-b border-slate-100">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 shadow-lg flex-shrink-0">
          <Zap className="h-4 w-4 text-white" />
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
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{label}</span>
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* Footer */}
      <div className="px-5 py-4 border-t border-slate-100">
        <div className="flex items-center gap-2">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 flex-shrink-0">
            <span className="text-xs font-bold text-blue-600">A</span>
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-slate-900 truncate">admin@wohlig.com</p>
            <p className="text-[10px] truncate text-slate-400">
              Administrator
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}
