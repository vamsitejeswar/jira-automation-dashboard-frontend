import { z } from "zod";

export const FlowSchema = z.enum([
  "gws_mailbox",
  "akamai_access",
  "drive_transfer",
  "gws_suspend",
  "scheduled_credentials",
  "data_transfer",
  "toggle_change",
  "ad_m365_disable",
]);
export type Flow = z.infer<typeof FlowSchema>;

export const SeveritySchema = z.enum(["DEFAULT", "INFO", "WARNING", "ERROR"]);
export type Severity = z.infer<typeof SeveritySchema>;

// ── Audit Event ────────────────────────────────────────────────────────────────
export const AuditEventSchema = z.object({
  flow: FlowSchema,
  outcome: z.string(),
  issueKey: z.string().nullable(),
  error: z.string().nullable(),
  timestamp: z.string(),
  severity: SeveritySchema,
}).catchall(z.unknown());
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ── Ticket ─────────────────────────────────────────────────────────────────────
export const TicketSummarySchema = z.object({
  issueKey: z.string(),
  // Real Jira issue summary (e.g. "Employee Offboarding | | Employee Name")
  // -- looked up live from Jira, so null if that lookup failed or the
  // ticket no longer exists.
  title: z.string().nullable().optional(),
  flow: FlowSchema,
  currentStatus: z.string(),
  employeeEmail: z.string().nullable(),
  managerEmail: z.string().nullable(),
  updatedAt: z.string(),
  hasError: z.boolean(),
});
export type TicketSummary = z.infer<typeof TicketSummarySchema>;

export const CommentSchema = z.object({
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

export const TicketDetailSchema = TicketSummarySchema.extend({
  jiraUrl: z.string(),
  comments: z.array(CommentSchema),
  auditEvents: z.array(AuditEventSchema),
  // Pulled live from the real Jira ticket (and its parent, for a subtask) --
  // fills in what this automation's own audit trail doesn't have, e.g. for
  // a ticket it never fully processed. Null/absent if that lookup failed.
  jiraStatus: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
  employeeName: z.string().nullable().optional(),
});
export type TicketDetail = z.infer<typeof TicketDetailSchema>;

export const TicketsResponseSchema = z.object({
  total: z.number(),
  page: z.number(),
  results: z.array(TicketSummarySchema),
});
export type TicketsResponse = z.infer<typeof TicketsResponseSchema>;

// ── KPIs ───────────────────────────────────────────────────────────────────────
export const KpisByDaySchema = z.object({
  date: z.string(),
  onboarded: z.number(),
  offboarded: z.number(),
  failures: z.number(),
});

export const KpisSchema = z.object({
  onboardedCount: z.number(),
  offboardedCount: z.number(),
  akamaiClones: z.number(),
  failuresCount: z.number(),
  // A live snapshot (Mail Approval tickets currently awaiting a manager
  // reply), not scoped to the from/to range like the rest of this response.
  pendingApprovals: z.number(),
  byFlow: z.record(z.number()),
  byDay: z.array(KpisByDaySchema),
});
export type Kpis = z.infer<typeof KpisSchema>;

// ── Mail Approvals ─────────────────────────────────────────────────────────────
export const ApprovalStatusSchema = z.enum(["pending", "approved", "ignored", "no_response", "failed", "untracked"]);
export type ApprovalStatus = z.infer<typeof ApprovalStatusSchema>;

export const ApprovalSchema = z.object({
  issueKey: z.string(),
  flow: FlowSchema,
  status: ApprovalStatusSchema,
  employeeEmail: z.string().nullable(),
  managerEmail: z.string().nullable(),
  reminderCount: z.number(),
  updatedAt: z.string().nullable(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const ApprovalsResponseSchema = z.object({
  total: z.number(),
  results: z.array(ApprovalSchema),
});
export type ApprovalsResponse = z.infer<typeof ApprovalsResponseSchema>;

// Same live search-select the manager's own Akamai setup email/form uses --
// an admin-authenticated equivalent for the dashboard's manual "Clone
// access from..." action.
export const GwsUserSchema = z.object({ email: z.string(), name: z.string() });
export type GwsUser = z.infer<typeof GwsUserSchema>;

export const GwsUserSearchResponseSchema = z.object({ results: z.array(GwsUserSchema) });
export type GwsUserSearchResponse = z.infer<typeof GwsUserSearchResponseSchema>;

// ── Toggles ────────────────────────────────────────────────────────────────────
export const ToggleNameSchema = z.enum([
  "automation_enabled",
  "email_sending_enabled",
  "gws_account_creation_enabled",
  "retry_on_update_enabled",
  "akamai_enabled",
  "gws_account_suspend_enabled",
  "data_transfer_enabled",
  "ad_disable_enabled",
  "m365_disable_enabled",
]);
export type ToggleName = z.infer<typeof ToggleNameSchema>;

export const ToggleSchema = z.object({
  name: ToggleNameSchema,
  value: z.boolean(),
  lastChangedAt: z.string().nullable(),
  lastChangedBy: z.string().nullable(),
});
export type Toggle = z.infer<typeof ToggleSchema>;

export const TogglesResponseSchema = z.object({
  toggles: z.array(ToggleSchema),
});

// ── Anomalies ──────────────────────────────────────────────────────────────────
export const AnomalyEventSchema = z.object({
  timestamp: z.string(),
  severity: SeveritySchema,
  flow: FlowSchema,
  outcome: z.string(),
  issueKey: z.string().nullable(),
  reason: z.string().nullable(),
  error: z.string().nullable(),
});
export type AnomalyEvent = z.infer<typeof AnomalyEventSchema>;

export const AnomalySummarySchema = z.object({
  days: z.number(),
  totalEventsScanned: z.number(),
  totalAnomalies: z.number(),
  breakdownByFlowAndOutcome: z.array(
    z.object({ flow: FlowSchema, outcome: z.string(), count: z.number() })
  ),
  // Pagination applies to whichever of anomalies/allEvents is actually
  // being shown (see include_normal) -- the aggregate stats above always
  // stay full/unpaginated.
  page: z.number(),
  total: z.number(),
  anomalies: z.array(AnomalyEventSchema),
  allEvents: z.array(AnomalyEventSchema).optional(),
});
export type AnomalySummary = z.infer<typeof AnomalySummarySchema>;

// ── Scheduled Jobs ─────────────────────────────────────────────────────────────
export const ScheduledJobSchema = z.object({
  name: z.string(),
  label: z.string(),
  endpoint: z.string(),
  schedule: z.string(),
  timeZone: z.string(),
  state: z.string(),
  nextRunAt: z.string(),
  lastRunAt: z.string().nullable(),
});
export type ScheduledJob = z.infer<typeof ScheduledJobSchema>;

export const ScheduledJobsResponseSchema = z.object({
  jobs: z.array(ScheduledJobSchema),
});

// Per-ticket outcomes for one job's own runs -- same shape as a raw audit
// event, just pre-filtered server-side to this one job's flow(s)/trigger.
export const ScheduledJobLogResponseSchema = z.object({
  job: ScheduledJobSchema,
  total: z.number(),
  page: z.number(),
  results: z.array(AuditEventSchema),
});
export type ScheduledJobLogResponse = z.infer<typeof ScheduledJobLogResponseSchema>;

// ── Employee Progress ─────────────────────────────────────────────────────────
// "manual_task" covers real Jira subtasks this automation never touches
// (Admin Support, Laptop Handover, LMS Training, ...) -- surfaced with their
// real Jira status instead of an audit outcome. Not added to FlowSchema
// itself since that's only ever a real write_audit() flow elsewhere
// (tickets/KPIs/anomalies/audit-log).
export const StepFlowSchema = FlowSchema.or(z.literal("manual_task"));

export const FlowStepSchema = z.object({
  flow: StepFlowSchema,
  issueKey: z.string().nullable(),
  outcome: z.string().nullable(),
  completedAt: z.string().nullable(),
  status: z.enum(["done", "in_progress", "pending", "failed", "skipped"]),
  // Only present for manual_task steps -- the real Jira subtask summary
  // (e.g. "Admin Support"), since there's no FLOW_META label for those.
  label: z.string().nullable().optional(),
});
export type FlowStep = z.infer<typeof FlowStepSchema>;

export const EmployeeProgressSchema = z.object({
  email: z.string(),
  type: z.enum(["onboarding", "offboarding"]),
  jiraUrl: z.string().nullable(),
  issueKey: z.string().nullable(),
  // The real parent ticket's title (e.g. "Employee Onboarding | V3057 |
  // Jane Doe") -- null only if it couldn't be resolved from Jira.
  title: z.string().nullable(),
  startedAt: z.string().nullable(),
  steps: z.array(FlowStepSchema),
  overallStatus: z.enum(["completed", "in_progress", "failed", "pending"]),
});
export type EmployeeProgress = z.infer<typeof EmployeeProgressSchema>;

// One real Jira ticket that matched the search box's query -- issueKey/title
// are null only for the plain-email fast path (no Jira call at all was
// made). employeeEmail is null if this ticket exists but no employee email
// could be resolved from it (still worth showing as a hit).
export const EmployeeSearchResultSchema = z.object({
  issueKey: z.string().nullable(),
  title: z.string().nullable(),
  employeeEmail: z.string().nullable(),
  jiraUrl: z.string().nullable(),
});
export type EmployeeSearchResult = z.infer<typeof EmployeeSearchResultSchema>;

export const EmployeeSearchSuggestionsSchema = z.object({
  query: z.string(),
  results: z.array(EmployeeSearchResultSchema),
});
export type EmployeeSearchSuggestions = z.infer<typeof EmployeeSearchSuggestionsSchema>;

export const EmployeeSearchResponseSchema = z.object({
  query: z.string(),
  searchResults: z.array(EmployeeSearchResultSchema),
  // The search box accepts an email, a ticket ID, or a name/title fragment --
  // an ambiguous fragment can resolve to more than one real employee, each
  // one's records tagged via EmployeeProgress.email.
  resolvedEmails: z.array(z.string()),
  records: z.array(EmployeeProgressSchema),
});
export type EmployeeSearchResponse = z.infer<typeof EmployeeSearchResponseSchema>;

// ── Audit Log ──────────────────────────────────────────────────────────────────
export const AuditLogResponseSchema = z.object({
  total: z.number(),
  page: z.number(),
  results: z.array(AuditEventSchema),
});
export type AuditLogResponse = z.infer<typeof AuditLogResponseSchema>;
