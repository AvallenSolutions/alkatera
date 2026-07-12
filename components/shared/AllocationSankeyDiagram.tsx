"use client";

import { useState, useEffect } from "react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { Panel } from "@/components/studio/panel";
import { PillButton } from "@/components/studio/pill-button";

interface AllocationSankeyDiagramProps {
  organizationId: string;
}

interface FlowData {
  facilities: { id: string; name: string; totalEmissions: number }[];
  products: { id: number; name: string; allocatedEmissions: number }[];
  flows: { from: string; to: string; value: number }[];
}

export function AllocationSankeyDiagram({ organizationId }: AllocationSankeyDiagramProps) {
  const supabase = getSupabaseBrowserClient();

  const [loading, setLoading] = useState(true);
  const [flowData, setFlowData] = useState<FlowData | null>(null);

  useEffect(() => {
    loadFlowData();
  }, [organizationId]);

  const loadFlowData = async () => {
    try {
      setLoading(true);

      // Load facility emissions
      const { data: facilityEmissions, error: facilityError } = await supabase
        .from("facility_emissions_aggregated")
        .select(`
          facility_id,
          total_co2e,
          facility:facilities!inner(
            id,
            name
          )
        `)
        .eq("organization_id", organizationId)
        .order("total_co2e", { ascending: false })
        .limit(10);

      if (facilityError) throw facilityError;

      // Load product allocations
      const { data: productAllocations, error: productError } = await supabase
        .from("product_carbon_footprint_production_sites")
        .select(`
          facility_id,
          allocated_emissions_kg_co2e,
          product_carbon_footprint:product_carbon_footprints!inner(
            product_id,
            product:products!inner(
              id,
              name
            )
          )
        `)
        .eq("organization_id", organizationId)
        .order("allocated_emissions_kg_co2e", { ascending: false })
        .limit(20);

      if (productError) throw productError;

      if (!facilityEmissions || !productAllocations) {
        setFlowData(null);
        return;
      }

      // Process facilities
      const facilities = facilityEmissions.map((fe: any) => ({
        id: fe.facility_id,
        name: fe.facility?.name || "Unknown facility",
        totalEmissions: fe.total_co2e || 0,
      }));

      // Process products and aggregated allocations
      const productMap = new Map<number, { name: string; allocatedEmissions: number }>();
      const flows: { from: string; to: string; value: number }[] = [];

      productAllocations.forEach((pa: any) => {
        const productId = pa.product_carbon_footprint?.product?.id;
        const productName = pa.product_carbon_footprint?.product?.name || "Unknown product";
        const emissions = pa.allocated_emissions_kg_co2e || 0;

        // Aggregate by product
        if (!productMap.has(productId)) {
          productMap.set(productId, { name: productName, allocatedEmissions: 0 });
        }
        const product = productMap.get(productId)!;
        product.allocatedEmissions += emissions;

        // Create flow
        flows.push({
          from: pa.facility_id,
          to: `product_${productId}`,
          value: emissions,
        });
      });

      const products = Array.from(productMap.entries()).map(([id, data]) => ({
        id,
        name: data.name,
        allocatedEmissions: data.allocatedEmissions,
      }));

      setFlowData({ facilities, products, flows });
    } catch (error) {
      console.error("Error loading flow data:", error);
      setFlowData(null);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <Panel className="flex min-h-[300px] items-center justify-center">
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
          Loading
        </span>
      </Panel>
    );
  }

  if (!flowData || flowData.flows.length === 0) {
    return (
      <section className="space-y-4">
        <div>
          <Eyebrow>THE FLOW</Eyebrow>
          <p className="mt-1.5 text-sm text-studio-dim">
            How facility emissions flow into products.
          </p>
        </div>
        <div className="py-16 text-center">
          <p className="mb-4 text-sm text-studio-dim">
            No allocations yet. Allocate facility emissions to products to see the flow.
          </p>
          <PillButton variant="outline" href="/company/facilities">
            Open the facilities
          </PillButton>
        </div>
      </section>
    );
  }

  const totalFacilityEmissions = flowData.facilities.reduce(
    (sum, f) => sum + f.totalEmissions,
    0
  );
  const totalAllocatedEmissions = flowData.products.reduce(
    (sum, p) => sum + p.allocatedEmissions,
    0
  );
  const allocationPercentage =
    totalFacilityEmissions > 0
      ? (totalAllocatedEmissions / totalFacilityEmissions) * 100
      : 0;

  // Calculate max values for scaling
  const maxFacilityEmissions = Math.max(...flowData.facilities.map((f) => f.totalEmissions));
  const maxProductEmissions = Math.max(...flowData.products.map((p) => p.allocatedEmissions));

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Eyebrow>THE FLOW</Eyebrow>
          <p className="mt-1.5 text-sm text-studio-dim">
            Facility emissions on the left, the products that carry them on the right.
          </p>
        </div>
        <BigNumber
          value={`${allocationPercentage.toFixed(1)}%`}
          label="ALLOCATED"
          tone={allocationPercentage >= 100 ? "good" : "attention"}
        />
      </div>

      <Panel>
        <div className="relative">
          <div className="grid h-full grid-cols-[1fr_2fr_1fr] gap-4">
            {/* Facilities column */}
            <div className="space-y-2">
              <Eyebrow tone="dim" className="mb-4">
                FACILITIES
              </Eyebrow>
              {flowData.facilities.map((facility) => {
                const height = Math.max(40, (facility.totalEmissions / maxFacilityEmissions) * 200);
                return (
                  <div
                    key={facility.id}
                    className="relative"
                    style={{ minHeight: `${height}px` }}
                  >
                    <div
                      className="rounded-[4px] border-l-4 border-room bg-room/10 p-3 transition-colors duration-150 ease-studio hover:bg-room/20"
                      style={{ height: `${height}px` }}
                    >
                      <p className="truncate font-display text-xs font-semibold text-foreground">
                        {facility.name}
                      </p>
                      <p className="mt-1 font-mono text-[10px] tabular-nums text-studio-dim">
                        {facility.totalEmissions.toLocaleString("en-GB", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        kg
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Flow visualisation */}
            <div className="relative">
              <svg
                className="absolute inset-0 h-full w-full"
                style={{ overflow: "visible" }}
              >
                {flowData.flows.map((flow, index) => {
                  const facilityIndex = flowData.facilities.findIndex((f) => f.id === flow.from);
                  const productIndex = flowData.products.findIndex(
                    (p) => `product_${p.id}` === flow.to
                  );

                  if (facilityIndex === -1 || productIndex === -1) return null;

                  const facilityY =
                    facilityIndex * 60 +
                    30 +
                    (flowData.facilities[facilityIndex].totalEmissions / maxFacilityEmissions) *
                      100;
                  const productY =
                    productIndex * 60 +
                    30 +
                    (flowData.products[productIndex].allocatedEmissions / maxProductEmissions) *
                      100;

                  const pathWidth = Math.max(2, (flow.value / maxProductEmissions) * 20);

                  return (
                    <path
                      key={`flow-${index}`}
                      d={`M 0 ${facilityY} C 150 ${facilityY}, 150 ${productY}, 300 ${productY}`}
                      className="stroke-room/25 transition-colors duration-150 ease-studio hover:stroke-room/60"
                      strokeWidth={pathWidth}
                      fill="none"
                    >
                      <title>
                        {flow.value.toLocaleString("en-GB", { maximumFractionDigits: 0 })} kg
                        CO₂e
                      </title>
                    </path>
                  );
                })}
              </svg>
            </div>

            {/* Products column */}
            <div className="space-y-2">
              <Eyebrow tone="dim" className="mb-4">
                PRODUCTS
              </Eyebrow>
              {flowData.products.map((product) => {
                const height = Math.max(
                  40,
                  (product.allocatedEmissions / maxProductEmissions) * 200
                );
                return (
                  <div
                    key={product.id}
                    className="relative"
                    style={{ minHeight: `${height}px` }}
                  >
                    <div
                      className="rounded-[4px] border-r-4 border-studio-ink/60 bg-studio-ink/5 p-3 transition-colors duration-150 ease-studio hover:bg-studio-ink/10"
                      style={{ height: `${height}px` }}
                    >
                      <p className="truncate font-display text-xs font-semibold text-foreground">
                        {product.name}
                      </p>
                      <p className="mt-1 font-mono text-[10px] tabular-nums text-studio-dim">
                        {product.allocatedEmissions.toLocaleString("en-GB", {
                          maximumFractionDigits: 0,
                        })}{" "}
                        kg
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Summary figures */}
          <div className="mt-6 grid grid-cols-3 divide-x divide-studio-hairline border-t border-studio-hairline pt-5">
            <BigNumber
              value={totalFacilityEmissions.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              label="KG CO2E FROM FACILITIES"
            />
            <BigNumber
              className="pl-6"
              value={totalAllocatedEmissions.toLocaleString("en-GB", { maximumFractionDigits: 0 })}
              label="KG CO2E ALLOCATED"
            />
            <BigNumber
              className="pl-6"
              tone={totalFacilityEmissions - totalAllocatedEmissions > 0 ? "attention" : "ink"}
              value={(totalFacilityEmissions - totalAllocatedEmissions).toLocaleString("en-GB", {
                maximumFractionDigits: 0,
              })}
              label="KG CO2E UNALLOCATED"
            />
          </div>
        </div>
      </Panel>
    </section>
  );
}
