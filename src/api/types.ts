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
  // Not a real automation, just scheduled_tasks.py's reminder job writing
  // its own audit events (reminder_sent/reminder_failed/manager_no_response/
  // automation_disabled) -- these show up in the same Cloud Logging stream
  // as everything else, so anomalies/KPI breakdowns need to be able to
  // parse them too.
  "approval_reminder",
  // "Admin Support" subtask -> iSecure/Aero physical access-control (door
  // cards) onboarding/offboarding. Fires on both onboarding and offboarding
  // parent tickets under the same flow name.
  "isecure_access",
  // Settings > Config edits (jira_project_key, it_mail, admin_mail, ...) --
  // distinct from toggle_change, which is for on/off toggles specifically.
  "config_change",
  // Written once per incoming webhook while the master "Automation" toggle
  // is off -- jira_webhook.py's handle_onboarding_webhook, before any
  // per-flow dispatch happens.
  "webhook",
  // Offboarding "Software Access Revoke" subtask -- per-application revoke
  // status reported by an external server via POST
  // /internal/software-revoke-status, not by this automation itself.
  "software_revoke",
  // HR filled in a missing employee_email/joining_date via their own
  // dashboard (see app/routers/hr_api.py) -- not this automation acting on
  // its own.
  "hr_update",
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
  // Only populated where an endpoint does a real Jira title lookup (e.g.
  // the scheduled-job log) -- absent/null everywhere else.
  title: z.string().nullable().optional(),
  employeeEmail: z.string().nullable().optional(),
  managerEmail: z.string().nullable().optional(),
}).catchall(z.unknown());
export type AuditEvent = z.infer<typeof AuditEventSchema>;

// ── Ticket ─────────────────────────────────────────────────────────────────────
export const TicketSummarySchema = z.object({
  issueKey: z.string(),
  // Real Jira issue summary (e.g. "Employee Offboarding | | Employee Name")
  // -- looked up live from Jira, so null if that lookup failed or the
  // ticket no longer exists.
  title: z.string().nullable().optional(),
  // Null for a real ticket this automation has never logged anything for at
  // all (e.g. "Admin Support"/"Asset Pickup" subtasks, or any ticket before
  // its first event ever lands) -- there's genuinely no flow/status to
  // report yet, distinct from a tracked ticket that's merely early in its
  // own flow.
  flow: FlowSchema.nullable(),
  currentStatus: z.string().nullable(),
  employeeEmail: z.string().nullable(),
  managerEmail: z.string().nullable(),
  // Same "no automation history at all" case as flow/currentStatus above --
  // null, not a fabricated timestamp.
  updatedAt: z.string().nullable(),
  hasError: z.boolean(),
});
export type TicketSummary = z.infer<typeof TicketSummarySchema>;

export const CommentSchema = z.object({
  author: z.string(),
  body: z.string(),
  createdAt: z.string(),
});

// One row in a ticket's own simplified Created -> ... -> Closed lifecycle
// timeline (see StageTimeline) -- distinct from AuditEvent (every raw logged
// event): this is the human-readable digest shown next to the Audit
// Timeline, and inside the Employee Search accordion. Most tickets have
// exactly 3 stages; an offboarding "Software Access Revoke" ticket has one
// middle stage per application (application is only set on those rows).
export const StageStatusSchema = z.enum(["done", "in_progress", "pending", "skipped", "failed"]);
export type StageStatus = z.infer<typeof StageStatusSchema>;

export const StageSchema = z.object({
  label: z.string(),
  status: StageStatusSchema,
  timestamp: z.string().nullable(),
  flow: z.string().nullable().optional(),
  outcome: z.string().nullable().optional(),
  application: z.string().nullable().optional(),
  issueKey: z.string().nullable().optional(),
});
export type Stage = z.infer<typeof StageSchema>;

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
  stages: z.array(StageSchema).optional(),
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
  // Only present when the request sent an explicit from/to range -- a real
  // same-length prior window, not the old hardcoded +12%/+4%/-3% arrows.
  previousPeriod: z.object({
    onboardedCount: z.number(),
    offboardedCount: z.number(),
    failuresCount: z.number(),
  }).optional(),
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
  // Akamai only -- the manager wasn't sure what access to grant and handed
  // the ticket to IT instead of deciding. Still "pending" (Approve/Reject
  // still work), just distinguished so IT knows a Resolved shortcut exists.
  escalated: z.boolean(),
});
export type Approval = z.infer<typeof ApprovalSchema>;

export const ApprovalsResponseSchema = z.object({
  total: z.number(),
  page: z.number(),
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
  "isecure_onboard_enabled",
  "isecure_offboard_enabled",
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

// ── Config ─────────────────────────────────────────────────────────────────────
export const ConfigNameSchema = z.enum([
  "jira_project_key",
  "it_mail",
  "admin_mail",
  "drive_common_mail",
  "isecure_company",
  "isecure_default_access_group_ids",
  "hr_allowed_emails",
]);
export type ConfigName = z.infer<typeof ConfigNameSchema>;

export const ConfigValueSchema = z.object({
  name: ConfigNameSchema,
  label: z.string(),
  description: z.string(),
  value: z.string(),
});
export type ConfigValue = z.infer<typeof ConfigValueSchema>;

export const ConfigResponseSchema = z.object({
  config: z.array(ConfigValueSchema),
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
  employeeEmail: z.string().nullable().optional(),
  managerEmail: z.string().nullable().optional(),
  // Only populated for the current page (a batched Jira lookup, not part of
  // the Cloud Logging scan itself) -- see GET /api/admin/anomalies.
  title: z.string().nullable().optional(),
  createdAt: z.string().nullable().optional(),
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
  // Only set by the jobs-list endpoint (not the force-run response) --
  // whether this job's own last real work succeeded, not just whether
  // Cloud Scheduler itself is enabled/paused. "unknown" when nothing's
  // logged yet in the lookback window.
  lastRunStatus: z.enum(["succeeded", "failed", "unknown"]).optional(),
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

// ── Automation detail ──────────────────────────────────────────────────────────
export const AutomationToggleSchema = z.object({ name: z.string(), value: z.boolean() });

export const AutomationDetailSchema = z.object({
  flow: FlowSchema,
  ticketCount: z.number(),
  doneCount: z.number(),
  failedCount: z.number(),
  inFlightCount: z.number(),
  // null when no ticket has concluded yet in the window -- nothing to rate.
  successRate: z.number().nullable(),
  toggles: z.array(AutomationToggleSchema),
  recentEvents: z.array(AuditEventSchema),
  recentEventsTotal: z.number(),
  page: z.number(),
});
export type AutomationDetail = z.infer<typeof AutomationDetailSchema>;

// ── Integration health ──────────────────────────────────────────────────────────
const IntegrationStatusSchema = z.enum(["ok", "down", "not_configured"]);
export const HealthSchema = z.object({
  jira: IntegrationStatusSchema,
  googleWorkspace: IntegrationStatusSchema,
  activeDirectory: IntegrationStatusSchema,
  microsoft365: IntegrationStatusSchema,
});
export type Health = z.infer<typeof HealthSchema>;
export type IntegrationStatus = z.infer<typeof IntegrationStatusSchema>;

// ── Auth ───────────────────────────────────────────────────────────────────────
export const MeSchema = z.object({
  email: z.string(),
  name: z.string().nullable(),
  picture: z.string().nullable(),
  // Absent on a token issued before this claim existed -- the backend's own
  // GET /api/auth/me already falls back to "admin" in that case, so this
  // always resolves to a real role by the time it reaches us.
  role: z.enum(["admin", "hr"]),
});
export type Me = z.infer<typeof MeSchema>;

// ── HR Dashboard ───────────────────────────────────────────────────────────────
// "waiting_for_hr_update" is a real, distinct backend status (see
// app/store.py's mark_waiting_for_hr_update) -- not derived client-side.
export const HrTicketStatusSchema = z.enum(["waiting_for_hr_update", "in_progress", "completed", "failed"]);
export type HrTicketStatus = z.infer<typeof HrTicketStatusSchema>;

// Everything else Jira has on the parent ticket, beyond the four fields HR
// can edit -- HR has no Jira account, so this is the only place they see it.
export const HrParentDetailsSchema = z.object({
  title: z.string().nullable(),
  status: z.string().nullable(),
  priority: z.string().nullable(),
  assignee: z.string().nullable(),
  reporter: z.string().nullable(),
  projectKey: z.string().nullable(),
  projectName: z.string().nullable(),
  createdAt: z.string().nullable(),
  updatedAt: z.string().nullable(),
});
export type HrParentDetails = z.infer<typeof HrParentDetailsSchema>;

export const HrTicketSchema = z.object({
  issueKey: z.string(),
  parentKey: z.string().nullable(),
  parentDetails: HrParentDetailsSchema,
  title: z.string().nullable(),
  type: z.enum(["onboarding", "offboarding"]),
  status: HrTicketStatusSchema,
  employeeEmail: z.string().nullable(),
  personalEmail: z.string().nullable(),
  joiningDate: z.string().nullable(),
  lastWorkingDay: z.string().nullable(),
  managerEmail: z.string().nullable(),
  missingFields: z.array(z.enum(["employee_email", "personal_email", "joining_date", "last_working_day"])),
  updatedAt: z.string().nullable(),
  // Only populated by the single-ticket detail fetch (getHrTicketDetail),
  // not the list -- same split as admin's own get_ticket_detail/get_tickets.
  stages: z.array(StageSchema).optional(),
});
export type HrTicket = z.infer<typeof HrTicketSchema>;

export const HrTicketsResponseSchema = z.object({
  total: z.number(),
  page: z.number(),
  results: z.array(HrTicketSchema),
});
export type HrTicketsResponse = z.infer<typeof HrTicketsResponseSchema>;

export const HrTicketUpdateResponseSchema = z.object({
  issueKey: z.string(),
  updated: z.object({
    employee_email: z.string().optional(),
    personal_email: z.string().optional(),
    joining_date: z.string().optional(),
    last_working_day: z.string().optional(),
  }),
  retriedSubtasks: z.array(z.string()),
});
export type HrTicketUpdateResponse = z.infer<typeof HrTicketUpdateResponseSchema>;
