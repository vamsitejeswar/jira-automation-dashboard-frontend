import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link, useNavigate } from "react-router-dom";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  Chart as ChartJS, LineElement, PointElement, LinearScale, CategoryScale, Tooltip as ChartTooltip,
} from "chart.js";
import { Line } from "react-chartjs-2";
import { useTheme } from "@/providers/theme-provider";
import {
  Users, UserMinus, MailCheck, XCircle, Clock, ArrowRight, Activity, AlertTriangle, Play, Loader2,
  Search, TrendingUp, TrendingDown, Info,
} from "lucide-react";

ChartJS.register(LineElement, PointElement, LinearScale, CategoryScale, ChartTooltip);
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { SeverityBadge, FlowBadge, OutcomeBadge, isSelfEvidentError } from "@/components/app/badges";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { toast } from "@/components/ui/toast";
import { TrendChart } from "@/components/charts/TrendChart";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PresetPicker } from "@/components/app/preset-picker";
import { getKpis, getAnomalies, getScheduledJobs, runScheduledJob, getIntegrationHealth } from "@/api";
import type { EmployeeSearchResult, IntegrationStatus, Health, FailureCategoryCounts } from "@/api";
import { formatIST, formatISTShort, describeCron } from "@/lib/utils";
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
  { dataKey: "onboardedCount"    as const, trendKey: "onboardedCount"  as const, label: "Onboardings",         icon: Users,    accent: "#2563eb", sub: "Employees",              viewTo: "/tickets?type=onboarding" },
  { dataKey: "offboardedCount"   as const, trendKey: "offboardedCount" as const, label: "Offboardings",        icon: UserMinus, accent: "#7c3aed", sub: "Employees",              viewTo: "/tickets?type=offboarding" },
  { dataKey: "pendingApprovals"  as const, trendKey: null,                       label: "Pending Approvals", icon: MailCheck, accent: "#d97706", sub: "Awaiting manager reply", viewTo: "/approvals", live: true },
  { dataKey: "automationFailuresCount" as const, trendKey: "automationFailuresCount" as const, label: "Automation Failures", icon: XCircle, accent: "#dc2626", sub: "Automation actually failed", viewTo: "/anomalies" },
];

// Metadata for the "what kind of attention" breakdown table below the KPI
// row -- keys match app/services/anomaly_analytics.py's categorize_anomaly
// exactly, in the order they're shown.
const FAILURE_CATEGORY_META: {
  key: keyof FailureCategoryCounts; label: string; dot: string; row: string; text: string; meaning: string;
}[] = [
  { key: "automation_failure", label: "Automation Failures",       dot: "bg-red-500",    row: "bg-red-50/70 dark:bg-red-950/20",       text: "text-red-700 dark:text-red-400",       meaning: "Automation actually failed to perform the required action" },
  { key: "workflow_issue",     label: "Workflow Issues",           dot: "bg-orange-500", row: "bg-orange-50/70 dark:bg-orange-950/20", text: "text-orange-700 dark:text-orange-400", meaning: "Action succeeded, but the ticket/workflow transition had an issue" },
  { key: "blocked_pending",    label: "Blocked / Pending",         dot: "bg-amber-400",  row: "bg-amber-50/70 dark:bg-amber-950/20",   text: "text-amber-700 dark:text-amber-400",   meaning: "Waiting on a manager, a field, or another dependency" },
  { key: "needs_review",       label: "Exceptions / Needs Review", dot: "bg-blue-500",   row: "bg-blue-50/70 dark:bg-blue-950/20",     text: "text-blue-700 dark:text-blue-400",     meaning: "Ambiguous or unusual cases requiring human review" },
];

function FailureCategoryTable({ counts }: { counts: FailureCategoryCounts }) {
  const total = FAILURE_CATEGORY_META.reduce((sum, c) => sum + counts[c.key], 0);
  return (
    <div className="flex h-full flex-col rounded-xl border bg-white overflow-hidden dark:bg-neutral-900">
      <div className="px-5 py-4">
        <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-300">
          <AlertTriangle className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
          Attention Breakdown
        </h2>
        <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Hover a row to see why it's flagged</p>
      </div>
      <TooltipProvider delay={200}>
        <div className="flex flex-1 flex-col overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="border-b bg-slate-50/70 dark:bg-neutral-800/50">
              <tr>
                <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Category</th>
                <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">Count</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
              {FAILURE_CATEGORY_META.map((c) => (
                <Tooltip key={c.key}>
                  <TooltipTrigger render={<tr className="cursor-default hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors" />}>
                    <td className="px-5 py-5 whitespace-nowrap">
                      <span className="flex items-center gap-2 font-medium text-slate-800 dark:text-neutral-200">
                        <span className={`h-2.5 w-2.5 rounded-full flex-shrink-0 ${c.dot}`} />
                        {c.label}
                      </span>
                    </td>
                    <td className={`px-5 py-5 text-right tabular-nums text-xl font-bold ${c.text}`}>
                      {counts[c.key]}
                    </td>
                  </TooltipTrigger>
                  <TooltipContent>{c.meaning}</TooltipContent>
                </Tooltip>
              ))}
            </tbody>
          </table>
          <div className="mt-auto flex items-center justify-between border-t bg-slate-50/70 px-5 py-5 font-semibold dark:bg-neutral-800/50">
            <span className="text-sm text-slate-800 dark:text-neutral-200">Total flagged cases</span>
            <span className="tabular-nums text-xl text-slate-900 dark:text-neutral-100">{total}</span>
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
}

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
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full flex-shrink-0" />
          <div className="min-w-[9rem] space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
          <div className="hidden shrink-0 grid-cols-3 gap-2 border-l border-slate-100 pl-5 dark:border-neutral-800 sm:grid">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-14 w-20 rounded-xl" />
            ))}
          </div>
        </div>
        <div className="rounded-xl bg-white dark:bg-neutral-900 p-5 flex items-center gap-4">
          <div className="min-w-[9rem] space-y-2">
            <Skeleton className="h-3 w-28" />
            <Skeleton className="h-8 w-16" />
            <Skeleton className="h-3 w-32" />
          </div>
          <Skeleton className="h-16 flex-1 rounded-lg" />
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white overflow-hidden flex flex-col dark:bg-neutral-900">
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
      <div className="rounded-xl bg-white overflow-hidden dark:bg-neutral-900">
        <div className="px-5 py-4 flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="p-5"><Skeleton className="h-52 w-full" /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-white overflow-hidden dark:bg-neutral-900">
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

// Counts a displayed number up from 0 to its real value on mount/whenever
// it changes, instead of the value just appearing.
function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setValue(target);
      return;
    }
    setValue(0);
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setValue(Math.round(target * eased));
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, duration]);
  return value;
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
  const trendColor = label === "Automation Failures" ? (up ? "#dc2626" : "#16a34a") : (up ? "#16a34a" : "#dc2626");
  return (
    <div
      className="rounded-xl border border-t-4 bg-white overflow-hidden flex flex-col dark:bg-neutral-900"
      style={{ borderTopColor: accent }}
    >
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

// Success rate over the real onboarded+offboarded+failures counts already
// fetched for the KPI row above -- not a separate metric, just the same
// numbers read as a health ring instead of four flat tiles. The ring's
// "track" comes from a theme-aware Tailwind background so only the filled
// wedge needs an inline conic-gradient (transparent past pct%), which
// keeps this in sync with dark mode without a useTheme() lookup.
function AutomationHealthCard({ successful, failed, previous }: {
  successful: number; failed: number;
  previous?: { successful: number; failed: number };
}) {
  const total = successful + failed;
  const pct = total > 0 ? Math.round((successful / total) * 100) : null;
  const prevTotal = previous ? previous.successful + previous.failed : undefined;
  const prevPct = previous && prevTotal! > 0 ? Math.round((previous.successful / prevTotal!) * 100) : undefined;
  const hasTrend = pct !== null && prevPct !== undefined;
  const up = hasTrend && pct! >= prevPct!;
  const TrendIcon = up ? TrendingUp : TrendingDown;

  // Animates the ring filling up from 0 on mount/whenever pct changes,
  // instead of snapping straight to its final value.
  const [animatedPct, setAnimatedPct] = useState(0);
  useEffect(() => {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduceMotion) {
      setAnimatedPct(pct ?? 0);
      return;
    }
    setAnimatedPct(0);
    const id = requestAnimationFrame(() => setAnimatedPct(pct ?? 0));
    return () => cancelAnimationFrame(id);
  }, [pct]);
  const circumference = 2 * Math.PI * 28;
  const animatedTotal = useCountUp(total);
  const animatedSuccessful = useCountUp(successful);
  const animatedFailed = useCountUp(failed);

  return (
    <div className="rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900 p-5 flex items-center gap-4">
      <svg viewBox="0 0 64 64" className="h-16 w-16 flex-shrink-0 -rotate-90">
        <circle cx="32" cy="32" r="28" fill="none" strokeWidth="6" className="stroke-slate-100 dark:stroke-neutral-800" />
        <circle
          cx="32"
          cy="32"
          r="28"
          fill="none"
          strokeWidth="6"
          strokeLinecap="round"
          stroke="#10b981"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - animatedPct / 100)}
          style={{ transition: "stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)" }}
        />
      </svg>
      <div className="min-w-[9rem]">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 whitespace-nowrap">Automation health</p>
        <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums dark:text-neutral-100">{pct !== null ? `${animatedPct}%` : "—"}</p>
        {hasTrend ? (
          <p className="mt-1 flex items-center gap-1 text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">
            <TrendIcon className="h-3.5 w-3.5" style={{ color: up ? "#16a34a" : "#dc2626" }} />
            <span className="font-semibold" style={{ color: up ? "#16a34a" : "#dc2626" }}>
              {pct! - prevPct! >= 0 ? "+" : ""}{pct! - prevPct!}pp
            </span>
            vs previous period
          </p>
        ) : (
          <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">Success rate over {total} run{total === 1 ? "" : "s"}</p>
        )}
      </div>
      <TooltipProvider delay={200}>
        <div className="hidden shrink-0 grid-cols-3 gap-2 border-l border-slate-300 pl-5 text-xs dark:border-neutral-600 sm:grid">
          <Tooltip>
            <TooltipTrigger render={<div className="cursor-default rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-500/10" />}>
              <p className="text-[11px] font-medium text-blue-600/80 dark:text-blue-400/80">Total runs</p>
              <p className="text-3xl font-bold text-blue-600 tabular-nums dark:text-blue-400">{animatedTotal}</p>
            </TooltipTrigger>
            <TooltipContent>Distinct tickets with automation activity in this period.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<div className="cursor-default rounded-xl bg-emerald-50 px-3 py-2 dark:bg-emerald-500/10" />}>
              <p className="text-[11px] font-medium text-emerald-600/80 dark:text-emerald-400/80">Successful</p>
              <p className="text-3xl font-bold text-emerald-600 tabular-nums dark:text-emerald-400">{animatedSuccessful}</p>
            </TooltipTrigger>
            <TooltipContent>Tickets whose most recent status was a real success.</TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger render={<div className="cursor-default rounded-xl bg-red-50 px-3 py-2 dark:bg-red-500/10" />}>
              <p className="text-[11px] font-medium text-red-600/80 dark:text-red-400/80">Failed</p>
              <p className="text-3xl font-bold text-red-600 tabular-nums dark:text-red-400">{animatedFailed}</p>
            </TooltipTrigger>
            <TooltipContent>Includes tickets stuck waiting on a manager/field, not only real automation failures.</TooltipContent>
          </Tooltip>
        </div>
      </TooltipProvider>
    </div>
  );
}

// Same byDay series the trend chart below renders as raw volume bars --
// this reads it as a % line instead, "is reliability getting better or
// worse day to day," which nothing else on this page shows. A day with no
// runs at all counts as 100% (nothing failed) rather than a gap, so the
// line stays continuous.
function ReliabilityTrendCard({ byDay }: {
  byDay: { date: string; onboarded: number; offboarded: number; failures: number }[];
}) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const dailyPct = byDay.map((d) => {
    const dayTotal = d.onboarded + d.offboarded + d.failures;
    return dayTotal > 0 ? Math.round(((d.onboarded + d.offboarded) / dayTotal) * 100) : 100;
  });
  // Averaging the daily rate, not the latest single day -- one bad day
  // with only failures on it would otherwise show a jarring "0%" headline
  // even when the rest of the period was healthy.
  const avg = dailyPct.length > 0 ? Math.round(dailyPct.reduce((a, b) => a + b, 0) / dailyPct.length) : null;
  const best = dailyPct.length > 0 ? Math.max(...dailyPct) : null;
  const worst = dailyPct.length > 0 ? Math.min(...dailyPct) : null;
  const animatedAvg = useCountUp(avg ?? 0);

  const lineColor = dark ? "#34d399" : "#10b981";
  const tooltipBg = dark ? "#0f172a" : "#ffffff";
  const tooltipText = dark ? "#f1f5f9" : "#0f172a";
  const gridColor = dark ? "hsl(217 19% 27%)" : "hsl(214 32% 91%)";

  const chartData = {
    labels: byDay.map((d) => d.date),
    datasets: [
      {
        data: dailyPct,
        borderColor: lineColor,
        backgroundColor: lineColor,
        borderWidth: 2,
        pointRadius: 0,
        pointHoverRadius: 3,
        tension: 0.35,
      },
    ],
  };

  return (
    <div className="rounded-xl border bg-white dark:border-neutral-800 dark:bg-neutral-900 p-5 flex items-center gap-4">
      <div className="min-w-[9rem]">
        <TooltipProvider delay={200}>
          <Tooltip>
            <TooltipTrigger render={<span className="inline-flex cursor-default items-center gap-1" />}>
              <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 whitespace-nowrap">Reliability trend</p>
              <Info className="h-3 w-3 text-slate-400 dark:text-neutral-500" />
            </TooltipTrigger>
            <TooltipContent>Share of runs that succeeded (not failed), per day this period.</TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <p className="mt-1 text-3xl font-bold text-slate-900 tabular-nums dark:text-neutral-100">{avg !== null ? `${animatedAvg}%` : "—"}</p>
        <p className="mt-1 text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">
          {best !== null ? `Avg daily · ${best}% best, ${worst}% worst` : "No data this period"}
        </p>
      </div>
      {dailyPct.length > 0 && (
        <div className="h-16 flex-1">
          <Line
            data={chartData}
            options={{
              maintainAspectRatio: false,
              animation: { duration: 600 },
              scales: {
                x: { display: false },
                y: { display: false, min: 0, max: 100 },
              },
              plugins: {
                legend: { display: false },
                tooltip: {
                  callbacks: {
                    title: (items) => items[0]?.label ?? "",
                    label: (item) => `Reliability: ${item.formattedValue}%`,
                  },
                  displayColors: false,
                  backgroundColor: tooltipBg,
                  titleColor: tooltipText,
                  bodyColor: tooltipText,
                  borderColor: gridColor,
                  borderWidth: 1,
                  padding: 8,
                  cornerRadius: 6,
                  bodyFont: { size: 12 },
                },
              },
            }}
          />
        </div>
      )}
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
          className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border bg-white lg dark:bg-neutral-900"
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
    onError: () => toast.add({ title: "Run failed", description: "Couldn't trigger that job. Try again." }),
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
  if (kpis.data && kpis.data.automationFailuresCount > 0) {
    attentionItems.push({
      id: "failures",
      text: `${kpis.data.automationFailuresCount} automation failure${kpis.data.automationFailuresCount === 1 ? "" : "s"} in the selected period`,
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
      <div className="border-b bg-white px-8 min-h-20 flex items-center dark:bg-neutral-900">
        <div className="flex flex-wrap items-center gap-3">
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
            className="h-9"
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
            <div className="flex items-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-900/50 dark:bg-emerald-950/40">
              <span className="h-2 w-2 shrink-0 rounded-full bg-emerald-500" />
              <p className="text-sm font-semibold text-emerald-800 dark:text-emerald-300">All systems operational</p>
            </div>
          ) : allDismissed ? (
            <div className="flex items-center gap-2 rounded-xl border border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
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
            <div className="rounded-xl border border-neutral-200 bg-white overflow-hidden dark:border-neutral-800 dark:bg-neutral-900">

              {/* Header */}
              <div className="flex items-center gap-2.5 px-4 py-3 border-b border-neutral-100 dark:border-neutral-800">
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-500" />
                </span>
                <p className="text-sm font-semibold text-slate-900 dark:text-neutral-100">Need attention</p>
                <div className="flex items-center gap-1.5 ml-1">
                  {criticalItems.length > 0 && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-red-500/10 text-red-500 border border-red-500/20 dark:bg-red-500/15 dark:border-red-500/25">
                      {criticalItems.length} Critical
                    </span>
                  )}
                  {warningItems.length > 0 && (
                    <span className="text-[10px] font-bold rounded-full px-2 py-0.5 bg-amber-500/10 text-amber-600 border border-amber-500/20 dark:bg-amber-500/15 dark:text-amber-400 dark:border-amber-500/25">
                      {warningItems.length} Warning
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

          <div className="grid gap-4 lg:grid-cols-2">
            <AutomationHealthCard
              successful={kpis.data!.automationHealth.successful}
              failed={kpis.data!.automationHealth.failed}
              previous={
                kpis.data!.previousPeriod
                  ? {
                      successful: kpis.data!.previousPeriod.automationHealth.successful,
                      failed: kpis.data!.previousPeriod.automationHealth.failed,
                    }
                  : undefined
              }
            />
            <ReliabilityTrendCard byDay={kpis.data!.byDay} />
          </div>

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

          <div className="rounded-xl border bg-white overflow-hidden dark:bg-neutral-900">
            <div className="px-5 py-4 flex items-center justify-between">
              <div>
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                  <Activity className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                  Activity trend
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Onboarding and offboarding volume over the selected range</p>
              </div>
              <span className="text-xs text-slate-400 dark:text-neutral-500">{dates.from} → {dates.to}</span>
            </div>
            <div className="p-5">
              {kpis.data!.byDay.length === 0 ? <EmptyState message="No trend data" /> : <TrendChart data={kpis.data!.byDay} />}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2 items-stretch">
            <FailureCategoryTable counts={kpis.data!.failureCategoryCounts} />

            {/* Jobs */}
            <div className="rounded-xl border bg-white overflow-hidden dark:bg-neutral-900">
              <div className="px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                  <Clock className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                  Upcoming scheduled runs
                </h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Cloud Scheduler jobs and when they run next</p>
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
                        title="Run now, without waiting for the schedule"
                      >
                        {isRunningThis ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Play className="h-3.5 w-3.5" />}
                        {isRunningThis ? <span className="shimmer">Running</span> : <span>Run Now</span>}
                      </Button>
                    </li>
                    );
                  })}
                </ul>
              )}
            </div>

          </div>

          {/* Anomalies -- full width */}
          <div className="rounded-xl border bg-white overflow-hidden dark:bg-neutral-900">
            <div className="flex items-center justify-between px-5 py-4">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700 dark:text-neutral-300">
                <AlertTriangle className="h-4 w-4 text-slate-400 dark:text-neutral-500" />
                Recent anomalies
              </h2>
              <Link to="/anomalies" className="flex items-center gap-1 text-xs font-semibold text-blue-600 dark:text-blue-400 hover:underline">
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
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/70 dark:bg-neutral-800/50">
                    <tr>
                      {["Issue", "Flow", "Status", "Time"].map((label) => (
                        <th key={label} className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                          {label}
                        </th>
                      ))}
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                        Detail
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {anomalies.data!.anomalies.slice(0, 10).map((a, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                        <td className="px-5 py-3 whitespace-nowrap">
                          {a.issueKey ? (
                            <HoverCard>
                              <HoverCardTrigger
                                delay={200}
                                closeDelay={100}
                                render={
                                  <Link
                                    to={`/tickets/${a.issueKey}`}
                                    className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                                  />
                                }
                              >
                                {a.issueKey}
                              </HoverCardTrigger>
                              <HoverCardContent className="w-[28rem]">
                                <p className="text-sm font-semibold text-slate-800 dark:text-neutral-200 break-words">
                                  {a.title ?? a.issueKey}
                                </p>
                                <div className="mt-1.5 space-y-1 text-xs text-slate-500 dark:text-neutral-400">
                                  {a.employeeEmail && <p className="truncate">Employee: {a.employeeEmail}</p>}
                                  {a.managerEmail && <p className="truncate">Manager: {a.managerEmail}</p>}
                                  {a.createdAt && <p>Created: {formatIST(a.createdAt)}</p>}
                                  <p>Updated: {formatIST(a.timestamp)}</p>
                                </div>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3"><FlowBadge flow={a.flow} /></td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <OutcomeBadge outcome={a.outcome} />
                            {!isSelfEvidentError(a.outcome) && <SeverityBadge severity={a.severity} />}
                            {a.reason && !isSelfEvidentError(a.outcome) && (
                              <span className="text-xs text-slate-500 dark:text-neutral-400 italic">{a.reason}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3 tabular-nums text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">
                          {formatIST(a.timestamp)}
                        </td>
                        <td className="px-5 py-3 max-w-96">
                          {a.error ? (
                            <HoverCard>
                              <HoverCardTrigger
                                delay={200}
                                closeDelay={100}
                                render={
                                  <span className="block cursor-default truncate font-mono text-xs text-red-600 dark:text-red-400" />
                                }
                              >
                                {a.error}
                              </HoverCardTrigger>
                              <HoverCardContent className="w-[32rem]">
                                <p className="whitespace-pre-wrap break-words font-mono text-xs text-red-600 dark:text-red-400">
                                  {a.error}
                                </p>
                              </HoverCardContent>
                            </HoverCard>
                          ) : (
                            <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
             {health.data && (
            <TooltipProvider>
            <div className="flex flex-wrap items-center gap-2 rounded-xl border bg-white px-5 py-3 dark:bg-neutral-900">
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
