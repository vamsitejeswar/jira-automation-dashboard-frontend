import { useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { MailCheck, CheckCircle2, Ban, Clock, XCircle, AlertOctagon } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Empty } from "@/components/ui/empty";
import { FlowBadge } from "@/components/ui/badge";
import { getApprovals } from "@/api";
import type { Approval, ApprovalStatus } from "@/api";
import { formatIST } from "@/lib/utils";

const STATUS_CONFIG: Record<ApprovalStatus, { label: string; icon: React.ElementType; bg: string; color: string; dot: string }> = {
  pending:      { label: "Pending",      icon: Clock,        bg: "#fffbeb", color: "#b45309", dot: "#d97706" },
  approved:     { label: "Approved",     icon: CheckCircle2, bg: "#f0fdf4", color: "#15803d", dot: "#16a34a" },
  ignored:      { label: "Ignored",      icon: Ban,          bg: "#f8fafc", color: "#475569", dot: "#94a3b8" },
  no_response:  { label: "No Response",  icon: AlertOctagon, bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626" },
  failed:       { label: "Failed",       icon: XCircle,      bg: "#fef2f2", color: "#b91c1c", dot: "#dc2626" },
};

const STATUS_TABS: { key: ApprovalStatus | "all"; label: string }[] = [
  { key: "all", label: "All" },
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "ignored", label: "Ignored" },
  { key: "no_response", label: "No Response" },
  { key: "failed", label: "Failed" },
];

function StatusBadge({ status }: { status: ApprovalStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span
      className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold"
      style={{ background: cfg.bg, color: cfg.color }}
    >
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function ApprovalsSkeleton() {
  return (
    <div className="px-8 py-6">
      <div className="rounded-xl border bg-white overflow-hidden shadow-sm">
        <div className="space-y-3.5 px-5 py-4">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-4 w-20 rounded-full" />
              <Skeleton className="h-3 flex-1" />
              <Skeleton className="h-3 w-32" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function ApprovalRow({ approval }: { approval: Approval }) {
  return (
    <li className="flex flex-wrap items-center gap-3 px-5 py-3.5 hover:bg-slate-50 transition-colors">
      <Link
        to={`/tickets/${approval.issueKey}`}
        className="shrink-0 font-mono text-xs font-bold text-blue-600 hover:underline"
      >
        {approval.issueKey}
      </Link>
      <FlowBadge flow={approval.flow} />
      <StatusBadge status={approval.status} />
      <span className="flex-1 min-w-0 text-xs text-slate-600 truncate">
        {approval.employeeEmail ?? "—"}
        {approval.managerEmail && <span className="text-slate-400"> → {approval.managerEmail}</span>}
      </span>
      {(approval.status === "pending" || approval.status === "no_response") && approval.reminderCount > 0 && (
        <span className="shrink-0 text-[11px] text-slate-400">
          {approval.reminderCount} reminder{approval.reminderCount !== 1 ? "s" : ""} sent
        </span>
      )}
      <span className="shrink-0 tabular-nums text-xs text-slate-400">
        {formatIST(approval.updatedAt)}
      </span>
    </li>
  );
}

export function Approvals() {
  const [status, setStatus] = useState<ApprovalStatus | "all">("all");

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["approvals", status],
    queryFn: () => getApprovals(status === "all" ? undefined : status),
  });

  return (
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

        {/* Status tabs */}
        <div className="mt-5 flex flex-wrap gap-2">
          {STATUS_TABS.map((tab) => (
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
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="px-8 py-6">
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
            {data!.results.length === 0 ? (
              <Empty message="No approvals to show for this filter" />
            ) : (
              <ul className="divide-y divide-slate-100">
                {data!.results.map((a) => (
                  <ApprovalRow key={a.issueKey} approval={a} />
                ))}
              </ul>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
