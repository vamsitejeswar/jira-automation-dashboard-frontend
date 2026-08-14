import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";
import { formatInTimeZone } from "date-fns-tz";
import { parseISO } from "date-fns";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const IST = "Asia/Kolkata";

export function formatIST(iso: string | null | undefined, fmt = "dd MMM yyyy, HH:mm") {
  if (!iso) return "—";
  try {
    return formatInTimeZone(parseISO(iso), IST, fmt) + " IST";
  } catch {
    return iso;
  }
}

export function formatISTShort(iso: string | null | undefined) {
  return formatIST(iso, "dd MMM, HH:mm");
}

export function formatISTDate(iso: string | null | undefined) {
  return formatIST(iso, "dd MMM yyyy");
}
