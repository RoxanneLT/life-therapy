"use client";

import React from "react";
import {
  Bar,
  BarChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Pie,
  PieChart,
  Cell,
  Line,
  LineChart,
  Area,
  ComposedChart,
} from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";

// --------------- Helpers ---------------

function formatZAR(cents: number): string {
  return "R " + (cents / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatYAxis(value: number) {
  if (value === 0) return "R0";
  if (value >= 10000000) return "R" + (value / 100000).toFixed(0) + "k";
  if (value >= 100000) return "R" + (value / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 });
  return "R" + (value / 100).toFixed(0);
}

const SOURCE_LABELS: Record<string, string> = {
  monthly_postpaid: "Sessions (Monthly)",
  course_purchase: "Course Sales",
  product_sale: "Product Sales",
  package_purchase: "Package Sales",
  ad_hoc_session: "Ad Hoc Sessions",
  late_cancel: "Late Cancellation",
  credit_note: "Credit Notes",
  other: "Other",
};

const SESSION_TYPE_LABELS: Record<string, string> = {
  individual: "Individual",
  couples: "Couples",
  free_consultation: "Free Consultation",
};

function humanLabel(key: string, map: Record<string, string>): string {
  return map[key] || key.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase());
}

// --------------- Colors ---------------

const COLORS = {
  green: "hsl(142, 71%, 35%)",
  amber: "hsl(38, 92%, 50%)",
  red: "hsl(0, 72%, 51%)",
  blue: "hsl(217, 91%, 60%)",
  purple: "hsl(270, 50%, 50%)",
  brand: "hsl(139, 17%, 60%)",
  teal: "hsl(180, 50%, 40%)",
  pink: "hsl(330, 60%, 55%)",
};

const PIE_COLORS = [
  COLORS.green,
  COLORS.blue,
  COLORS.amber,
  COLORS.purple,
  COLORS.red,
  COLORS.teal,
  COLORS.pink,
  COLORS.brand,
];

// --------------- Revenue by Source (Donut) ---------------

interface RevenueBySourceProps {
  data: { source: string; amountCents: number }[];
}

const revenueBySourceConfig: ChartConfig = {
  amount: { label: "Revenue" },
};

export function RevenueBySourceChart({ data }: RevenueBySourceProps) {
  if (!data.length) return <EmptyChart message="No revenue data" />;

  const chartData = data.map((d) => ({
    name: humanLabel(d.source, SOURCE_LABELS),
    value: d.amountCents,
  }));

  return (
    <ChartContainer config={revenueBySourceConfig} className="h-[300px] w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => formatZAR(value as number)}
            />
          }
        />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <ChartLegend
          content={<PieLegend data={chartData} />}
        />
      </PieChart>
    </ChartContainer>
  );
}

// --------------- Payment Status (Stacked Bar) ---------------

interface PaymentStatusProps {
  data: { month: string; paid: number; pending: number; overdue: number }[];
}

const paymentStatusConfig: ChartConfig = {
  paid: { label: "Paid", color: COLORS.green },
  pending: { label: "Pending", color: COLORS.amber },
  overdue: { label: "Overdue", color: COLORS.red },
};

export function PaymentStatusChart({ data }: PaymentStatusProps) {
  if (!data.length) return <EmptyChart message="No payment data" />;

  return (
    <ChartContainer config={paymentStatusConfig} className="h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} />
        <YAxis tickLine={false} axisLine={false} width={65} tickFormatter={(v) => `R${(v / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`} />
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => `R ${((value as number) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2 })}`} />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="paid" stackId="revenue" fill="var(--color-paid)" radius={[0, 0, 0, 0]} />
        <Bar dataKey="pending" stackId="revenue" fill="var(--color-pending)" />
        <Bar dataKey="overdue" stackId="revenue" fill="var(--color-overdue)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

// --------------- Outstanding Aging (Horizontal Bar) ---------------

interface AgingProps {
  data: { bucket: string; amountCents: number; count: number }[];
}

const agingConfig: ChartConfig = {
  amountCents: { label: "Amount", color: COLORS.red },
};

export function OutstandingAgingChart({ data }: AgingProps) {
  if (!data.length) return <EmptyChart message="No outstanding invoices" />;

  return (
    <ChartContainer config={agingConfig} className="h-[250px] w-full">
      <BarChart data={data} layout="vertical" accessibilityLayer>
        <CartesianGrid horizontal={false} />
        <XAxis type="number" tickFormatter={formatYAxis} tickLine={false} axisLine={false} />
        <YAxis type="category" dataKey="bucket" tickLine={false} axisLine={false} width={100} />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value, name, item) => {
                const count = (item.payload as { count: number }).count;
                return `${formatZAR(value as number)} (${count} invoice${count !== 1 ? "s" : ""})`;
              }}
            />
          }
        />
        <Bar dataKey="amountCents" fill="var(--color-amountCents)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ChartContainer>
  );
}

// --------------- Time Slot Heatmap (Custom Grid) ---------------

interface TimeSlotHeatmapProps {
  data: { day: number; slot: string; count: number }[];
}

// day: 0=Mon, 1=Tue, 2=Wed, 3=Thu, 4=Fri (matches report-queries output)
const DAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function TimeSlotHeatmap({ data }: TimeSlotHeatmapProps) {
  if (!data.length) return <EmptyChart message="No session data" />;

  const slots = [...new Set(data.map((d) => d.slot))].sort();
  const maxCount = Math.max(...data.map((d) => d.count), 1);

  const getCount = (day: number, slot: string) =>
    data.find((d) => d.day === day && d.slot === slot)?.count ?? 0;

  function getColor(count: number): string {
    if (count === 0) return "bg-muted";
    const intensity = count / maxCount;
    if (intensity < 0.25) return "bg-green-200 dark:bg-green-900";
    if (intensity < 0.5) return "bg-green-300 dark:bg-green-700";
    if (intensity < 0.75) return "bg-green-500 dark:bg-green-500";
    return "bg-green-700 dark:bg-green-400";
  }

  return (
    <div className="overflow-x-auto">
      <div className="inline-grid gap-1" style={{ gridTemplateColumns: `80px repeat(${slots.length}, 1fr)` }}>
        {/* Header */}
        <div />
        {slots.map((slot) => (
          <div key={slot} className="text-center text-xs text-muted-foreground px-1 truncate">
            {slot}
          </div>
        ))}

        {/* Rows */}
        {DAY_LABELS.map((label, dayIdx) => (
          <React.Fragment key={`row-${dayIdx}`}>
            <div className="text-xs text-muted-foreground flex items-center">
              {label}
            </div>
            {slots.map((slot) => {
              const count = getCount(dayIdx, slot);
              return (
                <div
                  key={`${dayIdx}-${slot}`}
                  className={`h-8 min-w-[32px] rounded-sm ${getColor(count)} flex items-center justify-center`}
                  title={`${label} ${slot}: ${count} sessions`}
                >
                  {count > 0 && (
                    <span className="text-[10px] font-medium text-foreground/80">{count}</span>
                  )}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
      {/* Legend */}
      <div className="mt-3 flex items-center justify-center gap-2 text-xs text-muted-foreground">
        <span>Less</span>
        <div className="h-3 w-3 rounded-sm bg-muted" />
        <div className="h-3 w-3 rounded-sm bg-green-200 dark:bg-green-900" />
        <div className="h-3 w-3 rounded-sm bg-green-300 dark:bg-green-700" />
        <div className="h-3 w-3 rounded-sm bg-green-500" />
        <div className="h-3 w-3 rounded-sm bg-green-700 dark:bg-green-400" />
        <span>More</span>
      </div>
    </div>
  );
}

// --------------- Session Type (Donut) ---------------

interface SessionTypeProps {
  data: { type: string; count: number }[];
}

const sessionTypeConfig: ChartConfig = {
  count: { label: "Sessions" },
};

export function SessionTypeChart({ data }: SessionTypeProps) {
  if (!data.length) return <EmptyChart message="No session data" />;

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    name: humanLabel(d.type, SESSION_TYPE_LABELS),
    value: d.count,
  }));

  return (
    <ChartContainer config={sessionTypeConfig} className="h-[300px] w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent formatter={(value) => {
          const v = value as number;
          const pct = total > 0 ? ((v / total) * 100).toFixed(1) : "0";
          return v + " (" + pct + "%)";
        }} />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((_, i) => (
            <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
          ))}
        </Pie>
        <ChartLegend
          content={<PieLegend data={chartData} />}
        />
      </PieChart>
    </ChartContainer>
  );
}

// --------------- Cancellation Trend (Line) ---------------

interface CancellationTrendProps {
  data: {
    month: string;
    total: number;
    cancelled: number;
    noShow: number;
    rate: number;
  }[];
}

const cancellationConfig: ChartConfig = {
  rate: { label: "Cancellation %", color: COLORS.red },
  noShowRate: { label: "No-show %", color: COLORS.amber },
  expected: { label: "Expected %", color: "hsl(0, 0%, 60%)" },
};

export function CancellationTrendChart({ data }: CancellationTrendProps) {
  if (!data.length) return <EmptyChart message="No cancellation data" />;

  // Calculate average rate from months that have data
  const monthsWithData = data.filter((d) => d.total > 0);
  const avgRate = monthsWithData.length > 0
    ? Math.round(monthsWithData.reduce((s, d) => s + d.rate, 0) / monthsWithData.length)
    : 0;

  // Only include months up to the last one with data for actual lines
  const lastDataIdx = data.reduce((last, d, i) => d.total > 0 ? i : last, -1);

  const chartData = data.map((d, i) => ({
    month: d.month,
    rate: i <= lastDataIdx ? d.rate : undefined,
    noShowRate: i <= lastDataIdx ? (d.total > 0 ? Math.round((d.noShow / d.total) * 100) : 0) : undefined,
    expected: avgRate,
  }));

  return (
    <ChartContainer config={cancellationConfig} className="h-[300px] w-full">
      <LineChart data={chartData} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} interval={0} fontSize={11} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={40}
          tickFormatter={(v) => v + "%"}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => (value !== undefined ? value + "%" : "—")}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Line
          type="monotone"
          dataKey="expected"
          stroke="var(--color-expected)"
          strokeWidth={1}
          strokeDasharray="6 3"
          dot={false}
        />
        <Line
          type="monotone"
          dataKey="rate"
          stroke="var(--color-rate)"
          strokeWidth={2}
          dot={{ r: 3 }}
        />
        <Line
          type="monotone"
          dataKey="noShowRate"
          stroke="var(--color-noShowRate)"
          strokeWidth={2}
          dot={{ r: 3 }}
          strokeDasharray="4 4"
        />
      </LineChart>
    </ChartContainer>
  );
}

// --------------- Client Growth (Area + Bar Composed) ---------------

interface ClientGrowthProps {
  data: { month: string; total: number; new: number }[];
}

const clientGrowthConfig: ChartConfig = {
  total: { label: "Total Clients", color: COLORS.brand },
  new: { label: "New Clients", color: COLORS.blue },
};

export function ClientGrowthChart({ data }: ClientGrowthProps) {
  if (!data.length) return <EmptyChart message="No client data" />;

  return (
    <ChartContainer config={clientGrowthConfig} className="h-[300px] w-full">
      <ComposedChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} width={40} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Area
          type="monotone"
          dataKey="total"
          fill="var(--color-total)"
          fillOpacity={0.2}
          stroke="var(--color-total)"
          strokeWidth={2}
        />
        <Bar dataKey="new" fill="var(--color-new)" radius={[4, 4, 0, 0]} barSize={20} />
      </ComposedChart>
    </ChartContainer>
  );
}

// --------------- Client Status (Donut) ---------------

interface ClientStatusProps {
  data: { status: string; count: number }[];
}

const clientStatusConfig: ChartConfig = {
  count: { label: "Clients" },
};

const STATUS_COLORS: Record<string, string> = {
  active: COLORS.green,
  inactive: COLORS.amber,
  archived: COLORS.red,
  new: COLORS.blue,
};

export function ClientStatusChart({ data }: ClientStatusProps) {
  if (!data.length) return <EmptyChart message="No client data" />;

  const total = data.reduce((s, d) => s + d.count, 0);
  const chartData = data.map((d) => ({
    name: humanLabel(d.status, { active: "Active", inactive: "Inactive", potential: "Potential", archived: "Archived" }),
    value: d.count,
    fill: STATUS_COLORS[d.status.toLowerCase()] ?? COLORS.brand,
  }));

  return (
    <ChartContainer config={clientStatusConfig} className="h-[300px] w-full">
      <PieChart accessibilityLayer>
        <ChartTooltip content={<ChartTooltipContent />} />
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((entry, i) => (
            <Cell key={i} fill={entry.fill} />
          ))}
        </Pie>
        <ChartLegend
          content={<PieLegend data={chartData} showCount />}
        />
      </PieChart>
    </ChartContainer>
  );
}

// --------------- Shared Components ---------------

function EmptyChart({ message }: { message: string }) {
  return (
    <div className="flex h-[200px] items-center justify-center rounded-lg border border-dashed">
      <p className="text-sm text-muted-foreground">{message}</p>
    </div>
  );
}

function PieLegend({ data, showCount = false }: { data: { name: string; value: number }[]; showCount?: boolean }) {
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="space-y-1 pt-3">
      <div className="flex flex-wrap items-center justify-center gap-4">
        {data.map((entry, i) => {
          const pct = total > 0 ? ((entry.value / total) * 100).toFixed(0) : "0";
          return (
            <div key={entry.name} className="flex items-center gap-1.5">
              <div
                className="h-2 w-2 shrink-0 rounded-[2px]"
                style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }}
              />
              <span className="text-xs text-muted-foreground">
                {entry.name}{showCount ? ` (${entry.value})` : ""} · {pct}%
              </span>
            </div>
          );
        })}
      </div>
      {showCount && (
        <p className="text-center text-xs font-medium text-muted-foreground">Total: {total}</p>
      )}
    </div>
  );
}
