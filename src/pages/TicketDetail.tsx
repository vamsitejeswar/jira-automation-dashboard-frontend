import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowLeft, AlertTriangle, ExternalLink, MailOpen, ShieldCheck, HardDrive, Key, Database, ToggleLeft, Lock, UserX,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { ErrorState } from "@/components/ui/error-state";
import { Badge } from "@/components/ui/badge";
import { OutcomeBadge, SeverityBadge, FlowBadge, isSelfEvidentError } from "@/components/app/badges";
import { StageTimeline } from "@/components/app/StageTimeline";
import { getTicketDetail, getAnomalies } from "@/api";
import { formatIST } from "@/lib/utils";
import type { AuditEvent } from "@/api";

const FLOW_META: Record<string, { icon: React.ElementType; color: string }> = {
  gws_mailbox:           { icon: MailOpen,    color: "#0284c7" },
  akamai_access:         { icon: ShieldCheck, color: "#7c3aed" },
  drive_transfer:        { icon: HardDrive,   color: "#d97706" },
  gws_suspend:           { icon: Lock,        color: "#ea580c" },
  scheduled_credentials: { icon: Key,         color: "#16a34a" },
  data_transfer:         { icon: Database,    color: "#ea580c" },
  toggle_change:         { icon: ToggleLeft,  color: "#64748b" },
  ad_m365_disable:       { icon: UserX,       color: "#b91c1c" },
  software_revoke:       { icon: ShieldCheck, color: "#0891b2" },
};

const SEVERITY_ROW: Record<string, string> = {
  ERROR:   "border-l-red-500 bg-red-50/40 dark:bg-red-950/40",
  WARNING: "border-l-amber-400 bg-amber-50/30 dark:bg-amber-950/40",
  INFO:    "border-l-slate-200 dark:border-l-neutral-800",
};

const AVATAR_COLORS = ["#2563eb", "#7c3aed", "#059669", "#d97706", "#dc2626", "#0891b2", "#db2777", "#4338ca"];

function colorForName(name: string) {
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

type AuditItem = { event: AuditEvent; isAnomaly: boolean };
type TimelineItem =
  | { kind: "comment"; author: string; body: string; createdAt: string; related: AuditItem[] }
  | { kind: "audit"; event: AuditEvent; isAnomaly: boolean };

// A comment and the audit event it caused are logged by two different
// systems (Jira's own comment timestamp vs. this app's write_audit call) a
// moment apart, never at the exact same instant -- "close enough" is
// whichever unclaimed event is nearest in time, within this window.
const RELATED_EVENT_WINDOW_MS = 30_000;

function buildTimeline(
  comments: { author: string; body: string; createdAt: string }[],
  auditEvents: AuditEvent[],
  anomalyKeys: Set<string>
): TimelineItem[] {
  const auditItems: AuditItem[] = auditEvents
    .map((e) => ({ event: e, isAnomaly: anomalyKeys.has(`${e.flow}:${e.outcome}`) }))
    // Plain INFO events just restate what the automation's own comment
    // (always posted alongside) already says in plain English -- only
    // worth surfacing when they carry signal a comment doesn't: an
    // anomaly, or a real WARNING/ERROR severity.
    .filter((a) => a.isAnomaly || a.event.severity !== "INFO");

  // Pair each audit event with whichever comment is closest in time overall,
  // not just whichever comment happens to be processed first. Two distinct
  // actions logged moments apart (e.g. "suspended" then a separate "no
  // manager set" check) both land within 30s of the FIRST comment too --
  // scanning comments in order and grabbing every unclaimed event in range
  // let the earlier comment steal the later action's event. Sorting all
  // candidate pairs by time delta first, then claiming smallest-delta-first,
  // ensures each event goes to the comment it's actually closest to.
  const candidates: { commentIdx: number; auditIdx: number; delta: number }[] = [];
  comments.forEach((c, ci) => {
    const cTime = new Date(c.createdAt).getTime();
    auditItems.forEach((a, ai) => {
      const delta = Math.abs(new Date(a.event.timestamp).getTime() - cTime);
      if (delta <= RELATED_EVENT_WINDOW_MS) candidates.push({ commentIdx: ci, auditIdx: ai, delta });
    });
  });
  candidates.sort((x, y) => x.delta - y.delta);

  const relatedByComment: AuditItem[][] = comments.map(() => []);
  const claimed = new Set<number>();
  for (const { commentIdx, auditIdx } of candidates) {
    if (claimed.has(auditIdx)) continue;
    claimed.add(auditIdx);
    relatedByComment[commentIdx].push(auditItems[auditIdx]);
  }

  const commentItems: TimelineItem[] = comments.map((c, ci) => ({
    kind: "comment" as const,
    ...c,
    related: relatedByComment[ci].sort(
      (a, b) => new Date(a.event.timestamp).getTime() - new Date(b.event.timestamp).getTime()
    ),
  }));

  const orphanAuditItems: TimelineItem[] = auditItems
    .filter((_, idx) => !claimed.has(idx))
    .map((a) => ({ kind: "audit" as const, ...a }));

  const items: TimelineItem[] = [...commentItems, ...orphanAuditItems];
  // Newest first -- the most recent action (what someone opening this ticket
  // actually wants to see first) shows immediately, not after scrolling past
  // the full history.
  return items.sort((a, b) => {
    const ta = a.kind === "comment" ? a.createdAt : a.event.timestamp;
    const tb = b.kind === "comment" ? b.createdAt : b.event.timestamp;
    return new Date(tb).getTime() - new Date(ta).getTime();
  });
}

const JIRA_STATUS_STYLE: Record<string, string> = {
  closed:      "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  done:        "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  resolved:    "bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-900/50",
  "in progress": "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50",
  wip:         "bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-900/50",
  open:        "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  "waiting for support": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
  "waiting for approval": "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-900/50",
};

function statusStyle(status: string) {
  return JIRA_STATUS_STYLE[status.trim().toLowerCase()] ?? "bg-slate-100 text-slate-600 border-slate-200 dark:bg-neutral-800 dark:text-neutral-400 dark:border-neutral-800";
}

function TicketDetailSkeleton() {
  return (
    <div className="px-4 py-4 space-y-4">
      <div className="rounded-xl bg-white dark:bg-neutral-900 shadow-sm p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-3 flex-1">
            <div className="flex items-center gap-2">
              <Skeleton className="h-5 w-24 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
            </div>
            <div className="grid grid-cols-2 gap-x-8 gap-y-2">
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-44" />
              <Skeleton className="h-4 w-36" />
            </div>
          </div>
          <Skeleton className="h-4 w-24 flex-shrink-0" />
        </div>
      </div>
      <div className="rounded-xl bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4">
          <Skeleton className="h-5 w-32" />
        </div>
        <div className="space-y-5 px-6 pb-6">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-5 w-14 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-5 w-20 rounded-full" />
              <Skeleton className="h-3 w-24 ml-auto" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export function TicketDetail() {
  const { issueKey } = useParams<{ issueKey: string }>();

  const ticket = useQuery({
    queryKey: ["ticket", issueKey],
    queryFn: () => getTicketDetail(issueKey!),
    enabled: !!issueKey,
  });

  const anomalies = useQuery({
    queryKey: ["anomalies", 30, false],
    queryFn: () => getAnomalies({ days: 30 }),
  });

  const t = ticket.data ?? null;
  // t.flow is null for a real ticket this automation never logged anything
  // for (see StageSchema comment) -- fall back to the same generic look
  // FLOW_META[unknownKey] already produces via its own ?? chains.
  const flowMeta = t?.flow ? FLOW_META[t.flow] : undefined;
  const anomalyKeys = new Set(
    (anomalies.data?.anomalies ?? [])
      .filter((a) => a.issueKey === issueKey)
      .map((a) => `${a.flow}:${a.outcome}`)
  );
  const timeline = t ? buildTimeline(t.comments, t.auditEvents, anomalyKeys) : [];

  return (
    <div className="min-h-full bg-slate-50 dark:bg-neutral-950">
      {/* Breadcrumb — always visible */}
      <div className="border-b bg-white dark:bg-neutral-900 px-8 py-6 flex items-center gap-2">
        <Link
          to="/tickets"
          className="flex items-center gap-1.5 text-sm text-slate-500 dark:text-neutral-400 hover:text-slate-800 dark:hover:text-neutral-200 transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Tickets
        </Link>
        <span className="text-slate-300 dark:text-neutral-600">/</span>
        <span className="font-mono font-semibold text-slate-800 dark:text-neutral-200">{issueKey}</span>
      </div>

      {ticket.isLoading ? (
        <TicketDetailSkeleton />
      ) : ticket.isError ? (
        <div className="px-8 py-6">
          <ErrorState error={ticket.error as Error} onRetry={ticket.refetch} />
        </div>
      ) : (
      <div className="px-4 py-4 space-y-4">
      {/* Header card */}
      <div className="rounded-xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="h-1.5" style={{ background: flowMeta?.color ?? "#64748b" }} />
        <div className="p-6 flex items-start justify-between gap-6">
          <div className="flex items-start gap-4">
            <div
              className="flex h-11 w-11 items-center justify-center rounded-xl flex-shrink-0"
              style={{ background: (flowMeta?.color ?? "#64748b") + "18" }}
            >
              {(() => {
                const FlowIcon = flowMeta?.icon ?? ToggleLeft;
                return <FlowIcon className="h-5 w-5" style={{ color: flowMeta?.color ?? "#64748b" }} />;
              })()}
            </div>
            <div className="space-y-2">
              <div className="flex items-center gap-2.5 flex-wrap">
                {t!.title && (
                  <h1 className="text-base font-bold text-slate-900 dark:text-neutral-100 leading-snug">{t!.title}</h1>
                )}
                {t!.jiraStatus && (
                  <span className={`rounded-md border px-2.5 py-1 text-xs font-bold uppercase tracking-wide ${statusStyle(t!.jiraStatus)}`}>
                    {t!.jiraStatus}
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {t!.flow && <FlowBadge flow={t!.flow} />}
                {t!.currentStatus ? (
                  <OutcomeBadge outcome={t!.currentStatus} />
                ) : (
                  <Badge variant="ghost">Not tracked by automation</Badge>
                )}
                {t!.hasError && t!.currentStatus && !isSelfEvidentError(t!.currentStatus) && (
                  <Badge variant="destructive">Has Error</Badge>
                )}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm text-slate-700 dark:text-neutral-300">
                <div>
                  <span className="text-slate-500 dark:text-neutral-400">Employee: </span>
                  {t!.employeeName ? `${t!.employeeName} — ` : ""}
                  {t!.employeeEmail ?? "—"}
                </div>
                <div>
                  <span className="text-slate-500 dark:text-neutral-400">Manager: </span>
                  {t!.managerEmail ?? "—"}
                </div>
                {t!.createdAt && (
                  <div>
                    <span className="text-slate-500 dark:text-neutral-400">Created: </span>
                    {formatIST(t!.createdAt)}
                  </div>
                )}
                <div>
                  <span className="text-slate-500 dark:text-neutral-400">Last updated: </span>
                  {formatIST(t!.updatedAt)}
                </div>
              </div>
            </div>
          </div>
          <a
            href={t!.jiraUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 text-sm font-semibold text-blue-600 hover:underline shrink-0"
          >
            Open in Jira <ExternalLink className="h-3.5 w-3.5" />
          </a>
        </div>
      </div>

      {/* Stage timeline -- simplified Created -> ... -> Closed digest, read
          at a glance before the full raw audit log below. */}
      <div className="rounded-xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden p-6">
        <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300 mb-4">Stage timeline</h2>
        <StageTimeline stages={t!.stages ?? []} />
      </div>

      {/* Timeline */}
      <div className="rounded-xl border bg-white dark:bg-neutral-900 shadow-sm overflow-hidden">
        <div className="px-6 py-4">
          <h2 className="text-sm font-semibold text-slate-700 dark:text-neutral-300">Audit timeline</h2>
        </div>
        {timeline.length === 0 ? (
          <p className="px-6 pb-6 text-sm text-slate-500 dark:text-neutral-400">No activity recorded.</p>
        ) : (
          <ul className="divide-y divide-slate-100 dark:divide-neutral-800">
            {timeline.map((item, i) => {
              if (item.kind === "comment") {
                const avatarColor = colorForName(item.author);
                return (
                  <li key={i} className="flex items-start gap-3 px-6 py-5 hover:bg-slate-50/70 dark:hover:bg-neutral-800/50 transition-colors">
                    <div
                      className="flex h-9 w-9 items-center justify-center rounded-full flex-shrink-0 text-xs font-bold text-white"
                      style={{ background: avatarColor }}
                    >
                      {initials(item.author)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-sm font-bold text-slate-900 dark:text-neutral-100">{item.author}</span>
                        <span className="ml-auto text-xs text-slate-400 dark:text-neutral-500 whitespace-nowrap">{formatIST(item.createdAt)}</span>
                      </div>
                      <div className="mt-2.5 rounded-lg bg-slate-50 dark:bg-neutral-950 px-4 py-3">
                        <p className="text-sm leading-relaxed whitespace-pre-wrap text-slate-700 dark:text-neutral-300">{item.body}</p>
                      </div>
                      {/* Audit events tied to this specific comment -- shown
                          attached to it, not as a separate floating row, so
                          it's unambiguous which comment they explain. */}
                      {item.related.length > 0 && (
                        <div className="mt-2 space-y-1.5 border-l-2 border-slate-200 dark:border-neutral-800 pl-3">
                          {item.related.map((a, ri) => (
                            <div key={ri} className="flex flex-wrap items-center gap-1.5">
                              <SeverityBadge severity={a.event.severity} />
                              <OutcomeBadge outcome={a.event.outcome} />
                              {a.isAnomaly && (
                                <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                                  <AlertTriangle className="h-3 w-3" /> Anomaly
                                </span>
                              )}
                              {a.event.error && (
                                <span className="font-mono text-xs text-red-600 dark:text-red-400">{a.event.error}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              }

              const flowMeta = FLOW_META[item.event.flow];
              const FlowIcon = flowMeta?.icon ?? ToggleLeft;
              const rowStyle = item.isAnomaly
                ? "border-l-amber-400 bg-amber-50/30"
                : (SEVERITY_ROW[item.event.severity] ?? "border-l-slate-200");

              return (
                <li key={i} className={`flex items-start gap-3 border-l-4 px-6 py-4 hover:brightness-[0.98] transition-colors ${rowStyle}`}>
                  <div
                    className="flex h-8 w-8 items-center justify-center rounded-full flex-shrink-0"
                    style={{ background: (flowMeta?.color ?? "#64748b") + "18" }}
                  >
                    <FlowIcon className="h-4 w-4" style={{ color: flowMeta?.color ?? "#64748b" }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <SeverityBadge severity={item.event.severity} />
                      <FlowBadge flow={item.event.flow} />
                      <OutcomeBadge outcome={item.event.outcome} />
                      {item.isAnomaly && (
                        <span className="flex items-center gap-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                          <AlertTriangle className="h-3 w-3" /> Anomaly
                        </span>
                      )}
                      <span className="ml-auto text-xs text-slate-400 dark:text-neutral-500">
                        {formatIST(item.event.timestamp)}
                      </span>
                    </div>
                    {item.event.error && (
                      <p className="mt-2 rounded-md bg-red-50 border border-red-100 dark:bg-red-950/40 dark:border-red-900/50 px-2 py-1 font-mono text-xs text-red-600 dark:text-red-400">
                        {item.event.error}
                      </p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
      </div>
      )}
    </div>
  );
}
