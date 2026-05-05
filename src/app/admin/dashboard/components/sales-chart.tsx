"use client"
import { Bar, BarChart, ResponsiveContainer, XAxis, YAxis, CartesianGrid, Tooltip } from "recharts"

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { ChartTooltipContent, ChartContainer } from "@/components/ui/chart"

const chartData = [
  { month: "Jan", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Feb", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Mar", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Apr", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "May", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Jun", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Jul", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Aug", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Sep", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Oct", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Nov", sales: Math.floor(Math.random() * 2000) + 1000 },
  { month: "Dec", sales: Math.floor(Math.random() * 2000) + 1000 },
]

const chartConfig = {
  sales: {
    label: "Sales",
    color: "hsl(var(--primary))",
  },
}

export function SalesChart() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Sales Overview</CardTitle>
        <CardDescription>An overview of your monthly sales.</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <BarChart data={chartData} accessibilityLayer>
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="month"
              tickLine={false}
              tickMargin={10}
              axisLine={false}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={10}
              tickFormatter={(value) => `$${value / 1000}k`}
            />
            <Tooltip
              cursor={false}
              content={<ChartTooltipContent indicator="dot" />}
            />
            <Bar
              dataKey="sales"
              fill="var(--color-sales)"
              radius={4}
            />
          </BarChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}
