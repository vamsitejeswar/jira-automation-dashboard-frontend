import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle2, Ban, Clock, XCircle, AlertOctagon, HelpCircle, Search, ChevronUp, ChevronDown, MoreHorizontal, RotateCw, LifeBuoy, CalendarClock,
} from "lucide-react";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FlowBadge } from "@/components/app/badges";
import { SelectField } from "@/components/app/select-field";
import { DatePickerWithRange } from "@/components/ui/date-range-picker";
import { PresetPicker } from "@/components/app/preset-picker";
import { DATE_PRESETS, getPresetDates, type DatePreset } from "@/lib/date-presets";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { getApprovals, approveMailApproval, rejectMailApproval, retryMailApproval, resolveMailApproval, searchGwsUsers } from "@/api";
import type { Approval, ApprovalFilters, ApprovalStatus, GwsUser } from "@/api";
import { formatIST } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";
import { Pagination } from "@/components/app/pagination";

function parseYMD(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

const SEARCH_DEBOUNCE_MS = 400;

const CLONE_SEARCH_DEBOUNCE_MS = 250;

// bg/color are inline `style` values (not Tailwind classes), so they can't
// pick up `dark:` variants -- darkBg/darkColor are the equivalents StatusBadge
// swaps in when the resolved theme is dark, mirroring the same emerald/amber/
// red/slate palette used by the Tailwind-based badges elsewhere in the app.
const STATUS_CONFIG: Record<ApprovalStatus, {
  label: string; icon: React.ElementType; bg: string; color: string; darkBg: string; darkColor: string; dot: string; description: string;
}> = {
  pending: {
    label: "Pending", icon: Clock, bg: "#fffbeb", color: "#b45309", darkBg: "#451a03", darkColor: "#fcd34d", dot: "#d97706",
    description: "Decision email sent. The manager will be reminded up to 3 times if there is no response.",
  },
  approved: {
    label: "Approved", icon: CheckCircle2, bg: "#f0fdf4", color: "#15803d", darkBg: "#022c22", darkColor: "#6ee7b7", dot: "#16a34a",
    description: "The manager or an admin has made a decision. Access was cloned, the Drive transfer completed, or no action was required.",
  },
  ignored: {
    label: "Ignored", icon: Ban, bg: "#f8fafc", color: "#475569", darkBg: "#1e293b", darkColor: "#94a3b8", dot: "#94a3b8",
    description: "No email was sent. Required information such as the manager or employee email was missing from the ticket.",
  },
  no_response: {
    label: "No Response", icon: AlertOctagon, bg: "#fef2f2", color: "#b91c1c", darkBg: "#450a0a", darkColor: "#fca5a5", dot: "#dc2626",
    description: "The manager was reminded 3 times with no reply. Automation has commented on the ticket and stopped.",
  },
  failed: {
    label: "Failed", icon: XCircle, bg: "#fef2f2", color: "#b91c1c", darkBg: "#450a0a", darkColor: "#fca5a5", dot: "#dc2626",
    description: "The decision email failed to send. The manager did not receive it.",
  },
  // The email went out but there's no live pending_approvals record for it
  // (e.g. sent by a revision deployed before reminder-tracking existed) --
  // it'll never be reminded or auto-given-up, and can't be manually
  // approved/rejected from here either (see ApprovalRow's Actions gating).
  untracked: {
    label: "Untracked", icon: HelpCircle, bg: "#f8fafc", color: "#64748b", darkBg: "#1e293b", darkColor: "#94a3b8", dot: "#94a3b8",
    description: "This email was sent before reminder tracking was introduced. It will not be reminded or actioned here. The manager's original link still works.",
  },
  deferred: {
    label: "Deferred", icon: CalendarClock, bg: "#eff6ff", color: "#1d4ed8", darkBg: "#172554", darkColor: "#93c5fd", dot: "#2563eb",
    description: "Waiting for the employee's joining date or last working day. No email has been sent yet.",
  },
};

const STATUS_TABS: { key: ApprovalStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "ignored", label: "Ignored" },
  { key: "no_response", label: "No Response" },
  { key: "failed", label: "Failed" },
  { key: "untracked", label: "Untracked" },
  { key: "deferred", label: "Deferred" },
];

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: dark ? cfg.darkBg : cfg.bg, color: dark ? cfg.darkColor : cfg.color }}
          />
        }
      >
        <Icon className="h-3.5 w-3.5" />
        {cfg.label}
      </TooltipTrigger>
      <TooltipContent>{cfg.description}</TooltipContent>
    </Tooltip>
  );
}

type SortField = "issueKey" | "flow" | "status" | "employeeEmail" | "managerEmail" | "reminderCount" | "updatedAt";

const COLUMNS: { key: SortField; label: string }[] = [
  { key: "issueKey", label: "Issue" },
  { key: "flow", label: "Flow" },
  { key: "status", label: "Status" },
  { key: "employeeEmail", label: "Employee" },
  { key: "managerEmail", label: "Manager" },
  { key: "updatedAt", label: "Updated" },
];

// What a manual action does per flow -- mirrors the exact one-click options
// the manager's own decision email offers (see drive_transfer_approval.py /
// akamai_approval.py), just triggered by an admin instead of the manager.
type ActionKind = "approve" | "reject";
type PendingAction = { approval: Approval; kind: ActionKind };

function actionMenuLabel(flow: string, kind: ActionKind): string {
  if (flow === "drive_transfer") return kind === "approve" ? "Accept (transfer to manager)" : "Not required";
  return kind === "approve" ? "Clone access from…" : "No action required";
}

function actionDialogCopy(approval: Approval, kind: ActionKind): { title: string; description: React.ReactNode } {
  const who = approval.employeeEmail ?? "this employee";
  if (approval.flow === "drive_transfer") {
    return kind === "approve"
      ? {
          title: "Accept Drive Transfer",
          description: (
            <>
              Transfers <strong>{who}</strong>'s Drive files to their manager,{" "}
              <strong>{approval.managerEmail ?? "no manager set"}</strong>, immediately.
            </>
          ),
        }
      : {
          title: "Mark Not Required",
          description: (
            <>
              Marks this Drive Transfer as not required for <strong>{who}</strong> -- no files are moved anywhere,
              same as the manager's own "Not Required" choice.
            </>
          ),
        };
  }
  return kind === "approve"
    ? {
        title: "Clone Akamai / ZScaler Access",
        description: (
          <>
            Clones the selected account's group access onto <strong>{who}</strong> immediately. Enter the Google
            Workspace account to clone from below.
          </>
        ),
      }
    : {
        title: "No action required",
        description: (
          <>
            Marks this Akamai Access request as requiring no additional group access for <strong>{who}</strong>.
          </>
        ),
      };
}

// A ticket sent 10 minutes ago and one waiting 5 days used to look
// identical unless you read the reminder count -- this is the first thing
// that should catch the eye instead of something you have to compute.
function WaitingAge({ since }: { since: string | null }) {
  if (!since) return null;
  const minutesElapsed = Math.floor((Date.now() - new Date(since).getTime()) / 60_000);

  if (minutesElapsed < 1) {
    return <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">just now</span>;
  }
  if (minutesElapsed < 60) {
    return (
      <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">
        waiting {minutesElapsed}m
      </span>
    );
  }
  const hours = Math.floor(minutesElapsed / 60);
  if (hours < 24) {
    return <span className="text-[11px] font-medium text-slate-400 dark:text-neutral-500">waiting {hours}h</span>;
  }
  const days = Math.floor(hours / 24);
  const urgent = days >= 3;
  return (
    <span className={`text-[11px] font-semibold ${urgent ? "text-red-600 dark:text-red-400" : "text-slate-400 dark:text-neutral-500"}`}>
      waiting {days}d
    </span>
  );
}

function ApprovalRow({
  approval, onAction, onRetry, retrying, onResolve, resolving,
}: {
  approval: Approval;
  onAction: (a: PendingAction) => void;
  onRetry: (a: Approval) => void;
  retrying: boolean;
  onResolve: (a: Approval) => void;
  resolving: boolean;
}) {
  return (
    <tr className="hover:bg-slate-50 dark:hover:bg-neutral-800/50 transition-colors">
      <td className="px-5 py-3 whitespace-nowrap">
        <Link
          to={`/tickets/${approval.issueKey}`}
          className="font-mono text-xs font-bold text-blue-600 dark:text-blue-400 hover:underline"
        >
          {approval.issueKey}
        </Link>
      </td>
      <td className="px-5 py-3">
        <FlowBadge flow={approval.flow} />
      </td>
      <td className="px-5 py-3">
        <div className="flex items-center gap-2">
          <StatusBadge status={approval.status} />
          {approval.status === "pending" && !approval.escalated && <WaitingAge since={approval.updatedAt} />}
          {approval.escalated && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="inline-flex cursor-default items-center gap-1 rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-semibold text-blue-700 dark:bg-blue-500/15 dark:text-blue-300">
                    <LifeBuoy className="h-3 w-3" />
                    Escalated to IT
                  </span>
                }
              />
              <TooltipContent>The manager wasn't sure what access to grant and handed this to IT instead of deciding.</TooltipContent>
            </Tooltip>
          )}
        </div>
      </td>
      <td className="px-5 py-3 text-xs max-w-56 truncate">
        {approval.employeeEmail ? (
          <Link
            to={`/employees?q=${encodeURIComponent(approval.employeeEmail)}`}
            className="text-blue-600 dark:text-blue-400 hover:underline"
          >
            {approval.employeeEmail}
          </Link>
        ) : (
          <span className="text-slate-600 dark:text-neutral-400">—</span>
        )}
      </td>
      <td className="px-5 py-3 text-xs text-slate-600 dark:text-neutral-400 max-w-56 truncate">{approval.managerEmail ?? "—"}</td>
      <td className="px-5 py-3 tabular-nums text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">
        {formatIST(approval.updatedAt)}
      </td>
      <td className="px-5 py-3 whitespace-nowrap">
        {approval.status === "pending" ? (
          <div className="flex items-center gap-1.5">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                  Actions
                  {approval.reminderCount > 0 && (
                    <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 dark:bg-neutral-800 px-1 text-[10px] font-semibold text-slate-600 dark:text-neutral-400">
                      {approval.reminderCount}
                    </span>
                  )}
                  <MoreHorizontal className="h-3.5 w-3.5" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuLabel>Manual decision</DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => onAction({ approval, kind: "approve" })}>
                  {actionMenuLabel(approval.flow, "approve")}
                </DropdownMenuItem>
                <DropdownMenuItem variant="destructive" onSelect={() => onAction({ approval, kind: "reject" })}>
                  {actionMenuLabel(approval.flow, "reject")}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
            {approval.escalated && (
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1.5 text-xs"
                disabled={resolving}
                onClick={() => onResolve(approval)}
              >
                {resolving ? <Spinner className="h-3.5 w-3.5" /> : <CheckCircle2 className="h-3.5 w-3.5" />}
                Mark as Done
              </Button>
            )}
          </div>
        ) : approval.status === "failed" ? (
          <Button
            variant="outline"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={retrying}
            onClick={() => onRetry(approval)}
          >
            {retrying ? <Spinner className="h-3.5 w-3.5" /> : <RotateCw className="h-3.5 w-3.5" />}
            Retry
          </Button>
        ) : (
          <span className="text-xs text-slate-300 dark:text-neutral-600">—</span>
        )}
      </td>
    </tr>
  );
}

export function Approvals() {
  const [preset, setPreset] = useState<DatePreset>("7d");
  const [customFrom, setCustomFrom] = useState("");
  const [customTo, setCustomTo] = useState(() => new Date().toISOString().split("T")[0]);
  const [filters, setFilters] = useState<ApprovalFilters>(() => {
    const dates = getPresetDates("7d");
    return { page: 1, pageSize: 25, from: dates.from, to: dates.to };
  });
  const [search, setSearch] = useState("");

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
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [cloneFromEmail, setCloneFromEmail] = useState("");
  const [cloneSuggestions, setCloneSuggestions] = useState<GwsUser[]>([]);
  const [cloneSuggestionsLoading, setCloneSuggestionsLoading] = useState(false);
  const [showCloneSuggestions, setShowCloneSuggestions] = useState(false);
  const [comment, setComment] = useState("");
  const [pendingResolve, setPendingResolve] = useState<Approval | null>(null);
  const [resolveComment, setResolveComment] = useState("");

  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["approvals", filters],
    queryFn: () => getApprovals(filters),
  });

  const actionMutation = useMutation({
    mutationFn: ({ approval, kind }: PendingAction) => {
      const body = {
        ...(approval.flow === "akamai_access" && kind === "approve" ? { cloneFromEmail: cloneFromEmail.trim() } : {}),
        comment: comment.trim(),
      };
      return kind === "approve" ? approveMailApproval(approval.issueKey, body) : rejectMailApproval(approval.issueKey, body);
    },
    onSuccess: (_data, vars) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      toast.add({
        title: vars.kind === "approve" ? "Approved" : "Rejected",
        description: `${vars.approval.issueKey} ${vars.kind === "approve" ? "was approved" : "was rejected"} manually.`,
      });
      setPendingAction(null);
      setCloneFromEmail("");
      setComment("");
    },
    onError: (_err, vars) => {
      toast.add({ title: "Action failed", description: `Couldn't ${vars.kind} ${vars.approval.issueKey}.` });
    },
  });

  const retryMutation = useMutation({
    mutationFn: (approval: Approval) => retryMailApproval(approval.issueKey),
    onSuccess: (data, approval) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      const sent = data.result.status === "setup_email_sent" || data.result.status === "transfer_email_sent";
      toast.add({
        title: sent ? "Resent" : "Retry failed again",
        description: sent
          ? `${approval.issueKey}'s decision email was resent successfully.`
          : `${approval.issueKey} still couldn't be sent (${data.result.status}).`,
      });
    },
    onError: (_err, approval) => {
      toast.add({ title: "Retry failed", description: `Couldn't retry ${approval.issueKey}.` });
    },
  });

  const resolveMutation = useMutation({
    mutationFn: (approval: Approval) => resolveMailApproval(approval.issueKey, resolveComment.trim()),
    onSuccess: (_data, approval) => {
      qc.invalidateQueries({ queryKey: ["approvals"] });
      qc.invalidateQueries({ queryKey: ["kpis"] });
      toast.add({ title: "Resolved", description: `${approval.issueKey} was marked resolved and closed.` });
      setPendingResolve(null);
      setResolveComment("");
    },
    onError: (_err, approval) => {
      toast.add({ title: "Failed to Resolve", description: `Could not resolve ${approval.issueKey}.` });
    },
  });

  function closeResolveDialog(open: boolean) {
    if (!open) {
      setPendingResolve(null);
      setResolveComment("");
      resolveMutation.reset();
    }
  }

  // Live-as-you-type search for "Clone access from..." -- same account
  // autocomplete the manager's own Akamai setup form/email offers, so an
  // admin doesn't have to type a real GWS email blind.
  useEffect(() => {
    const needsInput = pendingAction?.approval.flow === "akamai_access" && pendingAction.kind === "approve";
    if (!needsInput || cloneFromEmail.trim().length <= 1) {
      setCloneSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      setCloneSuggestionsLoading(true);
      searchGwsUsers(cloneFromEmail.trim())
        .then((res) => setCloneSuggestions(res.results))
        .catch(() => setCloneSuggestions([]))
        .finally(() => setCloneSuggestionsLoading(false));
    }, CLONE_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [cloneFromEmail, pendingAction]);

  function closeDialog(open: boolean) {
    if (!open) {
      setPendingAction(null);
      setCloneFromEmail("");
      setCloneSuggestions([]);
      setComment("");
      actionMutation.reset();
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  function applySearch() {
    setFilters((f) => ({ ...f, q: search.trim() || undefined, page: 1 }));
  }

  // Type-and-narrow, same feel as every other search box in the dashboard --
  // Enter/the Search button still apply instantly for anyone who prefers that.
  useEffect(() => {
    const timer = setTimeout(applySearch, SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const rows = [...(data?.results ?? [])].sort((a, b) => {
    const av = a[sortField] ?? "";
    const bv = b[sortField] ?? "";
    const cmp = typeof av === "number" && typeof bv === "number"
      ? av - bv
      : String(av).localeCompare(String(bv));
    return sortDir === "asc" ? cmp : -cmp;
  });

  function SortIcon({ field }: { field: SortField }) {
    if (sortField !== field) return <ChevronUp className="h-3 w-3 opacity-30" />;
    return sortDir === "asc"
      ? <ChevronUp className="h-3 w-3 text-blue-500" />
      : <ChevronDown className="h-3 w-3 text-blue-500" />;
  }

  const needsCloneInput = pendingAction?.approval.flow === "akamai_access" && pendingAction.kind === "approve";
  let errorMessage: string | null = null;
  if (actionMutation.isError) {
    const raw = (actionMutation.error as Error).message;
    try {
      errorMessage = JSON.parse(raw.slice(raw.indexOf(":") + 1).trim())?.detail ?? raw;
    } catch {
      errorMessage = raw;
    }
  }

  return (
    <TooltipProvider delay={200}>
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      {/* Page header */}
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
            }}
          >
            Clear
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4 space-y-4">
        {/* Table controls */}
        <div className="flex flex-wrap gap-2 items-center">
          <div className="relative flex-1 min-w-44">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400 dark:text-neutral-500" />
            <Input
              placeholder="Issue key, employee, or manager email..."
              className="pl-8 h-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && applySearch()}
            />
          </div>
          <SelectField
            options={STATUS_TABS.map((tab) => ({ value: tab.key, label: tab.label }))}
            placeholder="All statuses"
            value={filters.status ?? "all"}
            onValueChange={(v) => setFilters((f) => ({ ...f, status: v === "all" ? undefined : v, page: 1 }))}
            className="w-44 !h-9"
          />
        </div>
        <div className="rounded-xl border bg-white dark:bg-neutral-900 overflow-hidden">
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
          ) : rows.length === 0 ? (
              <EmptyState message="No approvals to show for this filter" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/70 dark:bg-neutral-800/50">
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="px-5 py-3 text-left select-none cursor-pointer group whitespace-nowrap"
                          onClick={() => toggleSort(col.key)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 group-hover:text-slate-700 dark:group-hover:text-neutral-300 transition-colors">
                              {col.label}
                            </span>
                            <SortIcon field={col.key} />
                          </div>
                        </th>
                      ))}
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-neutral-400 whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-neutral-800">
                    {rows.map((a) => (
                      <ApprovalRow
                        key={a.issueKey}
                        approval={a}
                        onAction={setPendingAction}
                        onRetry={(approval) => retryMutation.mutate(approval)}
                        retrying={retryMutation.isPending && retryMutation.variables?.issueKey === a.issueKey}
                        onResolve={(approval) => setPendingResolve(approval)}
                        resolving={resolveMutation.isPending && resolveMutation.variables?.issueKey === a.issueKey}
                      />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
        </div>
        {data && (
          <div className="mt-4">
            <Pagination
              page={filters.page ?? 1}
              pageSize={filters.pageSize ?? 25}
              total={data.total}
              onPageChange={(p) => setFilters((f) => ({ ...f, page: p }))}
              itemLabel="approvals"
            />
          </div>
        )}
      </div>

      {/* Confirm dialog -- shared across every row's action, adapts its
          copy (and, for Akamai approvals, an extra input) to whichever
          action was clicked. */}
      <AlertDialog open={pendingAction !== null} onOpenChange={closeDialog}>
        <AlertDialogContent>
          {pendingAction && (() => {
            const copy = actionDialogCopy(pendingAction.approval, pendingAction.kind);
            return (
              <>
                <AlertDialogHeader>
                  <AlertDialogTitle>{copy.title}</AlertDialogTitle>
                  <AlertDialogDescription>{copy.description}</AlertDialogDescription>
                </AlertDialogHeader>
                {needsCloneInput && (
                  <div className="relative mt-3">
                    <Input
                      autoFocus
                      type="email"
                      placeholder="Search by name or email…"
                      value={cloneFromEmail}
                      onChange={(e) => { setCloneFromEmail(e.target.value); setShowCloneSuggestions(true); }}
                      onFocus={() => setShowCloneSuggestions(true)}
                      onBlur={() => setTimeout(() => setShowCloneSuggestions(false), 150)}
                    />
                    {cloneSuggestionsLoading && (
                      <Spinner className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2" />
                    )}
                    {showCloneSuggestions && cloneSuggestions.length > 0 && (
                      <ul
                        className="absolute z-10 mt-1.5 w-full max-h-48 overflow-y-auto rounded-lg border bg-white dark:bg-neutral-900 shadow-lg"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {cloneSuggestions.map((u) => (
                          <li
                            key={u.email}
                            onClick={() => { setCloneFromEmail(u.email); setShowCloneSuggestions(false); }}
                            className="flex items-center justify-between gap-3 px-3.5 py-2 cursor-pointer hover:bg-slate-50 dark:hover:bg-neutral-800/50 border-b last:border-b-0"
                          >
                            <span className="text-sm text-slate-700 dark:text-neutral-300 truncate">{u.name}</span>
                            <span className="text-xs text-slate-400 dark:text-neutral-500 truncate">{u.email}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                <div className="mt-3">
                  <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-neutral-400">
                    Comment
                  </label>
                  <Textarea
                    placeholder="e.g. Confirmed with the manager directly"
                    rows={3}
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                  />
                </div>
                {errorMessage && (
                  <p className="mt-2 text-xs text-red-600 dark:text-red-400">{errorMessage}</p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant={pendingAction.kind === "reject" ? "destructive" : "default"}
                    disabled={actionMutation.isPending || (needsCloneInput && !cloneFromEmail.trim()) || !comment.trim()}
                    onClick={(e) => {
                      e.preventDefault();
                      actionMutation.mutate(pendingAction);
                    }}
                  >
                    {actionMutation.isPending ? "Working…" : "Confirm"}
                  </AlertDialogAction>
                </AlertDialogFooter>
              </>
            );
          })()}
        </AlertDialogContent>
      </AlertDialog>

      {/* Resolved -- for an escalated ticket IT handled manually outside the
          automation. Requires a comment so the ticket carries real evidence
          of what was actually done, same as Approve/Reject above. */}
      <AlertDialog open={pendingResolve !== null} onOpenChange={closeResolveDialog}>
        <AlertDialogContent>
          {pendingResolve && (
            <>
              <AlertDialogHeader>
                <AlertDialogTitle>Mark as Resolved</AlertDialogTitle>
                <AlertDialogDescription>
                  Closes {pendingResolve.issueKey} without running the clone automation. Use this when IT has already handled the access request manually, for example directly in the GWS console.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <div className="mt-3">
                <label className="mb-1.5 block text-xs font-semibold text-slate-600 dark:text-neutral-400">
                  Comment
                </label>
                <Textarea
                  autoFocus
                  placeholder="e.g. Granted access directly in GWS console"
                  rows={3}
                  value={resolveComment}
                  onChange={(e) => setResolveComment(e.target.value)}
                />
              </div>
              {resolveMutation.isError && (
                <p className="mt-2 text-xs text-red-600 dark:text-red-400">
                  {(() => {
                    const raw = (resolveMutation.error as Error).message;
                    try {
                      return JSON.parse(raw.slice(raw.indexOf(":") + 1).trim())?.detail ?? raw;
                    } catch {
                      return raw;
                    }
                  })()}
                </p>
              )}
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  disabled={resolveMutation.isPending || !resolveComment.trim()}
                  onClick={(e) => {
                    e.preventDefault();
                    resolveMutation.mutate(pendingResolve);
                  }}
                >
                  {resolveMutation.isPending ? "Working…" : "Confirm"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </>
          )}
        </AlertDialogContent>
      </AlertDialog>
    </div>
    </TooltipProvider>
  );
}
