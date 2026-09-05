import { z } from "zod";
import {
  TicketsResponseSchema,
  TicketDetailSchema,
  ParentTicketsResponseSchema,
  KpisSchema,
  TogglesResponseSchema,
  ConfigResponseSchema,
  AnomalySummarySchema,
  ScheduledJobSchema,
  ScheduledJobsResponseSchema,
  ScheduledJobLogResponseSchema,
  AuditLogResponseSchema,
  AutomationDetailSchema,
  HealthSchema,
  MeSchema,
  EmployeeSearchResponseSchema,
  EmployeeSearchSuggestionsSchema,
  ApprovalsResponseSchema,
  GwsUserSearchResponseSchema,
  HrTicketSchema,
  HrTicketsResponseSchema,
  HrTicketUpdateResponseSchema,
  type TicketsResponse,
  type TicketDetail,
  type ParentTicketsResponse,
  type Kpis,
  type Toggle,
  type ConfigValue,
  type AnomalySummary,
  type ScheduledJob,
  type ScheduledJobLogResponse,
  type AuditLogResponse,
  type AutomationDetail,
  type Health,
  type Me,
  type EmployeeSearchResponse,
  type EmployeeSearchSuggestions,
  type ApprovalsResponse,
  type GwsUserSearchResponse,
  type HrTicket,
  type HrTicketsResponse,
  type HrTicketStatus,
  type HrTicketUpdateResponse,
} from "./types";

// Real backend URL for a standalone-deployed frontend (no dev proxy to fall
// back on). Empty by default -- same-origin relative paths, which is what
// the local dev proxy (vite.config.ts) and a same-origin production
// deployment both want.
const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.replace(/\/$/, "") ?? "";

// Shown to the user via ErrorState -- the raw status/body (often literal
// JSON) is still logged to the console for debugging, but never surfaced
// directly, same reasoning as Login.tsx's own ERROR_MESSAGES map.
function friendlyErrorMessage(status: number): string {
  if (status === 401 || status === 403) return "You've been signed out. Please sign in again.";
  if (status === 404) return "We couldn't find that.";
  if (status >= 500) return "Something went wrong on our end. Please try again in a moment.";
  return "We couldn't complete that request. Please try again.";
}

function pathKey(path: (string | number)[]): string {
  return JSON.stringify(path);
}

function getAt(obj: unknown, path: (string | number)[]): unknown {
  return path.reduce<unknown>((acc, key) => {
    if (acc == null || typeof acc !== "object") return undefined;
    return (acc as Record<string | number, unknown>)[key];
  }, obj);
}

// One malformed item deep inside an otherwise-valid list (e.g. an
// unrecognized "flow" value from a leftover/legacy event, or a brand new
// value this frontend hasn't caught up on yet) must never take down the
// whole response. Finds the array item each validation issue belongs to and
// drops just that item from a cloned copy, so the rest of the list still
// renders. Returns null if no issue traces back to a removable array item
// (a real, unrelated validation problem) -- the caller then surfaces the
// original error as-is rather than guessing further.
function dropInvalidArrayItems(json: unknown, issues: z.ZodIssue[]): unknown | null {
  const toRemove = new Map<string, Set<number>>();
  for (const issue of issues) {
    const idx = issue.path.findIndex((segment) => typeof segment === "number");
    if (idx === -1) continue;
    const key = pathKey(issue.path.slice(0, idx));
    const itemIndex = issue.path[idx] as number;
    if (!toRemove.has(key)) toRemove.set(key, new Set());
    toRemove.get(key)!.add(itemIndex);
  }
  if (toRemove.size === 0) return null;

  const cloned = JSON.parse(JSON.stringify(json));
  for (const [key, indices] of toRemove) {
    const containerPath = JSON.parse(key) as (string | number)[];
    const arr = getAt(cloned, containerPath);
    if (!Array.isArray(arr)) continue;
    [...indices].sort((a, b) => b - a).forEach((i) => arr.splice(i, 1));
  }
  return cloned;
}

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
    const detail = await res.text().catch(() => res.statusText);
    console.error(`API request failed: ${res.status} ${path}`, detail);
    throw new Error(friendlyErrorMessage(res.status));
  }
  const json = await res.json();
  const result = schema.safeParse(json);
  if (result.success) return result.data;

  const cleaned = dropInvalidArrayItems(json, result.error.issues);
  if (cleaned !== null) {
    const retry = schema.safeParse(cleaned);
    if (retry.success) {
      console.warn(`Dropped invalid item(s) from ${path} response`, result.error.issues);
      return retry.data;
    }
  }
  console.error(`API response validation failed: ${path}`, result.error);
  throw result.error;
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

export interface ParentTicketFilters {
  type: "onboarding" | "offboarding";
  project?: string;
  from?: string;
  to?: string;
  q?: string;
  dateStatus?: "upcoming" | "overdue";
  page?: number;
  pageSize?: number;
}

export function getParentTickets(filters: ParentTicketFilters): Promise<ParentTicketsResponse> {
  const params = new URLSearchParams();
  params.set("type", filters.type);
  if (filters.project) params.set("project", filters.project);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  if (filters.dateStatus) params.set("dateStatus", filters.dateStatus);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 25));
  return fetchJSON(ParentTicketsResponseSchema, `/api/admin/parent-tickets?${params}`);
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

export function getConfig(): Promise<{ config: ConfigValue[] }> {
  return fetchJSON(ConfigResponseSchema, `/api/admin/config`);
}

export function updateConfig(name: string, value: string): Promise<{ config: ConfigValue[] }> {
  return fetchJSON(ConfigResponseSchema, `/api/admin/config`, {
    method: "POST",
    body: JSON.stringify({ name, value }),
  });
}

export interface AnomalyFilters {
  days?: number;
  includeNormal?: boolean;
  flow?: string;
  severity?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function getAnomalies(filters: AnomalyFilters = {}): Promise<AnomalySummary> {
  const params = new URLSearchParams();
  params.set("days", String(Math.min(filters.days ?? 7, 30)));
  if (filters.includeNormal) params.set("include_normal", "true");
  if (filters.flow) params.set("flow", filters.flow);
  if (filters.severity) params.set("severity", filters.severity);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
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

export interface ApprovalFilters {
  status?: string;
  from?: string;
  to?: string;
  q?: string;
  page?: number;
  pageSize?: number;
}

export function getApprovals(filters: ApprovalFilters = {}): Promise<ApprovalsResponse> {
  const params = new URLSearchParams();
  if (filters.status) params.set("status", filters.status);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q) params.set("q", filters.q);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 25));
  return fetchJSON(ApprovalsResponseSchema, `/api/admin/approvals?${params}`);
}

// comment is required -- the backend rejects a blank one (400) so every
// manual approve/reject leaves a real explanation on the ticket.
export interface ApprovalActionBody { cloneFromEmail?: string; comment: string }

export function approveMailApproval(issueKey: string, body: ApprovalActionBody): Promise<{ status: string; issueKey: string }> {
  return fetchJSON(
    z.object({ status: z.string(), issueKey: z.string() }),
    `/api/admin/approvals/${encodeURIComponent(issueKey)}/approve`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

export function rejectMailApproval(issueKey: string, body: ApprovalActionBody): Promise<{ status: string; issueKey: string }> {
  return fetchJSON(
    z.object({ status: z.string(), issueKey: z.string() }),
    `/api/admin/approvals/${encodeURIComponent(issueKey)}/reject`,
    { method: "POST", body: JSON.stringify(body) }
  );
}

// Resends a Mail Approval ticket's setup/decision email after it previously
// failed to send (e.g. an SMTP outage) -- only actionable while the
// ticket's status is "failed". See app/routers/admin_api.py's
// retry_mail_approval.
export function retryMailApproval(issueKey: string): Promise<{ issueKey: string; flow: string; result: { status: string } }> {
  return fetchJSON(
    z.object({ issueKey: z.string(), flow: z.string(), result: z.object({ status: z.string() }) }),
    `/api/admin/approvals/${encodeURIComponent(issueKey)}/retry`,
    { method: "POST" }
  );
}

// Marks an escalated Akamai ticket (manager wasn't sure, handed it to IT)
// as resolved manually -- closes the ticket without running the
// clone-from-employee automation. Only valid on a ticket that's actually
// escalated; Approve/Reject remain the way to run the real automation.
// comment is required -- it's what proves what IT actually did.
export function resolveMailApproval(issueKey: string, comment: string): Promise<{ status: string; issueKey: string }> {
  return fetchJSON(
    z.object({ status: z.string(), issueKey: z.string() }),
    `/api/admin/approvals/${encodeURIComponent(issueKey)}/resolve`,
    { method: "POST", body: JSON.stringify({ comment }) }
  );
}

// Resends a new hire's welcome/credentials email after it previously failed
// to send (mailbox already exists -- see retry_credential_email).
export function retryCredentialEmail(issueKey: string): Promise<{ issueKey: string; status: string }> {
  return fetchJSON(
    z.object({ issueKey: z.string(), status: z.string() }),
    `/api/admin/tickets/${encodeURIComponent(issueKey)}/retry-credential-email`,
    { method: "POST" }
  );
}

export function searchGwsUsers(query: string): Promise<GwsUserSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(GwsUserSearchResponseSchema, `/api/admin/gws/search-users?${params}`);
}

export function searchHrManagers(query: string): Promise<GwsUserSearchResponse> {
  const params = new URLSearchParams({ q: query });
  return fetchJSON(GwsUserSearchResponseSchema, `/api/hr/manager-search?${params}`);
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

export function getAutomationDetail(flow: string, days = 30, page = 1, pageSize = 25): Promise<AutomationDetail> {
  const params = new URLSearchParams({ days: String(days), page: String(page), page_size: String(pageSize) });
  return fetchJSON(AutomationDetailSchema, `/api/admin/automations/${encodeURIComponent(flow)}?${params}`);
}

export function getIntegrationHealth(): Promise<Health> {
  return fetchJSON(HealthSchema, `/api/admin/health`);
}

// ── HR Dashboard ───────────────────────────────────────────────────────────────

export interface HrTicketFilters {
  type?: "onboarding" | "offboarding";
  status?: HrTicketStatus;
  q?: string;
  from?: string;
  to?: string;
  page?: number;
  pageSize?: number;
}

export function getHrTicketDetail(issueKey: string): Promise<HrTicket> {
  return fetchJSON(HrTicketSchema, `/api/hr/tickets/${encodeURIComponent(issueKey)}`);
}

export function getHrTickets(filters: HrTicketFilters = {}): Promise<HrTicketsResponse> {
  const params = new URLSearchParams();
  if (filters.type) params.set("type", filters.type);
  if (filters.status) params.set("status", filters.status);
  if (filters.q) params.set("q", filters.q);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  params.set("page", String(filters.page ?? 1));
  params.set("page_size", String(filters.pageSize ?? 25));
  return fetchJSON(HrTicketsResponseSchema, `/api/hr/tickets?${params}`);
}

export interface HrTicketUpdateBody {
  employee_email?: string;
  personal_email?: string;
  joining_date?: string;
  last_working_day?: string;
  manager_email?: string;
}

export function updateHrTicketFields(issueKey: string, body: HrTicketUpdateBody): Promise<HrTicketUpdateResponse> {
  return fetchJSON(HrTicketUpdateResponseSchema, `/api/hr/tickets/${encodeURIComponent(issueKey)}/update`, {
    method: "POST",
    body: JSON.stringify(body),
  });
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
