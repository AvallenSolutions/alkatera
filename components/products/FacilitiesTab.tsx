"use client";

import { useState, useEffect, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertCircle,
  Building2,
  Check,
  Factory,
  Loader2,
  MapPin,
  Package,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface FacilitiesTabProps {
  productId: number;
  organizationId: string;
  annualProductionVolume: number | null;
  annualProductionUnit: string | null;
  unitSizeUnit: string | null;
  onProductUpdated: () => void;
}

interface Facility {
  id: string;
  name: string;
  operational_control: "owned" | "third_party";
  address_city: string | null;
  address_country: string | null;
}

interface FacilityAssignment {
  id: string;
  facility_id: string;
  facility: Facility;
  is_primary_facility: boolean;
  allocation_percentage: number;
  lca_allocation?: {
    allocated_emissions: number;
    reporting_period_start: string;
    reporting_period_end: string;
    status: string;
    attribution_ratio: number;
  } | null;
}

const VOLUME_UNITS = [
  { value: "units", label: "Units" },
  { value: "litres", label: "Litres" },
  { value: "kg", label: "Kilograms" },
  { value: "tonnes", label: "Tonnes" },
  { value: "bottles", label: "Bottles" },
  { value: "cases", label: "Cases" },
];

/** Map product unit_size_unit to a sensible production unit default */
function defaultProductionUnit(unitSizeUnit: string | null): string {
  switch (unitSizeUnit) {
    case "ml":
    case "L":
      return "litres";
    case "g":
    case "kg":
      return "kg";
    default:
      return "units";
  }
}

export function FacilitiesTab({
  productId,
  organizationId,
  annualProductionVolume,
  annualProductionUnit,
  unitSizeUnit,
  onProductUpdated,
}: FacilitiesTabProps) {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [assignments, setAssignments] = useState<FacilityAssignment[]>([]);

  // Facility selection dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);

  // Annual production editing
  const [editingProduction, setEditingProduction] = useState(false);
  const [volumeInput, setVolumeInput] = useState(annualProductionVolume?.toString() || "");
  const [unitInput, setUnitInput] = useState(
    annualProductionUnit || defaultProductionUnit(unitSizeUnit)
  );

  // Allocation percentages (local editing state)
  const [allocations, setAllocations] = useState<Record<string, number>>({});

  // Sync external props when they change
  useEffect(() => {
    setVolumeInput(annualProductionVolume?.toString() || "");
    setUnitInput(annualProductionUnit || defaultProductionUnit(unitSizeUnit));
  }, [annualProductionVolume, annualProductionUnit, unitSizeUnit]);

  useEffect(() => {
    loadData();
  }, [productId, organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [facilitiesRes, assignmentsRes] = await Promise.all([
        supabase
          .from("facilities")
          .select("id, name, operational_control, address_city, address_country")
          .eq("organization_id", organizationId),
        supabase
          .from("facility_product_assignments")
          .select(`
            *,
            facilities (
              id,
              name,
              operational_control,
              address_city,
              address_country
            )
          `)
          .eq("product_id", productId)
          .eq("assignment_status", "active"),
      ]);

      if (facilitiesRes.data) setFacilities(facilitiesRes.data);

      if (assignmentsRes.data) {
        const assignmentsList: FacilityAssignment[] = assignmentsRes.data.map((a: any) => ({
          id: a.id,
          facility_id: a.facility_id,
          facility: a.facilities,
          is_primary_facility: a.is_primary_facility,
          allocation_percentage: a.allocation_percentage ?? 100,
        }));

        // Load LCA allocation data for display
        const facilityIds = assignmentsList.map((a) => a.facility_id);
        const lcaAllocationMap: Record<string, FacilityAssignment["lca_allocation"]> = {};

        const { data: peiData } = await supabase
          .from("product_carbon_footprints")
          .select("id")
          .eq("product_id", productId);

        const peiIds = (peiData || []).map((p: any) => p.id);

        if (peiIds.length > 0 && facilityIds.length > 0) {
          const { data: prodSites } = await supabase
            .from("product_carbon_footprint_production_sites")
            .select("facility_id, allocated_emissions_kg_co2e, reporting_period_start, reporting_period_end, status, attribution_ratio")
            .in("product_carbon_footprint_id", peiIds)
            .in("facility_id", facilityIds)
            .order("reporting_period_end", { ascending: false });

          if (prodSites) {
            for (const site of prodSites) {
              if (!lcaAllocationMap[site.facility_id]) {
                lcaAllocationMap[site.facility_id] = {
                  allocated_emissions: site.allocated_emissions_kg_co2e || 0,
                  reporting_period_start: site.reporting_period_start,
                  reporting_period_end: site.reporting_period_end,
                  status: site.status || "draft",
                  attribution_ratio: site.attribution_ratio || 0,
                };
              }
            }
          }
        }

        if (facilityIds.length > 0) {
          const { data: cmAllocations } = await supabase
            .from("contract_manufacturer_allocations")
            .select("facility_id, allocated_emissions_kg_co2e, reporting_period_start, reporting_period_end, status, attribution_ratio")
            .eq("product_id", productId)
            .eq("organization_id", organizationId)
            .in("facility_id", facilityIds)
            .order("reporting_period_end", { ascending: false });

          if (cmAllocations) {
            for (const alloc of cmAllocations) {
              if (!lcaAllocationMap[alloc.facility_id]) {
                lcaAllocationMap[alloc.facility_id] = {
                  allocated_emissions: alloc.allocated_emissions_kg_co2e || 0,
                  reporting_period_start: alloc.reporting_period_start,
                  reporting_period_end: alloc.reporting_period_end,
                  status: alloc.status || "draft",
                  attribution_ratio: alloc.attribution_ratio || 0,
                };
              }
            }
          }
        }

        const enrichedAssignments = assignmentsList.map((a) => ({
          ...a,
          lca_allocation: lcaAllocationMap[a.facility_id] || null,
        }));

        setAssignments(enrichedAssignments);

        // Init allocation percentages from DB
        const allocMap: Record<string, number> = {};
        for (const a of enrichedAssignments) {
          allocMap[a.facility_id] = a.allocation_percentage;
        }
        setAllocations(allocMap);
      }
    } catch (error) {
      console.error("Error loading facilities data:", error);
      toast.error("Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  // --- Facility selection ---

  const handleAddFacilities = () => {
    setSelectedFacilityIds(assignments.map((a) => a.facility_id));
    setDialogOpen(true);
  };

  const handleToggleFacility = (facilityId: string) => {
    setSelectedFacilityIds((prev) =>
      prev.includes(facilityId)
        ? prev.filter((id) => id !== facilityId)
        : [...prev, facilityId]
    );
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      const currentAssignedIds = assignments.map((a) => a.facility_id);

      const response = await fetch("/api/facility-assignments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          organizationId,
          productId,
          selectedFacilityIds,
          currentAssignedIds,
        }),
      });

      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Failed to save");

      // Auto-distribute allocation percentages evenly for new set
      if (selectedFacilityIds.length > 0) {
        const evenPct = Math.round(100 / selectedFacilityIds.length);
        // Fetch updated assignments to get their IDs
        const { data: updatedAssignments } = await supabase
          .from("facility_product_assignments")
          .select("id, facility_id")
          .eq("product_id", productId)
          .eq("assignment_status", "active");

        if (updatedAssignments) {
          for (let i = 0; i < updatedAssignments.length; i++) {
            const isLast = i === updatedAssignments.length - 1;
            const pct = isLast
              ? 100 - evenPct * (updatedAssignments.length - 1)
              : evenPct;
            await supabase
              .from("facility_product_assignments")
              .update({ allocation_percentage: pct })
              .eq("id", updatedAssignments[i].id);
          }
        }
      }

      toast.success("Facilities updated");
      setDialogOpen(false);
      loadData();
    } catch (error: any) {
      console.error("Error saving facility assignments:", error);
      toast.error(error.message || "Failed to update facilities");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFacility = async (assignmentId: string, facilityId: string) => {
    try {
      const { error } = await supabase
        .from("facility_product_assignments")
        .update({ assignment_status: "archived" })
        .eq("id", assignmentId);

      if (error) throw new Error(error.message);

      // Redistribute remaining allocations
      const remaining = assignments.filter((a) => a.facility_id !== facilityId);
      if (remaining.length === 1) {
        await supabase
          .from("facility_product_assignments")
          .update({ allocation_percentage: 100 })
          .eq("id", remaining[0].id);
      } else if (remaining.length > 1) {
        const evenPct = Math.round(100 / remaining.length);
        for (let i = 0; i < remaining.length; i++) {
          const isLast = i === remaining.length - 1;
          const pct = isLast ? 100 - evenPct * (remaining.length - 1) : evenPct;
          await supabase
            .from("facility_product_assignments")
            .update({ allocation_percentage: pct })
            .eq("id", remaining[i].id);
        }
      }

      toast.success("Facility removed");
      loadData();
    } catch (error: any) {
      console.error("Error removing facility:", error);
      toast.error(error.message || "Failed to remove facility");
    }
  };

  // --- Annual production ---

  const handleSaveProduction = async () => {
    setSaving(true);
    try {
      const volume = volumeInput ? parseFloat(volumeInput) : null;
      const { error } = await supabase
        .from("products")
        .update({
          annual_production_volume: volume,
          annual_production_unit: unitInput,
        })
        .eq("id", productId);

      if (error) throw error;

      toast.success("Annual production saved");
      setEditingProduction(false);
      onProductUpdated();
    } catch (error: any) {
      console.error("Error saving production:", error);
      toast.error(error.message || "Failed to save production volume");
    } finally {
      setSaving(false);
    }
  };

  // --- Allocation percentages ---

  const totalAllocation = useMemo(
    () => Object.values(allocations).reduce((sum, pct) => sum + (pct || 0), 0),
    [allocations]
  );

  const handleAllocationChange = (facilityId: string, value: string) => {
    const num = value === "" ? 0 : parseFloat(value);
    if (isNaN(num)) return;
    setAllocations((prev) => ({ ...prev, [facilityId]: Math.min(100, Math.max(0, num)) }));
  };

  const handleSaveAllocations = async () => {
    if (Math.abs(totalAllocation - 100) > 0.5) {
      toast.error("Allocation percentages must total 100%");
      return;
    }
    setSaving(true);
    try {
      for (const assignment of assignments) {
        const pct = allocations[assignment.facility_id] ?? assignment.allocation_percentage;
        await supabase
          .from("facility_product_assignments")
          .update({ allocation_percentage: pct })
          .eq("id", assignment.id);
      }
      toast.success("Allocation saved");
      loadData();
    } catch (error: any) {
      console.error("Error saving allocations:", error);
      toast.error(error.message || "Failed to save allocations");
    } finally {
      setSaving(false);
    }
  };

  // --- Derived values ---

  const hasProductionVolume = annualProductionVolume != null && annualProductionVolume > 0;
  const displayUnit = annualProductionUnit || unitInput;

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Manufacturing Facilities</h3>
          <p className="text-sm text-muted-foreground">
            Where is this product manufactured?
          </p>
        </div>
        <Button onClick={handleAddFacilities} className="bg-lime-500 hover:bg-lime-600 text-black">
          <Plus className="mr-2 h-4 w-4" />
          {assignments.length > 0 ? "Edit Facilities" : "Add Facility"}
        </Button>
      </div>

      {/* Empty State */}
      {assignments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Factory className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h4 className="text-lg font-medium mb-2">No Facilities Assigned</h4>
            <p className="text-sm text-muted-foreground mb-4">
              Link the facilities where this product is manufactured
            </p>
            <Button onClick={handleAddFacilities} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Facility
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Annual Production Card */}
          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="h-10 w-10 rounded-lg bg-lime-500/20 flex items-center justify-center">
                    <Package className="h-5 w-5 text-lime-500" />
                  </div>
                  <div>
                    <CardTitle className="text-base">Annual Production</CardTitle>
                    <CardDescription>
                      How many units of this product do you produce per year?
                    </CardDescription>
                  </div>
                </div>
                {hasProductionVolume && !editingProduction && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setEditingProduction(true)}
                  >
                    Edit
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {!hasProductionVolume || editingProduction ? (
                <div className="flex items-end gap-3">
                  <div className="flex-1 space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Volume</Label>
                    <Input
                      type="number"
                      value={volumeInput}
                      onChange={(e) => setVolumeInput(e.target.value)}
                      placeholder="e.g. 10000"
                      min={0}
                    />
                  </div>
                  <div className="w-40 space-y-1.5">
                    <Label className="text-sm text-muted-foreground">Unit</Label>
                    <Select value={unitInput} onValueChange={setUnitInput}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {VOLUME_UNITS.map((unit) => (
                          <SelectItem key={unit.value} value={unit.value}>
                            {unit.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button
                    onClick={handleSaveProduction}
                    disabled={saving || !volumeInput}
                    className="bg-lime-500 hover:bg-lime-600 text-black"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save"}
                  </Button>
                  {editingProduction && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setEditingProduction(false);
                        setVolumeInput(annualProductionVolume?.toString() || "");
                        setUnitInput(annualProductionUnit || defaultProductionUnit(unitSizeUnit));
                      }}
                    >
                      Cancel
                    </Button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-bold text-lime-500">
                    {annualProductionVolume!.toLocaleString()}
                  </span>
                  <span className="text-lg text-muted-foreground">{displayUnit} / year</span>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facility List */}
          <Card>
            <CardHeader>
              <CardTitle>Linked Facilities</CardTitle>
              <CardDescription>
                {assignments.length === 1
                  ? "This product is manufactured at one facility"
                  : `Split production across ${assignments.length} facilities`}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {assignments.map((assignment) => {
                const pct = allocations[assignment.facility_id] ?? assignment.allocation_percentage;
                const computedVolume = hasProductionVolume
                  ? Math.round((annualProductionVolume! * pct) / 100)
                  : null;

                return (
                  <div
                    key={assignment.id}
                    className="p-4 rounded-lg border bg-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        {assignment.facility.operational_control === "owned" ? (
                          <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                            <Building2 className="h-5 w-5 text-blue-400" />
                          </div>
                        ) : (
                          <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                            <Users className="h-5 w-5 text-amber-400" />
                          </div>
                        )}
                        <div>
                          <div className="flex items-center gap-2">
                            <p className="font-medium">{assignment.facility.name}</p>
                            <Badge variant="outline" className="text-xs">
                              {assignment.facility.operational_control === "owned" ? "Owned" : "Third Party"}
                            </Badge>
                            {assignment.is_primary_facility && (
                              <Badge className="bg-lime-500/20 text-lime-700 dark:text-lime-300 text-xs">Primary</Badge>
                            )}
                          </div>
                          {assignment.facility.address_city && (
                            <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                              <MapPin className="h-3 w-3" />
                              {assignment.facility.address_city}, {assignment.facility.address_country}
                            </p>
                          )}
                        </div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemoveFacility(assignment.id, assignment.facility_id)}
                        className="text-muted-foreground hover:text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>

                    {/* Allocation & computed volume */}
                    <div className="mt-3 flex items-center gap-4">
                      {assignments.length > 1 ? (
                        <div className="flex items-center gap-2">
                          <Label className="text-sm text-muted-foreground whitespace-nowrap">Allocation</Label>
                          <Input
                            type="number"
                            value={pct}
                            onChange={(e) => handleAllocationChange(assignment.facility_id, e.target.value)}
                            className="w-20 text-right"
                            min={0}
                            max={100}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-2">
                          <Badge variant="secondary">100%</Badge>
                        </div>
                      )}

                      {computedVolume != null && (
                        <p className="text-sm text-muted-foreground">
                          {computedVolume.toLocaleString()} {displayUnit} / year
                        </p>
                      )}

                      {/* LCA results badge */}
                      {assignment.lca_allocation && (
                        <Badge
                          variant="outline"
                          className="ml-auto text-xs border-lime-500/30 text-lime-700 dark:text-lime-300"
                        >
                          <Check className="h-3 w-3 mr-1" />
                          Latest LCA: {assignment.lca_allocation.allocated_emissions.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg CO₂e
                        </Badge>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* Allocation validation & save */}
              {assignments.length > 1 && (
                <div className="flex items-center justify-between pt-2 border-t">
                  <div className="flex items-center gap-2">
                    {Math.abs(totalAllocation - 100) > 0.5 ? (
                      <Badge variant="destructive" className="bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30">
                        <AlertCircle className="h-3 w-3 mr-1" />
                        Total: {totalAllocation.toFixed(0)}% — must equal 100%
                      </Badge>
                    ) : (
                      <Badge variant="secondary" className="bg-lime-500/20 text-lime-700 dark:text-lime-300">
                        <Check className="h-3 w-3 mr-1" />
                        Total: 100%
                      </Badge>
                    )}
                  </div>
                  <Button
                    onClick={handleSaveAllocations}
                    disabled={saving || Math.abs(totalAllocation - 100) > 0.5}
                    size="sm"
                    className="bg-lime-500 hover:bg-lime-600 text-black"
                  >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Save Allocation"}
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}

      {/* Facility Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select Facilities</DialogTitle>
            <DialogDescription>
              Choose which facilities manufacture this product.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {facilities.length === 0 ? (
              <div className="text-center py-8">
                <Factory className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">
                  No facilities found. Add facilities in Company &gt; Facilities first.
                </p>
              </div>
            ) : (
              facilities.map((facility) => (
                <div
                  key={facility.id}
                  className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-all ${
                    selectedFacilityIds.includes(facility.id)
                      ? "bg-lime-500/10 border-lime-500/50"
                      : "border-border hover:border-muted-foreground/30"
                  }`}
                  onClick={() => handleToggleFacility(facility.id)}
                >
                  <Checkbox
                    checked={selectedFacilityIds.includes(facility.id)}
                    onCheckedChange={() => handleToggleFacility(facility.id)}
                  />
                  <div className="flex items-center gap-3 flex-1">
                    {facility.operational_control === "owned" ? (
                      <Building2 className="h-5 w-5 text-blue-400" />
                    ) : (
                      <Users className="h-5 w-5 text-amber-400" />
                    )}
                    <div>
                      <p className="font-medium">{facility.name}</p>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        {facility.address_city && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {facility.address_city}
                          </span>
                        )}
                        <Badge variant="outline" className="text-xs">
                          {facility.operational_control === "owned" ? "Owned" : "Third Party"}
                        </Badge>
                      </div>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </Button>
            <Button
              onClick={handleSaveAssignments}
              disabled={saving || facilities.length === 0}
              className="bg-lime-500 hover:bg-lime-600 text-black"
            >
              {saving ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>Save ({selectedFacilityIds.length} selected)</>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
