"use client";

/**
 * Fleet emissions, re-cut for the studio: a cream hairline panel with a
 * mono label, studio inks for the data, no icon titles and no card chrome.
 * The queries and the maths are unchanged.
 */

import { useState, useEffect } from "react";
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
import { Panel } from "@/components/studio/panel";
import { Eyebrow } from "@/components/studio/eyebrow";
import { STUDIO } from "@/components/studio/theme";

interface FleetEmissionsChartProps {
  organizationId?: string;
  type?: "scope" | "vehicle" | "monthly";
}

const SCOPE_COLORS: Record<string, string> = {
  "Scope 1": STUDIO.cobalt,
  "Scope 2": STUDIO.teal,
  "Scope 3 Cat 6": STUDIO.dim,
};

const VEHICLE_COLORS = [STUDIO.forest, STUDIO.ochre, STUDIO.plum, STUDIO.brick, STUDIO.teal];

const PANEL_LABELS: Record<NonNullable<FleetEmissionsChartProps["type"]>, string> = {
  scope: "BY SCOPE",
  vehicle: "BY VEHICLE TYPE",
  monthly: "BY MONTH",
};

const TOOLTIP_STYLE = {
  backgroundColor: STUDIO.cream,
  border: `1px solid ${STUDIO.hairline}`,
  borderRadius: "6px",
  fontSize: "12px",
  color: STUDIO.ink,
};

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
            fill: SCOPE_COLORS[name] || STUDIO.dim,
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
      <Panel>
        <Eyebrow tone="dim">{PANEL_LABELS[type]}</Eyebrow>
        <div className="mt-3 h-[250px] animate-pulse rounded-[6px] bg-border/40" />
      </Panel>
    );
  }

  if (data.length === 0) {
    return (
      <Panel>
        <Eyebrow tone="dim">{PANEL_LABELS[type]}</Eyebrow>
        <div className="mt-3 flex h-[250px] items-center justify-center text-sm text-muted-foreground">
          No emissions recorded yet.
        </div>
      </Panel>
    );
  }

  if (type === "monthly") {
    return (
      <Panel>
        <Eyebrow tone="dim">{PANEL_LABELS[type]}</Eyebrow>
        <div className="mt-3">
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={data}>
              <CartesianGrid strokeDasharray="3 3" stroke={STUDIO.hairline} vertical={false} />
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: STUDIO.dim }} stroke={STUDIO.hairline} />
              <YAxis tick={{ fontSize: 10, fill: STUDIO.dim }} stroke={STUDIO.hairline} />
              <Tooltip
                contentStyle={TOOLTIP_STYLE}
                formatter={(value: number) => [`${value.toFixed(4)} tCO2e`, "Emissions"]}
              />
              <Bar dataKey="emissions" fill={STUDIO.cobalt} radius={[2, 2, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Panel>
    );
  }

  return (
    <Panel>
      <Eyebrow tone="dim">{PANEL_LABELS[type]}</Eyebrow>
      <div className="mt-3">
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
              contentStyle={TOOLTIP_STYLE}
              formatter={(value: number) => [`${value.toFixed(4)} tCO2e`, "Emissions"]}
            />
            <Legend wrapperStyle={{ fontSize: "11px", color: STUDIO.dim }} />
          </PieChart>
        </ResponsiveContainer>
      </div>
    </Panel>
  );
}
