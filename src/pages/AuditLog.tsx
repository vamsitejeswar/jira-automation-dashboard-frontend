import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Link } from "react-router-dom";
import { Download, Filter, ChevronLeft, ChevronRight } from "lucide-react";
import { Select } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { SeverityBadge, FlowBadge } from "@/components/ui/badge";
import { getAuditLog } from "@/api";
import type { AuditLogFilters } from "@/api";
import { formatIST } from "@/lib/utils";
import { exportToExcel, auditLogToExcelRows } from "@/lib/export";

const FLOW_OPTIONS = [
  { value: "gws_mailbox",           label: "Mailbox" },
  { value: "akamai_access",         label: "Akamai" },
  { value: "drive_transfer",        label: "Drive Transfer" },
  { value: "scheduled_credentials", label: "Scheduled Credentials" },
  { value: "data_transfer",         label: "Data Transfer" },
  { value: "toggle_change",         label: "Toggle Change" },
];

const SEVERITY_OPTIONS = [
  { value: "INFO",    label: "INFO" },
  { value: "WARNING", label: "WARNING" },
  { value: "ERROR",   label: "ERROR" },
];

const SEVERITY_STRIPE: Record<string, string> = {
  ERROR:   "border-l-red-500 bg-red-50/50",
  WARNING: "border-l-amber-400 bg-amber-50/40",
  INFO:    "border-l-transparent",
};

export function AuditLog() {
  const [filters, setFilters] = useState<AuditLogFilters>({ page: 1, pageSize: 50 });

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["audit-log", filters],
    queryFn:  () => getAuditLog(filters),
  });

  function handleExport() {
    if (!data?.results.length) return;
    exportToExcel(auditLogToExcelRows(data.results), "audit-log-export");
  }

  const totalPages  = data ? Math.ceil(data.total / (filters.pageSize ?? 50)) : 0;
  const currentPage = filters.page ?? 1;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white px-8 py-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Audit Log</h1>
            <p className="mt-1 text-sm text-slate-500">
              Raw Cloud Logging entries — 30-day retention
            </p>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data?.results.length}
            className="gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </Button>
        </div>

        {/* Filter bar */}
        <div className="mt-5 flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-slate-400">
            <Filter className="h-4 w-4" />
          </div>
          <Select
            options={FLOW_OPTIONS}
            placeholder="All flows"
            value={filters.flow ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, flow: v || undefined, page: 1 }))}
            className="w-48"
          />
          <Select
            options={SEVERITY_OPTIONS}
            placeholder="Any severity"
            value={filters.severity ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, severity: v || undefined, page: 1 }))}
            className="w-36"
          />
          <DateRangePicker
            from={filters.from ?? ""}
            to={filters.to ?? ""}
            onRangeChange={(f, t) => setFilters((prev) => ({ ...prev, from: f || undefined, to: t || undefined, page: 1 }))}
            placeholder="Pick date range"
            className="h-9 text-sm"
          />
          {(filters.flow || filters.severity || filters.from || filters.to) && (
            <button
              className="text-xs font-semibold text-blue-600 hover:underline ml-1"
              onClick={() => setFilters({ page: 1, pageSize: 50 })}
            >
              Clear filters
            </button>
          )}
          {data && (
            <span className="ml-auto text-xs text-slate-400">
              <span className="font-semibold text-slate-600">{data.total}</span> entries
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6 space-y-6">
        <div className={`rounded-xl bg-white overflow-hidden shadow-sm ${isLoading ? "" : "border"}`}>
          {isLoading ? (
            <div className="space-y-3.5 px-5 py-3.5">
              <div className="flex items-center gap-4">
                <Skeleton className="h-3 w-[14%]" />
                <Skeleton className="h-3 w-[10%]" />
                <Skeleton className="h-3 w-[12%]" />
                <Skeleton className="h-3 w-[20%]" />
                <Skeleton className="h-3 w-[10%]" />
                <Skeleton className="h-3 w-[28%]" />
              </div>
              {[...Array(10)].map((_, i) => (
                <div key={i} className="flex items-center gap-4">
                  <Skeleton className="h-3 w-[14%]" />
                  <Skeleton className="h-5 w-[10%] rounded-full" />
                  <Skeleton className="h-5 w-[12%] rounded-full" />
                  <Skeleton className="h-3 w-[20%]" />
                  <Skeleton className="h-3 w-[10%]" />
                  <Skeleton className="h-3 w-[28%]" />
                </div>
              ))}
            </div>
          ) : isError ? (
            <ErrorState error={error as Error} onRetry={refetch} />
          ) : data?.results.length === 0 ? (
            <Empty message="No log entries match these filters" />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-slate-50">
                    {["Time (IST)", "Severity", "Flow", "Outcome", "Issue", "Error"].map((h) => (
                      <th
                        key={h}
                        className="px-5 py-3.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                      >
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {data!.results.map((e, i) => (
                    <tr
                      key={i}
                      className={`border-l-4 hover:brightness-95 transition-colors align-top ${
                        SEVERITY_STRIPE[e.severity] ?? "border-l-transparent"
                      }`}
                    >
                      <td className="px-5 py-3 tabular-nums text-xs whitespace-nowrap font-mono text-slate-500">
                        {formatIST(e.timestamp)}
                      </td>
                      <td className="px-5 py-3">
                        <SeverityBadge severity={e.severity} />
                      </td>
                      <td className="px-5 py-3">
                        <FlowBadge flow={e.flow} />
                      </td>
                      <td className="px-5 py-3 text-xs font-mono text-slate-700 whitespace-nowrap">{e.outcome}</td>
                      <td className="px-5 py-3">
                        {e.issueKey ? (
                          <Link
                            to={`/tickets/${e.issueKey}`}
                            className="font-mono text-xs font-bold text-blue-600 hover:underline whitespace-nowrap"
                          >
                            {e.issueKey}
                          </Link>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                      <td className="px-5 py-3 max-w-xs">
                        {e.error ? (
                          <span className="text-xs text-red-600 font-mono truncate block">{e.error}</span>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {data && data.total > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-xs text-slate-500">
              Showing{" "}
              <span className="font-semibold text-slate-800">
                {(currentPage - 1) * (filters.pageSize ?? 50) + 1}–
                {Math.min(currentPage * (filters.pageSize ?? 50), data.total)}
              </span>{" "}
              of <span className="font-semibold text-slate-800">{data.total}</span> entries
            </span>
            <div className="flex items-center gap-1">
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => setFilters((f) => ({ ...f, page: currentPage - 1 }))}
                className="h-7 gap-1 text-xs"
              >
                <ChevronLeft className="h-3.5 w-3.5" /> Previous
              </Button>
              {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => i + 1).map((p) => (
                <Button
                  key={p}
                  variant={p === currentPage ? "default" : "ghost"}
                  size="sm"
                  onClick={() => setFilters((f) => ({ ...f, page: p }))}
                  className="h-7 w-7 text-xs p-0"
                >
                  {p}
                </Button>
              ))}
              <Button
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => setFilters((f) => ({ ...f, page: currentPage + 1 }))}
                className="h-7 gap-1 text-xs"
              >
                Next <ChevronRight className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
