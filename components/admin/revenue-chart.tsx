"use client";

import { Bar, BarChart, XAxis, YAxis, CartesianGrid } from "recharts";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@/components/ui/chart";
import type { MonthlyRevenueData } from "@/lib/dashboard-queries";

const chartConfig = {
  actual: {
    label: "Actual Revenue",
    color: "hsl(var(--chart-1))",
  },
  estimated: {
    label: "Estimated Revenue",
    color: "hsl(var(--chart-4))",
  },
} satisfies ChartConfig;

function formatYAxis(value: number) {
  if (value === 0) return "R0";
  if (value >= 100000) return `R${(value / 100).toLocaleString("en-ZA", { maximumFractionDigits: 0 })}`;
  return `R${(value / 100).toFixed(0)}`;
}

interface RevenueChartProps {
  readonly data: MonthlyRevenueData[];
}

export function RevenueChart({ data }: RevenueChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis
          tickLine={false}
          axisLine={false}
          width={60}
          tickFormatter={formatYAxis}
        />
        <ChartTooltip
          content={
            <ChartTooltipContent
              formatter={(value) => `R${((value as number) / 100).toLocaleString("en-ZA", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
            />
          }
        />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar dataKey="actual" fill="var(--color-actual)" radius={[4, 4, 0, 0]} />
        <Bar
          dataKey="estimated"
          fill="var(--color-estimated)"
          fillOpacity={0.6}
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
