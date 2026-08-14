import { cn } from "@/lib/utils";

export function ToggleSwitch({
  on,
  disabled,
  size = "default",
  onChange,
}: {
  on: boolean;
  disabled?: boolean;
  size?: "default" | "sm";
  onChange: (v: boolean) => void;
}) {
  const track = size === "sm" ? "h-5 w-9" : "h-6 w-11";
  const knob = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  const translate = size === "sm" ? "translate-x-4" : "translate-x-5";

  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={cn(
        "relative inline-flex shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
        track,
        on ? "bg-blue-600" : "bg-slate-200"
      )}
    >
      <span
        className={cn(
          "pointer-events-none inline-block rounded-full bg-white shadow-md ring-0 transition-transform",
          knob,
          on ? translate : "translate-x-0"
        )}
      />
    </button>
  );
}
