"use client";

import { useState, useEffect } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import { Trash2, Search, Download, ChevronLeft, ChevronRight } from "lucide-react";
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
  const [searchQuery, setSearchQuery] = useState("");

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

  const getScopeColor = (scope: string) => {
    if (scope === "Scope 1") return "secondary";
    if (scope === "Scope 2") return "default";
    return "outline";
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
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <div>
          <CardTitle>Fleet Activity Log</CardTitle>
          <CardDescription>
            View and manage all recorded fleet emissions activities
          </CardDescription>
        </div>
        <div className="flex items-center gap-2">
          <Select value={scopeFilter} onValueChange={setScopeFilter}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Filter by scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Scopes</SelectItem>
              <SelectItem value="Scope 1">Scope 1</SelectItem>
              <SelectItem value="Scope 2">Scope 2</SelectItem>
              <SelectItem value="Scope 3 Cat 6">Scope 3 Cat 6</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={exportToCSV}>
            <Download className="h-4 w-4" />
          </Button>
        </div>
      </CardHeader>

      <CardContent>
        {loading ? (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        ) : activities.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <p>No fleet activities recorded yet</p>
            <p className="text-sm">
              Use the &quot;Log Fleet Activity&quot; button to record vehicle usage
            </p>
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
                      <Badge variant={getScopeColor(activity.scope)}>
                        {activity.scope}
                      </Badge>
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
                    <TableCell className="text-right font-mono">
                      {activity.emissions_tco2e?.toFixed(4)} tCO2e
                    </TableCell>
                    <TableCell className="max-w-[150px] truncate">
                      {activity.purpose || "-"}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {activity.data_quality}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="ghost"
                        size="icon"
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
              <div className="flex items-center justify-between mt-4">
                <p className="text-sm text-muted-foreground">
                  Showing {page * PAGE_SIZE + 1} -{" "}
                  {Math.min((page + 1) * PAGE_SIZE, totalCount)} of {totalCount}
                </p>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPage(page - 1)}
                    disabled={page === 0}
                  >
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-sm">
                    Page {page + 1} of {totalPages}
                  </span>
                  <Button
                    variant="outline"
                    size="icon"
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
      </CardContent>
    </Card>
  );
}
