"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
} from "recharts";
import { supabase } from "@/lib/supabaseClient";

interface FleetEmissionsChartProps {
  organizationId?: string;
  type?: "scope" | "vehicle" | "monthly";
}

const SCOPE_COLORS = {
  "Scope 1": "#f97316",
  "Scope 2": "#3b82f6",
  "Scope 3 Cat 6": "#64748b",
};

const VEHICLE_COLORS = ["#10b981", "#f59e0b", "#8b5cf6", "#ec4899", "#06b6d4"];

export function FleetEmissionsChart({
  organizationId,
  type = "scope",
}: FleetEmissionsChartProps) {
  const [data, setData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (organizationId) {
      fetchChartData();
    }
  }, [organizationId, type]);

  const fetchChartData = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      const currentYear = new Date().getFullYear();

      if (type === "scope") {
        const { data: activities } = await supabase
          .from("fleet_activities")
          .select("scope, emissions_tco2e")
          .eq("organization_id", organizationId)
          .gte("activity_date", `${currentYear}-01-01`);

        const scopeData: Record<string, number> = {};
        activities?.forEach((a) => {
          const scope = a.scope || "Unknown";
          scopeData[scope] = (scopeData[scope] || 0) + (a.emissions_tco2e || 0);
        });

        setData(
          Object.entries(scopeData).map(([name, value]) => ({
            name,
            value: parseFloat(value.toFixed(4)),
            fill: SCOPE_COLORS[name as keyof typeof SCOPE_COLORS] || "#94a3b8",
          }))
        );
      } else if (type === "vehicle") {
        const { data: activities } = await supabase
          .from("fleet_activities")
          .select("manual_vehicle_category, emissions_tco2e, vehicle_id, vehicles(vehicle_class)")
          .eq("organization_id", organizationId)
          .gte("activity_date", `${currentYear}-01-01`);

        const vehicleData: Record<string, number> = {};
        activities?.forEach((a: any) => {
          const category =
            a.vehicles?.vehicle_class || a.manual_vehicle_category || "Unknown";
          vehicleData[category] = (vehicleData[category] || 0) + (a.emissions_tco2e || 0);
        });

        setData(
          Object.entries(vehicleData).map(([name, value], index) => ({
            name: name.charAt(0).toUpperCase() + name.slice(1),
            value: parseFloat(value.toFixed(4)),
            fill: VEHICLE_COLORS[index % VEHICLE_COLORS.length],
          }))
        );
      } else if (type === "monthly") {
        const { data: activities } = await supabase
          .from("fleet_activities")
          .select("activity_date, emissions_tco2e")
          .eq("organization_id", organizationId)
          .gte("activity_date", `${currentYear}-01-01`)
          .order("activity_date", { ascending: true });

        const monthlyData: Record<string, number> = {};
        const months = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];

        months.forEach((m) => (monthlyData[m] = 0));

        activities?.forEach((a) => {
          const month = new Date(a.activity_date).getMonth();
          monthlyData[months[month]] += a.emissions_tco2e || 0;
        });

        setData(
          Object.entries(monthlyData).map(([name, value]) => ({
            name,
            emissions: parseFloat(value.toFixed(4)),
          }))
        );
      }
    } catch (error) {
      console.error("Error fetching chart data:", error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fleet Emissions</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-[250px] w-full" />
        </CardContent>
      </Card>
    );
  }

  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Fleet Emissions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-[250px] flex items-center justify-center text-muted-foreground">
            No emissions data available
          </div>
        </CardContent>
      </Card>
    );
  }

  if (type === "monthly") {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Monthly Fleet Emissions</CardTitle>
        </CardHeader>
        <CardContent>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
              <XAxis dataKey="name" className="text-xs" />
              <YAxis className="text-xs" />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--popover))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "var(--radius)",
                }}
                formatter={(value: number) => [`${value.toFixed(4)} tCO2e`, "Emissions"]}
              />
              <Bar dataKey="emissions" fill="#10b981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">
          {type === "scope" ? "Emissions by Scope" : "Emissions by Vehicle Type"}
        </CardTitle>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={250}>
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={60}
              outerRadius={80}
              paddingAngle={2}
              dataKey="value"
              label={({ name, value }) => `${name}: ${value}`}
              labelLine={false}
            >
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.fill} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                backgroundColor: "hsl(var(--popover))",
                border: "1px solid hsl(var(--border))",
                borderRadius: "var(--radius)",
              }}
              formatter={(value: number) => [`${value.toFixed(4)} tCO2e`, "Emissions"]}
            />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
