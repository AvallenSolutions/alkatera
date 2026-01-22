"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Factory, Loader2, Package, TrendingDown } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

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
        name: fe.facility?.name || "Unknown Facility",
        totalEmissions: fe.total_co2e || 0,
      }));

      // Process products and aggregated allocations
      const productMap = new Map<number, { name: string; allocatedEmissions: number }>();
      const flows: { from: string; to: string; value: number }[] = [];

      productAllocations.forEach((pa: any) => {
        const productId = pa.product_lca?.product?.id;
        const productName = pa.product_lca?.product?.name || "Unknown Product";
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
      <Card className="bg-slate-900/50 border-slate-800">
        <CardContent className="p-6 flex items-center justify-center min-h-[400px]">
          <Loader2 className="h-8 w-8 animate-spin text-lime-400" />
        </CardContent>
      </Card>
    );
  }

  if (!flowData || flowData.flows.length === 0) {
    return (
      <Card className="bg-slate-900/50 border-slate-800">
        <CardHeader>
          <CardTitle className="text-white flex items-center gap-2">
            <TrendingDown className="h-5 w-5 text-lime-400" />
            Allocation Flow
          </CardTitle>
          <CardDescription>
            Visualize emission allocations from facilities to products
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Alert className="bg-blue-500/10 border-blue-500/20">
            <AlertDescription className="text-blue-200">
              No allocation data available yet. Create facility-product allocations to see the flow diagram.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
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
    <Card className="bg-slate-900/50 border-slate-800">
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="text-white flex items-center gap-2">
              <TrendingDown className="h-5 w-5 text-lime-400" />
              Allocation Flow Diagram
            </CardTitle>
            <CardDescription>
              Emission allocations from facilities (left) to products (right)
            </CardDescription>
          </div>
          <Badge className="bg-lime-500/20 text-lime-300 border-lime-500/50">
            {allocationPercentage.toFixed(1)}% Allocated
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="relative min-h-[600px]">
          <div className="grid grid-cols-[1fr_2fr_1fr] gap-4 h-full">
            {/* Facilities Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Factory className="h-4 w-4 text-blue-400" />
                <span className="text-sm font-medium text-slate-300">Facilities</span>
              </div>
              {flowData.facilities.map((facility) => {
                const height = Math.max(40, (facility.totalEmissions / maxFacilityEmissions) * 200);
                return (
                  <div
                    key={facility.id}
                    className="relative"
                    style={{ minHeight: `${height}px` }}
                  >
                    <div
                      className="p-3 bg-blue-500/20 border-l-4 border-blue-500 rounded hover:bg-blue-500/30 transition-all"
                      style={{ height: `${height}px` }}
                    >
                      <p className="text-xs font-medium text-white truncate">{facility.name}</p>
                      <p className="text-xs text-blue-300 mt-1">
                        {facility.totalEmissions.toLocaleString(undefined, {
                          maximumFractionDigits: 0,
                        })}{" "}
                        kg
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Flow Visualization */}
            <div className="relative">
              <svg
                className="absolute inset-0 w-full h-full"
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
                      stroke="rgba(163, 230, 53, 0.3)"
                      strokeWidth={pathWidth}
                      fill="none"
                      className="hover:stroke-lime-400 transition-all"
                    >
                      <title>
                        {flow.value.toLocaleString(undefined, { maximumFractionDigits: 0 })} kg
                        CO₂e
                      </title>
                    </path>
                  );
                })}
              </svg>
            </div>

            {/* Products Column */}
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-4">
                <Package className="h-4 w-4 text-lime-400" />
                <span className="text-sm font-medium text-slate-300">Products</span>
              </div>
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
                      className="p-3 bg-lime-500/20 border-r-4 border-lime-500 rounded hover:bg-lime-500/30 transition-all"
                      style={{ height: `${height}px` }}
                    >
                      <p className="text-xs font-medium text-white truncate">{product.name}</p>
                      <p className="text-xs text-lime-300 mt-1">
                        {product.allocatedEmissions.toLocaleString(undefined, {
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

          {/* Summary Stats */}
          <div className="mt-6 grid grid-cols-3 gap-4 pt-6 border-t border-slate-700">
            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase mb-1">Total Facility Emissions</p>
              <p className="text-xl font-bold text-blue-400">
                {totalFacilityEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">kg CO₂e</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase mb-1">Allocated to Products</p>
              <p className="text-xl font-bold text-lime-400">
                {totalAllocatedEmissions.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </p>
              <p className="text-xs text-slate-500">kg CO₂e</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-slate-400 uppercase mb-1">Unallocated</p>
              <p className="text-xl font-bold text-amber-400">
                {(totalFacilityEmissions - totalAllocatedEmissions).toLocaleString(undefined, {
                  maximumFractionDigits: 0,
                })}
              </p>
              <p className="text-xs text-slate-500">kg CO₂e</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
