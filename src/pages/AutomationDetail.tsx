import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, MailOpen, ShieldCheck, HardDrive, Key, Lock, UserX, Clock,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { EmptyState } from "@/components/app/empty-state";
import { OutcomeBadge, SeverityBadge, isSelfEvidentError } from "@/components/app/badges";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { getAutomationDetail } from "@/api";
import { formatIST } from "@/lib/utils";

// One place holding what a non-technical admin actually needs to know about
// each automation -- plain-language name and sentence, not the raw flow
// string. This is the glossary the audit called for, applied where an
// admin's first question about a flow is "what does this even do."
const AUTOMATION_META: Record<string, { label: string; icon: React.ElementType; color: string; blurb: string }> = {
  gws_mailbox: {
    label: "Mailbox Creation", icon: MailOpen, color: "#2563eb",
    blurb: "Creates a new employee's Google Workspace account when their onboarding ticket's Google Workspace subtask is created.",
  },
  scheduled_credentials: {
    label: "Send Login Credentials", icon: Key, color: "#16a34a",
    blurb: "Emails a new hire their temporary password once their joining date arrives, when it was in the future at mailbox-creation time.",
  },
  akamai_access: {
    label: "Akamai / ZScaler Access", icon: ShieldCheck, color: "#7c3aed",
    blurb: "Emails a new hire's manager a one-click link to clone Akamai/ZScaler access from an existing employee, or mark none needed.",
  },
  gws_suspend: {
    label: "Account Suspension", icon: Lock, color: "#ea580c",
    blurb: "Suspends a departing employee's Google Workspace account once their last working day arrives. Never deletes it.",
  },
  drive_transfer: {
    label: "Drive Transfer", icon: HardDrive, color: "#d97706",
    blurb: "Emails a departing employee's manager a one-click link to accept their Drive files, or send them to a shared fallback address.",
  },
  ad_m365_disable: {
    label: "AD / M365 Disable", icon: UserX, color: "#b91c1c",
    blurb: "Disables a departing employee's on-premise Active Directory and Microsoft 365/Entra ID accounts and emails their manager.",
  },
};

function AutomationDetailSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl bg-white dark:bg-slate-900 shadow-sm p-6 space-y-3">
        <Skeleton className="h-6 w-56" />
        <Skeleton className="h-4 w-96" />
      </div>
      <div className="grid grid-cols-4 gap-4">
        {[...Array(4)].map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)}
      </div>
    </div>
  );
}

export function AutomationDetail() {
  const { flow } = useParams<{ flow: string }>();
  const meta = flow ? AUTOMATION_META[flow] : undefined;

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["automation-detail", flow],
    queryFn: () => getAutomationDetail(flow!),
    enabled: !!flow,
  });

  return (
    <div className="min-h-full bg-slate-50 dark:bg-slate-950">
      <div className="border-b bg-white dark:bg-slate-900 px-8 py-6 flex items-center gap-2">
        <Link to="/schedules" className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 transition-colors">
          <ArrowLeft className="h-4 w-4" />
          System Health
        </Link>
        <span className="text-slate-300 dark:text-slate-600">/</span>
        <span className="font-semibold text-slate-800 dark:text-slate-200">{meta?.label ?? flow}</span>
      </div>

      {isLoading ? (
        <AutomationDetailSkeleton />
      ) : isError ? (
        <div className="px-8 py-6"><ErrorState error={error as Error} onRetry={refetch} /></div>
      ) : (
        <div className="px-4 py-4 space-y-4">
          {/* What this is, is it on */}
          <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="h-1.5" style={{ background: meta?.color ?? "#64748b" }} />
            <div className="p-6 flex items-start gap-4">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0" style={{ background: (meta?.color ?? "#64748b") + "18" }}>
                {(() => { const Icon = meta?.icon ?? Clock; return <Icon className="h-5 w-5" style={{ color: meta?.color ?? "#64748b" }} />; })()}
              </div>
              <div className="flex-1">
                <h1 className="text-lg font-bold text-slate-900 dark:text-slate-100">{meta?.label ?? flow}</h1>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400 max-w-2xl">{meta?.blurb ?? "No description available for this flow."}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {data!.toggles.map((t) => (
                    <span
                      key={t.name}
                      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                        t.value ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      <span className={`h-1.5 w-1.5 rounded-full ${t.value ? "bg-emerald-500" : "bg-slate-400"}`} />
                      {t.name} {t.value ? "on" : "off"}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
            <div className="rounded-xl border bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
              <p className="text-2xl font-bold text-slate-900 dark:text-slate-100 tabular-nums">
                {data!.successRate === null ? "—" : `${data!.successRate}%`}
              </p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Success rate (last 30 days)</p>
            </div>
            <div className="rounded-xl border bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
              <p className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">{data!.doneCount}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Succeeded</p>
            </div>
            <div className="rounded-xl border bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
              <p className="text-2xl font-bold text-red-600 dark:text-red-400 tabular-nums">{data!.failedCount}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Failed</p>
            </div>
            <div className="rounded-xl border bg-white dark:bg-slate-900 px-5 py-4 shadow-sm">
              <p className="text-2xl font-bold text-amber-600 dark:text-amber-400 tabular-nums">{data!.inFlightCount}</p>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">Still in flight</p>
            </div>
          </div>

          {/* Recent runs */}
          <div className="rounded-xl border bg-white dark:bg-slate-900 shadow-sm overflow-hidden">
            <div className="px-5 py-4 border-b">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Recent runs</h2>
              <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">{data!.ticketCount} tickets touched this flow in the last 30 days</p>
            </div>
            {data!.recentEvents.length === 0 ? (
              <EmptyState message="No runs logged for this automation in the last 30 days" />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="border-b bg-slate-50/70 dark:bg-slate-800/50">
                    <tr>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Time</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Ticket</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400 whitespace-nowrap">Status</th>
                      <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">Detail</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                    {data!.recentEvents.map((e, i) => (
                      <tr key={i} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                        <td className="px-5 py-3 tabular-nums text-xs text-slate-500 dark:text-slate-400 whitespace-nowrap">{formatIST(e.timestamp)}</td>
                        <td className="px-5 py-3 whitespace-nowrap">
                          {e.issueKey ? (
                            <HoverCard>
                              <HoverCardTrigger render={<Link to={`/tickets/${e.issueKey}`} className="font-mono text-xs font-bold text-blue-600 hover:underline" />}>
                                {e.issueKey}
                              </HoverCardTrigger>
                              <HoverCardContent>
                                <p className="text-sm font-semibold text-slate-800 dark:text-slate-200 truncate">{e.title ?? e.issueKey}</p>
                                <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{formatIST(e.timestamp)}</p>
                              </HoverCardContent>
                            </HoverCard>
                          ) : <span className="text-xs text-slate-400 dark:text-slate-500">—</span>}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-1.5">
                            <OutcomeBadge outcome={e.outcome} />
                            {!isSelfEvidentError(e.outcome) && <SeverityBadge severity={e.severity} />}
                          </div>
                        </td>
                        <td className="px-5 py-3 text-xs text-slate-600 dark:text-slate-400 max-w-96 truncate">{e.error ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
