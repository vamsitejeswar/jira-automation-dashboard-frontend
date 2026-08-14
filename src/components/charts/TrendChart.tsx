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

export function TrendChart({ data }: { data: Kpis["byDay"] }) {
  const formatted = data.map((d) => ({
    ...d,
    date: formatISTDate(d.date).slice(0, 6), // "14 Aug"
  }));

  return (
    <ResponsiveContainer width="100%" height={220}>
      <ComposedChart data={formatted} margin={{ top: 4, right: 16, left: -16, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="hsl(214 32% 91%)" />
        <XAxis dataKey="date" tick={{ fontSize: 11 }} />
        <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
        <Tooltip
          contentStyle={{ fontSize: 12, borderRadius: 6, border: "1px solid hsl(214 32% 91%)" }}
        />
        <Legend iconSize={10} wrapperStyle={{ fontSize: 11 }} />
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
