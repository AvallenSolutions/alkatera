"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  AlertCircle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Factory,
  MapPin,
  Plus,
  TrendingUp,
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { useRouter } from "next/navigation";
import { DataQualityIndicator } from "@/components/shared/DataQualityIndicator";

interface ProductionFacilitiesCardProps {
  productId: number;
  organizationId: string;
}

interface FacilityAssignment {
  facilityId: string;
  facilityName: string;
  city: string | null;
  country: string | null;
  operationalControl: string;
  primaryFacility: boolean;
  hasAllocations: boolean;
  dataQuality?: string;
  latestAllocation: {
    allocated_emissions: number;
    reporting_period_start: string;
    reporting_period_end: string;
    status: string;
    attribution_ratio: number;
  } | null;
}

export function ProductionFacilitiesCard({
  productId,
  organizationId,
}: ProductionFacilitiesCardProps) {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [facilities, setFacilities] = useState<FacilityAssignment[]>([]);

  useEffect(() => {
    loadFacilities();
  }, [productId]);

  const loadFacilities = async () => {
    try {
      setLoading(true);

      // Get facility assignments for this product
      const { data: assignments, error: assignError } = await supabase
        .from("facility_product_assignments")
        .select(`
          facility_id,
          is_primary_facility,
          facilities!inner (
            id, name, address_city, address_country, operational_control
          )
        `)
        .eq("product_id", productId)
        .eq("organization_id", organizationId)
        .eq("assignment_status", "active");

      if (assignError) throw assignError;
      if (!assignments || assignments.length === 0) {
        setFacilities([]);
        return;
      }

      // Get ALL PEIs for this product to find production site allocations
      const { data: peiData } = await supabase
        .from("product_carbon_footprints")
        .select("id")
        .eq("product_id", productId);

      const peiIds = (peiData || []).map((p: any) => p.id);

      // Get owned facility production site allocations across all PEIs
      let ownedAllocations: Record<string, any> = {};
      if (peiIds.length > 0) {
        const { data: prodSites } = await supabase
          .from("product_carbon_footprint_production_sites")
          .select("facility_id, allocated_emissions_kg_co2e, reporting_period_start, reporting_period_end, status, attribution_ratio")
          .in("product_carbon_footprint_id", peiIds)
          .order("reporting_period_end", { ascending: false });

        if (prodSites) {
          for (const site of prodSites) {
            // Keep the most recent allocation per facility
            if (!ownedAllocations[site.facility_id]) {
              ownedAllocations[site.facility_id] = site;
            }
          }
        }
      }

      // Get contract manufacturer allocations
      const { data: cmAllocations } = await supabase
        .from("contract_manufacturer_allocations")
        .select("facility_id, allocated_emissions_kg_co2e, reporting_period_start, reporting_period_end, status, attribution_ratio")
        .eq("product_id", productId)
        .eq("organization_id", organizationId)
        .order("reporting_period_end", { ascending: false });

      const cmByFacility: Record<string, any> = {};
      if (cmAllocations) {
        for (const alloc of cmAllocations) {
          if (!cmByFacility[alloc.facility_id]) {
            cmByFacility[alloc.facility_id] = alloc;
          }
        }
      }

      // Build facility list
      const result: FacilityAssignment[] = assignments.map((a: any) => {
        const f = a.facilities;
        const owned = ownedAllocations[f.id];
        const cm = cmByFacility[f.id];
        const alloc = owned || cm;

        return {
          facilityId: f.id,
          facilityName: f.name,
          city: f.address_city,
          country: f.address_country,
          operationalControl: f.operational_control,
          primaryFacility: a.is_primary_facility,
          hasAllocations: !!alloc,
          latestAllocation: alloc ? {
            allocated_emissions: alloc.allocated_emissions_kg_co2e || 0,
            reporting_period_start: alloc.reporting_period_start,
            reporting_period_end: alloc.reporting_period_end,
            status: alloc.status || "draft",
            attribution_ratio: alloc.attribution_ratio || 0,
          } : null,
        };
      });

      setFacilities(result);
    } catch (error) {
      console.error("Error loading facilities:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleFacilityClick = (facilityId: string) => {
    router.push(`/company/facilities/${facilityId}?tab=products`);
  };

  const getTotalAllocatedEmissions = () => {
    return facilities.reduce((sum, f) => {
      return sum + (f.latestAllocation?.allocated_emissions || 0);
    }, 0);
  };

  const getCompletionStats = () => {
    const total = facilities.length;
    const withAllocations = facilities.filter((f) => f.hasAllocations).length;
    const verified = facilities.filter(
      (f) => f.latestAllocation?.status === "verified"
    ).length;

    return { total, withAllocations, verified };
  };

  const stats = getCompletionStats();

  if (loading) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6">
          <div className="animate-pulse text-slate-400">Loading facilities...</div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <Factory className="h-5 w-5 text-blue-400" />
              Production Facilities
            </CardTitle>
            <CardDescription>
              Facilities where this product is manufactured
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push("/company/facilities")}
          >
            <Building2 className="mr-2 h-4 w-4" />
            View Facilities
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {facilities.length === 0 ? (
          <div className="text-center py-12">
            <Factory className="h-12 w-12 mx-auto mb-4 text-slate-600" />
            <h4 className="text-lg font-medium text-white mb-2">No Production Facilities</h4>
            <p className="text-sm text-slate-400 mb-4 max-w-md mx-auto">
              Assign facilities to track where this product is manufactured and allocate
              production emissions
            </p>
            <Button
              onClick={() => router.push("/company/facilities")}
              className="bg-lime-500 hover:bg-lime-600 text-black"
            >
              <Plus className="mr-2 h-4 w-4" />
              Assign Facilities
            </Button>
          </div>
        ) : (
          <>
            {/* Summary Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="p-4 bg-slate-800/50 rounded-md border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <Building2 className="h-4 w-4 text-blue-400" />
                  <span className="text-xs text-slate-400">Total Facilities</span>
                </div>
                <p className="text-2xl font-bold text-white">{stats.total}</p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-md border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <CheckCircle2 className="h-4 w-4 text-green-400" />
                  <span className="text-xs text-slate-400">With Allocations</span>
                </div>
                <p className="text-2xl font-bold text-white">
                  {stats.withAllocations}/{stats.total}
                </p>
              </div>

              <div className="p-4 bg-slate-800/50 rounded-md border border-slate-700">
                <div className="flex items-center gap-2 mb-1">
                  <TrendingUp className="h-4 w-4 text-lime-400" />
                  <span className="text-xs text-slate-400">Total Allocated</span>
                </div>
                <p className="text-xl font-bold text-lime-400">
                  {getTotalAllocatedEmissions().toLocaleString(undefined, {
                    maximumFractionDigits: 0,
                  })}
                </p>
                <p className="text-xs text-slate-500">kg CO₂e</p>
              </div>
            </div>

            {/* Facilities List */}
            <div className="space-y-3">
              {facilities.map((facility) => (
                <div
                  key={facility.facilityId}
                  className="p-4 bg-slate-800/50 rounded-md border border-slate-700 hover:border-lime-500/50 transition-all cursor-pointer"
                  onClick={() => handleFacilityClick(facility.facilityId)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-medium text-white">{facility.facilityName}</h4>
                        {facility.primaryFacility && (
                          <Badge className="bg-blue-500/20 text-blue-300 text-xs">
                            Primary
                          </Badge>
                        )}
                        <Badge
                          variant="outline"
                          className={
                            facility.operationalControl === "owned"
                              ? "border-green-500/50 text-green-300"
                              : "border-blue-500/50 text-blue-300"
                          }
                        >
                          {facility.operationalControl === "owned" ? "Owned" : "3rd Party"}
                        </Badge>
                        {facility.dataQuality && (
                          <DataQualityIndicator
                            quality={facility.dataQuality}
                            size="sm"
                            showLabel={false}
                          />
                        )}
                      </div>
                      {facility.city && (
                        <div className="flex items-center gap-1 text-sm text-slate-400">
                          <MapPin className="h-3 w-3" />
                          <span>
                            {facility.city}, {facility.country}
                          </span>
                        </div>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-slate-400 hover:text-lime-400"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleFacilityClick(facility.facilityId);
                      }}
                    >
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-slate-700">
                    {facility.hasAllocations && facility.latestAllocation ? (
                      <>
                        <div className="flex items-center gap-2">
                          <CheckCircle2 className="h-4 w-4 text-green-400" />
                          <div>
                            <p className="text-sm font-medium text-green-400">
                              {facility.latestAllocation.allocated_emissions.toLocaleString(
                                undefined,
                                { maximumFractionDigits: 0 }
                              )}{" "}
                              kg CO₂e
                            </p>
                            <p className="text-xs text-slate-400">
                              {new Date(
                                facility.latestAllocation.reporting_period_start
                              ).toLocaleDateString()}{" "}
                              -{" "}
                              {new Date(
                                facility.latestAllocation.reporting_period_end
                              ).toLocaleDateString()}
                            </p>
                          </div>
                        </div>
                        <Badge
                          className={
                            facility.latestAllocation.status === "verified"
                              ? "bg-green-500/20 text-green-300"
                              : "bg-amber-500/20 text-amber-300"
                          }
                        >
                          {facility.latestAllocation.status}
                        </Badge>
                      </>
                    ) : (
                      <>
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-4 w-4 text-amber-400" />
                          <p className="text-sm text-amber-400">No allocation data</p>
                        </div>
                        <Button
                          variant="outline"
                          size="sm"
                          className="border-lime-500/50 text-lime-400"
                          onClick={(e) => {
                            e.stopPropagation();
                            router.push(
                              `/products/${productId}?tab=facilities&facility=${facility.facilityId}`
                            );
                          }}
                        >
                          Add Allocation
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Quick Action */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                className="flex-1"
                onClick={() => router.push("/company/facilities")}
              >
                Manage Facility Assignments
              </Button>
              {stats.withAllocations < stats.total && (
                <Button
                  className="flex-1 bg-lime-500 hover:bg-lime-600 text-black"
                  onClick={() => router.push(`/products/${productId}?tab=facilities`)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Add Allocations
                </Button>
              )}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
