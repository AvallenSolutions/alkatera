"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertCircle,
  Building2,
  Calendar,
  Factory,
  Loader2,
  MapPin,
  Plus,
  Trash2,
  Users,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { format } from "date-fns";

interface FacilitiesTabProps {
  productId: number;
  organizationId: string;
}

interface Facility {
  id: string;
  name: string;
  operational_control: "owned" | "third_party";
  address_city: string | null;
  address_country: string | null;
  functions: string[] | null;
}

interface FacilityAssignment {
  id: string;
  facility_id: string;
  product_id: number;
  is_primary_facility: boolean;
  assignment_status: string;
  created_at: string;
  facility?: Facility;
}

interface Allocation {
  id: string;
  facility_id: string;
  facility_name: string;
  facility_city: string | null;
  facility_country: string | null;
  supplier_name: string | null;
  reporting_period_start: string;
  reporting_period_end: string;
  total_facility_production_volume: number;
  production_volume_unit: string;
  client_production_volume: number;
  attribution_ratio: number;
  allocated_emissions_kg_co2e: number;
  allocated_water_litres?: number;
  allocated_waste_kg?: number;
  emission_intensity_kg_co2e_per_unit: number;
  water_intensity_litres_per_unit?: number;
  waste_intensity_kg_per_unit?: number;
  status: string;
  is_energy_intensive_process: boolean;
  uses_proxy_data?: boolean;
  data_source_tag: string;
  co2e_entry_method: string;
  created_at: string;
  days_pending: number | null;
}

export function FacilitiesTab({ productId, organizationId }: FacilitiesTabProps) {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [assignments, setAssignments] = useState<FacilityAssignment[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedFacilityIds, setSelectedFacilityIds] = useState<string[]>([]);

  useEffect(() => {
    loadData();
  }, [productId, organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // First get the product_lca_id for this product (for legacy allocations)
      const { data: productLCAs } = await supabase
        .from("product_lcas")
        .select("id")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1);

      const productLcaId = productLCAs?.[0]?.id;

      const [facilitiesRes, assignmentsRes, allocationsRes, productionSitesRes] = await Promise.all([
        // All facilities in the organization
        supabase
          .from("facilities")
          .select("id, name, operational_control, address_city, address_country, functions")
          .eq("organization_id", organizationId),
        // Current facility assignments for this product
        supabase
          .from("facility_product_assignments")
          .select(`
            id,
            facility_id,
            product_id,
            is_primary_facility,
            assignment_status,
            created_at,
            facilities (
              id,
              name,
              operational_control,
              address_city,
              address_country,
              functions
            )
          `)
          .eq("product_id", productId)
          .eq("assignment_status", "active"),
        // Contract manufacturer allocations (legacy data)
        supabase
          .from("contract_manufacturer_allocation_summary")
          .select("*")
          .eq("product_id", productId)
          .eq("organization_id", organizationId)
          .order("reporting_period_start", { ascending: false }),
        // Owned facility production sites (legacy data)
        productLcaId ? supabase
          .from("product_lca_production_sites")
          .select(`
            id,
            facility_id,
            production_volume,
            share_of_production,
            facility_intensity,
            data_source,
            created_at,
            reporting_period_start,
            reporting_period_end,
            attribution_ratio,
            allocated_emissions_kg_co2e,
            allocated_water_litres,
            allocated_waste_kg,
            emission_intensity_kg_co2e_per_unit,
            water_intensity_litres_per_unit,
            waste_intensity_kg_per_unit,
            status,
            is_energy_intensive_process,
            uses_proxy_data,
            data_source_tag,
            co2e_entry_method,
            facilities!inner (
              name,
              address_city,
              address_country
            )
          `)
          .eq("product_lca_id", productLcaId)
          .order("created_at", { ascending: false }) : Promise.resolve({ data: [] }),
      ]);

      if (facilitiesRes.data) setFacilities(facilitiesRes.data);

      if (assignmentsRes.data) {
        setAssignments(assignmentsRes.data.map((a: any) => ({
          ...a,
          facility: a.facilities,
        })));
      }

      // Merge contract manufacturer allocations with owned facility production sites
      const cmAllocations = allocationsRes.data || [];
      const ownedSites = (productionSitesRes.data || []).map((site: any) => ({
        id: site.id,
        facility_id: site.facility_id,
        facility_name: site.facilities.name,
        facility_city: site.facilities.address_city,
        facility_country: site.facilities.address_country,
        supplier_name: null,
        reporting_period_start: site.reporting_period_start || site.created_at,
        reporting_period_end: site.reporting_period_end || site.created_at,
        total_facility_production_volume: site.production_volume,
        production_volume_unit: "units",
        client_production_volume: site.production_volume,
        attribution_ratio: (site.attribution_ratio || site.share_of_production || 100) / 100,
        allocated_emissions_kg_co2e: site.allocated_emissions_kg_co2e || (site.facility_intensity || 0) * site.production_volume,
        allocated_water_litres: site.allocated_water_litres || 0,
        allocated_waste_kg: site.allocated_waste_kg || 0,
        emission_intensity_kg_co2e_per_unit: site.emission_intensity_kg_co2e_per_unit || site.facility_intensity || 0,
        water_intensity_litres_per_unit: site.water_intensity_litres_per_unit || 0,
        waste_intensity_kg_per_unit: site.waste_intensity_kg_per_unit || 0,
        status: site.status || (site.data_source === "Verified" ? "verified" : "provisional"),
        is_energy_intensive_process: site.is_energy_intensive_process || false,
        uses_proxy_data: site.uses_proxy_data || site.data_source !== "Verified",
        data_source_tag: site.data_source_tag || site.data_source,
        co2e_entry_method: site.co2e_entry_method || "Production Volume Allocation",
        created_at: site.created_at,
        days_pending: null,
      }));

      setAllocations([...cmAllocations, ...ownedSites]);
    } catch (error) {
      console.error("Error loading facilities data:", error);
      toast.error("Failed to load facilities");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFacilities = () => {
    // Pre-select currently assigned facilities
    setSelectedFacilityIds(assignments.map(a => a.facility_id));
    setDialogOpen(true);
  };

  const handleToggleFacility = (facilityId: string) => {
    setSelectedFacilityIds(prev =>
      prev.includes(facilityId)
        ? prev.filter(id => id !== facilityId)
        : [...prev, facilityId]
    );
  };

  const handleSaveAssignments = async () => {
    setSaving(true);
    try {
      const currentAssignedIds = assignments.map(a => a.facility_id);

      // Find facilities to add
      const toAdd = selectedFacilityIds.filter(id => !currentAssignedIds.includes(id));

      // Find facilities to remove
      const toRemove = currentAssignedIds.filter(id => !selectedFacilityIds.includes(id));

      // Add new assignments
      if (toAdd.length > 0) {
        const { error: insertError } = await supabase
          .from("facility_product_assignments")
          .insert(toAdd.map((facilityId, index) => ({
            facility_id: facilityId,
            product_id: productId,
            is_primary_facility: index === 0 && assignments.length === 0,
            assignment_status: "active",
          })));

        if (insertError) throw insertError;
      }

      // Remove assignments (soft delete by changing status)
      if (toRemove.length > 0) {
        const { error: updateError } = await supabase
          .from("facility_product_assignments")
          .update({ assignment_status: "archived" })
          .eq("product_id", productId)
          .in("facility_id", toRemove);

        if (updateError) throw updateError;
      }

      toast.success("Facilities updated successfully");
      setDialogOpen(false);
      loadData();
    } catch (error) {
      console.error("Error saving facility assignments:", error);
      toast.error("Failed to update facilities");
    } finally {
      setSaving(false);
    }
  };

  const handleRemoveFacility = async (assignmentId: string) => {
    try {
      const { error } = await supabase
        .from("facility_product_assignments")
        .update({ assignment_status: "archived" })
        .eq("id", assignmentId);

      if (error) throw error;

      toast.success("Facility removed");
      loadData();
    } catch (error) {
      console.error("Error removing facility:", error);
      toast.error("Failed to remove facility");
    }
  };

  const getStatusBadge = (status: string, isEnergyIntensive: boolean, usesProxyData?: boolean) => {
    if (status === "provisional" || isEnergyIntensive || usesProxyData) {
      return <Badge className="bg-amber-500/20 text-amber-300">Provisional</Badge>;
    }
    if (status === "verified") {
      return <Badge className="bg-lime-500/20 text-lime-300">Verified</Badge>;
    }
    if (status === "approved") {
      return <Badge className="bg-blue-500/20 text-blue-300">Approved</Badge>;
    }
    return <Badge className="bg-slate-500/20 text-slate-300">Draft</Badge>;
  };

  const totalAllocatedEmissions = allocations
    .filter((a) => a.status !== "draft")
    .reduce((sum, a) => sum + (a.allocated_emissions_kg_co2e || 0), 0);

  const hasProvisionalAllocations = allocations.some(
    (a) => a.status === "provisional" || a.is_energy_intensive_process || a.uses_proxy_data
  );

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
          <h3 className="text-lg font-semibold text-white">Facilities</h3>
          <p className="text-sm text-slate-400">
            Facilities where this product is manufactured
          </p>
        </div>
        <Button onClick={handleAddFacilities} className="bg-lime-500 hover:bg-lime-600 text-black">
          <Plus className="mr-2 h-4 w-4" />
          {assignments.length > 0 ? "Edit Facilities" : "Add Facility"}
        </Button>
      </div>

      {/* Assigned Facilities */}
      {assignments.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <h4 className="text-lg font-medium text-white mb-2">No Facilities Assigned</h4>
            <p className="text-sm text-slate-400 mb-4">
              Link facilities to this product to track manufacturing emissions
            </p>
            <Button onClick={handleAddFacilities} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Facility
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardHeader>
            <CardTitle className="text-white">Linked Facilities</CardTitle>
            <CardDescription>
              {assignments.length} {assignments.length === 1 ? "facility" : "facilities"} linked to this product
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {assignments.map((assignment) => (
                <div
                  key={assignment.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-slate-800/50 border border-slate-700"
                >
                  <div className="flex items-center gap-4">
                    {assignment.facility?.operational_control === "owned" ? (
                      <div className="h-10 w-10 rounded-full bg-blue-500/20 flex items-center justify-center">
                        <Building2 className="h-5 w-5 text-blue-400" />
                      </div>
                    ) : (
                      <div className="h-10 w-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                        <Users className="h-5 w-5 text-amber-400" />
                      </div>
                    )}
                    <div>
                      <p className="font-medium text-white">{assignment.facility?.name}</p>
                      {assignment.facility?.address_city && (
                        <p className="text-sm text-slate-400 flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {assignment.facility.address_city}, {assignment.facility.address_country}
                        </p>
                      )}
                    </div>
                    {assignment.is_primary_facility && (
                      <Badge className="bg-lime-500/20 text-lime-300">Primary</Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleRemoveFacility(assignment.id)}
                    className="text-slate-400 hover:text-red-400"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Info about allocation */}
      {assignments.length > 0 && allocations.length === 0 && (
        <Alert className="bg-blue-500/10 border-blue-500/20">
          <Info className="h-4 w-4 text-blue-400" />
          <AlertDescription className="text-blue-200">
            Facility emission allocation will be calculated when you run the LCA calculation.
            Go to <strong>Calculate LCA</strong> to enter reporting periods and production volumes.
          </AlertDescription>
        </Alert>
      )}

      {/* Existing Allocations (Legacy Data) */}
      {allocations.length > 0 && (
        <>
          {hasProvisionalAllocations && (
            <Alert className="bg-amber-500/10 border-amber-500/20">
              <AlertCircle className="h-4 w-4 text-amber-400" />
              <AlertDescription className="text-amber-200">
                This product has <strong>provisional allocations</strong> pending verification.
                Final reports cannot be generated until all allocations are verified.
              </AlertDescription>
            </Alert>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Allocations</p>
                  <p className="text-3xl font-bold text-white mt-1">{allocations.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Allocated CO₂e</p>
                  <p className="text-3xl font-bold text-lime-400 mt-1">
                    {totalAllocatedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500">kg CO₂e</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Status</p>
                  <div className="mt-2">
                    {hasProvisionalAllocations ? (
                      <Badge className="bg-amber-500/20 text-amber-300">Pending Review</Badge>
                    ) : (
                      <Badge className="bg-lime-500/20 text-lime-300">All Verified</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardHeader>
              <CardTitle className="text-white">Allocation History</CardTitle>
              <CardDescription>
                Time-bound snapshots of facility emissions allocated to this product
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow className="border-slate-700">
                    <TableHead className="text-slate-400">Facility</TableHead>
                    <TableHead className="text-slate-400">Period</TableHead>
                    <TableHead className="text-slate-400 text-right">Attribution</TableHead>
                    <TableHead className="text-slate-400 text-right">CO₂e</TableHead>
                    <TableHead className="text-slate-400">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allocations.map((allocation) => (
                    <TableRow key={allocation.id} className="border-slate-700">
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Factory className="h-4 w-4 text-slate-500" />
                          <div>
                            <p className="font-medium text-white">{allocation.facility_name}</p>
                            {allocation.facility_city && (
                              <p className="text-xs text-slate-400 flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {allocation.facility_city}, {allocation.facility_country}
                              </p>
                            )}
                          </div>
                        </div>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1 text-slate-300">
                          <Calendar className="h-3 w-3" />
                          <span className="text-sm">
                            {format(new Date(allocation.reporting_period_start), "MMM yyyy")} -{" "}
                            {format(new Date(allocation.reporting_period_end), "MMM yyyy")}
                          </span>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-white">
                          {(allocation.attribution_ratio * 100).toFixed(1)}%
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-lime-400">
                          {allocation.allocated_emissions_kg_co2e?.toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">kg</span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          {allocation.uses_proxy_data && (
                            <Badge variant="outline" className="text-amber-300 border-amber-500">
                              EST
                            </Badge>
                          )}
                          {getStatusBadge(allocation.status, allocation.is_energy_intensive_process, allocation.uses_proxy_data)}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
              Choose which facilities manufacture this product. You can select multiple facilities.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 max-h-96 overflow-y-auto">
            {facilities.length === 0 ? (
              <div className="text-center py-8">
                <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
                <p className="text-sm text-slate-400">
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
                      : "bg-slate-800/50 border-slate-700 hover:border-slate-600"
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
                      <p className="font-medium text-white">{facility.name}</p>
                      <div className="flex items-center gap-2 text-sm text-slate-400">
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

          <div className="flex justify-end gap-3 pt-4 border-t border-slate-700">
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
                <>
                  Save ({selectedFacilityIds.length} selected)
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Backwards compatibility export
export { FacilitiesTab as ProductionSitesTab };
