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
import type { MonthlyBookingData } from "@/lib/dashboard-queries";

const chartConfig = {
  individual: {
    label: "Individual",
    color: "hsl(var(--chart-1))",
  },
  couples: {
    label: "Couples",
    color: "hsl(var(--chart-2))",
  },
  freeConsultation: {
    label: "Free Consultation",
    color: "hsl(var(--chart-3))",
  },
} satisfies ChartConfig;

interface BookingsChartProps {
  readonly data: MonthlyBookingData[];
}

export function BookingsChart({ data }: BookingsChartProps) {
  return (
    <ChartContainer config={chartConfig} className="h-[300px] w-full">
      <BarChart data={data} accessibilityLayer>
        <CartesianGrid vertical={false} />
        <XAxis dataKey="month" tickLine={false} axisLine={false} tickMargin={8} />
        <YAxis tickLine={false} axisLine={false} allowDecimals={false} width={30} />
        <ChartTooltip content={<ChartTooltipContent />} />
        <ChartLegend content={<ChartLegendContent />} />
        <Bar
          dataKey="individual"
          stackId="a"
          fill="var(--color-individual)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="couples"
          stackId="a"
          fill="var(--color-couples)"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="freeConsultation"
          stackId="a"
          fill="var(--color-freeConsultation)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ChartContainer>
  );
}
