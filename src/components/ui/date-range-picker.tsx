import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import type { DateRange } from "react-day-picker";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

interface DateRangePickerProps {
  from?: string;        // YYYY-MM-DD
  to?: string;          // YYYY-MM-DD
  onRangeChange: (from: string, to: string) => void;
  placeholder?: string;
  className?: string;
}

function parseYMD(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

function formatLabel(from: string | undefined, to: string | undefined): string {
  const f = parseYMD(from);
  const t = parseYMD(to);
  if (f && t) return `${format(f, "dd MMM")} – ${format(t, "dd MMM yyyy")}`;
  if (f)      return `${format(f, "dd MMM yyyy")} → …`;
  return "";
}

export function DateRangePicker({
  from,
  to,
  onRangeChange,
  placeholder = "Select date range",
  className,
}: DateRangePickerProps) {
  const [open, setOpen] = useState(false);

  // Keep internal range in sync when controlled values change (e.g. preset button clicked)
  const fromDate = parseYMD(from);
  const toDate   = parseYMD(to);

  function handleSelect(r: DateRange | undefined) {
    if (r?.from && r?.to) {
      onRangeChange(format(r.from, "yyyy-MM-dd"), format(r.to, "yyyy-MM-dd"));
      setOpen(false);
    } else if (r?.from) {
      onRangeChange(format(r.from, "yyyy-MM-dd"), "");
    }
  }

  function clear(e: React.MouseEvent) {
    e.stopPropagation();
    onRangeChange("", "");
    setOpen(false);
  }

  const label = formatLabel(from, to);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm shadow-sm transition-colors",
            "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            !label && "text-slate-400",
            label  && "text-slate-800",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="flex-1 text-left">{label || placeholder}</span>
          {label && (
            <span
              role="button"
              aria-label="Clear range"
              className="text-slate-300 hover:text-slate-500 transition-colors"
              onClick={clear}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0">
        <Calendar
          mode="range"
          selected={{ from: fromDate, to: toDate }}
          onSelect={handleSelect}
          numberOfMonths={2}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
