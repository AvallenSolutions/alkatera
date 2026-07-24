import React, { useState } from 'react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { Notice } from '@/components/studio/notice';
import { SectionTabs } from '@/components/studio/section-tabs';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { BarChart3, Leaf, Package, FlaskConical, AlertCircle, CheckCircle2, Info, Globe } from 'lucide-react';
import { ScopeBreakdown } from '@/hooks/data/useCompanyMetrics';
import { RelatableMetric } from '@/components/shared/RelatableMetric';
import type { MaterialBreakdownItem, GHGBreakdown } from './carbon-breakdown-types';
import { LifecycleStageBreakdown, FacilityEmissionsBreakdown } from '@/hooks/data/useCompanyMetrics';
import { Scope3CategoryBreakdown } from './Scope3CategoryBreakdown';
import {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

interface CarbonDeepDiveProps {
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
  /** Product LCA total (sum of per-product climate_change_gwp100 × volume).
   *  Used as the comparison denominator for ISO 14067 carbon origin validation
   *  and GHG gas inventory percentages, because ghgBreakdown comes from product
   *  LCA data — NOT from the broader corporate emissions total. */
  productLcaTotalCO2?: number;
  materialBreakdown?: MaterialBreakdownItem[];
  ghgBreakdown?: GHGBreakdown | null;
  lifecycleStageBreakdown?: LifecycleStageBreakdown[];
  facilityEmissionsBreakdown?: FacilityEmissionsBreakdown[];
  scope3Categories?: Scope3CategoryData[];
  scope3ProductDetails?: ProductEmissionDetail[];
  scope3TravelDetails?: BusinessTravelDetail[];
  scope3LogisticsDetails?: LogisticsDetail[];
  scope3WasteDetails?: WasteDetail[];
  scope3Total?: number;
  year?: number;
  isLoadingScope3?: boolean;
}

export function CarbonDeepDive({
  scopeBreakdown,
  totalCO2,
  productLcaTotalCO2,
  materialBreakdown,
  ghgBreakdown,
  lifecycleStageBreakdown,
  facilityEmissionsBreakdown,
  scope3Categories,
  scope3ProductDetails,
  scope3TravelDetails,
  scope3LogisticsDetails,
  scope3WasteDetails,
  scope3Total,
  year,
  isLoadingScope3,
}: CarbonDeepDiveProps) {
  const [sortBy, setSortBy] = useState<'impact' | 'name' | 'quantity'>('impact');
  const [tab, setTab] = useState('overview');
  const hasScope3Data = scope3Categories && scope3Categories.length > 0;

  // Check if we have any data to display
  const hasMaterialData = materialBreakdown && materialBreakdown.length > 0;
  const hasGhgData = ghgBreakdown && ghgBreakdown.carbon_origin;
  const hasScopeData = scopeBreakdown && (scopeBreakdown.scope1 > 0 || scopeBreakdown.scope2 > 0 || scopeBreakdown.scope3 > 0);
  const hasLifecycleData = lifecycleStageBreakdown && lifecycleStageBreakdown.length > 0;
  const hasFacilityData = facilityEmissionsBreakdown && facilityEmissionsBreakdown.length > 0;

  // We have data if we have ANY of these
  const hasData = hasMaterialData || hasGhgData || hasScopeData || hasLifecycleData || hasFacilityData;

  if (!hasData) {
    // Provide context-specific empty states
    const hasPartialData = totalCO2 > 0;

    return (
      <section className="border-t border-studio-hairline pt-5">
        <div className="space-y-3">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />

            {hasPartialData ? (
              <>
                <p className="text-sm font-medium">Partial carbon data available</p>
                <div className="mt-4 p-4 rounded-[6px] text-left">
                  <p className="text-sm font-semibold text-foreground">Summary metric: {(totalCO2 / 1000).toFixed(3)} tCO₂eq</p>
                  <p className="text-xs text-muted-foreground mt-2">
                    Detailed breakdown pending. Run a full LCA calculation to see:
                  </p>
                  <ul className="text-xs text-muted-foreground mt-2 space-y-1 list-disc list-inside">
                    <li>Material-level contributions</li>
                    <li>GHG gas inventory (CO₂, CH₄, N₂O)</li>
                    <li>Lifecycle stage breakdown</li>
                    <li>Facility operations data</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No carbon breakdown data available</p>
                <div className="mt-4 space-y-3">
                  <div className="p-4 rounded-[6px] text-left">
                    <p className="text-sm font-semibold text-studio-attention">Getting Started</p>
                    <p className="text-xs text-studio-attention mt-2">
                      To see detailed carbon breakdowns:
                    </p>
                    <ol className="text-xs text-studio-attention mt-2 space-y-1 list-decimal list-inside">
                      <li>Navigate to Products → New Product</li>
                      <li>Add materials and packaging data</li>
                      <li>Run LCA calculation</li>
                      <li>Return here to view detailed breakdown</li>
                    </ol>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Once you have completed LCAs, this view will display rich insights including emissions by material, lifecycle stage, and production facility.
                  </p>
                </div>
              </>
            )}
          </div>
        </div>
      </section>
    );
  }

  // Sort materials
  const sortedMaterials = materialBreakdown ? [...materialBreakdown].sort((a, b) => {
    if (sortBy === 'impact') return b.climate - a.climate;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'quantity') return b.quantity - a.quantity;
    return 0;
  }) : [];

  // Calculate total from materials only (not including scope 1 & 2)
  const materialsTotal = sortedMaterials.reduce((sum, m) => sum + m.climate, 0);

  // Calculate percentages based on materials total only
  const materialsWithPercentage = sortedMaterials.map(m => ({
    ...m,
    percentage: materialsTotal > 0 ? (m.climate / materialsTotal) * 100 : 0,
  }));

  // Separate ingredients from packaging
  const isPackaging = (name: string) => {
    const lower = name.toLowerCase();
    return lower.includes('bottle') ||
           lower.includes('cap') ||
           lower.includes('label') ||
           lower.includes('packaging') ||
           lower.includes('stopper') ||
           lower.includes('cork') ||
           lower.includes('closure') ||
           lower.includes('carton') ||
           lower.includes('box') ||
           lower.includes('can') ||
           lower.includes('tin') ||
           lower.includes('wrapper') ||
           lower.includes('shrink') ||
           lower.includes('sleeve');
  };

  const ingredients = materialsWithPercentage.filter(m => !isPackaging(m.name));
  const packaging = materialsWithPercentage.filter(m => isPackaging(m.name));

  const ingredientsTotal = ingredients.reduce((sum, m) => sum + m.climate, 0);
  const packagingTotal = packaging.reduce((sum, m) => sum + m.climate, 0);

  // Calculate scope total for percentage calculations
  const scopeTotal = scopeBreakdown
    ? scopeBreakdown.scope1 + scopeBreakdown.scope2 + scopeBreakdown.scope3
    : 0;

  const getDataSourceBadge = (source?: string) => {
    const config: Record<string, { label: string; className: string }> = {
      primary: { label: 'Primary Data', className: 'bg-studio-ink/40' },
      secondary_modelled: { label: 'Secondary', className: 'bg-studio-ink/70' },
      secondary: { label: 'Secondary', className: 'bg-studio-ink/70' },
      missing: { label: 'Missing Data', className: 'bg-studio-ink' },
      modelled: { label: 'Modelled', className: 'bg-studio-attention' },
    };

    const badgeConfig = config[source || 'secondary_modelled'] || config.secondary_modelled;
    return <StateChip>{badgeConfig.label}</StateChip>;
  };

  // Format emissions value with appropriate unit (kg or t) and max 2 decimal places
  const formatEmissions = (valueKg: number) => {
    if (valueKg >= 1000) {
      // Use tons for large values
      return `${(valueKg / 1000).toFixed(2)} t`;
    } else {
      // Use kg for smaller values
      return `${valueKg.toFixed(2)} kg`;
    }
  };

  // Format quantity value with appropriate unit (kg or t) and max 2 decimal places
  const formatQuantity = (value: number, unit: string) => {
    if (unit === 'kg' && value >= 1000) {
      // Convert kg to tons for large values
      return `${(value / 1000).toFixed(2)} t`;
    } else if (unit === 'kg') {
      return `${value.toFixed(2)} kg`;
    } else {
      // For other units, just format with 2 decimal places
      return `${value.toFixed(2)} ${unit}`;
    }
  };

  return (
    <div className="space-y-6">
      <SectionTabs
        value={tab}
        onChange={setTab}
        tabs={[
          { value: 'overview', label: 'Overview' },
          { value: 'scope3', label: 'Scope 3' },
          { value: 'stages', label: 'Lifecycle' },
          { value: 'materials', label: 'Materials' },
          { value: 'ghg', label: 'GHG detail' },
        ]}
      />

        {/* Overview Tab with Scope Breakdown */}
        {tab === 'overview' && (
        <div className="mt-6 space-y-6">
          {/* The standards this follows. Three mono names on a hairline; it
              was a gradient card with three tinted badges, which gave a
              footnote the visual weight of a headline. */}
          <div className="flex flex-wrap items-baseline gap-x-8 gap-y-2 border-b border-studio-hairline pb-4">
            {[
              ['ISO 14067', 'Carbon footprint quantification'],
              ['GHG Protocol', 'Scope 1, 2, 3 accounting'],
              ['CSRD E1-6', 'EU sustainability reporting'],
            ].map(([name, what]) => (
              <div key={name} className="min-w-0">
                <div className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                  {name}
                </div>
                <div className="mt-0.5 text-xs text-muted-foreground">{what}</div>
              </div>
            ))}
          </div>

          {/* Data Quality Validation Banner — ISO 14067 §6.4.2
              Compare carbon origin (fossil + biogenic + dLUC) against the product
              LCA total, NOT the corporate emissions total. The corporate total
              includes business travel, commuting, fleet, and other overhead
              emissions that are not in any product LCA ghg_breakdown. */}
          {ghgBreakdown && (
            (() => {
              // Use product LCA total as the comparison denominator (same data
              // source as carbon_origin). Fall back to totalCO2 if unavailable.
              const comparisonTotal = (productLcaTotalCO2 && productLcaTotalCO2 > 0)
                ? productLcaTotalCO2
                : totalCO2;
              const fossilBiogenicLuc = ghgBreakdown.carbon_origin.fossil + ghgBreakdown.carbon_origin.biogenic + ghgBreakdown.carbon_origin.land_use_change;
              const variance = Math.abs(fossilBiogenicLuc - comparisonTotal);
              const variancePercent = comparisonTotal > 0 ? (variance / comparisonTotal) * 100 : 0;
              const isValid = variancePercent <= 5;

              if (!isValid) {
                return (
                  <Notice tone="attention" title="Data quality warning">
                    Carbon origin sum ({(fossilBiogenicLuc / 1000).toFixed(3)} t) deviates{' '}
                    {variancePercent.toFixed(1)}% from the product LCA total (
                    {(comparisonTotal / 1000).toFixed(3)} t). ISO 14067 recommends under 5%.
                  </Notice>
                );
              } else {
                return (
                  <Notice tone="good" title="ISO 14067 validated">
                    Carbon origin breakdown reconciles to {variancePercent.toFixed(2)}% variance,
                    inside the 5% tolerance.
                  </Notice>
                );
              }
            })()
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Scope Breakdown Card */}
            {scopeBreakdown && (
              <section className="border-t border-studio-hairline pt-5">
                <div className="mb-3">
                  <Eyebrow>
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    GHG Protocol Scopes
                  </Eyebrow>
                </div>
                <div className="space-y-3">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Scope 1 (Direct)</span>
                        <StateChip tone="stale">
                          {(scopeBreakdown.scope1 / 1000).toFixed(3)} tCO₂eq
                        </StateChip>
                      </div>
                      <div className="w-full bg-studio-ink/10 rounded-full h-2">
                        <div
                          className="bg-studio-ink h-2 rounded-full"
                          style={{ width: `${scopeTotal > 0 ? (scopeBreakdown.scope1 / scopeTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scopeTotal > 0 ? ((scopeBreakdown.scope1 / scopeTotal) * 100).toFixed(1) : 0}% - Facility operations
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Scope 2 (Energy)</span>
                        <StateChip tone="attention">
                          {(scopeBreakdown.scope2 / 1000).toFixed(3)} tCO₂eq
                        </StateChip>
                      </div>
                      <div className="w-full bg-studio-ink/10 rounded-full h-2">
                        <div
                          className="h-2 bg-studio-ink/70"
                          style={{ width: `${scopeTotal > 0 ? (scopeBreakdown.scope2 / scopeTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scopeTotal > 0 ? ((scopeBreakdown.scope2 / scopeTotal) * 100).toFixed(1) : 0}% - Purchased electricity
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Scope 3 (Value Chain)</span>
                        <StateChip tone="attention">
                          {(scopeBreakdown.scope3 / 1000).toFixed(3)} tCO₂eq
                        </StateChip>
                      </div>
                      <div className="w-full bg-studio-ink/10 rounded-full h-2">
                        <div
                          className="h-2 bg-studio-ink/40"
                          style={{ width: `${scopeTotal > 0 ? (scopeBreakdown.scope3 / scopeTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scopeTotal > 0 ? ((scopeBreakdown.scope3 / scopeTotal) * 100).toFixed(1) : 0}% - Materials, transport, end-of-life
                      </p>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {/* Summary Stats */}
            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <Eyebrow>Carbon Footprint Summary</Eyebrow>
              </div>
              <div className="space-y-3">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 rounded-[6px]">
                    <span className="text-sm font-medium text-foreground">Total Emissions</span>
                    <span className="text-lg font-bold text-studio-attention">
                      {(totalCO2 / 1000).toFixed(3)} tCO₂eq
                    </span>
                  </div>
                  {totalCO2 > 0 && (
                    <RelatableMetric
                      kind="co2e"
                      valueKg={totalCO2}
                      variant="light"
                      className="px-1"
                    />
                  )}

                  {materialBreakdown && materialBreakdown.length > 0 && (
                    <>
                      <div className="flex items-center justify-between p-3 rounded-[6px]">
                        <span className="text-sm font-medium text-foreground">Materials Tracked</span>
                        <span className="text-lg font-bold text-foreground">
                          {materialBreakdown.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-[6px]">
                        <span className="text-sm font-medium text-foreground">Top Contributor</span>
                        <span className="text-sm font-bold text-studio-good">
                          {materialBreakdown[0]?.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 rounded-[6px]">
                        <span className="text-sm font-medium text-foreground">Contribution</span>
                        <span className="text-sm font-bold text-foreground">
                          {(() => {
                            const climate = materialBreakdown[0]?.climate;
                            if (
                              climate != null &&
                              Number.isFinite(climate) &&
                              Number.isFinite(totalCO2) &&
                              totalCO2 > 0
                            ) {
                              const percentage = (climate / totalCO2) * 100;
                              return Number.isFinite(percentage) ? percentage.toFixed(1) : '0';
                            }
                            return '0';
                          })()}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </section>
          </div>
        </div>
        )}

        {/* Scope 3 Deep Dive Tab */}
        {tab === 'scope3' && (
        <div className="mt-6 space-y-6">
          {hasScope3Data ? (
            <Scope3CategoryBreakdown
              categories={scope3Categories}
              productDetails={scope3ProductDetails || []}
              travelDetails={scope3TravelDetails || []}
              logisticsDetails={scope3LogisticsDetails || []}
              wasteDetails={scope3WasteDetails || []}
              totalScope3={scope3Total || 0}
              year={year || new Date().getFullYear()}
              isLoading={isLoadingScope3}
            />
          ) : (
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">
                  No Scope 3 breakdown data available
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Add product LCAs, business travel, or overhead data to see a detailed Scope 3 breakdown by GHG Protocol category.
                </p>
              </div>
            </section>
          )}
        </div>
        )}

        {/* Lifecycle Stages Tab */}
        {tab === 'stages' && (
        <div className="mt-6 space-y-6">
          <section className="border-t border-studio-hairline pt-5">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-studio-good" />
                  <Eyebrow>Emissions by Lifecycle Stage</Eyebrow>
                </div>
                <StateChip>ISO 14040/14044</StateChip>
              </div>
            </div>
            <div className="space-y-3">
              {lifecycleStageBreakdown && lifecycleStageBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {lifecycleStageBreakdown.map((stage, index) => (
                    <section key={index} className="border-t border-studio-hairline pt-5">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{stage.stage_name}</h3>
                          <div className="flex items-center gap-2">
                            <StateChip>{(stage.percentage ?? 0).toFixed(1)}%</StateChip>
                            <span className="text-sm font-bold">{((stage.total_impact ?? 0) / 1000).toFixed(3)} tCO₂eq</span>
                          </div>
                        </div>

                        <div className="w-full bg-studio-ink/10 rounded-full h-3">
                          <div
                            className="h-3 rounded-full"
                            style={{ width: `${stage.percentage ?? 0}%` }}
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {stage.material_count ?? 0} materials contributing
                          </p>
                          {stage.top_contributors && stage.top_contributors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {stage.top_contributors.map((contrib, idx) => (
                                <StateChip>
                                  {contrib.name}: {(contrib.impact ?? 0).toFixed(3)}
                                </StateChip>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Lifecycle stage data unavailable</p>
                  <p className="text-xs mt-2">Ensure materials are classified with lifecycle stages in the LCA data</p>
                </div>
              )}
            </div>
          </section>

          {/* Facility Operations Breakdown */}
          {facilityEmissionsBreakdown && facilityEmissionsBreakdown.length > 0 && (
            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                    <Eyebrow>Emissions by Production Facility</Eyebrow>
                  </div>
                  <StateChip>Operations Data</StateChip>
                </div>
              </div>
              <div className="space-y-3">
                <div className="space-y-4">
                  {facilityEmissionsBreakdown.map((facility, index) => (
                    <section key={index} className="border-t border-studio-hairline pt-5">
                      <div className="space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-sm">{facility.facility_name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {facility.location_city}, {facility.location_country_code}
                            </p>
                          </div>
                          <div className="text-right">
                            <StateChip>{(facility.percentage ?? 0).toFixed(1)}%</StateChip>
                            <p className="text-sm font-bold mt-1">{((facility.total_emissions ?? 0) / 1000).toFixed(3)} tCO₂eq</p>
                          </div>
                        </div>

                        <div className="w-full bg-studio-ink/10 rounded-full h-3">
                          <div
                            className="h-3 rounded-full"
                            style={{ width: `${facility.percentage ?? 0}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center justify-between p-2 rounded">
                            <span className="text-studio-stale">Scope 1</span>
                            <span className="font-semibold text-studio-stale">{((facility.scope1_emissions ?? 0) / 1000).toFixed(3)} t</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded">
                            <span className="text-studio-attention">Scope 2</span>
                            <span className="font-semibold text-studio-attention">{((facility.scope2_emissions ?? 0) / 1000).toFixed(3)} t</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded">
                            <span className="text-muted-foreground">Production</span>
                            <span className="font-semibold text-foreground">{(facility.production_volume ?? 0).toLocaleString()} units</span>
                          </div>
                          <div className="flex items-center justify-between p-2 rounded">
                            <span className="text-studio-good">Intensity</span>
                            <span className="font-semibold text-studio-good">{((facility.facility_intensity ?? 0) / 1000).toFixed(6)} t/unit</span>
                          </div>
                        </div>
                      </div>
                    </section>
                  ))}
                </div>
              </div>
            </section>
          )}
        </div>
        )}

        {/* GHG Gas Inventory Tab */}
        {tab === 'ghg' && (
        <div className="mt-6 space-y-6">
          <section className="border-t border-studio-hairline pt-5">
            <div className="mb-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-studio-attention" />
                  <Eyebrow>Greenhouse Gas Inventory</Eyebrow>
                </div>
                <div className="flex gap-2">
                  <StateChip>ISO 14067</StateChip>
                  <StateChip>GHG Protocol</StateChip>
                </div>
              </div>
            </div>
            <div className="space-y-3">
              {ghgBreakdown ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-4 gap-4">
                    <section className="border-t border-studio-hairline pt-5">
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-studio-attention">
                            {(totalCO2 / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                          <span className="text-xs text-muted-foreground">tCO₂eq</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total GHG Emissions</p>
                      </div>
                    </section>

                    <section className="border-t border-studio-hairline pt-5">
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-foreground">
                            {'ch4_fossil_gwp100' in ghgBreakdown.gwp_factors ? ghgBreakdown.gwp_factors.ch4_fossil_gwp100 : 29.8}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">CH₄ Fossil (IPCC AR6)</p>
                      </div>
                    </section>

                    <section className="border-t border-studio-hairline pt-5">
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-foreground">
                            {'ch4_biogenic_gwp100' in ghgBreakdown.gwp_factors ? ghgBreakdown.gwp_factors.ch4_biogenic_gwp100 : 27.2}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">CH₄ Biogenic (IPCC AR6)</p>
                      </div>
                    </section>

                    <section className="border-t border-studio-hairline pt-5">
                      <div className="space-y-3">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-foreground">
                            {'n2o_gwp100' in ghgBreakdown.gwp_factors ? ghgBreakdown.gwp_factors.n2o_gwp100 : 273}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">N₂O Factor (IPCC AR6)</p>
                      </div>
                    </section>
                  </div>

                  {/* Data Quality Indicator */}
                  {'data_quality' in ghgBreakdown && (
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">Data Quality:</span>
                      <StateChip tone="attention">
                        {ghgBreakdown.data_quality === 'primary' ? 'Primary (EcoInvent/Measured)' :
                         ghgBreakdown.data_quality === 'secondary' ? 'Secondary (Calculated)' :
                         'Tertiary (Estimated)'}
                      </StateChip>
                    </div>
                  )}

                  {/* Gas Inventory Table */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Gas-by-Gas Breakdown
                    </h3>
                    <div className="border rounded-[6px] overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="">
                            <TableHead className="font-semibold">Gas Species</TableHead>
                            <TableHead className="font-semibold text-right">Mass (kg)</TableHead>
                            <TableHead className="font-semibold text-center">GWP100 Factor</TableHead>
                            <TableHead className="font-semibold text-right">CO₂eq (kg)</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-studio-ink/70" />
                                CO₂ (Fossil)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.gas_inventory.co2_fossil.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right font-semibold">
                              {ghgBreakdown.gas_inventory.co2_fossil.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.co2_fossil / (productLcaTotalCO2 || totalCO2)) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-studio-ink/40" />
                                CO₂ (Biogenic)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.gas_inventory.co2_biogenic.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right font-semibold">
                              {ghgBreakdown.gas_inventory.co2_biogenic.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.co2_biogenic / (productLcaTotalCO2 || totalCO2)) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          {/* CH4 Fossil Row */}
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-studio-ink/70" />
                                CH₄ (Fossil)
                                <StateChip>Industrial</StateChip>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.methane_fossil ?? 0) / (ghgBreakdown.gwp_factors.ch4_fossil_gwp100 ?? 29.8)).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {ghgBreakdown.gwp_factors.ch4_fossil_gwp100 ?? 29.8}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {(ghgBreakdown.gas_inventory.methane_fossil ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {(((ghgBreakdown.gas_inventory.methane_fossil ?? 0) / (productLcaTotalCO2 || totalCO2)) * 100).toFixed(2)}%
                            </TableCell>
                          </TableRow>

                          {/* CH4 Biogenic Row */}
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-studio-ink/40" />
                                CH₄ (Biogenic)
                                <StateChip>Agricultural</StateChip>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.methane_biogenic ?? 0) / (ghgBreakdown.gwp_factors.ch4_biogenic_gwp100 ?? 27.2)).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </TableCell>
                            <TableCell className="text-center">
                              {ghgBreakdown.gwp_factors.ch4_biogenic_gwp100 ?? 27.2}
                            </TableCell>
                            <TableCell className="text-right font-semibold">
                              {(ghgBreakdown.gas_inventory.methane_biogenic ?? 0).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {(((ghgBreakdown.gas_inventory.methane_biogenic ?? 0) / (productLcaTotalCO2 || totalCO2)) * 100).toFixed(2)}%
                            </TableCell>
                          </TableRow>

                          {/* N2O Row */}
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-studio-ink/40" />
                                Nitrous Oxide (N₂O)
                                <StateChip>Fertiliser</StateChip>
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {ghgBreakdown.physical_mass && ghgBreakdown.physical_mass.n2o_kg > 0
                                ? ghgBreakdown.physical_mass.n2o_kg.toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })
                                : (ghgBreakdown.gas_inventory.nitrous_oxide / (ghgBreakdown.gwp_factors.n2o_gwp100 ?? 273)).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </TableCell>
                            <TableCell className="text-center">{'n2o_gwp100' in ghgBreakdown.gwp_factors ? ghgBreakdown.gwp_factors.n2o_gwp100 : 273}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {ghgBreakdown.gas_inventory.nitrous_oxide.toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.nitrous_oxide / (productLcaTotalCO2 || totalCO2)) * 100).toFixed(2)}%
                            </TableCell>
                          </TableRow>

                          {ghgBreakdown.gas_inventory.hfc_pfc > 0 && (
                            <TableRow>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-studio-ink/40" />
                                  F-gases (HFC/PFC)
                                </div>
                              </TableCell>
                              <TableCell className="text-right">-</TableCell>
                              <TableCell className="text-center">Various</TableCell>
                              <TableCell className="text-right font-semibold">
                                {ghgBreakdown.gas_inventory.hfc_pfc.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {((ghgBreakdown.gas_inventory.hfc_pfc / (productLcaTotalCO2 || totalCO2)) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Methodology Note */}
                  <section className="border-t border-studio-hairline pt-5">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-muted-foreground mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-foreground">Assessment Method: {ghgBreakdown.gwp_factors.method}</p>
                          <p className="text-xs text-muted-foreground">
                            Global Warming Potentials calculated using {ghgBreakdown.gwp_factors.method} characterisation factors.
                            All emissions converted to 100-year CO₂ equivalents per IPCC methodology.
                          </p>
                          {((ghgBreakdown.gas_inventory.methane > 0 || ghgBreakdown.gas_inventory.nitrous_oxide > 0) &&
                            (ghgBreakdown.gas_inventory.methane + ghgBreakdown.gas_inventory.nitrous_oxide) / (productLcaTotalCO2 || totalCO2) > 0.04) && (
                            <p className="text-xs text-muted-foreground mt-2 p-2 rounded">
                              <strong>Note:</strong> CH₄ and N₂O values estimated using typical GHG composition ratios (~3% CH₄, ~2% N₂O in CO₂eq)
                              as material-specific gas breakdowns are not available. CO₂ values are actual measured data.
                            </p>
                          )}
                        </div>
                      </div>
                    </div>
                  </section>

                  {/* CSRD E1 Compliance Note */}
                  <section className="border-t border-studio-hairline pt-5">
                    <div className="space-y-3">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-foreground">CSRD E1-6: GHG Emissions</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            This breakdown satisfies European Sustainability Reporting Standards (ESRS) E1-6 disclosure requirements for gross Scope 1, 2, and 3 GHG emissions,
                            including disaggregation by greenhouse gas type (CO₂, CH₄, N₂O, HFCs) and biogenic/fossil origin distinction as required for EU sustainability reporting.
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <div className="text-xs">
                              <StateChip tone="good">Required</StateChip>
                              <p className="text-muted-foreground">Scope 1, 2, 3 totals</p>
                            </div>
                            <div className="text-xs">
                              <StateChip tone="good">Required</StateChip>
                              <p className="text-muted-foreground">Gas-by-gas breakdown</p>
                            </div>
                            <div className="text-xs">
                              <StateChip tone="good">Required</StateChip>
                              <p className="text-muted-foreground">Biogenic CO₂ separate</p>
                            </div>
                            <div className="text-xs">
                              <StateChip>Optional</StateChip>
                              <p className="text-muted-foreground">Land use change</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </section>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">GHG breakdown not available for this calculation</p>
                </div>
              )}
            </div>
          </section>
        </div>
        )}

        {/* Material Breakdown Tab */}
        {tab === 'materials' && (
        <div className="mt-6 space-y-6">
          {materialBreakdown && materialBreakdown.length > 0 ? (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <section className="border-t border-studio-hairline pt-5">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-studio-good">
                        {ingredients.length}
                      </span>
                      <span className="text-xs text-muted-foreground">ingredients</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(ingredientsTotal / 1000).toFixed(3)} tCO₂eq total
                    </p>
                  </div>
                </section>

                <section className="border-t border-studio-hairline pt-5">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-foreground">
                        {packaging.length}
                      </span>
                      <span className="text-xs text-muted-foreground">packaging parts</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(packagingTotal / 1000).toFixed(3)} tCO₂eq total
                    </p>
                  </div>
                </section>

                <section className="border-t border-studio-hairline pt-5">
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-studio-attention">
                        {materialBreakdown.length}
                      </span>
                      <span className="text-xs text-muted-foreground">total materials</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {((ingredientsTotal + packagingTotal) / 1000).toFixed(2)} tCO₂eq combined
                    </p>
                  </div>
                </section>
              </div>

              {/* Sort Options */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Material-by-Material Impact Analysis
                </h3>
                <div className="flex items-baseline gap-4">
                  {([
                    ['impact', 'By impact'],
                    ['name', 'By name'],
                    ['quantity', 'By quantity'],
                  ] as const).map(([key, label]) => (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setSortBy(key)}
                      aria-pressed={sortBy === key}
                      className={
                        'border-b-2 pb-0.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] transition-colors duration-150 ease-studio ' +
                        (sortBy === key
                          ? 'border-room-accent text-foreground'
                          : 'border-transparent text-studio-dim hover:text-foreground')
                      }
                    >
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Ingredients Section */}
              {ingredients.length > 0 && (
                <section className="border-t border-studio-hairline pt-5">
                  <div className="mb-3">
                    <Eyebrow>
                      <Leaf className="h-4 w-4 text-studio-good" />
                      Ingredients ({ingredients.length})
                    </Eyebrow>
                  </div>
                  <div className="space-y-3">
                    <div className="border rounded-[6px] overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="">
                            <TableHead className="font-semibold">Material Name</TableHead>
                            <TableHead className="font-semibold text-right">Quantity</TableHead>
                            <TableHead className="font-semibold text-right">Total Impact</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                            <TableHead className="font-semibold text-center">Data Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((material, idx) => {
                            const climateValue = material.climate ?? 0;
                            const quantityValue = material.quantity ?? 0;
                            const percentageValue = material.percentage ?? 0;
                            return (
                              <TableRow key={idx} className={percentageValue > 5 ? '/50' : ''}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.warning && (
                                    <StateChip tone="stale">
                                      {material.warning}
                                    </StateChip>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatQuantity(quantityValue, material.unit || 'kg')}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatEmissions(climateValue)} CO₂eq
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-studio-ink/10 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-studio-ink/40"
                                        style={{ width: `${Math.min(percentageValue, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {percentageValue.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getDataSourceBadge(material.source)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </section>
              )}

              {/* Packaging Section */}
              {packaging.length > 0 && (
                <section className="border-t border-studio-hairline pt-5">
                  <div className="mb-3">
                    <Eyebrow>
                      <Package className="h-4 w-4 text-muted-foreground" />
                      Packaging ({packaging.length})
                    </Eyebrow>
                  </div>
                  <div className="space-y-3">
                    <div className="border rounded-[6px] overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="">
                            <TableHead className="font-semibold">Material Name</TableHead>
                            <TableHead className="font-semibold text-right">Quantity</TableHead>
                            <TableHead className="font-semibold text-right">Total Impact</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                            <TableHead className="font-semibold text-center">Data Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {packaging.map((material, idx) => {
                            const climateValue = material.climate ?? 0;
                            const quantityValue = material.quantity ?? 0;
                            const percentageValue = material.percentage ?? 0;
                            return (
                              <TableRow key={idx} className={percentageValue > 5 ? '/50' : ''}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.warning && (
                                    <StateChip tone="stale">
                                      {material.warning}
                                    </StateChip>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {formatQuantity(quantityValue, material.unit || 'kg')}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {formatEmissions(climateValue)} CO₂eq
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-studio-ink/10 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-studio-ink/70"
                                        style={{ width: `${Math.min(percentageValue, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {percentageValue.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getDataSourceBadge(material.source)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                </section>
              )}
            </>
          ) : (
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm font-medium">No material breakdown data available</p>
                <p className="text-xs mt-2">
                  Material-level emissions will appear here after LCA calculation
                </p>
              </div>
            </section>
          )}
        </div>
        )}
    </div>
  );
}
