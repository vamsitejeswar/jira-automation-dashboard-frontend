// One preset set, used by every page with a date-range filter -- Overview
// and Anomalies used to each keep their own (today/7d/30d vs.
// today/3d/7d/14d/30d/custom), which made "preset" mean something
// slightly different depending which screen you were on.
export type DatePreset = "today" | "7d" | "30d" | "custom";

export const DATE_PRESETS: { key: DatePreset; label: string }[] = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "custom", label: "Custom" },
];

function fmt(d: Date) {
  return d.toISOString().split("T")[0];
}

export function getPresetDates(preset: DatePreset): { from: string; to: string } {
  const today = new Date();
  const todayStr = fmt(today);
  const daysAgo = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() - n);
    return fmt(d);
  };
  switch (preset) {
    case "today":  return { from: todayStr, to: todayStr };
    case "7d":     return { from: daysAgo(7), to: todayStr };
    case "30d":    return { from: daysAgo(30), to: todayStr };
    default:       return { from: "", to: todayStr };
  }
}
