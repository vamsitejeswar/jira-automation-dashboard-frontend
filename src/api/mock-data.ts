import type {
  TicketSummary,
  TicketDetail,
  Kpis,
  Toggle,
  AnomalySummary,
  ScheduledJob,
  AuditEvent,
  EmployeeProgress,
} from "./types";

// ─── helpers ──────────────────────────────────────────────────────────────────
function daysAgo(n: number, hh = 9, mm = 0): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(hh, mm, 0, 0);
  return d.toISOString();
}

// ─── KPIs ─────────────────────────────────────────────────────────────────────
export const MOCK_KPIS: Kpis = {
  onboardedCount: 38,
  offboardedCount: 12,
  akamaiClones: 27,
  failuresCount: 5,
  byFlow: {
    gws_mailbox: 38,
    akamai_access: 27,
    drive_transfer: 12,
    scheduled_credentials: 9,
    data_transfer: 4,
    toggle_change: 3,
  },
  byDay: Array.from({ length: 14 }, (_, i) => ({
    date: daysAgo(13 - i).slice(0, 10),
    onboarded: [2, 4, 1, 3, 5, 2, 0, 3, 4, 2, 3, 4, 3, 2][i],
    offboarded: [0, 1, 0, 2, 1, 0, 0, 1, 2, 1, 1, 1, 1, 1][i],
    failures: [0, 1, 0, 0, 1, 0, 0, 0, 1, 0, 0, 1, 0, 1][i],
  })),
};

// ─── Tickets ──────────────────────────────────────────────────────────────────
const EMPLOYEES = [
  { emp: "rahul.sharma@verse.in", mgr: "priya.nair@verse.in" },
  { emp: "ananya.krishna@verse.in", mgr: "deepak.mehta@verse.in" },
  { emp: "rohan.joshi@verse.in", mgr: "sunita.rao@verse.in" },
  { emp: "kavya.menon@verse.in", mgr: "amit.gupta@verse.in" },
  { emp: "nikhil.verma@verse.in", mgr: "pooja.iyer@verse.in" },
];

type MockFlow = TicketSummary["flow"];
type MockStatus = string;

const RAW_TICKETS: Array<{
  flow: MockFlow;
  status: MockStatus;
  hasError: boolean;
  daysAgo: number;
  project: "WOH" | "VSD";
}> = [
  { flow: "gws_mailbox", status: "succeeded", hasError: false, daysAgo: 0, project: "WOH" },
  { flow: "gws_mailbox", status: "failed", hasError: true, daysAgo: 1, project: "WOH" },
  { flow: "akamai_access", status: "setup_email_sent", hasError: false, daysAgo: 0, project: "WOH" },
  { flow: "akamai_access", status: "succeeded", hasError: false, daysAgo: 2, project: "VSD" },
  { flow: "drive_transfer", status: "suspended", hasError: false, daysAgo: 1, project: "WOH" },
  { flow: "drive_transfer", status: "deferred_to_lwd", hasError: false, daysAgo: 3, project: "VSD" },
  { flow: "gws_mailbox", status: "deferred_to_doj", hasError: false, daysAgo: 2, project: "WOH" },
  { flow: "gws_mailbox", status: "already_processed", hasError: false, daysAgo: 4, project: "WOH" },
  { flow: "akamai_access", status: "invalid_email", hasError: true, daysAgo: 1, project: "VSD" },
  { flow: "drive_transfer", status: "failed", hasError: true, daysAgo: 2, project: "WOH" },
  { flow: "scheduled_credentials", status: "sent", hasError: false, daysAgo: 1, project: "WOH" },
  { flow: "gws_mailbox", status: "succeeded", hasError: false, daysAgo: 3, project: "VSD" },
  { flow: "akamai_access", status: "akamai_disabled", hasError: false, daysAgo: 5, project: "WOH" },
  { flow: "drive_transfer", status: "duplicate_offboarding_ticket", hasError: false, daysAgo: 6, project: "WOH" },
  { flow: "data_transfer", status: "transfer_started", hasError: false, daysAgo: 2, project: "VSD" },
  { flow: "gws_mailbox", status: "transition_failed", hasError: true, daysAgo: 3, project: "WOH" },
  { flow: "akamai_access", status: "setup_email_sent", hasError: false, daysAgo: 4, project: "WOH" },
  { flow: "drive_transfer", status: "accepted", hasError: false, daysAgo: 5, project: "VSD" },
  { flow: "gws_mailbox", status: "succeeded", hasError: false, daysAgo: 6, project: "WOH" },
  { flow: "scheduled_credentials", status: "failed", hasError: true, daysAgo: 7, project: "WOH" },
  { flow: "gws_mailbox", status: "gws_creation_disabled", hasError: false, daysAgo: 7, project: "VSD" },
  { flow: "data_transfer", status: "failed", hasError: true, daysAgo: 8, project: "WOH" },
  { flow: "akamai_access", status: "succeeded", hasError: false, daysAgo: 8, project: "WOH" },
  { flow: "drive_transfer", status: "suspend_failed", hasError: true, daysAgo: 9, project: "VSD" },
  { flow: "toggle_change", status: "changed", hasError: false, daysAgo: 10, project: "WOH" },
];

export const MOCK_TICKETS: TicketSummary[] = RAW_TICKETS.map((t, i) => {
  const emp = EMPLOYEES[i % EMPLOYEES.length];
  const num = 1000 + i * 13;
  return {
    issueKey: `${t.project}-${num}`,
    flow: t.flow,
    currentStatus: t.status,
    employeeEmail: t.flow === "toggle_change" ? null : emp.emp,
    managerEmail: t.flow === "toggle_change" ? null : emp.mgr,
    updatedAt: daysAgo(t.daysAgo, 10 + (i % 8), (i * 7) % 60),
    hasError: t.hasError,
  };
});

// ─── Ticket Detail ─────────────────────────────────────────────────────────────
export const MOCK_TICKET_DETAIL: TicketDetail = {
  issueKey: "WOH-1000",
  flow: "gws_mailbox",
  currentStatus: "succeeded",
  employeeEmail: "rahul.sharma@verse.in",
  managerEmail: "priya.nair@verse.in",
  updatedAt: daysAgo(0, 10, 35),
  hasError: false,
  jiraUrl: "https://wohlig.atlassian.net/browse/WOH-1000",
  comments: [
    {
      author: "Automation Bot",
      body: "Onboarding ticket received. Employee: rahul.sharma@verse.in | DOJ: 2026-08-14 | Dept: Engineering",
      createdAt: daysAgo(2, 9, 5),
    },
    {
      author: "priya.nair@verse.in",
      body: "Approved for mailbox creation.\nflow=gws_mailbox outcome=comment_approve issue=WOH-1000 timestamp=2026-08-12T09:10:00Z",
      createdAt: daysAgo(2, 9, 10),
    },
    {
      author: "Automation Bot",
      body: "Google Workspace account created successfully.\nflow=gws_mailbox outcome=succeeded issue=WOH-1000 timestamp=2026-08-12T09:12:14Z",
      createdAt: daysAgo(2, 9, 12),
    },
    {
      author: "Automation Bot",
      body: "Welcome email sent to personal_email: rahul.personal@gmail.com with login credentials.",
      createdAt: daysAgo(2, 9, 13),
    },
  ],
  auditEvents: [
    {
      flow: "gws_mailbox",
      outcome: "comment_approve",
      issueKey: "WOH-1000",
      error: null,
      timestamp: daysAgo(2, 9, 10),
      severity: "INFO",
    },
    {
      flow: "gws_mailbox",
      outcome: "succeeded",
      issueKey: "WOH-1000",
      error: null,
      timestamp: daysAgo(2, 9, 12),
      severity: "INFO",
    },
    {
      flow: "akamai_access",
      outcome: "setup_email_sent",
      issueKey: "WOH-1000",
      error: null,
      timestamp: daysAgo(2, 9, 15),
      severity: "INFO",
    },
  ],
};

// ─── Toggles ──────────────────────────────────────────────────────────────────
export const MOCK_TOGGLES: Toggle[] = [
  {
    name: "automation_enabled",
    value: true,
    lastChangedAt: daysAgo(5, 14, 0),
    lastChangedBy: "admin@wohlig.com",
  },
  {
    name: "email_sending_enabled",
    value: true,
    lastChangedAt: daysAgo(10, 11, 30),
    lastChangedBy: "admin@wohlig.com",
  },
  {
    name: "gws_account_creation_enabled",
    value: true,
    lastChangedAt: null,
    lastChangedBy: null,
  },
  {
    name: "retry_on_update_enabled",
    value: false,
    lastChangedAt: daysAgo(2, 16, 45),
    lastChangedBy: "admin@wohlig.com",
  },
  {
    name: "akamai_enabled",
    value: true,
    lastChangedAt: null,
    lastChangedBy: null,
  },
  {
    name: "gws_account_suspend_enabled",
    value: true,
    lastChangedAt: daysAgo(15, 10, 0),
    lastChangedBy: "admin@wohlig.com",
  },
  {
    name: "data_transfer_enabled",
    value: true,
    lastChangedAt: null,
    lastChangedBy: null,
  },
];

// ─── Anomalies ────────────────────────────────────────────────────────────────
export const MOCK_ANOMALIES: AnomalySummary = {
  days: 7,
  totalEventsScanned: 93,
  totalAnomalies: 8,
  breakdownByFlowAndOutcome: [
    { flow: "gws_mailbox", outcome: "failed", count: 3 },
    { flow: "akamai_access", outcome: "invalid_email", count: 2 },
    { flow: "drive_transfer", outcome: "suspend_failed", count: 1 },
    { flow: "scheduled_credentials", outcome: "failed", count: 1 },
    { flow: "data_transfer", outcome: "failed", count: 1 },
  ],
  anomalies: [
    {
      timestamp: daysAgo(0, 10, 22),
      severity: "ERROR",
      flow: "gws_mailbox",
      outcome: "failed",
      issueKey: "WOH-1013",
      reason: null,
      error: "google.auth.exceptions.TransportError: Failed to create GWS account after 3 retries",
    },
    {
      timestamp: daysAgo(1, 9, 47),
      severity: "WARNING",
      flow: "akamai_access",
      outcome: "invalid_email",
      issueKey: "VSD-1009",
      reason: "employee_email field contains 'rahulsharmaa@verse..in' — double dot",
      error: null,
    },
    {
      timestamp: daysAgo(1, 14, 5),
      severity: "ERROR",
      flow: "scheduled_credentials",
      outcome: "failed",
      issueKey: null,
      reason: null,
      error: "SMTPAuthenticationError: 535 Authentication failed for credentials job",
    },
    {
      timestamp: daysAgo(2, 11, 33),
      severity: "ERROR",
      flow: "gws_mailbox",
      outcome: "failed",
      issueKey: "WOH-1016",
      reason: null,
      error: "HttpError 409: Entity already exists for ananya.krishna@verse.in",
    },
    {
      timestamp: daysAgo(3, 16, 18),
      severity: "WARNING",
      flow: "akamai_access",
      outcome: "invalid_email",
      issueKey: "WOH-1017",
      reason: "clone_from_email missing from Jira fields",
      error: null,
    },
    {
      timestamp: daysAgo(4, 9, 55),
      severity: "ERROR",
      flow: "drive_transfer",
      outcome: "suspend_failed",
      issueKey: "VSD-1024",
      reason: null,
      error: "googleapiclient.errors.HttpError: 403 Forbidden — insufficient scope",
    },
    {
      timestamp: daysAgo(5, 13, 40),
      severity: "ERROR",
      flow: "gws_mailbox",
      outcome: "failed",
      issueKey: "WOH-1013",
      reason: null,
      error: "TransportError: upstream timeout after 30s",
    },
    {
      timestamp: daysAgo(6, 17, 22),
      severity: "ERROR",
      flow: "data_transfer",
      outcome: "failed",
      issueKey: "VSD-1022",
      reason: null,
      error: "DataTransferError: Transfer job rejected — destination user suspended",
    },
  ],
};

// ─── Scheduled Jobs ───────────────────────────────────────────────────────────
export const MOCK_SCHEDULED_JOBS: ScheduledJob[] = [
  {
    name: "jira-automation-onboarding-send-pending-credentials",
    endpoint: "/internal/send-pending-credentials",
    schedule: "0 9 * * *",
    timeZone: "Asia/Calcutta",
    state: "ENABLED",
    nextRunAt: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setUTCHours(3, 30, 0, 0); // 09:00 IST = 03:30 UTC
      return d.toISOString();
    })(),
    lastRunAt: daysAgo(0, 3, 30),
  },
  {
    name: "jira-automation-offboarding-process-due",
    endpoint: "/internal/process-due-offboarding",
    schedule: "0 21 * * *",
    timeZone: "Asia/Calcutta",
    state: "ENABLED",
    nextRunAt: (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      d.setUTCHours(15, 30, 0, 0); // 21:00 IST = 15:30 UTC
      return d.toISOString();
    })(),
    lastRunAt: daysAgo(0, 15, 30),
  },
  {
    name: "jira-automation-weekly-anomaly-digest",
    endpoint: "/internal/send-weekly-anomaly-digest",
    schedule: "0 9 * * 1",
    timeZone: "Asia/Calcutta",
    state: "ENABLED",
    nextRunAt: (() => {
      const d = new Date();
      const daysUntilMonday = (8 - d.getDay()) % 7 || 7;
      d.setDate(d.getDate() + daysUntilMonday);
      d.setUTCHours(3, 30, 0, 0);
      return d.toISOString();
    })(),
    lastRunAt: daysAgo(7, 3, 30),
  },
];

// ─── Audit Log ────────────────────────────────────────────────────────────────
const AUDIT_EVENTS_RAW: Array<{
  flow: AuditEvent["flow"];
  outcome: string;
  issueKey: string | null;
  error: string | null;
  severity: AuditEvent["severity"];
  hoursAgo: number;
}> = [
  { flow: "gws_mailbox", outcome: "succeeded", issueKey: "WOH-1000", error: null, severity: "INFO", hoursAgo: 1 },
  { flow: "akamai_access", outcome: "setup_email_sent", issueKey: "WOH-1000", error: null, severity: "INFO", hoursAgo: 2 },
  { flow: "gws_mailbox", outcome: "failed", issueKey: "WOH-1013", error: "TransportError: timeout", severity: "ERROR", hoursAgo: 5 },
  { flow: "gws_mailbox", outcome: "deferred_to_doj", issueKey: "WOH-1007", error: null, severity: "INFO", hoursAgo: 8 },
  { flow: "drive_transfer", outcome: "suspended", issueKey: "VSD-1005", error: null, severity: "INFO", hoursAgo: 10 },
  { flow: "akamai_access", outcome: "invalid_email", issueKey: "VSD-1009", error: null, severity: "WARNING", hoursAgo: 14 },
  { flow: "scheduled_credentials", outcome: "sent", issueKey: null, error: null, severity: "INFO", hoursAgo: 20 },
  { flow: "gws_mailbox", outcome: "already_processed", issueKey: "WOH-1008", error: null, severity: "INFO", hoursAgo: 26 },
  { flow: "drive_transfer", outcome: "deferred_to_lwd", issueKey: "VSD-1006", error: null, severity: "INFO", hoursAgo: 30 },
  { flow: "gws_mailbox", outcome: "succeeded", issueKey: "WOH-1012", error: null, severity: "INFO", hoursAgo: 36 },
  { flow: "toggle_change", outcome: "changed", issueKey: null, error: null, severity: "INFO", hoursAgo: 48 },
  { flow: "data_transfer", outcome: "transfer_started", issueKey: "VSD-1015", error: null, severity: "INFO", hoursAgo: 52 },
  { flow: "gws_mailbox", outcome: "transition_failed", issueKey: "WOH-1016", error: "JIRA API 500", severity: "ERROR", hoursAgo: 60 },
  { flow: "akamai_access", outcome: "succeeded", issueKey: "WOH-1012", error: null, severity: "INFO", hoursAgo: 66 },
  { flow: "drive_transfer", outcome: "accepted", issueKey: "VSD-1018", error: null, severity: "INFO", hoursAgo: 72 },
  { flow: "scheduled_credentials", outcome: "failed", issueKey: null, error: "SMTPAuthenticationError", severity: "ERROR", hoursAgo: 80 },
  { flow: "gws_mailbox", outcome: "gws_creation_disabled", issueKey: "VSD-1021", error: null, severity: "INFO", hoursAgo: 88 },
  { flow: "drive_transfer", outcome: "suspend_failed", issueKey: "VSD-1024", error: "403 Forbidden", severity: "ERROR", hoursAgo: 96 },
  { flow: "akamai_access", outcome: "akamai_disabled", issueKey: "WOH-1025", error: null, severity: "INFO", hoursAgo: 104 },
  { flow: "data_transfer", outcome: "failed", issueKey: "VSD-1022", error: "DataTransferError: destination user suspended", severity: "ERROR", hoursAgo: 112 },
];

export const MOCK_AUDIT_LOG: AuditEvent[] = AUDIT_EVENTS_RAW.map((r) => {
  const d = new Date();
  d.setHours(d.getHours() - r.hoursAgo);
  return {
    flow: r.flow,
    outcome: r.outcome,
    issueKey: r.issueKey,
    error: r.error,
    timestamp: d.toISOString(),
    severity: r.severity,
  };
});

// ─── Employee Progress ─────────────────────────────────────────────────────────
export const MOCK_EMPLOYEE_DB: Record<string, EmployeeProgress[]> = {
  "rahul.sharma@verse.in": [
    {
      email: "rahul.sharma@verse.in",
      type: "onboarding",
      issueKey: "WOH-1000",
      jiraUrl: "https://wohlig.atlassian.net/browse/WOH-1000",
      startedAt: daysAgo(5, 9, 0),
      overallStatus: "completed",
      steps: [
        { flow: "gws_mailbox", issueKey: "WOH-1000", outcome: "succeeded", completedAt: daysAgo(5, 9, 12), status: "done" },
        { flow: "akamai_access", issueKey: "WOH-1000", outcome: "setup_email_sent", completedAt: daysAgo(5, 9, 15), status: "done" },
        { flow: "scheduled_credentials", issueKey: null, outcome: "sent", completedAt: daysAgo(4, 9, 0), status: "done" },
      ],
    },
  ],
  "ananya.krishna@verse.in": [
    {
      email: "ananya.krishna@verse.in",
      type: "onboarding",
      issueKey: "WOH-1013",
      jiraUrl: "https://wohlig.atlassian.net/browse/WOH-1013",
      startedAt: daysAgo(2, 10, 0),
      overallStatus: "failed",
      steps: [
        { flow: "gws_mailbox", issueKey: "WOH-1013", outcome: "failed", completedAt: daysAgo(2, 10, 22), status: "failed" },
        { flow: "akamai_access", issueKey: "WOH-1013", outcome: null, completedAt: null, status: "pending" },
        { flow: "scheduled_credentials", issueKey: null, outcome: null, completedAt: null, status: "pending" },
      ],
    },
  ],
  "rohan.joshi@verse.in": [
    {
      email: "rohan.joshi@verse.in",
      type: "onboarding",
      issueKey: "WOH-1012",
      jiraUrl: "https://wohlig.atlassian.net/browse/WOH-1012",
      startedAt: daysAgo(3, 9, 0),
      overallStatus: "completed",
      steps: [
        { flow: "gws_mailbox", issueKey: "WOH-1012", outcome: "succeeded", completedAt: daysAgo(3, 9, 14), status: "done" },
        { flow: "akamai_access", issueKey: "WOH-1012", outcome: "succeeded", completedAt: daysAgo(3, 9, 20), status: "done" },
        { flow: "scheduled_credentials", issueKey: null, outcome: "sent", completedAt: daysAgo(2, 9, 0), status: "done" },
      ],
    },
    {
      email: "rohan.joshi@verse.in",
      type: "offboarding",
      issueKey: "VSD-1005",
      jiraUrl: "https://wohlig.atlassian.net/browse/VSD-1005",
      startedAt: daysAgo(1, 14, 0),
      overallStatus: "in_progress",
      steps: [
        { flow: "drive_transfer", issueKey: "VSD-1005", outcome: "suspended", completedAt: daysAgo(1, 14, 10), status: "done" },
        { flow: "data_transfer", issueKey: "VSD-1005", outcome: null, completedAt: null, status: "in_progress" },
      ],
    },
  ],
  "kavya.menon@verse.in": [
    {
      email: "kavya.menon@verse.in",
      type: "offboarding",
      issueKey: "VSD-1024",
      jiraUrl: "https://wohlig.atlassian.net/browse/VSD-1024",
      startedAt: daysAgo(4, 15, 0),
      overallStatus: "failed",
      steps: [
        { flow: "drive_transfer", issueKey: "VSD-1024", outcome: "suspend_failed", completedAt: daysAgo(4, 15, 18), status: "failed" },
        { flow: "data_transfer", issueKey: "VSD-1024", outcome: null, completedAt: null, status: "pending" },
      ],
    },
  ],
  "nikhil.verma@verse.in": [
    {
      email: "nikhil.verma@verse.in",
      type: "onboarding",
      issueKey: "WOH-1007",
      jiraUrl: "https://wohlig.atlassian.net/browse/WOH-1007",
      startedAt: daysAgo(2, 9, 0),
      overallStatus: "in_progress",
      steps: [
        { flow: "gws_mailbox", issueKey: "WOH-1007", outcome: "deferred_to_doj", completedAt: daysAgo(2, 9, 5), status: "in_progress" },
        { flow: "akamai_access", issueKey: "WOH-1007", outcome: null, completedAt: null, status: "pending" },
        { flow: "scheduled_credentials", issueKey: null, outcome: null, completedAt: null, status: "pending" },
      ],
    },
  ],
};
