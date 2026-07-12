"use client";

import { StateChip } from "@/components/studio/state-chip";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import type { Product, ProductIngredient, ProductPackaging, ProductLCA } from "@/hooks/data/useProductData";
import { useProductFacility } from "@/hooks/data/useProductFacility";
import dynamic from "next/dynamic";

const SupplyChainMap = dynamic(() => import("./SupplyChainMap").then(mod => ({ default: mod.SupplyChainMap })), {
  ssr: false,
  loading: () => (
    <div className="flex h-[450px] w-full items-center justify-center rounded-[6px] bg-studio-hairline/20">
      <p className="text-sm text-studio-dim">Loading map...</p>
    </div>
  ),
});
import { ProductHeroImpact } from "./ProductHeroImpact";
import { QuickImpactBar, ImpactCategory } from "./QuickImpactBar";
import { ImpactAccordion, ImpactAccordionGroup, SimpleBreakdownTable } from "./ImpactAccordion";
import { MultipackContentsCard } from "./MultipackContentsCard";
import { ProductProductionSparkline } from "./ProductProductionSparkline";
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
  onEditMultipack?: () => void;
}

/** A quiet row: subject, a working-tone chip, a figure standing right. */
function CompletenessRow({
  label,
  detail,
  done,
}: {
  label: string;
  detail: string;
  done: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-2.5">
      <div className="flex items-center gap-3">
        <span className="text-sm text-foreground">{label}</span>
        <StateChip tone={done ? "good" : "quiet"}>{done ? "Done" : "To do"}</StateChip>
      </div>
      <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">{detail}</span>
    </div>
  );
}

export function OverviewTab({ product, ingredients, packaging, lcaReports, isHealthy, onEditMultipack }: OverviewTabProps) {
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
    const viticultureTotal = (stages as any).viticulture || 0;
    const purchasedIngredients = rawMaterialsTotal - viticultureTotal;
    const packagingTotal = stages.packaging ?? (stages as any).packaging_stage ?? 0;
    const processingTotal = stages.processing || 0;
    const transportationTotal = stages.distribution || 0;
    const endOfLifeTotal = stages.end_of_life || 0;
    const usePhaseTotal = stages.use_phase || 0;

    // FLAG removals (reported separately, never netted)
    const flagRemovals = latestLCA.aggregated_impacts?.breakdown?.flag_removals;
    const soilCarbonRemovals = (flagRemovals as any)?.soil_carbon_co2e || 0;

    const total = rawMaterialsTotal + packagingTotal + processingTotal + transportationTotal + endOfLifeTotal + usePhaseTotal;
    if (total === 0) return null;

    return {
      rawMaterials: rawMaterialsTotal,
      viticulture: viticultureTotal,
      purchasedIngredients,
      hasViticulture: viticultureTotal > 0,
      packaging: packagingTotal,
      processing: processingTotal,
      transport: transportationTotal,
      endOfLife: endOfLifeTotal,
      usePhase: usePhaseTotal,
      soilCarbonRemovals,
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
      <div className="space-y-8">
        {/* Multipack Contents Card - shown at the top for multipacks */}
        {product.is_multipack && (
          <MultipackContentsCard
            productId={String(product.id)}
            productName={product.name}
          />
        )}

        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-1">Impact</Eyebrow>
          <p className="max-w-xl text-sm text-muted-foreground">
            No life cycle assessment yet. Once you create one, this product&apos;s footprint,
            water, circularity and nature figures appear here.
          </p>
        </section>

        <section className="border-t border-border pt-5">
          <Eyebrow className="mb-4">Data completeness</Eyebrow>
          <div className="divide-y divide-border">
            <CompletenessRow
              label="Ingredients"
              detail={`${ingredients.length} · ${ingredientWeight.toFixed(2)} kg`}
              done={ingredients.length > 0}
            />
            <CompletenessRow
              label="Packaging"
              detail={`${packaging.length} · ${packagingWeight.toFixed(1)} g`}
              done={packaging.length > 0}
            />
            <CompletenessRow label="LCA" detail="Not started" done={false} />
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="space-y-10">
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
          onEdit={onEditMultipack}
        />
      )}

      {/* Brewery production sparkline (only shows if linked to Breww) */}
      <ProductProductionSparkline
        organizationId={product.organization_id}
        productId={product.id}
      />

      {/* Quick Impact Summary Bar */}
      <section className="border-t border-border pt-5">
        <Eyebrow className="mb-4">Impact at a glance</Eyebrow>
        <QuickImpactBar impacts={quickImpacts} compact={false} />
      </section>

      {/* Detailed Impact Accordions */}
      <ImpactAccordionGroup allowMultiple defaultExpanded={['climate']}>
        <ImpactAccordion
          id="climate"
          category="climate"
          title="Climate impact"
          summary="Total GHG emissions by lifecycle stage"
          value={totalCarbon}
          unit="kg CO₂e"
        >
          <SimpleBreakdownTable
            data={[
              ...(breakdown.hasViticulture
                ? [
                    { name: 'Viticulture (primary)', value: breakdown.viticulture, unit: 'kg CO₂e' },
                    { name: 'Purchased ingredients', value: breakdown.purchasedIngredients, unit: 'kg CO₂e' },
                  ]
                : [
                    { name: 'Raw materials', value: breakdown.rawMaterials, unit: 'kg CO₂e' },
                  ]
              ),
              { name: 'Processing', value: breakdown.processing, unit: 'kg CO₂e' },
              { name: 'Packaging', value: breakdown.packaging, unit: 'kg CO₂e' },
              { name: 'Transport', value: breakdown.transport, unit: 'kg CO₂e' },
              ...(breakdown.endOfLife ? [{ name: 'End of life', value: breakdown.endOfLife, unit: 'kg CO₂e' }] : []),
              ...(breakdown.usePhase ? [{ name: 'Use phase', value: breakdown.usePhase, unit: 'kg CO₂e' }] : []),
            ]}
            showPercentages
          />
          {breakdown.soilCarbonRemovals > 0 && (
            <div className="mt-4 border-t border-border pt-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Soil carbon removals (FLAG)</span>
                <span className="text-sm font-medium tabular-nums text-studio-good">
                  -{breakdown.soilCarbonRemovals.toFixed(4)} kg CO₂e
                </span>
              </div>
              <p className="mt-1.5 text-xs text-muted-foreground">
                Reported separately per SBTi FLAG Guidance v1.2. Not netted against emissions.
              </p>
            </div>
          )}
        </ImpactAccordion>

        <ImpactAccordion
          id="water"
          category="water"
          title="Water impact"
          summary="Water consumption and scarcity footprint"
          value={waterScarcity}
          unit="m³ world eq"
        >
          <div className="grid grid-cols-2 gap-8">
            <BigNumber value={waterConsumption.toFixed(3)} label="M³ CONSUMPTION" />
            <BigNumber value={waterScarcity.toFixed(3)} label="M³ WORLD EQ SCARCITY" />
          </div>
          {latestLCA.aggregated_impacts?.water_risk_level && (
            <div className="mt-4">
              <StateChip tone={
                latestLCA.aggregated_impacts.water_risk_level === 'low' ? 'good' :
                latestLCA.aggregated_impacts.water_risk_level === 'medium' ? 'attention' :
                'stale'
              }>
                {latestLCA.aggregated_impacts.water_risk_level === 'low' ? 'Low risk' :
                 latestLCA.aggregated_impacts.water_risk_level === 'medium' ? 'Medium risk' : 'High risk'}
              </StateChip>
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
        >
          <div className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="flex-1">
                <div className="h-2 overflow-hidden rounded-full bg-muted">
                  <div
                    className="h-full bg-room transition-all"
                    style={{ width: `${circularityRate}%` }}
                  />
                </div>
              </div>
              <span className="font-display text-2xl font-bold tabular-nums text-foreground">{circularityRate}%</span>
            </div>
            <div className="grid grid-cols-2 gap-8">
              <BigNumber
                value={latestLCA.aggregated_impacts?.fossil_resource_scarcity?.toFixed(3) || '0'}
                label="KG OIL EQ FOSSIL"
              />
              <div>
                <div className="font-mono text-[9.5px] uppercase tracking-[0.2em] text-studio-dim">Rating</div>
                <div className="mt-1.5">
                  <StateChip tone={
                    circularityRate >= 50 ? 'good' :
                    circularityRate >= 25 ? 'attention' : 'stale'
                  }>
                    {circularityRate >= 75 ? 'Excellent' :
                     circularityRate >= 50 ? 'Good' :
                     circularityRate >= 25 ? 'Fair' : 'Poor'}
                  </StateChip>
                </div>
              </div>
            </div>
          </div>
        </ImpactAccordion>

        <ImpactAccordion
          id="nature"
          category="nature"
          title="Nature impact"
          summary="Land use and biodiversity impact"
          value={landUse}
          unit="m²a"
        >
          <div className="grid grid-cols-2 gap-8">
            <BigNumber value={landUse.toFixed(3)} label="M²A CROP EQ LAND USE" />
            <BigNumber
              value={latestLCA.aggregated_impacts?.terrestrial_ecotoxicity?.toFixed(3) || '0.000'}
              label="KG DCB EQ ECOTOXICITY"
            />
          </div>
          <div className="mt-4 flex gap-4">
            <StateChip tone="quiet">ReCiPe 2016</StateChip>
            <StateChip tone="quiet">Multi-capital</StateChip>
          </div>
        </ImpactAccordion>
      </ImpactAccordionGroup>

      {/* Collapsible Supply Chain Map */}
      <Collapsible open={showSupplyChain} onOpenChange={setShowSupplyChain}>
        <section className="border-t border-border pt-5">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-4 text-left">
              <div>
                <Eyebrow className="mb-1">Supply chain network</Eyebrow>
                <p className="text-sm text-muted-foreground">
                  {1 + ingredients.filter(i => i.origin_lat && i.origin_lng).length + packaging.filter(p => p.origin_lat && p.origin_lng).length} supply chain origins
                </p>
              </div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
                {showSupplyChain ? 'Hide map' : 'Show map'}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="pt-4">
              <SupplyChainMap
                facility={facility}
                ingredients={ingredients}
                packaging={packaging}
                productId={product.id}
                productName={product.name}
              />
            </div>
          </CollapsibleContent>
        </section>
      </Collapsible>

      {/* LCA reports */}
      <section className="border-t border-border pt-5">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <Eyebrow className="mb-1">LCA reports</Eyebrow>
            <p className="text-sm text-muted-foreground">Calculation history</p>
          </div>
          {lcaReports.length > 0 && (
            <Link
              href="/reports/lcas"
              className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent transition-colors hover:text-foreground"
            >
              View all
            </Link>
          )}
        </div>
        <div className="divide-y divide-border">
          {lcaReports.slice(0, 3).map((lca) => (
            <Link
              key={lca.id}
              href={`/products/${product.id}/compliance-wizard`}
              className="group flex items-center justify-between gap-4 py-3"
            >
              <div className="flex items-center gap-3">
                <StateChip tone={lca.status === 'completed' ? 'good' : 'attention'}>
                  {lca.status}
                </StateChip>
                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
                  {formatDistanceToNow(new Date(lca.created_at), { addSuffix: true })}
                </span>
              </div>
              {lca.aggregated_impacts?.climate_change_gwp100 != null && (
                <span className="font-display text-sm font-bold tabular-nums text-foreground">
                  {lca.aggregated_impacts.climate_change_gwp100.toFixed(3)}
                  <span className="ml-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                    kg CO₂e
                  </span>
                </span>
              )}
            </Link>
          ))}
        </div>
      </section>

      {/* Collapsible Data Completeness */}
      <Collapsible open={showDataCompleteness} onOpenChange={setShowDataCompleteness}>
        <section className="border-t border-border pt-5">
          <CollapsibleTrigger asChild>
            <button className="flex w-full items-center justify-between gap-4 text-left">
              <div>
                <Eyebrow className="mb-1">Data completeness</Eyebrow>
                <p className="text-sm text-muted-foreground">
                  {isHealthy ? '100%' : ingredients.length > 0 || packaging.length > 0 ? '66%' : '33%'} complete
                </p>
              </div>
              <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
                {showDataCompleteness ? 'Hide' : 'Details'}
              </span>
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="mt-4 divide-y divide-border">
              <CompletenessRow
                label="Ingredients"
                detail={`${ingredients.length} · ${ingredientWeight.toFixed(2)} kg`}
                done={ingredients.length > 0}
              />
              <CompletenessRow
                label="Packaging"
                detail={`${packaging.length} · ${packagingWeight.toFixed(1)} g`}
                done={packaging.length > 0}
              />
              <CompletenessRow
                label="Carbon footprint reports"
                detail={String(lcaReports.length)}
                done={lcaReports.length > 0}
              />
            </div>
          </CollapsibleContent>
        </section>
      </Collapsible>
    </div>
  );
}
