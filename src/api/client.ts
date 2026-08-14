import { z } from "zod";
import {
  TicketsResponseSchema,
  TicketDetailSchema,
  KpisSchema,
  TogglesResponseSchema,
  AnomalySummarySchema,
  ScheduledJobSchema,
  ScheduledJobsResponseSchema,
  AuditLogResponseSchema,
  EmployeeSearchResponseSchema,
  EmployeeSearchSuggestionsSchema,
  type TicketsResponse,
  type TicketDetail,
  type Kpis,
  type Toggle,
  type AnomalySummary,
  type ScheduledJob,
  type AuditLogResponse,
  type EmployeeSearchResponse,
  type EmployeeSearchSuggestions,
} from "./types";

// Shared-secret token the backend's /api/admin/* routes require as
// "Authorization: Bearer <token>" -- same INTERNAL_TASK_TOKEN the FastAPI
// backend's .env already has. Not real per-admin auth (one shared secret,
// no identity) -- that's a separate, later piece of work. Set via
// VITE_API_TOKEN in .env.local.
//
// SECURITY NOTE: Vite inlines both of these into the built JS bundle at
// build time -- anyone who can load the deployed page can read them out of
// the JS and call the backend directly. Acceptable only until real
// per-admin auth (Google OAuth) replaces this shared-token model.
const API_TOKEN = import.meta.env.VITE_API_TOKEN as string | undefined;

// Real backend URL for a standalone-deployed frontend (no dev proxy to fall
// back on). Empty by default -- same-origin relative paths, which is what
// the local dev proxy (vite.config.ts) and a same-origin production
// deployment both want.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

async function fetchJSON<T>(schema: z.ZodType<T>, path: string, init?: RequestInit): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
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

export function runScheduledJob(name: string): Promise<{ job: ScheduledJob }> {
  return fetchJSON(z.object({ job: ScheduledJobSchema }), `/api/admin/scheduled-jobs/${encodeURIComponent(name)}/run`, {
    method: "POST",
  });
}

export function getEmployeeProgress(query: string): Promise<EmployeeSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(EmployeeSearchResponseSchema, `/api/admin/employees?${params}`);
}

export function getEmployeeSearchSuggestions(query: string): Promise<EmployeeSearchSuggestions> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(EmployeeSearchSuggestionsSchema, `/api/admin/employees/suggestions?${params}`);
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
