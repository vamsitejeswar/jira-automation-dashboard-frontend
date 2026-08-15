import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { AlertTriangle, Info, ChevronUp, ChevronDown, AlertCircle, Activity, Zap, Download } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PresetPicker } from "@/components/app/preset-picker";
import { SelectField } from "@/components/app/select-field";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { FlowBadge, OutcomeBadge, isSelfEvidentError } from "@/components/app/badges";
import { Pagination } from "@/components/app/pagination";
import { getAnomalies } from "@/api";
import type { AnomalyFilters } from "@/api";
import { formatIST } from "@/lib/utils";
import { exportToExcel, auditLogToExcelRows } from "@/lib/export";
import { DATE_PRESETS, getPresetDates, type DatePreset } from "@/lib/date-presets";

const FLOW_OPTIONS = [
  { value: "gws_mailbox",           label: "Mailbox" },
  { value: "akamai_access",         label: "Akamai" },
  { value: "drive_transfer",        label: "Drive Transfer" },
  { value: "gws_suspend",           label: "Account Suspension" },
  { value: "scheduled_credentials", label: "Scheduled Credentials" },
  { value: "data_transfer",         label: "Data Transfer" },
  { value: "toggle_change",         label: "Toggle Change" },
];
const SEVERITY_OPTIONS = [
  { value: "INFO",    label: "INFO" },
  { value: "WARNING", label: "WARNING" },
  { value: "ERROR",   label: "ERROR" },
];

function parseYMD(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

const SEVERITY_BORDER: Record<string, string> = {
  ERROR:   "border-l-red-500",
  WARNING: "border-l-amber-400",
  INFO:    "border-l-sky-400",
};
const SEVERITY_ROW_BG: Record<string, string> = {
  ERROR:   "bg-red-50/60 dark:bg-red-950/40",
  WARNING: "bg-amber-50/60 dark:bg-amber-950/40",
  INFO:    "bg-sky-50/30 dark:bg-sky-950/40",
};

function AnomaliesSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl bg-white dark:bg-neutral-900 px-5 py-4 shadow-sm flex items-center gap-4">
            <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
            <div className="space-y-2">
              <Skeleton className="h-6 w-12" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        ))}
      </div>
      <div className="rounded-xl bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4 space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-32" />
        </div>
        <div className="space-y-3 px-5 pb-5">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-[15%] rounded-full" />
              <Skeleton className="h-4 w-[55%]" />
              <Skeleton className="h-4 w-[20%]" />
            </div>
          ))}
        </div>
      </div>
      <div className="rounded-xl bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
        <div className="px-5 py-4">
          <Skeleton className="h-4 w-28" />
        </div>
        <div className="space-y-3 px-5 pb-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex flex-wrap items-center gap-3">
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

const ANOMALIES_PAGE_SIZE = 50;

export function Anomalies() {
  const [preset, setPreset]           = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom]   = useState("");
  const [customTo, setCustomTo]       = useState(() => new Date().toISOString().split("T")[0]);
  const [includeNormal, setIncludeNormal] = useState(false);
  const [flow, setFlow]               = useState<string | undefined>(undefined);
  const [severity, setSeverity]       = useState<string | undefined>(undefined);
  const [sortField, setSortField]     = useState<"flow" | "outcome" | "count">("count");
  const [sortDir, setSortDir]         = useState<"asc" | "desc">("desc");
  const [page, setPage]               = useState(1);

  const dates = preset === "custom" ? { from: customFrom, to: customTo } : getPresetDates(preset);
  const days   = preset === "today" ? 1 : preset === "custom" ? undefined : parseInt(preset);

  const filters: AnomalyFilters = {
    days,
    from: dates.from || undefined,
    to:   dates.to   || undefined,
    includeNormal,
    flow,
    severity,
    page,
    pageSize: ANOMALIES_PAGE_SIZE,
  };

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["anomalies", filters],
    queryFn:  () => getAnomalies(filters),
  });

  // Any change to what's being scanned starts back at page 1 -- the
  // previous page number almost never lines up with a totally different
  // result set.
  function updatePreset(p: DatePreset) { setPreset(p); setPage(1); }
  function updateIncludeNormal(v: boolean) { setIncludeNormal(v); setPage(1); }
  function updateFlow(v: string) { setFlow(v || undefined); setPage(1); }
  function updateSeverity(v: string) { setSeverity(v || undefined); setPage(1); }
  function updateCustomRange(f: string, t: string) {
    setCustomFrom(f); setCustomTo(t); setPreset("custom"); setPage(1);
  }
  function updateCustomRangeFromPicker(range: DateRange | undefined) {
    updateCustomRange(
      range?.from ? format(range.from, "yyyy-MM-dd") : "",
      range?.to   ? format(range.to,   "yyyy-MM-dd") : ""
    );
  }

  function toggleSort(field: typeof sortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("desc"); }
  }

  function handleExport() {
    if (!events.length) return;
    exportToExcel(auditLogToExcelRows(events), "events-export");
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
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      {/* Page header */}
      <div className="border-b bg-white dark:bg-neutral-900 px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tracking-tight">Failures &amp; History</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
              Every automation event, filterable down to just the ones that need attention.
            </p>
          </div>
          <div className="flex items-center gap-2">
            {days === 30 && (
              <div className="flex items-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-900/50 rounded-lg px-3 py-2">
                <Info className="h-3.5 w-3.5 flex-shrink-0" />
                Cloud Logging retention is 30 days.
              </div>
            )}
            <Button variant="outline" size="sm" onClick={handleExport} disabled={!events.length} className="gap-2">
              <Download className="h-3.5 w-3.5" />
              Export Excel
            </Button>
          </div>
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <PresetPicker options={DATE_PRESETS} value={preset} onChange={updatePreset} />

          <DatePickerWithRange
            value={{
              from: parseYMD(preset === "custom" ? customFrom : dates.from),
              to:   parseYMD(preset === "custom" ? customTo   : dates.to),
            }}
            onChange={updateCustomRangeFromPicker}
          />

          <SelectField
            options={FLOW_OPTIONS}
            placeholder="All flows"
            value={flow ?? ""}
            onValueChange={updateFlow}
            className="w-44"
          />
          <SelectField
            options={SEVERITY_OPTIONS}
            placeholder="Any severity"
            value={severity ?? ""}
            onValueChange={updateSeverity}
            className="w-36"
          />

          <label className="ml-auto flex items-center gap-2 cursor-pointer">
            <Switch checked={includeNormal} onCheckedChange={updateIncludeNormal} />
            <span className="text-xs text-slate-600 dark:text-neutral-400 font-medium">Include normal events</span>
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
        <div className="px-4 py-4 space-y-4">
          {/* Stats bar */}
          <div className="grid grid-cols-3 gap-4">
            <div className="rounded-xl border bg-white dark:bg-neutral-900 px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-blue-50 dark:bg-blue-950/40 flex-shrink-0">
                <Activity className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tabular-nums">{data!.totalEventsScanned}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Events scanned</p>
              </div>
            </div>
            <div className="rounded-xl border bg-white dark:bg-neutral-900 px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-red-50 dark:bg-red-950/40 flex-shrink-0">
                <AlertCircle className="h-5 w-5 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{data!.totalAnomalies}</p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Failures detected</p>
              </div>
            </div>
            <div className="rounded-xl border bg-white dark:bg-neutral-900 px-5 py-4 shadow-sm flex items-center gap-4">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-amber-50 dark:bg-amber-950/40 flex-shrink-0">
                <Zap className="h-5 w-5 text-amber-500 dark:text-amber-400" />
              </div>
              <div>
                <p className={`text-2xl font-bold tabular-nums ${parseFloat(failureRate) > 10 ? "text-red-600 dark:text-red-400" : "text-amber-600 dark:text-amber-400"}`}>
                  {failureRate}%
                </p>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Failure rate</p>
              </div>
            </div>
          </div>

          <>
            {/* Breakdown table */}
            <div className="rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
              <div className="px-5 py-4">
                <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Breakdown by flow &amp; status</h2>
                <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Click columns to sort</p>
              </div>
              {breakdown.length === 0 ? (
                <EmptyState message="No failures in this period" />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="border-b bg-slate-50/70 dark:bg-neutral-800/50">
                      <tr>
                        {(["flow", "outcome", "count"] as const).map((f) => (
                          <th
                            key={f}
                            className="px-5 py-3 text-left select-none cursor-pointer group"
                            onClick={() => toggleSort(f)}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors">
                                {f === "outcome" ? "status" : f}
                              </span>
                              <SortIcon field={f} />
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                      {breakdown.map((row, i) => (
                        <tr key={i} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
                          <td className="px-5 py-3">
                            <Link to={`/automations/${row.flow}`} className="hover:underline decoration-dotted">
                              <FlowBadge flow={row.flow} />
                            </Link>
                          </td>
                          <td className="px-5 py-3"><OutcomeBadge outcome={row.outcome} /></td>
                          <td className="px-5 py-3">
                            <div className="flex items-center gap-2">
                              <span className="tabular-nums font-bold text-slate-900 dark:text-neutral-100">{row.count}</span>
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
            <div className="rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden shadow-sm">
              <div className="px-5 py-4 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500 dark:text-amber-400" />
                <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300">
                  {includeNormal ? "All events" : "Failure events"}
                </h2>
                <span className="ml-auto text-xs text-slate-400 dark:text-neutral-500 font-medium">
                  {data!.total} total
                </span>
              </div>
              {events.length === 0 ? (
                <EmptyState message="No events to show for this filter" />
              ) : (
                <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
                  {events.map((a, i) => (
                    <li
                      key={i}
                      className={`flex flex-wrap items-start gap-x-3 gap-y-1.5 border-l-4 px-5 py-3.5 transition-colors hover:brightness-95 ${
                        SEVERITY_BORDER[a.severity] ?? "border-l-slate-200"
                      } ${SEVERITY_ROW_BG[a.severity] ?? ""}`}
                    >
                      {/* Severity is already conveyed by this row's left
                          border + tint -- a third badge repeating it was
                          just noise, so only flow + status are shown here. */}
                      <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0">
                        <FlowBadge flow={a.flow} />
                        <OutcomeBadge outcome={a.outcome} />
                        {a.reason && !isSelfEvidentError(a.outcome) && (
                          <span className="text-xs text-slate-500 dark:text-neutral-400 italic">{a.reason}</span>
                        )}
                        {a.issueKey && (
                          <Link
                            to={`/tickets/${a.issueKey}`}
                            className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
                          >
                            {a.issueKey}
                          </Link>
                        )}
                      </div>
                      <span className="shrink-0 tabular-nums text-xs text-slate-400 dark:text-neutral-500">
                        {formatIST(a.timestamp)}
                      </span>
                      {a.error && (
                        <p className="w-full mt-1 rounded-md bg-red-50 dark:bg-red-950/40 border border-red-100 dark:border-red-900/50 px-3 py-1.5 font-mono text-xs text-red-600 dark:text-red-400">
                          {a.error}
                        </p>
                      )}
                    </li>
                  ))}
                </ul>
              )}
              {data!.total > ANOMALIES_PAGE_SIZE && (
                <div className="border-t px-5 py-3">
                  <Pagination page={page} pageSize={ANOMALIES_PAGE_SIZE} total={data!.total} onPageChange={setPage} itemLabel="events" />
                </div>
              )}
            </div>
          </>
        </div>
      )}
    </div>
  );
}
