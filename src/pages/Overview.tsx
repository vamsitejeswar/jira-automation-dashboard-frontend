import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, UserMinus, Shield, XCircle, Clock, ArrowRight, TrendingUp, TrendingDown,
} from "lucide-react";
import { PageSpinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { SeverityBadge, FlowBadge } from "@/components/ui/badge";
import { TrendChart } from "@/components/charts/TrendChart";
import { getKpis, getAnomalies, getScheduledJobs } from "@/api";
import { formatISTShort } from "@/lib/utils";
import { DatePicker } from "@/components/ui/date-picker";

type Preset = "today" | "7d" | "30d" | "custom";

const PRESET_LABELS: Record<Preset, string> = {
  today:  "Today",
  "7d":   "Last 7 days",
  "30d":  "Last 30 days",
  custom: "Custom",
};

function fmt(d: Date) { return d.toISOString().split("T")[0]; }

function getPresetDates(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const todayStr = fmt(today);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return fmt(d);
  };
  switch (preset) {
    case "today": return { from: todayStr,    to: todayStr };
    case "7d":    return { from: daysAgo(7),  to: todayStr };
    case "30d":   return { from: daysAgo(30), to: todayStr };
    default:      return { from: daysAgo(7),  to: todayStr };
  }
}

const KPI_CONFIG = [
  {
    key:       "onboardedCount" as const,
    label:     "Onboarded",
    icon:      Users,
    accent:    "#2563eb",
    lightBg:   "#eff6ff",
    trend:     +12,
    sub:       "employees",
  },
  {
    key:       "offboardedCount" as const,
    label:     "Offboarded",
    icon:      UserMinus,
    accent:    "#7c3aed",
    lightBg:   "#f5f3ff",
    trend:     +4,
    sub:       "employees",
  },
  {
    key:       "akamaiClones" as const,
    label:     "Akamai Clones",
    icon:      Shield,
    accent:    "#059669",
    lightBg:   "#ecfdf5",
    trend:     +8,
    sub:       "access provisioned",
  },
  {
    key:       "failuresCount" as const,
    label:     "Failures",
    icon:      XCircle,
    accent:    "#dc2626",
    lightBg:   "#fef2f2",
    trend:     -3,
    sub:       "need attention",
  },
];

function KpiTile({
  label, value, icon: Icon, accent, lightBg, trend, sub,
}: {
  label: string; value: number; icon: React.ElementType;
  accent: string; lightBg: string; trend: number; sub: string;
}) {
  const trendUp = trend >= 0;
  const TrendIcon = trendUp ? TrendingUp : TrendingDown;
  const trendColor = label === "Failures"
    ? (trendUp ? "#dc2626" : "#16a34a")
    : (trendUp ? "#16a34a" : "#dc2626");

  return (
    <div className="rounded-xl border bg-white shadow-sm overflow-hidden hover:shadow-md transition-shadow">
      {/* Colored accent stripe */}
      <div className="h-1" style={{ background: accent }} />
      <div className="p-5">
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
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          <TrendIcon className="h-3.5 w-3.5" style={{ color: trendColor }} />
          <span className="font-semibold" style={{ color: trendColor }}>
            {trendUp ? "+" : ""}{trend}%
          </span>
          <span className="text-slate-400">vs last period</span>
        </div>
      </div>
    </div>
  );
}

function JobStateDot({ state }: { state: string }) {
  return (
    <span
      title={state}
      className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${
        state === "ENABLED"
          ? "bg-emerald-500 shadow-sm shadow-emerald-400"
          : "bg-amber-400"
      }`}
    />
  );
}

export function Overview() {
  const [preset, setPreset]         = useState<Preset>("7d");
  const [customFrom, setCustomFrom] = useState(() => fmt(new Date(new Date().setDate(new Date().getDate() - 7))));
  const [customTo, setCustomTo]     = useState(() => fmt(new Date()));

  const dates = preset === "custom"
    ? { from: customFrom, to: customTo }
    : getPresetDates(preset);

  const kpis = useQuery({
    queryKey: ["kpis", dates],
    queryFn:  () => getKpis(dates),
  });
  const anomalies = useQuery({
    queryKey: ["anomalies", "overview", dates],
    queryFn:  () => getAnomalies(dates),
  });
  const jobs = useQuery({ queryKey: ["scheduled-jobs"], queryFn: getScheduledJobs });

  if (kpis.isLoading) return <PageSpinner />;
  if (kpis.isError)   return <ErrorState error={kpis.error as Error} onRetry={kpis.refetch} />;

  const k = kpis.data!;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white px-8 py-6">
        <div className="flex items-start justify-between flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
            <p className="mt-1 text-sm text-slate-500">
              Jira onboarding &amp; offboarding automation monitor · IST
            </p>
          </div>
        </div>

        {/* Filter row */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* Preset buttons */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["today", "7d", "30d", "custom"] as Preset[]).map((p) => (
              <button
                key={p}
                onClick={() => setPreset(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  preset === p
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>

          {/* Date range inputs */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">From</span>
            <DatePicker
              value={preset === "custom" ? customFrom : dates.from}
              onChange={(v) => { setCustomFrom(v); setPreset("custom"); }}
              placeholder="Start date"
              className="h-9 text-sm"
            />
            <span className="text-xs text-slate-500 font-medium">To</span>
            <DatePicker
              value={preset === "custom" ? customTo : dates.to}
              onChange={(v) => { setCustomTo(v); setPreset("custom"); }}
              placeholder="End date"
              className="h-9 text-sm"
            />
          </div>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
        {/* KPI tiles */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {KPI_CONFIG.map((cfg) => (
            <KpiTile
              key={cfg.key}
              label={cfg.label}
              value={k[cfg.key]}
              icon={cfg.icon}
              accent={cfg.accent}
              lightBg={cfg.lightBg}
              trend={cfg.trend}
              sub={cfg.sub}
            />
          ))}
        </div>

        {/* Trend chart */}
        <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b bg-slate-50">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-700">Activity trend</h2>
              <span className="text-xs text-slate-400">
                {dates.from} → {dates.to}
              </span>
            </div>
          </div>
          <div className="p-5">
            {k.byDay.length === 0 ? (
              <Empty message="No trend data for this period" />
            ) : (
              <TrendChart data={k.byDay} />
            )}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {/* Recent anomalies */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between px-5 py-4 border-b bg-slate-50">
              <h2 className="text-sm font-semibold text-slate-700">Recent anomalies</h2>
              <Link
                to="/anomalies"
                className="flex items-center gap-1 text-xs font-semibold text-blue-600 hover:underline"
              >
                View all <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            {anomalies.isLoading ? (
              <div className="py-10 flex justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              </div>
            ) : anomalies.isError ? (
              <ErrorState error={anomalies.error as Error} />
            ) : anomalies.data!.anomalies.length === 0 ? (
              <Empty message="No anomalies in this period" className="py-8" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {anomalies.data!.anomalies.slice(0, 8).map((a, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2.5 px-5 py-3 hover:bg-slate-50 transition-colors"
                  >
                    <SeverityBadge severity={a.severity} />
                    <FlowBadge flow={a.flow} />
                    <span className="flex-1 truncate text-xs text-slate-500">{a.outcome}</span>
                    {a.issueKey && (
                      <Link
                        to={`/tickets/${a.issueKey}`}
                        className="shrink-0 font-mono text-xs text-blue-600 hover:underline font-bold"
                      >
                        {a.issueKey}
                      </Link>
                    )}
                    <span className="shrink-0 text-xs text-slate-400 tabular-nums">
                      {formatISTShort(a.timestamp)}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* Upcoming scheduled runs */}
          <div className="rounded-xl border bg-white shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b bg-slate-50 flex items-center gap-2">
              <Clock className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Upcoming scheduled runs</h2>
            </div>
            {jobs.isLoading ? (
              <div className="py-10 flex justify-center">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-600" />
              </div>
            ) : jobs.isError ? (
              <ErrorState error={jobs.error as Error} />
            ) : jobs.data!.jobs.length === 0 ? (
              <Empty message="No scheduled jobs found" className="py-8" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {[...jobs.data!.jobs]
                  .sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime())
                  .map((job) => (
                    <li
                      key={job.name}
                      className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors"
                    >
                      <JobStateDot state={job.state} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{job.name}</p>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">
                          {job.endpoint} · {job.schedule}
                        </p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-800">
                          {formatISTShort(job.nextRunAt)}
                        </p>
                        <p className="text-[10px] text-slate-400">next run</p>
                      </div>
                    </li>
                  ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
