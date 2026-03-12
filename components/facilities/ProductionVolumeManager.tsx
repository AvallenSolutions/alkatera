"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Package, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useReportingPeriod } from "@/hooks/useReportingPeriod";
import { PRODUCTION_UNITS, FACILITY_ACTIVITY_TYPES } from "@/lib/constants/utility-types";
import type { Cadence, Period } from "@/lib/log-data/period-utils";

interface ProductionVolume {
  id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  production_volume: number;
  volume_unit: string;
  data_source_type: string;
  facility_activity_type: string | null;
  fallback_intensity_factor: number | null;
  notes: string | null;
  created_at: string;
}

interface ProductionVolumeManagerProps {
  facilityId: string;
  organizationId: string;
}

export function ProductionVolumeManager({
  facilityId,
  organizationId,
}: ProductionVolumeManagerProps) {
  const { defaultCadence, getAvailablePeriods } = useReportingPeriod();
  const [cadence, setCadence] = useState<Cadence>(defaultCadence);
  const [periods, setPeriods] = useState<Period[]>([]);
  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState<string>("0");

  const [volumes, setVolumes] = useState<ProductionVolume[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Form state
  const [volume, setVolume] = useState("");
  const [unit, setUnit] = useState("Litres");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const available = getAvailablePeriods(cadence);
    setPeriods(available);
    setSelectedPeriodIndex("0");
  }, [cadence, getAvailablePeriods]);

  const selectedPeriod = periods[parseInt(selectedPeriodIndex)] || null;

  const fetchVolumes = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await fetch(
        `/api/facility-production-volumes?facility_id=${facilityId}&organization_id=${organizationId}`
      );
      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`API returned ${res.status} (non-JSON). Route may not be deployed.`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);
      setVolumes(json.data || []);
    } catch (err: any) {
      console.error("Failed to fetch production volumes:", err);
    } finally {
      setIsLoading(false);
    }
  }, [facilityId, organizationId]);

  useEffect(() => {
    fetchVolumes();
  }, [fetchVolumes]);

  const handleSave = async () => {
    if (!selectedPeriod) {
      toast.error("Please select a period");
      return;
    }
    if (!volume || parseFloat(volume) <= 0) {
      toast.error("Please enter a valid production volume");
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch("/api/facility-production-volumes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          facility_id: facilityId,
          organization_id: organizationId,
          reporting_period_start: selectedPeriod.start,
          reporting_period_end: selectedPeriod.end,
          production_volume: volume,
          volume_unit: unit,
          data_source_type: "Primary",
          notes: notes || null,
        }),
      });

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.includes("application/json")) {
        throw new Error(`Server returned ${res.status} (non-JSON response). The API route may not be deployed correctly.`);
      }
      const json = await res.json();
      if (!res.ok) throw new Error(json.error);

      toast.success("Production volume saved");
      setShowForm(false);
      setVolume("");
      setNotes("");
      fetchVolumes();
    } catch (err: any) {
      toast.error(err.message || "Failed to save");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const res = await fetch(`/api/facility-production-volumes?id=${id}`, { method: "DELETE" });
      if (!res.ok) {
        const contentType = res.headers.get("content-type") || "";
        if (!contentType.includes("application/json")) {
          throw new Error(`Server returned ${res.status} (non-JSON response)`);
        }
        const json = await res.json();
        throw new Error(json.error);
      }
      toast.success("Production volume deleted");
      fetchVolumes();
    } catch (err: any) {
      toast.error(err.message || "Failed to delete");
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Production Volume</CardTitle>
              <CardDescription>Track output per period for intensity metrics</CardDescription>
            </div>
          </div>
          {!showForm && (
            <Button variant="outline" size="sm" onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-1" /> Add Volume
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Add Form */}
        {showForm && (
          <div className="p-4 border rounded-lg bg-muted/30 space-y-4">
            <div className="flex flex-wrap gap-4 items-end">
              <div className="space-y-1.5">
                <Label className="text-xs">Cadence</Label>
                <Select value={cadence} onValueChange={(v) => setCadence(v as Cadence)}>
                  <SelectTrigger className="w-[130px]"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="monthly">Monthly</SelectItem>
                    <SelectItem value="quarterly">Quarterly</SelectItem>
                    <SelectItem value="annual">Annual</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 flex-1 min-w-[180px]">
                <Label className="text-xs">Period</Label>
                <Select value={selectedPeriodIndex} onValueChange={setSelectedPeriodIndex}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {periods.map((p, i) => (
                      <SelectItem key={i} value={String(i)}>{p.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs">Volume</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 50000"
                  value={volume}
                  onChange={(e) => setVolume(e.target.value)}
                  disabled={isSaving}
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Unit</Label>
                <Select value={unit} onValueChange={setUnit} disabled={isSaving}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PRODUCTION_UNITS.map((u) => (
                      <SelectItem key={u.value} value={u.value}>{u.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">Notes</Label>
                <Input
                  placeholder="Optional"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  disabled={isSaving}
                />
              </div>
            </div>

            <div className="flex gap-2 justify-end">
              <Button variant="ghost" size="sm" onClick={() => setShowForm(false)} disabled={isSaving}>
                Cancel
              </Button>
              <Button size="sm" onClick={handleSave} disabled={isSaving}>
                {isSaving ? <><Loader2 className="h-4 w-4 mr-1 animate-spin" /> Saving...</> : "Save"}
              </Button>
            </div>
          </div>
        )}

        {/* Volume History */}
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : volumes.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            No production volumes recorded yet. Add one to enable intensity metrics.
          </div>
        ) : (
          <div className="border rounded-lg overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Period</TableHead>
                  <TableHead className="text-right">Volume</TableHead>
                  <TableHead>Unit</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="w-[50px]"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {volumes.map((v) => (
                  <TableRow key={v.id}>
                    <TableCell className="text-sm">
                      {v.reporting_period_start} — {v.reporting_period_end}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {Number(v.production_volume).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">{v.volume_unit}</TableCell>
                    <TableCell>
                      <Badge variant={v.data_source_type === "Primary" ? "default" : "secondary"} className="text-xs">
                        {v.data_source_type === "Primary" ? "Primary" : "Estimated"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(v.id)}>
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
