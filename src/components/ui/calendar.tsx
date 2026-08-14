import { DayPicker } from "react-day-picker";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export type CalendarProps = React.ComponentProps<typeof DayPicker>;

export function Calendar({ className, classNames, showOutsideDays = true, ...props }: CalendarProps) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 select-none", className)}
      classNames={{
        months:           "flex flex-row gap-6",
        month:            "flex flex-col gap-4",
        month_caption:    "flex justify-center pt-1 relative items-center h-7",
        caption_label:    "text-sm font-semibold text-slate-800",
        nav:              "flex items-center",
        button_previous:  "absolute left-1 h-7 w-7 rounded-md border border-slate-200 bg-white inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-slate-50 transition-all",
        button_next:      "absolute right-1 h-7 w-7 rounded-md border border-slate-200 bg-white inline-flex items-center justify-center opacity-60 hover:opacity-100 hover:bg-slate-50 transition-all",
        month_grid:       "w-full border-collapse",
        weekdays:         "flex",
        weekday:          "text-slate-400 w-9 text-center text-[0.75rem] font-medium pb-1",
        week:             "flex w-full mt-1",
        day:              "relative p-0 text-center text-sm h-9 w-9",
        day_button:       "h-9 w-9 p-0 font-normal rounded-md hover:bg-slate-100 transition-colors inline-flex items-center justify-center text-sm text-slate-700",
        selected:         "[&>button]:bg-blue-600 [&>button]:text-white [&>button]:hover:bg-blue-600 [&>button]:hover:text-white [&>button]:font-semibold",
        today:            "[&>button]:border [&>button]:border-blue-300 [&>button]:font-semibold",
        outside:          "opacity-40",
        disabled:         "opacity-30 [&>button]:cursor-not-allowed",
        range_start:      "[&>button]:bg-blue-600 [&>button]:text-white [&>button]:rounded-l-md",
        range_end:        "[&>button]:bg-blue-600 [&>button]:text-white [&>button]:rounded-r-md",
        range_middle:     "bg-blue-50 [&>button]:rounded-none",
        hidden:           "invisible",
        ...classNames,
      }}
      components={{
        Chevron: ({ orientation }) =>
          orientation === "left" || orientation === "up" ? (
            <ChevronLeft className="h-3.5 w-3.5" />
          ) : (
            <ChevronRight className="h-3.5 w-3.5" />
          ),
      }}
      {...props}
    />
  );
}
