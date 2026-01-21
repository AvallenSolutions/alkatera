'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useOrganization } from '@/lib/organizationContext';
import { useDashboardPreferences } from '@/hooks/data/useDashboardPreferences';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useWasteMetrics } from '@/hooks/data/useWasteMetrics';
import { useSupplierEngagement } from '@/hooks/data/useSupplierEngagement';
import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
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
  ChevronRight,
  ArrowRight,
  Download,
  Leaf,
  Droplets,
  Recycle,
  Link2,
  CheckCircle2,
  TrendingUp,
  TrendingDown,
  Plus,
  Clock,
} from 'lucide-react';
import Link from 'next/link';

import { VitalityRing } from '@/components/vitality/VitalityRing';
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

function EmptyDashboard() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="h-16 w-16 rounded-2xl bg-slate-100 dark:bg-slate-800 flex items-center justify-center mb-4">
        <Settings2 className="h-8 w-8 text-slate-400" />
      </div>
      <h3 className="text-lg font-semibold mb-2">No Widgets Enabled</h3>
      <p className="text-sm text-muted-foreground mb-4 max-w-md">
        You have hidden all dashboard widgets. Click customise to enable the widgets you want to see.
      </p>
      <DashboardCustomiseModal>
        <Button>
          <Settings2 className="h-4 w-4 mr-2" />
          Customise Dashboard
        </Button>
      </DashboardCustomiseModal>
    </div>
  );
}

function getVitalityScore(data: {
  climateScore: number | null;
  waterScore: number | null;
  circularityScore: number | null;
  supplierScore: number | null;
}): number | null {
  const validScores = [
    data.climateScore,
    data.waterScore,
    data.circularityScore,
    data.supplierScore,
  ].filter((s): s is number => s !== null);

  if (validScores.length === 0) return null;

  // Calculate weighted average only for available scores
  let total = 0;
  let weightSum = 0;

  if (data.climateScore !== null) { total += data.climateScore * 0.35; weightSum += 0.35; }
  if (data.waterScore !== null) { total += data.waterScore * 0.25; weightSum += 0.25; }
  if (data.circularityScore !== null) { total += data.circularityScore * 0.25; weightSum += 0.25; }
  if (data.supplierScore !== null) { total += data.supplierScore * 0.15; weightSum += 0.15; }

  return Math.round(total / weightSum);
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
  const { metrics: companyMetrics, loading: metricsLoading } = useCompanyMetrics();

  const [lastUpdated, setLastUpdated] = useState<Date>(new Date());
  const [refreshKey, setRefreshKey] = useState(0);
  const [showLegacyWidgets, setShowLegacyWidgets] = useState(false);
  const [historicalScores, setHistoricalScores] = useState<number[]>([]);

  const isLoading = prefsLoading || footprintLoading || wasteLoading || supplierLoading || metricsLoading;

  const waterConsumption = useMemo(() => {
    return companyMetrics?.total_impacts?.water_consumption || 0;
  }, [companyMetrics]);

  const scores = useMemo(() => {
    // Climate: null if no emissions data
    let climateScore: number | null = null;
    if (footprint?.total_emissions) {
      const emissionsKg = footprint.total_emissions;
      if (emissionsKg < 10000) climateScore = 85;
      else if (emissionsKg < 50000) climateScore = 70;
      else if (emissionsKg < 100000) climateScore = 55;
      else climateScore = 35;
    }

    // Water: null if no water data, calculated from actual consumption and scarcity
    let waterScore: number | null = null;
    if (companyMetrics?.total_impacts) {
      const waterConsumptionTotal = companyMetrics.total_impacts.water_consumption || 0;
      const waterScarcityAware = companyMetrics.total_impacts.water_scarcity_aware || 0;

      if (waterConsumptionTotal > 0) {
        // Calculate average scarcity factor (AWARE methodology)
        const avgScarcityFactor = waterScarcityAware / waterConsumptionTotal;

        // Score based on scarcity-weighted consumption (lower is better)
        // AWARE factors: <10 = low stress, 10-20 = medium-low, 20-40 = medium-high, >40 = high stress
        // Convert to 0-100 score (100 = best, 0 = worst)
        if (avgScarcityFactor <= 10) {
          waterScore = Math.max(75, Math.round(100 - avgScarcityFactor));
        } else if (avgScarcityFactor <= 20) {
          waterScore = Math.max(60, Math.round(90 - avgScarcityFactor));
        } else if (avgScarcityFactor <= 40) {
          waterScore = Math.max(40, Math.round(80 - avgScarcityFactor));
        } else {
          waterScore = Math.max(20, Math.round(60 - Math.min(avgScarcityFactor, 50)));
        }
      }
    }

    // Circularity: null if no waste data (check total_waste_kg > 0 to confirm actual data exists)
    let circularityScore: number | null = null;
    if (wasteMetrics?.total_waste_kg && wasteMetrics.total_waste_kg > 0) {
      const rate = wasteMetrics.waste_diversion_rate ?? 0;
      if (rate >= 80) circularityScore = 90;
      else if (rate >= 60) circularityScore = 75;
      else if (rate >= 40) circularityScore = 55;
      else circularityScore = 35;
    }

    // Supplier: null if no supplier data
    let supplierScore: number | null = null;
    if (supplierData && supplierData.length > 0) {
      const total = supplierData[0]?.total_suppliers || 0;
      if (total > 0) {
        const activeEntry = supplierData.find(s => s.status === 'active');
        const engaged = activeEntry?.supplier_count || 0;
        const engagementRate = (engaged / total) * 100;
        if (engagementRate >= 70) supplierScore = 85;
        else if (engagementRate >= 50) supplierScore = 70;
        else if (engagementRate >= 30) supplierScore = 50;
        else supplierScore = 30;
      }
    }

    return { climateScore, waterScore, circularityScore, supplierScore };
  }, [footprint, wasteMetrics, supplierData, companyMetrics, waterConsumption]);

  const vitalityScore = getVitalityScore(scores);

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

  const hasTrendData = useMemo(() => {
    return previousYearFootprint?.has_data === true;
  }, [previousYearFootprint]);

  const supplierEngagementPct = useMemo(() => {
    if (!supplierData || supplierData.length === 0) return 0;
    const total = supplierData[0]?.total_suppliers || 1;
    const activeEntry = supplierData.find(s => s.status === 'active');
    const engaged = activeEntry?.supplier_count || 0;
    return Math.round((engaged / total) * 100);
  }, [supplierData]);

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
        <EmptyDashboard />
      </div>
    );
  }

  const vitalityLabel = vitalityScore === null ? 'NO DATA' :
                        vitalityScore >= 75 ? 'HEALTHY' :
                        vitalityScore >= 50 ? 'DEVELOPING' : 'NEEDS ATTENTION';

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
          <DashboardCustomiseModal />
        </div>
      </div>

      <Card className="overflow-hidden bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 border-slate-700/50">
        <div className="relative">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute -top-24 -right-24 w-72 h-72 bg-emerald-500/10 rounded-full blur-3xl" />
            <div className="absolute -bottom-24 -left-24 w-72 h-72 bg-blue-500/10 rounded-full blur-3xl" />
          </div>

          <CardContent className="relative z-10 p-6 lg:p-8">
            <div className="flex flex-col lg:flex-row items-center gap-8">
              <div className="flex flex-col items-center">
                <p className="text-sm text-white/60 mb-2">Sustainability Score</p>
                <VitalityRing
                  score={vitalityScore}
                  size="xl"
                  label={vitalityLabel}
                  className="text-white"
                />
                <div className="mt-4 flex flex-col items-center">
                  {hasTrendData ? (
                    <>
                      <span className="text-xs text-white/50 mb-1">vs. last year</span>
                      <div className="flex items-center gap-1 text-sm">
                        {carbonTrend.direction === 'down' ? (
                          <span className="text-green-400">↓ {carbonTrend.value}%</span>
                        ) : carbonTrend.direction === 'up' ? (
                          <span className="text-red-400">↑ {carbonTrend.value}%</span>
                        ) : (
                          <span className="text-white/60">No change</span>
                        )}
                      </div>
                    </>
                  ) : (
                    <span className="text-xs text-white/40 text-center">
                      Add more data to track trends
                    </span>
                  )}
                </div>
              </div>

              <div className="flex-1 w-full">
                <div className="mb-4">
                  <h2 className="text-lg font-semibold text-white mb-1">Company Vitality</h2>
                  <p className="text-sm text-white/60">
                    {vitalityScore === null
                      ? 'Add products, facilities, or supplier data to calculate your sustainability score.'
                      : vitalityScore >= 75
                        ? 'Your organisation is performing well across sustainability pillars.'
                        : vitalityScore >= 50
                          ? 'Good progress with opportunities for improvement.'
                          : 'Significant opportunities to improve sustainability performance.'}
                  </p>
                </div>

                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                  <MiniScoreCard title="Climate" score={scores.climateScore} />
                  <MiniScoreCard title="Water" score={scores.waterScore} />
                  <MiniScoreCard title="Circularity" score={scores.circularityScore} />
                  <MiniScoreCard title="Supply Chain" score={scores.supplierScore} />
                </div>

                <div className="mt-4 flex items-center gap-3">
                  <Link href="/performance" className="text-sm text-white/70 hover:text-white flex items-center gap-1">
                    View detailed performance
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </div>
      </Card>

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
          value={waterConsumption > 0 ? waterConsumption.toFixed(0) : '--'}
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
          title="Supplier Engagement"
          status={getStatusFromScore(scores.supplierScore)}
          value={supplierEngagementPct}
          unit="%"
          category="suppliers"
          href="/suppliers"
        />
      </RAGStatusCardGrid>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
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
                  <GHGEmissionsSummaryWidget />
                </AccordionContent>
              </AccordionItem>
            )}

            {isWidgetEnabled('product-lca-status') && (
              <AccordionItem value="products" className="border rounded-xl overflow-hidden">
                <AccordionTrigger className="px-4 py-3 hover:no-underline hover:bg-muted/50 [&>svg]:ml-auto">
                  <span className="flex items-center gap-2 flex-1">
                    <span className="text-lg">📦</span>
                    <span>Product LCA Status</span>
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

        <div className="space-y-6">
          {isWidgetEnabled('quick-actions') && <QuickActionsWidget />}
          {isWidgetEnabled('recent-activity') && <RecentActivityWidget />}
          {isWidgetEnabled('getting-started') && <GettingStartedWidget />}
          {isWidgetEnabled('supplier-engagement') && <SupplierEngagementWidget />}
          {isWidgetEnabled('water-risk') && <WaterRiskWidget />}
        </div>
      </div>
    </div>
  );
}

// Pillar configuration with colors
const pillarConfig = {
  Climate: {
    icon: Leaf,
    colorClass: 'blue',
    bgColor: 'bg-blue-500/20',
    textColor: 'text-blue-400',
    borderColor: 'border-blue-500/30',
    href: '/reports/company-footprint',
    ctaText: 'Add emissions data',
  },
  Water: {
    icon: Droplets,
    colorClass: 'cyan',
    bgColor: 'bg-cyan-500/20',
    textColor: 'text-cyan-400',
    borderColor: 'border-cyan-500/30',
    href: '/company/facilities',
    ctaText: 'Add water data',
  },
  Circularity: {
    icon: Recycle,
    colorClass: 'purple',
    bgColor: 'bg-purple-500/20',
    textColor: 'text-purple-400',
    borderColor: 'border-purple-500/30',
    href: '/company/facilities',
    ctaText: 'Add waste data',
  },
  'Supply Chain': {
    icon: Link2,
    colorClass: 'orange',
    bgColor: 'bg-orange-500/20',
    textColor: 'text-orange-400',
    borderColor: 'border-orange-500/30',
    href: '/suppliers',
    ctaText: 'Add suppliers',
  },
};

interface MiniScoreCardProps {
  title: keyof typeof pillarConfig;
  score: number | null;
  trend?: number;
}

function MiniScoreCard({ title, score, trend }: MiniScoreCardProps) {
  const config = pillarConfig[title];
  const Icon = config.icon;

  // Empty state - needs setup
  if (score === null) {
    return (
      <Link href={config.href}>
        <div className={`p-3 rounded-xl bg-slate-800/50 border border-slate-700/50 hover:${config.borderColor} transition-colors group cursor-pointer`}>
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <div className={`w-7 h-7 rounded-lg ${config.bgColor} flex items-center justify-center`}>
                <Icon className={`w-3.5 h-3.5 ${config.textColor}`} />
              </div>
              <span className="text-sm font-medium text-white/90">{title}</span>
            </div>
            <span className="text-xs px-2 py-0.5 bg-slate-700 text-slate-300 rounded-full">Setup</span>
          </div>
          <div className={`flex items-center gap-1.5 text-xs text-slate-400 group-hover:${config.textColor} transition-colors`}>
            <Plus className="w-3 h-3" />
            <span>{config.ctaText}</span>
          </div>
        </div>
      </Link>
    );
  }

  // Active state with data
  const scoreColorClass = score >= 70 ? 'text-green-400' :
                          score >= 50 ? 'text-amber-400' : 'text-red-400';

  return (
    <Link href={config.href}>
      <div className={`p-3 rounded-xl bg-slate-800/50 border ${config.borderColor} hover:bg-slate-800/70 transition-colors cursor-pointer`}>
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-lg ${config.bgColor} flex items-center justify-center`}>
              <Icon className={`w-3.5 h-3.5 ${config.textColor}`} />
            </div>
            <span className="text-sm font-medium text-white/90">{title}</span>
          </div>
          <span className={`text-xs px-2 py-0.5 ${config.bgColor} ${config.textColor} rounded-full flex items-center gap-1`}>
            <CheckCircle2 className="w-3 h-3" /> Active
          </span>
        </div>
        <div className="flex items-baseline gap-2">
          <span className={`text-xl font-bold ${scoreColorClass}`}>{score}</span>
          <span className="text-slate-400 text-xs">/100</span>
          {trend !== undefined && trend !== 0 && (
            <span className={`ml-auto flex items-center gap-0.5 text-xs ${trend > 0 ? 'text-green-400' : 'text-red-400'}`}>
              {trend > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {trend > 0 ? '+' : ''}{trend}%
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
