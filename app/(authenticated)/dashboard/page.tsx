'use client';

import { useEffect, useState, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/organizationContext';
import { useDashboardPreferences } from '@/hooks/data/useDashboardPreferences';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useWasteMetrics } from '@/hooks/data/useWasteMetrics';
import { useSupplierEngagement } from '@/hooks/data/useSupplierEngagement';
import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { useFacilityWaterData } from '@/hooks/data/useFacilityWaterData';
import { useVitalityBenchmarks } from '@/hooks/data/useVitalityBenchmarks';
import type { NatureMetrics } from '@/hooks/data/useCompanyMetrics';
import { DashboardCustomiseModal } from '@/components/dashboard/DashboardCustomiseModal';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import {
  Settings2,
  RefreshCw,
  Upload,
  ArrowRight,
  Download,
  Factory,
  Package,
  ClipboardList,
} from 'lucide-react';
import Link from 'next/link';

import { VitalityScoreHero, calculateVitalityScores } from '@/components/vitality/VitalityScoreHero';
import { getBenchmarkForOrganisation } from '@/lib/industry-benchmarks';
import { fetchProducts } from '@/lib/products';
import { RAGStatusCard, RAGStatusCardGrid } from '@/components/dashboard/RAGStatusCard';
import { PriorityActionsList, generatePriorityActions } from '@/components/dashboard/PriorityActionCard';

import {
  QuickActionsWidget,
  GHGEmissionsSummaryWidget,
  SupplierEngagementWidget,
  RecentActivityWidget,
  DataQualityWidget,
  ProductLCAStatusWidget,
  GettingStartedWidget,
  WaterRiskWidget,
  ComplianceStatusWidget,
} from '@/components/dashboard/widgets';

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-48" />
        </div>
        <Skeleton className="h-9 w-28" />
      </div>
      <Skeleton className="h-64 w-full rounded-2xl" />
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
        <Skeleton className="h-36 rounded-xl" />
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <Skeleton className="h-80 rounded-xl lg:col-span-2" />
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

function EmptyDashboard({ onRefetch }: { onRefetch: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Settings2 className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Widgets Enabled</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        You have hidden all dashboard widgets. Click customise to enable the widgets you want to see.
      </p>
      <DashboardCustomiseModal onPreferencesChanged={onRefetch}>
        <Button>
          <Settings2 className="h-4 w-4 mr-2" />
          Customise Dashboard
        </Button>
      </DashboardCustomiseModal>
    </div>
  );
}

function deriveBiodiversityRisk(natureMetrics: NatureMetrics | null): 'high' | 'medium' | 'low' | undefined {
  if (!natureMetrics) return undefined;
  const landUse = natureMetrics.land_use || 0;
  const ecotoxicity = natureMetrics.terrestrial_ecotoxicity || 0;
  const impactScore = landUse + ecotoxicity;
  if (impactScore > 1000) return 'high';
  if (impactScore > 100) return 'medium';
  return 'low';
}

function getStatusFromScore(score: number | null): 'good' | 'warning' | 'critical' | 'neutral' {
  if (score === null) return 'neutral';
  if (score >= 70) return 'good';
  if (score >= 50) return 'warning';
  return 'critical';
}

const AVAILABLE_YEARS = [2026, 2025, 2024, 2023];

export default function DashboardPage() {
  const router = useRouter();
  const { currentOrganization } = useOrganization();
  const { enabledWidgets, loading: prefsLoading, error: prefsError, refetch } = useDashboardPreferences();
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const { footprint, loading: footprintLoading } = useCompanyFootprint(selectedYear);
  const { footprint: previousYearFootprint } = useCompanyFootprint(selectedYear - 1);
  const { metrics: wasteMetrics, loading: wasteLoading } = useWasteMetrics(selectedYear);
  const { data: supplierData, isLoading: supplierLoading } = useSupplierEngagement();
  const companyMetricsResult = useCompanyMetrics(selectedYear);
  const { metrics: companyMetrics, natureMetrics, loading: metricsLoading } = companyMetricsResult;
  const { companyOverview: waterCompanyOverview } = useFacilityWaterData(selectedYear);
  const { getBenchmarkForPillar } = useVitalityBenchmarks();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);

  // Fetch product categories for industry benchmark lookup
  const [productCategories, setProductCategories] = useState<(string | null)[]>([]);
  useEffect(() => {
    if (!currentOrganization?.id) return;
    fetchProducts(currentOrganization.id).then(products => {
      setProductCategories(products.map(p => p.product_category ?? null));
    }).catch(() => {});
  }, [currentOrganization?.id]);

  const { benchmark: industryBenchmarkData, dominantCategory } = useMemo(
    () => getBenchmarkForOrganisation(productCategories),
    [productCategories]
  );

  const isLoading = prefsLoading || footprintLoading || wasteLoading || supplierLoading || metricsLoading;

  const waterConsumption = useMemo(() => {
    // Use facility scarcity-weighted water as primary source (consistent with Company Vitality)
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

  // Estimate total industry benchmark from category-specific per-litre data.
  // Assumes ~50,000 litres production volume per product assessed (calibration constant).
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

  // Keep scores object for RAG status cards
  const scores = useMemo(() => ({
    climateScore: vitalityScores.climate,
    waterScore: vitalityScores.water,
    circularityScore: vitalityScores.circularity,
    natureScore: vitalityScores.nature,
  }), [vitalityScores]);

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
    if (!footprint?.breakdown) return { scope1: 0, scope2: 0, scope3: 0 };
    const total = footprint.total_emissions || 1;
    return {
      scope1Pct: ((footprint.breakdown.scope1 || 0) / total) * 100,
      scope2Pct: ((footprint.breakdown.scope2 || 0) / total) * 100,
      scope3Pct: ((footprint.breakdown.scope3?.total || 0) / total) * 100,
    };
  }, [footprint]);

  const priorityActions = useMemo(() => {
    let supplierEngagementRate: number | undefined;
    if (supplierData && supplierData.length > 0) {
      const total = supplierData[0]?.total_suppliers || 1;
      const activeEntry = supplierData.find(s => s.status === 'active');
      const engaged = activeEntry?.supplier_count || 0;
      supplierEngagementRate = (engaged / total) * 100;
    }
    return generatePriorityActions({
      scope1Percentage: scopeBreakdown.scope1Pct,
      scope2Percentage: scopeBreakdown.scope2Pct,
      scope3Percentage: scopeBreakdown.scope3Pct,
      circularityRate: wasteMetrics?.waste_diversion_rate,
      supplierEngagementRate,
    });
  }, [scopeBreakdown, wasteMetrics, supplierData]);

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


  useEffect(() => {
    setLastUpdated(new Date());
  }, [enabledWidgets]);

  const handleRefresh = () => {
    refetch();
    setRefreshKey(prev => prev + 1);
    setLastUpdated(new Date());
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <DashboardSkeleton />
      </div>
    );
  }

  if (prefsError) {
    return (
      <div className="p-6">
        <div className="bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800 rounded-xl p-6 text-center">
          <p className="text-red-600 dark:text-red-400 mb-4">{prefsError}</p>
          <Button variant="outline" onClick={handleRefresh}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Try Again
          </Button>
        </div>
      </div>
    );
  }

  // Check if widget is enabled
  const isWidgetEnabled = (widgetId: string) => {
    return enabledWidgets.some(w => w.widget_id === widgetId);
  };

  // Show empty state if no widgets enabled
  if (enabledWidgets.length === 0) {
    return (
      <div className="p-6">
        <EmptyDashboard onRefetch={refetch} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-heading font-bold tracking-tight">
            Sustainability Overview
          </h1>
          <p className="text-sm text-muted-foreground">
            Welcome back! Here&apos;s how {currentOrganization?.name || 'your organization'} is performing.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(parseInt(e.target.value))}
            className="px-3 py-2 text-sm font-medium rounded-md border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-emerald-500"
          >
            {AVAILABLE_YEARS.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <Button
            variant="outline"
            onClick={() => router.push('/reports')}
            className="gap-2"
          >
            <Download className="h-4 w-4" />
            Export Report
          </Button>
          <Button
            onClick={() => router.push('/products/import')}
            className="gap-2 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 text-white"
          >
            <Upload className="h-4 w-4" />
            Import Products
          </Button>
          <Button variant="ghost" size="icon" onClick={handleRefresh} title="Refresh dashboard">
            <RefreshCw className="h-4 w-4" />
          </Button>
          <DashboardCustomiseModal onPreferencesChanged={refetch} />
        </div>
      </div>

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
        loading={isLoading}
        calculationInputs={scoreCalculationInputs}
      />

      <RAGStatusCardGrid>
        <RAGStatusCard
          title="Carbon Emissions"
          status={getStatusFromScore(scores.climateScore)}
          value={footprint?.total_emissions ? (footprint.total_emissions / 1000).toFixed(1) : '--'}
          unit="tCO₂e"
          trend={carbonTrend.value}
          trendDirection={carbonTrend.direction}
          category="climate"
          href="/reports/company-footprint"
        />
        <RAGStatusCard
          title="Water Impact"
          status={getStatusFromScore(scores.waterScore)}
          value={waterConsumption > 0
            ? (waterConsumption >= 1000
              ? `${(waterConsumption / 1000).toFixed(1)}k`
              : waterConsumption.toFixed(0))
            : '--'}
          unit="m³"
          category="water"
          href="/performance"
        />
        <RAGStatusCard
          title="Waste Diversion"
          status={getStatusFromScore(scores.circularityScore)}
          value={wasteMetrics?.waste_diversion_rate?.toFixed(0) || '0'}
          unit="%"
          trend={wasteMetrics?.waste_diversion_rate && wasteMetrics.waste_diversion_rate > 50 ? 5 : undefined}
          trendDirection={wasteMetrics?.waste_diversion_rate && wasteMetrics.waste_diversion_rate > 50 ? 'up' : 'stable'}
          category="waste"
          href="/performance"
        />
        <RAGStatusCard
          title="Nature & Biodiversity"
          status={getStatusFromScore(scores.natureScore)}
          value={landUse > 0 ? landUse.toFixed(0) : '--'}
          unit="m² crop eq"
          category="suppliers"
          href="/performance"
        />
      </RAGStatusCardGrid>

      {/* Getting Started - Full Width when enabled */}
      {isWidgetEnabled('getting-started') && (
        <div className="grid gap-4 md:grid-cols-3">
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-blue-500/20">
                  <Factory className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Step 1</p>
                  <h3 className="text-sm font-semibold">Define Operations</h3>
                  <p className="text-xs text-muted-foreground mt-1">Add your facilities and utility meters</p>
                  <Button asChild size="sm" className="mt-2 h-8 bg-neon-lime text-black hover:bg-neon-lime/90">
                    <Link href="/company/facilities">
                      Get Started <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-purple-500/20">
                  <Package className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Step 2</p>
                  <h3 className="text-sm font-semibold">Build Products</h3>
                  <p className="text-xs text-muted-foreground mt-1">Create recipes using supplier data</p>
                  <Button asChild size="sm" className="mt-2 h-8 bg-neon-lime text-black hover:bg-neon-lime/90">
                    <Link href="/products">
                      Get Started <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card className="md:col-span-1">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-500/20">
                  <ClipboardList className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium text-muted-foreground">Step 3</p>
                  <h3 className="text-sm font-semibold">Log Production</h3>
                  <p className="text-xs text-muted-foreground mt-1">Track volumes to allocate impact</p>
                  <Button asChild size="sm" className="mt-2 h-8 bg-neon-lime text-black hover:bg-neon-lime/90">
                    <Link href="/company/facilities">
                      Get Started <ArrowRight className="ml-1 h-3 w-3" />
                    </Link>
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Main Content Grid - Responsive layout based on enabled widgets */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Primary Content Area */}
        <div className="lg:col-span-8 space-y-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-lg flex items-center justify-between">
                <span className="flex items-center gap-2">
                  Priority Actions
                  {priorityActions.filter(a => a.priority === 'high').length > 0 && (
                    <span className="text-xs px-2 py-0.5 bg-red-500/20 text-red-500 dark:text-red-400 rounded-full font-medium">
                      {priorityActions.filter(a => a.priority === 'high').length} urgent
                    </span>
                  )}
                </span>
                <span className="text-sm font-normal text-muted-foreground">
                  {priorityActions.length} action{priorityActions.length !== 1 ? 's' : ''}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <PriorityActionsList
                actions={priorityActions}
                maxVisible={4}
              />
            </CardContent>
          </Card>

          <Accordion type="single" collapsible className="space-y-2">
            {isWidgetEnabled('ghg-summary') && (
              <AccordionItem value="emissions" className="border rounded-xl overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
                  <span className="flex items-center gap-2 flex-1">
                    <span className="text-lg">📊</span>
                    <span>Emissions Breakdown</span>
                    <span className="ml-auto mr-2 text-xs text-muted-foreground font-normal">
                      {footprint?.total_emissions
                        ? `${(footprint.total_emissions / 1000).toFixed(1)} tCO₂e total`
                        : 'No data yet'}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <GHGEmissionsSummaryWidget
                    footprint={footprint}
                    isLoading={footprintLoading}
                  />
                </AccordionContent>
              </AccordionItem>
            )}

            {isWidgetEnabled('product-lca-status') && (
              <AccordionItem value="products" className="border rounded-xl overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
                  <span className="flex items-center gap-2 flex-1">
                    <span className="text-lg">📦</span>
                    <span>Product Environmental Impact Status</span>
                    <span className="ml-auto mr-2 text-xs text-muted-foreground font-normal">
                      View details
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ProductLCAStatusWidget />
                </AccordionContent>
              </AccordionItem>
            )}

            {isWidgetEnabled('data-quality') && (
              <AccordionItem value="quality" className="border rounded-xl overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
                  <span className="flex items-center gap-2 flex-1">
                    <span className="text-lg">📈</span>
                    <span>Data Quality</span>
                    <span className="ml-auto mr-2 text-xs text-muted-foreground font-normal">
                      {scores.climateScore !== null || scores.waterScore !== null
                        ? 'Active'
                        : 'Needs setup'}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <DataQualityWidget />
                </AccordionContent>
              </AccordionItem>
            )}

            {isWidgetEnabled('compliance-status') && (
              <AccordionItem value="compliance" className="border rounded-xl overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
                  <span className="flex items-center gap-2 flex-1">
                    <span className="text-lg">✅</span>
                    <span>Compliance Status</span>
                    <span className="ml-auto mr-2 text-xs text-muted-foreground font-normal">
                      View requirements
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent className="px-4 pb-4">
                  <ComplianceStatusWidget />
                </AccordionContent>
              </AccordionItem>
            )}
          </Accordion>
        </div>

        {/* Secondary Content Area - Sidebar Widgets */}
        <div className="lg:col-span-4 space-y-6">
          {isWidgetEnabled('quick-actions') && <QuickActionsWidget />}
          {isWidgetEnabled('supplier-engagement') && <SupplierEngagementWidget />}
          {isWidgetEnabled('recent-activity') && <RecentActivityWidget />}
          {isWidgetEnabled('water-risk') && <WaterRiskWidget />}
        </div>
      </div>
    </div>
  );
}

