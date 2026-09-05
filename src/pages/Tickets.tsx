import { useState, useEffect } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  createColumnHelper,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { Search, Download, RotateCw, ChevronUp, ChevronDown } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Input } from "@/components/ui/input";
import { SelectField } from "@/components/app/select-field";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PresetPicker } from "@/components/app/preset-picker";
import { DATE_PRESETS, getPresetDates, type DatePreset } from "@/lib/date-presets";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Badge } from "@/components/ui/badge";
import { OutcomeBadge, FlowBadge, JiraStatusBadge, DateStatusBadge, isSelfEvidentError } from "@/components/app/badges";
import { toast } from "@/components/ui/toast";
import { getTickets, getParentTickets, retryCredentialEmail } from "@/api";
import type { TicketFilters, ParentTicketFilters } from "@/api";
import type { TicketSummary, ParentTicket } from "@/api";
import { formatIST, cn } from "@/lib/utils";
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
  { value: "config_change", label: "Config Change" },
  { value: "ad_m365_disable", label: "AD / M365 Disable" },
  { value: "isecure_access", label: "iSecure Access" },
  { value: "webhook", label: "Automation Disabled" },
  { value: "software_revoke", label: "Software Revoke" },
  { value: "hr_update", label: "HR Update" },
  { value: "offboarding_sla", label: "Offboarding SLA Breach" },
];

// Browse mode: instead of every audit-event-derived subtask row, show only
// real Onboarding/Offboarding PARENT tickets (GET /api/admin/parent-tickets)
// -- a lighter index into Employee Search's full multi-subtask breakdown,
// which is where each row actually links.
const TYPE_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
];

// Onboarding/Offboarding parent-ticket browse mode only -- filters on the
// ticket's own joining date / Last Working Day against today. "Overdue"
// means that date has passed but the real Jira status isn't terminal yet --
// the same still-stuck-past-deadline signal as the SLA breach check, surfaced
// here so it can be filtered to directly instead of only showing up as a
// once-ever anomaly notification.
const DATE_STATUS_OPTIONS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "overdue", label: "Overdue" },
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
  if (!t.currentStatus || !t.updatedAt || !NON_TERMINAL_OUTCOMES.has(t.currentStatus)) return false;
  const hoursSince = (Date.now() - new Date(t.updatedAt).getTime()) / 3_600_000;
  return hoursSince >= STUCK_THRESHOLD_HOURS;
}

// Only a GWS mailbox ticket whose credential email failed to send can be
// retried here -- the mailbox itself already exists (see
// app/routers/admin_api.py's retry_credential_email), only the welcome
// email needs resending.
function RetryCredentialEmailCell({ ticket }: { ticket: TicketSummary }) {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: () => retryCredentialEmail(ticket.issueKey),
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: ["tickets"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      const sent = data.status === "succeeded";
      toast.add({
        title: sent ? "Resent" : "Resend failed",
        description: sent
          ? `${ticket.issueKey}'s credentials email was resent successfully.`
          : `${ticket.issueKey} still couldn't be sent (${data.status}).`,
      });
    },
    onError: () => {
      toast.add({ title: "Retry failed", description: `Couldn't retry ${ticket.issueKey}.` });
    },
  });

  if (ticket.currentStatus !== "credential_email_failed") {
    return <span className="text-xs text-slate-300 dark:text-neutral-600">—</span>;
  }

  return (
    <Button
      variant="outline"
      size="sm"
      className="h-7 gap-1.5 text-xs"
      disabled={mutation.isPending}
      onClick={() => mutation.mutate()}
    >
      {mutation.isPending ? <Spinner className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
      Retry
    </Button>
  );
}

const col = createColumnHelper<TicketSummary>();

const columns = [
  col.accessor("issueKey", {
    header: "Issue",
    cell: (info) => (
      <Link
        to={`/tickets/${info.getValue()}`}
        className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  col.accessor("title", {
    header: "Title",
    cell: (info) => {
      const value = info.getValue();
      if (!value) return <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>;
      return (
        <HoverCard>
          <HoverCardTrigger
            delay={200}
            closeDelay={100}
            render={
              <span className="text-xs text-slate-700 dark:text-neutral-300 line-clamp-1 max-w-64 cursor-default">
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
    cell: (info) => {
      const flow = info.getValue();
      return flow ? <FlowBadge flow={flow} /> : <Badge variant="ghost">—</Badge>;
    },
  }),
  col.accessor("currentStatus", {
    header: "Status",
    cell: (info) => (
      <div className="flex items-center gap-1.5">
        {info.getValue() ? <OutcomeBadge outcome={info.getValue()!} /> : <Badge variant="ghost">Not tracked</Badge>}
        {info.row.original.hasError && info.getValue() && !isSelfEvidentError(info.getValue()!) && (
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
    cell: (info) => {
      const email = info.getValue();
      return email ? (
        <Link to={`/employees?q=${encodeURIComponent(email)}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {email}
        </Link>
      ) : (
        <span className="text-xs text-slate-600 dark:text-neutral-400">—</span>
      );
    },
  }),
  col.accessor("updatedAt", {
    header: "Last Updated",
    cell: (info) => (
      <span className="tabular-nums text-xs text-slate-600 dark:text-neutral-400 whitespace-nowrap">{formatIST(info.getValue())}</span>
    ),
  }),
  col.display({
    id: "actions",
    header: "Actions",
    cell: (info) => <RetryCredentialEmailCell ticket={info.row.original} />,
  }),
];

// A parent ticket's own issueKey has no audit trail of its own (events are
// logged against the SUBTASK that actually did the work) -- clicking one
// deep-links into Employee Search instead, which already resolves the
// employee and renders every sibling subtask's progress (the exact
// multi-record breakdown this row is just an index into).
//
// Employee Search's whole record-building step is keyed on a resolved
// employee email (see get_employee_progress's resolved_emails filter) --
// a ticket whose Employee Email field is genuinely blank on Jira (a real
// data gap, confirmed live 2026-08-28: search_employees finds the ticket
// by title fine, but there's no email for it to build a record around)
// will always dead-end there with "No employee matched", even though the
// ticket itself is real. Route those straight to the plain ticket detail
// page instead, which only needs the issueKey.
function parentTicketLink(ticket: ParentTicket): string {
  return ticket.employeeEmail
    ? `/employees?q=${encodeURIComponent(ticket.employeeEmail)}`
    : `/tickets/${encodeURIComponent(ticket.issueKey)}`;
}

const parentCol = createColumnHelper<ParentTicket>();

const parentColumns = [
  parentCol.accessor("issueKey", {
    header: "Issue",
    cell: (info) => (
      <Link
        to={parentTicketLink(info.row.original)}
        className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline whitespace-nowrap"
      >
        {info.getValue()}
      </Link>
    ),
  }),
  parentCol.accessor("title", {
    header: "Title",
    cell: (info) => {
      const value = info.getValue();
      return value ? (
        <Link to={parentTicketLink(info.row.original)} className="text-xs text-slate-700 dark:text-neutral-300 line-clamp-1 max-w-64 block hover:underline">
          {value}
        </Link>
      ) : (
        <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>
      );
    },
  }),
  parentCol.accessor("employeeEmail", {
    header: "Employee",
    cell: (info) => {
      const email = info.getValue();
      return email ? (
        <Link to={`/employees?q=${encodeURIComponent(email)}`} className="text-xs text-blue-600 dark:text-blue-400 hover:underline">
          {email}
        </Link>
      ) : (
        <span className="text-xs text-slate-600 dark:text-neutral-400">—</span>
      );
    },
  }),
  parentCol.accessor("status", {
    header: "Jira Status",
    cell: (info) => info.getValue() ? <JiraStatusBadge status={info.getValue()!} /> : <Badge variant="ghost">—</Badge>,
  }),
  parentCol.accessor("relevantDate", {
    header: "Joining / Last Working Day",
    cell: (info) => {
      const date = info.getValue();
      const dateStatus = info.row.original.dateStatus;
      if (!date) return <span className="text-xs text-slate-400 dark:text-neutral-500">—</span>;
      return (
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="tabular-nums text-xs text-slate-600 dark:text-neutral-400">{date}</span>
          {dateStatus && <DateStatusBadge status={dateStatus} />}
        </div>
      );
    },
  }),
  parentCol.accessor("createdAt", {
    header: "Created",
    cell: (info) => (
      <span className="tabular-nums text-xs text-slate-600 dark:text-neutral-400 whitespace-nowrap">{formatIST(info.getValue())}</span>
    ),
  }),
];

// Sorts just the current (server-paginated) page -- consistent with every
// other sortable table in this dashboard, which sorts what's already been
// fetched rather than re-querying per sort.
type SortField = "issueKey" | "title" | "flow" | "currentStatus" | "employeeEmail" | "updatedAt";
const SORTABLE_COLUMNS = new Set<string>(["issueKey", "title", "flow", "currentStatus", "employeeEmail", "updatedAt"]);

const SEARCH_DEBOUNCE_MS = 400;

export function Tickets() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [filters, setFilters] = useState<TicketFilters>(() => {
    const dates = getPresetDates("7d");
    return { page: 1, pageSize: 25, from: dates.from, to: dates.to };
  });
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  // Onboarding/Offboarding parent-ticket browse mode only -- "" = no filter.
  const [dateStatus, setDateStatus] = useState<"" | "upcoming" | "overdue">("");
  // "" = the normal subtask-row view below; "onboarding"/"offboarding" =
  // the parent-ticket browse mode (see parentColumns/getParentTickets above).
  // Driven by the URL's ?type= so the Sidebar's "All Tickets" > Onboarding/
  // Offboarding links actually land in the right mode, and so this page's
  // own dropdown updates the URL back (keeps the sidebar's active-state
  // highlighting and browser back/forward in sync with what's shown).
  const [searchParams, setSearchParams] = useSearchParams();
  const typeParam = searchParams.get("type");
  const ticketType: "" | "onboarding" | "offboarding" =
    typeParam === "onboarding" || typeParam === "offboarding" ? typeParam : "";
  const isParentMode = ticketType !== "";

  function setTicketType(next: "" | "onboarding" | "offboarding") {
    setSearchParams(
      (prev) => {
        const params = new URLSearchParams(prev);
        if (next) params.set("type", next);
        else params.delete("type");
        return params;
      },
      { replace: true }
    );
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function updatePreset(p: DatePreset) {
    setPreset(p);
    const dates = p === "custom" ? { from: customFrom, to: customTo } : getPresetDates(p);
    setFilters((f) => ({ ...f, from: dates.from || undefined, to: dates.to || undefined, page: 1 }));
  }

  function updateCustomRangeFromPicker(range: DateRange | undefined) {
    const from = range?.from ? format(range.from, "yyyy-MM-dd") : "";
    const to = range?.to ? format(range.to, "yyyy-MM-dd") : "";
    setCustomFrom(from);
    setCustomTo(to);
    setPreset("custom");
    setFilters((f) => ({ ...f, from: from || undefined, to: to || undefined, page: 1 }));
  }

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["tickets", filters],
    queryFn: () => getTickets(filters),
    enabled: !isParentMode,
  });

  const parentFilters: ParentTicketFilters = {
    type: (ticketType || "onboarding") as "onboarding" | "offboarding",
    from: filters.from,
    to: filters.to,
    q: filters.q,
    dateStatus: dateStatus || undefined,
    page: filters.page,
    pageSize: filters.pageSize,
  };
  const parentQuery = useQuery({
    queryKey: ["parent-tickets", parentFilters],
    queryFn: () => getParentTickets(parentFilters),
    enabled: isParentMode,
  });

  const sortedResults = [...(data?.results ?? [])].sort((a, b) => {
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    const cmp = String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  const table = useReactTable({
    data: sortedResults,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: data ? Math.ceil(data.total / (filters.pageSize ?? 25)) : 0,
  });

  const parentTable = useReactTable({
    data: parentQuery.data?.results ?? [],
    columns: parentColumns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    pageCount: parentQuery.data ? Math.ceil(parentQuery.data.total / (filters.pageSize ?? 25)) : 0,
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-blue-500" />
      : <ChevronDown className="h-3 w-3 text-blue-500" />;
  }

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
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      {/* Header */}
      <div className="border-b bg-white dark:bg-neutral-900 px-8 min-h-20 flex items-center">
        {/* Filters */}
        <div className="flex flex-wrap gap-2 items-center">
          <PresetPicker options={DATE_PRESETS} value={preset} onChange={updatePreset} />
          <DatePickerWithRange
            value={{ from: parseYMD(filters.from), to: parseYMD(filters.to) }}
            onChange={updateCustomRangeFromPicker}
            className="h-9"
          />
          <Button
            size="sm"
            variant="outline"
            className="h-9 text-xs"
            onClick={() => {
              const dates = getPresetDates("7d");
              setPreset("7d");
              setFilters({ page: 1, pageSize: 25, from: dates.from, to: dates.to });
              setSearch("");
              setTicketType("");
              setDateStatus("");
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      <div className="px-4 py-4 space-y-4">
      {/* Table controls */}
      <div className="flex flex-wrap gap-2 items-center">
        <div className="relative flex-1 min-w-44">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
          <Input
            placeholder="Issue key or email..."
            className="pl-8 h-9 text-xs"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && applySearch()}
          />
        </div>
        <SelectField
          options={TYPE_OPTIONS}
          placeholder="All types"
          value={ticketType}
          onValueChange={(v) => {
            setTicketType((v as "onboarding" | "offboarding") || "");
            setFilters((f) => ({ ...f, page: 1 }));
          }}
          className="w-40 !h-9"
        />
        {!isParentMode && (
          <SelectField
            options={FLOW_OPTIONS}
            placeholder="All flows"
            value={filters.flow ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, flow: v || undefined, page: 1 }))}
            className="w-44 !h-9"
          />
        )}
        {isParentMode && (
          <SelectField
            options={DATE_STATUS_OPTIONS}
            placeholder="All dates"
            value={dateStatus}
            onValueChange={(v) => {
              setDateStatus((v as "upcoming" | "overdue") || "");
              setFilters((f) => ({ ...f, page: 1 }));
            }}
            className="w-40 !h-9"
          />
        )}
        {!isParentMode && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={!data?.results.length}
            className="h-9 gap-2"
          >
            <Download className="h-3.5 w-3.5" />
            Export Excel
          </Button>
        )}
      </div>
      {/* Table */}
      <div className="rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden">
        {(isParentMode ? parentQuery.isLoading : isLoading) ? (
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
        ) : (isParentMode ? parentQuery.isError : isError) ? (
          <ErrorState
            error={(isParentMode ? parentQuery.error : error) as Error}
            onRetry={isParentMode ? parentQuery.refetch : refetch}
          />
        ) : (isParentMode ? parentQuery.data?.results.length === 0 : data?.results.length === 0) ? (
          <EmptyState message={isParentMode ? `No ${ticketType} tickets match your filters` : "No tickets match your filters"} />
        ) : isParentMode ? (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50/70 dark:bg-neutral-800/50">
                {parentTable.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => (
                      <th key={h.id} className="px-4 py-3 text-left whitespace-nowrap">
                        <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400">
                          {flexRender(h.column.columnDef.header, h.getContext())}
                        </span>
                      </th>
                    ))}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {parentTable.getRowModel().rows.map((row) => (
                  <tr key={row.id} className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
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
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="border-b bg-slate-50/70 dark:bg-neutral-800/50">
                {table.getHeaderGroups().map((hg) => (
                  <tr key={hg.id}>
                    {hg.headers.map((h) => {
                      const sortable = SORTABLE_COLUMNS.has(h.column.id);
                      return (
                        <th
                          key={h.id}
                          className={cn(
                            "px-4 py-3 text-left whitespace-nowrap",
                            sortable && "select-none cursor-pointer group"
                          )}
                          onClick={sortable ? () => toggleSort(h.column.id as SortField) : undefined}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors">
                              {flexRender(h.column.columnDef.header, h.getContext())}
                            </span>
                            {sortable && <SortIcon field={h.column.id as SortField} />}
                          </div>
                        </th>
                      );
                    })}
                  </tr>
                ))}
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                {table.getRowModel().rows.map((row) => (
                  <tr
                    key={row.id}
                    className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors"
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
      </div>

      {/* Pagination */}
      {isParentMode
        ? parentQuery.data && (
            <Pagination
              page={currentPage}
              pageSize={filters.pageSize ?? 25}
              total={parentQuery.data.total}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
              itemLabel={`${ticketType} tickets`}
            />
          )
        : data && (
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
