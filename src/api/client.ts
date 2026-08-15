import { z } from "zod";
import {
  TicketsResponseSchema,
  TicketDetailSchema,
  KpisSchema,
  TogglesResponseSchema,
  AnomalySummarySchema,
  ScheduledJobSchema,
  ScheduledJobsResponseSchema,
  ScheduledJobLogResponseSchema,
  AuditLogResponseSchema,
  MeSchema,
  EmployeeSearchResponseSchema,
  EmployeeSearchSuggestionsSchema,
  ApprovalsResponseSchema,
  GwsUserSearchResponseSchema,
  type TicketsResponse,
  type TicketDetail,
  type Kpis,
  type Toggle,
  type AnomalySummary,
  type ScheduledJob,
  type ScheduledJobLogResponse,
  type AuditLogResponse,
  type Me,
  type EmployeeSearchResponse,
  type EmployeeSearchSuggestions,
  type ApprovalsResponse,
  type GwsUserSearchResponse,
} from "./types";

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
      ...init?.headers,
    },
    // Sends the admin_session cookie set by /api/auth/callback (see
    // app/routers/auth.py) -- real per-admin identity, not a shared token.
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

export interface AnomalyFilters {
  days?: number;
  includeNormal?: boolean;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function getAnomalies(filters: AnomalyFilters = {}): Promise<AnomalySummary> {
  const params = new URLSearchParams();
  params.set("days", String(Math.min(filters.days ?? 7, 30)));
  if (filters.includeNormal) params.set("include_normal", "true");
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 50));
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

export function getScheduledJobLog(name: string, page = 1, pageSize = 50): Promise<ScheduledJobLogResponse> {
  const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
  return fetchJSON(ScheduledJobLogResponseSchema, `/api/admin/scheduled-jobs/${encodeURIComponent(name)}/log?${params}`);
}

export function getEmployeeProgress(query: string): Promise<EmployeeSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(EmployeeSearchResponseSchema, `/api/admin/employees?${params}`);
}

export function getEmployeeSearchSuggestions(query: string): Promise<EmployeeSearchSuggestions> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(EmployeeSearchSuggestionsSchema, `/api/admin/employees/suggestions?${params}`);
}

export function getApprovals(status?: string): Promise<ApprovalsResponse> {
  const params = new URLSearchParams();
  if (status) params.set("status", status);
  return fetchJSON(ApprovalsResponseSchema, `/api/admin/approvals?${params}`);
}

export interface ApprovalActionBody { cloneFromEmail?: string; comment?: string }

export function approveMailApproval(issueKey: string, body: ApprovalActionBody = {}): Promise<{ status: string; issueKey: string }> {
  return fetchJSON(
    z.object({ status: z.string(), issueKey: z.string() }),
    `/api/admin/approvals/${encodeURIComponent(issueKey)}/approve`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function rejectMailApproval(issueKey: string, body: ApprovalActionBody = {}): Promise<{ status: string; issueKey: string }> {
  return fetchJSON(
    z.object({ status: z.string(), issueKey: z.string() }),
    `/api/admin/approvals/${encodeURIComponent(issueKey)}/reject`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function searchGwsUsers(query: string): Promise<GwsUserSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(GwsUserSearchResponseSchema, `/api/admin/gws/search-users?${params}`);
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

// ── Auth ───────────────────────────────────────────────────────────────────────

// Full-page navigation, not a fetch -- the OAuth redirect dance only works
// as top-level browser navigation (see app/routers/auth.py's /login).
export function loginUrl(): string {
  return `${API_BASE_URL}/api/auth/login`;
}

export function getMe(): Promise<Me> {
  return fetchJSON(MeSchema, `/api/auth/me`);
}

export async function logout(): Promise<void> {
  await fetch(`${API_BASE_URL}/api/auth/logout`, { method: "POST", credentials: "include" });
}
