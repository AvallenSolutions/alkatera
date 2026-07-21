"use client";

import { useState, useEffect, useMemo } from "react";
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
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { PillButton } from "@/components/studio/pill-button";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import {
  PRODUCTION_UNITS,
  defaultProductionUnitForSize,
} from "@/lib/constants/production-units";

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

const VOLUME_UNITS = PRODUCTION_UNITS;

/** Small mono field label, studio idiom. */
const FIELD_LABEL =
  "font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim";

/**
 * Map product unit_size_unit to a sensible production unit default.
 * Delegates to the shared helper -- this was one of three hand-rolled unit
 * mappers that existed only to bridge the competing vocabularies.
 */
const defaultProductionUnit = defaultProductionUnitForSize;

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
  const allocationBalanced = Math.abs(totalAllocation - 100) <= 0.5;

  if (loading) {
    return (
      <div className="py-12">
        <p className="animate-pulse text-sm text-studio-dim">Loading facilities...</p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {assignments.length === 0 ? (
        /* Empty state: one dim line, one pill */
        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-1">Manufacturing</Eyebrow>
          <p className="mb-4 max-w-xl text-sm text-studio-dim">
            No facilities assigned yet. Link the facilities where this product is made so its
            footprint can be allocated across them.
          </p>
          <PillButton variant="room" size="sm" onClick={handleAddFacilities}>
            Add a facility
          </PillButton>
        </section>
      ) : (
        <>
          {/* Annual production */}
          <section className="border-t border-border pt-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <Eyebrow className="mb-1">Annual production</Eyebrow>
                <p className="text-sm text-muted-foreground">
                  How many units of this product do you make each year?
                </p>
              </div>
              {hasProductionVolume && !editingProduction && (
                <PillButton variant="ghost" size="sm" onClick={() => setEditingProduction(true)}>
                  Edit
                </PillButton>
              )}
            </div>

            {!hasProductionVolume || editingProduction ? (
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 space-y-1.5">
                  <Label className={FIELD_LABEL}>Volume</Label>
                  <Input
                    type="number"
                    value={volumeInput}
                    onChange={(e) => setVolumeInput(e.target.value)}
                    placeholder="e.g. 10000"
                    min={0}
                  />
                </div>
                <div className="w-40 space-y-1.5">
                  <Label className={FIELD_LABEL}>Unit</Label>
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
                <PillButton onClick={handleSaveProduction} disabled={saving || !volumeInput}>
                  {saving ? "Saving..." : "Save"}
                </PillButton>
                {editingProduction && (
                  <PillButton
                    variant="ghost"
                    onClick={() => {
                      setEditingProduction(false);
                      setVolumeInput(annualProductionVolume?.toString() || "");
                      setUnitInput(annualProductionUnit || defaultProductionUnit(unitSizeUnit));
                    }}
                  >
                    Cancel
                  </PillButton>
                )}
              </div>
            ) : (
              <BigNumber
                value={annualProductionVolume!.toLocaleString("en-GB")}
                label={`${displayUnit} per year`}
              />
            )}
          </section>

          {/* Linked facilities */}
          <section className="border-t border-border pt-5">
            <div className="mb-4 flex items-start justify-between gap-4">
              <div>
                <Eyebrow className="mb-1">Linked facilities</Eyebrow>
                <p className="text-sm text-muted-foreground">
                  {assignments.length === 1
                    ? "Made at one facility."
                    : `Split across ${assignments.length} facilities.`}
                </p>
              </div>
              <PillButton variant="room" size="sm" onClick={handleAddFacilities}>
                Edit facilities
              </PillButton>
            </div>

            <div className="divide-y divide-border">
              {assignments.map((assignment) => {
                const pct = allocations[assignment.facility_id] ?? assignment.allocation_percentage;
                const computedVolume = hasProductionVolume
                  ? Math.round((annualProductionVolume! * pct) / 100)
                  : null;
                const owned = assignment.facility.operational_control === "owned";

                return (
                  <div key={assignment.id} className="py-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                          <span className="font-display text-sm font-semibold text-foreground">
                            {assignment.facility.name}
                          </span>
                          <StateChip tone={owned ? "good" : "quiet"}>
                            {owned ? "Owned" : "Third party"}
                          </StateChip>
                          {assignment.is_primary_facility && (
                            <StateChip tone="quiet">Primary</StateChip>
                          )}
                        </div>
                        {assignment.facility.address_city && (
                          <p className="mt-0.5 text-xs text-muted-foreground">
                            {assignment.facility.address_city}, {assignment.facility.address_country}
                          </p>
                        )}
                      </div>
                      <PillButton
                        variant="ghost"
                        size="sm"
                        className="text-studio-stale hover:text-studio-stale"
                        onClick={() =>
                          handleRemoveFacility(assignment.id, assignment.facility_id)
                        }
                      >
                        Remove
                      </PillButton>
                    </div>

                    {/* Allocation & computed volume */}
                    <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-2">
                      {assignments.length > 1 ? (
                        <div className="flex items-center gap-2">
                          <Label className={`${FIELD_LABEL} whitespace-nowrap`}>Allocation</Label>
                          <Input
                            type="number"
                            value={pct}
                            onChange={(e) =>
                              handleAllocationChange(assignment.facility_id, e.target.value)
                            }
                            className="w-20 text-right tabular-nums"
                            min={0}
                            max={100}
                          />
                          <span className="text-sm text-muted-foreground">%</span>
                        </div>
                      ) : (
                        <StateChip tone="quiet">100% allocation</StateChip>
                      )}

                      {computedVolume != null && (
                        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                          {computedVolume.toLocaleString("en-GB")} {displayUnit} / year
                        </span>
                      )}

                      {/* Latest LCA result */}
                      {assignment.lca_allocation && (
                        <span className="ml-auto font-display text-sm font-bold tabular-nums text-foreground">
                          {assignment.lca_allocation.allocated_emissions.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                          <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                            kg CO₂e latest LCA
                          </span>
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Allocation validation & save */}
            {assignments.length > 1 && (
              <div className="mt-4 flex items-center justify-between border-t border-border pt-4">
                <StateChip tone={allocationBalanced ? "good" : "attention"}>
                  {allocationBalanced
                    ? "Total 100%"
                    : `Total ${totalAllocation.toFixed(0)}%, must equal 100%`}
                </StateChip>
                <PillButton
                  onClick={handleSaveAllocations}
                  disabled={saving || !allocationBalanced}
                  size="sm"
                >
                  {saving ? "Saving..." : "Save allocation"}
                </PillButton>
              </div>
            )}
          </section>
        </>
      )}

      {/* Facility Selection Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Select facilities</DialogTitle>
            <DialogDescription>
              Choose which facilities manufacture this product.
            </DialogDescription>
          </DialogHeader>

          <div className="max-h-96 space-y-3 overflow-y-auto py-4">
            {facilities.length === 0 ? (
              <p className="py-8 text-center text-sm text-studio-dim">
                No facilities found. Add facilities in Company &gt; Facilities first.
              </p>
            ) : (
              facilities.map((facility) => {
                const selected = selectedFacilityIds.includes(facility.id);
                const owned = facility.operational_control === "owned";
                return (
                  <div
                    key={facility.id}
                    className={`flex cursor-pointer items-center gap-4 rounded-[6px] border p-4 transition-colors duration-200 ease-studio ${
                      selected
                        ? "border-room-accent bg-room-accent/5"
                        : "border-border hover:border-studio-dim/50"
                    }`}
                    onClick={() => handleToggleFacility(facility.id)}
                  >
                    <Checkbox
                      checked={selected}
                      onCheckedChange={() => handleToggleFacility(facility.id)}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold text-foreground">
                        {facility.name}
                      </p>
                      <div className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1">
                        {facility.address_city && (
                          <span className="text-xs text-muted-foreground">
                            {facility.address_city}
                          </span>
                        )}
                        <StateChip tone={owned ? "good" : "quiet"}>
                          {owned ? "Owned" : "Third party"}
                        </StateChip>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <PillButton variant="ghost" onClick={() => setDialogOpen(false)} disabled={saving}>
              Cancel
            </PillButton>
            <PillButton
              variant="room"
              onClick={handleSaveAssignments}
              disabled={saving || facilities.length === 0}
            >
              {saving ? "Saving..." : `Save (${selectedFacilityIds.length} selected)`}
            </PillButton>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
