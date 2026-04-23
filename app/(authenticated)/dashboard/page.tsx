'use client';

import { useEffect, useState, useMemo } from 'react';
import Link from 'next/link';
import { useOrganization } from '@/lib/organizationContext';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useWasteMetrics } from '@/hooks/data/useWasteMetrics';
import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import type { NatureMetrics } from '@/hooks/data/useCompanyMetrics';
import { useFacilityWaterData } from '@/hooks/data/useFacilityWaterData';
import { useVitalityBenchmarks } from '@/hooks/data/useVitalityBenchmarks';
import { usePeopleCultureScore } from '@/hooks/data/usePeopleCultureScore';
import { useProductSpotlight } from '@/hooks/data/useProductSpotlight';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RefreshCw, Package, ArrowRight, Sparkles } from 'lucide-react';

import { VitalityScoreHero, calculateVitalityScores } from '@/components/vitality/VitalityScoreHero';
import { getBenchmarkForProductType } from '@/lib/industry-benchmarks';
import { fetchProducts } from '@/lib/products';
import { generatePriorityActions } from '@/components/dashboard/PriorityActionCard';
import { ThreeThingsTodayHero } from '@/components/dashboard/ThreeThingsTodayHero';
import { SetupProgressBanner } from '@/components/dashboard/SetupProgressBanner';
import { useSetupProgress } from '@/hooks/data/useSetupProgress';
import { useHeroDismissal } from '@/hooks/useHeroDismissal';
import { useOnboarding } from '@/lib/onboarding';
import { StatCard } from '@/components/dashboard/StatCard';
import { InlineErrorBoundary } from '@/components/ErrorBoundary';
import { usePersistedYear, useLatestDataYear } from '@/hooks/usePersistedYear';

import {
  RecentActivityWidget,
  ImpactValueWidget,
  CanopyCreditsWidget,
  BreweryProductionWidget,
} from '@/components/dashboard/widgets';

/** Animated loading visual shown while dashboard data is streaming in. */
function DashboardLoadingVisual() {
  return (
    <div className="relative flex flex-col items-center justify-center py-16 overflow-hidden rounded-2xl border border-slate-200/50 dark:border-slate-800/50 bg-gradient-to-br from-slate-50 via-white to-slate-50 dark:from-slate-900/80 dark:via-slate-900 dark:to-slate-800/80">
      {/* Ambient glow */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="h-40 w-40 rounded-full bg-[#ccff00]/10 dark:bg-[#ccff00]/5 blur-3xl animate-pulse" />
      </div>

      {/* Concentric animated rings */}
      <div className="relative h-24 w-24 mb-5">
        {/* Outer ring — slow spin */}
        <div className="absolute inset-0 rounded-full border-2 border-dashed border-[#ccff00]/30 animate-[spin_8s_linear_infinite]" />
        {/* Middle ring — reverse spin */}
        <div className="absolute inset-2 rounded-full border-2 border-[#ccff00]/20 animate-[spin_6s_linear_infinite_reverse]" />
        {/* Inner ring — fast spin, thicker arc */}
        <div className="absolute inset-4 rounded-full border-2 border-transparent border-t-[#ccff00] border-r-[#ccff00]/40 animate-[spin_1.5s_ease-in-out_infinite]" />
        {/* Centre dot — pulsing */}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="h-3 w-3 rounded-full bg-[#ccff00] animate-pulse shadow-[0_0_12px_rgba(204,255,0,0.5)]" />
        </div>
      </div>

      {/* Text */}
      <p className="text-sm font-medium text-slate-600 dark:text-slate-300 tracking-wide mb-1">
        Data Loading
      </p>
      <p className="text-xs text-slate-400 dark:text-slate-500">
        Crunching your sustainability numbers…
      </p>

      {/* Bottom progress track */}
      <div className="mt-5 h-1 w-48 overflow-hidden rounded-full bg-slate-200/60 dark:bg-slate-800/60">
        <div className="h-full w-1/3 animate-loading-bar rounded-full bg-[#ccff00]" />
      </div>
    </div>
  );
}


function deriveBiodiversityRisk(natureMetrics: NatureMetrics | null): 'high' | 'medium' | 'low' | undefined {
  if (!natureMetrics) return undefined;
  if (!natureMetrics.per_unit) return undefined;

  const pu = natureMetrics.per_unit;

  function rateMetric(value: number, excellent: number, good: number): number {
    if (value <= excellent) return 3;
    if (value <= good) return 2;
    return 1;
  }

  const scores = [
    rateMetric(pu.land_use || 0, 500, 2000),
    rateMetric(pu.terrestrial_ecotoxicity || 0, 5, 15),
    rateMetric(pu.freshwater_eutrophication || 0, 0.3, 0.7),
    rateMetric(pu.terrestrial_acidification || 0, 1.5, 3.0),
  ];

  const avgScore = scores.reduce((a, b) => a + b, 0) / scores.length;

  if (avgScore >= 2.5) return 'low';
  if (avgScore >= 1.5) return 'medium';
  return 'high';
}

function getStatusFromValue(value: number | null, thresholds: { good: number; warning: number }, higherIsBetter: boolean): 'good' | 'warning' | 'critical' | 'neutral' {
  if (value === null || value === undefined) return 'neutral';
  if (higherIsBetter) {
    if (value >= thresholds.good) return 'good';
    if (value >= thresholds.warning) return 'warning';
    return 'critical';
  }
  // Lower is better (not used currently but for completeness)
  if (value <= thresholds.good) return 'good';
  if (value <= thresholds.warning) return 'warning';
  return 'critical';
}

const AVAILABLE_YEARS = Array.from({ length: 4 }, (_, i) => new Date().getFullYear() - i);

// ── LCA status badge colours ────────────────────────────────────────
const LCA_BADGE: Record<string, { label: string; className: string }> = {
  completed: { label: 'LCA Complete', className: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300' },
  in_progress: { label: 'In Progress', className: 'bg-amber-100 text-amber-800 dark:bg-amber-900/50 dark:text-amber-300' },
  draft: { label: 'No LCA', className: 'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400' },
};

export default function DashboardPage() {
  const { currentOrganization } = useOrganization();
  const latestDataYear = useLatestDataYear(currentOrganization?.id);
  const { selectedYear, setSelectedYear } = usePersistedYear(AVAILABLE_YEARS, latestDataYear);
  const { footprint, loading: footprintLoading } = useCompanyFootprint(selectedYear);
  const { footprint: previousYearFootprint } = useCompanyFootprint(selectedYear - 1);
  const { metrics: wasteMetrics, loading: wasteLoading } = useWasteMetrics(selectedYear);
  const companyMetricsResult = useCompanyMetrics(selectedYear);
  const { metrics: companyMetrics, natureMetrics, loading: metricsLoading } = companyMetricsResult;
  const { companyOverview: waterCompanyOverview } = useFacilityWaterData(selectedYear);
  const { getBenchmarkForPillar } = useVitalityBenchmarks();
  const { score: peopleCultureScore, loading: pcLoading } = usePeopleCultureScore(selectedYear);
  const { products: spotlightProducts, loading: spotlightLoading } = useProductSpotlight();

  const setupProgress = useSetupProgress();
  const heroDismissal = useHeroDismissal();
  const [refreshKey, setRefreshKey] = useState(0);

  // Onboarding writes facilities/products/team records while the wizard is
  // overlaid on this page. useSetupProgress fetches on mount, so without a
  // refetch it keeps the stale pre-onboarding zeros. Watch the wizard state
  // and refetch whenever a step completes or the flow finishes.
  const { state: onboardingState } = useOnboarding();
  const onboardingCompletedCount = onboardingState.completedSteps.length;
  const onboardingFinished = onboardingState.completed;
  const setupRefetch = setupProgress.refetch;
  useEffect(() => {
    setupRefetch();
  }, [onboardingCompletedCount, onboardingFinished, setupRefetch]);

  // Fetch product categories for industry benchmark lookup
  const [productCategories, setProductCategories] = useState<(string | null)[]>([]);
  useEffect(() => {
    if (!currentOrganization?.id) return;
    fetchProducts(currentOrganization.id).then(products => {
      setProductCategories(products.map(p => p.product_category ?? null));
    }).catch(() => {});
  }, [currentOrganization?.id]);

  const { benchmark: industryBenchmarkData, dominantCategory } = useMemo(
    () => getBenchmarkForProductType(currentOrganization?.product_type, productCategories),
    [currentOrganization?.product_type, productCategories]
  );

  const isVitalityLoading = metricsLoading || footprintLoading || wasteLoading;
  const isAnyDataLoading = footprintLoading || wasteLoading || metricsLoading || pcLoading;

  const waterConsumption = useMemo(() => {
    const facilityScarcity = waterCompanyOverview?.total_scarcity_weighted_m3
      || waterCompanyOverview?.scarcity_weighted_consumption_m3
      || 0;
    if (facilityScarcity > 0) return facilityScarcity;
    return companyMetrics?.total_impacts?.water_scarcity_aware
      || companyMetrics?.total_impacts?.water_consumption
      || 0;
  }, [companyMetrics, waterCompanyOverview]);

  const totalCO2 = footprint?.total_emissions || companyMetrics?.total_impacts?.climate_change_gwp100 || 0;
  const landUse = companyMetrics?.total_impacts?.land_use || 0;
  const circularityRate = wasteMetrics?.waste_diversion_rate || companyMetrics?.circularity_percentage || 0;

  const estimatedLitresPerProduct = 50000;
  const industryBenchmarkTotal = industryBenchmarkData.kgCO2ePerLitre * estimatedLitresPerProduct
    * (companyMetrics?.total_products_assessed || 1);

  const vitalityScores = useMemo(() => {
    const numProducts = companyMetrics?.total_products_assessed || 1;
    const hasProductData = companyMetrics?.total_products_assessed !== undefined &&
                           companyMetrics.total_products_assessed > 0;
    const hasWasteData = wasteMetrics !== null && wasteMetrics !== undefined;

    return calculateVitalityScores({
      totalEmissions: totalCO2,
      emissionsIntensity: totalCO2 / numProducts,
      industryBenchmark: industryBenchmarkTotal / numProducts,
      waterConsumption: waterConsumption,
      waterRiskLevel: companyMetrics?.water_risk_level as 'high' | 'medium' | 'low' | undefined,
      recyclingRate: wasteMetrics?.circularity_rate,
      circularityRate: circularityRate,
      landUseIntensity: landUse,
      biodiversityRisk: deriveBiodiversityRisk(natureMetrics),
      hasProductData,
      hasWasteData,
    });
  }, [totalCO2, waterConsumption, companyMetrics, wasteMetrics, circularityRate, landUse, natureMetrics, industryBenchmarkTotal]);

  const emissionsIntensity = totalCO2 / (companyMetrics?.total_products_assessed || 1);
  const industryBenchmarkPerProduct = industryBenchmarkTotal / (companyMetrics?.total_products_assessed || 1);
  const intensityRatio = industryBenchmarkPerProduct > 0 ? emissionsIntensity / industryBenchmarkPerProduct : 0;

  const scoreCalculationInputs = useMemo(() => ({
    climate: {
      totalEmissions: totalCO2,
      emissionsIntensity,
      industryBenchmark: industryBenchmarkPerProduct,
      intensityRatio,
      benchmarkSource: {
        name: industryBenchmarkData.sourceName,
        url: industryBenchmarkData.sourceUrl,
        year: industryBenchmarkData.sourceYear,
        category: dominantCategory ?? undefined,
      },
    },
    water: {
      waterRiskLevel: companyMetrics?.water_risk_level as 'high' | 'medium' | 'low' | undefined,
      waterConsumption,
    },
    circularity: {
      circularityRate,
    },
    nature: {
      biodiversityRisk: deriveBiodiversityRisk(natureMetrics),
      landUse,
    },
  }), [totalCO2, emissionsIntensity, industryBenchmarkPerProduct, intensityRatio, companyMetrics, waterConsumption, circularityRate, natureMetrics, landUse, industryBenchmarkData, dominantCategory]);

  const scopeBreakdown = useMemo(() => {
    if (!footprint?.breakdown) return { scope1Pct: 0, scope2Pct: 0, scope3Pct: 0 };
    const total = footprint.total_emissions || 1;
    return {
      scope1Pct: ((footprint.breakdown.scope1 || 0) / total) * 100,
      scope2Pct: ((footprint.breakdown.scope2 || 0) / total) * 100,
      scope3Pct: ((footprint.breakdown.scope3?.total || 0) / total) * 100,
    };
  }, [footprint]);

  const priorityActions = useMemo(() => {
    return generatePriorityActions({
      hasFacilities: setupProgress.hasFacilities,
      hasProducts: setupProgress.hasProducts,
      hasSuppliers: setupProgress.hasSuppliers,
      hasTeamMembers: setupProgress.hasTeamMembers,
      facilitiesCount: setupProgress.facilitiesCount,
      productsCount: setupProgress.productsCount,
      totalEmissions: footprint?.total_emissions,
      scope1Percentage: scopeBreakdown.scope1Pct,
      scope2Percentage: scopeBreakdown.scope2Pct,
      scope3Percentage: scopeBreakdown.scope3Pct,
      circularityRate: wasteMetrics?.waste_diversion_rate,
      hasWasteData: wasteMetrics !== null && wasteMetrics !== undefined,
    });
  }, [scopeBreakdown, wasteMetrics, footprint, setupProgress]);

  const carbonTrend = useMemo(() => {
    if (!footprint?.total_emissions || !previousYearFootprint?.total_emissions) {
      return { value: undefined, direction: 'stable' as const };
    }
    const currentEmissions = footprint.total_emissions;
    const previousEmissions = previousYearFootprint.total_emissions;
    if (previousEmissions === 0) return { value: undefined, direction: 'stable' as const };
    const percentChange = ((currentEmissions - previousEmissions) / previousEmissions) * 100;
    return {
      value: Math.abs(Math.round(percentChange)),
      direction: percentChange < 0 ? 'down' as const : percentChange > 0 ? 'up' as const : 'stable' as const,
    };
  }, [footprint, previousYearFootprint]);

  const handleRefresh = () => {
    setRefreshKey(prev => prev + 1);
  };

  // ── Stat card values ──────────────────────────────────────────────
  const carbonValue = footprint?.total_emissions
    ? (footprint.total_emissions / 1000).toFixed(1)
    : '--';
  const waterValue = waterConsumption > 0
    ? (waterConsumption >= 1000 ? `${(waterConsumption / 1000).toFixed(1)}k` : waterConsumption.toFixed(0))
    : '--';
  const livingWageValue = peopleCultureScore?.living_wage_compliance != null
    ? Math.round(peopleCultureScore.living_wage_compliance).toString()
    : '--';
  const wasteValue = wasteMetrics?.waste_diversion_rate != null
    ? wasteMetrics.waste_diversion_rate.toFixed(0)
    : '--';

  // Status colouring: emerald ≥70, amber 40–69, red <40
  const carbonStatus = footprint?.total_emissions != null
    ? getStatusFromValue(vitalityScores.climate, { good: 70, warning: 40 }, true)
    : 'neutral';
  const waterStatus = waterConsumption > 0
    ? getStatusFromValue(vitalityScores.water, { good: 70, warning: 40 }, true)
    : 'neutral';
  const livingWageStatus = peopleCultureScore?.living_wage_compliance != null
    ? getStatusFromValue(peopleCultureScore.living_wage_compliance, { good: 70, warning: 40 }, true)
    : 'neutral';
  const wasteStatus = wasteMetrics?.waste_diversion_rate != null
    ? getStatusFromValue(wasteMetrics.waste_diversion_rate, { good: 70, warning: 40 }, true)
    : 'neutral';

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* ── COMMAND STRIP ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            {currentOrganization?.name || 'Dashboard'}
          </h1>
          <p className="text-sm text-muted-foreground">
            Sustainability Overview &middot; {selectedYear}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {AVAILABLE_YEARS.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh dashboard">
            <RefreshCw className={`h-4 w-4 transition-transform ${isAnyDataLoading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
      </div>

      {/* Three Things Today — highest-leverage priority actions, hero position */}
      {!setupProgress.isLoading && heroDismissal.isVisible && (
        <ThreeThingsTodayHero
          actions={priorityActions}
          onHideForToday={heroDismissal.hideForToday}
          onHidePermanently={heroDismissal.hidePermanently}
        />
      )}
      {!setupProgress.isLoading && !heroDismissal.isVisible && (
        <Button
          variant="ghost"
          size="sm"
          className="gap-2 text-xs text-muted-foreground hover:text-foreground self-start -mt-2"
          onClick={heroDismissal.restore}
        >
          <Sparkles className="h-3.5 w-3.5" />
          Show priority actions
        </Button>
      )}

      {/* Setup Progress Banner — shows for new users until all milestones are done */}
      {!setupProgress.isLoading && !setupProgress.isDismissed && (
        <SetupProgressBanner progress={setupProgress} />
      )}

      {/* Loading visual — replaces zone skeletons while data streams in */}
      {isAnyDataLoading && <DashboardLoadingVisual />}

      {/* ── ZONE 1 — Vitality Score (full width) ─────────────────── */}
      {!isAnyDataLoading && (
        <VitalityScoreHero
          overallScore={vitalityScores.overall}
          climateScore={vitalityScores.climate}
          waterScore={vitalityScores.water}
          circularityScore={vitalityScores.circularity}
          natureScore={vitalityScores.nature}
          hasData={vitalityScores.hasData}
          benchmarkData={getBenchmarkForPillar('overall')}
          lastUpdated={companyMetrics?.last_updated
            ? new Date(companyMetrics.last_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
            : undefined
          }
          onRefresh={handleRefresh}
          loading={isAnyDataLoading}
          calculationInputs={scoreCalculationInputs}
        />
      )}

      {/* ── ZONE 2 + ZONE 3 — Headlines + Impact Value ────────────── */}
      {!isAnyDataLoading && (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Zone 2 — People & Planet Headlines (4 stat cards) */}
          <div className="lg:col-span-8">
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
              <StatCard
                label="Carbon Footprint"
                value={carbonValue}
                unit="tCO₂e"
                trend={carbonTrend.value}
                trendDirection={carbonTrend.direction}
                status={carbonStatus}
                href="/reports/company-footprint"
                loading={footprintLoading}
                higherIsBetter={false}
                source={footprint?.source}
              />
              <StatCard
                label="Water Impact"
                value={waterValue}
                unit="m³"
                status={waterStatus}
                href="/performance"
                loading={metricsLoading}
                higherIsBetter={false}
                source={waterCompanyOverview?.source}
              />
              <StatCard
                label="Living Wage Compliance"
                value={livingWageValue}
                unit="% compliant"
                status={livingWageStatus}
                href="/people-culture/fair-work"
                loading={pcLoading}
                higherIsBetter={true}
              />
              <StatCard
                label="Waste Diversion"
                value={wasteValue}
                unit="% diverted"
                status={wasteStatus}
                href="/performance"
                loading={wasteLoading}
                higherIsBetter={true}
                source={wasteMetrics?.source}
              />
            </div>
          </div>

          {/* Zone 3 — Impact Value (beta feature gate) */}
          <div className="lg:col-span-4 space-y-4">
            <InlineErrorBoundary>
              <ImpactValueWidget />
            </InlineErrorBoundary>
            <InlineErrorBoundary>
              <BreweryProductionWidget />
            </InlineErrorBoundary>
            {/* Hidden - Expert Consulting not ready for public viewing
            <InlineErrorBoundary>
              <CanopyCreditsWidget />
            </InlineErrorBoundary>
            */}
          </div>
        </div>
      )}

      {/* ── PRODUCT SPOTLIGHT ─────────────────────────────────────── */}
      {!isAnyDataLoading && <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Product Spotlight</CardTitle>
            <Link
              href="/products"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              View all products <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </CardHeader>
        <CardContent>
          {spotlightLoading ? (
            <div className="flex gap-4 overflow-hidden">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="min-w-[220px] space-y-2">
                  <Skeleton className="h-28 w-full rounded-lg" />
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-20" />
                </div>
              ))}
            </div>
          ) : spotlightProducts.length === 0 ? (
            <Link
              href="/products/new"
              className="flex flex-col items-center justify-center py-8 text-center rounded-xl border-2 border-dashed border-slate-200 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
            >
              <div className="h-12 w-12 rounded-xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-3">
                <Package className="h-6 w-6 text-slate-400" />
              </div>
              <p className="text-sm font-medium mb-1">Add your first product</p>
              <p className="text-xs text-muted-foreground">Start tracking product-level environmental impact</p>
            </Link>
          ) : (
            <div className="flex gap-4 overflow-x-auto pb-2">
              {spotlightProducts.map((product) => {
                const badge = LCA_BADGE[product.lca_status];
                const co2Display = product.co2e_per_unit != null
                  ? product.co2e_per_unit >= 1000
                    ? `${(product.co2e_per_unit / 1000).toFixed(2)} tCO₂e`
                    : `${product.co2e_per_unit.toFixed(2)} kg CO₂e`
                  : '--';

                return (
                  <Link
                    key={product.id}
                    href={`/products/${product.id}`}
                    className="group min-w-[220px] max-w-[220px] flex-shrink-0 rounded-xl border border-slate-200 dark:border-slate-800 p-3 transition-shadow hover:shadow-md"
                  >
                    {/* Product image or placeholder */}
                    <div className="h-24 w-full rounded-lg bg-slate-100 dark:bg-slate-800 mb-2 overflow-hidden flex items-center justify-center">
                      {product.image_url ? (
                        <img
                          src={product.image_url}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <Package className="h-8 w-8 text-slate-300 dark:text-slate-600" />
                      )}
                    </div>
                    {/* Name */}
                    <p className="text-sm font-medium truncate mb-1">{product.name}</p>
                    {/* LCA badge */}
                    <span className={`inline-block text-xs px-2 py-0.5 rounded-full font-medium mb-1.5 ${badge.className}`}>
                      {badge.label}
                    </span>
                    {/* CO₂e per unit */}
                    <p className="text-xs text-muted-foreground">
                      {co2Display}{product.declared_unit ? ` / ${product.declared_unit}` : ''}
                    </p>
                  </Link>
                );
              })}

              {/* "View all" card at the end */}
              <Link
                href="/products"
                className="min-w-[140px] flex-shrink-0 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 p-3 flex flex-col items-center justify-center text-muted-foreground hover:text-foreground hover:border-slate-300 dark:hover:border-slate-700 transition-colors"
              >
                <ArrowRight className="h-5 w-5 mb-2" />
                <span className="text-sm font-medium">View all</span>
              </Link>
            </div>
          )}
        </CardContent>
      </Card>}

      {/* ── BOTTOM ROW — Recent Activity ──────────────────────────── */}
      {!isAnyDataLoading && (
        <InlineErrorBoundary>
          <RecentActivityWidget />
        </InlineErrorBoundary>
      )}
    </div>
  );
}
