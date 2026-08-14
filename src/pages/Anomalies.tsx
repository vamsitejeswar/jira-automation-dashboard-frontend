import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, ChevronUp, ChevronDown, AlertCircle, Activity, Zap } from "lucide-react";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { SeverityBadge, FlowBadge } from "@/components/ui/badge";
import { getAnomalies } from "@/api";
import type { AnomalyFilters } from "@/api";
import { formatIST } from "@/lib/utils";

type Preset = "today" | "3d" | "7d" | "14d" | "30d" | "custom";

function getPresetDates(preset: Preset): { from: string; to: string } {
  const today = new Date();
  const fmt = (d: Date) => d.toISOString().split("T")[0];
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return fmt(d);
  };
  const todayStr = fmt(today);
  switch (preset) {
    case "today":  return { from: todayStr, to: todayStr };
    case "3d":     return { from: daysAgo(3), to: todayStr };
    case "7d":     return { from: daysAgo(7), to: todayStr };
    case "14d":    return { from: daysAgo(14), to: todayStr };
    case "30d":    return { from: daysAgo(30), to: todayStr };
    default:       return { from: "", to: todayStr };
  }
}

const PRESETS: { key: Preset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "3d",    label: "3 days" },
  { key: "7d",    label: "7 days" },
  { key: "14d",   label: "14 days" },
  { key: "30d",   label: "30 days" },
];

const SEVERITY_BORDER: Record<string, string> = {
  ERROR:   "border-l-red-500",
  WARNING: "border-l-amber-400",
  INFO:    "border-l-sky-400",
};
const SEVERITY_ROW_BG: Record<string, string> = {
  ERROR:   "bg-red-50/60",
  WARNING: "bg-amber-50/60",
  INFO:    "bg-sky-50/30",
};

function AnomaliesSkeleton() {
  return (
    <div className="px-8 py-6 space-y-6">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b bg-slate-50 space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4 px-5 py-3">
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-4 w-36" />
              <Skeleton className="h-4 w-8" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b bg-slate-50">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="divide-y divide-slate-100">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3 border-l-4 border-l-slate-200 px-5 py-3.5">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 flex-1 min-w-0" />
              <Skeleton className="h-3 w-24 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function Anomalies() {
  const [preset, setPreset]           = useState<Preset>("7d");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState(() => new Date().toISOString().split("T")[0]);
  const [includeNormal, setIncludeNormal] = useState(false);
  const [sortField, setSortField]     = useState<"flow" | "outcome" | "count">("count");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc");

  const dates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset);
  const days   = preset === "today" ? 1 : preset === "custom" ? undefined : parseInt(preset);

  const filters: AnomalyFilters = {
    days,
    from: dates.from || undefined,
    to:   dates.to   || undefined,
    includeNormal,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["anomalies", filters],
    queryFn:  () => getAnomalies(filters),
  });

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  const breakdown = [...(data?.breakdownByFlowAndOutcome ?? [])].sort((a, b) => {
    const av = a[sortField], bv = b[sortField];
    if (typeof av === "number" && typeof bv === "number")
      return sortDir === "asc" ? av - bv : bv - av;
    return sortDir === "asc"
      ? String(av).localeCompare(String(bv))
      : String(bv).localeCompare(String(av));
  });

  const events = includeNormal ? (data?.allEvents ?? []) : (data?.anomalies ?? []);
  const failureRate = data && data.totalEventsScanned > 0
    ? ((data.totalAnomalies / data.totalEventsScanned) * 100).toFixed(1)
    : "0.0";

  function SortIcon({ field }: { field: typeof sortField }) {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-blue-500" />
      : <ChevronDown className="h-3 w-3 text-blue-500" />;
  }

  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Anomalies</h1>
            <p className="mt-1 text-sm text-slate-500">
              Detect and investigate automation failures across all flows.
            </p>
          </div>
          {days === 30 && (
            <div className="flex items-center gap-1.5 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
              <Info className="h-3.5 w-3.5 flex-shrink-0" />
              Cloud Logging retention is 30 days.
            </div>
          )}
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          {/* Preset quick picks */}
          <div className="flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 p-1">
            {PRESETS.map((p) => (
              <button
                key={p.key}
                onClick={() => setPreset(p.key)}
                className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                  preset === p.key
                    ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                {p.label}
              </button>
            ))}
            <button
              onClick={() => setPreset("custom")}
              className={`rounded-md px-3 py-1.5 text-xs font-semibold transition-all ${
                preset === "custom"
                  ? "bg-white text-blue-600 shadow-sm border border-slate-200"
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Custom
            </button>
          </div>

          {/* Date range inputs */}
          <DateRangePicker
            from={preset === "custom" ? customFrom : dates.from}
            to={preset === "custom" ? customTo : dates.to}
            onRangeChange={(f, t) => { setCustomFrom(f); setCustomTo(t); setPreset("custom"); }}
            placeholder="Pick date range"
            className="h-9 text-xs"
          />

          {/* Include normal toggle */}
          <label className="ml-auto flex items-center gap-2 cursor-pointer group">
            <div
              onClick={() => setIncludeNormal((v) => !v)}
              className={`relative h-5 w-9 rounded-full transition-colors cursor-pointer ${
                includeNormal ? "bg-blue-600" : "bg-slate-200"
              }`}
            >
              <span
                className={`absolute top-0.5 left-0.5 h-4 w-4 rounded-full bg-white shadow transition-transform ${
                  includeNormal ? "translate-x-4" : "translate-x-0"
                }`}
              />
            </div>
            <span className="text-xs text-slate-600 font-medium">Include normal events</span>
          </label>
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <AnomaliesSkeleton />
      ) : isError ? (
        <div className="px-8 py-6">
          <ErrorState error={error as Error} onRetry={refetch} />
        </div>
      ) : (
        <div className="px-8 py-6 space-y-6">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 flex-shrink-0">
                <Activity className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 tabular-nums">{data!.totalEventsScanned}</p>
                <p className="text-xs text-slate-500 mt-0.5">Events scanned</p>
              </div>
            </div>
            <div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 tabular-nums">{data!.totalAnomalies}</p>
                <p className="text-xs text-slate-500 mt-0.5">Anomalies detected</p>
              </div>
            </div>
            <div className="rounded-xl border bg-white px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 flex-shrink-0">
                <Zap className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className={`text-2xl font-bold tabular-nums ${parseFloat(failureRate) > 10 ? "text-red-600" : "text-amber-600"}`}>
                  {failureRate}%
                </p>
                <p className="text-xs text-slate-500 mt-0.5">Failure rate</p>
              </div>
            </div>
          </div>

          <>
            {/* Breakdown table */}
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b bg-slate-50">
                <h2 className="text-sm font-semibold text-slate-700">Breakdown by flow &amp; outcome</h2>
                <p className="text-xs text-slate-500 mt-0.5">Click columns to sort</p>
              </div>
              {breakdown.length === 0 ? (
                <Empty message="No anomalies in this period" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50/70">
                      <tr>
                        {(["flow", "outcome", "count"] as const).map((f) => (
                          <th
                            key={f}
                            className="px-5 py-3 text-left select-none cursor-pointer group"
                            onClick={() => toggleSort(f)}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 transition-colors">
                                {f}
                              </span>
                              <SortIcon field={f} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {breakdown.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 transition-colors">
                          <td className="px-5 py-3">
                            <FlowBadge flow={row.flow} />
                          </td>
                          <td className="px-5 py-3 text-xs font-mono text-slate-700">{row.outcome}</td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums font-bold text-slate-900">{row.count}</span>
                              <div
                                className="h-1.5 rounded-full bg-blue-500 opacity-60"
                                style={{
                                  width: `${Math.max(4, (row.count / (breakdown[0]?.count ?? 1)) * 80)}px`,
                                }}
                              />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Event list */}
            <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
              <div className="px-5 py-4 border-b bg-slate-50 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                <h2 className="text-sm font-semibold text-slate-700">
                  {includeNormal ? "All events" : "Anomaly events"}
                </h2>
                <span className="ml-auto text-xs text-slate-400 font-medium">
                  {events.length} total
                </span>
              </div>
              {events.length === 0 ? (
                <Empty message="No events to show for this period" />
              ) : (
                <ul className="divide-y divide-slate-100">
                  {events.map((a, i) => (
                    <li
                      key={i}
                      className={`flex flex-wrap items-start gap-x-3 gap-y-1.5 border-l-4 px-5 py-3.5 transition-colors hover:brightness-95 ${
                        SEVERITY_BORDER[a.severity] ?? "border-l-slate-200"
                      } ${SEVERITY_ROW_BG[a.severity] ?? ""}`}
                    >
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <SeverityBadge severity={a.severity} />
                        <FlowBadge flow={a.flow} />
                        <span className="font-mono text-xs text-slate-700">{a.outcome}</span>
                        {a.reason && (
                          <span className="text-xs text-slate-500 italic">{a.reason}</span>
                        )}
                        {a.issueKey && (
                          <Link
                            to={`/tickets/${a.issueKey}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline"
                          >
                            {a.issueKey}
                          </Link>
                        )}
                      </div>
                      <span className="shrink-0 tabular-nums text-xs text-slate-400">
                        {formatIST(a.timestamp)}
                      </span>
                      {a.error && (
                        <p className="w-full mt-1 rounded-md bg-red-50 border border-red-100 px-3 py-1.5 font-mono text-xs text-red-600">
                          {a.error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </>
        </div>
      )}
    </div>
  );
}
