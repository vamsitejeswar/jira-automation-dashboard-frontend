import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Download, Filter } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { DateRangePicker } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { OutcomeBadge, FlowBadge, Badge } from "@/components/ui/badge";
import { getTickets } from "@/api";
import type { TicketFilters } from "@/api";
import type { TicketSummary } from "@/api";
import { formatIST } from "@/lib/utils";
import { exportToExcel, ticketsToExcelRows } from "@/lib/export";

const FLOW_OPTIONS = [
  { value: "gws_mailbox", label: "Mailbox" },
  { value: "akamai_access", label: "Akamai" },
  { value: "drive_transfer", label: "Drive Transfer" },
  { value: "scheduled_credentials", label: "Scheduled Credentials" },
  { value: "data_transfer", label: "Data Transfer" },
  { value: "toggle_change", label: "Toggle Change" },
];

const col = createColumnHelper<TicketSummary>();

const columns = [
  col.accessor("issueKey", {
    header: "Issue",
    cell: (info) => (
      <Link
        to={`/tickets/${info.getValue()}`}
        className="font-mono text-xs font-bold text-blue-600 hover:underline"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor("title", {
    header: "Title",
    cell: (info) => (
      <span className="text-xs text-slate-700 line-clamp-1 max-w-xs" title={info.getValue() ?? undefined}>
        {info.getValue() ?? "—"}
      </span>
    ),
  }),
  col.accessor("flow", {
    header: "Flow",
    cell: (info) => <FlowBadge flow={info.getValue()} />,
  }),
  col.accessor("currentStatus", {
    header: "Status",
    cell: (info) => <OutcomeBadge outcome={info.getValue()} />,
  }),
  col.accessor("employeeEmail", {
    header: "Employee",
    cell: (info) => (
      <span className="text-xs text-slate-500">{info.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("managerEmail", {
    header: "Manager",
    cell: (info) => (
      <span className="text-xs text-slate-500">{info.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("updatedAt", {
    header: "Last Updated",
    cell: (info) => (
      <span className="tabular-nums text-xs text-slate-400">{formatIST(info.getValue())}</span>
    ),
  }),
  col.accessor("hasError", {
    header: "",
    cell: (info) =>
      info.getValue() ? (
        <Badge variant="error">Error</Badge>
      ) : null,
  }),
];

export function Tickets() {
  const [filters, setFilters] = useState<TicketFilters>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => getTickets(filters),
  });

  const table = useReactTable({
    data: data?.results ?? [],
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / (filters.pageSize ?? 25)) : 0,
  });

  function applySearch() {
    setFilters((f) => ({ ...f, q: search, page: 1 }));
  }

  function handleExport() {
    if (!data?.results.length) return;
    exportToExcel(ticketsToExcelRows(data.results), "tickets-export");
  }

  const totalPages = data ? Math.ceil(data.total / (filters.pageSize ?? 25)) : 0;
  const currentPage = filters.page ?? 1;

  return (
    <div className="min-h-full bg-slate-50">
      {/* Header */}
      <div className="border-b bg-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Tickets</h1>
            <p className="mt-1 text-sm text-slate-500">
              All onboarding &amp; offboarding tickets
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

        {/* Filters */}
        <div className="mt-5 flex flex-wrap gap-2 items-center">
          <Filter className="h-4 w-4 text-slate-400 shrink-0" />
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              placeholder="Issue key or email..."
              className="pl-8 h-8 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <Select
            options={FLOW_OPTIONS}
            placeholder="All flows"
            value={filters.flow ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, flow: v || undefined, page: 1 }))}
            className="w-44"
          />
          <DateRangePicker
            from={filters.from ?? ""}
            to={filters.to ?? ""}
            onRangeChange={(f, t) => setFilters((prev) => ({ ...prev, from: f || undefined, to: t || undefined, page: 1 }))}
            placeholder="Pick date range"
            className="h-9 text-xs"
          />
          <Button size="sm" className="h-8 text-xs" onClick={applySearch}>Search</Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-8 text-xs"
            onClick={() => { setFilters({ page: 1, pageSize: 25 }); setSearch(""); }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="px-8 py-6 space-y-6">
      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <div className="space-y-3.5 px-4 py-3">
            <div className="flex items-center gap-4">
              {["w-16", "w-20", "w-20", "w-40", "w-32", "w-28"].map((w, i) => (
                <Skeleton key={i} className={`h-3 ${w}`} />
              ))}
            </div>
            {[...Array(8)].map((_, i) => (
              <div key={i} className="flex items-center gap-4">
                <Skeleton className="h-4 w-16 rounded" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-3 w-40" />
                <Skeleton className="h-3 w-32" />
                <Skeleton className="h-3 w-28" />
              </div>
            ))}
          </div>
        ) : isError ? (
          <ErrorState error={error as Error} onRetry={refetch} />
        ) : data?.results.length === 0 ? (
          <Empty message="No tickets match your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 transition-colors"
                  >
                    {row.getVisibleCells().map((cell) => (
                      <td key={cell.id} className="px-4 py-3">
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      {/* Pagination */}
      {data && (
        <div className="flex items-center justify-between text-xs text-slate-500">
          <span>
            Showing{" "}
            <span className="font-semibold text-slate-900">
              {(currentPage - 1) * (filters.pageSize ?? 25) + 1}–
              {Math.min(currentPage * (filters.pageSize ?? 25), data.total)}
            </span>{" "}
            of <span className="font-semibold text-slate-900">{data.total}</span> tickets
          </span>
          <div className="flex items-center gap-1">
            <Button
              variant="outline"
              size="sm"
              disabled={currentPage <= 1}
              onClick={() => setFilters((f) => ({ ...f, page: currentPage - 1 }))}
              className="h-7 text-xs"
            >
              Previous
            </Button>
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => i + 1).map((p) => (
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
              className="h-7 text-xs"
            >
              Next
            </Button>
          </div>
        </div>
      )}
      </div>
    </div>
  );
}
