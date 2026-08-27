import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";
import { format } from "date-fns";
import type { DateRange } from "react-day-picker";
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Clock,
  Search,
  SquarePen,
  UserMinus2,
  UserPlus2,
  XCircle,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent, CardAction } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Pagination } from "@/components/app/pagination";
import { Field, FieldContent, FieldLabel, FieldError } from "@/components/ui/field";
import { SingleDatePicker } from "@/components/ui/date-picker";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { SelectField } from "@/components/app/select-field";
import { HrTicketStatusBadge, HrTicketTypeBadge } from "@/components/app/badges";
import { StageTimeline } from "@/components/app/StageTimeline";
import { toast } from "@/components/ui/toast";
import { getHrTicketDetail, getHrTickets, updateHrTicketFields, searchHrManagers } from "@/api";
import type { HrTicket, HrTicketFilters, HrTicketStatus, GwsUser } from "@/api";
import { cn, formatIST } from "@/lib/utils";

const TYPE_OPTIONS = [
  { value: "onboarding", label: "Onboarding" },
  { value: "offboarding", label: "Offboarding" },
];

const STATUS_OPTIONS: { value: HrTicketStatus; label: string }[] = [
  { value: "waiting_for_hr_update", label: "Waiting for HR Update" },
  { value: "in_progress", label: "In Progress" },
  { value: "completed", label: "Completed" },
  { value: "failed", label: "Failed" },
];

// One color per request type, reused everywhere the type shows up (list row
// avatar, detail header avatar) -- matches HrTicketTypeBadge's own
// sky/orange (see components/app/badges.tsx's STATUS_STYLE) so the same
// type never reads as a different color in two different places on this
// page. Kept as icon + color (two channels), not color alone.
const TYPE_ACCENT = {
  onboarding: {
    iconBg: "bg-sky-50 dark:bg-sky-500/10",
    iconColor: "text-sky-600 dark:text-sky-400",
  },
  offboarding: {
    iconBg: "bg-orange-50 dark:bg-orange-500/10",
    iconColor: "text-orange-600 dark:text-orange-400",
  },
} as const;

// A small redundant status icon next to "Last activity" in the detail
// header -- same status the badge already names in text, just a second,
// glanceable channel (matters for colorblind users who can't rely on the
// badge's hue alone).
const STATUS_ICON: Record<HrTicketStatus, { icon: React.ElementType; className: string }> = {
  completed: { icon: CheckCircle2, className: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/15" },
  waiting_for_hr_update: { icon: Clock, className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/15" },
  in_progress: { icon: Clock, className: "text-sky-600 dark:text-sky-400 bg-sky-50 dark:bg-sky-500/15" },
  failed: { icon: XCircle, className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-500/15" },
};

// Jira priority is free text from the underlying system, not a fixed enum
// this app controls -- match on the common Atlassian defaults and fall back
// to a neutral dot for anything else rather than guessing.
const PRIORITY_DOT: Record<string, string> = {
  highest: "bg-red-500",
  high: "bg-orange-500",
  medium: "bg-amber-500",
  low: "bg-sky-500",
  lowest: "bg-slate-400",
};

const emailSchema = z.string().email("Enter a valid email address");
const MANAGER_SEARCH_DEBOUNCE_MS = 250;

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
// state for free. Lives inside a Dialog (see HrTicketEditDialog) rather
// than a permanently-visible card -- closes itself via onDone once a save
// succeeds.
function HrTicketEditForm({ ticket, onDone }: { ticket: HrTicket; onDone: () => void }) {
  const qc = useQueryClient();
  const isOnboarding = ticket.type === "onboarding";

  const [employeeEmail, setEmployeeEmail] = useState(ticket.employeeEmail ?? "");
  const [personalEmail, setPersonalEmail] = useState(ticket.personalEmail ?? "");
  const [joiningDate, setJoiningDate] = useState<Date | undefined>(parseYMD(ticket.joiningDate));
  const [lastWorkingDay, setLastWorkingDay] = useState<Date | undefined>(parseYMD(ticket.lastWorkingDay));
  const [managerEmail, setManagerEmail] = useState(ticket.managerEmail ?? "");
  const [managerSuggestions, setManagerSuggestions] = useState<GwsUser[]>([]);
  const [managerSuggestionsLoading, setManagerSuggestionsLoading] = useState(false);
  const [showManagerSuggestions, setShowManagerSuggestions] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Live-as-you-type search for Reporting Manager -- same account
  // autocomplete Approvals' Akamai "Clone access from..." box uses, so HR
  // picks a real employee instead of typing a possibly-wrong email by hand.
  useEffect(() => {
    if (managerEmail.trim().length <= 1) {
      setManagerSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      setManagerSuggestionsLoading(true);
      searchHrManagers(managerEmail.trim())
        .then((res) => setManagerSuggestions(res.results))
        .catch(() => setManagerSuggestions([]))
        .finally(() => setManagerSuggestionsLoading(false));
    }, MANAGER_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [managerEmail]);

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
      if (managerEmail && managerEmail !== (ticket.managerEmail ?? "")) body.manager_email = managerEmail;
      return updateHrTicketFields(ticket.issueKey, body);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["hr-tickets"] });
      qc.invalidateQueries({ queryKey: ["hr-ticket", ticket.issueKey] });
      toast.add({ title: "Saved", description: `${ticket.parentKey ?? ticket.issueKey} was updated.` });
      onDone();
    },
    onError: () => {
      toast.add({
        title: "Update failed",
        description: `Couldn't save ${ticket.parentKey ?? ticket.issueKey}. Please try again.`,
      });
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
    if (managerEmail) {
      const parsed = emailSchema.safeParse(managerEmail);
      if (!parsed.success) nextErrors.managerEmail = parsed.error.issues[0].message;
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
  const managerChanged = managerEmail !== (ticket.managerEmail ?? "");

  const canSave = isOnboarding
    ? (employeeChanged && !!employeeEmail) ||
      (personalChanged && !!personalEmail) ||
      (joiningChanged && !!joiningDate) ||
      (managerChanged && !!managerEmail)
    : (lwdChanged && !!lastWorkingDay) || (managerChanged && !!managerEmail);

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
                disabled={!!ticket.employeeEmail}
              />
              {ticket.employeeEmail && (
                <p className="text-xs text-slate-400 dark:text-neutral-500">
                  Already set and in use by the automation -- contact IT to change it.
                </p>
              )}
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

      <Field>
        <FieldContent>
          <FieldLabel htmlFor={`manager-${ticket.issueKey}`}>Reporting Manager</FieldLabel>
          <div className="relative">
            <Input
              id={`manager-${ticket.issueKey}`}
              type="email"
              value={managerEmail}
              onChange={(e) => {
                setManagerEmail(e.target.value);
                setShowManagerSuggestions(true);
                setErrors((prev) => ({ ...prev, managerEmail: "" }));
              }}
              onFocus={() => setShowManagerSuggestions(true)}
              onBlur={() => setTimeout(() => setShowManagerSuggestions(false), 150)}
              placeholder="Search by name or email…"
            />
            {managerSuggestionsLoading && (
              <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
            )}
            {showManagerSuggestions && managerSuggestions.length > 0 && (
              <ul
                className="absolute z-10 mt-1.5 w-full max-h-48 overflow-y-auto rounded-lg border bg-white dark:bg-neutral-900 shadow-lg"
                onMouseDown={(e) => e.preventDefault()}
              >
                {managerSuggestions.map((u) => (
                  <li
                    key={u.email}
                    onClick={() => {
                      setManagerEmail(u.email);
                      setShowManagerSuggestions(false);
                      setErrors((prev) => ({ ...prev, managerEmail: "" }));
                    }}
                    className="flex items-center justify-between gap-3 px-3.5 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50 border-b last:border-b-0"
                  >
                    <span className="text-sm text-slate-700 dark:text-neutral-300 truncate">{u.name}</span>
                    <span className="text-xs text-slate-400 dark:text-neutral-500 truncate">{u.email}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <FieldError errors={errors.managerEmail ? [{ message: errors.managerEmail }] : undefined} />
        </FieldContent>
      </Field>

      <p className="text-xs text-slate-500 dark:text-neutral-400">
        Saving updates this request right away and lets processing continue.
        {isOnboarding && joiningChanged && joiningDate && " Changing the joining date will also reschedule it."}
        {!isOnboarding && lwdChanged && lastWorkingDay && " Changing the last working day will also reschedule it."}
      </p>

      <div className="flex justify-end gap-2">
        <Button variant="outline" size="sm" disabled={mutation.isPending} onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" disabled={!canSave || mutation.isPending} onClick={handleSave}>
          {mutation.isPending ? (
            <>
              <Spinner className="h-3.5 w-3.5" />
              <span className="shimmer">Saving...</span>
            </>
          ) : (
            "Save changes"
          )}
        </Button>
      </div>
    </div>
  );
}

function HrTicketEditDialog({
  ticket,
  open,
  onOpenChange,
}: {
  ticket: HrTicket;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit details</DialogTitle>
          <DialogDescription>
            <span className="font-mono text-xs font-semibold text-slate-600 dark:text-neutral-300">
              {ticket.parentKey ?? ticket.issueKey}
            </span>
            {" · "}
            {ticket.title ?? "Untitled request"}
          </DialogDescription>
        </DialogHeader>
        <div className="mt-4">
          <HrTicketEditForm ticket={ticket} onDone={() => onOpenChange(false)} />
        </div>
      </DialogContent>
    </Dialog>
  );
}

// A quiet label/value pair -- the left rail is transparent for a normal
// field and only turns amber when the field is genuinely missing, so the
// "act on this" signal is reserved for fields that need it instead of every
// row getting an identical decorative icon.
function FieldFact({ label, value, missing }: { label: string; value: string; missing: boolean }) {
  return (
    <div className={cn("min-w-0 border-l-2 pl-3", missing ? "border-amber-400 dark:border-amber-500/60" : "border-transparent")}>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
        {label}
      </p>
      <p
        className={cn(
          "mt-1 break-all text-sm",
          missing ? "font-medium text-amber-600 dark:text-amber-400" : "text-slate-800 dark:text-neutral-200"
        )}
      >
        {value}
      </p>
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
  const [editing, setEditing] = useState(false);

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
          <Spinner className="h-4 w-4" /> <p className="shimmer">Loading the latest details from Jira...</p>
        </div>
      )}
      {isError && !isLoading && (
        <div className="flex flex-col items-center justify-center gap-3 py-24 text-sm text-red-600 dark:text-red-400">
          Couldn't load this request from Jira.
          <Button variant="outline" size="sm" onClick={() => refetch()}>
            Retry
          </Button>
        </div>
      )}
      {data && (() => {
        const accent = TYPE_ACCENT[data.type];
        const isOnboarding = data.type === "onboarding";
        const statusIcon = STATUS_ICON[data.status];
        const StatusIcon = statusIcon.icon;
        const priority = data.parentDetails.priority?.trim().toLowerCase() ?? "";
        return (
          <>
            <div className="p-4 sm:p-6 space-y-4 max-w-4xl">
              {/* Record identity -- the one place this page names, colors, and
                  iconifies "who/what this is" once, up front, so every card
                  below can stay quiet and just report facts. */}
              <Card>
                <CardContent className="flex items-start gap-4 py-5">
                  <div
                    className={cn(
                      "flex h-12 w-12 flex-shrink-0 items-center justify-center rounded-full",
                      accent.iconBg,
                      accent.iconColor
                    )}
                  >
                    {isOnboarding ? <UserPlus2 className="h-5 w-5" /> : <UserMinus2 className="h-5 w-5" />}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400">
                          {data.parentKey ?? data.issueKey}
                        </span>
                        <HrTicketTypeBadge type={data.type} />
                        <HrTicketStatusBadge status={data.status} />
                      </div>
                      {data.updatedAt && (
                        <div className="flex shrink-0 items-center gap-2">
                          <div className="text-right">
                            <p className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-neutral-500">
                              Last activity
                            </p>
                            <p className="text-xs text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                              {formatIST(data.updatedAt)}
                            </p>
                          </div>
                          <span
                            className={cn(
                              "flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full",
                              statusIcon.className
                            )}
                          >
                            <StatusIcon className="h-4 w-4" />
                          </span>
                        </div>
                      )}
                    </div>
                    <h2 className="mt-1.5 text-xl font-bold text-slate-900 dark:text-neutral-100 text-balance">
                      {data.title ?? "Untitled request"}
                    </h2>
                  </div>
                </CardContent>
              </Card>

              {/* Employee details is the ONLY card HR ever acts on -- it
                  gets full width and top billing. Jira's own metadata
                  (status/priority/assignee/etc.) is reference-only context
                  nobody on this page acts on, so it's demoted to a
                  collapsed, secondary strip below rather than a second
                  full peer card -- progressive disclosure, not equal
                  weight for unequal importance. */}
              <Card>
                <CardHeader>
                  <CardTitle>Employee details</CardTitle>
                  <CardAction>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={() => setEditing(true)}>
                      <SquarePen className="h-3.5 w-3.5" />
                      Edit details
                    </Button>
                  </CardAction>
                </CardHeader>
                <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  {isOnboarding ? (
                    <>
                      <FieldFact
                        label="Employee Email"
                        value={data.employeeEmail ?? "Not provided yet"}
                        missing={!data.employeeEmail}
                      />
                      <FieldFact
                        label="Personal Email"
                        value={data.personalEmail ?? "Not provided yet"}
                        missing={!data.personalEmail}
                      />
                      <FieldFact
                        label="Date of Joining"
                        value={displayDate(data.joiningDate)}
                        missing={!data.joiningDate}
                      />
                    </>
                  ) : (
                    <FieldFact
                      label="Last Working Day"
                      value={displayDate(data.lastWorkingDay)}
                      missing={!data.lastWorkingDay}
                    />
                  )}
                  <FieldFact
                    label="Reporting Manager"
                    value={data.managerEmail ?? "Not on file"}
                    missing={!data.managerEmail}
                  />
                </CardContent>
              </Card>

              <details className="group rounded-xl bg-white ring-1 ring-slate-200 dark:bg-neutral-900 dark:ring-neutral-800 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 text-sm font-medium text-slate-600 dark:text-neutral-300">
                  <span className="flex items-center gap-2">
                    Jira reference details
                    <Badge variant="ghost" className="border-transparent bg-purple-50 text-purple-700 dark:bg-purple-500/15 dark:text-purple-300">
                      {data.parentDetails.status ?? "--"}
                    </Badge>
                  </span>
                  <ChevronRight className="h-4 w-4 text-slate-400 transition-transform group-open:rotate-90 dark:text-neutral-500" />
                </summary>
                <div className="grid grid-cols-1 gap-4 border-t border-slate-100 px-4 py-4 sm:grid-cols-2 lg:grid-cols-4 dark:border-neutral-800">
                  <div className="min-w-0 border-l-2 border-transparent pl-3">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 dark:text-neutral-500">
                      Priority
                    </p>
                    <p className="mt-1 flex items-center gap-1.5 text-sm text-slate-800 dark:text-neutral-200">
                      <span className={cn("h-2 w-2 rounded-full", PRIORITY_DOT[priority] ?? "bg-slate-400")} />
                      {data.parentDetails.priority ?? "--"}
                    </p>
                  </div>
                  <FieldFact label="Assignee" value={data.parentDetails.assignee ?? "Unassigned"} missing={false} />
                  <FieldFact label="Reporter" value={data.parentDetails.reporter ?? "--"} missing={false} />
                  <FieldFact
                    label="Project"
                    value={
                      data.parentDetails.projectName || data.parentDetails.projectKey
                        ? `${data.parentDetails.projectName ?? ""}${data.parentDetails.projectKey ? ` (${data.parentDetails.projectKey})` : ""}`.trim()
                        : "--"
                    }
                    missing={false}
                  />
                  <FieldFact
                    label="Created"
                    value={data.parentDetails.createdAt ? formatIST(data.parentDetails.createdAt) : "--"}
                    missing={false}
                  />
                </div>
              </details>

              <Card>
                <CardHeader>
                  <CardTitle>Timeline</CardTitle>
                </CardHeader>
                <CardContent>
                  <StageTimeline stages={data.stages ?? []} />
                </CardContent>
              </Card>
            </div>

            <HrTicketEditDialog ticket={data} open={editing} onOpenChange={setEditing} />
          </>
        );
      })()}
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
  const accent = TYPE_ACCENT[ticket.type];
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "flex w-full items-start gap-3 rounded-xl px-3.5 py-3 text-left transition-colors",
        selected
          ? "bg-blue-50 ring-1 ring-blue-300 dark:bg-blue-500/10 dark:ring-blue-500/40"
          : "ring-1 ring-transparent hover:bg-slate-50 dark:hover:bg-neutral-800/50"
      )}
    >
      <div
        className={cn(
          "mt-0.5 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full",
          accent.iconBg,
          accent.iconColor
        )}
      >
        {isOnboarding ? <UserPlus2 className="h-4 w-4" /> : <UserMinus2 className="h-4 w-4" />}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="font-mono text-[11px] font-semibold text-blue-600 dark:text-blue-400">
            {ticket.parentKey ?? ticket.issueKey}
          </span>
          <HrTicketTypeBadge type={ticket.type} />
          <HrTicketStatusBadge status={ticket.status} />
          {ticket.status === "waiting_for_hr_update" && <Badge variant="destructive">Action Required</Badge>}
        </div>
        <p className="mt-0.5 text-[15px] font-semibold text-slate-900 dark:text-neutral-100 truncate">
          {ticket.title ?? "Untitled request"}
        </p>
        <div className="mt-1 flex items-center gap-2 flex-wrap text-xs text-slate-400 dark:text-neutral-500">
          {ticket.updatedAt && <span>Last activity: {formatIST(ticket.updatedAt)}</span>}
          {ticket.missingFields.length > 0 && (
            <Badge variant="ghost" className="border-transparent bg-amber-50 text-amber-700 dark:bg-amber-500/15 dark:text-amber-300">
              {ticket.missingFields.length} missing
            </Badge>
          )}
        </div>
      </div>
      <ChevronRight
        className={cn(
          "mt-1.5 h-4 w-4 flex-shrink-0 transition-colors",
          selected ? "text-blue-500" : "text-slate-300 dark:text-neutral-700"
        )}
      />
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
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              placeholder="Search by employee name, email, or request ID..."
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
          <Button size="sm" variant="outline" className="h-8 text-xs" onClick={clearFilters}>
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
            "w-full lg:w-[500px] xl:w-[540px] flex-shrink-0 overflow-y-auto border-r border-slate-200 bg-white p-3 dark:border-neutral-800 dark:bg-neutral-900",
            selectedIssueKey && "hidden lg:block"
          )}
        >
          {isLoading && (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-20 w-full rounded-xl" />
              ))}
            </div>
          )}
          {isError && <ErrorState error={error as Error} onRetry={refetch} />}
          {!isLoading && !isError && data?.results.length === 0 && <EmptyState message="No requests match this view." />}
          <div className="space-y-1">
            {data?.results.map((ticket) => (
              <HrTicketListItem
                key={ticket.issueKey}
                ticket={ticket}
                selected={ticket.issueKey === selectedIssueKey}
                onSelect={() => setSelectedIssueKey(ticket.issueKey)}
              />
            ))}
          </div>
          {data && (
            <div className="px-1 py-3">
              <Pagination
                page={currentPage}
                pageSize={filters.pageSize ?? 25}
                total={data.total}
                onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
                itemLabel="requests"
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
              <EmptyState message="Select a request to view and update its details." />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
