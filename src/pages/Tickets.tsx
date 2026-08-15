import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Download } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/app/select-field";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { OutcomeBadge, FlowBadge, isSelfEvidentError } from "@/components/app/badges";
import { getTickets } from "@/api";
import type { TicketFilters } from "@/api";
import type { TicketSummary } from "@/api";
import { formatIST } from "@/lib/utils";
import { exportToExcel, ticketsToExcelRows } from "@/lib/export";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { Pagination } from "@/components/app/pagination";

const FLOW_OPTIONS = [
  { value: "gws_mailbox", label: "Mailbox" },
  { value: "akamai_access", label: "Akamai" },
  { value: "drive_transfer", label: "Drive Transfer" },
  { value: "gws_suspend", label: "Account Suspension" },
  { value: "scheduled_credentials", label: "Scheduled Credentials" },
  { value: "data_transfer", label: "Data Transfer" },
  { value: "toggle_change", label: "Toggle Change" },
];

function parseYMD(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

// A ticket sitting in one of these non-terminal states for far longer than
// normal has no other flag distinguishing it from one 30 seconds into a
// completely normal run -- these outcomes mean "waiting on something,"
// which past a couple of days is worth a human's attention.
const STUCK_THRESHOLD_HOURS = 48;
const NON_TERMINAL_OUTCOMES = new Set([
  "setup_email_sent", "transfer_email_sent", "deferred_to_lwd", "deferred_to_doj",
]);
function isStuck(t: TicketSummary): boolean {
  if (!NON_TERMINAL_OUTCOMES.has(t.currentStatus)) return false;
  const hoursSince = (Date.now() - new Date(t.updatedAt).getTime()) / 3_600_000;
  return hoursSince >= STUCK_THRESHOLD_HOURS;
}

const col = createColumnHelper<TicketSummary>();

const columns = [
  col.accessor("issueKey", {
    header: "Issue",
    cell: (info) => (
      <Link
        to={`/tickets/${info.getValue()}`}
        className="font-mono text-xs font-bold text-blue-600 hover:underline whitespace-nowrap"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor("title", {
    header: "Title",
    cell: (info) => {
      const value = info.getValue();
      if (!value) return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
      return (
        <HoverCard>
          <HoverCardTrigger
            delay={200}
            closeDelay={100}
            render={
              <span className="text-xs text-slate-700 dark:text-slate-300 line-clamp-1 max-w-64 cursor-default">
                {value}
              </span>
            }
          />
          <HoverCardContent className="w-auto max-w-xs text-xs">{value}</HoverCardContent>
        </HoverCard>
      );
    },
  }),
  col.accessor("flow", {
    header: "Flow",
    cell: (info) => <FlowBadge flow={info.getValue()} />,
  }),
  col.accessor("currentStatus", {
    header: "Status",
    cell: (info) => (
      <div className="flex items-center gap-1.5">
        <OutcomeBadge outcome={info.getValue()} />
        {info.row.original.hasError && !isSelfEvidentError(info.getValue()) && (
          <Badge variant="destructive">Error</Badge>
        )}
        {isStuck(info.row.original) && (
          <Badge variant="outline" className="border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-300">Stuck</Badge>
        )}
      </div>
    ),
  }),
  col.accessor("employeeEmail", {
    header: "Employee",
    cell: (info) => (
      <span className="text-xs text-slate-600 dark:text-slate-400">{info.getValue() ?? "—"}</span>
    ),
  }),
  col.accessor("updatedAt", {
    header: "Last Updated",
    cell: (info) => (
      <span className="tabular-nums text-xs text-slate-600 dark:text-slate-400 whitespace-nowrap">{formatIST(info.getValue())}</span>
    ),
  }),
];

const SEARCH_DEBOUNCE_MS = 400;

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

  // Type-and-narrow, same feel as every other search box in the dashboard --
  // Enter/the Search button still apply instantly for anyone who prefers that.
  useEffect(() => {
    const timer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function handleExport() {
    if (!data?.results.length) return;
    exportToExcel(ticketsToExcelRows(data.results), "tickets-export");
  }

  const currentPage = filters.page ?? 1;

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-slate-900 px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-slate-100 tracking-tight">Tickets</h1>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
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
                    <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-slate-500" />
            <Input
              placeholder="Issue key or email..."
              className="pl-8 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <SelectField
            options={FLOW_OPTIONS}
            placeholder="All flows"
            value={filters.flow ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, flow: v || undefined, page: 1 }))}
            className="w-44"
          />
          <DatePickerWithRange
            value={{ from: parseYMD(filters.from), to: parseYMD(filters.to) }}
            onChange={(range: DateRange | undefined) =>
              setFilters((prev) => ({
                ...prev,
                from: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
                to:   range?.to   ? format(range.to,   "yyyy-MM-dd") : undefined,
                page: 1,
              }))
            }
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

      <div className="px-4 py-4 space-y-4">
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
          <EmptyState message="No tickets match your filters" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50 dark:bg-slate-950">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th
                        key={h.id}
                        className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap"
                      >
                        {flexRender(h.column.columnDef.header, h.getContext())}
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors"
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
        <Pagination
          page={currentPage}
          pageSize={filters.pageSize ?? 25}
          total={data.total}
          onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
          itemLabel="tickets"
        />
      )}
      </div>
    </div>
  );
}
