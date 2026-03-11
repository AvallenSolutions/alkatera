"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  FlaskConical,
  Plus,
  Trash2,
  Pencil,
  Info,
  Loader2,
  Zap,
  Droplets,
  ArrowRightLeft,
} from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/lib/supabaseClient";
import { DATA_QUALITY_OPTIONS } from "@/lib/constants/utility-types";

// =============================================================================
// Types
// =============================================================================

interface ProductionRunResource {
  id: string;
  facility_id: string;
  organization_id: string;
  production_log_id: string | null;
  product_id: number;
  production_date: string;
  production_volume: number;
  production_volume_unit: string;
  units_produced: number | null;
  electricity_total_kwh: number | null;
  electricity_kwh_per_day: number | null;
  production_days: number | null;
  electricity_computed_kwh: number | null;
  water_intake_m3: number | null;
  wastewater_discharge_m3: number | null;
  data_provenance: string;
  verification_status: string;
  notes: string | null;
  created_at: string;
  products?: { name: string } | null;
}

interface ProductOption {
  id: number;
  name: string;
}

interface ProductionLog {
  id: string;
  product_id: number;
  date: string;
  volume: number;
  unit: string;
  products?: { name: string } | null;
}

interface ProductionRunDataEntryProps {
  facilityId: string;
  organizationId: string;
  onDataSaved?: () => void;
}

type ElectricityMode = "total" | "daily";
type LinkMode = "standalone" | "linked";

const VOLUME_UNITS = [
  { value: "Litres", label: "Litres" },
  { value: "Hectolitres", label: "Hectolitres" },
  { value: "Units", label: "Units" },
  { value: "kg", label: "kg" },
];

const VERIFICATION_STATUS_OPTIONS = [
  { value: "unverified", label: "Unverified" },
  { value: "self_declared", label: "Self-declared" },
  { value: "third_party_verified", label: "Third-party Verified" },
];

// =============================================================================
// Component
// =============================================================================

export function ProductionRunDataEntry({
  facilityId,
  organizationId,
  onDataSaved,
}: ProductionRunDataEntryProps) {
  const [entries, setEntries] = useState<ProductionRunResource[]>([]);
  const [products, setProducts] = useState<ProductOption[]>([]);
  const [productionLogs, setProductionLogs] = useState<ProductionLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form state
  const [linkMode, setLinkMode] = useState<LinkMode>("standalone");
  const [selectedLogId, setSelectedLogId] = useState("");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [productionDate, setProductionDate] = useState("");
  const [productionVolume, setProductionVolume] = useState("");
  const [volumeUnit, setVolumeUnit] = useState("Litres");
  const [unitsProduced, setUnitsProduced] = useState("");

  const [electricityMode, setElectricityMode] = useState<ElectricityMode>("total");
  const [electricityTotalKwh, setElectricityTotalKwh] = useState("");
  const [electricityKwhPerDay, setElectricityKwhPerDay] = useState("");
  const [productionDays, setProductionDays] = useState("");

  const [waterIntake, setWaterIntake] = useState("");
  const [wastewaterDischarge, setWastewaterDischarge] = useState("");

  const [dataProvenance, setDataProvenance] = useState("primary_supplier_verified");
  const [verificationStatus, setVerificationStatus] = useState("unverified");
  const [notes, setNotes] = useState("");

  // Computed electricity total for daily mode
  const computedKwh =
    electricityMode === "daily" &&
    electricityKwhPerDay &&
    productionDays &&
    parseFloat(electricityKwhPerDay) > 0 &&
    parseFloat(productionDays) > 0
      ? (parseFloat(electricityKwhPerDay) * parseFloat(productionDays)).toFixed(1)
      : null;

  // =========================================================================
  // Data loading
  // =========================================================================

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/production-run-resource-data?facility_id=${facilityId}&organization_id=${organizationId}`
      );
      if (!res.ok) throw new Error("Failed to fetch run data");
      const json = await res.json();
      setEntries(json.data || []);
    } catch (err) {
      console.error("Error fetching run data:", err);
    }
  }, [facilityId, organizationId]);

  const fetchProducts = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("products")
        .select("id, name")
        .eq("organization_id", organizationId)
        .order("name");

      if (error) throw error;
      setProducts(data || []);
    } catch (err) {
      console.error("Error fetching products:", err);
    }
  }, [organizationId]);

  const fetchProductionLogs = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("production_logs")
        .select("id, product_id, date, volume, unit, products(name)")
        .eq("facility_id", facilityId)
        .order("date", { ascending: false })
        .limit(50);

      if (error) throw error;
      setProductionLogs((data as unknown as ProductionLog[]) || []);
    } catch (err) {
      console.error("Error fetching production logs:", err);
    }
  }, [facilityId]);

  useEffect(() => {
    const load = async () => {
      setIsLoading(true);
      await Promise.all([fetchEntries(), fetchProducts(), fetchProductionLogs()]);
      setIsLoading(false);
    };
    load();
  }, [fetchEntries, fetchProducts, fetchProductionLogs]);

  // =========================================================================
  // Form helpers
  // =========================================================================

  const resetForm = () => {
    setLinkMode("standalone");
    setSelectedLogId("");
    setSelectedProductId("");
    setProductionDate("");
    setProductionVolume("");
    setVolumeUnit("Litres");
    setUnitsProduced("");
    setElectricityMode("total");
    setElectricityTotalKwh("");
    setElectricityKwhPerDay("");
    setProductionDays("");
    setWaterIntake("");
    setWastewaterDischarge("");
    setDataProvenance("primary_supplier_verified");
    setVerificationStatus("unverified");
    setNotes("");
  };

  const handleLogSelect = (logId: string) => {
    setSelectedLogId(logId);
    const log = productionLogs.find((l) => l.id === logId);
    if (log) {
      setSelectedProductId(String(log.product_id));
      setProductionDate(log.date);
      setProductionVolume(String(log.volume));
      // Map production_logs unit format to our unit format
      const unitMap: Record<string, string> = {
        Litre: "Litres",
        Hectolitre: "Hectolitres",
        Unit: "Units",
      };
      setVolumeUnit(unitMap[log.unit] || log.unit);
    }
  };

  // =========================================================================
  // Submit
  // =========================================================================

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedProductId) {
      toast.error("Please select a product");
      return;
    }
    if (!productionDate) {
      toast.error("Please enter a production date");
      return;
    }
    if (!productionVolume || parseFloat(productionVolume) <= 0) {
      toast.error("Please enter a valid production volume");
      return;
    }

    // Must have at least one resource data point
    const hasElectricity =
      electricityMode === "total"
        ? electricityTotalKwh && parseFloat(electricityTotalKwh) > 0
        : electricityKwhPerDay &&
          productionDays &&
          parseFloat(electricityKwhPerDay) > 0 &&
          parseFloat(productionDays) > 0;
    const hasWater = waterIntake && parseFloat(waterIntake) > 0;
    const hasWastewater = wastewaterDischarge && parseFloat(wastewaterDischarge) > 0;

    if (!hasElectricity && !hasWater && !hasWastewater) {
      toast.error("Please enter at least one resource measurement (electricity, water, or wastewater)");
      return;
    }

    setIsSaving(true);
    try {
      const body: Record<string, unknown> = {
        facility_id: facilityId,
        organization_id: organizationId,
        production_log_id: linkMode === "linked" && selectedLogId ? selectedLogId : null,
        product_id: parseInt(selectedProductId, 10),
        production_date: productionDate,
        production_volume: productionVolume,
        production_volume_unit: volumeUnit,
        units_produced: unitsProduced || null,
        data_provenance: dataProvenance,
        verification_status: verificationStatus,
        notes: notes || null,
      };

      if (electricityMode === "total" && electricityTotalKwh) {
        body.electricity_total_kwh = electricityTotalKwh;
      } else if (electricityMode === "daily" && electricityKwhPerDay && productionDays) {
        body.electricity_kwh_per_day = electricityKwhPerDay;
        body.production_days = productionDays;
      }

      if (waterIntake) body.water_intake_m3 = waterIntake;
      if (wastewaterDischarge) body.wastewater_discharge_m3 = wastewaterDischarge;

      const res = await fetch("/api/production-run-resource-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const json = await res.json().catch(() => ({}));
        throw new Error(json.error || "Failed to save run data");
      }

      toast.success("Production run resource data saved");
      setShowAddDialog(false);
      resetForm();
      await fetchEntries();
      onDataSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to save";
      toast.error(message);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (entryId: string) => {
    if (!confirm("Are you sure you want to delete this entry?")) return;

    setIsDeleting(entryId);
    try {
      const res = await fetch(`/api/production-run-resource-data?id=${entryId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to delete");

      toast.success("Entry deleted");
      await fetchEntries();
      onDataSaved?.();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to delete";
      toast.error(message);
    } finally {
      setIsDeleting(null);
    }
  };

  // =========================================================================
  // Render helpers
  // =========================================================================

  const getProductName = (entry: ProductionRunResource) => {
    return entry.products?.name || `Product #${entry.product_id}`;
  };

  const getProvenanceBadge = (provenance: string) => {
    const opt = DATA_QUALITY_OPTIONS.find((o) => o.value === provenance);
    const isHighQuality = provenance.includes("primary");
    return (
      <Badge
        variant="outline"
        className={`text-xs ${
          isHighQuality
            ? "bg-green-50 text-green-700 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800"
            : "bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950 dark:text-amber-300 dark:border-amber-800"
        }`}
      >
        {opt?.label || provenance}
      </Badge>
    );
  };

  // =========================================================================
  // Render
  // =========================================================================

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900 flex items-center justify-center">
                <FlaskConical className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Production Run Resource Data</CardTitle>
                <CardDescription>
                  Enter actual resource consumption measured for specific production runs — the
                  highest quality data available
                </CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowAddDialog(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Run Data
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : entries.length === 0 ? (
            <div className="py-8 text-center">
              <FlaskConical className="h-12 w-12 mx-auto mb-4 text-slate-300 dark:text-slate-600" />
              <div className="text-sm text-muted-foreground mb-4">
                No production run resource data recorded yet
              </div>
              <p className="text-xs text-muted-foreground max-w-md mx-auto">
                If your facility provides actual electricity, water, and wastewater measurements per
                production run, enter them here for the most accurate environmental impact
                calculations.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Date</TableHead>
                    <TableHead>Volume</TableHead>
                    <TableHead>Electricity</TableHead>
                    <TableHead>Water In</TableHead>
                    <TableHead>Wastewater</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {entries.map((entry) => (
                    <TableRow key={entry.id}>
                      <TableCell className="font-medium">
                        {getProductName(entry)}
                      </TableCell>
                      <TableCell>
                        {new Date(entry.production_date).toLocaleDateString("en-GB")}
                      </TableCell>
                      <TableCell>
                        {entry.production_volume.toLocaleString()} {entry.production_volume_unit}
                      </TableCell>
                      <TableCell>
                        {entry.electricity_computed_kwh != null ? (
                          <span className="flex items-center gap-1">
                            <Zap className="h-3 w-3 text-amber-500" />
                            {entry.electricity_computed_kwh.toLocaleString()} kWh
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.water_intake_m3 != null ? (
                          <span className="flex items-center gap-1">
                            <Droplets className="h-3 w-3 text-cyan-500" />
                            {entry.water_intake_m3.toLocaleString()} m³
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {entry.wastewater_discharge_m3 != null ? (
                          <span className="flex items-center gap-1">
                            <ArrowRightLeft className="h-3 w-3 text-slate-500" />
                            {entry.wastewater_discharge_m3.toLocaleString()} m³
                          </span>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-col gap-1">
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200 text-xs">
                            Direct Run
                          </Badge>
                          {getProvenanceBadge(entry.data_provenance)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-destructive"
                            onClick={() => handleDelete(entry.id)}
                            disabled={isDeleting === entry.id}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}

          <Alert className="bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-800">
            <Info className="h-4 w-4 text-emerald-600" />
            <AlertDescription className="text-xs text-emerald-800 dark:text-emerald-200">
              Direct run data is the highest quality data available. It bypasses facility-level
              allocation because the resource consumption is already product-specific.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* ================================================================= */}
      {/* Add Run Data Dialog */}
      {/* ================================================================= */}
      <Dialog
        open={showAddDialog}
        onOpenChange={(open) => {
          if (!open) resetForm();
          setShowAddDialog(open);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Production Run Resource Data</DialogTitle>
            <DialogDescription>
              Enter actual resource consumption measured for a specific production run
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* ─── Section 1: Production Details ─── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Production Details
              </h3>

              {/* Link mode toggle */}
              <div className="grid grid-cols-2 gap-3">
                <Button
                  type="button"
                  variant={linkMode === "standalone" ? "default" : "outline"}
                  className="h-auto py-3"
                  onClick={() => {
                    setLinkMode("standalone");
                    setSelectedLogId("");
                  }}
                >
                  <div className="text-left">
                    <div className="font-semibold text-sm">New Entry</div>
                    <div className="text-xs opacity-80">Enter production details</div>
                  </div>
                </Button>
                <Button
                  type="button"
                  variant={linkMode === "linked" ? "default" : "outline"}
                  className="h-auto py-3"
                  onClick={() => setLinkMode("linked")}
                  disabled={productionLogs.length === 0}
                >
                  <div className="text-left">
                    <div className="font-semibold text-sm">Link to Log</div>
                    <div className="text-xs opacity-80">
                      {productionLogs.length === 0
                        ? "No production logs available"
                        : "Use existing production log"}
                    </div>
                  </div>
                </Button>
              </div>

              {linkMode === "linked" && (
                <div>
                  <Label className="text-xs">Production Log</Label>
                  <Select value={selectedLogId} onValueChange={handleLogSelect}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select a production log..." />
                    </SelectTrigger>
                    <SelectContent>
                      {productionLogs.map((log) => (
                        <SelectItem key={log.id} value={log.id}>
                          {log.products?.name || `Product #${log.product_id}`} —{" "}
                          {new Date(log.date).toLocaleDateString("en-GB")} —{" "}
                          {log.volume.toLocaleString()} {log.unit}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Product *</Label>
                  <Select
                    value={selectedProductId}
                    onValueChange={setSelectedProductId}
                    disabled={linkMode === "linked" && !!selectedLogId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select product..." />
                    </SelectTrigger>
                    <SelectContent>
                      {products.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Production Date *</Label>
                  <Input
                    type="date"
                    value={productionDate}
                    onChange={(e) => setProductionDate(e.target.value)}
                    disabled={linkMode === "linked" && !!selectedLogId}
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label className="text-xs">Production Volume *</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0"
                    value={productionVolume}
                    onChange={(e) => setProductionVolume(e.target.value)}
                    disabled={linkMode === "linked" && !!selectedLogId}
                  />
                </div>
                <div>
                  <Label className="text-xs">Unit</Label>
                  <Select
                    value={volumeUnit}
                    onValueChange={setVolumeUnit}
                    disabled={linkMode === "linked" && !!selectedLogId}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VOLUME_UNITS.map((u) => (
                        <SelectItem key={u.value} value={u.value}>
                          {u.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Units Produced</Label>
                  <Input
                    type="number"
                    step="1"
                    min="0"
                    placeholder="Optional"
                    value={unitsProduced}
                    onChange={(e) => setUnitsProduced(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ─── Section 2: Electricity ─── */}
            <div className="p-4 rounded-lg bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <Zap className="h-4 w-4 text-amber-500" />
                  Electricity
                </h3>
                <div className="flex gap-1">
                  <Button
                    type="button"
                    variant={electricityMode === "total" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setElectricityMode("total")}
                  >
                    Total kWh
                  </Button>
                  <Button
                    type="button"
                    variant={electricityMode === "daily" ? "default" : "outline"}
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setElectricityMode("daily")}
                  >
                    kWh/day × Days
                  </Button>
                </div>
              </div>

              {electricityMode === "total" ? (
                <div>
                  <Label className="text-xs">Total Electricity (kWh)</Label>
                  <Input
                    type="number"
                    step="0.1"
                    min="0"
                    placeholder="e.g., 2500"
                    value={electricityTotalKwh}
                    onChange={(e) => setElectricityTotalKwh(e.target.value)}
                  />
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-xs">kWh per Day</Label>
                    <Input
                      type="number"
                      step="0.1"
                      min="0"
                      placeholder="e.g., 500"
                      value={electricityKwhPerDay}
                      onChange={(e) => setElectricityKwhPerDay(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Production Days</Label>
                    <Input
                      type="number"
                      step="0.5"
                      min="0"
                      placeholder="e.g., 5"
                      value={productionDays}
                      onChange={(e) => setProductionDays(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label className="text-xs">Computed Total</Label>
                    <div className="h-10 flex items-center px-3 rounded-md border bg-muted/50 text-sm font-medium">
                      {computedKwh ? `${parseFloat(computedKwh).toLocaleString()} kWh` : "—"}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* ─── Section 3: Water ─── */}
            <div className="p-4 rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200 dark:border-cyan-800 space-y-4">
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Droplets className="h-4 w-4 text-cyan-500" />
                Water
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Water Intake (m³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Total fresh water used"
                    value={waterIntake}
                    onChange={(e) => setWaterIntake(e.target.value)}
                  />
                </div>
                <div>
                  <Label className="text-xs">Wastewater Discharge (m³)</Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="Total wastewater generated"
                    value={wastewaterDischarge}
                    onChange={(e) => setWastewaterDischarge(e.target.value)}
                  />
                </div>
              </div>
            </div>

            {/* ─── Section 4: Metadata ─── */}
            <div className="space-y-4">
              <h3 className="text-sm font-semibold">Data Quality</h3>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs">Data Provenance</Label>
                  <Select value={dataProvenance} onValueChange={setDataProvenance}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {DATA_QUALITY_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label className="text-xs">Verification Status</Label>
                  <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {VERIFICATION_STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div>
                <Label className="text-xs">Notes (optional)</Label>
                <Textarea
                  placeholder="Any relevant notes about this production run data..."
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  rows={2}
                />
              </div>
            </div>

            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddDialog(false);
                  resetForm();
                }}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Run Data"
                )}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
