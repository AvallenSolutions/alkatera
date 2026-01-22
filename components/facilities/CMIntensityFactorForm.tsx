"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Factory,
  Plus,
  Trash2,
  Info,
  CheckCircle2,
  AlertTriangle,
  Droplets,
  Flame,
  Zap,
  Recycle,
  Calendar,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface IntensityFactor {
  id: string;
  facility_id: string;
  reporting_period_start: string;
  reporting_period_end: string;
  co2e_scope1_intensity: number | null;
  co2e_scope2_intensity: number | null;
  co2e_total_intensity: number | null;
  water_intensity: number | null;
  waste_intensity: number | null;
  intensity_unit: string;
  data_source: string;
  verification_status: string;
  data_quality_notes: string | null;
}

interface CMIntensityFactorFormProps {
  facilityId: string;
  facilityName: string;
  organizationId: string;
  onUpdate?: () => void;
}

const INTENSITY_UNITS = [
  { value: "per_litre", label: "per Litre" },
  { value: "per_hectolitre", label: "per Hectolitre" },
  { value: "per_kg", label: "per kg" },
  { value: "per_tonne", label: "per Tonne" },
  { value: "per_unit", label: "per Unit" },
];

const DATA_SOURCES = [
  { value: "cm_provided", label: "CM Provided", description: "Direct from contract manufacturer" },
  { value: "calculated", label: "Calculated", description: "Calculated from facility data" },
  { value: "industry_average", label: "Industry Average", description: "Benchmark/proxy data" },
  { value: "estimated", label: "Estimated", description: "User estimate" },
];

const VERIFICATION_STATUS = [
  { value: "unverified", label: "Unverified" },
  { value: "self_declared", label: "Self-declared" },
  { value: "third_party_verified", label: "Third-party Verified" },
];

export function CMIntensityFactorForm({
  facilityId,
  facilityName,
  organizationId,
  onUpdate,
}: CMIntensityFactorFormProps) {
  const [factors, setFactors] = useState<IntensityFactor[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);

  // Form state
  const [periodStart, setPeriodStart] = useState("");
  const [periodEnd, setPeriodEnd] = useState("");
  const [scope1Intensity, setScope1Intensity] = useState("");
  const [scope2Intensity, setScope2Intensity] = useState("");
  const [waterIntensity, setWaterIntensity] = useState("");
  const [wasteIntensity, setWasteIntensity] = useState("");
  const [intensityUnit, setIntensityUnit] = useState("per_litre");
  const [dataSource, setDataSource] = useState("cm_provided");
  const [verificationStatus, setVerificationStatus] = useState("unverified");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    fetchFactors();
  }, [facilityId]);

  const fetchFactors = async () => {
    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();
      const { data, error } = await supabase
        .from("cm_intensity_factors")
        .select("*")
        .eq("facility_id", facilityId)
        .order("reporting_period_start", { ascending: false });

      if (error) throw error;
      setFactors(data || []);
    } catch (err) {
      console.error("Error fetching intensity factors:", err);
      toast.error("Failed to load intensity factors");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForm = () => {
    setPeriodStart("");
    setPeriodEnd("");
    setScope1Intensity("");
    setScope2Intensity("");
    setWaterIntensity("");
    setWasteIntensity("");
    setIntensityUnit("per_litre");
    setDataSource("cm_provided");
    setVerificationStatus("unverified");
    setNotes("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!periodStart || !periodEnd) {
      toast.error("Please select a reporting period");
      return;
    }

    if (!scope1Intensity && !scope2Intensity) {
      toast.error("Please provide at least one CO2e intensity value");
      return;
    }

    setIsSaving(true);
    try {
      const supabase = getSupabaseBrowserClient();

      const { error } = await supabase.from("cm_intensity_factors").insert({
        facility_id: facilityId,
        organization_id: organizationId,
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        co2e_scope1_intensity: scope1Intensity ? parseFloat(scope1Intensity) : null,
        co2e_scope2_intensity: scope2Intensity ? parseFloat(scope2Intensity) : null,
        water_intensity: waterIntensity ? parseFloat(waterIntensity) : null,
        waste_intensity: wasteIntensity ? parseFloat(wasteIntensity) : null,
        intensity_unit: intensityUnit,
        data_source: dataSource,
        verification_status: verificationStatus,
        data_quality_notes: notes || null,
      });

      if (error) throw error;

      toast.success("Intensity factor added successfully");
      setShowAddModal(false);
      resetForm();
      fetchFactors();
      onUpdate?.();
    } catch (err: any) {
      console.error("Error saving intensity factor:", err);
      if (err.message?.includes("no_overlapping_periods")) {
        toast.error("An intensity factor already exists for this period");
      } else {
        toast.error("Failed to save intensity factor");
      }
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (factorId: string) => {
    setIsDeleting(factorId);
    try {
      const supabase = getSupabaseBrowserClient();
      const { error } = await supabase
        .from("cm_intensity_factors")
        .delete()
        .eq("id", factorId);

      if (error) throw error;
      toast.success("Intensity factor deleted");
      fetchFactors();
      onUpdate?.();
    } catch (err) {
      console.error("Error deleting intensity factor:", err);
      toast.error("Failed to delete intensity factor");
    } finally {
      setIsDeleting(null);
    }
  };

  const formatPeriod = (start: string, end: string) => {
    const startDate = new Date(start);
    const endDate = new Date(end);
    return `${startDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })} - ${endDate.toLocaleDateString("en-GB", { month: "short", year: "numeric" })}`;
  };

  const getUnitLabel = (unit: string) => {
    return INTENSITY_UNITS.find((u) => u.value === unit)?.label || unit;
  };

  const getDataSourceBadge = (source: string) => {
    const config: Record<string, { color: string; label: string }> = {
      cm_provided: { color: "bg-green-100 text-green-800", label: "CM Provided" },
      calculated: { color: "bg-blue-100 text-blue-800", label: "Calculated" },
      industry_average: { color: "bg-amber-100 text-amber-800", label: "Industry Avg" },
      estimated: { color: "bg-slate-100 text-slate-800", label: "Estimated" },
    };
    const { color, label } = config[source] || config.estimated;
    return <Badge className={color}>{label}</Badge>;
  };

  const totalIntensity = (parseFloat(scope1Intensity) || 0) + (parseFloat(scope2Intensity) || 0);

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-indigo-100 dark:bg-indigo-900 flex items-center justify-center">
                <Factory className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <CardTitle className="text-lg">Intensity Factors</CardTitle>
                <CardDescription>{facilityName}</CardDescription>
              </div>
            </div>
            <Button onClick={() => setShowAddModal(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Period
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : factors.length === 0 ? (
            <div className="py-8 text-center">
              <Factory className="h-12 w-12 mx-auto mb-4 text-slate-300" />
              <div className="text-sm text-muted-foreground mb-4">
                No intensity factors configured
              </div>
              <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                Add intensity factors from your contract manufacturer to enable accurate
                emission allocation for your production batches.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {factors.map((factor) => (
                <div
                  key={factor.id}
                  className="p-4 rounded-lg border bg-slate-50 dark:bg-slate-900"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-4 w-4 text-muted-foreground" />
                      <span className="font-medium">
                        {formatPeriod(factor.reporting_period_start, factor.reporting_period_end)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      {getDataSourceBadge(factor.data_source)}
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(factor.id)}
                        disabled={isDeleting === factor.id}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {/* Scope 1 */}
                    <div className="flex items-center gap-2">
                      <Flame className="h-4 w-4 text-orange-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Scope 1</div>
                        <div className="font-medium">
                          {factor.co2e_scope1_intensity?.toFixed(3) || "—"}{" "}
                          <span className="text-xs text-muted-foreground">
                            kgCO₂e {getUnitLabel(factor.intensity_unit)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Scope 2 */}
                    <div className="flex items-center gap-2">
                      <Zap className="h-4 w-4 text-blue-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Scope 2</div>
                        <div className="font-medium">
                          {factor.co2e_scope2_intensity?.toFixed(3) || "—"}{" "}
                          <span className="text-xs text-muted-foreground">
                            kgCO₂e {getUnitLabel(factor.intensity_unit)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Water */}
                    <div className="flex items-center gap-2">
                      <Droplets className="h-4 w-4 text-cyan-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Water</div>
                        <div className="font-medium">
                          {factor.water_intensity?.toFixed(2) || "—"}{" "}
                          <span className="text-xs text-muted-foreground">
                            L {getUnitLabel(factor.intensity_unit)}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Waste */}
                    <div className="flex items-center gap-2">
                      <Recycle className="h-4 w-4 text-green-500" />
                      <div>
                        <div className="text-xs text-muted-foreground">Waste</div>
                        <div className="font-medium">
                          {factor.waste_intensity?.toFixed(4) || "—"}{" "}
                          <span className="text-xs text-muted-foreground">
                            kg {getUnitLabel(factor.intensity_unit)}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>

                  {factor.data_quality_notes && (
                    <div className="mt-3 text-xs text-muted-foreground italic">
                      {factor.data_quality_notes}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          <Alert className="bg-indigo-50 dark:bg-indigo-950/30 border-indigo-200 dark:border-indigo-800">
            <Info className="h-4 w-4 text-indigo-600" />
            <AlertDescription className="text-xs text-indigo-800 dark:text-indigo-200">
              Intensity factors are multiplied by your production volume to calculate allocated
              emissions. Add factors for each reporting period (quarterly recommended).
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>

      {/* Add Intensity Factor Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Intensity Factor</DialogTitle>
            <DialogDescription>
              Enter emission intensity data from {facilityName} for a reporting period
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Reporting Period */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="period-start">Period Start</Label>
                <Input
                  id="period-start"
                  type="date"
                  value={periodStart}
                  onChange={(e) => setPeriodStart(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="period-end">Period End</Label>
                <Input
                  id="period-end"
                  type="date"
                  value={periodEnd}
                  onChange={(e) => setPeriodEnd(e.target.value)}
                  required
                />
              </div>
            </div>

            {/* Intensity Unit */}
            <div className="space-y-2">
              <Label htmlFor="intensity-unit">Intensity Unit</Label>
              <Select value={intensityUnit} onValueChange={setIntensityUnit}>
                <SelectTrigger id="intensity-unit">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {INTENSITY_UNITS.map((unit) => (
                    <SelectItem key={unit.value} value={unit.value}>
                      {unit.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* CO2e Intensities */}
            <div className="p-4 rounded-lg bg-slate-50 dark:bg-slate-900 space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Flame className="h-4 w-4 text-orange-500" />
                <Zap className="h-4 w-4 text-blue-500" />
                CO₂e Intensity (by Scope)
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="scope1" className="text-xs flex items-center gap-1">
                    <Flame className="h-3 w-3 text-orange-500" />
                    Scope 1 (Direct)
                  </Label>
                  <div className="relative">
                    <Input
                      id="scope1"
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.00"
                      value={scope1Intensity}
                      onChange={(e) => setScope1Intensity(e.target.value)}
                      className="pr-24"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      kgCO₂e {getUnitLabel(intensityUnit)}
                    </span>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="scope2" className="text-xs flex items-center gap-1">
                    <Zap className="h-3 w-3 text-blue-500" />
                    Scope 2 (Energy)
                  </Label>
                  <div className="relative">
                    <Input
                      id="scope2"
                      type="number"
                      step="0.0001"
                      min="0"
                      placeholder="0.00"
                      value={scope2Intensity}
                      onChange={(e) => setScope2Intensity(e.target.value)}
                      className="pr-24"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      kgCO₂e {getUnitLabel(intensityUnit)}
                    </span>
                  </div>
                </div>
              </div>

              {totalIntensity > 0 && (
                <div className="text-sm text-center pt-2 border-t">
                  Total Intensity:{" "}
                  <span className="font-bold">{totalIntensity.toFixed(4)} kgCO₂e</span>{" "}
                  {getUnitLabel(intensityUnit)}
                </div>
              )}
            </div>

            {/* Water & Waste */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="water" className="text-xs flex items-center gap-1">
                  <Droplets className="h-3 w-3 text-cyan-500" />
                  Water Intensity
                </Label>
                <div className="relative">
                  <Input
                    id="water"
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="0.00"
                    value={waterIntensity}
                    onChange={(e) => setWaterIntensity(e.target.value)}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    L {getUnitLabel(intensityUnit)}
                  </span>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="waste" className="text-xs flex items-center gap-1">
                  <Recycle className="h-3 w-3 text-green-500" />
                  Waste Intensity
                </Label>
                <div className="relative">
                  <Input
                    id="waste"
                    type="number"
                    step="0.0001"
                    min="0"
                    placeholder="0.00"
                    value={wasteIntensity}
                    onChange={(e) => setWasteIntensity(e.target.value)}
                    className="pr-16"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                    kg {getUnitLabel(intensityUnit)}
                  </span>
                </div>
              </div>
            </div>

            {/* Data Quality */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="data-source">Data Source</Label>
                <Select value={dataSource} onValueChange={setDataSource}>
                  <SelectTrigger id="data-source">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {DATA_SOURCES.map((source) => (
                      <SelectItem key={source.value} value={source.value}>
                        {source.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="verification">Verification Status</Label>
                <Select value={verificationStatus} onValueChange={setVerificationStatus}>
                  <SelectTrigger id="verification">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {VERIFICATION_STATUS.map((status) => (
                      <SelectItem key={status.value} value={status.value}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Notes */}
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea
                id="notes"
                placeholder="Any relevant notes about this data..."
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={2}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setShowAddModal(false);
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
                  "Save Intensity Factor"
                )}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
