import { CheckCircle2, XCircle, Circle, MinusCircle, Loader2, Clock } from "lucide-react";
import { formatIST, cn } from "@/lib/utils";
import type { Stage } from "@/api";

// Same status vocabulary/color language as EmployeeSearch.tsx's STEP_CONFIG
// -- re-declared here rather than imported so this shared component has no
// dependency on a page file.
const STAGE_STATUS_CONFIG: Record<Stage["status"], { icon: React.ElementType; className: string; spin?: boolean }> = {
  done: {
    icon: CheckCircle2,
    className: "text-emerald-600 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-900/50",
  },
  in_progress: {
    icon: Loader2,
    className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50",
    spin: true,
  },
  pending: {
    icon: Circle,
    className: "text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800",
  },
  // A human needs to act (fill in a Jira field) before this step can
  // proceed -- distinct from "pending" (a real future date, not yet due),
  // which looks identical to "not started yet" (also an empty grey circle,
  // same as skipped/not-reached steps). Amber clock, same color language
  // "in_progress" already uses, so a real action-needed step reads as
  // clearly different from both a genuine failure (red) and a step that
  // simply hasn't been reached (grey) -- confirmed live 2026-09-05 that
  // reusing "pending" for this made a real "waiting for HR" step
  // indistinguishable from an untouched one.
  waiting: {
    icon: Clock,
    className: "text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/40 border-amber-200 dark:border-amber-900/50",
  },
  skipped: {
    icon: MinusCircle,
    className: "text-slate-400 dark:text-neutral-500 bg-slate-50 dark:bg-neutral-900 border-slate-200 dark:border-neutral-800",
  },
  failed: {
    icon: XCircle,
    className: "text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/40 border-red-200 dark:border-red-900/50",
  },
};

export function StageTimeline({ stages, className }: { stages: Stage[]; className?: string }) {
  if (stages.length === 0) {
    return <p className={cn("text-sm text-slate-500 dark:text-neutral-400 px-1 py-2", className)}>No stage data available.</p>;
  }

  return (
    <ol className={cn("relative space-y-5 pl-2", className)}>
      {stages.map((stage, i) => {
        const cfg = STAGE_STATUS_CONFIG[stage.status];
        const Icon = cfg.icon;
        const isLast = i === stages.length - 1;
        return (
          <li key={i} className="relative flex gap-3">
            {!isLast && (
              <span className="absolute left-[13px] top-7 h-[calc(100%+0.25rem)] w-px bg-slate-200 dark:bg-neutral-800" />
            )}
            <span
              className={cn(
                "relative z-10 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-full border",
                cfg.className
              )}
            >
              <Icon className={cn("h-3.5 w-3.5", cfg.spin && "animate-spin")} />
            </span>
            <div className="flex-1 min-w-0 pb-0.5">
              <p className="text-sm font-medium text-slate-800 dark:text-neutral-200">{stage.label}</p>
              <p className="text-xs text-slate-400 dark:text-neutral-500 mt-0.5">
                {stage.timestamp ? formatIST(stage.timestamp) : "—"}
              </p>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
