import {
  MOCK_KPIS,
  MOCK_TICKETS,
  MOCK_TICKET_DETAIL,
  MOCK_TOGGLES,
  MOCK_ANOMALIES,
  MOCK_SCHEDULED_JOBS,
  MOCK_AUDIT_LOG,
  MOCK_EMPLOYEE_DB,
} from "./mock-data";
import type {
  TicketsResponse,
  TicketDetail,
  Kpis,
  Toggle,
  AnomalySummary,
  AnomalyEvent,
  ScheduledJob,
  AuditLogResponse,
  EmployeeSearchResponse,
} from "./types";
import type { TicketFilters, KpiFilters, AnomalyFilters, AuditLogFilters } from "./client";

// Simulate network latency so loading states are visible during development.
function delay<T>(value: T, ms = 350): Promise<T> {
  return new Promise((res) => setTimeout(() => res(value), ms));
}

let _toggles = [...MOCK_TOGGLES];

export function getTickets(filters: TicketFilters = {}): Promise<TicketsResponse> {
  let results = [...MOCK_TICKETS];

  if (filters.flow) results = results.filter((t) => t.flow === filters.flow);
  if (filters.q) {
    const q = filters.q.toLowerCase();
    results = results.filter(
      (t) =>
        t.issueKey.toLowerCase().includes(q) ||
        t.employeeEmail?.toLowerCase().includes(q) ||
        t.managerEmail?.toLowerCase().includes(q)
    );
  }
  if (filters.from) results = results.filter((t) => t.updatedAt >= filters.from!);
  if (filters.to) results = results.filter((t) => t.updatedAt <= filters.to! + "T23:59:59Z");

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 25;
  const total = results.length;
  const paged = results.slice((page - 1) * pageSize, page * pageSize);

  return delay({ total, page, results: paged });
}

export function getTicketDetail(issueKey: string): Promise<TicketDetail> {
  // Return the detailed mock for WOH-1000; for everything else, build one from the summary list.
  if (issueKey === "WOH-1000") return delay(MOCK_TICKET_DETAIL);

  const summary = MOCK_TICKETS.find((t) => t.issueKey === issueKey);
  if (!summary) return Promise.reject(new Error(`Ticket ${issueKey} not found`));

  const detail: TicketDetail = {
    ...summary,
    jiraUrl: `https://wohlig.atlassian.net/browse/${issueKey}`,
    comments: [
      {
        author: "Automation Bot",
        body: `Ticket picked up for flow: ${summary.flow}`,
        createdAt: summary.updatedAt,
      },
    ],
    auditEvents: MOCK_AUDIT_LOG.filter((e) => e.issueKey === issueKey),
  };
  return delay(detail);
}

export function getKpis(_filters: KpiFilters = {}): Promise<Kpis> {
  return delay(MOCK_KPIS);
}

export function getToggles(): Promise<{ toggles: Toggle[] }> {
  return delay({ toggles: _toggles });
}

export function updateToggle(name: string, value: boolean): Promise<{ toggles: Toggle[] }> {
  _toggles = _toggles.map((t) =>
    t.name === name
      ? { ...t, value, lastChangedAt: new Date().toISOString(), lastChangedBy: "admin@wohlig.com" }
      : t
  );
  return delay({ toggles: _toggles }, 200);
}

export function getAnomalies(filters: AnomalyFilters = {}): Promise<AnomalySummary> {
  const days = Math.min(filters.days ?? 7, 30);

  let anomalies = [...MOCK_ANOMALIES.anomalies];
  if (filters.from) anomalies = anomalies.filter((a) => a.timestamp >= filters.from!);
  if (filters.to)   anomalies = anomalies.filter((a) => a.timestamp <= filters.to! + "T23:59:59Z");

  const allEvents: AnomalyEvent[] = MOCK_AUDIT_LOG
    .filter((e) => {
      if (filters.from && e.timestamp < filters.from!) return false;
      if (filters.to   && e.timestamp > filters.to! + "T23:59:59Z") return false;
      return true;
    })
    .map<AnomalyEvent>((e) => ({
      timestamp: e.timestamp,
      severity:  e.severity,
      flow:      e.flow,
      outcome:   e.outcome,
      issueKey:  e.issueKey,
      reason:    null,
      error:     e.error,
    }));

  const summary: AnomalySummary = {
    ...MOCK_ANOMALIES,
    days,
    anomalies,
    totalAnomalies: anomalies.length,
    allEvents: filters.includeNormal ? allEvents : MOCK_ANOMALIES.allEvents,
  };
  return delay(summary);
}

export function getScheduledJobs(): Promise<{ jobs: ScheduledJob[] }> {
  return delay({ jobs: MOCK_SCHEDULED_JOBS });
}

export function getEmployeeProgress(email: string): Promise<EmployeeSearchResponse> {
  const normalized = email.toLowerCase().trim();
  const records = MOCK_EMPLOYEE_DB[normalized] ?? [];
  return delay({ email: normalized, records }, 400);
}

export function getAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  let results = [...MOCK_AUDIT_LOG];

  if (filters.flow) results = results.filter((e) => e.flow === filters.flow);
  if (filters.severity) results = results.filter((e) => e.severity === filters.severity);
  if (filters.from) results = results.filter((e) => e.timestamp >= filters.from!);
  if (filters.to) results = results.filter((e) => e.timestamp <= filters.to! + "T23:59:59Z");

  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 50;
  const total = results.length;
  const paged = results.slice((page - 1) * pageSize, page * pageSize);

  return delay({ total, page, results: paged });
}
