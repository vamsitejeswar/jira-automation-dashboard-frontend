import {
  ResponsiveContainer,
  ComposedChart,
  Bar,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { Kpis } from "@/api";
import { formatISTDate } from "@/lib/utils";
import { useTheme } from "@/providers/theme-provider";

// Recharts renders raw SVG/inline styles, not Tailwind classes, so `dark:`
// variants can't reach it -- colors have to switch in JS off the resolved
// theme instead.
export function TrendChart({ data }: { data: Kpis["byDay"] }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";
  const gridColor = dark ? "hsl(217 19% 27%)" : "hsl(214 32% 91%)";
  const tickColor = dark ? "hsl(215 15% 65%)" : undefined;

  const formatted = data.map((d) => ({
    ...d,
    date: formatISTDate(d.date).slice(0, 6), // "14 Aug"
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke={gridColor} />
        <XAxis dataKey="date" tick={{ fontSize: 11, fill: tickColor }} />
        <YAxis tick={{ fontSize: 11, fill: tickColor }} allowDecimals={false} />
        <Tooltip
          contentStyle={{
            fontSize: 12,
            borderRadius: 6,
            border: `1px solid ${gridColor}`,
            background: dark ? "hsl(222 44% 10%)" : "#fff",
            color: dark ? "hsl(210 20% 92%)" : undefined,
          }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11, color: tickColor }} />
        <Bar dataKey="onboarded" name="Onboarded" fill="hsl(221 83% 53%)" radius={[3, 3, 0, 0]} />
        <Bar dataKey="offboarded" name="Offboarded" fill="hsl(199 89% 48%)" radius={[3, 3, 0, 0]} />
        <Line
          type="monotone"
          dataKey="failures"
          name="Failures"
          stroke="hsl(0 84% 60%)"
          strokeWidth={2}
          dot={false}
        />
      </ComposedChart>
    </ResponsiveContainer>
  );
}
