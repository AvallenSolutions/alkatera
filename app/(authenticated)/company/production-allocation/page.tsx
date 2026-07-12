"use client";

import { useState, useEffect } from "react";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/utils";
import { Statement } from "@/components/studio/statement";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { Panel } from "@/components/studio/panel";
import { PillButton } from "@/components/studio/pill-button";
import { ReportingPeriodTimeline } from "@/components/shared/ReportingPeriodTimeline";
import { AllocationSankeyDiagram } from "@/components/shared/AllocationSankeyDiagram";
import { AllocationOnboardingGuide } from "@/components/shared/AllocationOnboardingGuide";

interface MatrixCell {
  assignmentId: string | null;
  facilityId: string;
  productId: number;
  hasAllocations: boolean;
  latestAllocation: {
    allocated_emissions: number;
    reporting_period_start: string;
    reporting_period_end: string;
    status: string;
    attribution_ratio: number;
  } | null;
  assignmentStatus: string | null;
}

interface Facility {
  id: string;
  name: string;
  city: string | null;
  country: string | null;
  operationalControl: string;
}

interface Product {
  id: number;
  name: string;
  sku: string | null;
}

interface AllocationHealth {
  totalFacilities: number;
  facilitiesWithAllocations: number;
  totalProducts: number;
  productsWithAllocations: number;
  unallocatedCapacity: number;
}

type ViewMode = "matrix" | "timeline" | "flow";

const VIEWS: { key: ViewMode; label: string }[] = [
  { key: "matrix", label: "The matrix" },
  { key: "timeline", label: "The timeline" },
  { key: "flow", label: "The flow" },
];

export default function ProductionAllocationPage() {
  const router = useRouter();
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [facilities, setFacilities] = useState<Facility[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [matrixData, setMatrixData] = useState<Map<string, MatrixCell>>(new Map());
  const [allocationHealth, setAllocationHealth] = useState<AllocationHealth | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeView, setActiveView] = useState<ViewMode>("matrix");

  useEffect(() => {
    loadOrganizationAndData();
  }, []);

  const loadOrganizationAndData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      const { data: profileData } = await supabase
        .from("profiles")
        .select("default_organization_id")
        .eq("id", user.id)
        .single();

      const profile = profileData as any;
      if (!profile?.default_organization_id) {
        toast.error("No organisation found");
        return;
      }

      setOrganizationId(profile.default_organization_id);
      await loadAllData(profile.default_organization_id);
    } catch (error) {
      console.error("Error loading data:", error);
      toast.error("Failed to load allocation data");
    } finally {
      setLoading(false);
    }
  };

  const loadAllData = async (orgId: string) => {
    const [facilitiesRes, productsRes, assignmentsRes, capacityRes] = await Promise.all([
      supabase
        .from("facilities")
        .select("id, name, address_city, address_country, operational_control")
        .eq("organization_id", orgId)
        .order("name"),

      supabase
        .from("products")
        .select("id, name, sku")
        .eq("organization_id", orgId)
        .order("name"),

      supabase
        .from("facility_product_assignments")
        .select("id, facility_id, product_id, assignment_status, is_primary_facility")
        .eq("organization_id", orgId)
        .eq("assignment_status", "active"),

      (supabase.rpc as any)("get_facility_unallocated_capacity", { p_organization_id: orgId }),
    ]);

    if (facilitiesRes.error) {
      console.error("Error loading facilities:", facilitiesRes.error);
    }
    if (productsRes.error) {
      console.error("Error loading products:", productsRes.error);
    }
    if (assignmentsRes.error) {
      console.error("Error loading assignments:", assignmentsRes.error);
    }
    if (capacityRes.error) {
      console.error("Error loading capacity data:", capacityRes.error);
    }

    const facilitiesData = (facilitiesRes.data || []) as any[];
    const productsData = productsRes.data || [];
    const assignments = assignmentsRes.data || [];
    const capacityData = capacityRes.data || [];

    setFacilities(facilitiesData.map(f => ({
      id: f.id,
      name: f.name,
      city: f.address_city,
      country: f.address_country,
      operationalControl: f.operational_control,
    })));

    setProducts(productsData);

    // Build allocation lookup from direct queries
    // 1. Get all product PEIs to find production site allocations
    const productIds = productsData.map((p: any) => p.id);
    const ownedAllocByFacilityProduct: Record<string, any> = {};

    if (productIds.length > 0) {
      // Get ALL PEIs for all products to find production site allocations
      const { data: peis } = await supabase
        .from("product_carbon_footprints")
        .select("id, product_id")
        .in("product_id", productIds);

      if (peis && peis.length > 0) {
        const peiIds = peis.map(p => p.id);

        // Build reverse lookup: pei_id -> product_id
        const peiToProduct = new Map<string, number>();
        for (const pei of peis) {
          peiToProduct.set(pei.id, pei.product_id);
        }

        const { data: prodSites } = await supabase
          .from("product_carbon_footprint_production_sites")
          .select("facility_id, product_carbon_footprint_id, allocated_emissions_kg_co2e, reporting_period_start, reporting_period_end, status, attribution_ratio")
          .in("product_carbon_footprint_id", peiIds)
          .order("reporting_period_end", { ascending: false });

        if (prodSites) {
          for (const site of prodSites) {
            const prodId = peiToProduct.get(site.product_carbon_footprint_id);
            if (prodId) {
              const key = `${site.facility_id}-${prodId}`;
              // Keep most recent per facility-product pair
              if (!ownedAllocByFacilityProduct[key]) {
                ownedAllocByFacilityProduct[key] = site;
              }
            }
          }
        }
      }
    }

    // 2. Get contract manufacturer allocations
    const { data: cmAllocs } = await supabase
      .from("contract_manufacturer_allocations")
      .select("facility_id, product_id, allocated_emissions_kg_co2e, reporting_period_start, reporting_period_end, status, attribution_ratio")
      .eq("organization_id", orgId)
      .order("reporting_period_end", { ascending: false });

    const cmByFacilityProduct: Record<string, any> = {};
    if (cmAllocs) {
      for (const alloc of cmAllocs) {
        const key = `${alloc.facility_id}-${alloc.product_id}`;
        if (!cmByFacilityProduct[key]) {
          cmByFacilityProduct[key] = alloc;
        }
      }
    }

    // Build matrix map from assignments + allocations
    const matrix = new Map<string, MatrixCell>();
    for (const assignment of assignments) {
      const key = `${assignment.facility_id}-${assignment.product_id}`;
      const owned = ownedAllocByFacilityProduct[key];
      const cm = cmByFacilityProduct[key];
      const alloc = owned || cm;

      matrix.set(key, {
        assignmentId: assignment.id,
        facilityId: assignment.facility_id,
        productId: assignment.product_id,
        hasAllocations: !!alloc,
        latestAllocation: alloc ? {
          allocated_emissions: alloc.allocated_emissions_kg_co2e || 0,
          reporting_period_start: alloc.reporting_period_start,
          reporting_period_end: alloc.reporting_period_end,
          status: alloc.status || "draft",
          attribution_ratio: alloc.attribution_ratio || 0,
        } : null,
        assignmentStatus: assignment.assignment_status,
      });
    }
    setMatrixData(matrix);

    // Calculate allocation health using fresh data (not stale state)
    const facilitiesWithAllocations = new Set(
      Array.from(matrix.values())
        .filter(cell => cell.hasAllocations)
        .map(cell => cell.facilityId)
    ).size;

    const productsWithAllocations = new Set(
      Array.from(matrix.values())
        .filter(cell => cell.hasAllocations)
        .map(cell => cell.productId)
    ).size;

    const totalUnallocated = capacityData.reduce(
      (sum: number, f: any) => sum + (f.unallocated_emissions_kg_co2e || 0),
      0
    );

    setAllocationHealth({
      totalFacilities: facilitiesData.length,
      facilitiesWithAllocations,
      totalProducts: productsData.length,
      productsWithAllocations,
      unallocatedCapacity: totalUnallocated,
    });
  };

  /** Cell states, drawn in working tones: hairlines and tints, no icons. */
  const getCellClasses = (facilityId: string, productId: number) => {
    const key = `${facilityId}-${productId}`;
    const cell = matrixData.get(key);

    if (!cell || !cell.assignmentId) {
      return "border border-dashed border-studio-hairline bg-transparent";
    }

    if (cell.hasAllocations && cell.latestAllocation) {
      if (cell.latestAllocation.status === "verified") {
        return "border border-studio-good/40 bg-studio-good/10";
      }
      return "border border-studio-attention/40 bg-studio-attention/10";
    }

    return "border border-studio-hairline bg-studio-cream";
  };

  const handleCellClick = (facilityId: string, productId: number) => {
    router.push(`/products/${productId}?tab=facilities&facility=${facilityId}`);
  };

  const handleToggleAssignment = async (facilityId: string, productId: number) => {
    if (!organizationId) return;

    const key = `${facilityId}-${productId}`;
    const cell = matrixData.get(key);

    try {
      if (cell?.assignmentId) {
        const { error } = await supabase
          .from("facility_product_assignments")
          .delete()
          .eq("id", cell.assignmentId);

        if (error) throw error;
        toast.success("Assignment removed");
      } else {
        const { error } = await (supabase
          .from("facility_product_assignments") as any)
          .insert({
            organization_id: organizationId,
            facility_id: facilityId,
            product_id: productId,
            assignment_status: "active",
          });

        if (error) throw error;
        toast.success("Assignment created");
      }

      await loadAllData(organizationId);
    } catch (error: any) {
      console.error("Error toggling assignment:", error);
      toast.error(error.message || "Failed to update assignment");
    }
  };

  const filteredFacilities = facilities.filter(f =>
    f.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filteredProducts = products.filter(p =>
    p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    p.sku?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          Loading
        </span>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-10">
      <Statement
        eyebrow="THE WORKBENCH · PRODUCTION ALLOCATION"
        headline="Who makes what, and where the carbon lands."
      >
        {allocationHealth && (
          <BigNumber
            size="display"
            tone={allocationHealth.unallocatedCapacity > 0 ? "attention" : "ink"}
            value={allocationHealth.unallocatedCapacity.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
            label="KG CO2E UNALLOCATED"
          />
        )}
      </Statement>

      {allocationHealth && (
        <div className="grid grid-cols-3 divide-x divide-studio-hairline border-y border-studio-hairline py-5">
          <BigNumber
            value={`${allocationHealth.facilitiesWithAllocations}/${allocationHealth.totalFacilities}`}
            label="FACILITIES WITH ALLOCATIONS"
          />
          <BigNumber
            className="pl-6"
            value={`${allocationHealth.productsWithAllocations}/${allocationHealth.totalProducts}`}
            label="PRODUCTS WITH PRODUCTION SITES"
          />
          <BigNumber
            className="pl-6"
            value={`${allocationHealth.totalFacilities > 0
              ? Math.round((allocationHealth.facilitiesWithAllocations / allocationHealth.totalFacilities) * 100)
              : 0}%`}
            label="FACILITY COVERAGE"
          />
        </div>
      )}

      {organizationId && <AllocationOnboardingGuide organizationId={organizationId} />}

      {/* View switch: a genuine mode switch, so quiet mono text tabs. */}
      <nav className="flex items-center gap-5 border-b border-studio-hairline">
        {VIEWS.map((view) => (
          <button
            key={view.key}
            type="button"
            onClick={() => setActiveView(view.key)}
            className={cn(
              "relative whitespace-nowrap py-2 font-mono text-[10px] font-bold uppercase tracking-[0.22em] transition-opacity duration-150 ease-studio",
              activeView === view.key ? "opacity-100" : "opacity-60 hover:opacity-100"
            )}
          >
            {view.label}
            {activeView === view.key && (
              <span aria-hidden="true" className="absolute inset-x-0 bottom-0 h-[3px] bg-room-accent" />
            )}
          </button>
        ))}
      </nav>

      {activeView === "matrix" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <Eyebrow>THE MATRIX</Eyebrow>
              <p className="mt-1.5 text-sm text-studio-dim">
                Click a cell to open its allocations. Right-click to toggle the assignment.
              </p>
            </div>
            <div className="flex items-center gap-3">
              <Input
                placeholder="Search facilities or products"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-[260px]"
              />
              <PillButton variant="outline" size="sm" href="/company/facilities">
                Manage facilities
              </PillButton>
            </div>
          </div>

          {facilities.length > 0 && products.length > 0 && (
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
              {[
                { classes: "border border-dashed border-studio-hairline", label: "UNASSIGNED" },
                { classes: "border border-studio-hairline bg-studio-cream", label: "ASSIGNED · NO DATA" },
                { classes: "border border-studio-attention/40 bg-studio-attention/10", label: "PARTIAL · PENDING" },
                { classes: "border border-studio-good/40 bg-studio-good/10", label: "VERIFIED" },
              ].map((item) => (
                <span key={item.label} className="flex items-center gap-2">
                  <span className={cn("h-3 w-3 rounded-[3px]", item.classes)} />
                  <span className="font-mono text-[9.5px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                    {item.label}
                  </span>
                </span>
              ))}
            </div>
          )}

          {facilities.length > 0 && products.length > 0 && filteredFacilities.length > 0 && (
            <Panel flush>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="border-studio-hairline hover:bg-transparent">
                      <TableHead className="sticky left-0 z-10 bg-studio-cream font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                        Facility / Product
                      </TableHead>
                      {filteredProducts.map((product) => (
                        <TableHead key={product.id} className="min-w-[120px] text-center">
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="font-display text-xs font-semibold normal-case tracking-normal text-foreground">
                              {product.name}
                            </span>
                            {product.sku && (
                              <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-studio-dim">
                                {product.sku}
                              </span>
                            )}
                          </div>
                        </TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredFacilities.map((facility) => (
                      <TableRow key={facility.id} className="border-studio-hairline hover:bg-transparent">
                        <TableCell className="sticky left-0 z-10 bg-studio-cream">
                          <div>
                            <p className="font-display text-sm font-semibold text-foreground">{facility.name}</p>
                            {facility.city && (
                              <p className="text-xs text-studio-dim">
                                {facility.city}, {facility.country}
                              </p>
                            )}
                          </div>
                        </TableCell>
                        {filteredProducts.map((product) => {
                          const key = `${facility.id}-${product.id}`;
                          const cell = matrixData.get(key);

                          return (
                            <TableCell key={key} className="p-2 text-center">
                              <div
                                className={cn(
                                  "flex h-14 cursor-pointer items-center justify-center rounded-[6px] transition-colors duration-150 ease-studio hover:border-studio-ink/40",
                                  getCellClasses(facility.id, product.id)
                                )}
                                onClick={() => handleCellClick(facility.id, product.id)}
                                onContextMenu={(e) => {
                                  e.preventDefault();
                                  handleToggleAssignment(facility.id, product.id);
                                }}
                              >
                                {cell?.latestAllocation ? (
                                  <span className="font-display text-sm font-bold tabular-nums text-foreground">
                                    {cell.latestAllocation.allocated_emissions.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
                                    <span className="ml-1 font-mono text-[9px] font-bold uppercase tracking-[0.14em] text-studio-dim">
                                      kg
                                    </span>
                                  </span>
                                ) : null}
                              </div>
                            </TableCell>
                          );
                        })}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          )}

          {facilities.length === 0 && products.length === 0 && (
            <div className="py-16 text-center">
              <p className="mb-4 text-sm text-studio-dim">
                No facilities or products yet. Add a facility to start allocating production.
              </p>
              <PillButton href="/company/facilities">Add a facility</PillButton>
            </div>
          )}

          {facilities.length === 0 && products.length > 0 && (
            <div className="py-16 text-center">
              <p className="mb-4 text-sm text-studio-dim">
                {products.length} product{products.length !== 1 ? "s" : ""}, no facilities. Add a facility to start allocating production.
              </p>
              <PillButton href="/company/facilities">Add a facility</PillButton>
            </div>
          )}

          {facilities.length > 0 && products.length === 0 && (
            <div className="py-16 text-center">
              <p className="mb-4 text-sm text-studio-dim">
                {facilities.length} facilit{facilities.length !== 1 ? "ies" : "y"}, no products. Add a product to start allocating production.
              </p>
              <PillButton href="/products">Add a product</PillButton>
            </div>
          )}

          {facilities.length > 0 && products.length > 0 && filteredFacilities.length === 0 && (
            <div className="py-16 text-center">
              <p className="mb-4 text-sm text-studio-dim">
                No facilities match &quot;{searchTerm}&quot;.
              </p>
              <PillButton variant="ghost" size="sm" onClick={() => setSearchTerm("")}>
                Clear search
              </PillButton>
            </div>
          )}
        </section>
      )}

      {activeView === "timeline" && organizationId && (
        <ReportingPeriodTimeline organizationId={organizationId} viewType="all" />
      )}

      {activeView === "flow" && organizationId && (
        <AllocationSankeyDiagram organizationId={organizationId} />
      )}
    </div>
  );
}
