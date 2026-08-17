import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Users, UserMinus, MailCheck, XCircle, Clock, ArrowRight, Activity, AlertTriangle, Play, Loader2,
  ArrowUpRight, Search, TrendingUp, TrendingDown,
} from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SeverityBadge, FlowBadge } from "@/components/app/badges";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { toast } from "@/components/ui/toast";
import { TrendChart } from "@/components/charts/TrendChart";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PresetPicker } from "@/components/app/preset-picker";
import { getKpis, getAnomalies, getScheduledJobs, runScheduledJob, getIntegrationHealth } from "@/api";
import type { EmployeeSearchResult, IntegrationStatus, Health } from "@/api";
import { formatISTShort, describeCron } from "@/lib/utils";
import { DATE_PRESETS, getPresetDates, type DatePreset } from "@/lib/date-presets";
import { useEmployeeSuggestions } from "@/lib/useEmployeeSuggestions";

function parseYMD(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

// trendKey names the matching field in kpis.previousPeriod -- a real
// same-length prior window, computed server-side (see admin_api.py's
// _previous_period), replacing the old hardcoded +12%/+4%/-3% arrows that
// showed on every load regardless of real data.
const KPI_CONFIG = [
  { dataKey: "onboardedCount"    as const, trendKey: "onboardedCount"  as const, label: "Onboarded",         icon: Users,    accent: "#2563eb", sub: "Employees",              viewTo: "/tickets" },
  { dataKey: "offboardedCount"   as const, trendKey: "offboardedCount" as const, label: "Offboarded",        icon: UserMinus, accent: "#7c3aed", sub: "Employees",              viewTo: "/tickets" },
  { dataKey: "pendingApprovals"  as const, trendKey: null,                       label: "Pending Approvals", icon: MailCheck, accent: "#d97706", sub: "Awaiting manager reply", viewTo: "/approvals", live: true },
  { dataKey: "failuresCount"     as const, trendKey: "failuresCount"   as const, label: "Failures",          icon: XCircle,  accent: "#dc2626", sub: "Need attention",         viewTo: "/anomalies" },
];

const DISMISSED_STORAGE_KEY = "dashboard-dismissed-attention-items";

const INTEGRATION_LABELS: Record<keyof Health, string> = {
  jira: "Jira", googleWorkspace: "Google Workspace", activeDirectory: "Active Directory", microsoft365: "Microsoft 365",
};

const INTEGRATION_STATUS_COPY: Record<IntegrationStatus, string> = {
  ok: "Connected — automations can reach it normally.",
  down: "Can't connect right now — automations that depend on it may fail until this recovers.",
  not_configured: "Not connected yet — related automations are skipped until this is set up.",
};

/* ── Skeletons ──────────────────────────────────────────────── */
function OverviewSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white shadow-sm overflow-hidden flex flex-col dark:bg-neutral-900">
            <div className="p-5 flex-1 space-y-3">
              <div className="flex items-start justify-between">
                <div className="space-y-2">
                  <Skeleton className="h-3 w-20" />
                  <Skeleton className="h-9 w-10" />
                  <Skeleton className="h-3 w-16" />
                </div>
                <Skeleton className="h-11 w-11 rounded-xl" />
              </div>
              <Skeleton className="h-3 w-28" />
            </div>
            <div className="px-5 py-2.5">
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
        <div className="px-5 py-4 flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="p-5"><Skeleton className="h-52 w-full" /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
            <div className="px-5 py-4"><Skeleton className="h-4 w-36" /></div>
            <div className="space-y-3 px-5 pb-5">
              {[...Array(5)].map((_, j) => (
                <div key={j} className="flex items-center gap-3">
                  <Skeleton className="h-5 w-14 rounded-full" />
                  <Skeleton className="h-4 w-20 rounded-full" />
                  <Skeleton className="flex-1 h-3" />
                  <Skeleton className="h-3 w-16" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── KPI tile ───────────────────────────────────────────────── */
function KpiTile({ label, value, previous, icon: Icon, accent, live, sub, viewTo }: {
  label: string; value: number; previous?: number; icon: React.ElementType;
  accent: string; live?: boolean; sub: string; viewTo: string;
}) {
  const hasTrend = previous !== undefined && previous > 0;
  const pctChange = hasTrend ? Math.round(((value - previous!) / previous!) * 100) : 0;
  const up = pctChange >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;
  // For Failures, "up" is bad (red); for everything else "up" is good (green).
  const trendColor = label === "Failures" ? (up ? "#dc2626" : "#16a34a") : (up ? "#16a34a" : "#dc2626");
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col dark:bg-neutral-900">
      <div className="h-1" style={{ background: accent }} />
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">{label}</p>
            <p className="mt-2 text-4xl font-bold text-slate-900 tabular-nums dark:text-neutral-100">{value}</p>
            <p className="mt-1 text-xs text-slate-500 dark:text-neutral-400">{sub}</p>
          </div>
          <div className="rounded-xl p-3 flex-shrink-0" style={{ background: accent + "1f" }}>
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
        </div>
        {live ? (
          <div className="mt-4 text-xs text-slate-400 dark:text-neutral-500">Live total. Not filtered by date.</div>
        ) : hasTrend ? (
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <TrendIcon className="h-3.5 w-3.5" style={{ color: trendColor }} />
            <span className="font-semibold" style={{ color: trendColor }}>{up ? "+" : ""}{pctChange}%</span>
            <span className="text-slate-400 dark:text-neutral-500">vs previous period</span>
          </div>
        ) : (
          <div className="mt-4 text-xs text-slate-400 dark:text-neutral-500">No comparison data available</div>
        )}
      </div>
      <div className="border-t border-slate-100 px-5 py-2.5 dark:border-neutral-800">
        <Link to={viewTo} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: accent }}>
          View details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

// Reflects the job's own last real outcome, not just whether Cloud
// Scheduler itself has it enabled -- an enabled job silently failing every
// night used to look identical (both just a green dot) to a healthy one.
const JOB_STATUS_META: Record<string, { dot: string; label: string; text: string }> = {
  succeeded: { dot: "bg-emerald-500", label: "Succeeded", text: "text-emerald-700 dark:text-emerald-300" },
  failed:    { dot: "bg-red-500",     label: "Failed",    text: "text-red-700 dark:text-red-300" },
  unknown:   { dot: "bg-slate-300 dark:bg-neutral-600", label: "No runs yet", text: "text-slate-400 dark:text-neutral-500" },
};
function JobStatus({ status }: { status?: string }) {
  const meta = JOB_STATUS_META[status ?? "unknown"] ?? JOB_STATUS_META.unknown;
  return (
    <span className={`flex items-center gap-1.5 text-xs font-medium ${meta.text}`}>
      <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${meta.dot}`} />
      {meta.label}
    </span>
  );
}

/* ── Page ───────────────────────────────────────────────────── */
// Global search -- same live typeahead engine as the Employee Search page
// (email / ticket key / name via live Jira search), just reachable straight
// from the dashboard's landing page. Picking a result jumps to that
// employee's progress view (Employee Search, pre-filled via ?q=) or, if no
// employee resolved from the matched ticket, straight to the ticket itself.
function GlobalSearchBox() {
  const [value, setValue] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const { suggestions, loading } = useEmployeeSuggestions(value);
  const navigate = useNavigate();

  function goTo(result: EmployeeSearchResult) {
    setShowSuggestions(false);
    if (result.employeeEmail) {
      navigate(`/employees?q=${encodeURIComponent(result.employeeEmail)}`);
    } else if (result.issueKey) {
      navigate(`/tickets/${result.issueKey}`);
    }
  }

  return (
    <div className="relative w-72">
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
      <Input
        type="text"
        placeholder="Search employee, email, or ticket..."
        className="h-9 pl-9 pr-8 text-xs"
        value={value}
        onChange={(e) => { setValue(e.target.value); setShowSuggestions(true); }}
        onFocus={() => setShowSuggestions(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && suggestions.length > 0) goTo(suggestions[0]);
        }}
        onBlur={() => setTimeout(() => setShowSuggestions(false), 150)}
      />
      {loading && <Spinner className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />}
      {showSuggestions && suggestions.length > 0 && (
        <ul
          className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border bg-white shadow-lg dark:bg-neutral-900"
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => goTo(s)}
              className="px-3.5 py-2 cursor-pointer hover:bg-slate-50 border-b last:border-b-0 dark:hover:bg-neutral-800/50"
            >
              <p className="text-xs font-semibold text-slate-700 truncate dark:text-neutral-300">{s.title ?? s.issueKey}</p>
              <p className="text-[11px] text-slate-400 truncate dark:text-neutral-500">
                {s.employeeEmail ?? "No employee resolved"} · {s.issueKey}
              </p>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function Overview() {
  const [preset, setPreset]         = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const dates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset);

  const kpis     = useQuery({ queryKey: ["kpis",     dates], queryFn: () => getKpis(dates) });
  const anomalies = useQuery({ queryKey: ["anomalies", "overview", dates], queryFn: () => getAnomalies(dates) });
  const jobs     = useQuery({ queryKey: ["scheduled-jobs"], queryFn: getScheduledJobs });
  const health   = useQuery({ queryKey: ["health"], queryFn: getIntegrationHealth });

  const qc = useQueryClient();
  const forceRun = useMutation({
    mutationFn: (name: string) => runScheduledJob(name),
    onSuccess: (res) => {
      qc.invalidateQueries({ queryKey: ["scheduled-jobs"] });
      toast.add({ title: "Job triggered", description: `"${res.job.label}" is running now.` });
    },
    onError: () => toast.add({ title: "Force run failed", description: "Couldn't trigger that job. Try again." }),
  });

  // "Needs your attention" -- named, linked items instead of a bare count,
  // built entirely from data this page already fetches (no extra request).
  // A failed job's own last real run outweighs Cloud Scheduler's own
  // enabled/paused state, which is why this reads job.lastRunStatus, not
  // job.state. Each item has a stable id (not an array index) so
  // dismissing it survives the list being rebuilt on every refetch --
  // it only comes back once it's a genuinely different problem.
  const failedJobs = (jobs.data?.jobs ?? []).filter((j) => j.lastRunStatus === "failed");
  const attentionItems: { id: string; text: string; to: string }[] = [];
  failedJobs.forEach((j) => attentionItems.push({ id: `job:${j.name}`, text: `"${j.label}" failed its last run`, to: "/schedules" }));
  if (kpis.data && kpis.data.pendingApprovals > 0) {
    attentionItems.push({
      id: "pending-approvals",
      text: `${kpis.data.pendingApprovals} approval${kpis.data.pendingApprovals === 1 ? "" : "s"} waiting on a manager`,
      to: "/approvals",
    });
  }
  if (kpis.data && kpis.data.failuresCount > 0) {
    attentionItems.push({
      id: "failures",
      text: `${kpis.data.failuresCount} failure${kpis.data.failuresCount === 1 ? "" : "s"} in the selected period`,
      to: "/anomalies",
    });
  }
  // Real system health -- a Jira/Google Workspace/AD/M365 outage looks
  // identical to "our automation has a bug" without this, since both just
  // show up as a pile of failed events with no other explanation.
  const downIntegrations = health.data
    ? (Object.entries(health.data) as [keyof Health, IntegrationStatus][]).filter(([, s]) => s === "down")
    : [];
  downIntegrations.forEach(([key]) =>
    attentionItems.push({ id: `integration:${key}`, text: `${INTEGRATION_LABELS[key]} isn't reachable right now`, to: "/settings" })
  );

  const [dismissedIds, setDismissedIds] = useState<Set<string>>(() => {
    try {
      return new Set(JSON.parse(localStorage.getItem(DISMISSED_STORAGE_KEY) ?? "[]"));
    } catch {
      return new Set();
    }
  });
  function dismiss(id: string) {
    setDismissedIds((prev) => {
      const next = new Set(prev).add(id);
      localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  }
  const visibleAttentionItems = attentionItems.filter((item) => !dismissedIds.has(item.id));
  const dismissedCount = attentionItems.length - visibleAttentionItems.length;
  // "Healthy" only when there's genuinely nothing wrong -- dismissing
  // everything still-broken shows a distinct "caught up, but dismissed
  // items exist" state instead of falsely claiming full health.
  const systemHealthy = attentionItems.length === 0;
  const allDismissed  = attentionItems.length > 0 && visibleAttentionItems.length === 0;

  function getAlertMeta(id: string): { type: string; severity: "critical" | "warning" } {
    if (id.startsWith("integration:")) return { type: "Infra",    severity: "critical" };
    if (id.startsWith("job:"))         return { type: "Job",      severity: "critical" };
    if (id === "failures")             return { type: "Failure",  severity: "critical" };
    return                                    { type: "Approval", severity: "warning"  };
  }

  const criticalItems = visibleAttentionItems.filter((i) => getAlertMeta(i.id).severity === "critical");
  const warningItems  = visibleAttentionItems.filter((i) => getAlertMeta(i.id).severity === "warning");

  function dismissAll() {
    const next = new Set([...dismissedIds, ...visibleAttentionItems.map((i) => i.id)]);
    setDismissedIds(next);
    localStorage.setItem(DISMISSED_STORAGE_KEY, JSON.stringify([...next]));
  }

  return (
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      {/* Header — always visible */}
      <div className="border-b bg-white px-8 py-6 dark:bg-neutral-900">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight dark:text-neutral-100">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">Jira onboarding and offboarding automation monitor</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <GlobalSearchBox />
          <PresetPicker options={DATE_PRESETS} value={preset} onChange={setPreset} />
          <DatePickerWithRange
            align="end"
            value={{ from: parseYMD(dates.from), to: parseYMD(dates.to) }}
            onChange={(range: DateRange | undefined) => {
              setCustomFrom(range?.from ? format(range.from, "yyyy-MM-dd") : "");
              setCustomTo(range?.to ? format(range.to, "yyyy-MM-dd") : "");
              setPreset("custom");
            }}
          />
        </div>
      </div>

      {/* Content */}
      {kpis.isLoading ? (
        <OverviewSkeleton />
      ) : kpis.isError ? (
        <div className="px-8 py-6"><ErrorState error={kpis.error as Error} onRetry={kpis.refetch} /></div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {/* System status — three distinct states:
              1. All clear  → compact emerald pill
              2. All dismissed → muted pill with recover link
              3. Action needed → severity-grouped card with per-row left border */}
          {systemHealthy ? (
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 shadow-sm dark:border-emerald-900/50 dark:bg-emerald-950/40">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">All systems operational</p>
            </div>
          ) : allDismissed ? (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
              <span className="h-2 w-2 shrink-0 rounded-full bg-neutral-400 dark:bg-neutral-600" />
              <p className="text-sm text-slate-500 dark:text-neutral-400">Notifications are muted. These items are still unresolved.</p>
              <button
                onClick={() => { setDismissedIds(new Set()); localStorage.removeItem(DISMISSED_STORAGE_KEY); }}
                className="ml-auto shrink-0 text-xs font-medium text-slate-400 hover:text-slate-700 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
              >
                Show {dismissedCount} dismissed
              </button>
            </div>
          ) : (
            <div className="rounded-xl border border-neutral-200 bg-white shadow-sm overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">

              {/* Header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                <span className="h-2 w-2 shrink-0 rounded-full bg-amber-500 shadow-[0_0_6px_#f59e0b]" />
                <span className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Action needed</span>
                <div className="flex items-center gap-1.5 ml-1">
                  {criticalItems.length > 0 && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 dark:bg-red-500/15 dark:border-red-500/25">
                      {criticalItems.length} critical
                    </span>
                  )}
                  {warningItems.length > 0 && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25">
                      {warningItems.length} warning
                    </span>
                  )}
                </div>
                <button
                  onClick={dismissAll}
                  className="ml-auto text-[11px] text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300 px-2 py-1 rounded transition-colors hover:bg-slate-50 dark:hover:bg-neutral-800"
                >
                  Dismiss all
                </button>
              </div>

              {/* Critical rows */}
              {criticalItems.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-[9px] font-bold uppercase tracking-[.14em] font-mono text-red-500">Critical</span>
                    <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                  {criticalItems.map((item) => (
                    <div key={item.id} className="flex items-center border-t border-neutral-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                      <div className="w-[3px] self-stretch shrink-0 bg-red-500" />
                      <span className="text-[9px] font-bold uppercase tracking-[.14em] font-mono text-slate-400 dark:text-neutral-500 w-20 shrink-0 pl-3">
                        {getAlertMeta(item.id).type}
                      </span>
                      <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 shrink-0 mx-3" />
                      <span className="flex-1 text-[12.5px] text-slate-800 dark:text-neutral-200 py-2.5 min-w-0">{item.text}</span>
                      <Link
                        to={item.to}
                        className="text-[11.5px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 px-2 py-1 rounded transition-colors shrink-0 whitespace-nowrap"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => dismiss(item.id)}
                        className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 w-8 h-8 flex items-center justify-center rounded transition-colors mx-2 shrink-0"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Warning rows */}
              {warningItems.length > 0 && (
                <>
                  <div className="flex items-center gap-2 px-4 py-2">
                    <span className="text-[9px] font-bold uppercase tracking-[.14em] font-mono text-amber-500 dark:text-amber-400">Warning</span>
                    <div className="flex-1 h-px bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                  {warningItems.map((item) => (
                    <div key={item.id} className="flex items-center border-t border-neutral-100 dark:border-neutral-800 hover:bg-slate-50 dark:hover:bg-white/[0.03] transition-colors">
                      <div className="w-[3px] self-stretch shrink-0 bg-amber-500" />
                      <span className="text-[9px] font-bold uppercase tracking-[.14em] font-mono text-slate-400 dark:text-neutral-500 w-20 shrink-0 pl-3">
                        {getAlertMeta(item.id).type}
                      </span>
                      <div className="w-px h-5 bg-slate-200 dark:bg-neutral-700 shrink-0 mx-3" />
                      <span className="flex-1 text-[12.5px] text-slate-800 dark:text-neutral-200 py-2.5 min-w-0">{item.text}</span>
                      <Link
                        to={item.to}
                        className="text-[11.5px] font-semibold text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-500/10 px-2 py-1 rounded transition-colors shrink-0 whitespace-nowrap"
                      >
                        View
                      </Link>
                      <button
                        onClick={() => dismiss(item.id)}
                        className="text-xs text-slate-400 dark:text-neutral-500 hover:text-slate-600 dark:hover:text-neutral-300 hover:bg-slate-100 dark:hover:bg-neutral-800 w-8 h-8 flex items-center justify-center rounded transition-colors mx-2 shrink-0"
                        title="Dismiss"
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </>
              )}

              {/* Recover dismissed items */}
              {dismissedCount > 0 && (
                <div className="px-4 py-2.5 border-t border-neutral-100 dark:border-neutral-800">
                  <button
                    onClick={() => { setDismissedIds(new Set()); localStorage.removeItem(DISMISSED_STORAGE_KEY); }}
                    className="text-[11px] text-slate-400 hover:text-slate-600 dark:text-neutral-500 dark:hover:text-neutral-300 transition-colors"
                  >
                    Show {dismissedCount} dismissed item{dismissedCount === 1 ? "" : "s"}
                  </button>
                </div>
              )}

            </div>
          )}

          {/* Integration health -- so a real Jira/GWS/AD/M365 outage reads
              as exactly that, not as an unexplained pile of failed events. */}
       

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_CONFIG.map((c) => (
              <KpiTile
                key={c.dataKey}
                label={c.label}
                icon={c.icon}
                accent={c.accent}
                live={c.live}
                sub={c.sub}
                viewTo={c.viewTo}
                value={kpis.data![c.dataKey]}
                previous={c.trendKey ? kpis.data!.previousPeriod?.[c.trendKey] : undefined}
              />
            ))}
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
            <div className="px-5 py-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                <Activity className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                Activity trend
              </h2>
              <span className="text-xs text-slate-400 dark:text-neutral-500">{dates.from} → {dates.to}</span>
            </div>
            <div className="p-5">
              {kpis.data!.byDay.length === 0 ? <EmptyState message="No trend data" /> : <TrendChart data={kpis.data!.byDay} />}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Anomalies */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                  <AlertTriangle className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                  Recent anomalies
                </h2>
                <Link to="/anomalies" className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline">
                  View all <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
              {anomalies.isLoading ? (
                <div className="space-y-3 px-5 py-3">
                  {[...Array(5)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-5 w-14 rounded-full" />
                      <Skeleton className="h-4 w-20 rounded-full" />
                      <Skeleton className="flex-1 h-3" />
                      <Skeleton className="h-3 w-16" />
                    </div>
                  ))}
                </div>
              ) : anomalies.isError ? (
                <div className="px-5 py-3"><ErrorState error={anomalies.error as Error} onRetry={anomalies.refetch} /></div>
              ) : anomalies.data!.anomalies.length === 0 ? (
                <EmptyState message="No anomalies in this period" className="py-8" />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {anomalies.data!.anomalies.slice(0, 8).map((a, i) => (
                    <li key={i} className="flex items-center gap-2.5 px-5 py-3 hover:bg-slate-50 transition-colors dark:hover:bg-neutral-800/50">
                      <SeverityBadge severity={a.severity} />
                      <FlowBadge flow={a.flow} />
                      <span className="flex-1 truncate text-xs text-slate-500 dark:text-neutral-400">{a.outcome}</span>
                      {a.issueKey && (
                        <Link
                          to={`/tickets/${a.issueKey}`}
                          className="flex items-center gap-0.5 shrink-0 font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {a.issueKey}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <span className="shrink-0 text-xs text-slate-600 tabular-nums dark:text-neutral-400">{formatISTShort(a.timestamp)}</span>
                      
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Jobs */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden dark:bg-neutral-900">
              <div className="px-5 py-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Upcoming scheduled runs</h2>
              </div>
              {jobs.isLoading ? (
                <div className="space-y-3.5 px-5 py-3.5">
                  {[...Array(3)].map((_, i) => (
                    <div key={i} className="flex items-center gap-3">
                      <Skeleton className="h-2 w-2 rounded-full" />
                      <div className="flex-1 space-y-1.5">
                        <Skeleton className="h-3 w-40" />
                        <Skeleton className="h-3 w-32" />
                      </div>
                      <div className="text-right space-y-1.5">
                        <Skeleton className="h-3 w-20" />
                        <Skeleton className="h-2.5 w-12" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : jobs.isError ? (
                <div className="px-5 py-3"><ErrorState error={jobs.error as Error} onRetry={jobs.refetch} /></div>
              ) : jobs.data!.jobs.length === 0 ? (
                <EmptyState message="No scheduled jobs found" className="py-8" />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {[...jobs.data!.jobs].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()).map((job) => {
                    const isRunningThis = forceRun.isPending && forceRun.variables === job.name;
                    return (
                    <li key={job.name} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors dark:hover:bg-neutral-800/50">
                      <div className="w-24 shrink-0"><JobStatus status={job.lastRunStatus} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="truncate text-sm font-semibold text-slate-800 dark:text-neutral-200">{job.label}</p>
                          <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500 dark:bg-neutral-800 dark:text-neutral-400" title="Cloud Scheduler job name">
                            {job.name}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400 dark:text-neutral-500">{describeCron(job.schedule, job.timeZone)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-700 tabular-nums dark:text-neutral-300">{formatISTShort(job.nextRunAt)}</p>
                        <p className="text-[11px] text-slate-400 dark:text-neutral-500">next run</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800 dark:border-emerald-900/50 dark:bg-emerald-950/40 dark:text-emerald-300 dark:hover:bg-emerald-900/40 dark:hover:text-emerald-200"
                        disabled={forceRun.isPending}
                        onClick={() => forceRun.mutate(job.name)}
                        title="Force run now, without waiting for the schedule"
                      >
                        {isRunningThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        Force run
                      </Button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>
            
          </div>
             {health.data && (
            <TooltipProvider>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-5 py-3 shadow-sm dark:bg-neutral-900">
              <span className="text-xs font-semibold uppercase tracking-wider text-slate-400 mr-1 dark:text-neutral-500">Integrations</span>
              {(Object.entries(health.data) as [keyof Health, IntegrationStatus][]).map(([key, status]) => (
                <Tooltip key={key}>
                  <TooltipTrigger
                    render={
                      <span
                        className={`inline-flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium ${
                          status === "ok" ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300"
                            : status === "down" ? "bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300"
                            : "bg-slate-100 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500"
                        }`}
                      />
                    }
                  >
                    <span className={`h-1.5 w-1.5 rounded-full ${
                      status === "ok" ? "bg-emerald-500" : status === "down" ? "bg-red-500" : "bg-slate-300 dark:bg-neutral-600"
                    }`} />
                    {INTEGRATION_LABELS[key]}
                    {status === "not_configured" && " (not set up)"}
                  </TooltipTrigger>
                  <TooltipContent>{INTEGRATION_STATUS_COPY[status]}</TooltipContent>
                </Tooltip>
              ))}
            </div>
            </TooltipProvider>
          )}
        </div>
      )}
    </div>
  );
}
