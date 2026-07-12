"use client";

/**
 * The fleet activity log, re-cut for the studio: a flush cream panel, a
 * quiet controls row (scope filter and CSV export), typographic state
 * chips instead of badge pills, and mono pagination. Queries, the CSV
 * export and deletion are unchanged.
 */

import { useState, useEffect } from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Trash2, ChevronLeft, ChevronRight } from "lucide-react";
import { Panel } from "@/components/studio/panel";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import type { WorkingTone } from "@/components/studio/theme";
import { supabase } from "@/lib/supabaseClient";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface FleetActivityTableProps {
  organizationId?: string;
  onActivityDeleted?: () => void;
}

interface FleetActivity {
  id: string;
  activity_date: string;
  scope: string;
  data_entry_method: string;
  distance_km: number | null;
  fuel_volume_litres: number | null;
  electricity_kwh: number | null;
  emissions_tco2e: number;
  purpose: string | null;
  driver_name: string | null;
  manual_vehicle_category: string | null;
  manual_fuel_type: string | null;
  data_quality: string;
  vehicle_id: string | null;
  vehicles?: {
    registration_number: string;
    make_model: string;
  } | null;
}

const PAGE_SIZE = 10;

export function FleetActivityTable({
  organizationId,
  onActivityDeleted,
}: FleetActivityTableProps) {
  const { toast } = useToast();
  const [activities, setActivities] = useState<FleetActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(0);
  const [scopeFilter, setScopeFilter] = useState<string>("all");

  useEffect(() => {
    if (organizationId) {
      fetchActivities();
    }
  }, [organizationId, page, scopeFilter]);

  const fetchActivities = async () => {
    if (!organizationId) return;

    setLoading(true);
    try {
      let query = supabase
        .from("fleet_activities")
        .select(
          `
          id,
          activity_date,
          scope,
          data_entry_method,
          distance_km,
          fuel_volume_litres,
          electricity_kwh,
          emissions_tco2e,
          purpose,
          driver_name,
          manual_vehicle_category,
          manual_fuel_type,
          data_quality,
          vehicle_id,
          vehicles(registration_number, make_model)
        `,
          { count: "exact" }
        )
        .eq("organization_id", organizationId)
        .order("activity_date", { ascending: false })
        .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

      if (scopeFilter !== "all") {
        query = query.eq("scope", scopeFilter);
      }

      const { data, error, count } = await query;

      if (error) throw error;

      setActivities((data as unknown as FleetActivity[]) || []);
      setTotalCount(count || 0);
    } catch (error) {
      console.error("Error fetching activities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteActivity = async (activityId: string) => {
    if (!confirm("Are you sure you want to delete this activity record?")) {
      return;
    }

    try {
      const { error } = await supabase
        .from("fleet_activities")
        .delete()
        .eq("id", activityId);

      if (error) throw error;

      toast({
        title: "Activity Deleted",
        description: "The fleet activity record has been removed.",
      });

      fetchActivities();
      onActivityDeleted?.();
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete activity",
        variant: "destructive",
      });
    }
  };

  const exportToCSV = () => {
    const headers = [
      "Date",
      "Scope",
      "Vehicle",
      "Fuel Type",
      "Method",
      "Value",
      "Unit",
      "Emissions (tCO2e)",
      "Purpose",
      "Driver",
    ];

    const rows = activities.map((a) => {
      let value = "";
      let unit = "";

      if (a.data_entry_method === "distance") {
        value = a.distance_km?.toString() || "";
        unit = "km";
      } else if (a.data_entry_method === "volume") {
        value = a.fuel_volume_litres?.toString() || "";
        unit = "litres";
      } else if (a.data_entry_method === "consumption") {
        value = a.electricity_kwh?.toString() || "";
        unit = "kWh";
      }

      return [
        a.activity_date,
        a.scope,
        a.vehicles?.registration_number || a.vehicles?.make_model || a.manual_vehicle_category || "",
        a.manual_fuel_type || "",
        a.data_entry_method,
        value,
        unit,
        a.emissions_tco2e?.toFixed(6) || "",
        a.purpose || "",
        a.driver_name || "",
      ].join(",");
    });

    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `fleet-activities-${format(new Date(), "yyyy-MM-dd")}.csv`;
    link.click();
  };

  const qualityTone = (quality: string): WorkingTone => {
    if (quality === "Primary") return "good";
    if (quality === "Tertiary") return "attention";
    return "quiet";
  };

  const getActivityValue = (activity: FleetActivity) => {
    if (activity.data_entry_method === "distance" && activity.distance_km) {
      return `${activity.distance_km.toFixed(1)} km`;
    }
    if (activity.data_entry_method === "volume" && activity.fuel_volume_litres) {
      return `${activity.fuel_volume_litres.toFixed(1)} L`;
    }
    if (activity.data_entry_method === "consumption" && activity.electricity_kwh) {
      return `${activity.electricity_kwh.toFixed(1)} kWh`;
    }
    return "-";
  };

  const totalPages = Math.ceil(totalCount / PAGE_SIZE);

  return (
    <Panel flush>
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-studio-hairline px-5 py-4">
        <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          {loading ? "Loading" : `${totalCount} ${totalCount === 1 ? "record" : "records"}`}
        </p>
        <div className="flex items-center gap-2">
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="h-9 w-[150px] rounded-full font-mono text-xs uppercase tracking-[0.12em]">
              <SelectValue placeholder="Filter by scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scopes</SelectItem>
              <SelectItem value="Scope 1">Scope 1</SelectItem>
              <SelectItem value="Scope 2">Scope 2</SelectItem>
              <SelectItem value="Scope 3 Cat 6">Scope 3 Cat 6</SelectItem>
            </SelectContent>
          </Select>
          <PillButton variant="outline" size="sm" onClick={exportToCSV}>
            Export CSV
          </PillButton>
        </div>
      </div>

      <div className="px-5 py-4">
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 w-full animate-pulse rounded-[6px] bg-border/40" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            <p>No fleet activities recorded yet.</p>
            <p className="mt-1">Use Log activity to record vehicle usage.</p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Scope</TableHead>
                  <TableHead>Vehicle</TableHead>
                  <TableHead>Activity</TableHead>
                  <TableHead className="text-right">Emissions</TableHead>
                  <TableHead>Purpose</TableHead>
                  <TableHead>Quality</TableHead>
                  <TableHead className="w-[60px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activities.map((activity) => (
                  <TableRow key={activity.id}>
                    <TableCell>
                      {format(new Date(activity.activity_date), "dd MMM yyyy")}
                    </TableCell>
                    <TableCell>
                      <StateChip tone="quiet">{activity.scope}</StateChip>
                    </TableCell>
                    <TableCell>
                      <div>
                        <p className="font-medium">
                          {activity.vehicles?.registration_number ||
                            activity.vehicles?.make_model ||
                            activity.manual_vehicle_category ||
                            "Manual Entry"}
                        </p>
                        {activity.manual_fuel_type && (
                          <p className="text-xs text-muted-foreground capitalize">
                            {activity.manual_fuel_type}
                          </p>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>{getActivityValue(activity)}</TableCell>
                    <TableCell className="text-right font-mono tabular-nums">
                      {activity.emissions_tco2e?.toFixed(4)} tCO2e
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {activity.purpose || "-"}
                    </TableCell>
                    <TableCell>
                      <StateChip tone={qualityTone(activity.data_quality)}>
                        {activity.data_quality}
                      </StateChip>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Delete activity"
                        onClick={() => handleDeleteActivity(activity.id)}
                      >
                        <Trash2 className="h-4 w-4 text-muted-foreground" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>

            {totalPages > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-studio-hairline pt-4">
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                  {page * PAGE_SIZE + 1} - {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Previous page"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Next page"
                    onClick={() => setPage(page + 1)}
                    disabled={page >= totalPages - 1}
                  >
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </Panel>
  );
}
