"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Droplets, Zap, Wind, MapPin, AlertTriangle, FileText, CheckCircle2, ArrowRight, Map, Factory, Layers } from "lucide-react";
import type { Product, ProductIngredient, ProductPackaging, ProductLCA } from "@/hooks/data/useProductData";
import { useProductFacility } from "@/hooks/data/useProductFacility";
import dynamic from "next/dynamic";

const SupplyChainMap = dynamic(() => import("./SupplyChainMap").then(mod => ({ default: mod.SupplyChainMap })), {
  ssr: false,
  loading: () => (
    <div className="w-full h-[450px] bg-muted/20 rounded-lg flex items-center justify-center">
      <p className="text-sm text-muted-foreground">Loading map...</p>
    </div>
  ),
});
import { ProductHeroImpact, ContainerType } from "./ProductHeroImpact";
import { QuickImpactBar, ImpactCategory, ImpactSummaryCard } from "./QuickImpactBar";
import { ImpactAccordion, ImpactAccordionGroup, SimpleBreakdownTable } from "./ImpactAccordion";
import { MultipackContentsCard } from "./MultipackContentsCard";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";
import { useState } from "react";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';

interface OverviewTabProps {
  product: Product;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  lcaReports: ProductLCA[];
  isHealthy: boolean;
}

export function OverviewTab({ product, ingredients, packaging, lcaReports, isHealthy }: OverviewTabProps) {
  const latestLCA = lcaReports[0];
  const hasLCAData = latestLCA && latestLCA.aggregated_impacts;
  // Use the product's assigned facility, not just any organization facility
  const { facility } = useProductFacility(product.id, product.organization_id);
  const [showSupplyChain, setShowSupplyChain] = useState(false);
  const [showDataCompleteness, setShowDataCompleteness] = useState(false);

  const ingredientWeight = ingredients.reduce((sum, ing) => {
    const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
    return sum + weight;
  }, 0);

  const packagingWeight = packaging.reduce((sum, pkg) => sum + pkg.quantity, 0);

  const calculateMaterialBreakdown = () => {
    if (!hasLCAData) {
      return null;
    }

    const stages = latestLCA.aggregated_impacts?.breakdown?.by_lifecycle_stage;

    if (!stages) {
      return null;
    }

    const rawMaterialsTotal = stages.raw_materials || 0;
    const packagingTotal = stages.packaging ?? stages.packaging_stage ?? 0;
    const processingTotal = stages.processing || 0;
    const transportationTotal = stages.distribution || 0;
    const endOfLifeTotal = stages.end_of_life || 0;
    const usePhaseTotal = stages.use_phase || 0;

    const total = rawMaterialsTotal + packagingTotal + processingTotal + transportationTotal + endOfLifeTotal + usePhaseTotal;
    if (total === 0) return null;

    return {
      rawMaterials: rawMaterialsTotal,
      packaging: packagingTotal,
      processing: processingTotal,
      transport: transportationTotal,
      endOfLife: endOfLifeTotal,
      usePhase: usePhaseTotal,
    };
  };

  const breakdown = calculateMaterialBreakdown();
  const totalCarbon = hasLCAData ? (latestLCA.aggregated_impacts?.climate_change_gwp100 ?? 0) : 0;
  const waterConsumption = hasLCAData ? (latestLCA.aggregated_impacts?.water_consumption ?? 0) : 0;
  const waterScarcity = hasLCAData ? (latestLCA.aggregated_impacts?.water_scarcity_aware ?? 0) : 0;
  const landUse = hasLCAData ? (latestLCA.aggregated_impacts?.land_use ?? 0) : 0;
  const circularityRate = hasLCAData ? (latestLCA.aggregated_impacts?.circularity_percentage ?? 0) : 0;

  const quickImpacts: Array<{
    category: ImpactCategory;
    value: number;
    unit: string;
    label: string;
    tooltip?: string;
  }> = [
    {
      category: 'climate',
      value: totalCarbon,
      unit: 'kg CO₂e',
      label: 'Carbon',
      tooltip: 'Total greenhouse gas emissions (GWP100)',
    },
    {
      category: 'water',
      value: waterScarcity,
      unit: 'm³ eq',
      label: 'Water',
      tooltip: 'Water scarcity footprint',
    },
    {
      category: 'circularity',
      value: circularityRate,
      unit: '%',
      label: 'Circularity',
      tooltip: 'Material circularity score',
    },
    {
      category: 'nature',
      value: landUse,
      unit: 'm²a',
      label: 'Land Use',
      tooltip: 'Agricultural land occupation',
    },
  ];

  if (!hasLCAData || !breakdown) {
    return (
      <div className="space-y-6">
        {/* Multipack Contents Card - shown at the top for multipacks */}
        {product.is_multipack && (
          <MultipackContentsCard
            productId={String(product.id)}
            productName={product.name}
          />
        )}

        <Card className="border overflow-hidden">
          <CardContent className="p-8">
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative w-48 h-72 opacity-30">
                <svg viewBox="0 0 200 400" className="w-full h-full">
                  <path
                    d="M 85 10 L 115 10 L 115 60 Q 120 63, 130 68 Q 145 72, 160 75 L 160 370 L 40 370 L 40 75 Q 55 72, 70 68 Q 80 63, 85 60 Z"
                    className="fill-muted-foreground/10 stroke-muted-foreground/20"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-foreground mb-2">No LCA Data Available</h3>
                  <p className="text-sm text-muted-foreground">
                    Complete a Life Cycle Assessment to visualise the environmental impact of this product
                  </p>
                </div>
                <Link href={`/products/${product.id}/calculate-lca`}>
                  <Button className="bg-lime-500 hover:bg-lime-600 text-slate-900">
                    Run LCA
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="border">
          <CardHeader>
            <CardTitle className="text-foreground flex items-center gap-2">
              <CheckCircle2 className="h-5 w-5 text-lime-400" />
              Data Completeness
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${ingredients.length > 0 ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-sm text-muted-foreground">Ingredients</span>
              </div>
              <span className="text-sm font-medium text-foreground">{ingredients.length} added ({ingredientWeight.toFixed(2)} kg)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full ${packaging.length > 0 ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                <span className="text-sm text-muted-foreground">Packaging</span>
              </div>
              <span className="text-sm font-medium text-foreground">{packaging.length} added ({packagingWeight.toFixed(1)} g)</span>
            </div>
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
              <div className="flex items-center gap-2">
                <div className={`h-2 w-2 rounded-full bg-muted-foreground/40`} />
                <span className="text-sm text-muted-foreground">LCA Calculations</span>
              </div>
              <span className="text-sm font-medium text-foreground">Not started</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Hero Impact Section with Container Switcher */}
      <ProductHeroImpact
        productName={product.name}
        productImage={product.product_image_url || undefined}
        sku={product.sku || undefined}
        category={product.product_category || undefined}
        totalCarbonFootprint={totalCarbon}
        functionalUnit={product.functional_unit || 'unit'}
        carbonBreakdown={breakdown}
        containerType="bottle"
        lcaReportUrl={`/products/${product.id}/compliance-wizard`}
      />

      {/* Multipack Contents Card - only shown for multipacks */}
      {product.is_multipack && (
        <MultipackContentsCard
          productId={String(product.id)}
          productName={product.name}
        />
      )}

      {/* Quick Impact Summary Bar */}
      <div className="border rounded-xl p-4">
        <QuickImpactBar
          impacts={quickImpacts}
          compact={false}
        />
      </div>

      {/* Detailed Impact Accordions */}
      <ImpactAccordionGroup allowMultiple defaultExpanded={['climate']}>
        <ImpactAccordion
          id="climate"
          category="climate"
          title="Climate Impact"
          summary="Total GHG emissions by lifecycle stage"
          value={totalCarbon}
          unit="kg CO₂e"
          detailsLink={`/products/${product.id}/compliance-wizard`}
        >
          <SimpleBreakdownTable
            data={[
              { name: 'Raw Materials', value: breakdown.rawMaterials, unit: 'kg CO₂e' },
              { name: 'Processing', value: breakdown.processing, unit: 'kg CO₂e' },
              { name: 'Packaging', value: breakdown.packaging, unit: 'kg CO₂e' },
              { name: 'Transport', value: breakdown.transport, unit: 'kg CO₂e' },
              ...(breakdown.endOfLife ? [{ name: 'End of Life', value: breakdown.endOfLife, unit: 'kg CO₂e' }] : []),
              ...(breakdown.usePhase ? [{ name: 'Use Phase', value: breakdown.usePhase, unit: 'kg CO₂e' }] : []),
            ]}
            showPercentages
          />
        </ImpactAccordion>

        <ImpactAccordion
          id="water"
          category="water"
          title="Water Impact"
          summary="Water consumption and scarcity footprint"
          value={waterScarcity}
          unit="m³ world eq"
          detailsLink={`/products/${product.id}/compliance-wizard`}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-muted-foreground uppercase mb-1">Consumption</p>
              <p className="text-2xl font-bold text-foreground">{waterConsumption.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground">m³</p>
            </div>
            <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/20">
              <p className="text-xs text-muted-foreground uppercase mb-1">Scarcity Impact</p>
              <p className="text-2xl font-bold text-foreground">{waterScarcity.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground">m³ world eq</p>
            </div>
          </div>
          {latestLCA.aggregated_impacts?.water_risk_level && (
            <div className="mt-4">
              <Badge className={`${
                latestLCA.aggregated_impacts.water_risk_level === 'low' ? 'bg-green-500/20 text-green-400' :
                latestLCA.aggregated_impacts.water_risk_level === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                'bg-red-500/20 text-red-400'
              }`}>
                {latestLCA.aggregated_impacts.water_risk_level === 'low' ? 'Low Risk' :
                 latestLCA.aggregated_impacts.water_risk_level === 'medium' ? 'Medium Risk' : 'High Risk'}
              </Badge>
            </div>
          )}
        </ImpactAccordion>

        <ImpactAccordion
          id="circularity"
          category="circularity"
          title="Circularity"
          summary="Material circularity and resource efficiency"
          value={circularityRate}
          unit="%"
          detailsLink={`/products/${product.id}/compliance-wizard`}
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-4 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-lime-500 transition-all"
                    style={{ width: `${circularityRate}%` }}
                  />
                </div>
              </div>
              <span className="text-2xl font-bold text-foreground">{circularityRate}%</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-muted-foreground uppercase mb-1">Fossil Resources</p>
                <p className="text-xl font-bold text-foreground">
                  {latestLCA.aggregated_impacts?.fossil_resource_scarcity?.toFixed(3) || '0'}
                </p>
                <p className="text-sm text-muted-foreground">kg oil eq</p>
              </div>
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <p className="text-xs text-muted-foreground uppercase mb-1">Rating</p>
                <Badge className="mt-1 bg-amber-500/20 text-amber-400 border-amber-500/30">
                  {circularityRate >= 75 ? 'EXCELLENT' :
                   circularityRate >= 50 ? 'GOOD' :
                   circularityRate >= 25 ? 'FAIR' : 'POOR'}
                </Badge>
              </div>
            </div>
          </div>
        </ImpactAccordion>

        <ImpactAccordion
          id="nature"
          category="nature"
          title="Nature Impact"
          summary="Land use and biodiversity impact"
          value={landUse}
          unit="m²a"
          detailsLink={`/products/${product.id}/compliance-wizard`}
        >
          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-muted-foreground uppercase mb-1">Land Use</p>
              <p className="text-2xl font-bold text-foreground">{landUse.toFixed(3)}</p>
              <p className="text-sm text-muted-foreground">m²a crop eq</p>
            </div>
            <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/20">
              <p className="text-xs text-muted-foreground uppercase mb-1">Ecotoxicity</p>
              <p className="text-2xl font-bold text-foreground">
                {latestLCA.aggregated_impacts?.terrestrial_ecotoxicity?.toFixed(3) || '0.000'}
              </p>
              <p className="text-sm text-muted-foreground">kg DCB eq</p>
            </div>
          </div>
          <div className="flex gap-2 mt-4">
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">ReCiPe 2016</Badge>
            <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">Multi-capital</Badge>
          </div>
        </ImpactAccordion>
      </ImpactAccordionGroup>

      {/* Collapsible Supply Chain Map */}
      <Collapsible open={showSupplyChain} onOpenChange={setShowSupplyChain}>
        <Card className="border">
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <Map className="h-5 w-5 text-cyan-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">Supply Chain Network</h3>
                  <p className="text-sm text-muted-foreground">
                    {1 + ingredients.filter(i => i.origin_lat && i.origin_lng).length + packaging.filter(p => p.origin_lat && p.origin_lng).length} supply chain origins
                  </p>
                </div>
              </div>
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                {showSupplyChain ? 'Hide' : 'Show'} Map
              </Badge>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <SupplyChainMap
                facility={facility}
                ingredients={ingredients}
                packaging={packaging}
                productId={product.id}
                productName={product.name}
              />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Carbon Footprint Reports */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Carbon Footprint Reports */}
        <Card className="border">
          <CardHeader>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
                  <FileText className="h-5 w-5 text-cyan-400" />
                </div>
                <div>
                  <CardTitle className="text-foreground">LCA Reports</CardTitle>
                  <CardDescription className="text-muted-foreground">Calculation history</CardDescription>
                </div>
              </div>
              {lcaReports.length > 0 && (
                <Link href="/reports/lcas">
                  <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300">
                    View All
                  </Button>
                </Link>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {lcaReports.slice(0, 3).map((lca) => (
              <Link key={lca.id} href={`/products/${product.id}/compliance-wizard`}>
                <div className="p-3 rounded-lg bg-muted/50 border hover:bg-accent transition-all cursor-pointer">
                  <div className="flex items-center justify-between mb-2">
                    <Badge className={`${lca.status === 'completed' ? 'bg-green-500/20 text-green-400' : 'bg-yellow-500/20 text-yellow-400'}`}>
                      {lca.status}
                    </Badge>
                    <span className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(lca.created_at), { addSuffix: true })}
                    </span>
                  </div>
                  {lca.aggregated_impacts?.climate_change_gwp100 && (
                    <div className="flex items-center justify-between">
                      <span className="text-sm text-muted-foreground">Total Impact</span>
                      <span className="text-sm font-bold text-foreground">
                        {lca.aggregated_impacts.climate_change_gwp100.toFixed(3)} kg CO₂e
                      </span>
                    </div>
                  )}
                </div>
              </Link>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Collapsible Data Completeness */}
      <Collapsible open={showDataCompleteness} onOpenChange={setShowDataCompleteness}>
        <Card className="border">
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-lime-500/20 flex items-center justify-center">
                  <CheckCircle2 className="h-5 w-5 text-lime-400" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold text-foreground">Data Completeness</h3>
                  <p className="text-sm text-muted-foreground">
                    {isHealthy ? '100%' : ingredients.length > 0 || packaging.length > 0 ? '66%' : '33%'} complete
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <div className="w-24 h-2 bg-muted rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-lime-500 to-green-500 transition-all duration-500"
                    style={{ width: `${isHealthy ? 100 : ingredients.length > 0 || packaging.length > 0 ? 66 : 33}%` }}
                  />
                </div>
                <Badge variant="secondary">
                  {showDataCompleteness ? 'Hide' : 'Details'}
                </Badge>
              </div>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0 space-y-3">
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${ingredients.length > 0 ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <span className="text-sm text-muted-foreground">Ingredients</span>
                </div>
                <span className="text-sm font-medium text-foreground">{ingredients.length} ({ingredientWeight.toFixed(2)} kg)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${packaging.length > 0 ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <span className="text-sm text-muted-foreground">Packaging</span>
                </div>
                <span className="text-sm font-medium text-foreground">{packaging.length} ({packagingWeight.toFixed(1)} g)</span>
              </div>
              <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-2">
                  <div className={`h-2 w-2 rounded-full ${lcaReports.length > 0 ? 'bg-green-500' : 'bg-muted-foreground/40'}`} />
                  <span className="text-sm text-muted-foreground">Carbon Footprint Reports</span>
                </div>
                <span className="text-sm font-medium text-foreground">{lcaReports.length}</span>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
