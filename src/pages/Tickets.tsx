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
import { DatePicker } from "@/components/ui/date-picker";
import { Button } from "@/components/ui/button";
import { PageSpinner } from "@/components/ui/spinner";
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
        className="font-mono text-xs font-bold text-primary hover:underline"
      >
        {info.getValue()}
      </Link>
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
      <span className="text-xs text-foreground/70">{info.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("managerEmail", {
    header: "Manager",
    cell: (info) => (
      <span className="text-xs text-foreground/70">{info.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("updatedAt", {
    header: "Last Updated",
    cell: (info) => (
      <span className="tabular-nums text-xs text-muted-foreground">{formatIST(info.getValue())}</span>
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
    <div className="p-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Tickets</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
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

      {/* Filters bar */}
      <div className="flex flex-wrap gap-2 items-center rounded-xl border bg-card px-4 py-3 shadow-card">
        <Filter className="h-4 w-4 text-muted-foreground shrink-0" />
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
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
        <DatePicker
          value={filters.from ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, from: v || undefined, page: 1 }))}
          placeholder="From date"
          className="h-9 text-xs"
        />
        <span className="text-xs text-muted-foreground">→</span>
        <DatePicker
          value={filters.to ?? ""}
          onChange={(v) => setFilters((f) => ({ ...f, to: v || undefined, page: 1 }))}
          placeholder="To date"
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

      {/* Table */}
      <Card className="overflow-hidden">
        {isLoading ? (
          <PageSpinner />
        ) : isError ? (
          <ErrorState error={error as Error} onRetry={refetch} />
        ) : data?.results.length === 0 ? (
          <Empty message="No tickets match your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/30">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y">
                {table.getRowModel().rows.map((row, i) => (
                  <tr
                    key={row.id}
                    className={`hover:bg-primary/4 transition-colors ${i % 2 === 0 ? "" : "bg-muted/20"}`}
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
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>
            Showing{" "}
            <span className="font-semibold text-foreground">
              {(currentPage - 1) * (filters.pageSize ?? 25) + 1}–
              {Math.min(currentPage * (filters.pageSize ?? 25), data.total)}
            </span>{" "}
            of <span className="font-semibold text-foreground">{data.total}</span> tickets
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
  );
}
