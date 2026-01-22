"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowUpFromLine, CheckCircle2, Info, Loader2, Package } from "lucide-react";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";

interface TransportBreakdown {
  materialName: string;
  transportMode: string;
  distanceKm: number;
  weightKg: number;
  emissionsKgCO2e: number;
}

interface UpstreamTransportCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries?: any[]; // Kept for API compatibility but not used
  onUpdate?: () => void;
}

/**
 * GHG Protocol Scope 3 Category 4: Upstream Transportation & Distribution
 *
 * This card displays AUTO-CALCULATED emissions from product material data.
 * Users enter transport info (origin, mode, distance) when adding materials
 * to their product LCAs - this card shows the aggregated result.
 *
 * Read-only display to:
 * 1. Build trust by showing calculations
 * 2. Avoid double counting
 * 3. Direct users to product data for updates
 */
export function UpstreamTransportCard({
  reportId,
  organizationId,
  year,
}: UpstreamTransportCardProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [totalEmissions, setTotalEmissions] = useState(0);
  const [breakdown, setBreakdown] = useState<TransportBreakdown[]>([]);
  const [materialCount, setMaterialCount] = useState(0);

  useEffect(() => {
    fetchTransportData();
  }, [organizationId, year]);

  const fetchTransportData = async () => {
    if (!organizationId) return;

    setIsLoading(true);
    try {
      const supabase = getSupabaseBrowserClient();

      // Fetch material transport data from product LCAs
      const { data: materialsWithTransport, error } = await supabase
        .from('product_carbon_footprint_materials')
        .select(`
          id,
          material_name,
          quantity,
          unit,
          transport_mode,
          distance_km,
          product_lcas!inner(
            organization_id,
            status
          )
        `)
        .eq('product_lcas.organization_id', organizationId)
        .eq('product_lcas.status', 'completed')
        .not('transport_mode', 'is', null)
        .not('distance_km', 'is', null);

      if (error) {
        console.error('Error fetching transport data:', error);
        return;
      }

      // DEFRA 2024 emission factors (kgCO2e per tonne-km)
      const transportFactors: Record<string, number> = {
        road: 0.10516,
        road_hgv: 0.10516,
        rail: 0.02768,
        rail_freight: 0.02768,
        sea: 0.01601,
        sea_container: 0.01601,
        air: 0.98495,
        air_freight: 0.98495,
        multimodal: 0.045,
      };

      const items: TransportBreakdown[] = [];
      let total = 0;

      (materialsWithTransport || []).forEach((material: any) => {
        const mode = material.transport_mode?.toLowerCase() || 'road';
        const distanceKm = Number(material.distance_km || 0);
        if (distanceKm <= 0) return;

        // Convert to kg (assume kg if not specified)
        let weightKg = Number(material.quantity || 0);
        if (material.unit?.toLowerCase() === 'tonnes' || material.unit?.toLowerCase() === 't') {
          weightKg = Number(material.quantity || 0) * 1000;
        }

        const factor = transportFactors[mode] || 0.10516;
        const weightTonnes = weightKg / 1000;
        const emissions = weightTonnes * distanceKm * factor;

        items.push({
          materialName: material.material_name || 'Unknown Material',
          transportMode: mode,
          distanceKm,
          weightKg,
          emissionsKgCO2e: emissions,
        });

        total += emissions;
      });

      setBreakdown(items);
      setTotalEmissions(total);
      setMaterialCount(items.length);
    } catch (err) {
      console.error('Error in fetchTransportData:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} tCO₂e`;
    }
    return `${value.toFixed(1)} kgCO₂e`;
  };

  const formatTransportMode = (mode: string) => {
    const mapping: Record<string, string> = {
      road: "Road",
      road_hgv: "Road (HGV)",
      rail: "Rail",
      rail_freight: "Rail",
      sea: "Sea",
      sea_container: "Sea",
      air: "Air",
      air_freight: "Air",
      multimodal: "Multimodal",
    };
    return mapping[mode] || mode;
  };

  const hasData = materialCount > 0;

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-violet-50 dark:bg-violet-950 rounded-full -mr-16 -mt-16 opacity-50" />

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-violet-100 dark:bg-violet-900 flex items-center justify-center">
              <ArrowUpFromLine className="h-5 w-5 text-violet-600 dark:text-violet-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Upstream Transport</CardTitle>
              <CardDescription>Category 4: Inbound logistics</CardDescription>
            </div>
          </div>
          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-100 text-xs">
            <CheckCircle2 className="h-3 w-3 mr-1" />
            Auto-calculated
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : hasData ? (
          <>
            <div className="text-center py-4 border-b">
              <div className="text-3xl font-bold text-slate-900 dark:text-slate-100">
                {formatEmissions(totalEmissions)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                From {materialCount} material {materialCount === 1 ? 'shipment' : 'shipments'}
              </div>
            </div>

            <div className="space-y-2 max-h-48 overflow-y-auto">
              {breakdown.slice(0, 5).map((item, index) => (
                <div
                  key={index}
                  className="flex items-center justify-between p-3 rounded-lg bg-slate-50 dark:bg-slate-900"
                >
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm truncate">{item.materialName}</div>
                    <div className="text-xs text-muted-foreground">
                      {formatTransportMode(item.transportMode)} • {item.distanceKm.toLocaleString()}km
                    </div>
                  </div>
                  <div className="text-sm font-medium text-right">
                    {formatEmissions(item.emissionsKgCO2e)}
                  </div>
                </div>
              ))}
              {breakdown.length > 5 && (
                <div className="text-xs text-muted-foreground text-center py-2">
                  +{breakdown.length - 5} more materials
                </div>
              )}
            </div>

            <Alert className="bg-violet-50 dark:bg-violet-950/30 border-violet-200 dark:border-violet-800">
              <Package className="h-4 w-4 text-violet-600" />
              <AlertDescription className="text-xs text-violet-800 dark:text-violet-200">
                Calculated from material origins in your Product Carbon Footprints. To update, edit transport details on your products.
              </AlertDescription>
            </Alert>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-sm text-muted-foreground mb-4">No transport data yet</div>
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Add material origins and transport modes to your Product Carbon Footprints to automatically calculate upstream transport emissions.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
