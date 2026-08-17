"use client"

import * as React from "react"
import { addDays, format } from "date-fns"
import { CalendarIcon } from "lucide-react"
import { type DateRange } from "react-day-picker"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerWithRange({
  value,
  onChange,
  align = "start",
}: {
  value?: DateRange
  onChange?: (range: DateRange | undefined) => void
  // "end" for a trigger sitting near the right edge of the viewport (e.g.
  // Overview's header) -- the two-month calendar is wide enough to clip
  // past the right edge with the default "start" alignment there.
  align?: "start" | "center" | "end"
} = {}) {
  const [internalDate, setInternalDate] = React.useState<DateRange | undefined>({
    from: new Date(new Date().getFullYear(), 0, 20),
    to: addDays(new Date(new Date().getFullYear(), 0, 20), 20),
  })
  const date = value ?? internalDate
  const setDate = onChange ?? setInternalDate

  return (
    <Popover>
      <PopoverTrigger render={<Button variant="outline" id="date-picker-range" className="justify-start px-2.5 font-normal"><CalendarIcon data-icon="inline-start" />{date?.from ? (
          date.to ? (
            <>
              {format(date.from, "LLL dd, y")} -{" "}
              {format(date.to, "LLL dd, y")}
            </>
          ) : (
            format(date.from, "LLL dd, y")
          )
        ) : (
          <span>Pick a date</span>
        )}</Button>} />
      <PopoverContent className="w-auto p-0" align={align}>
        <Calendar
          mode="range"
          defaultMonth={date?.from}
          selected={date}
          onSelect={setDate}
          numberOfMonths={2}
        />
      </PopoverContent>
    </Popover>
  )
}
