# Admin Dashboard — React Build Prompt

This is a ready-to-use prompt/spec for building a React admin dashboard for the
Jira onboarding/offboarding automation (`verse-jira-onboarding`). Hand this
whole file to an engineer or an AI coding agent as the build brief.

## 0. Context this is grounded in (read before building)

The automation today has **no JSON API** — only:
- `GET/POST /admin/toggles?token=...` — server-rendered HTML, gated by a single
  shared `INTERNAL_TASK_TOKEN` in the query string (fine for one admin
  clicking a link, not fine for a real multi-user dashboard).
- The MCP tool `get_anomaly_summary` (`verse-jira-anomalies-mcp`) — reads
  Cloud Logging, meant for an AI agent (Gemini Enterprise), not a browser.
- Ticket status lives in Firestore/SQLite (`app/store.py`) — internal only,
  no REST surface.
- Full audit trail lives in **Google Cloud Logging** (`jsonPayload.flow`,
  `outcome`, `issue_key`, `error`, `timestamp`, ...), **30-day retention** on
  the default log bucket, not a database.

**This means Part 1 of this project is backend work, not just frontend** —
see Section 2. Don't start on React until the API contract in Section 2 is
real and running, even as a stub.

## 1. What the dashboard needs to show

Grounded in the real flows this automation runs:

| Flow | What it does | Real outcomes (`app/services/anomaly_analytics.py`) |
|---|---|---|
| `gws_mailbox` | Onboarding mailbox creation | `succeeded`, `deferred_to_doj`, `failed`, `already_processed`, `gws_creation_disabled`, `transition_failed` |
| `akamai_access` | Akamai/ZScaler access clone | `setup_email_sent`, `succeeded`, `failed`, `invalid_email`, `akamai_disabled` |
| `drive_transfer` | Offboarding suspend + Drive transfer | `suspended`, `deferred_to_lwd`, `accepted`, `common`, `duplicate_offboarding_ticket`, `failed`, `suspend_failed` |
| `scheduled_credentials` | Daily 9am deferred-credential job | `sent`, `failed` |
| `data_transfer` | Manual Drive transfer trigger | `transfer_started`, `failed` |
| `toggle_change` | Admin toggle edits | `changed` |

Every event carries: `flow`, `outcome`, `issue_key`, `error` (if any),
`timestamp`, plus flow-specific fields (`email`, `manager_email`,
`clone_from_email`, `destination_email`, etc.).

Every ticket's Jira comment trail now includes (as of the latest backend
change) a **decision comment** (who approved, what, optional note) and a
**completion comment** with a literal `flow=... outcome=... issue=...
timestamp=...` line matching the Cloud Logging entry byte-for-byte — the
dashboard's ticket detail view should surface this pairing directly, not just
raw log lines.

## 1a. Anomalies

There is already a real, working anomaly classifier —
`app/services/anomaly_analytics.py` — used today by two things: the
`get_anomaly_summary` MCP tool (`mcp_server/tools/anomalies.py`, consumed by
a Gemini agent) and a scheduled job, `POST
/internal/send-weekly-anomaly-digest` (`app/routers/scheduled_tasks.py`),
which emails a weekly summary. **The dashboard must call this same logic
through a new endpoint, not reimplement anomaly detection in the frontend or
in a second backend code path** — `fetch_anomaly_summary()` is the single
source of truth and already has the classification rules (an *allowlist* of
known-good outcomes in `_NORMAL_OUTCOMES`; anything else, or an `"ignored"`
outcome that carries a `"reason"`, counts as an anomaly). If a future flow
adds a new outcome string, it shows up as an anomaly automatically until
someone deliberately allowlists it — the dashboard should reflect that
behavior as-is, not filter differently.

Add:
```
GET /api/admin/anomalies?days=7&include_normal=false
  -> {
       days, total_events_scanned, total_anomalies,
       breakdown_by_flow_and_outcome: [{ flow, outcome, count }, ...],  // most frequent first
       anomalies: [{ timestamp, severity, flow, outcome, issue_key, reason, error }, ...],
       all_events?: [...]   // only present when include_normal=true
     }
```
This is a thin wrapper: call `fetch_anomaly_summary(logging_client, days,
include_normal=...)` and shape the response exactly like
`get_anomaly_summary` already does in the MCP tool — don't invent a
different shape for the two consumers of the same data.

Dashboard surfaces for this:
- **Overview** gets back its "recent anomalies" feed (last ~10 events from
  `GET /api/admin/anomalies?days=7`), each row linking to the ticket detail
  page via `issue_key`.
- A dedicated **Anomalies** page (`/anomalies`) — the `breakdown_by_flow_and_outcome`
  table as a sortable summary (flow, outcome, count), a date-range control
  that maps to `?days=`, an `include_normal` toggle to flip into "show me
  everything" mode (matching the MCP tool's own `include_normal` semantics),
  and the full anomaly list below with the same reason/error detail the
  weekly digest email already sends. Each row's ticket key links to
  `/tickets/:issueKey`.
- Ticket detail page: if any audit event for this `issue_key` is itself an
  anomaly, flag it inline in the timeline (small warning badge) rather than
  making the admin cross-reference the separate Anomalies page.

Since Cloud Logging retention is 30 days on the default bucket, `days` should
be capped at 30 in the UI's date picker — asking for more will just come back
empty/truncated, and the UI should say so rather than silently show nothing.

## 1b. Upcoming scheduled (cron) job runs

Three Cloud Scheduler jobs drive this automation, each hitting an
`/internal/*` endpoint in `app/routers/scheduled_tasks.py`:

| Job | Endpoint | Schedule (per `docs/DEPLOYMENT.md`) |
|---|---|---|
| `jira-automation-onboarding-send-pending-credentials` | `POST /internal/send-pending-credentials` | `0 9 * * *` (Asia/Calcutta) — daily 9:00 AM IST |
| *(offboarding job — exact Cloud Scheduler job name/schedule not committed to this repo)* | `POST /internal/process-due-offboarding` | not documented in-repo — read live from Cloud Scheduler |
| *(digest job — exact Cloud Scheduler job name/schedule not committed to this repo)* | `POST /internal/send-weekly-anomaly-digest` | not documented in-repo — read live from Cloud Scheduler |

Only the credentials job's schedule happens to be written down in
`docs/DEPLOYMENT.md` today — the other two jobs are real (their endpoints
exist and are exercised), but their actual cron expression and job name live
only in Cloud Scheduler itself, configured via ad hoc `gcloud` commands, not
as version-controlled IaC. **This is exactly why the dashboard must read
schedules live from the Cloud Scheduler API rather than hardcode the table
above** — the table is a starting point for what to expect, not a source of
truth to embed in code.

Add:
```
GET /api/admin/scheduled-jobs
  -> {
       jobs: [{
         name,                 // e.g. "jira-automation-onboarding-send-pending-credentials"
         endpoint,              // the /internal/... path it calls
         schedule,              // raw cron string, e.g. "0 9 * * *"
         time_zone,             // e.g. "Asia/Calcutta"
         state,                 // ENABLED | PAUSED | ...
         next_run_at,           // Cloud Scheduler Job.schedule_time, ISO 8601 UTC
         last_run_at            // Cloud Scheduler Job.last_attempt_time, ISO 8601 UTC (nullable)
       }, ...]
     }
```
Backed by `google.cloud.scheduler_v1.CloudSchedulerClient().list_jobs(parent=
"projects/gemini-project-n1/locations/asia-south1")` — the `Job` resource
already carries `schedule_time` (next run) and `last_attempt_time` (last run)
as output-only fields, so there's no cron-parsing to write by hand.

Dashboard surface: an **"Upcoming Runs"** card on the Overview page — one row
per job, showing name, next run (in IST, per Section 7's timezone rule), and
a status dot for ENABLED/PAUSED. Sort by soonest `next_run_at` first. Link
each row's endpoint name to any tickets/audit entries already produced by
that flow (e.g. the credentials job's rows show for `scheduled_credentials`
in the Anomalies/Audit Log views) so an admin can correlate "job ran" with
"here's what it did."

## 2. Required backend API (build this first, even as a thin FastAPI layer)

Add a new `app/routers/admin_api.py` (JSON, not HTML) with:

```
GET  /api/admin/tickets
  ?flow=akamai_access&outcome=failed&project=WOH&from=2026-08-01&to=2026-08-14&q=<issue_key or email>
  &page=1&page_size=25
  -> { total, page, results: [{ issue_key, flow, outcome, employee_email,
       manager_email, updated_at, has_error }] }

GET  /api/admin/tickets/{issue_key}
  -> { issue_key, jira_url, current_status, fields: {...}, comments: [...],
       audit_events: [...] }   # comments from Jira API, audit_events from
                                # Cloud Logging filtered to this issue_key

GET  /api/admin/kpis?from=...&to=...
  -> { onboarded_count, offboarded_count, akamai_clones, failures_count,
       by_flow: {...}, by_day: [...] }   # for charts

GET  /api/admin/toggles
POST /api/admin/toggles   { name, value }
  -> same 7 toggles as today's /admin/toggles, just JSON

GET  /api/admin/audit-log
  ?flow=...&severity=WARNING&from=...&to=...&page=...
  -> paginated raw Cloud Logging entries (server-side query, same filter
     shape as docs/AUDIT_LOG_REFERENCE.md's gcloud query)

GET  /api/admin/anomalies?days=7&include_normal=false        # see Section 1a
GET  /api/admin/scheduled-jobs                                 # see Section 1b
```

**Auth**: replace the shared-token-in-URL pattern with real admin auth before
this ships broadly — since this org is Google Workspace-based, the natural
fit is **Google OAuth (Sign in with Google), restricted to `@verse.in` /
`@wohlig.com` accounts**, not a new username/password system. Issue a
short-lived session cookie or JWT after Google sign-in; every `/api/admin/*`
route checks it.

## 3. Tech stack (opinionated, current best-practice as of 2026)

- **Vite + React 18 + TypeScript** — not Next.js; this is an internal SPA
  behind auth, no need for SSR/SEO.
- **TanStack Query** for all server state (tickets, KPIs, toggles) — no
  Redux. Toggles specifically use optimistic updates with rollback on error.
- **TanStack Table** for the tickets grid — server-side pagination/sorting/
  filtering (the dataset will outgrow client-side filtering fast).
- **React Router v6** (or v7 in library mode) for `/tickets`, `/tickets/:id`,
  `/settings`, `/audit-log`, `/` (KPI overview).
- **Tailwind CSS + shadcn/ui** for components (Table, Dialog, Switch for
  toggles, Tabs, Badge for status pills, DateRangePicker, Command palette for
  search).
- **Recharts** (or **Tremor**, built on Recharts) for the KPI charts —
  onboarded/offboarded over time, failure rate by flow, a simple bar/line
  combo. Follow a real design system for the charts (accessible categorical
  palette, tabular-nums for numbers, proper empty/loading states) rather than
  default chart-library styling.
- **Zod** for runtime validation of API responses (don't trust the network).
- **date-fns** (not moment) for date range handling; store all timestamps as
  ISO 8601 UTC, display in IST (`Asia/Kolkata`) since that's this org's
  operating timezone (matches the 9am/9pm scheduled jobs already built).
- **Vitest + React Testing Library** for component tests; **Playwright** for
  a handful of critical-path e2e tests (login → view ticket → flip a toggle).

## 4. Information architecture

1. **Overview** (`/`) — KPI tiles (onboarded this week/month, offboarded,
   Akamai clones, failure count) + a trend chart + a "recent anomalies"
   feed (last 10 anomaly events from `GET /api/admin/anomalies`, click-through
   to ticket) + the "Upcoming Runs" scheduled-jobs card from Section 1b.
2. **Tickets** (`/tickets`) — the main table. Columns: issue key (links to
   real Jira), flow, current status (color-coded pill: green=succeeded,
   yellow=deferred/pending, red=failed), employee/manager email, last
   updated. Filters: flow, outcome/status, project (WOH/VSD), date range,
   free-text search (issue key or email). Row click → detail drawer or page.
3. **Ticket detail** (`/tickets/:issueKey`) — a timeline combining Jira
   comments and audit-log entries in chronological order, visually pairing
   each decision comment with its completion comment and log reference (this
   is the one place worth custom design, not just a generic list — it's the
   audit trail this whole feature was built for).
4. **Settings / Toggles** (`/settings`) — the 7 toggles as labeled switches
   with a one-line description of what each does (pull straight from
   `docs/AUDIT_LOG_REFERENCE.md`'s wording), a "changed by / when" note per
   toggle (from `toggle_change` audit events), and a confirmation step for
   `automation_enabled` specifically (flipping the master switch off is a big
   deal — don't let it be a stray click).
5. **Anomalies** (`/anomalies`) — see Section 1a: breakdown-by-flow-and-outcome
   table, `days`/`include_normal` controls, full anomaly list linking to
   tickets. This is the browser-native equivalent of the `get_anomaly_summary`
   MCP tool and the weekly digest email — same data, three surfaces.
6. **Audit Log** (`/audit-log`) — a raw, filterable view over Cloud Logging
   for when someone needs to dig deeper than the ticket or Anomalies view
   provides. Mirrors the `gcloud logging read` query already documented,
   just in the browser.

## 6. Data model (TypeScript, matches the real backend shapes)

```ts
type Flow =
  | "gws_mailbox"
  | "akamai_access"
  | "drive_transfer"
  | "scheduled_credentials"
  | "data_transfer"
  | "toggle_change";

interface AuditEvent {
  flow: Flow;
  outcome: string;
  issueKey: string | null;
  error: string | null;
  timestamp: string; // ISO 8601 UTC
  severity: "INFO" | "WARNING" | "ERROR";
  // flow-specific extras land here verbatim (email, managerEmail, etc.)
  [key: string]: unknown;
}

interface TicketSummary {
  issueKey: string;
  flow: Flow;
  currentStatus: string;
  employeeEmail: string | null;
  managerEmail: string | null;
  updatedAt: string;
  hasError: boolean;
}

interface TicketDetail extends TicketSummary {
  jiraUrl: string;
  comments: { author: string; body: string; createdAt: string }[];
  auditEvents: AuditEvent[];
}

interface Toggle {
  name:
    | "automation_enabled"
    | "email_sending_enabled"
    | "gws_account_creation_enabled"
    | "retry_on_update_enabled"
    | "akamai_enabled"
    | "gws_account_suspend_enabled"
    | "data_transfer_enabled";
  value: boolean;
  lastChangedAt: string | null;
  lastChangedBy: string | null;
}

interface AnomalySummary {
  days: number;
  totalEventsScanned: number;
  totalAnomalies: number;
  breakdownByFlowAndOutcome: { flow: Flow; outcome: string; count: number }[];
  anomalies: {
    timestamp: string;
    severity: "DEFAULT" | "INFO" | "WARNING" | "ERROR";
    flow: Flow;
    outcome: string;
    issueKey: string | null;
    reason: string | null;
    error: string | null;
  }[];
  allEvents?: AnomalySummary["anomalies"]; // present only when include_normal=true
}

interface ScheduledJob {
  name: string;
  endpoint: string;
  schedule: string; // raw cron string, e.g. "0 9 * * *"
  timeZone: string; // e.g. "Asia/Calcutta"
  state: "ENABLED" | "PAUSED" | string;
  nextRunAt: string; // ISO 8601 UTC
  lastRunAt: string | null;
}
```

## 7. Non-negotiables (best practices, don't skip these)

- **No secrets in the frontend.** All Jira/GWS calls stay server-side; the
  React app only ever talks to `/api/admin/*`.
- **Real auth**, not a shared token in a URL (see Section 2).
- **Empty, loading, and error states designed on purpose** for every view —
  not just a spinner and a blank table. A dashboard an admin checks daily
  needs to look intentional when there's nothing to show, not broken.
- **Optimistic toggle updates with visible rollback** if the PATCH fails —
  admins need to trust the switch reflects reality.
- **Server-side pagination/filtering for tickets and audit log** from day
  one — do not fetch-all-and-filter-in-the-browser; the log volume will
  make that fall over fast (30-day retention, but still real volume).
- **Timezone correctness** — store/transmit UTC, display IST, be explicit
  about which in the UI (a raw timestamp with no zone label is a bug here,
  given this project's history of exact 9am/9pm scheduling).
- **Accessible by default** — proper focus states, semantic table markup,
  color-coded status pills that also carry text/icon (not color alone).
- **Don't duplicate anomaly-classification logic in the frontend.** The
  allowlist in `_NORMAL_OUTCOMES` (Section 1a) is the single source of truth
  used by the MCP tool and the weekly digest — the dashboard must call
  `GET /api/admin/anomalies` for this, never reimplement "what counts as
  anomalous" as a client-side rule.
- **Don't hardcode cron schedules.** Section 1b's table is context, not a
  constant to embed — `GET /api/admin/scheduled-jobs` must read live from
  Cloud Scheduler so a schedule change there doesn't silently desync the UI.

## 8. What to hand back when building starts

Before writing component code, produce:
1. A short design plan (palette, type pairing, layout concept) — this is an
   internal ops tool, so favor a polished, information-dense, utilitarian
   treatment over a flashy marketing-site look.
2. The API contract from Section 2 as an actual OpenAPI/Pydantic schema in
   the FastAPI backend, before any frontend component is written against it.
3. A component inventory mapped to the IA in Section 4, before implementation.
