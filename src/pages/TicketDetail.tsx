import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, AlertTriangle, ExternalLink } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageSpinner } from "@/components/ui/spinner";
import { ErrorState } from "@/components/ui/error-state";
import { Badge, OutcomeBadge, SeverityBadge, FlowBadge } from "@/components/ui/badge";
import { getTicketDetail, getAnomalies } from "@/api";
import { formatIST } from "@/lib/utils";
import type { AuditEvent } from "@/api";

type TimelineItem =
  | { kind: "comment"; author: string; body: string; createdAt: string }
  | { kind: "audit"; event: AuditEvent; isAnomaly: boolean };

function buildTimeline(
  comments: { author: string; body: string; createdAt: string }[],
  auditEvents: AuditEvent[],
  anomalyKeys: Set<string>
): TimelineItem[] {
  const items: TimelineItem[] = [
    ...comments.map((c) => ({ kind: "comment" as const, ...c })),
    ...auditEvents.map((e) => ({
      kind: "audit" as const,
      event: e,
      isAnomaly: anomalyKeys.has(`${e.flow}:${e.outcome}`),
    })),
  ];
  return items.sort((a, b) => {
    const ta = a.kind === "comment" ? a.createdAt : a.event.timestamp;
    const tb = b.kind === "comment" ? b.createdAt : b.event.timestamp;
    return new Date(ta).getTime() - new Date(tb).getTime();
  });
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

  if (ticket.isLoading) return <PageSpinner />;
  if (ticket.isError) return <ErrorState error={ticket.error as Error} onRetry={ticket.refetch} />;

  const t = ticket.data!;
  const anomalyKeys = new Set(
    (anomalies.data?.anomalies ?? [])
      .filter((a) => a.issueKey === issueKey)
      .map((a) => `${a.flow}:${a.outcome}`)
  );
  const timeline = buildTimeline(t.comments, t.auditEvents, anomalyKeys);

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <div className="flex items-center gap-3">
        <Link
          to="/tickets"
          className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          Tickets
        </Link>
        <span className="text-muted-foreground">/</span>
        <span className="font-mono font-semibold">{issueKey}</span>
      </div>

      {/* Header card */}
      <Card>
        <CardContent className="p-6">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <FlowBadge flow={t.flow} />
                <OutcomeBadge outcome={t.currentStatus} />
                {t.hasError && <Badge variant="error">Has Error</Badge>}
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-1 text-sm">
                <div>
                  <span className="text-muted-foreground">Employee: </span>
                  {t.employeeEmail ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Manager: </span>
                  {t.managerEmail ?? "—"}
                </div>
                <div>
                  <span className="text-muted-foreground">Last updated: </span>
                  {formatIST(t.updatedAt)}
                </div>
              </div>
            </div>
            <a
              href={t.jiraUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-sm text-primary hover:underline shrink-0"
            >
              Open in Jira <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Timeline */}
      <Card>
        <CardHeader>
          <CardTitle>Audit timeline</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {timeline.length === 0 ? (
            <p className="p-6 text-sm text-muted-foreground">No activity recorded.</p>
          ) : (
            <ol className="relative ml-6 border-l border-border">
              {timeline.map((item, i) => (
                <li key={i} className="mb-0 pb-0">
                  {item.kind === "comment" ? (
                    <div className="ml-6 py-4 pr-6">
                      <div className="absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border border-border bg-card" />
                      <div className="flex items-baseline gap-2 mb-1">
                        <span className="text-xs font-medium">{item.author}</span>
                        <span className="text-xs text-muted-foreground">{formatIST(item.createdAt)}</span>
                        <Badge variant="muted">Comment</Badge>
                      </div>
                      <p className="text-sm whitespace-pre-wrap text-foreground/80">{item.body}</p>
                    </div>
                  ) : (
                    <div className="ml-6 py-4 pr-6">
                      <div
                        className={`absolute -left-1.5 mt-1.5 h-3 w-3 rounded-full border ${
                          item.isAnomaly
                            ? "border-amber-400 bg-amber-100"
                            : "border-primary/40 bg-primary/10"
                        }`}
                      />
                      <div className="flex flex-wrap items-center gap-2 mb-1">
                        <SeverityBadge severity={item.event.severity} />
                        <FlowBadge flow={item.event.flow} />
                        <OutcomeBadge outcome={item.event.outcome} />
                        {item.isAnomaly && (
                          <span className="flex items-center gap-1 text-xs font-medium text-amber-600">
                            <AlertTriangle className="h-3 w-3" /> Anomaly
                          </span>
                        )}
                        <span className="ml-auto text-xs text-muted-foreground">
                          {formatIST(item.event.timestamp)}
                        </span>
                      </div>
                      {item.event.error && (
                        <p className="mt-1 rounded bg-destructive/5 px-2 py-1 font-mono text-xs text-destructive">
                          {item.event.error}
                        </p>
                      )}
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
