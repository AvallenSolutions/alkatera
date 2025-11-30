"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, RefreshCw, Calendar, TrendingUp } from 'lucide-react';

import { useCompanyMetrics } from '@/hooks/data/useCompanyMetrics';
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

export default function PerformancePage() {
  const {
    metrics,
    scopeBreakdown,
    facilityWaterRisks,
    materialBreakdown,
    ghgBreakdown,
    lifecycleStageBreakdown,
    facilityEmissionsBreakdown,
    natureMetrics,
    loading,
    error,
    refetch,
  } = useCompanyMetrics();

  const [activeTab, setActiveTab] = useState('carbon');
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [carbonSheetOpen, setCarbonSheetOpen] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [circularitySheetOpen, setCircularitySheetOpen] = useState(false);
  const [natureSheetOpen, setNatureSheetOpen] = useState(false);

  // Debug logging
  React.useEffect(() => {
    console.log('carbonSheetOpen state changed:', carbonSheetOpen);
  }, [carbonSheetOpen]);

  const totalCO2 = metrics?.total_impacts.climate_change_gwp100 || 0;

  // Mock data for evidence drawers - derived from metrics to ensure consistency
  const waterConsumption = metrics?.total_impacts.water_consumption || 290.4;
  const waterScarcityImpact = metrics?.total_impacts.water_scarcity_aware || 10845.5;

  // Water breakdown (proportional to actual metrics)
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

  // Circularity - derive waste streams to match card's circularity percentage
  const circularityPercentage = metrics?.circularity_percentage || 57;
  const estimatedTotalWaste = 5650;
  const linearWasteMass = estimatedTotalWaste * (100 - circularityPercentage) / 100;
  const circularWasteMass = estimatedTotalWaste * circularityPercentage / 100;

  const wasteStreams = [
    { id: '1', stream: 'Glass Bottles', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 0.45), circularityScore: 100 },
    { id: '2', stream: 'Cardboard Packaging', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 0.33), circularityScore: 100 },
    { id: '3', stream: 'Mixed Office Waste', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 0.6), circularityScore: 0 },
    { id: '4', stream: 'Organic Waste', disposition: 'composting' as const, mass: Math.round(circularWasteMass * 0.22), circularityScore: 100 },
    { id: '5', stream: 'Plastic Film', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 0.4), circularityScore: 0 },
  ];

  // Land use - derive from actual metrics
  const totalLandUseFromMetrics = metrics?.total_impacts.land_use || 6250;

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
  const circularityRate = (circularWaste / totalWaste) * 100;
  const totalLandUse = landUseItems.reduce((sum, item) => sum + item.totalFootprint, 0);

  return (
    <div className="container mx-auto py-8 space-y-8">
      <div className="flex items-start justify-between">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Company Vitality</h1>
          <p className="text-lg text-muted-foreground">
            Multi-capital environmental performance powered by ReCiPe 2016
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

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
        <ClimateCard
          metrics={metrics}
          loading={loading}
          onViewBreakdown={() => {
            console.log('onViewBreakdown called in performance page');
            setCarbonSheetOpen(true);
            console.log('carbonSheetOpen set to true');
          }}
        />
        <WaterCard metrics={metrics} loading={loading} onClick={() => setWaterSheetOpen(true)} />
        <WasteCard metrics={metrics} loading={loading} onClick={() => setCircularitySheetOpen(true)} />
        <NatureCard metrics={metrics} loading={loading} onClick={() => setNatureSheetOpen(true)} />
      </div>

      {metrics && metrics.csrd_compliant_percentage > 0 && (
        <div className="flex items-center justify-center gap-4 py-4">
          <Badge variant="default" className="bg-green-600 text-sm px-4 py-2">
            {metrics.csrd_compliant_percentage.toFixed(0)}% CSRD Compliant
          </Badge>
          <span className="text-sm text-muted-foreground">
            {metrics.total_products_assessed} products assessed with ReCiPe 2016 Midpoint (H)
          </span>
        </div>
      )}

      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <h2 className="text-2xl font-bold">Deep Dive Analysis</h2>
            <p className="text-muted-foreground">
              Explore detailed breakdowns and identify improvement opportunities
            </p>
          </div>
          <Badge variant="outline">
            Metric-First Dashboard
          </Badge>
        </div>

        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="carbon">Carbon</TabsTrigger>
            <TabsTrigger value="water">Water</TabsTrigger>
            <TabsTrigger value="waste">Circularity</TabsTrigger>
            <TabsTrigger value="nature">Nature</TabsTrigger>
          </TabsList>

          <TabsContent value="carbon" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <CarbonDeepDive
                scopeBreakdown={scopeBreakdown}
                totalCO2={totalCO2}
                materialBreakdown={materialBreakdown}
                ghgBreakdown={ghgBreakdown}
                lifecycleStageBreakdown={lifecycleStageBreakdown}
                facilityEmissionsBreakdown={facilityEmissionsBreakdown}
              />
            )}
          </TabsContent>

          <TabsContent value="water" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <WaterDeepDive facilityWaterRisks={facilityWaterRisks} />
            )}
          </TabsContent>

          <TabsContent value="waste" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <WasteDeepDive />
            )}
          </TabsContent>

          <TabsContent value="nature" className="space-y-4">
            {loading ? (
              <div className="space-y-4">
                <Skeleton className="h-64 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            ) : (
              <NatureDeepDive natureMetrics={natureMetrics} />
            )}
          </TabsContent>
        </Tabs>
      </div>

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
        circularityRate={circularityRate}
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
