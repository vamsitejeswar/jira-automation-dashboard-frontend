import { useState } from "react";
import { CalendarIcon, X } from "lucide-react";
import { format, parse, isValid } from "date-fns";
import { Popover, PopoverContent, PopoverTrigger } from "./popover";
import { Calendar } from "./calendar";
import { cn } from "@/lib/utils";

interface DatePickerProps {
  value?: string;           // YYYY-MM-DD
  onChange?: (v: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  clearable?: boolean;
}

function parseYMD(s: string | undefined): Date | undefined {
  if (!s) return undefined;
  const d = parse(s, "yyyy-MM-dd", new Date());
  return isValid(d) ? d : undefined;
}

export function DatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
  className,
  disabled,
  clearable = true,
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseYMD(value);

  function handleSelect(date: Date | undefined) {
    onChange?.(date ? format(date, "yyyy-MM-dd") : "");
    if (date) setOpen(false);
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          disabled={disabled}
          className={cn(
            "inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-left shadow-sm transition-colors",
            "hover:bg-slate-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1",
            "disabled:opacity-50 disabled:cursor-not-allowed",
            !selected && "text-slate-400",
            selected && "text-slate-800",
            className
          )}
        >
          <CalendarIcon className="h-4 w-4 text-slate-400 flex-shrink-0" />
          <span className="flex-1">
            {selected ? format(selected, "dd MMM yyyy") : placeholder}
          </span>
          {clearable && selected && (
            <span
              role="button"
              aria-label="Clear date"
              className="text-slate-300 hover:text-slate-500 transition-colors"
              onClick={(e) => {
                e.stopPropagation();
                onChange?.("");
                setOpen(false);
              }}
            >
              <X className="h-3.5 w-3.5" />
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent className="w-auto">
        <Calendar
          mode="single"
          selected={selected}
          onSelect={handleSelect}
          autoFocus
        />
      </PopoverContent>
    </Popover>
  );
}
