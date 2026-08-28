import { useState, useEffect, useRef } from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Circle,
  MinusCircle,
  ChevronRight,
  UserCircle2,
  ArrowUpRight,
  MailOpen,
  ShieldCheck,
  HardDrive,
  Key,
  Database,
  UserX,
  ClipboardList,
  Lock,
  ToggleLeft,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Spinner } from "@/components/ui/spinner";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import { Accordion, AccordionItem, AccordionTrigger, AccordionPanel } from "@/components/ui/accordion";
import { StageTimeline } from "@/components/app/StageTimeline";
import { getEmployeeProgress, getTicketDetail } from "@/api";
import type { EmployeeProgress, FlowStep, EmployeeSearchResult } from "@/api";
import { formatIST, titleCase } from "@/lib/utils";
import { useEmployeeSuggestions } from "@/lib/useEmployeeSuggestions";
import { useTheme } from "@/providers/theme-provider";

// How long to wait after the user stops typing before firing a live
// suggestions request -- short enough to feel instant, long enough that a
// fast typist doesn't fire one request per keystroke.
const SUGGESTIONS_DEBOUNCE_MS = 250;

// bg/color/border are inline `style` values (not Tailwind classes), so they
// can't pick up `dark:` variants -- dark* fields are the equivalents swapped
// in when the resolved theme is dark, mirroring the emerald/amber/red/slate
// palette used by the Tailwind-based badges elsewhere in the app.
const STEP_CONFIG = {
  done:        { icon: CheckCircle2, color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0", darkColor: "#6ee7b7", darkBg: "#022c22", darkBorder: "#065f46", label: "Done" },
  in_progress: { icon: Clock,        color: "#d97706", bg: "#fffbeb", border: "#fde68a", darkColor: "#fcd34d", darkBg: "#451a03", darkBorder: "#92400e", label: "In Progress" },
  pending:     { icon: Circle,       color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", darkColor: "#94a3b8", darkBg: "#1e293b", darkBorder: "#334155", label: "Pending" },
  failed:      { icon: XCircle,      color: "#dc2626", bg: "#fef2f2", border: "#fecaca", darkColor: "#fca5a5", darkBg: "#450a0a", darkBorder: "#991b1b", label: "Failed" },
  skipped:     { icon: MinusCircle,  color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0", darkColor: "#94a3b8", darkBg: "#1e293b", darkBorder: "#334155", label: "Skipped" },
};

const FLOW_META: Record<string, { label: string; icon: React.ElementType; color: string }> = {
  gws_mailbox:           { label: "Google Workspace Mailbox", icon: MailOpen,   color: "#2563eb" },
  akamai_access:         { label: "Akamai / ZScaler Access",  icon: ShieldCheck, color: "#7c3aed" },
  drive_transfer:        { label: "Google Drive Transfer",     icon: HardDrive,  color: "#d97706" },
  gws_suspend:           { label: "Account Suspension",         icon: Lock,       color: "#ea580c" },
  scheduled_credentials: { label: "Send Login Credentials",   icon: Key,        color: "#16a34a" },
  data_transfer:         { label: "Data Transfer",            icon: Database,    color: "#0891b2" },
  ad_m365_disable:       { label: "AD / M365 Disable",         icon: UserX,       color: "#b91c1c" },
  toggle_change:         { label: "Toggle Change",             icon: ToggleLeft, color: "#64748b" },
  manual_task:           { label: "Manual Task",               icon: ClipboardList, color: "#64748b" },
  software_revoke:       { label: "Software Access Revoke",   icon: ShieldCheck, color: "#0891b2" },
};

const STATUS_CONFIG = {
  completed:   { label: "Completed",   bg: "#f0fdf4", color: "#15803d", darkBg: "#022c22", darkColor: "#6ee7b7", dot: "#16a34a" },
  in_progress: { label: "In Progress", bg: "#fffbeb", color: "#b45309", darkBg: "#451a03", darkColor: "#fcd34d", dot: "#d97706" },
  failed:      { label: "Failed",      bg: "#fef2f2", color: "#b91c1c", darkBg: "#450a0a", darkColor: "#fca5a5", dot: "#dc2626" },
  pending:     { label: "Pending",     bg: "#f8fafc", color: "#475569", darkBg: "#1e293b", darkColor: "#94a3b8", dot: "#94a3b8" },
};

// Lazily fetches the one ticket's stage timeline the first time its
// accordion panel opens -- AccordionPanel unmounts its children when closed
// (no keepMounted), so this component simply not existing until then IS the
// lazy trigger. Shares the ["ticket", issueKey] query cache/staleTime with
// TicketDetail.tsx's own query for the same ticket, so visiting one and then
// expanding the other doesn't double-fetch.
function StepStageTimeline({ issueKey }: { issueKey: string }) {
  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ["ticket", issueKey],
    queryFn: () => getTicketDetail(issueKey),
  });

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 py-3 text-sm text-slate-500 dark:text-neutral-400">
        <Spinner className="h-4 w-4" /> Loading stages…
      </div>
    );
  }
  if (isError) {
    return (
      <div className="flex items-center justify-between gap-2 py-3 text-sm text-red-600 dark:text-red-400">
        Failed to load stages.
        <Button variant="outline" size="sm" onClick={() => refetch()}>Retry</Button>
      </div>
    );
  }
  return <StageTimeline stages={data?.stages ?? []} className="pt-2" />;
}

function StepRow({ step }: { step: FlowStep }) {
  const cfg = STEP_CONFIG[step.status];
  const flow = FLOW_META[step.flow];
  const Icon = cfg.icon;
  const FlowIcon = flow?.icon ?? Circle;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const rowBody = (
    <>
      <div
        className="flex h-8 w-8 items-center justify-center rounded-lg flex-shrink-0"
        style={{ background: flow?.color + "18" }}
      >
        <FlowIcon className="h-4 w-4" style={{ color: flow?.color }} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="text-sm font-semibold text-slate-800 dark:text-neutral-200">
            {step.label ?? flow?.label ?? step.flow}
          </span>
          <div className="flex items-center gap-1.5">
            {step.outcome && (
              <span className="font-mono text-[11px] bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 rounded px-1.5 py-0.5 text-slate-600 dark:text-neutral-400">
                {titleCase(step.outcome)}
              </span>
            )}
            <span
              className="flex items-center gap-1 text-xs font-semibold"
              style={{ color: dark ? cfg.darkColor : cfg.color }}
            >
              <Icon className="h-3.5 w-3.5" />
              {cfg.label}
            </span>
          </div>
        </div>
        <div className="mt-1.5 flex items-center gap-3 flex-wrap">
          {step.completedAt && (
            <span className="text-xs text-slate-500 dark:text-neutral-400">{formatIST(step.completedAt)}</span>
          )}
          {step.issueKey && (
            <Link
              to={`/tickets/${step.issueKey}`}
              onClick={(e) => e.stopPropagation()}
              className="inline-flex items-center gap-0.5 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline"
            >
              {step.issueKey}
              <ChevronRight className="h-3 w-3" />
            </Link>
          )}
        </div>
      </div>
    </>
  );

  const style = {
    background: dark ? cfg.darkBg : cfg.bg,
    border: `1px solid ${dark ? cfg.darkBorder : cfg.border}`,
    borderLeft: `3px solid ${dark ? cfg.darkColor : cfg.color}`,
  };

  // No real ticket behind this step at all (the flow simply hasn't started
  // yet, so there isn't even an issueKey) -- nothing to expand. A manual_task
  // step (e.g. "Admin Support", "Laptop Handover") DOES have a real ticket
  // and IS expandable -- GET /tickets/{issueKey} returns a real ticket with a
  // placeholder "Awaiting update" stage for these, not a 404, since the
  // ticket itself exists even though this automation never logs anything
  // for it.
  if (!step.issueKey) {
    return (
      <div style={style} className="rounded-lg p-3.5 flex items-start gap-3">
        {rowBody}
      </div>
    );
  }

  return (
    <Accordion className="rounded-lg overflow-hidden" style={style}>
      <AccordionItem value="stages" className="border-b-0">
        <AccordionTrigger className="p-3.5 items-start gap-3 w-full text-left">
          {rowBody}
        </AccordionTrigger>
        <AccordionPanel className="px-3.5 pb-3.5">
          <div className="rounded-lg bg-white dark:bg-neutral-900 border border-slate-200 dark:border-neutral-800 p-4 ml-[2.75rem]">
            <StepStageTimeline issueKey={step.issueKey} />
          </div>
        </AccordionPanel>
      </AccordionItem>
    </Accordion>
  );
}

function ProgressRing({ steps }: { steps: FlowStep[] }) {
  const done = steps.filter(s => s.status === "done").length;
  const failed = steps.filter(s => s.status === "failed").length;
  const total = steps.length;
  const pct = total ? Math.round((done / total) * 100) : 0;

  const r = 28;
  const circ = 2 * Math.PI * r;
  const doneArc = (done / total) * circ;
  const failedArc = (failed / total) * circ;

  return (
    <div className="flex items-center gap-3">
      <div className="relative flex-shrink-0">
        <svg width="72" height="72" className="-rotate-90">
          <circle cx="36" cy="36" r={r} fill="none" stroke="#e2e8f0" strokeWidth="6" />
          {done > 0 && (
            <circle
              cx="36" cy="36" r={r}
              fill="none" stroke="#16a34a" strokeWidth="6"
              strokeDasharray={`${doneArc} ${circ - doneArc}`}
              strokeLinecap="round"
            />
          )}
          {failed > 0 && (
            <circle
              cx="36" cy="36" r={r}
              fill="none" stroke="#dc2626" strokeWidth="6"
              strokeDasharray={`${failedArc} ${circ - failedArc}`}
              strokeDashoffset={-doneArc}
              strokeLinecap="round"
            />
          )}
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-base font-bold text-slate-800 dark:text-neutral-200 tabular-nums leading-none">{pct}%</span>
        </div>
      </div>
      <div className="text-xs space-y-1">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-emerald-500 inline-block" />
          <span className="text-slate-600 dark:text-neutral-400">{done} of {total} Done</span>
        </div>
        {failed > 0 && (
          <div className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-500 inline-block" />
            <span className="text-slate-600 dark:text-neutral-400">{failed} Failed</span>
          </div>
        )}
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-slate-300 inline-block" />
          <span className="text-slate-500 dark:text-neutral-400">{total - done - failed} Pending</span>
        </div>
      </div>
    </div>
  );
}

function RecordCard({ record, showEmail }: { record: EmployeeProgress; showEmail: boolean }) {
  const statusCfg = STATUS_CONFIG[record.overallStatus];
  const isOnboarding = record.type === "onboarding";
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  return (
    <div className="rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden">
      {/* Colored top strip */}
      <div
        className="h-1"
        style={{
          background: isOnboarding
            ? "linear-gradient(90deg, #2563eb, #60a5fa)"
            : "linear-gradient(90deg, #7c3aed, #a78bfa)",
        }}
      />

      {/* Header */}
      <div className="px-5 pt-4 pb-3 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3 flex-1 min-w-0">
          <div className="min-w-0 flex-1">
            <Tooltip>
              <TooltipTrigger
                render={
                  <p className="text-base font-bold text-slate-900 dark:text-neutral-100 truncate cursor-default">
                    {record.title ?? (isOnboarding ? "Onboarding" : "Offboarding")}
                  </p>
                }
              />
              <TooltipContent>{record.title ?? (isOnboarding ? "Onboarding" : "Offboarding")}</TooltipContent>
            </Tooltip>
            <div className="mt-1 flex items-center gap-1.5 flex-wrap">
              <span
                className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide"
                style={{
                  background: isOnboarding ? (dark ? "#172554" : "#eff6ff") : (dark ? "#2e1065" : "#f5f3ff"),
                  color: isOnboarding ? (dark ? "#93c5fd" : "#2563eb") : (dark ? "#c4b5fd" : "#7c3aed"),
                }}
              >
                {isOnboarding ? "Onboarding" : "Offboarding"}
              </span>
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold"
                style={{ background: dark ? statusCfg.darkBg : statusCfg.bg, color: dark ? statusCfg.darkColor : statusCfg.color }}
              >
                <span
                  className="h-1.5 w-1.5 rounded-full inline-block"
                  style={{ background: statusCfg.dot }}
                />
                {statusCfg.label}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-neutral-400 mt-1">
              {showEmail && <span className="font-medium text-slate-600 dark:text-neutral-400">{record.email}</span>}
              {showEmail && record.startedAt && " — "}
              {record.startedAt && `Started ${formatIST(record.startedAt)}`}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <ProgressRing steps={record.steps} />
          {record.jiraUrl && record.issueKey && (
            <a
              href={record.jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs font-mono font-bold text-blue-600 dark:text-blue-400 hover:underline ml-3"
            >
              {record.issueKey}
              <ArrowUpRight className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {/* Steps */}
      <div className="px-5 pb-5 space-y-2">
        {record.steps.map((step, i) => (
          <StepRow key={i} step={step} />
        ))}
      </div>
    </div>
  );
}

export function EmployeeSearch() {
  const [inputVal, setInputVal] = useState("");
  const [submittedQuery, setSubmittedQuery] = useState("");
  const [showSuggestions, setShowSuggestions] = useState(false);
  const blurTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  const { data, isLoading } = useQuery({
    queryKey: ["employee", submittedQuery],
    queryFn: () => getEmployeeProgress(submittedQuery),
    enabled: submittedQuery.length > 2,
  });

  // Deep-link support -- e.g. the Overview page's global search sends an
  // admin here with ?q=<email> already resolved, so the result shows up
  // immediately instead of making them retype it.
  useEffect(() => {
    const q = searchParams.get("q");
    if (q && q.trim()) {
      setInputVal(q);
      setSubmittedQuery(q.trim());
    }
    // Only meant to run once, off the URL this page was opened with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Live-as-you-type dropdown, shared with Overview's global search box --
  // debounced so a fast typist doesn't fire a request per keystroke; cheap
  // on the backend since it skips the audit log entirely (see GET
  // /api/admin/employees/suggestions).
  const { suggestions, loading: suggestionsLoading } = useEmployeeSuggestions(inputVal, SUGGESTIONS_DEBOUNCE_MS);

  function submit(query: string) {
    const q = query.trim();
    setInputVal(q);
    setSubmittedQuery(q);
    setShowSuggestions(false);
  }

  function pickSuggestion(result: EmployeeSearchResult) {
    setShowSuggestions(false);
    if (result.employeeEmail) {
      submit(result.employeeEmail);
    } else if (result.issueKey) {
      // No employee resolved from this ticket -- nothing to look up here,
      // so go straight to the ticket itself instead.
      navigate(`/tickets/${result.issueKey}`);
    }
  }

  const hasResults = data && data.records.length > 0;
  const onboarding = data?.records.filter(r => r.type === "onboarding") ?? [];
  const offboarding = data?.records.filter(r => r.type === "offboarding") ?? [];
  // Only worth labeling each card with its employee email when the search
  // matched more than one -- a single match already names them in the
  // identity bar above, so repeating it on every card would just be noise.
  const showEmailPerCard = (data?.resolvedEmails.length ?? 0) > 1;

  return (
    <TooltipProvider delay={200}>
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      {/* Page header */}
      <div className="border-b bg-white dark:bg-neutral-900 px-6 min-h-20 flex items-center">
        {/* Search */}
        <div className="flex w-full gap-2 max-w-2xl">
          <div className="relative flex-1">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              type="text"
              placeholder="Email, ticket ID (e.g. VSD-124), or employee name"
              className="w-full h-9 pl-8 pr-8 text-xs"
              value={inputVal}
              onChange={e => { setInputVal(e.target.value); setShowSuggestions(true); }}
              onFocus={() => setShowSuggestions(true)}
              onKeyDown={e => e.key === "Enter" && submit(inputVal)}
              onBlur={() => {
                // Delayed so a click on a dropdown item registers before
                // the dropdown unmounts.
                blurTimeout.current = setTimeout(() => setShowSuggestions(false), 150);
              }}
            />
            {suggestionsLoading && (
              <Spinner className="absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2" />
            )}

            {showSuggestions && suggestions.length > 0 && (
              <ul
                className="absolute z-10 mt-1.5 w-full rounded-lg border bg-white dark:bg-neutral-900 shadow-lg overflow-hidden"
                onMouseDown={e => {
                  // Fires before the input's onBlur -- cancel the pending
                  // blur-close so the click below actually lands.
                  e.preventDefault();
                  if (blurTimeout.current) clearTimeout(blurTimeout.current);
                }}
              >
                {suggestions.map((s, i) => (
                  <li
                    key={i}
                    onClick={() => pickSuggestion(s)}
                    className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50 border-b last:border-b-0"
                  >
                    {s.issueKey && (
                      <span className="shrink-0 font-mono text-xs font-bold text-blue-600 dark:text-blue-400">{s.issueKey}</span>
                    )}
                    <span className="flex-1 min-w-0 truncate text-sm text-slate-700 dark:text-neutral-300">{s.title ?? s.employeeEmail ?? s.issueKey}</span>
                    {s.employeeEmail && (
                      <span className="shrink-0 text-xs text-slate-400 dark:text-neutral-500">{s.employeeEmail}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
          <Button size="sm" onClick={() => submit(inputVal)} className="h-9 text-xs">
            Search
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-6">
            <div className="flex items-center gap-4 rounded-xl border bg-white dark:bg-neutral-900 px-6 py-4">
              <Skeleton className="h-12 w-12 rounded-xl flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-48" />
                <Skeleton className="h-3 w-64" />
              </div>
            </div>
            <div className="grid gap-5 lg:grid-cols-2">
              {[0, 1].map((i) => (
                <div key={i} className="rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden">
                  <div className="px-5 pt-4 pb-3 flex items-center gap-3">
                    <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
                    <div className="space-y-2">
                      <Skeleton className="h-4 w-28" />
                      <Skeleton className="h-3 w-20" />
                    </div>
                  </div>
                  <div className="px-5 pb-5 space-y-2">
                    {[...Array(3)].map((_, j) => (
                      <Skeleton key={j} className="h-14 w-full rounded-lg" />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* No search yet */}
        {!submittedQuery && !isLoading && (
          <div className="flex flex-col items-center justify-center py-24">
            <div className="flex items-center justify-center rounded-2xl mb-4">
             <img src="/search_employee.svg" className="h-52"/>
            </div>
            <p className="text-base font-semibold text-slate-700 dark:text-neutral-300">Search for an employee</p>
            <p className="mt-1 text-sm text-slate-400 dark:text-neutral-500">Enter an email, ticket ID, or name above to see their automation status.</p>
          </div>
        )}

        {/* Employee found */}
        {data && !isLoading && (
          <>
            {/* Identity bar */}
            <div className="mb-6 flex items-center gap-4 rounded-xl border bg-white dark:bg-neutral-900 px-6 py-4">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-blue-600 flex-shrink-0">
                <UserCircle2 className="h-6 w-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-bold text-slate-900 dark:text-neutral-100 text-base truncate">
                  {data.resolvedEmails.length === 1 ? data.resolvedEmails[0] : data.query}
                </p>
                <p className="text-sm text-slate-500 dark:text-neutral-400">
                  {data.resolvedEmails.length === 0
                    ? `No employee matched "${data.query}"`
                    : data.records.length === 0
                    ? "No automation records found"
                    : `${data.records.length} record${data.records.length !== 1 ? "s" : ""} — ${onboarding.length} onboarding, ${offboarding.length} offboarding` +
                      (data.resolvedEmails.length > 1 ? ` across ${data.resolvedEmails.length} employees` : "")}
                </p>
              </div>
              {data.records.length > 0 && (
                <div className="flex gap-4 flex-shrink-0">
                  {onboarding.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-blue-600 dark:text-blue-400 tabular-nums">{onboarding.length}</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Onboarding</p>
                    </div>
                  )}
                  {offboarding.length > 0 && (
                    <div className="text-center">
                      <p className="text-2xl font-bold text-violet-600 tabular-nums">{offboarding.length}</p>
                      <p className="text-xs text-slate-500 dark:text-neutral-400 mt-0.5">Offboarding</p>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Not found */}
            {data.records.length === 0 && (
              <div className="flex flex-col items-center justify-center rounded-xl border border-dashed bg-white dark:bg-neutral-900 py-20">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100 dark:bg-neutral-800 mb-4">
                  <UserCircle2 className="h-7 w-7 text-slate-400 dark:text-neutral-500" />
                </div>
                <p className="text-base font-semibold text-slate-700 dark:text-neutral-300">
                  {data.resolvedEmails.length === 0 ? "No matching employee" : "No records for this employee"}
                </p>
                <p className="mt-1 text-sm text-slate-400 dark:text-neutral-500 max-w-sm text-center">
                  {data.resolvedEmails.length === 0 ? (
                    <>No employee, ticket, or title matched <strong>{data.query}</strong>.</>
                  ) : (
                    <>There are no Jira tickets linked to <strong>{data.resolvedEmails.join(", ")}</strong> yet.</>
                  )}
                </p>
              </div>
            )}

            {/* Results — full-width two-column if both types exist */}
            {hasResults && (
              <div className={`grid gap-5 ${onboarding.length > 0 && offboarding.length > 0 ? "lg:grid-cols-2" : "grid-cols-1"}`}>
                {/* Onboarding */}
                {onboarding.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-blue-500" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                        Onboarding
                      </h2>
                    </div>
                    {onboarding.map((r, i) => <RecordCard key={i} record={r} showEmail={showEmailPerCard} />)}
                  </div>
                )}

                {/* Offboarding */}
                {offboarding.length > 0 && (
                  <div className="space-y-4">
                    <div className="flex items-center gap-2">
                      <div className="h-3 w-3 rounded-full bg-violet-500" />
                      <h2 className="text-sm font-bold uppercase tracking-wider text-slate-600 dark:text-neutral-400">
                        Offboarding
                      </h2>
                    </div>
                    {offboarding.map((r, i) => <RecordCard key={i} record={r} showEmail={showEmailPerCard} />)}
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
    </TooltipProvider>
  );
}
