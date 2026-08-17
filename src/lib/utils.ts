import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// "ad" is always the Active Directory abbreviation in this app's outcomes
// (ad_disable_failed, ad_account_not_found, ...), never the English word --
// title-casing it word-by-word would otherwise read "Ad Disable Failed".
const ACRONYMS = new Set(["ad"]);

// Every raw snake_case value from the backend (outcomes, toggle names, ...)
// goes through this before it's shown as a chip/label anywhere in the app,
// so "invalid_email" reads as "Invalid Email", not "invalid email".
export function titleCase(value: string): string {
  return value
    .replace(/_/g, " ")
    .split(" ")
    .map((word) => {
      if (!word) return word;
      if (ACRONYMS.has(word.toLowerCase())) return word.toUpperCase();
      return word[0].toUpperCase() + word.slice(1);
    })
    .join(" ");
}

const IST = "Asia/Kolkata";

export function formatIST(iso: string | null | undefined, fmt = "dd MMM yyyy, hh:mm a") {
  if (!iso) return "—";
  try {
    return formatInTimeZone(parseISO(iso), IST, fmt);
  } catch {
    return iso;
  }
}

export function formatISTShort(iso: string | null | undefined) {
  return formatIST(iso, "dd MMM, hh:mm a");
}

export function formatISTDate(iso: string | null | undefined) {
  return formatIST(iso, "dd MMM yyyy");
}

const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

// Every scheduled job in this app runs on a simple "minute hour * * *" (daily)
// or "minute hour * * weekday" (weekly) cron -- this covers just those two
// shapes in plain English; anything more complex falls back to the raw
// expression rather than guessing at a description.
export function describeCron(schedule: string, timeZone: string): string {
  const parts = schedule.trim().split(/\s+/);
  if (parts.length !== 5) return `${schedule} (${timeZone})`;
  const [minute, hour, dom, month, dow] = parts;
  if (dom !== "*" || month !== "*" || !/^\d+$/.test(minute) || !/^\d+$/.test(hour)) {
    return `${schedule} (${timeZone})`;
  }
  const time = `${(+hour % 12 || 12)}:${minute.padStart(2, "0")} ${+hour < 12 ? "AM" : "PM"}`;
  const zone = timeZone.replace("Asia/Calcutta", "IST").replace("Asia/Kolkata", "IST");
  if (dow === "*") return `Daily at ${time} ${zone}`;
  if (/^\d+$/.test(dow) && +dow >= 0 && +dow <= 6) return `Weekly, ${WEEKDAYS[+dow]}s at ${time} ${zone}`;
  return `${schedule} (${timeZone})`;
}
