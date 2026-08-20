import { Outlet, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { getMe, logout } from "@/api";
import { ThemeToggle } from "@/components/app/theme-toggle";

// HR has exactly one page ("My Tickets"), so a full sidebar nav column has
// nothing to navigate between -- a single topbar (title on the left,
// theme/profile/logout on the right) covers everything a sidebar would,
// without an empty nav rail taking up width.
export function HrAppLayout() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const me = useQuery({ queryKey: ["me"], queryFn: getMe, retry: false });

  async function handleLogout() {
    await logout();
    qc.removeQueries({ queryKey: ["me"] });
    navigate("/login", { replace: true });
  }

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-background">
      <header className="flex h-16 flex-shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-8 dark:border-neutral-800 dark:bg-neutral-900">
        <div className="min-w-0">
          <p className="text-sm font-bold text-slate-900 leading-none dark:text-neutral-100">HR Dashboard</p>
          <p className="text-[11px] mt-0.5 text-slate-400 dark:text-neutral-500">Onboarding &amp; Offboarding</p>
        </div>

        <div className="flex items-center gap-3">
          <ThemeToggle />
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
            <div className="hidden sm:block min-w-0 max-w-40">
              <p className="text-xs font-medium text-slate-900 truncate dark:text-neutral-100">
                {me.data?.name ?? me.data?.email ?? "..."}
              </p>
              <p className="text-[10px] truncate text-slate-400 dark:text-neutral-500">
                {me.data?.name ? me.data.email : "HR"}
              </p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            title="Sign out"
            className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </header>
      <main className="flex-1 overflow-y-auto overflow-x-hidden">
        <Outlet />
      </main>
    </div>
  );
}
