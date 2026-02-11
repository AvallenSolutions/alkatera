"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { TrendingUp } from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { format, parseISO } from "date-fns";
import type { GrowthTrends } from "../types";

interface GrowthTrendsSectionProps {
  data: GrowthTrends | null;
  loading: boolean;
}

const METRICS = [
  { key: "users", label: "Users", color: "#3b82f6" },
  { key: "organizations", label: "Organisations", color: "#10b981" },
  { key: "products", label: "Products", color: "#f59e0b" },
  { key: "lcas", label: "LCAs", color: "#06b6d4" },
] as const;

const periods = [
  { label: "30d", weeks: 5 },
  { label: "90d", weeks: 13 },
] as const;

export function GrowthTrendsSection({ data, loading }: GrowthTrendsSectionProps) {
  const [selectedPeriod, setSelectedPeriod] = useState<"30d" | "90d">("90d");

  const filteredData = useMemo(() => {
    if (!data?.trends) return [];
    const maxWeeks = selectedPeriod === "30d" ? 5 : 13;
    const trends = data.trends;
    return trends.slice(Math.max(0, trends.length - maxWeeks));
  }, [data, selectedPeriod]);

  if (loading) {
    return <Skeleton className="h-[420px]" />;
  }

  if (!data || data.trends.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-blue-500" />
            Growth Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-12 text-gray-500 dark:text-gray-400">
            No trend data available yet
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-4">
        <CardTitle className="flex items-center gap-2">
          <TrendingUp className="h-5 w-5 text-blue-500" />
          Growth Trends
        </CardTitle>
        <div className="flex gap-1">
          {periods.map((period) => (
            <Button
              key={period.label}
              variant="outline"
              size="sm"
              data-active={selectedPeriod === period.label}
              onClick={() => setSelectedPeriod(period.label)}
              className={`h-7 px-3 text-xs ${
                selectedPeriod === period.label
                  ? "bg-primary text-primary-foreground hover:bg-primary/90"
                  : ""
              }`}
            >
              {period.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={320}>
          <AreaChart data={filteredData}>
            <defs>
              {METRICS.map((m) => (
                <linearGradient key={m.key} id={`gradient-${m.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={m.color} stopOpacity={0.2} />
                  <stop offset="95%" stopColor={m.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="hsl(var(--border))"
              vertical={false}
            />
            <XAxis
              dataKey="week"
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => {
                try {
                  return format(parseISO(value), "MMM d");
                } catch {
                  return value;
                }
              }}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              allowDecimals={false}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--card))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "0.5rem",
                padding: "0.75rem",
                fontSize: "0.8rem",
              }}
              labelStyle={{
                color: "hsl(var(--foreground))",
                fontWeight: 600,
                marginBottom: "0.25rem",
              }}
              labelFormatter={(value) => {
                try {
                  return `Week of ${format(parseISO(value as string), "MMM d, yyyy")}`;
                } catch {
                  return value as string;
                }
              }}
            />
            <Legend
              wrapperStyle={{ fontSize: "0.75rem", paddingTop: "0.5rem" }}
            />
            {METRICS.map((m) => (
              <Area
                key={m.key}
                type="monotone"
                dataKey={m.key}
                name={m.label}
                stroke={m.color}
                strokeWidth={2}
                fillOpacity={1}
                fill={`url(#gradient-${m.key})`}
              />
            ))}
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
