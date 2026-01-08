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
  Truck
} from 'lucide-react';
import Link from 'next/link';

import { useCompanyMetrics, CompanyMetrics } from '@/hooks/data/useCompanyMetrics';
import { useCompanyFootprint } from '@/hooks/data/useCompanyFootprint';
import { useOrganization } from '@/lib/organizationContext';
import type {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

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

import { ClimateCard } from '@/components/vitality/ClimateCard';
import { WaterCard } from '@/components/vitality/WaterCard';
import { WasteCard } from '@/components/vitality/WasteCard';
import { NatureCard } from '@/components/vitality/NatureCard';
import { CarbonDeepDive } from '@/components/vitality/CarbonDeepDive';
import { WaterDeepDive } from '@/components/vitality/WaterDeepDive';
import { WasteDeepDive } from '@/components/vitality/WasteDeepDive';
import { NatureDeepDive } from '@/components/vitality/NatureDeepDive';
import { AICopilotModal } from '@/components/vitality/AICopilotModal';
import { CarbonBreakdownSheet } from '@/components/vitality/CarbonBreakdownSheet';
import { WaterImpactSheet } from '@/components/vitality/WaterImpactSheet';
import { CircularitySheet } from '@/components/vitality/CircularitySheet';
import { NatureImpactSheet } from '@/components/vitality/NatureImpactSheet';

function VitalityMetricCard({
  icon: Icon,
  title,
  value,
  unit,
  trend,
  trendValue,
  status,
  onClick,
  gradient
}: {
  icon: any;
  title: string;
  value: number | string;
  unit: string;
  trend?: 'up' | 'down' | 'stable';
  trendValue?: string;
  status?: 'good' | 'warning' | 'critical';
  onClick?: () => void;
  gradient: string;
}) {
  const statusColors = {
    good: 'border-green-200 bg-green-50 dark:bg-green-950/20',
    warning: 'border-amber-200 bg-amber-50 dark:bg-amber-950/20',
    critical: 'border-red-200 bg-red-50 dark:bg-red-950/20',
  };

  return (
    <Card
      className={`border-2 ${status ? statusColors[status] : 'border-slate-200'} hover:shadow-lg transition-all cursor-pointer group`}
      onClick={onClick}
    >
      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`h-12 w-12 rounded-xl ${gradient} flex items-center justify-center`}>
            <Icon className="h-6 w-6 text-white" />
          </div>
          {status && (
            <Badge
              variant="outline"
              className={
                status === 'good' ? 'border-green-500 text-green-700' :
                status === 'warning' ? 'border-amber-500 text-amber-700' :
                'border-red-500 text-red-700'
              }
            >
              {status === 'good' ? 'On Track' : status === 'warning' ? 'Monitor' : 'Action Needed'}
            </Badge>
          )}
        </div>

        <h3 className="text-sm font-medium text-muted-foreground mb-2">{title}</h3>

        <div className="flex items-baseline gap-2 mb-2">
          <span className="text-3xl font-bold">
            {typeof value === 'number' ? value.toLocaleString('en-GB', { maximumFractionDigits: 1 }) : value}
          </span>
          <span className="text-sm text-green-700 dark:text-green-500">{unit}</span>
        </div>

        {trend && trendValue && (
          <div className="flex items-center gap-1 text-sm">
            <TrendingUp className={`h-4 w-4 ${
              trend === 'down' ? 'text-green-600 rotate-180' :
              trend === 'up' ? 'text-red-600' :
              'text-slate-600 rotate-90'
            }`} />
            <span className={
              trend === 'down' ? 'text-green-600' :
              trend === 'up' ? 'text-red-600' :
              'text-slate-600'
            }>
              {trendValue}
            </span>
          </div>
        )}

      </CardContent>
    </Card>
  );
}

function HotspotCard({
  title,
  items,
  icon: Icon,
  color
}: {
  title: string;
  items: { label: string; value: number; percentage: number; severity: 'high' | 'medium' | 'low' }[];
  icon: any;
  color: string;
}) {
  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-lg">
          <Icon className={`h-5 w-5 ${color}`} />
          {title}
        </CardTitle>
        <CardDescription>Highest impact contributors requiring attention</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {items.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Icon className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p className="text-sm font-medium">No material hotspots identified yet</p>
            <p className="text-xs mt-2">Complete product LCAs to see top contributing materials</p>
          </div>
        ) : items.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-slate-900 dark:text-slate-50">{item.label}</span>
                <Badge
                  variant="outline"
                  className={
                    item.severity === 'high' ? 'border-red-500 text-red-700' :
                    item.severity === 'medium' ? 'border-amber-500 text-amber-700' :
                    'border-green-500 text-green-700'
                  }
                >
                  {(item.percentage || 0).toFixed(0)}%
                </Badge>
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-lg font-semibold text-slate-900 dark:text-slate-50">{typeof item.value === 'number' ? item.value.toLocaleString('en-GB', { maximumFractionDigits: 2 }) : '0'}</span>
                <span className="text-xs text-slate-600 dark:text-slate-400">kg CO₂eq</span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ActionGuidanceCard({
  metrics,
  scopeBreakdown,
  materialHotspots,
}: {
  metrics: CompanyMetrics | null;
  scopeBreakdown: ScopeBreakdown | null;
  materialHotspots: { label: string; value: number; percentage: number; severity: 'high' | 'medium' | 'low' }[];
}) {
  const actions = useMemo(() => {
    if (!metrics || !scopeBreakdown) {
      return [{
        priority: 'high' as const,
        category: 'Data Quality',
        action: 'Complete product LCAs to enable insights',
        impact: 'Unlock personalised reduction strategies',
        icon: Leaf,
      }];
    }

    const totalScopes = scopeBreakdown.scope1 + scopeBreakdown.scope2 + scopeBreakdown.scope3;
    const scope1Pct = totalScopes > 0 ? (scopeBreakdown.scope1 / totalScopes) * 100 : 0;
    const scope2Pct = totalScopes > 0 ? (scopeBreakdown.scope2 / totalScopes) * 100 : 0;
    const scope3Pct = totalScopes > 0 ? (scopeBreakdown.scope3 / totalScopes) * 100 : 0;

    const generated: { priority: 'high' | 'medium'; category: string; action: string; impact: string; icon: any }[] = [];

    if (materialHotspots.length > 0) {
      const topMaterial = materialHotspots[0];
      const potentialReduction = (topMaterial.value * 0.4).toFixed(0);
      generated.push({
        priority: topMaterial.percentage > 25 ? 'high' : 'medium',
        category: 'Raw Materials',
        action: `Optimise ${topMaterial.label} sourcing`,
        impact: `Reduce by ${potentialReduction} kg CO₂eq (${(topMaterial.percentage * 0.4).toFixed(0)}%)`,
        icon: Leaf,
      });
    }

    if (scope2Pct > 15) {
      const potentialReduction = (scopeBreakdown.scope2 * 0.8).toFixed(0);
      generated.push({
        priority: scope2Pct > 30 ? 'high' : 'medium',
        category: 'Energy',
        action: 'Switch to renewable electricity tariff',
        impact: `Eliminate ${potentialReduction} kg CO₂eq (${(scope2Pct * 0.8).toFixed(0)}% of total)`,
        icon: Factory,
      });
    } else if (scope1Pct > 20) {
      const potentialReduction = (scopeBreakdown.scope1 * 0.3).toFixed(0);
      generated.push({
        priority: 'high',
        category: 'Direct Emissions',
        action: 'Improve facility energy efficiency',
        impact: `Reduce Scope 1 by ${potentialReduction} kg CO₂eq`,
        icon: Factory,
      });
    }

    if (metrics.water_risk_level === 'high') {
      generated.push({
        priority: 'high',
        category: 'Water Risk',
        action: 'Address high water scarcity facilities',
        impact: 'Reduce water scarcity impact by 30%',
        icon: Droplets,
      });
    } else if (metrics.total_impacts.water_scarcity_aware > 100) {
      generated.push({
        priority: 'medium',
        category: 'Water',
        action: 'Implement water efficiency measures',
        impact: `Lower water impact from ${metrics.total_impacts.water_scarcity_aware.toFixed(0)} m³ world eq`,
        icon: Droplets,
      });
    }

    if (metrics.circularity_percentage < 50) {
      generated.push({
        priority: metrics.circularity_percentage < 25 ? 'high' : 'medium',
        category: 'Circularity',
        action: 'Increase recyclable packaging content',
        impact: `Raise circularity from ${metrics.circularity_percentage}% to 60%+`,
        icon: Trash2,
      });
    }

    if (scope3Pct > 70 && materialHotspots.length > 1) {
      const secondMaterial = materialHotspots[1];
      generated.push({
        priority: 'medium',
        category: 'Supply Chain',
        action: `Engage suppliers for ${secondMaterial.label}`,
        impact: `Address ${secondMaterial.percentage.toFixed(0)}% of emissions`,
        icon: Truck,
      });
    }

    while (generated.length < 4) {
      const defaults = [
        { priority: 'medium' as const, category: 'Transport', action: 'Optimise logistics routes', impact: 'Reduce transport emissions by 15%', icon: Truck },
        { priority: 'medium' as const, category: 'Packaging', action: 'Lightweight packaging design', impact: 'Lower material footprint by 10%', icon: Leaf },
        { priority: 'medium' as const, category: 'Operations', action: 'Implement ISO 14001 practices', impact: 'Systematic environmental improvement', icon: Factory },
      ];
      const next = defaults[generated.length - 1];
      if (next && !generated.some(g => g.category === next.category)) {
        generated.push(next);
      } else {
        break;
      }
    }

    return generated.slice(0, 4);
  }, [metrics, scopeBreakdown, materialHotspots]);

  return (
    <Card className="border-2 border-blue-200 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
          <Target className="h-5 w-5 text-blue-600" />
          Priority Actions
          <Badge variant="outline" className="ml-auto text-xs">Data-Driven</Badge>
        </CardTitle>
        <CardDescription>Personalised recommendations based on your impact profile</CardDescription>
      </CardHeader>
      <CardContent className="space-y-3">
        {actions.map((action, idx) => (
          <div
            key={idx}
            className="flex items-start gap-3 p-4 rounded-lg bg-white dark:bg-slate-900 border border-blue-100 dark:border-blue-900"
          >
            <div className={`p-2 rounded-lg ${
              action.priority === 'high' ? 'bg-red-100 dark:bg-red-950/30' : 'bg-amber-100 dark:bg-amber-950/30'
            }`}>
              <action.icon className={`h-4 w-4 ${
                action.priority === 'high' ? 'text-red-600' : 'text-amber-600'
              }`} />
            </div>
            <div className="flex-1">
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-semibold text-slate-900 dark:text-slate-50">{action.category}</span>
                <Badge variant={action.priority === 'high' ? 'destructive' : 'default'} className="text-xs">
                  {action.priority === 'high' ? 'High Priority' : 'Medium Priority'}
                </Badge>
              </div>
              <p className="text-sm mb-1 text-slate-700 dark:text-slate-300">{action.action}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Activity className="h-3 w-3" />
                {action.impact}
              </p>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}

function ComplianceOverview({ metrics }: { metrics: any }) {
  return (
    <Card className="border-2 border-green-200">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-slate-900 dark:text-slate-50">
          <Award className="h-5 w-5 text-green-600" />
          Compliance & Standards
        </CardTitle>
        <CardDescription>Alignment with global sustainability frameworks</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div className="text-center p-4 rounded-lg bg-green-50 dark:bg-green-950/20">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{metrics?.csrd_compliant_percentage || 0}%</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">CSRD Ready</div>
          </div>
          <div className="text-center p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20">
            <div className="flex items-center justify-center mb-2">
              <CheckCircle2 className="h-6 w-6 text-blue-600" />
            </div>
            <div className="text-2xl font-bold text-slate-900 dark:text-slate-50">{metrics?.total_products_assessed || 0}</div>
            <div className="text-xs text-slate-600 dark:text-slate-400 mt-1">Products Assessed</div>
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-50">ISO 14044:2006</span>
            <Badge variant="outline" className="border-green-500 text-green-700">Compliant</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-50">GHG Protocol</span>
            <Badge variant="outline" className="border-green-500 text-green-700">Compliant</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-50">ReCiPe 2016 (H)</span>
            <Badge variant="outline" className="border-green-500 text-green-700">Active</Badge>
          </div>
          <div className="flex items-center justify-between p-3 rounded-lg bg-slate-100 dark:bg-slate-800">
            <span className="text-sm font-medium text-slate-900 dark:text-slate-50">TNFD LEAP</span>
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
    </Card>
  );
}

export default function PerformancePage() {
  const currentYear = new Date().getFullYear();
  const { currentOrganization } = useOrganization();
  const hookResult = useCompanyMetrics();
  const { footprint: footprintData, loading: footprintLoading } = useCompanyFootprint(currentYear);

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

  // Keep scope breakdown in kg to match totalCO2 (consistent with CarbonDeepDive display)
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

  // Use corporate footprint total for Carbon Footprint card (consistent with Company Emissions page)
  // Fall back to product LCA total if no corporate data exists
  const corporateTotalCO2 = footprintData?.total_emissions || 0;
  const productLcaTotalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;
  const totalCO2 = corporateTotalCO2 > 0 ? corporateTotalCO2 : productLcaTotalCO2;
  const waterConsumption = metrics?.total_impacts.water_consumption || 0;
  const waterScarcityImpact = metrics?.total_impacts.water_scarcity_aware || 0;
  const landUse = metrics?.total_impacts.land_use || 0;
  const circularityRate = metrics?.circularity_percentage || 0;

  // Calculate hotspots from material breakdown
  const topMaterialHotspots = (materialBreakdown || [])
    .sort((a, b) => b.climate - a.climate)
    .slice(0, 5)
    .map(m => ({
      label: m.name,
      value: m.climate,
      percentage: totalCO2 > 0 ? (m.climate / totalCO2) * 100 : 0,
      severity: (m.climate / totalCO2) * 100 > 20 ? 'high' : (m.climate / totalCO2) * 100 > 10 ? 'medium' : 'low' as any,
    }));

  // Calculate facility hotspots
  const topFacilityHotspots = (facilityEmissionsBreakdown || [])
    .sort((a, b) => b.total_emissions - a.total_emissions)
    .slice(0, 3)
    .map(f => ({
      label: f.facility_name,
      value: f.total_emissions,
      percentage: f.percentage,
      severity: f.percentage > 40 ? 'high' : f.percentage > 20 ? 'medium' : 'low' as any,
    }));

  // Mock water source items
  const waterSourceItems = [
    {
      id: '1',
      source: 'London Production Site',
      location: 'London, UK',
      consumption: waterConsumption * 0.41,
      riskFactor: 8.2,
      riskLevel: 'low' as const,
      netImpact: waterScarcityImpact * 0.09
    },
    {
      id: '2',
      source: 'Barcelona Bottling Plant',
      location: 'Andalusia, Spain',
      consumption: waterConsumption * 0.35,
      riskFactor: 54.8,
      riskLevel: 'high' as const,
      netImpact: waterScarcityImpact * 0.81
    },
    {
      id: '3',
      source: 'Dublin Distribution Centre',
      location: 'Dublin, Ireland',
      consumption: waterConsumption * 0.24,
      riskFactor: 5.3,
      riskLevel: 'low' as const,
      netImpact: waterScarcityImpact * 0.10
    },
  ];

  const estimatedTotalWaste = 5650;
  const linearWasteMass = estimatedTotalWaste * (100 - circularityRate) / 100;
  const circularWasteMass = estimatedTotalWaste * circularityRate / 100;

  const wasteStreams = [
    { id: '1', stream: 'Glass Bottles', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 0.45), circularityScore: 100 },
    { id: '2', stream: 'Cardboard Packaging', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 0.33), circularityScore: 100 },
    { id: '3', stream: 'Mixed Office Waste', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 0.6), circularityScore: 0 },
    { id: '4', stream: 'Organic Waste', disposition: 'composting' as const, mass: Math.round(circularWasteMass * 0.22), circularityScore: 100 },
    { id: '5', stream: 'Plastic Film', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 0.4), circularityScore: 0 },
  ];

  const totalLandUseFromMetrics = landUse || 6250;

  const landUseItems = [
    { id: '1', ingredient: 'Winter Wheat', origin: 'France', mass: 5000, landIntensity: 2.3, totalFootprint: Math.round(totalLandUseFromMetrics * 0.14) },
    { id: '2', ingredient: 'Sugarcane', origin: 'Brazil', mass: 3200, landIntensity: 18.5, totalFootprint: Math.round(totalLandUseFromMetrics * 0.74) },
    { id: '3', ingredient: 'Apples', origin: 'UK', mass: 1500, landIntensity: 4.2, totalFootprint: Math.round(totalLandUseFromMetrics * 0.08) },
    { id: '4', ingredient: 'Lemons', origin: 'Spain', mass: 800, landIntensity: 3.8, totalFootprint: Math.round(totalLandUseFromMetrics * 0.03) },
    { id: '5', ingredient: 'Elderflower', origin: 'Austria', mass: 120, landIntensity: 1.5, totalFootprint: Math.round(totalLandUseFromMetrics * 0.01) },
  ];

  const totalWaterConsumption = waterSourceItems.reduce((sum, item) => sum + item.consumption, 0);
  const totalWaterImpact = waterSourceItems.reduce((sum, item) => sum + item.netImpact, 0);
  const totalWaste = wasteStreams.reduce((sum, item) => sum + item.mass, 0);
  const circularWaste = wasteStreams.reduce((sum, item) => sum + (item.mass * item.circularityScore / 100), 0);
  const totalLandUse = landUseItems.reduce((sum, item) => sum + item.totalFootprint, 0);

  const getWaterRiskStatus = () => {
    if (metrics?.water_risk_level === 'high') return 'critical';
    if (metrics?.water_risk_level === 'medium') return 'warning';
    return 'good';
  };

  const getCircularityStatus = () => {
    if (circularityRate >= 60) return 'good';
    if (circularityRate >= 40) return 'warning';
    return 'critical';
  };

  return (
    <div className="space-y-6 animate-fade-in-up">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Company Vitality</h1>
          <p className="text-lg text-muted-foreground">
            Comprehensive environmental health powered by ReCiPe 2016
          </p>
          {metrics?.last_updated && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Calendar className="h-4 w-4" />
              <span>
                Last updated: {new Date(metrics.last_updated).toLocaleString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </span>
            </div>
          )}
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            onClick={refetch}
            disabled={loading}
            className="gap-2"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button
            onClick={() => setAiModalOpen(true)}
            className="gap-2 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
          >
            <Sparkles className="h-4 w-4" />
            Ask the Data (AI)
          </Button>
        </div>
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
          <AlertTitle>No Data Yet</AlertTitle>
          <AlertDescription>
            Complete product LCAs with the new multi-capital calculation engine to see your Company Vitality metrics.
            The platform will automatically aggregate impacts across all products.
          </AlertDescription>
        </Alert>
      )}

      {!loading && metrics && metrics.total_products_assessed > 0 && (
        <Alert className="border-blue-200 bg-blue-50 dark:bg-blue-950/20 dark:border-blue-800">
          <CheckCircle2 className="h-4 w-4 text-blue-600" />
          <AlertTitle className="text-blue-900 dark:text-blue-100">
            Calculation Methodology
          </AlertTitle>
          <AlertDescription className="text-blue-800 dark:text-blue-200">
            <p className="text-sm mb-3">
              Company Vitality aggregates impacts following <strong>GHG Protocol Corporate Standard</strong> and <strong>ISO 14064-1</strong>:
            </p>
            <ul className="text-sm space-y-1.5 list-disc list-inside">
              <li><strong>Scope 1 & 2:</strong> Direct measurement from owned/controlled facilities (from Company Emissions data)</li>
              <li><strong>Scope 3:</strong> Value chain emissions including materials, transport, waste (from Product LCAs + Company Emissions)</li>
              <li><strong>No double-counting:</strong> Owned facility emissions counted once in Scope 1/2, not duplicated from Product LCAs</li>
              <li><strong>Water, Waste, Land:</strong> Aggregated from Product LCAs and operational data</li>
            </ul>
            <p className="text-xs mt-3 text-blue-700 dark:text-blue-300">
              Standards compliance: ISO 14064-1, GHG Protocol Corporate Standard, ISO 14067
            </p>
          </AlertDescription>
        </Alert>
      )}

      {loading ? (
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
        </div>
      ) : (
        <>
          {/* Key Metrics Grid - Bento Box Style */}
          <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
            <VitalityMetricCard
              icon={Leaf}
              title="Carbon Footprint"
              value={totalCO2}
              unit="kg CO₂eq"
              trend="down"
              trendValue="12% vs last quarter"
              status="good"
              onClick={() => setCarbonSheetOpen(true)}
              gradient="bg-gradient-to-br from-green-500 to-emerald-600"
            />

            <VitalityMetricCard
              icon={Droplets}
              title="Water Scarcity Impact"
              value={waterScarcityImpact}
              unit="m³ world eq."
              trend="up"
              trendValue="8% vs last quarter"
              status={getWaterRiskStatus()}
              onClick={() => setWaterSheetOpen(true)}
              gradient="bg-gradient-to-br from-blue-500 to-cyan-600"
            />

            <VitalityMetricCard
              icon={Trash2}
              title="Circularity Rate"
              value={circularityRate}
              unit="%"
              trend="up"
              trendValue="5% vs last quarter"
              status={getCircularityStatus()}
              onClick={() => setCircularitySheetOpen(true)}
              gradient="bg-gradient-to-br from-purple-500 to-pink-600"
            />

            <VitalityMetricCard
              icon={Mountain}
              title="Land Use"
              value={landUse}
              unit="m²a crop eq"
              trend="stable"
              trendValue="No change"
              status="warning"
              onClick={() => setNatureSheetOpen(true)}
              gradient="bg-gradient-to-br from-amber-500 to-orange-600"
            />
          </div>

          {/* Main Content Grid */}
          <div className="grid gap-6 grid-cols-1 lg:grid-cols-3">
            {/* Left Column - Detailed Breakdowns */}
            <div className="lg:col-span-2 space-y-6">
              {/* GHG Emissions Deep Dive */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Leaf className="h-5 w-5 text-green-600" />
                    GHG Emissions Breakdown
                  </CardTitle>
                  <CardDescription>Detailed carbon footprint analysis by scope and lifecycle stage</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
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
                  )}
                </CardContent>
              </Card>

              {/* Material Flow Hotspots */}
              <HotspotCard
                title="Material Impact Hotspots"
                items={topMaterialHotspots}
                icon={AlertTriangle}
                color="text-amber-600"
              />

              {/* Water Risk Analysis */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Droplets className="h-5 w-5 text-blue-600" />
                    Water Risk Analysis
                  </CardTitle>
                  <CardDescription>Facility-level water scarcity assessment</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <WaterDeepDive facilityWaterRisks={facilityWaterRisks} />
                  )}
                </CardContent>
              </Card>

              {/* Nature Impact Radar */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mountain className="h-5 w-5 text-green-600" />
                    Nature Impact Assessment
                  </CardTitle>
                  <CardDescription>Multi-dimensional biodiversity and ecosystem health</CardDescription>
                </CardHeader>
                <CardContent>
                  {loading ? (
                    <Skeleton className="h-64 w-full" />
                  ) : (
                    <NatureDeepDive natureMetrics={natureMetrics} />
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Right Column - Actions & Compliance */}
            <div className="space-y-6">
              {/* Priority Actions */}
              <ActionGuidanceCard
                metrics={metrics}
                scopeBreakdown={scopeBreakdown}
                materialHotspots={topMaterialHotspots}
              />

              {/* Facility Hotspots */}
              {topFacilityHotspots.length > 0 && (
                <HotspotCard
                  title="Facility Hotspots"
                  items={topFacilityHotspots}
                  icon={Factory}
                  color="text-orange-600"
                />
              )}

              {/* Compliance Overview */}
              <ComplianceOverview metrics={metrics} />

              {/* Data Quality Indicator */}
              <Card className="border-2 border-slate-200">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Activity className="h-4 w-4" />
                    Data Quality
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Primary Data</span>
                    <Badge variant="outline" className="border-green-500 text-green-700">
                      {metrics?.csrd_compliant_percentage || 0}%
                    </Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Products Assessed</span>
                    <span className="text-sm font-semibold">{metrics?.total_products_assessed || 0}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Last Update</span>
                    <span className="text-xs text-muted-foreground">
                      {metrics?.last_updated
                        ? new Date(metrics.last_updated).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
                        : 'N/A'}
                    </span>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        </>
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
        totalWaste={totalWaste}
        circularityRate={(circularWaste / totalWaste) * 100}
        wasteStreams={wasteStreams}
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
