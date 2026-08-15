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
import { toast } from "@/components/ui/toast";
import { TrendChart } from "@/components/charts/TrendChart";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PresetPicker } from "@/components/app/preset-picker";
import { getKpis, getAnomalies, getScheduledJobs, runScheduledJob } from "@/api";
import type { EmployeeSearchResult } from "@/api";
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
  { dataKey: "onboardedCount"    as const, trendKey: "onboardedCount"  as const, label: "Onboarded",         icon: Users,    accent: "#2563eb", lightBg: "#eff6ff", sub: "Employees",              viewTo: "/tickets" },
  { dataKey: "offboardedCount"   as const, trendKey: "offboardedCount" as const, label: "Offboarded",        icon: UserMinus, accent: "#7c3aed", lightBg: "#f5f3ff", sub: "Employees",              viewTo: "/tickets" },
  { dataKey: "pendingApprovals"  as const, trendKey: null,                       label: "Pending Approvals", icon: MailCheck, accent: "#d97706", lightBg: "#fffbeb", sub: "Awaiting manager reply", viewTo: "/approvals", live: true },
  { dataKey: "failuresCount"     as const, trendKey: "failuresCount"   as const, label: "Failures",          icon: XCircle,  accent: "#dc2626", lightBg: "#fef2f2", sub: "Need attention",         viewTo: "/anomalies" },
];

/* ── Skeletons ──────────────────────────────────────────────── */
function OverviewSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white shadow-sm overflow-hidden flex flex-col">
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
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 flex items-center justify-between">
          <Skeleton className="h-4 w-28" />
          <Skeleton className="h-3 w-36" />
        </div>
        <div className="p-5"><Skeleton className="h-52 w-full" /></div>
      </div>
      <div className="grid gap-4 lg:grid-cols-2">
        {[0, 1].map((i) => (
          <div key={i} className="rounded-xl bg-white shadow-sm overflow-hidden">
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
function KpiTile({ label, value, previous, icon: Icon, accent, lightBg, live, sub, viewTo }: {
  label: string; value: number; previous?: number; icon: React.ElementType;
  accent: string; lightBg: string; live?: boolean; sub: string; viewTo: string;
}) {
  const hasTrend = previous !== undefined && previous > 0;
  const pctChange = hasTrend ? Math.round(((value - previous!) / previous!) * 100) : 0;
  const up = pctChange >= 0;
  const TrendIcon = up ? TrendingUp : TrendingDown;
  // For Failures, "up" is bad (red); for everything else "up" is good (green).
  const trendColor = label === "Failures" ? (up ? "#dc2626" : "#16a34a") : (up ? "#16a34a" : "#dc2626");
  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow flex flex-col">
      <div className="h-1" style={{ background: accent }} />
      <div className="p-5 flex-1">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
            <p className="mt-2 text-4xl font-bold text-slate-900 tabular-nums">{value}</p>
            <p className="mt-1 text-xs text-slate-500">{sub}</p>
          </div>
          <div className="rounded-xl p-3 flex-shrink-0" style={{ background: lightBg }}>
            <Icon className="h-5 w-5" style={{ color: accent }} />
          </div>
        </div>
        {live ? (
          <div className="mt-4 text-xs text-slate-400">Live count, not date-ranged</div>
        ) : hasTrend ? (
          <div className="mt-4 flex items-center gap-1.5 text-xs">
            <TrendIcon className="h-3.5 w-3.5" style={{ color: trendColor }} />
            <span className="font-semibold" style={{ color: trendColor }}>{up ? "+" : ""}{pctChange}%</span>
            <span className="text-slate-400">vs previous period</span>
          </div>
        ) : (
          <div className="mt-4 text-xs text-slate-400">No prior-period data yet to compare</div>
        )}
      </div>
      <div className="border-t border-slate-100 px-5 py-2.5">
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
  succeeded: { dot: "bg-emerald-500", label: "Succeeded", text: "text-emerald-700" },
  failed:    { dot: "bg-red-500",     label: "Failed",    text: "text-red-700" },
  unknown:   { dot: "bg-slate-300",   label: "No runs yet", text: "text-slate-400" },
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
      <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
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
          className="absolute z-10 mt-1.5 w-full max-h-64 overflow-y-auto rounded-lg border bg-white shadow-lg"
          onMouseDown={(e) => e.preventDefault()}
        >
          {suggestions.map((s, i) => (
            <li
              key={i}
              onClick={() => goTo(s)}
              className="px-3.5 py-2 cursor-pointer hover:bg-slate-50 border-b last:border-b-0"
            >
              <p className="text-xs font-semibold text-slate-700 truncate">{s.title ?? s.issueKey}</p>
              <p className="text-[11px] text-slate-400 truncate">
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
  // job.state.
  const failedJobs = (jobs.data?.jobs ?? []).filter((j) => j.lastRunStatus === "failed");
  const attentionItems: { text: string; to: string }[] = [];
  failedJobs.forEach((j) => attentionItems.push({ text: `"${j.label}" failed its last run`, to: "/schedules" }));
  if (kpis.data && kpis.data.pendingApprovals > 0) {
    attentionItems.push({
      text: `${kpis.data.pendingApprovals} approval${kpis.data.pendingApprovals === 1 ? "" : "s"} waiting on a manager`,
      to: "/approvals",
    });
  }
  if (kpis.data && kpis.data.failuresCount > 0) {
    attentionItems.push({
      text: `${kpis.data.failuresCount} failure${kpis.data.failuresCount === 1 ? "" : "s"} in the selected period`,
      to: "/anomalies",
    });
  }
  const systemHealthy = attentionItems.length === 0;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header — always visible */}
      <div className="border-b bg-white px-8 py-6">
        <div>
          <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
          <p className="mt-1 text-sm text-slate-500">Jira onboarding &amp; offboarding automation monitor · IST</p>
        </div>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <GlobalSearchBox />
          <PresetPicker options={DATE_PRESETS} value={preset} onChange={setPreset} />
          <DatePickerWithRange
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
          {/* System status + needs-attention -- the one-sentence answer to
              "is this healthy right now," before any other detail. */}
          <div
            className={`rounded-xl border px-5 py-4 shadow-sm ${
              systemHealthy ? "bg-emerald-50 border-emerald-200" : "bg-amber-50 border-amber-200"
            }`}
          >
            <div className="flex items-center gap-2">
              <span className={`inline-flex h-2.5 w-2.5 rounded-full flex-shrink-0 ${systemHealthy ? "bg-emerald-500" : "bg-amber-500"}`} />
              <p className={`text-sm font-bold ${systemHealthy ? "text-emerald-800" : "text-amber-800"}`}>
                {systemHealthy ? "Healthy — nothing needs you right now" : "Needs your attention"}
              </p>
            </div>
            {!systemHealthy && (
              <ul className="mt-2.5 space-y-1.5">
                {attentionItems.map((item, i) => (
                  <li key={i}>
                    <Link to={item.to} className="text-sm font-medium text-amber-800 hover:underline">
                      {item.text} →
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_CONFIG.map((c) => (
              <KpiTile
                key={c.dataKey}
                label={c.label}
                icon={c.icon}
                accent={c.accent}
                lightBg={c.lightBg}
                live={c.live}
                sub={c.sub}
                viewTo={c.viewTo}
                value={kpis.data![c.dataKey]}
                previous={c.trendKey ? kpis.data!.previousPeriod?.[c.trendKey] : undefined}
              />
            ))}
          </div>

          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 flex items-center justify-between">
              <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                <Activity className="h-4 w-4 text-slate-400" />
                Activity trend
              </h2>
              <span className="text-xs text-slate-400">{dates.from} → {dates.to}</span>
            </div>
            <div className="p-5">
              {kpis.data!.byDay.length === 0 ? <EmptyState message="No trend data" /> : <TrendChart data={kpis.data!.byDay} />}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {/* Anomalies */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="flex items-center justify-between px-5 py-4">
                <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <AlertTriangle className="h-4 w-4 text-slate-400" />
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
                <ul className="divide-y divide-slate-100">
                  {anomalies.data!.anomalies.slice(0, 8).map((a, i) => (
                    <li key={i} className="flex items-center gap-2.5 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <SeverityBadge severity={a.severity} />
                      <FlowBadge flow={a.flow} />
                      <span className="flex-1 truncate text-xs text-slate-500">{a.outcome}</span>
                      {a.issueKey && (
                        <Link
                          to={`/tickets/${a.issueKey}`}
                          className="flex items-center gap-0.5 shrink-0 font-mono text-xs font-bold text-blue-600 hover:underline"
                        >
                          {a.issueKey}
                          <ArrowUpRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                      <span className="shrink-0 text-xs text-slate-600 tabular-nums">{formatISTShort(a.timestamp)}</span>
                      
                    </li>
                  ))}
                </ul>
              )}
            </div>

            {/* Jobs */}
            <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
              <div className="px-5 py-4 flex items-center gap-2">
                <Clock className="h-4 w-4 text-slate-400" />
                <h2 className="text-sm font-semibold text-slate-700">Upcoming scheduled runs</h2>
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
                <ul className="divide-y divide-slate-100">
                  {[...jobs.data!.jobs].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()).map((job) => {
                    const isRunningThis = forceRun.isPending && forceRun.variables === job.name;
                    return (
                    <li key={job.name} className="flex items-center gap-4 px-5 py-4 hover:bg-slate-50/70 transition-colors">
                      <div className="w-24 shrink-0"><JobStatus status={job.lastRunStatus} /></div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="truncate text-sm font-semibold text-slate-800">{job.label}</p>
                          <span className="truncate rounded bg-slate-100 px-1.5 py-0.5 font-mono text-[10px] text-slate-500" title="Cloud Scheduler job name">
                            {job.name}
                          </span>
                        </div>
                        <p className="mt-0.5 truncate text-xs text-slate-400">{describeCron(job.schedule, job.timeZone)}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-700 tabular-nums">{formatISTShort(job.nextRunAt)}</p>
                        <p className="text-[11px] text-slate-400">next run</p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-8 gap-1.5 text-xs font-medium shrink-0 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 hover:text-emerald-800"
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
        </div>
      )}
    </div>
  );
}
