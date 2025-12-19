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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ChevronRight,
  Factory,
  Loader2,
  MapPin,
  Plus,
  Users,
} from "lucide-react";
import { toast } from "sonner";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { ContractManufacturerAllocationForm } from "@/components/facilities/ContractManufacturerAllocationForm";
import { OwnedFacilityProductionForm } from "@/components/facilities/OwnedFacilityProductionForm";
import { format } from "date-fns";

interface ProductionSitesTabProps {
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

export function ProductionSitesTab({ productId, organizationId }: ProductionSitesTabProps) {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  const [dialogStep, setDialogStep] = useState<"closed" | "facility_selection" | "allocation_form">("closed");
  const [selectedFacility, setSelectedFacility] = useState<Facility | null>(null);
  const [facilityType, setFacilityType] = useState<"owned" | "contract_manufacturer">("contract_manufacturer");

  useEffect(() => {
    loadData();
  }, [productId, organizationId]);

  const loadData = async () => {
    setLoading(true);
    try {
      // First get the product_lca_id for this product
      const { data: productLCAs } = await supabase
        .from("product_lcas")
        .select("id")
        .eq("product_id", productId)
        .order("created_at", { ascending: false })
        .limit(1);

      const productLcaId = productLCAs?.[0]?.id;

      const [facilitiesRes, allocationsRes, productionSitesRes] = await Promise.all([
        supabase
          .from("facilities")
          .select("id, name, operational_control, address_city, address_country, functions")
          .eq("organization_id", organizationId),
        supabase
          .from("contract_manufacturer_allocation_summary")
          .select("*")
          .eq("product_id", productId)
          .eq("organization_id", organizationId)
          .order("reporting_period_start", { ascending: false }),
        // Fetch owned facility production sites
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
            scope1_emissions_kg_co2e,
            scope2_emissions_kg_co2e,
            scope3_emissions_kg_co2e,
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
      console.error("Error loading production sites data:", error);
      toast.error("Failed to load production sites");
    } finally {
      setLoading(false);
    }
  };

  const handleAddFacility = () => {
    setDialogStep("facility_selection");
    setSelectedFacility(null);
    setFacilityType("contract_manufacturer");
  };

  const handleSelectFacility = (facilityId: string) => {
    const facility = facilities.find((f) => f.id === facilityId);
    if (facility) {
      setSelectedFacility(facility);
    }
  };

  const handleProceedToAllocation = (e?: React.MouseEvent) => {
    e?.preventDefault();
    e?.stopPropagation();

    console.log("Continue clicked", { selectedFacility, facilityType });

    if (!selectedFacility) {
      toast.error("Please select a facility");
      return;
    }

    if (facilityType === "contract_manufacturer" || facilityType === "owned") {
      console.log("Opening allocation form");
      setDialogStep("allocation_form");
    } else {
      toast.error("Please select a facility type");
      setDialogStep("closed");
    }
  };

  const handleAllocationSuccess = () => {
    setDialogStep("closed");
    setSelectedFacility(null);
    loadData();
  };

  const handleCloseDialog = () => {
    setDialogStep("closed");
  };

  const handleCancelAllocation = () => {
    setDialogStep("closed");
    setSelectedFacility(null);
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

  const totalAllocatedWater = allocations
    .filter((a) => a.status !== "draft")
    .reduce((sum, a) => sum + (a.allocated_water_litres || 0), 0);

  const totalAllocatedWaste = allocations
    .filter((a) => a.status !== "draft")
    .reduce((sum, a) => sum + (a.allocated_waste_kg || 0), 0);

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
      {hasProvisionalAllocations && (
        <Alert className="bg-amber-500/10 border-amber-500/20">
          <AlertCircle className="h-4 w-4 text-amber-400" />
          <AlertDescription className="text-amber-200">
            This product has <strong>provisional allocations</strong> pending verification.
            Final reports cannot be generated until all allocations are verified.
          </AlertDescription>
        </Alert>
      )}

      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-white">Production Sites</h3>
          <p className="text-sm text-slate-400">
            Facilities where this product is manufactured
          </p>
        </div>
        <Button onClick={handleAddFacility} className="bg-lime-500 hover:bg-lime-600 text-black">
          <Plus className="mr-2 h-4 w-4" />
          Add Production Site
        </Button>
      </div>

      {allocations.length === 0 ? (
        <Card className="bg-slate-900/50 border-slate-800">
          <CardContent className="py-12 text-center">
            <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <h4 className="text-lg font-medium text-white mb-2">No Production Sites Assigned</h4>
            <p className="text-sm text-slate-400 mb-4">
              Add production facilities to track manufacturing emissions for this product
            </p>
            <Button onClick={handleAddFacility} variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Add First Production Site
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Total Allocations</p>
                  <p className="text-3xl font-bold text-white mt-1">{allocations.length}</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">CO₂e Emissions</p>
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
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Water Usage</p>
                  <p className="text-3xl font-bold text-blue-400 mt-1">
                    {totalAllocatedWater.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500">litres</p>
                </div>
              </CardContent>
            </Card>
            <Card className="bg-slate-900/50 border-slate-800">
              <CardContent className="pt-6">
                <div className="text-center">
                  <p className="text-xs text-slate-400 uppercase tracking-wider">Waste Generated</p>
                  <p className="text-3xl font-bold text-amber-400 mt-1">
                    {totalAllocatedWaste.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-slate-500">kg</p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="bg-slate-900/50 border-slate-800">
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-xs text-slate-400 uppercase tracking-wider">Verification Status</p>
                <div className="mt-2">
                  {hasProvisionalAllocations ? (
                    <Badge className="bg-amber-500/20 text-amber-300 text-lg px-4 py-1">
                      Pending Review
                    </Badge>
                  ) : (
                    <Badge className="bg-lime-500/20 text-lime-300 text-lg px-4 py-1">
                      All Verified
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>

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
                    <TableHead className="text-slate-400 text-right">Water</TableHead>
                    <TableHead className="text-slate-400 text-right">Waste</TableHead>
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
                      <TableCell className="text-right">
                        <span className="font-mono text-blue-400">
                          {(allocation.allocated_water_litres || 0).toLocaleString(undefined, {
                            maximumFractionDigits: 0,
                          })}
                        </span>
                        <span className="text-xs text-slate-500 ml-1">L</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="font-mono text-amber-400">
                          {(allocation.allocated_waste_kg || 0).toLocaleString(undefined, {
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

      <Dialog open={dialogStep === "facility_selection"} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Add Production Site</DialogTitle>
            <DialogDescription>
              Select a facility and specify how it relates to this product
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 py-4">
            <div>
              <Label>Select Facility</Label>
              <Select
                value={selectedFacility?.id || ""}
                onValueChange={handleSelectFacility}
              >
                <SelectTrigger className="mt-2">
                  <SelectValue placeholder="Choose a facility" />
                </SelectTrigger>
                <SelectContent>
                  {facilities.map((facility) => (
                    <SelectItem key={facility.id} value={facility.id}>
                      <div className="flex items-center gap-2">
                        {facility.operational_control === "owned" ? (
                          <Building2 className="h-4 w-4 text-blue-500" />
                        ) : (
                          <Users className="h-4 w-4 text-amber-500" />
                        )}
                        <span>{facility.name}</span>
                        {facility.address_city && (
                          <span className="text-slate-400 text-sm">
                            ({facility.address_city})
                          </span>
                        )}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {selectedFacility && (
              <div className="space-y-4">
                <div>
                  <Label>Facility Type</Label>
                  <div className="grid grid-cols-2 gap-3 mt-2">
                    <Card
                      className={`cursor-pointer transition-all ${
                        facilityType === "owned"
                          ? "ring-2 ring-blue-500 bg-blue-500/10"
                          : "hover:bg-slate-800"
                      }`}
                      onClick={() => setFacilityType("owned")}
                    >
                      <CardContent className="p-4 text-center">
                        <Building2 className="h-8 w-8 mx-auto mb-2 text-blue-500" />
                        <p className="font-medium">Owned Facility</p>
                        <p className="text-xs text-slate-400">Scope 1 & 2</p>
                      </CardContent>
                    </Card>
                    <Card
                      className={`cursor-pointer transition-all ${
                        facilityType === "contract_manufacturer"
                          ? "ring-2 ring-amber-500 bg-amber-500/10"
                          : "hover:bg-slate-800"
                      }`}
                      onClick={() => setFacilityType("contract_manufacturer")}
                    >
                      <CardContent className="p-4 text-center">
                        <Users className="h-8 w-8 mx-auto mb-2 text-amber-500" />
                        <p className="font-medium">Contract Manufacturer</p>
                        <p className="text-xs text-slate-400">Scope 3</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>

                {facilityType === "contract_manufacturer" && (
                  <Alert className="bg-blue-500/10 border-blue-500/20">
                    <AlertCircle className="h-4 w-4 text-blue-400" />
                    <AlertDescription className="text-blue-200">
                      You will be asked to provide facility energy data and production volumes
                      for ISO 14067 compliant physical allocation.
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            )}

            <div className="flex justify-end gap-3 pt-4">
              <Button type="button" variant="ghost" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleProceedToAllocation}
                disabled={!selectedFacility}
                className="bg-lime-500 hover:bg-lime-600 text-black"
              >
                Continue
                <ChevronRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={dialogStep === "allocation_form"} onOpenChange={(open) => !open && handleCloseDialog()}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {facilityType === "owned" ? "Owned Facility Production" : "Contract Manufacturer Allocation"}
            </DialogTitle>
            <DialogDescription>
              {facilityType === "owned"
                ? `Enter production data for ${selectedFacility?.name}`
                : `Enter facility data for ${selectedFacility?.name} to calculate allocated emissions`}
            </DialogDescription>
          </DialogHeader>

          {selectedFacility && facilityType === "contract_manufacturer" && (
            <ContractManufacturerAllocationForm
              productId={productId}
              facilityId={selectedFacility.id}
              facilityName={selectedFacility.name}
              organizationId={organizationId}
              onSuccess={handleAllocationSuccess}
              onCancel={handleCancelAllocation}
            />
          )}

          {selectedFacility && facilityType === "owned" && (
            <OwnedFacilityProductionForm
              productId={productId}
              facilityId={selectedFacility.id}
              facilityName={selectedFacility.name}
              organizationId={organizationId}
              onSuccess={handleAllocationSuccess}
              onCancel={handleCancelAllocation}
            />
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
