"use client";

import React, { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Sparkles,
  RefreshCw,
  Calendar,
  TrendingUp,
  Leaf,
  Droplets,
  Trash2,
  Mountain,
  Factory,
  AlertTriangle,
  CheckCircle2,
  ArrowRight,
  Target,
  Award,
  Activity,
  Truck,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import Link from 'next/link';

import { useCompanyMetrics, CompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useWasteMetrics } from '@/hooks/data/useWasteMetrics';
import { useOrganization } from '@/lib/organizationContext';
import type {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

import { VitalityScoreHero, calculateVitalityScores } from '@/components/vitality/VitalityScoreHero';
import { PillarCard, PillarGrid, PerformanceSummary } from '@/components/vitality/PillarCard';
import { CarbonDeepDive } from '@/components/vitality/CarbonDeepDive';
import { WaterDeepDive } from '@/components/vitality/WaterDeepDive';
import { WasteDeepDive } from '@/components/vitality/WasteDeepDive';
import { NatureDeepDive } from '@/components/vitality/NatureDeepDive';
import { AICopilotModal } from '@/components/vitality/AICopilotModal';
import { CarbonBreakdownSheet } from '@/components/vitality/CarbonBreakdownSheet';
import { WaterImpactSheet } from '@/components/vitality/WaterImpactSheet';
import { CircularitySheet } from '@/components/vitality/CircularitySheet';
import { NatureImpactSheet } from '@/components/vitality/NatureImpactSheet';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible';
import type { NatureMetrics } from '@/hooks/data/useCompanyMetrics';

function deriveBiodiversityRisk(natureMetrics: NatureMetrics | null): 'high' | 'medium' | 'low' | undefined {
  if (!natureMetrics) return undefined;
  const landUse = natureMetrics.land_use || 0;
  const ecotoxicity = natureMetrics.terrestrial_ecotoxicity || 0;
  const impactScore = landUse + ecotoxicity;
  if (impactScore > 1000) return 'high';
  if (impactScore > 100) return 'medium';
  return 'low';
}

interface ScopeBreakdown {
  scope1: number;
  scope2: number;
  scope3: number;
}

const SCOPE3_CATEGORY_DEFINITIONS = [
  { category: 1, name: 'Purchased Goods & Services', description: 'Upstream emissions from purchased goods and services' },
  { category: 2, name: 'Capital Goods', description: 'Upstream emissions from capital goods' },
  { category: 3, name: 'Fuel & Energy Related Activities', description: 'Not included in Scope 1 or 2' },
  { category: 4, name: 'Upstream Transportation', description: 'Transportation of purchased goods' },
  { category: 5, name: 'Waste Generated in Operations', description: 'Disposal of waste generated' },
  { category: 6, name: 'Business Travel', description: 'Employee business travel' },
  { category: 7, name: 'Employee Commuting', description: 'Employee travel to work' },
  { category: 8, name: 'Upstream Leased Assets', description: 'Emissions from leased assets' },
  { category: 9, name: 'Downstream Transportation', description: 'Transportation of sold products' },
  { category: 10, name: 'Processing of Sold Products', description: 'Processing by third parties' },
  { category: 11, name: 'Use of Sold Products', description: 'End use of products' },
  { category: 12, name: 'End-of-Life Treatment', description: 'Disposal of sold products' },
  { category: 13, name: 'Downstream Leased Assets', description: 'Emissions from leased assets' },
  { category: 14, name: 'Franchises', description: 'Emissions from franchises' },
  { category: 15, name: 'Investments', description: 'Emissions from investments' },
];

function transformFootprintToScope3Categories(
  footprintData: any
): {
  categories: Scope3CategoryData[];
  productDetails: ProductEmissionDetail[];
  travelDetails: BusinessTravelDetail[];
  logisticsDetails: LogisticsDetail[];
  wasteDetails: WasteDetail[];
  totalScope3: number;
} {
  if (!footprintData?.breakdown?.scope3) {
    return {
      categories: [],
      productDetails: [],
      travelDetails: [],
      logisticsDetails: [],
      wasteDetails: [],
      totalScope3: 0,
    };
  }

  const scope3Data = footprintData.breakdown.scope3;

  const categoryMapping: Record<number, { value: number; dataQuality: 'primary' | 'secondary' | 'estimated' | 'missing' }> = {
    1: { value: scope3Data.products || 0, dataQuality: scope3Data.products > 0 ? 'primary' : 'missing' },
    2: { value: scope3Data.capital_goods || 0, dataQuality: scope3Data.capital_goods > 0 ? 'secondary' : 'missing' },
    3: { value: 0, dataQuality: 'missing' },
    4: { value: 0, dataQuality: 'missing' },
    5: { value: scope3Data.waste || 0, dataQuality: scope3Data.waste > 0 ? 'secondary' : 'missing' },
    6: { value: scope3Data.business_travel || 0, dataQuality: scope3Data.business_travel > 0 ? 'primary' : 'missing' },
    7: { value: scope3Data.employee_commuting || 0, dataQuality: scope3Data.employee_commuting > 0 ? 'secondary' : 'missing' },
    8: { value: 0, dataQuality: 'missing' },
    9: { value: scope3Data.logistics || 0, dataQuality: scope3Data.logistics > 0 ? 'secondary' : 'missing' },
    10: { value: 0, dataQuality: 'missing' },
    11: { value: 0, dataQuality: 'missing' },
    12: { value: 0, dataQuality: 'missing' },
    13: { value: 0, dataQuality: 'missing' },
    14: { value: 0, dataQuality: 'missing' },
    15: { value: 0, dataQuality: 'missing' },
  };

  const categories: Scope3CategoryData[] = SCOPE3_CATEGORY_DEFINITIONS.map(def => {
    const mapping = categoryMapping[def.category];
    return {
      category: def.category,
      name: def.name,
      description: def.description,
      totalEmissions: mapping.value,
      entryCount: mapping.value > 0 ? 1 : 0,
      dataQuality: mapping.dataQuality,
      entries: [],
    };
  });

  return {
    categories,
    productDetails: [],
    travelDetails: [],
    logisticsDetails: [],
    wasteDetails: [],
    totalScope3: scope3Data.total || 0,
  };
}

function generateStrengthsAndImprovements(
  metrics: CompanyMetrics | null,
  scopeBreakdown: ScopeBreakdown | null,
  circularityRate: number,
  waterRiskLevel: string | undefined
) {
  const strengths: Array<{ text: string }> = [];
  const improvements: Array<{ text: string; priority?: 'high' | 'medium' }> = [];

  if (metrics?.total_products_assessed && metrics.total_products_assessed > 0) {
    strengths.push({ text: `${metrics.total_products_assessed} products with complete LCA assessments` });
  }

  if (circularityRate >= 60) {
    strengths.push({ text: `Strong circularity rate at ${circularityRate.toFixed(0)}%` });
  } else if (circularityRate < 40) {
    improvements.push({ text: `Circularity rate at ${circularityRate.toFixed(0)}% - target 60%+`, priority: 'high' });
  }

  if (waterRiskLevel === 'low') {
    strengths.push({ text: 'Low water scarcity risk across operations' });
  } else if (waterRiskLevel === 'high') {
    improvements.push({ text: 'High water scarcity risk in some facilities', priority: 'high' });
  }

  if (scopeBreakdown) {
    const total = scopeBreakdown.scope1 + scopeBreakdown.scope2 + scopeBreakdown.scope3;
    const scope2Pct = total > 0 ? (scopeBreakdown.scope2 / total) * 100 : 0;
    if (scope2Pct < 10) {
      strengths.push({ text: 'Low Scope 2 emissions - efficient energy use' });
    } else if (scope2Pct > 30) {
      improvements.push({ text: 'Switch to renewable electricity to reduce Scope 2', priority: 'medium' });
    }
  }

  if (metrics?.csrd_compliant_percentage && metrics.csrd_compliant_percentage >= 80) {
    strengths.push({ text: `${metrics.csrd_compliant_percentage}% CSRD reporting readiness` });
  }

  if (improvements.length === 0) {
    improvements.push({ text: 'Continue monitoring and improving data quality' });
  }

  return { strengths, improvements };
}

export default function PerformancePage() {
  const currentYear = new Date().getFullYear();
  const { currentOrganization } = useOrganization();
  const hookResult = useCompanyMetrics();
  const { footprint: footprintData, loading: footprintLoading } = useCompanyFootprint(currentYear);
  const { metrics: wasteMetrics, loading: wasteLoading } = useWasteMetrics(currentYear);

  const {
    categories: scope3Categories,
    productDetails: scope3ProductDetails,
    travelDetails: scope3TravelDetails,
    logisticsDetails: scope3LogisticsDetails,
    wasteDetails: scope3WasteDetails,
    totalScope3: scope3Total,
  } = transformFootprintToScope3Categories(footprintData);

  const {
    metrics,
    facilityWaterRisks,
    materialBreakdown,
    ghgBreakdown,
    lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    natureMetrics,
    loading,
    error,
    refetch,
  } = hookResult;

  const scopeBreakdown: ScopeBreakdown | null = footprintData?.breakdown ? {
    scope1: footprintData.breakdown.scope1,
    scope2: footprintData.breakdown.scope2,
    scope3: footprintData.breakdown.scope3.total,
  } : null;

  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [carbonSheetOpen, setCarbonSheetOpen] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [circularitySheetOpen, setCircularitySheetOpen] = useState(false);
  const [natureSheetOpen, setNatureSheetOpen] = useState(false);

  const [expandedPillar, setExpandedPillar] = useState<string | null>(null);
  const [showHotspots, setShowHotspots] = useState(false);
  const [showCompliance, setShowCompliance] = useState(false);

  const corporateTotalCO2 = footprintData?.total_emissions || 0;
  const productLcaTotalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;
  const totalCO2 = corporateTotalCO2 > 0 ? corporateTotalCO2 : productLcaTotalCO2;
  const waterConsumption = metrics?.total_impacts.water_consumption || 0;
  const waterScarcityImpact = metrics?.total_impacts.water_scarcity_aware || 0;
  const landUse = metrics?.total_impacts.land_use || 0;
  const circularityRate = metrics?.circularity_percentage || 0;

  const vitalityScores = useMemo(() => {
    const industryBenchmark = 50000;
    return calculateVitalityScores({
      totalEmissions: totalCO2,
      emissionsIntensity: totalCO2 / (metrics?.total_products_assessed || 1),
      industryBenchmark: industryBenchmark / (metrics?.total_products_assessed || 1),
      waterConsumption,
      waterRiskLevel: metrics?.water_risk_level as 'high' | 'medium' | 'low' | undefined,
      recyclingRate: wasteMetrics?.circularity_rate,
      circularityRate: circularityRate,
      landUseIntensity: landUse,
      biodiversityRisk: deriveBiodiversityRisk(natureMetrics),
    });
  }, [totalCO2, waterConsumption, metrics, wasteMetrics, circularityRate, landUse, natureMetrics]);

  const { strengths, improvements } = useMemo(() => {
    return generateStrengthsAndImprovements(
      metrics,
      scopeBreakdown,
      circularityRate,
      metrics?.water_risk_level
    );
  }, [metrics, scopeBreakdown, circularityRate]);

  const topMaterialHotspots = (materialBreakdown || [])
    .sort((a, b) => b.climate - a.climate)
    .slice(0, 5)
    .map(m => ({
      label: m.name,
      value: m.climate,
      percentage: totalCO2 > 0 ? (m.climate / totalCO2) * 100 : 0,
      severity: (m.climate / totalCO2) * 100 > 20 ? 'high' : (m.climate / totalCO2) * 100 > 10 ? 'medium' : 'low' as any,
    }));

  const waterSourceItems = useMemo(() => {
    if (!facilityWaterRisks || facilityWaterRisks.length === 0) {
      return [];
    }
    return facilityWaterRisks.map((facility, idx) => ({
      id: facility.facility_id || String(idx),
      source: facility.facility_name || `Facility ${idx + 1}`,
      location: facility.location_country_code || 'Unknown',
      consumption: facility.operational_water_intake_m3 || 0,
      riskFactor: facility.water_scarcity_aware || 0,
      riskLevel: facility.risk_level as 'high' | 'medium' | 'low',
      netImpact: facility.scarcity_weighted_consumption_m3 || 0,
    }));
  }, [facilityWaterRisks]);

  const totalWaterConsumption = waterSourceItems.reduce((sum, item) => sum + item.consumption, 0) || waterConsumption;
  const totalWaterImpact = waterSourceItems.reduce((sum, item) => sum + item.netImpact, 0) || waterScarcityImpact;
  const totalWaste = wasteMetrics?.total_waste_kg || 0;

  const landUseItems = useMemo(() => {
    if (!materialBreakdown || materialBreakdown.length === 0) {
      return [];
    }
    const totalLandFromMaterials = landUse || 1;
    return materialBreakdown.slice(0, 5).map((material, idx) => {
      const proportion = material.climate / (materialBreakdown.reduce((sum, m) => sum + m.climate, 0) || 1);
      return {
        id: String(idx + 1),
        ingredient: material.name,
        origin: material.source || 'Unknown',
        mass: material.quantity,
        landIntensity: landUse > 0 ? (proportion * totalLandFromMaterials) / (material.quantity || 1) : 0,
        totalFootprint: Math.round(proportion * totalLandFromMaterials),
      };
    });
  }, [materialBreakdown, landUse]);

  const totalLandUse = landUseItems.reduce((sum, item) => sum + item.totalFootprint, 0) || landUse;

  const formatValue = (value: number): string => {
    if (value >= 1000000) return `${(value / 1000000).toFixed(1)}M`;
    if (value >= 1000) return `${(value / 1000).toFixed(1)}k`;
    if (value < 0.1 && value > 0) return value.toExponential(1);
    return value.toFixed(value < 10 ? 1 : 0);
  };

  const togglePillar = (pillar: string) => {
    setExpandedPillar(expandedPillar === pillar ? null : pillar);
  };

  if (loading) {
    return (
      <div className="space-y-6 animate-fade-in-up">
        <Skeleton className="h-64 rounded-2xl" />
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Hero Section - Vitality Score */}
      <VitalityScoreHero
        overallScore={vitalityScores.overall}
        climateScore={vitalityScores.climate}
        waterScore={vitalityScores.water}
        circularityScore={vitalityScores.circularity}
        natureScore={vitalityScores.nature}
        lastUpdated={metrics?.last_updated
          ? new Date(metrics.last_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
          : undefined
        }
        onRefresh={refetch}
        loading={loading}
      />

      {/* Action Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Badge variant="outline" className="border-emerald-500 text-emerald-700">
            {currentYear} Data
          </Badge>
          {metrics?.total_products_assessed && metrics.total_products_assessed > 0 && (
            <span className="text-sm text-muted-foreground">
              Based on {metrics.total_products_assessed} assessed product{metrics.total_products_assessed !== 1 ? 's' : ''}
            </span>
          )}
        </div>
        <Button
          onClick={() => setAiModalOpen(true)}
          className="gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
        >
          <Sparkles className="h-4 w-4" />
          Ask the Data (AI)
        </Button>
      </div>

      {error && (
        <Alert variant="destructive">
          <AlertTitle>Error Loading Metrics</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {!loading && metrics && metrics.total_products_assessed === 0 && (
        <Alert>
          <TrendingUp className="h-4 w-4" />
          <AlertTitle>Get Started</AlertTitle>
          <AlertDescription>
            Complete product LCAs to see your Company Vitality metrics.
            The platform will automatically aggregate impacts across all products.
          </AlertDescription>
        </Alert>
      )}

      {/* Performance Summary - Strengths & Improvements */}
      <PerformanceSummary
        strengths={strengths}
        improvements={improvements}
      />

      {/* Four Pillars - Expandable Cards */}
      <PillarGrid>
        <PillarCard
          pillar="climate"
          score={vitalityScores.climate}
          value={totalCO2 > 0 ? formatValue(totalCO2 / 1000) : '--'}
          unit="tCO2eq"
          expanded={expandedPillar === 'climate'}
          onToggle={() => togglePillar('climate')}
        >
          <CarbonDeepDive
            scopeBreakdown={scopeBreakdown}
            totalCO2={totalCO2}
            materialBreakdown={materialBreakdown}
            ghgBreakdown={ghgBreakdown}
            lifecycleStageBreakdown={lifecycleStageBreakdown}
            facilityEmissionsBreakdown={facilityEmissionsBreakdown}
            scope3Categories={scope3Categories}
            scope3ProductDetails={scope3ProductDetails}
            scope3TravelDetails={scope3TravelDetails}
            scope3LogisticsDetails={scope3LogisticsDetails}
            scope3WasteDetails={scope3WasteDetails}
            scope3Total={scope3Total}
            year={currentYear}
            isLoadingScope3={footprintLoading}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCarbonSheetOpen(true)}
            className="mt-4 w-full"
          >
            View Full Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </PillarCard>

        <PillarCard
          pillar="water"
          score={vitalityScores.water}
          value={waterScarcityImpact > 0 ? formatValue(waterScarcityImpact) : '--'}
          unit="m3 world eq"
          expanded={expandedPillar === 'water'}
          onToggle={() => togglePillar('water')}
        >
          <WaterDeepDive
            facilityWaterRisks={facilityWaterRisks}
            productLcaWaterConsumption={waterConsumption}
            productLcaWaterScarcity={waterScarcityImpact}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setWaterSheetOpen(true)}
            className="mt-4 w-full"
          >
            View Full Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </PillarCard>

        <PillarCard
          pillar="circularity"
          score={vitalityScores.circularity}
          value={circularityRate > 0 ? circularityRate.toFixed(0) : '--'}
          unit="%"
          expanded={expandedPillar === 'circularity'}
          onToggle={() => togglePillar('circularity')}
        >
          <WasteDeepDive
            wasteMetrics={wasteMetrics}
            loading={wasteLoading}
          />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setCircularitySheetOpen(true)}
            className="mt-4 w-full"
          >
            View Full Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </PillarCard>

        <PillarCard
          pillar="nature"
          score={vitalityScores.nature}
          value={landUse > 0 ? formatValue(landUse) : '--'}
          unit="m2a crop eq"
          expanded={expandedPillar === 'nature'}
          onToggle={() => togglePillar('nature')}
        >
          <NatureDeepDive natureMetrics={natureMetrics} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setNatureSheetOpen(true)}
            className="mt-4 w-full"
          >
            View Full Analysis
            <ArrowRight className="ml-2 h-4 w-4" />
          </Button>
        </PillarCard>
      </PillarGrid>

      {/* Collapsible: Material Hotspots */}
      <Collapsible open={showHotspots} onOpenChange={setShowHotspots}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/30">
                  <AlertTriangle className="h-5 w-5 text-amber-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Impact Hotspots</h3>
                  <p className="text-sm text-muted-foreground">
                    {topMaterialHotspots.length} materials contributing to {
                      topMaterialHotspots.reduce((sum, m) => sum + m.percentage, 0).toFixed(0)
                    }% of emissions
                  </p>
                </div>
              </div>
              {showHotspots ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              {topMaterialHotspots.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <AlertTriangle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm font-medium">No material hotspots identified yet</p>
                  <p className="text-xs mt-2">Complete product LCAs to see top contributing materials</p>
                </div>
              ) : (
                <div className="space-y-3">
                  {topMaterialHotspots.map((item, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                      <div className="flex items-center gap-3">
                        <span className="text-lg font-bold text-muted-foreground w-6">#{idx + 1}</span>
                        <div>
                          <span className="font-medium">{item.label}</span>
                          <p className="text-xs text-muted-foreground">
                            {(item.value / 1000).toFixed(2)} tCO2eq
                          </p>
                        </div>
                      </div>
                      <Badge
                        variant="outline"
                        className={
                          item.severity === 'high' ? 'border-red-500 text-red-700' :
                          item.severity === 'medium' ? 'border-amber-500 text-amber-700' :
                          'border-green-500 text-green-700'
                        }
                      >
                        {item.percentage.toFixed(0)}%
                      </Badge>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Collapsible: Compliance & Standards */}
      <Collapsible open={showCompliance} onOpenChange={setShowCompliance}>
        <Card>
          <CollapsibleTrigger asChild>
            <button className="w-full p-4 flex items-center justify-between hover:bg-muted/50 transition-colors rounded-t-lg">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-green-100 dark:bg-green-900/30">
                  <Award className="h-5 w-5 text-green-600" />
                </div>
                <div className="text-left">
                  <h3 className="font-semibold">Compliance & Standards</h3>
                  <p className="text-sm text-muted-foreground">
                    {metrics?.csrd_compliant_percentage || 0}% CSRD ready
                  </p>
                </div>
              </div>
              {showCompliance ? (
                <ChevronUp className="h-5 w-5 text-muted-foreground" />
              ) : (
                <ChevronDown className="h-5 w-5 text-muted-foreground" />
              )}
            </button>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-4 mb-4">
                <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-6 w-6 text-green-600" />
                  </div>
                  <div className="text-2xl font-bold">{metrics?.csrd_compliant_percentage || 0}%</div>
                  <div className="text-xs text-muted-foreground mt-1">CSRD Ready</div>
                </div>
                <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
                  <div className="flex items-center justify-center mb-2">
                    <CheckCircle2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div className="text-2xl font-bold">{metrics?.total_products_assessed || 0}</div>
                  <div className="text-xs text-muted-foreground mt-1">Products Assessed</div>
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">ISO 14044:2006</span>
                  <Badge variant="outline" className="border-green-500 text-green-700">Compliant</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">GHG Protocol</span>
                  <Badge variant="outline" className="border-green-500 text-green-700">Compliant</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">ReCiPe 2016 (H)</span>
                  <Badge variant="outline" className="border-green-500 text-green-700">Active</Badge>
                </div>
                <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                  <span className="text-sm font-medium">TNFD LEAP</span>
                  <Badge variant="outline" className="border-blue-500 text-blue-700">In Progress</Badge>
                </div>
              </div>

              <Button asChild className="w-full mt-4">
                <Link href="/reports/sustainability">
                  Generate Sustainability Report
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* Methodology Note */}
      {!loading && metrics && metrics.total_products_assessed > 0 && (
        <Alert className="border-slate-200 bg-slate-50 dark:bg-slate-900/20 dark:border-slate-800">
          <Activity className="h-4 w-4" />
          <AlertTitle>Calculation Methodology</AlertTitle>
          <AlertDescription className="text-sm">
            Company Vitality aggregates impacts following GHG Protocol Corporate Standard and ISO 14064-1.
            Scope 1 & 2 from facilities, Scope 3 from product LCAs and corporate emissions data.
            No double-counting between facility and product data.
          </AlertDescription>
        </Alert>
      )}

      {/* Modals and Sheets */}
      <AICopilotModal open={aiModalOpen} onOpenChange={setAiModalOpen} />

      <CarbonBreakdownSheet
        open={carbonSheetOpen}
        onOpenChange={setCarbonSheetOpen}
        scopeBreakdown={scopeBreakdown}
        totalCO2={totalCO2}
        materialBreakdown={materialBreakdown}
        ghgBreakdown={ghgBreakdown}
        lifecycleStageBreakdown={lifecycleStageBreakdown}
        facilityEmissionsBreakdown={facilityEmissionsBreakdown}
        scope3Categories={scope3Categories}
        scope3ProductDetails={scope3ProductDetails}
        scope3TravelDetails={scope3TravelDetails}
        scope3LogisticsDetails={scope3LogisticsDetails}
        scope3WasteDetails={scope3WasteDetails}
        scope3Total={scope3Total}
        year={currentYear}
        isLoadingScope3={footprintLoading}
      />

      <WaterImpactSheet
        open={waterSheetOpen}
        onOpenChange={setWaterSheetOpen}
        totalConsumption={totalWaterConsumption}
        totalImpact={totalWaterImpact}
        sourceItems={waterSourceItems}
      />

      <CircularitySheet
        open={circularitySheetOpen}
        onOpenChange={setCircularitySheetOpen}
        metrics={wasteMetrics}
        loading={wasteLoading}
        year={currentYear}
      />

      <NatureImpactSheet
        open={natureSheetOpen}
        onOpenChange={setNatureSheetOpen}
        totalLandUse={totalLandUse}
        ingredientCount={landUseItems.length}
        landUseItems={landUseItems}
      />
    </div>
  );
}
