import { Chart as ChartJS, ArcElement, Tooltip, type TooltipItem } from "chart.js";
import { Doughnut } from "react-chartjs-2";
import { useTheme } from "@/providers/theme-provider";

ChartJS.register(ArcElement, Tooltip);

// "Normal" uses the same blue as the rest of the dashboard's accent color;
// "Failures" keeps the app's reserved error red.
export function FailureDonut({ total, failures }: { total: number; failures: number }) {
  const { resolvedTheme } = useTheme();
  const dark = resolvedTheme === "dark";

  const normal = Math.max(0, total - failures);

  const normalColor = dark ? "#60a5fa" : "#3b82f6";
  const failureColor = dark ? "#f87171" : "#ef4444";
  const gridColor = dark ? "hsl(217 19% 27%)" : "hsl(214 32% 91%)";
  // Solid hex, not a translucent token -- Chart.js draws the tooltip on the
  // canvas itself, and anything short of a fully opaque fill read as
  // see-through against the page behind it.
  const tooltipBg = dark ? "#0f172a" : "#ffffff";
  const tooltipText = dark ? "#f1f5f9" : "#0f172a";

  const data = {
    labels: ["Normal", "Failures"],
    datasets: [
      {
        data: [normal, failures],
        backgroundColor: [normalColor, failureColor],
        hoverBackgroundColor: [normalColor, failureColor],
        borderWidth: 0,
        borderRadius: 4,
        spacing: 3,
      },
    ],
  };

  return (
    <div className="flex flex-1 flex-col items-center gap-4 pt-2 pb-5">
      <div className="relative h-52 w-52">
        <Doughnut
          data={data}
          options={{
            cutout: "68%",
            rotation: -90,
            circumference: 360,
            animation: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  // Suppress the default bold title -- it just repeats the
                  // label the single body line below already states.
                  title: () => "",
                  label: (item: TooltipItem<"doughnut">) => {
                    const value = item.raw as number;
                    const pct = total > 0 ? Math.round((value / total) * 100) : 0;
                    return `${item.label}: ${value} (${pct}%)`;
                  },
                },
                displayColors: false,
                backgroundColor: tooltipBg,
                titleColor: tooltipText,
                bodyColor: tooltipText,
                borderColor: gridColor,
                borderWidth: 1,
                padding: 8,
                cornerRadius: 6,
                bodyFont: { size: 12 },
              },
            },
          }}
        />
      </div>
      <div className="flex items-center gap-5 text-sm">
        <span className="flex items-center gap-2 text-slate-500 dark:text-neutral-400">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: normalColor }} />
          Normal ({normal})
        </span>
        <span className="flex items-center gap-2 text-slate-500 dark:text-neutral-400">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: failureColor }} />
          Failures ({failures})
        </span>
      </div>
    </div>
  );
}
