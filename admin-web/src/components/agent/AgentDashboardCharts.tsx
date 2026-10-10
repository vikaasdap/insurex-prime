import { BarChart3, PieChart as PieIcon, TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AgentDashboard, AgentDashboardRange, InsuranceType } from "@/lib/api/types";
import { formatINR, formatINRCompact, formatNumber, insuranceTypeLabel } from "@/lib/format";
import { EmptyState, SectionCard } from "./agent-ui";

// Validated pair (light surface): primary blue + teal — CVD ΔE 20, contrast ≥ 3:1.
const SERIES = { primary: "var(--primary)", secondary: "#0d9488" } as const;
const TYPE_COLOR = {
  HEALTH: SERIES.primary,
  MOTOR: SERIES.secondary,
  LIFE: "#f59e0b",
  COMMERCIAL: "#8b5cf6",
} as const;
const axisTick = { fontSize: 11, fill: "var(--color-muted-foreground)" };

function periodLabel(period: string, interval: "day" | "week" | "month") {
  const date = new Date(`${period}T00:00:00Z`);
  if (interval === "month") {
    return date.toLocaleDateString("en-IN", { month: "short", year: "2-digit", timeZone: "UTC" });
  }
  const label = date.toLocaleDateString("en-IN", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
  return interval === "week" ? `Wk ${label}` : label;
}

function TooltipCard({ title, rows }: { title: string; rows: [string, string, string?][] }) {
  return (
    <div className="rounded-xl border border-border bg-background p-3 text-xs shadow-lg">
      <p className="mb-1 font-bold text-foreground">{title}</p>
      {rows.map(([label, value, color]) => (
        <p key={label} className="flex items-center gap-2 text-muted-foreground">
          {color && <span className="size-2 rounded-full" style={{ backgroundColor: color }} />}
          {label}: <span className="font-semibold text-foreground">{value}</span>
        </p>
      ))}
    </div>
  );
}

/** Accessible table view of a chart's data. */
function ChartData({ head, rows }: { head: string[]; rows: (string | number)[][] }) {
  return (
    <details className="mt-3 text-xs">
      <summary className="cursor-pointer font-medium text-muted-foreground hover:text-foreground">
        Show data
      </summary>
      <div className="mt-2 max-h-56 overflow-auto rounded-lg border border-border/60">
        <table className="w-full text-left">
          <thead className="sticky top-0 bg-surface">
            <tr>
              {head.map((cell) => (
                <th key={cell} className="px-3 py-2 font-semibold text-muted-foreground">
                  {cell}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {rows.map((row, index) => (
              <tr key={index}>
                {row.map((cell, cellIndex) => (
                  <td key={cellIndex} className="px-3 py-1.5 tabular-nums text-foreground">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

const RANGES: { id: AgentDashboardRange; label: string }[] = [
  { id: "7D", label: "7 Days" },
  { id: "30D", label: "30 Days" },
  { id: "6M", label: "6 Months" },
  { id: "1Y", label: "1 Year" },
];

export function SalesOverviewChart({
  trend,
  range,
  onRangeChange,
  isFetching,
}: {
  trend: AgentDashboard["salesTrend"];
  range: AgentDashboardRange;
  onRangeChange: (range: AgentDashboardRange) => void;
  isFetching: boolean;
}) {
  const data = trend.points.map((point) => ({
    ...point,
    label: periodLabel(point.period, trend.interval),
  }));
  const totalSold = data.reduce((sum, point) => sum + point.policiesSold, 0);
  const totalPremium = data.reduce((sum, point) => sum + point.premium, 0);

  return (
    <SectionCard
      title="Policy Sales Overview"
      icon={TrendingUp}
      description="Policies you sold over time"
      className="lg:col-span-2"
      actions={
        <div
          role="group"
          aria-label="Time range"
          className="flex items-center rounded-xl border border-border bg-surface/60 p-1"
        >
          {RANGES.map((tab) => (
            <button
              key={tab.id}
              type="button"
              aria-pressed={range === tab.id}
              onClick={() => onRangeChange(tab.id)}
              className={`cursor-pointer rounded-lg px-2.5 py-1 text-xs font-semibold transition-all ${
                range === tab.id
                  ? "bg-background text-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-background/40 hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      }
    >
      <div className="mb-3 flex flex-wrap items-center gap-6 text-xs">
        <div>
          <span className="text-[11px] font-medium text-muted-foreground">Policies sold</span>
          <p className="font-display text-base font-extrabold text-foreground">
            {formatNumber(totalSold)}
          </p>
        </div>
        <div className="h-7 w-px bg-border" />
        <div>
          <span className="text-[11px] font-medium text-muted-foreground">Premium written</span>
          <p className="font-display text-base font-extrabold text-foreground">
            {formatINR(totalPremium)}
          </p>
        </div>
      </div>
      <div
        className={`h-64 w-full transition-opacity sm:h-72 ${isFetching ? "opacity-60" : ""}`}
        aria-label={`Policies sold per ${trend.interval}: ${totalSold} in total`}
        role="img"
      >
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 12, left: -18, bottom: 0 }}>
            <defs>
              <linearGradient id="agentSalesFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor={SERIES.primary} stopOpacity={0.14} />
                <stop offset="100%" stopColor={SERIES.primary} stopOpacity={0.02} />
              </linearGradient>
            </defs>
            <CartesianGrid vertical={false} stroke="var(--color-border)" strokeOpacity={0.7} />
            <XAxis
              dataKey="label"
              tickLine={false}
              axisLine={false}
              tick={axisTick}
              minTickGap={16}
            />
            <YAxis tickLine={false} axisLine={false} tick={axisTick} allowDecimals={false} />
            <Tooltip
              cursor={{ stroke: "var(--color-muted-foreground)", strokeWidth: 1 }}
              content={({ active, payload, label }) => {
                const point = active ? payload?.[0]?.payload : undefined;
                if (!point) return null;
                return (
                  <TooltipCard
                    title={String(label)}
                    rows={[
                      ["Policies sold", formatNumber(point.policiesSold), SERIES.primary],
                      ["Premium", formatINR(point.premium)],
                    ]}
                  />
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="policiesSold"
              stroke={SERIES.primary}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              fill="url(#agentSalesFill)"
              activeDot={{ r: 5, stroke: "var(--color-background)", strokeWidth: 2 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
      <ChartData
        head={["Period", "Policies sold", "Premium"]}
        rows={data.map((point) => [point.label, point.policiesSold, formatINR(point.premium)])}
      />
    </SectionCard>
  );
}

export function PolicyDistributionChart({
  distribution,
}: {
  distribution: AgentDashboard["policyDistribution"];
}) {
  const total = distribution.reduce((sum, row) => sum + row.policiesSold, 0);
  return (
    <SectionCard
      title="Policy Type Distribution"
      icon={PieIcon}
      description="All-time health vs motor policies you sold"
    >
      {total === 0 ? (
        <EmptyState
          icon={PieIcon}
          title="No sales yet"
          description="Your health and motor split appears after your first sale."
          className="py-8"
        />
      ) : (
        <>
          <div className="relative mx-auto h-52 w-full max-w-[260px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={distribution}
                  dataKey="policiesSold"
                  nameKey="insuranceType"
                  innerRadius="62%"
                  outerRadius="88%"
                  paddingAngle={
                    distribution.filter((row) => row.policiesSold > 0).length > 1 ? 2 : 0
                  }
                  stroke="var(--color-background)"
                  strokeWidth={2}
                >
                  {distribution.map((row) => (
                    <Cell key={row.insuranceType} fill={TYPE_COLOR[row.insuranceType]} />
                  ))}
                </Pie>
                <Tooltip
                  content={({ active, payload }) => {
                    const row = active ? payload?.[0]?.payload : undefined;
                    if (!row) return null;
                    return (
                      <TooltipCard
                        title={insuranceTypeLabel[row.insuranceType as InsuranceType]}
                        rows={[
                          ["Policies", `${formatNumber(row.policiesSold)} (${row.percentage}%)`],
                          ["Premium", formatINR(row.premium)],
                        ]}
                      />
                    );
                  }}
                />
              </PieChart>
            </ResponsiveContainer>
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-[11px] font-medium text-muted-foreground">Policies</span>
              <span className="font-display text-2xl font-extrabold text-foreground">
                {formatNumber(total)}
              </span>
            </div>
          </div>
          <ul className="mt-3 space-y-2 border-t border-border/60 pt-3" aria-label="Legend">
            {distribution.map((row) => (
              <li key={row.insuranceType} className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-2 font-medium text-foreground">
                  <span
                    className="size-2.5 rounded-full"
                    style={{ backgroundColor: TYPE_COLOR[row.insuranceType] }}
                  />
                  {insuranceTypeLabel[row.insuranceType]}
                </span>
                <span className="font-semibold tabular-nums text-muted-foreground">
                  {row.percentage}% · {formatNumber(row.policiesSold)} ·{" "}
                  <span className="text-foreground">{formatINR(row.premium)}</span>
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </SectionCard>
  );
}
