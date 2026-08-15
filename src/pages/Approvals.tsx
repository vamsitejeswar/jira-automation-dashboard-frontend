import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  MailCheck, CheckCircle2, Ban, Clock, XCircle, AlertOctagon, HelpCircle, Search, ChevronUp, ChevronDown, MoreHorizontal,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { FlowBadge } from "@/components/app/badges";
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from "@/components/ui/tooltip";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog, AlertDialogContent, AlertDialogHeader, AlertDialogFooter,
  AlertDialogTitle, AlertDialogDescription, AlertDialogCancel, AlertDialogAction,
} from "@/components/ui/alert-dialog";
import { toast } from "@/components/ui/toast";
import { getApprovals, approveMailApproval, rejectMailApproval, searchGwsUsers } from "@/api";
import type { Approval, ApprovalStatus, GwsUser } from "@/api";
import { formatIST } from "@/lib/utils";

const CLONE_SEARCH_DEBOUNCE_MS = 250;

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; icon: React.ElementType; bg: string; color: string; dot: string; description: string }> = {
  pending: {
    label: "Pending", icon: Clock, bg: "#fffbeb", color: "#b45309", dot: "#d97706",
    description: "Decision email sent and being actively tracked -- will be reminded up to 3 times if the manager doesn't respond.",
  },
  approved: {
    label: "Approved", icon: CheckCircle2, bg: "#f0fdf4", color: "#15803d", dot: "#16a34a",
    description: "The manager (or an admin, manually) already made a decision -- access cloned, no action needed, or the Drive transfer completed.",
  },
  ignored: {
    label: "Ignored", icon: Ban, bg: "#f8fafc", color: "#475569", dot: "#94a3b8",
    description: "No email was ever sent -- required info (manager or employee email) was missing on the ticket.",
  },
  no_response: {
    label: "No Response", icon: AlertOctagon, bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626",
    description: "Reminded 3 times with no reply -- the automation gave up and commented on the ticket instead.",
  },
  failed: {
    label: "Failed", icon: XCircle, bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626",
    description: "Sending the decision email itself failed (e.g. an SMTP error) -- no email ever reached the manager.",
  },
  // The email went out but there's no live pending_approvals record for it
  // (e.g. sent by a revision deployed before reminder-tracking existed) --
  // it'll never be reminded or auto-given-up, and can't be manually
  // approved/rejected from here either (see ApprovalRow's Actions gating).
  untracked: {
    label: "Untracked", icon: HelpCircle, bg: "#f8fafc", color: "#64748b", dot: "#94a3b8",
    description: "Email sent before this dashboard's reminder-tracking existed -- won't be reminded or actionable here. The manager's original email link still works fine.",
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
];

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <span
            className="inline-flex cursor-default items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
            style={{ background: cfg.bg, color: cfg.color }}
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

function ApprovalsSkeleton() {
  return (
    <div>
      <div className="rounded-xl bg-white shadow-sm overflow-hidden">
        <div className="px-5 py-4 space-y-1.5">
          <Skeleton className="h-4 w-44" />
          <Skeleton className="h-3 w-24" />
        </div>
        <div className="space-y-3.5 px-5 pb-5">
          {[...Array(8)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-3 w-[8%]" />
              <Skeleton className="h-5 w-[10%] rounded-full" />
              <Skeleton className="h-5 w-[12%] rounded-full" />
              <Skeleton className="h-3 w-[24%]" />
              <Skeleton className="h-3 w-[24%]" />
              <Skeleton className="h-3 w-[14%]" />
              <Skeleton className="h-6 w-[10%] rounded-md" />
            </div>
          ))}
        </div>
      </div>
    </div>
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
  if (flow === "drive_transfer") return kind === "approve" ? "Accept (transfer to manager)" : "Send to common address";
  return kind === "approve" ? "Clone access from…" : "No action required";
}

function actionDialogCopy(approval: Approval, kind: ActionKind): { title: string; description: string } {
  const who = approval.employeeEmail ?? "this employee";
  if (approval.flow === "drive_transfer") {
    return kind === "approve"
      ? {
          title: "Accept Drive Transfer",
          description: `Transfers ${who}'s Drive files to their manager (${approval.managerEmail ?? "no manager set"}) right now -- same as the manager clicking "Accept" in the decision email.`,
        }
      : {
          title: "Send to common address",
          description: `Transfers ${who}'s Drive files to the common/fallback address instead of the manager, right now -- same as the manager clicking the common-address link.`,
        };
  }
  return kind === "approve"
    ? {
        title: "Clone Akamai / ZScaler access",
        description: `Clones the entered account's group access onto ${who} right now -- same as the manager submitting the setup form. Enter the Google Workspace account to clone from below.`,
      }
    : {
        title: "No action required",
        description: `Marks this Akamai Access request as needing no additional group access for ${who} -- same as the manager clicking "No Action Required".`,
      };
}

// A ticket sent 10 minutes ago and one waiting 5 days used to look
// identical unless you read the reminder count -- this is the first thing
// that should catch the eye instead of something you have to compute.
function WaitingAge({ since }: { since: string | null }) {
  if (!since) return null;
  const days = Math.floor((Date.now() - new Date(since).getTime()) / 86_400_000);
  if (days < 1) return <span className="text-[11px] font-medium text-slate-400">just now</span>;
  const urgent = days >= 3;
  return (
    <span className={`text-[11px] font-semibold ${urgent ? "text-red-600" : "text-slate-400"}`}>
      waiting {days}d
    </span>
  );
}

function ApprovalRow({ approval, onAction }: { approval: Approval; onAction: (a: PendingAction) => void }) {
  return (
    <tr className="hover:bg-slate-50 transition-colors">
      <td className="px-5 py-3 whitespace-nowrap">
        <Link
          to={`/tickets/${approval.issueKey}`}
          className="font-mono text-xs font-bold text-blue-600 hover:underline"
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
          {approval.status === "pending" && <WaitingAge since={approval.updatedAt} />}
        </div>
      </td>
      <td className="px-5 py-3 text-xs text-slate-600 max-w-56 truncate">{approval.employeeEmail ?? "—"}</td>
      <td className="px-5 py-3 text-xs text-slate-600 max-w-56 truncate">{approval.managerEmail ?? "—"}</td>
      <td className="px-5 py-3 tabular-nums text-xs text-slate-400 whitespace-nowrap">
        {formatIST(approval.updatedAt)}
      </td>
      <td className="px-5 py-3 whitespace-nowrap">
        {approval.status === "pending" ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" size="sm" className="h-7 gap-1.5 text-xs">
                Actions
                {approval.reminderCount > 0 && (
                  <span className="inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-slate-100 px-1 text-[10px] font-semibold text-slate-600">
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
        ) : (
          <span className="text-xs text-slate-300">—</span>
        )}
      </td>
    </tr>
  );
}

export function Approvals() {
  const [status, setStatus] = useState<ApprovalStatus | "all">("all");
  const [search, setSearch] = useState("");
  const [sortField, setSortField] = useState<SortField>("updatedAt");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null);
  const [cloneFromEmail, setCloneFromEmail] = useState("");
  const [cloneSuggestions, setCloneSuggestions] = useState<GwsUser[]>([]);
  const [cloneSuggestionsLoading, setCloneSuggestionsLoading] = useState(false);
  const [showCloneSuggestions, setShowCloneSuggestions] = useState(false);

  const qc = useQueryClient();
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["approvals", status],
    queryFn: () => getApprovals(status === "all" ? undefined : status),
  });

  const actionMutation = useMutation({
    mutationFn: ({ approval, kind }: PendingAction) => {
      const body = approval.flow === "akamai_access" && kind === "approve" ? { cloneFromEmail: cloneFromEmail.trim() } : {};
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
    },
    onError: (_err, vars) => {
      toast.add({ title: "Action failed", description: `Couldn't ${vars.kind} ${vars.approval.issueKey}.` });
    },
  });

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
      actionMutation.reset();
    }
  }

  function toggleSort(field: SortField) {
    if (sortField === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else { setSortField(field); setSortDir("asc"); }
  }

  const q = search.trim().toLowerCase();
  const filtered = (data?.results ?? []).filter((a) =>
    !q ||
    a.issueKey.toLowerCase().includes(q) ||
    (a.employeeEmail && a.employeeEmail.toLowerCase().includes(q)) ||
    (a.managerEmail && a.managerEmail.toLowerCase().includes(q))
  );
  const rows = [...filtered].sort((a, b) => {
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
    <div className="min-h-full bg-slate-50">
      {/* Page header */}
      <div className="border-b bg-white px-8 py-6">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900 tracking-tight">Approvals</h1>
            <p className="mt-1 text-sm text-slate-500">
              Mail Approval tickets — Akamai Access setup and Drive Transfer requests awaiting or resolved
              via a manager decision email.
            </p>
          </div>
        </div>

        {/* Status tabs + search */}
        <div className="mt-5 flex flex-wrap items-center gap-3">
          <div className="flex flex-wrap gap-2">
            {STATUS_TABS.map((tab) => {
              const button = (
                <button
                  key={tab.key}
                  onClick={() => setStatus(tab.key)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-semibold transition-colors ${
                    status === tab.key
                      ? "bg-blue-600 text-white"
                      : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                  }`}
                >
                  {tab.label}
                </button>
              );
              if (tab.key === "all") return button;
              return (
                <Tooltip key={tab.key}>
                  <TooltipTrigger render={button} />
                  <TooltipContent>{STATUS_CONFIG[tab.key].description}</TooltipContent>
                </Tooltip>
              );
            })}
          </div>
          <div className="relative ml-auto w-64">
            <Search className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <Input
              type="text"
              placeholder="Search issue, employee, manager..."
              className="h-9 pl-9 text-xs"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="px-4 py-4">
        {isLoading ? (
          <ApprovalsSkeleton />
        ) : isError ? (
          <ErrorState error={error as Error} onRetry={refetch} />
        ) : (
          <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
            <div className="px-5 py-4 flex items-center gap-2">
              <MailCheck className="h-4 w-4 text-slate-400" />
              <h2 className="text-sm font-semibold text-slate-700">Mail Approval tickets</h2>
              <span className="ml-auto text-xs text-slate-400 font-medium">{data!.total} total</span>
            </div>
            {rows.length === 0 ? (
              <EmptyState message="No approvals to show for this filter" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/70">
                    <tr>
                      {COLUMNS.map((col) => (
                        <th
                          key={col.key}
                          className="px-5 py-3 text-left select-none cursor-pointer group whitespace-nowrap"
                          onClick={() => toggleSort(col.key)}
                        >
                          <div className="flex items-center gap-1.5">
                            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500 group-hover:text-slate-700 transition-colors">
                              {col.label}
                            </span>
                            <SortIcon field={col.key} />
                          </div>
                        </th>
                      ))}
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">
                        Actions
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {rows.map((a) => (
                      <ApprovalRow key={a.issueKey} approval={a} onAction={setPendingAction} />
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
                        className="absolute z-10 mt-1.5 w-full max-h-48 overflow-y-auto rounded-lg border bg-white shadow-lg"
                        onMouseDown={(e) => e.preventDefault()}
                      >
                        {cloneSuggestions.map((u) => (
                          <li
                            key={u.email}
                            onClick={() => { setCloneFromEmail(u.email); setShowCloneSuggestions(false); }}
                            className="flex items-center justify-between gap-3 px-3.5 py-2 cursor-pointer hover:bg-slate-50 border-b last:border-b-0"
                          >
                            <span className="text-sm text-slate-700 truncate">{u.name}</span>
                            <span className="text-xs text-slate-400 truncate">{u.email}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
                {errorMessage && (
                  <p className="mt-2 text-xs text-red-600">{errorMessage}</p>
                )}
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction
                    variant={pendingAction.kind === "reject" ? "destructive" : "default"}
                    disabled={actionMutation.isPending || (needsCloneInput && !cloneFromEmail.trim())}
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
    </div>
    </TooltipProvider>
  );
}
