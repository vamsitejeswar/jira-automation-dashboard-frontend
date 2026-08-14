import { z } from "zod";
import {
  TicketsResponseSchema,
  TicketDetailSchema,
  KpisSchema,
  TogglesResponseSchema,
  AnomalySummarySchema,
  ScheduledJobsResponseSchema,
  AuditLogResponseSchema,
  EmployeeSearchResponseSchema,
  type TicketsResponse,
  type TicketDetail,
  type Kpis,
  type Toggle,
  type AnomalySummary,
  type ScheduledJob,
  type AuditLogResponse,
  type EmployeeSearchResponse,
} from "./types";

// Shared-secret token the backend's /api/admin/* routes require as
// "Authorization: Bearer <token>" -- same INTERNAL_TASK_TOKEN the FastAPI
// backend's .env already has. Not real per-admin auth (one shared secret,
// no identity) -- that's a separate, later piece of work. Set via
// VITE_API_TOKEN in .env.local.
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

async function fetchJSON<T>(schema: z.ZodType<T>, url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(API_TOKEN ? { Authorization: `Bearer ${API_TOKEN}` } : {}),
      ...init?.headers,
    },
    credentials: "include",
  });
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`${res.status}: ${msg}`);
  }
  const json = await res.json();
  return schema.parse(json);
}

export interface TicketFilters {
  flow?: string;
  outcome?: string;
  project?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function getTickets(filters: TicketFilters = {}): Promise<TicketsResponse> {
  const params = new URLSearchParams();
  if (filters.flow) params.set("flow", filters.flow);
  if (filters.outcome) params.set("outcome", filters.outcome);
  if (filters.project) params.set("project", filters.project);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 25));
  return fetchJSON(TicketsResponseSchema, `/api/admin/tickets?${params}`);
}

export function getTicketDetail(issueKey: string): Promise<TicketDetail> {
  return fetchJSON(TicketDetailSchema, `/api/admin/tickets/${encodeURIComponent(issueKey)}`);
}

export interface KpiFilters { from?: string; to?: string }

export function getKpis(filters: KpiFilters = {}): Promise<Kpis> {
  const params = new URLSearchParams();
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  return fetchJSON(KpisSchema, `/api/admin/kpis?${params}`);
}

export function getToggles(): Promise<{ toggles: Toggle[] }> {
  return fetchJSON(TogglesResponseSchema, `/api/admin/toggles`);
}

export function updateToggle(name: string, value: boolean): Promise<{ toggles: Toggle[] }> {
  return fetchJSON(TogglesResponseSchema, `/api/admin/toggles`, {
    method: "POST",
    body: JSON.stringify({ name, value }),
  });
}

export interface AnomalyFilters { days?: number; includeNormal?: boolean; from?: string; to?: string }

export function getAnomalies(filters: AnomalyFilters = {}): Promise<AnomalySummary> {
  const params = new URLSearchParams();
  params.set("days", String(Math.min(filters.days ?? 7, 30)));
  if (filters.includeNormal) params.set("include_normal", "true");
  return fetchJSON(AnomalySummarySchema, `/api/admin/anomalies?${params}`);
}

export function getScheduledJobs(): Promise<{ jobs: ScheduledJob[] }> {
  return fetchJSON(ScheduledJobsResponseSchema, `/api/admin/scheduled-jobs`);
}

export function getEmployeeProgress(email: string): Promise<EmployeeSearchResponse> {
  const params = new URLSearchParams({ email });
  return fetchJSON(EmployeeSearchResponseSchema, `/api/admin/employees?${params}`);
}

export interface AuditLogFilters {
  flow?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function getAuditLog(filters: AuditLogFilters = {}): Promise<AuditLogResponse> {
  const params = new URLSearchParams();
  if (filters.flow) params.set("flow", filters.flow);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 50));
  return fetchJSON(AuditLogResponseSchema, `/api/admin/audit-log?${params}`);
}
