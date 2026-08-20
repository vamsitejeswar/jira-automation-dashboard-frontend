"use client"

import * as React from "react"
import { format } from "date-fns"
import { ChevronDownIcon } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover"

export function DatePickerDemo() {
  const [date, setDate] = React.useState<Date>()

  return (
    <Popover>
      <PopoverTrigger render={<Button variant={"outline"} data-empty={!date} className="w-[212px] justify-between text-left font-normal data-[empty=true]:text-muted-foreground">{date ? format(date, "PPP") : <span>Pick a date</span>}<ChevronDownIcon data-icon="inline-end" /></Button>} />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={date}
          onSelect={setDate}
          defaultMonth={date}
        />
      </PopoverContent>
    </Popover>
  )
}

// Controlled single-date picker -- same Popover + Calendar shape
// DatePickerDemo/DatePickerWithRange already use, just a real {value,
// onChange} component instead of an uncontrolled scratch one. Used by the
// HR dashboard's ticket update form (src/pages/HrTickets.tsx) for the Date
// of Joining field.
export function SingleDatePicker({
  value,
  onChange,
  placeholder = "Pick a date",
}: {
  value?: Date
  onChange?: (date: Date | undefined) => void
  placeholder?: string
}) {
  return (
    <Popover>
      <PopoverTrigger render={
        <Button
          variant="outline"
          data-empty={!value}
          className="w-full justify-between text-left font-normal data-[empty=true]:text-muted-foreground"
        >
          {value ? format(value, "PPP") : <span>{placeholder}</span>}
          <ChevronDownIcon data-icon="inline-end" />
        </Button>
      } />
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} defaultMonth={value} />
      </PopoverContent>
    </Popover>
  )
}
