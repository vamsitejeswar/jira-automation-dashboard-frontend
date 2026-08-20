import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  ArrowLeft,
  Search,
  UserPlus2,
  UserMinus2,
  Mail,
  CalendarDays,
  UserCog,
  Flag,
  UserCheck,
  UserPen,
  FolderKanban,
  Clock,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination } from "@/components/app/pagination";
import { Field, FieldContent, FieldLabel, FieldError } from "@/components/ui/field";
import { SingleDatePicker } from "@/components/ui/date-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { SelectField } from "@/components/app/select-field";
import { HrTicketStatusBadge, HrTicketTypeBadge } from "@/components/app/badges";
import { StageTimeline } from "@/components/app/StageTimeline";
import { toast } from "@/components/ui/toast";
import { getHrTicketDetail, getHrTickets, updateHrTicketFields } from "@/api";
import type { HrTicket, HrTicketFilters, HrTicketStatus } from "@/api";
import { cn, formatIST } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
];

const STATUS_OPTIONS: { value: HrTicketStatus; label: string }[] = [
  { value: "waiting_for_hr_update", label: "Waiting for Update" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

const emailSchema = z.string().email("Enter a valid email address");

function parseYMD(value: string | null | undefined): Date | undefined {
  if (!value) return undefined;
  const [y, m, d] = value.split("-").map(Number);
  return y && m && d ? new Date(y, m - 1, d) : undefined;
}

function displayDate(value: string | null): string {
  const parsed = parseYMD(value);
  return parsed ? format(parsed, "dd MMM yyyy") : "Not provided yet";
}

// Edits directly off whatever the detail panel just fetched -- keyed by
// issueKey by the caller, so switching tickets resets this form's local
// state for free.
function HrTicketEditForm({ ticket }: { ticket: HrTicket }) {
  const qc = useQueryClient();
  const isOnboarding = ticket.type === "onboarding";

  const [employeeEmail, setEmployeeEmail] = useState(ticket.employeeEmail ?? "");
  const [personalEmail, setPersonalEmail] = useState(ticket.personalEmail ?? "");
  const [joiningDate, setJoiningDate] = useState<Date | undefined>(parseYMD(ticket.joiningDate));
  const [lastWorkingDay, setLastWorkingDay] = useState<Date | undefined>(parseYMD(ticket.lastWorkingDay));
  const [errors, setErrors] = useState<Record<string, string>>({});

  function resetToTicket() {
    setEmployeeEmail(ticket.employeeEmail ?? "");
    setPersonalEmail(ticket.personalEmail ?? "");
    setJoiningDate(parseYMD(ticket.joiningDate));
    setLastWorkingDay(parseYMD(ticket.lastWorkingDay));
    setErrors({});
  }

  const mutation = useMutation({
    mutationFn: () => {
      const body: Parameters<typeof updateHrTicketFields>[1] = {};
      if (isOnboarding) {
        if (employeeEmail && employeeEmail !== (ticket.employeeEmail ?? "")) body.employee_email = employeeEmail;
        if (personalEmail && personalEmail !== (ticket.personalEmail ?? "")) body.personal_email = personalEmail;
        const formattedJoining = joiningDate ? format(joiningDate, "yyyy-MM-dd") : undefined;
        if (formattedJoining && formattedJoining !== ticket.joiningDate) body.joining_date = formattedJoining;
      } else {
        const formattedLwd = lastWorkingDay ? format(lastWorkingDay, "yyyy-MM-dd") : undefined;
        if (formattedLwd && formattedLwd !== ticket.lastWorkingDay) body.last_working_day = formattedLwd;
      }
      return updateHrTicketFields(ticket.issueKey, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-tickets"] });
      qc.invalidateQueries({ queryKey: ["hr-ticket", ticket.issueKey] });
      toast.add({ title: "Saved", description: `${ticket.issueKey} updated -- the automation will continue.` });
    },
    onError: () => {
      toast.add({ title: "Update failed", description: `Couldn't save ${ticket.issueKey}. Please try again.` });
    },
  });

  function handleSave() {
    const nextErrors: Record<string, string> = {};
    if (isOnboarding) {
      if (employeeEmail) {
        const parsed = emailSchema.safeParse(employeeEmail);
        if (!parsed.success) nextErrors.employeeEmail = parsed.error.issues[0].message;
      }
      if (personalEmail) {
        const parsed = emailSchema.safeParse(personalEmail);
        if (!parsed.success) nextErrors.personalEmail = parsed.error.issues[0].message;
      }
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;
    mutation.mutate();
  }

  const employeeChanged = isOnboarding && employeeEmail !== (ticket.employeeEmail ?? "");
  const personalChanged = isOnboarding && personalEmail !== (ticket.personalEmail ?? "");
  const joiningChanged =
    isOnboarding && (joiningDate ? format(joiningDate, "yyyy-MM-dd") : "") !== (ticket.joiningDate ?? "");
  const lwdChanged =
    !isOnboarding && (lastWorkingDay ? format(lastWorkingDay, "yyyy-MM-dd") : "") !== (ticket.lastWorkingDay ?? "");
  const anyChanged = isOnboarding ? employeeChanged || personalChanged || joiningChanged : lwdChanged;

  const canSave = isOnboarding
    ? (employeeChanged && !!employeeEmail) || (personalChanged && !!personalEmail) || (joiningChanged && !!joiningDate)
    : lwdChanged && !!lastWorkingDay;

  return (
    <div className="space-y-4">
      {isOnboarding ? (
        <>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor={`email-${ticket.issueKey}`}>Employee Email</FieldLabel>
              <Input
                id={`email-${ticket.issueKey}`}
                value={employeeEmail}
                onChange={(e) => {
                  setEmployeeEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, employeeEmail: "" }));
                }}
                placeholder="name@company.com"
              />
              <FieldError errors={errors.employeeEmail ? [{ message: errors.employeeEmail }] : undefined} />
            </FieldContent>
          </Field>
          <Field>
            <FieldContent>
              <FieldLabel htmlFor={`personal-email-${ticket.issueKey}`}>Personal Email</FieldLabel>
              <Input
                id={`personal-email-${ticket.issueKey}`}
                value={personalEmail}
                onChange={(e) => {
                  setPersonalEmail(e.target.value);
                  setErrors((prev) => ({ ...prev, personalEmail: "" }));
                }}
                placeholder="name@example.com"
              />
              <FieldError errors={errors.personalEmail ? [{ message: errors.personalEmail }] : undefined} />
            </FieldContent>
          </Field>
          <Field>
            <FieldContent>
              <FieldLabel>Date of Joining</FieldLabel>
              <SingleDatePicker value={joiningDate} onChange={setJoiningDate} />
            </FieldContent>
          </Field>
        </>
      ) : (
        <Field>
          <FieldContent>
            <FieldLabel>Last Working Day</FieldLabel>
            <SingleDatePicker value={lastWorkingDay} onChange={setLastWorkingDay} />
          </FieldContent>
        </Field>
      )}

      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Saving writes directly to the Jira ticket and resumes the automation.
        {isOnboarding && joiningChanged && joiningDate && " Changing the joining date also reschedules the workflow."}
        {!isOnboarding && lwdChanged && lastWorkingDay && " Changing the last working day also reschedules the workflow."}
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={!anyChanged || mutation.isPending} onClick={resetToTicket}>
          Reset
        </Button>
        <Button size="sm" disabled={!canSave || mutation.isPending} onClick={handleSave}>
          {mutation.isPending ? "Saving..." : "Save changes"}
        </Button>
      </div>
    </div>
  );
}

function FieldFact({
  label,
  value,
  missing,
  icon: Icon,
}: {
  label: string;
  value: string;
  missing: boolean;
  icon?: React.ElementType;
}) {
  return (
    <div className="flex min-w-0 items-start gap-2.5">
      {Icon && (
        <div className="mt-0.5 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-slate-100 text-slate-400 dark:bg-neutral-800 dark:text-neutral-500">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="min-w-0">
        <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
          {label}
        </p>
        <p
          className={cn(
            "mt-0.5 truncate text-sm",
            missing ? "font-medium text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-neutral-200"
          )}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

// Fetches the ticket fresh from Jira (GET /api/hr/tickets/{issueKey}) the
// moment it's selected, so the panel reflects Jira's current fields rather
// than whatever the list happened to have cached when it last loaded.
function HrTicketDetailPanel({ issueKey, onBack }: { issueKey: string; onBack: () => void }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["hr-ticket", issueKey],
    queryFn: () => getHrTicketDetail(issueKey),
  });

  return (
    <div className="h-full">
      <div className="flex items-center gap-2 border-b border-slate-200 px-4 py-3 lg:hidden dark:border-neutral-800">
        <Button variant="ghost" size="sm" className="gap-1.5" onClick={onBack}>
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to list
        </Button>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center gap-2 py-24 text-sm text-slate-500 dark:text-neutral-400">
          <Spinner className="h-4 w-4" /> Loading the latest details from Jira...
        </div>
      )}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-red-600 dark:text-red-400">
          Couldn't load this ticket from Jira.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {data && (
        <div className="p-4 sm:p-6 space-y-4 max-w-2xl">
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                {data.parentKey ?? data.issueKey}
              </span>
              <HrTicketTypeBadge type={data.type} />
              <HrTicketStatusBadge status={data.status} />
            </div>
            <h2 className="mt-1.5 text-xl font-bold text-slate-900 dark:text-neutral-100">
              {data.title ?? "Untitled ticket"}
            </h2>
            {data.updatedAt && (
              <p className="mt-0.5 text-xs text-slate-400 dark:text-neutral-500">
                Last activity {formatIST(data.updatedAt)}
              </p>
            )}
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Employee details</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {data.type === "onboarding" ? (
                <>
                  <FieldFact
                    icon={Mail}
                    label="Employee Email"
                    value={data.employeeEmail ?? "Not provided yet"}
                    missing={!data.employeeEmail}
                  />
                  <FieldFact
                    icon={Mail}
                    label="Personal Email"
                    value={data.personalEmail ?? "Not provided yet"}
                    missing={!data.personalEmail}
                  />
                  <FieldFact
                    icon={CalendarDays}
                    label="Date of Joining"
                    value={displayDate(data.joiningDate)}
                    missing={!data.joiningDate}
                  />
                </>
              ) : (
                <FieldFact
                  icon={CalendarDays}
                  label="Last Working Day"
                  value={displayDate(data.lastWorkingDay)}
                  missing={!data.lastWorkingDay}
                />
              )}
              <FieldFact
                icon={UserCog}
                label="Reporting Manager"
                value={data.managerEmail ?? "Not on file"}
                missing={!data.managerEmail}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Ticket details</CardTitle>
              <CardDescription>Everything Jira has on this ticket, since HR doesn't have a Jira login.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <FieldFact icon={Flag} label="Jira Status" value={data.parentDetails.status ?? "--"} missing={false} />
              <FieldFact icon={Flag} label="Priority" value={data.parentDetails.priority ?? "--"} missing={false} />
              <FieldFact
                icon={UserCheck}
                label="Assignee"
                value={data.parentDetails.assignee ?? "Unassigned"}
                missing={false}
              />
              <FieldFact icon={UserPen} label="Reporter" value={data.parentDetails.reporter ?? "--"} missing={false} />
              <FieldFact
                icon={FolderKanban}
                label="Project"
                value={
                  data.parentDetails.projectName || data.parentDetails.projectKey
                    ? `${data.parentDetails.projectName ?? ""}${data.parentDetails.projectKey ? ` (${data.parentDetails.projectKey})` : ""}`.trim()
                    : "--"
                }
                missing={false}
              />
              <FieldFact
                icon={Clock}
                label="Created"
                value={data.parentDetails.createdAt ? formatIST(data.parentDetails.createdAt) : "--"}
                missing={false}
              />
              <FieldFact
                icon={Clock}
                label="Last Updated"
                value={data.parentDetails.updatedAt ? formatIST(data.parentDetails.updatedAt) : "--"}
                missing={false}
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Progress</CardTitle>
            </CardHeader>
            <CardContent>
              <StageTimeline stages={data.stages ?? []} />
            </CardContent>
          </Card>

          <Card className="ring-blue-200 dark:ring-blue-500/30">
            <CardHeader>
              <CardTitle>Update details</CardTitle>
            </CardHeader>
            <CardContent>
              <HrTicketEditForm key={data.issueKey} ticket={data} />
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

function HrTicketListItem({
  ticket,
  selected,
  onSelect,
}: {
  ticket: HrTicket;
  selected: boolean;
  onSelect: () => void;
}) {
  const isOnboarding = ticket.type === "onboarding";
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 border-b border-slate-100 px-4 py-3 text-left transition-colors dark:border-neutral-800",
        selected ? "bg-blue-50 dark:bg-blue-500/10" : "hover:bg-slate-50 dark:hover:bg-neutral-800/50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg",
          isOnboarding
            ? "bg-blue-50 text-blue-600 dark:bg-blue-500/10 dark:text-blue-400"
            : "bg-slate-100 text-slate-500 dark:bg-neutral-800 dark:text-neutral-400"
        )}
      >
        {isOnboarding ? <UserPlus2 className="h-4 w-4" /> : <UserMinus2 className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
            {ticket.parentKey ?? ticket.issueKey}
          </span>
          <HrTicketTypeBadge type={ticket.type} />
        </div>
        <p className="mt-0.5 text-sm font-semibold text-slate-800 dark:text-neutral-200 truncate">
          {ticket.title ?? "Untitled ticket"}
        </p>
        <div className="mt-1.5 flex items-center gap-2 flex-wrap">
          <HrTicketStatusBadge status={ticket.status} />
          {ticket.missingFields.length > 0 && (
            <span className="text-[10px] font-medium text-amber-600 dark:text-amber-400">
              {ticket.missingFields.length} field{ticket.missingFields.length > 1 ? "s" : ""} missing
            </span>
          )}
        </div>
      </div>
    </button>
  );
}

const SEARCH_DEBOUNCE_MS = 400;

export function HrTickets() {
  const [filters, setFilters] = useState<HrTicketFilters>({ page: 1, pageSize: 25 });
  const [search, setSearch] = useState("");
  const [selectedIssueKey, setSelectedIssueKey] = useState<string | null>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["hr-tickets", filters],
    queryFn: () => getHrTickets(filters),
  });

  function applySearch() {
    setFilters((f) => ({ ...f, q: search.trim() || undefined, page: 1 }));
  }

  useEffect(() => {
    const timer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  function clearFilters() {
    setFilters({ page: 1, pageSize: 25 });
    setSearch("");
  }

  const currentPage = filters.page ?? 1;

  return (
    <div className="flex h-full flex-col bg-slate-50 dark:bg-neutral-950">
      <div className="border-b bg-white dark:bg-neutral-900 px-4 py-6 sm:px-8">
        <h1 className="text-2xl font-bold text-slate-900 dark:text-neutral-100 tracking-tight">My Tickets</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-neutral-400">
          Onboarding and offboarding tickets that need your attention.
        </p>

        <div className="mt-5 flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              placeholder="Search by employee name, email, or issue key..."
              className="pl-8 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <SelectField
            options={TYPE_OPTIONS}
            placeholder="All types"
            value={filters.type ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, type: (v as HrTicketFilters["type"]) || undefined, page: 1 }))}
            className="w-40"
          />
          <SelectField
            options={STATUS_OPTIONS}
            placeholder="All statuses"
            value={filters.status ?? ""}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: (v as HrTicketStatus) || undefined, page: 1 }))}
            className="w-44"
          />
          <DatePickerWithRange
            value={{ from: parseYMD(filters.from), to: parseYMD(filters.to) }}
            onChange={(range: DateRange | undefined) =>
              setFilters((prev) => ({
                ...prev,
                from: range?.from ? format(range.from, "yyyy-MM-dd") : undefined,
                to: range?.to ? format(range.to, "yyyy-MM-dd") : undefined,
                page: 1,
              }))
            }
          />
          <Button size="sm" className="h-8 text-xs" onClick={applySearch}>
            Search
          </Button>
          <Button size="sm" variant="ghost" className="h-8 text-xs" onClick={clearFilters}>
            Clear
          </Button>
        </div>
      </div>

      <div className="flex flex-1 min-h-0">
        {/* Left: ticket list -- full width on mobile until a ticket is
            selected (drill-down), a fixed-width column alongside the detail
            panel from lg: up. */}
        <div
          className={cn(
            "w-full lg:w-[600px] xl:w-[500px] flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white dark:border-neutral-800 dark:bg-neutral-900",
            selectedIssueKey && "hidden lg:block"
          )}
        >
          {isLoading && (
            <div className="space-y-3 p-4">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-lg" />
              ))}
            </div>
          )}
          {isError && (
            <div className="p-4">
              <ErrorState error={error as Error} onRetry={refetch} />
            </div>
          )}
          {!isLoading && !isError && data?.results.length === 0 && <EmptyState message="No tickets match this view." />}
          {data?.results.map((ticket) => (
            <HrTicketListItem
              key={ticket.issueKey}
              ticket={ticket}
              selected={ticket.issueKey === selectedIssueKey}
              onSelect={() => setSelectedIssueKey(ticket.issueKey)}
            />
          ))}
          {data && (
            <div className="px-4 py-3">
              <Pagination
                page={currentPage}
                pageSize={filters.pageSize ?? 25}
                total={data.total}
                onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
                itemLabel="tickets"
              />
            </div>
          )}
        </div>

        {/* Right: selected ticket's details + edit form. */}
        <div className={cn("flex-1 overflow-y-auto", !selectedIssueKey && "hidden lg:block")}>
          {selectedIssueKey ? (
            <HrTicketDetailPanel
              key={selectedIssueKey}
              issueKey={selectedIssueKey}
              onBack={() => setSelectedIssueKey(null)}
            />
          ) : (
            <div className="hidden h-full items-center justify-center lg:flex">
              <EmptyState message="Select a ticket to view and update its details." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
