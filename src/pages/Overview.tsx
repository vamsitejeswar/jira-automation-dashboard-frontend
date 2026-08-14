import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import {
  Users, UserMinus, Shield, XCircle, Clock, ArrowRight, TrendingUp, TrendingDown, Activity, AlertTriangle,
} from "lucide-react";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { Skeleton } from "@/components/ui/skeleton";
import { SeverityBadge, FlowBadge } from "@/components/ui/badge";
import { TrendChart } from "@/components/charts/TrendChart";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { getKpis, getAnomalies, getScheduledJobs } from "@/api";
import { formatISTShort } from "@/lib/utils";

type Preset = "today" | "7d" | "30d";
const PRESET_LABELS: Record<Preset, string> = { today: "Today", "7d": "Last 7 days", "30d": "Last 30 days" };

function fmt(d: Date) { return d.toISOString().split("T")[0]; }
function getPresetDates(p: Preset) {
  const today = new Date(), todayStr = fmt(today);
  const ago = (n: number) => { const d = new Date(today); d.setDate(d.getDate() - n); return fmt(d); };
  return p === "today" ? { from: todayStr, to: todayStr } : p === "7d" ? { from: ago(7), to: todayStr } : { from: ago(30), to: todayStr };
}

const KPI_CONFIG = [
  { dataKey: "onboardedCount"  as const, label: "Onboarded",     icon: Users,    accent: "#2563eb", lightBg: "#eff6ff", trend: +12, sub: "Employees",         viewTo: "/tickets" },
  { dataKey: "offboardedCount" as const, label: "Offboarded",    icon: UserMinus, accent: "#7c3aed", lightBg: "#f5f3ff", trend: +4,  sub: "Employees",         viewTo: "/tickets" },
  { dataKey: "akamaiClones"    as const, label: "Akamai Clones", icon: Shield,   accent: "#059669", lightBg: "#ecfdf5", trend: +8,  sub: "Access provisioned", viewTo: "/tickets" },
  { dataKey: "failuresCount"   as const, label: "Failures",      icon: XCircle,  accent: "#dc2626", lightBg: "#fef2f2", trend: -3,  sub: "Need attention",     viewTo: "/anomalies" },
];

/* ── Skeletons ──────────────────────────────────────────────── */
function OverviewSkeleton() {
  return (
    <div className="px-8 py-6 space-y-6">
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
function KpiTile({ label, value, icon: Icon, accent, lightBg, trend, sub, viewTo }: {
  label: string; value: number; icon: React.ElementType;
  accent: string; lightBg: string; trend: number; sub: string; viewTo: string;
}) {
  const up = trend >= 0;
  const TI = up ? TrendingUp : TrendingDown;
  const tc = label === "Failures" ? (up ? "#dc2626" : "#16a34a") : (up ? "#16a34a" : "#dc2626");
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
        <div className="mt-4 flex items-center gap-1.5 text-xs">
          <TI className="h-3.5 w-3.5" style={{ color: tc }} />
          <span className="font-semibold" style={{ color: tc }}>{up ? "+" : ""}{trend}%</span>
          <span className="text-slate-400">vs last period</span>
        </div>
      </div>
      <div className="border-t border-slate-100 px-5 py-2.5">
        <Link to={viewTo} className="flex items-center gap-1 text-xs font-semibold hover:underline" style={{ color: accent }}>
          View details <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}

function JobDot({ state }: { state: string }) {
  return <span className={`inline-flex h-2 w-2 rounded-full flex-shrink-0 ${state === "ENABLED" ? "bg-emerald-500" : "bg-amber-400"}`} />;
}

/* ── Page ───────────────────────────────────────────────────── */
export function Overview() {
  const [preset, setPreset]         = useState<Preset | "custom">("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo]     = useState("");
  const dates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset as Preset);

  const kpis     = useQuery({ queryKey: ["kpis",     dates], queryFn: () => getKpis(dates) });
  const anomalies = useQuery({ queryKey: ["anomalies", "overview", dates], queryFn: () => getAnomalies(dates) });
  const jobs     = useQuery({ queryKey: ["scheduled-jobs"], queryFn: getScheduledJobs });

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header — always visible */}
      <div className="border-b bg-white px-8 py-6">
        <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Dashboard</h1>
        <p className="mt-1 text-sm text-slate-500">Jira onboarding &amp; offboarding automation monitor · IST</p>
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {(["today", "7d", "30d"] as Preset[]).map((p) => (
              <button key={p} onClick={() => setPreset(p)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${preset === p ? "bg-white text-blue-600 shadow-sm border border-slate-200" : "text-slate-500 hover:text-slate-700"}`}>
                {PRESET_LABELS[p]}
              </button>
            ))}
          </div>
          <DateRangePicker from={dates.from} to={dates.to}
            onRangeChange={(f, t) => { setCustomFrom(f); setCustomTo(t); setPreset("custom"); }}
            placeholder="Pick date range" className="h-9 text-sm" />
        </div>
      </div>

      {/* Content */}
      {kpis.isLoading ? (
        <OverviewSkeleton />
      ) : kpis.isError ? (
        <div className="px-8 py-6"><ErrorState error={kpis.error as Error} onRetry={kpis.refetch} /></div>
      ) : (
        <div className="px-8 py-6 space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {KPI_CONFIG.map((c) => <KpiTile key={c.dataKey} label={c.label} icon={c.icon} accent={c.accent} lightBg={c.lightBg} trend={c.trend} sub={c.sub} viewTo={c.viewTo} value={kpis.data![c.dataKey]} />)}
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
              {kpis.data!.byDay.length === 0 ? <Empty message="No trend data" /> : <TrendChart data={kpis.data!.byDay} />}
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
              ) : anomalies.data!.anomalies.length === 0 ? (
                <Empty message="No anomalies in this period" className="py-8" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {anomalies.data!.anomalies.slice(0, 8).map((a, i) => (
                    <li key={i} className="flex items-center gap-2.5 px-5 py-3 hover:bg-slate-50 transition-colors">
                      <SeverityBadge severity={a.severity} />
                      <FlowBadge flow={a.flow} />
                      <span className="flex-1 truncate text-xs text-slate-500">{a.outcome}</span>
                      {a.issueKey && <Link to={`/tickets/${a.issueKey}`} className="shrink-0 font-mono text-xs text-blue-600 hover:underline font-bold">{a.issueKey}</Link>}
                      <span className="shrink-0 text-xs text-slate-400 tabular-nums">{formatISTShort(a.timestamp)}</span>
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
              ) : jobs.data!.jobs.length === 0 ? (
                <Empty message="No scheduled jobs found" className="py-8" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {[...jobs.data!.jobs].sort((a, b) => new Date(a.nextRunAt).getTime() - new Date(b.nextRunAt).getTime()).map((job) => (
                    <li key={job.name} className="flex items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
                      <JobDot state={job.state} />
                      <div className="flex-1 min-w-0">
                        <p className="truncate text-xs font-semibold text-slate-800">{job.name}</p>
                        <p className="font-mono text-[10px] text-slate-400 mt-0.5">{job.endpoint} · {job.schedule}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-xs font-semibold text-slate-800">{formatISTShort(job.nextRunAt)}</p>
                        <p className="text-[10px] text-slate-400">next run</p>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
