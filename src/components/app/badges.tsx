import { Badge } from "@/components/ui/badge";
import { titleCase } from "@/lib/utils";

const STATUS_STYLE = {
  success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:ring-emerald-900/50",
  warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:ring-amber-900/50",
  error:   "bg-red-50 text-red-700 ring-1 ring-red-200 dark:bg-red-950/40 dark:text-red-300 dark:ring-red-900/50",
  info:    "bg-sky-50 text-sky-700 ring-1 ring-sky-200 dark:bg-sky-950/40 dark:text-sky-300 dark:ring-sky-900/50",
  muted:   "bg-slate-100 text-slate-600 ring-1 ring-slate-200 dark:bg-neutral-800 dark:text-neutral-400 dark:ring-neutral-800",
  purple:  "bg-purple-50 text-purple-700 ring-1 ring-purple-200 dark:bg-purple-950/40 dark:text-purple-300 dark:ring-purple-900/50",
  orange:  "bg-orange-50 text-orange-700 ring-1 ring-orange-200 dark:bg-orange-950/40 dark:text-orange-300 dark:ring-orange-900/50",
} as const;

type StatusKey = keyof typeof STATUS_STYLE;

const OUTCOME_MAP: Record<string, StatusKey> = {
  succeeded: "success",
  sent: "success",
  setup_email_sent: "success",
  transfer_started: "success",
  suspended: "success",
  accepted: "success",
  transfer_email_sent: "success",
  deferred_to_lwd: "warning",
  deferred_to_doj: "warning",
  pending: "warning",
  already_processed: "muted",
  duplicate_offboarding_ticket: "muted",
  already_done: "muted",
  checked_for_retry: "muted",
  changed: "purple",
  failed: "error",
  invalid_email: "error",
  suspend_failed: "error",
  transition_failed: "error",
  akamai_disabled: "orange",
  gws_creation_disabled: "orange",
  data_transfer_disabled: "orange",
  automation_disabled: "orange",
  ignored: "muted",
  // Real, actionable gaps -- the backend remaps a bare "ignored" + reason
  // (e.g. no Manager set) to one of these instead of the vague original,
  // so the status itself says what's wrong instead of needing a second,
  // redundant "Error" badge next to it.
  missing_manager: "error",
  missing_employee_email: "error",
};

// Statuses that already read as a real problem on their own -- a ticket
// whose current status is one of these doesn't need a separate "Error"
// badge bolted on too; that was showing "ignored" + "Error" side by side,
// which just reads as contradictory. hasError is still worth flagging
// separately for a ticket that LOOKS fine now (e.g. "succeeded") but had a
// real failure earlier in its history.
const SELF_EVIDENT_ERROR_OUTCOMES = new Set(
  Object.keys(OUTCOME_MAP).filter((k) => OUTCOME_MAP[k] === "error")
);

export function isSelfEvidentError(outcome: string): boolean {
  return SELF_EVIDENT_ERROR_OUTCOMES.has(outcome);
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const key = OUTCOME_MAP[outcome] ?? "info";
  return (
    <Badge variant="outline" className={STATUS_STYLE[key]}>
      {titleCase(outcome)}
    </Badge>
  );
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, StatusKey> = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
    DEFAULT: "muted",
  };
  const key = map[severity] ?? "muted";
  return (
    <Badge variant="outline" className={STATUS_STYLE[key]}>
      {severity}
    </Badge>
  );
}

const FLOW_CONFIG: Record<string, { label: string; style: StatusKey }> = {
  gws_mailbox: { label: "Mailbox", style: "info" },
  akamai_access: { label: "Akamai", style: "purple" },
  drive_transfer: { label: "Drive Transfer", style: "warning" },
  gws_suspend: { label: "Account Suspension", style: "orange" },
  scheduled_credentials: { label: "Credentials", style: "success" },
  data_transfer: { label: "Data Transfer", style: "orange" },
  toggle_change: { label: "Toggle", style: "muted" },
};

export function FlowBadge({ flow }: { flow: string }) {
  const cfg = FLOW_CONFIG[flow] ?? { label: flow, style: "muted" as const };
  return (
    <Badge variant="outline" className={STATUS_STYLE[cfg.style]}>
      {cfg.label}
    </Badge>
  );
}
