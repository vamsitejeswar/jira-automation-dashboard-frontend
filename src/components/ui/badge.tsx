import { type VariantProps, cva } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
  {
    variants: {
      variant: {
        default: "bg-primary/12 text-primary",
        success: "bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200",
        warning: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
        error: "bg-red-50 text-red-700 ring-1 ring-red-200",
        info: "bg-sky-50 text-sky-700 ring-1 ring-sky-200",
        muted: "bg-slate-100 text-slate-600 ring-1 ring-slate-200",
        purple: "bg-purple-50 text-purple-700 ring-1 ring-purple-200",
        orange: "bg-orange-50 text-orange-700 ring-1 ring-orange-200",
      },
    },
    defaultVariants: { variant: "default" },
  }
);

interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}

const OUTCOME_MAP: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
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
const SELF_EVIDENT_ERROR_OUTCOMES = new Set(Object.keys(OUTCOME_MAP).filter((k) => OUTCOME_MAP[k] === "error"));

export function isSelfEvidentError(outcome: string): boolean {
  return SELF_EVIDENT_ERROR_OUTCOMES.has(outcome);
}

export function OutcomeBadge({ outcome }: { outcome: string }) {
  const variant = OUTCOME_MAP[outcome] ?? "info";
  return <Badge variant={variant}>{outcome.replace(/_/g, " ")}</Badge>;
}

export function SeverityBadge({ severity }: { severity: string }) {
  const map: Record<string, VariantProps<typeof badgeVariants>["variant"]> = {
    INFO: "info",
    WARNING: "warning",
    ERROR: "error",
    DEFAULT: "muted",
  };
  return <Badge variant={map[severity] ?? "muted"}>{severity}</Badge>;
}

const FLOW_CONFIG: Record<string, { label: string; variant: VariantProps<typeof badgeVariants>["variant"] }> = {
  gws_mailbox: { label: "Mailbox", variant: "info" },
  akamai_access: { label: "Akamai", variant: "purple" },
  drive_transfer: { label: "Drive Transfer", variant: "warning" },
  scheduled_credentials: { label: "Credentials", variant: "success" },
  data_transfer: { label: "Data Transfer", variant: "orange" },
  toggle_change: { label: "Toggle", variant: "muted" },
};

export function FlowBadge({ flow }: { flow: string }) {
  const cfg = FLOW_CONFIG[flow] ?? { label: flow, variant: "muted" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}
