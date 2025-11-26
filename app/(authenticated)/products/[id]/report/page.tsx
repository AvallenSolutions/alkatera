"use client";

import React, { useState } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, Lock, Download, Share2, Eye, EyeOff } from 'lucide-react';
import Link from 'next/link';
import { DQIGauge } from '@/components/lca/DQIGauge';
import { ClimateCard } from '@/components/vitality/ClimateCard';
import { WaterCard } from '@/components/vitality/WaterCard';
import { WasteCard } from '@/components/vitality/WasteCard';
import { NatureCard } from '@/components/vitality/NatureCard';
import { WaterImpactSheet } from '@/components/vitality/WaterImpactSheet';
import { CircularitySheet } from '@/components/vitality/CircularitySheet';
import { NatureImpactSheet } from '@/components/vitality/NatureImpactSheet';

// Mock LCA Report Data
const MOCK_LCA_REPORT = {
  id: '550e8400-e29b-41d4-a716-446655440000',
  product_id: 1,
  product_name: 'Elderflower Pressé 250ml',
  title: '2025 Product Impact Assessment',
  version: '1.0',
  status: 'published' as const,
  dqi_score: 92,
  system_boundary: 'Cradle-to-Gate (Raw Materials → Factory Gate)',
  functional_unit: '250ml bottle',
  assessment_period: 'January 2025',
  created_at: '2025-01-15',
  published_at: '2025-01-20',
};

const MOCK_METRICS = {
  total_impacts: {
    climate_change_gwp100: 0.185,
    water_consumption: 0.82,
    water_scarcity_aware: 3.2,
    land_use: 1.85,
    terrestrial_ecotoxicity: 0.42,
    freshwater_eutrophication: 0.008,
    terrestrial_acidification: 0.012,
    fossil_resource_scarcity: 0.035,
  },
  circularity_percentage: 78,
  total_products_assessed: 1,
  csrd_compliant_percentage: 100,
  last_updated: '2025-01-20T14:30:00Z',
};

const DATA_SOURCES = [
  { name: 'Primary Supplier Data', description: 'Direct EPDs from 3 tier-1 suppliers', count: 3 },
  { name: 'Ecoinvent 3.12', description: 'Background processes and energy grids', count: 12 },
  { name: 'DEFRA 2024', description: 'UK-specific emission factors', count: 5 },
  { name: 'OpenLCA v2.0', description: 'Impact assessment calculations', count: 1 },
];

export default function ProductLcaReportPage() {
  const params = useParams();
  const productId = params?.id as string;

  const [activeTab, setActiveTab] = useState('planet');
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [circularitySheetOpen, setCircularitySheetOpen] = useState(false);
  const [natureSheetOpen, setNatureSheetOpen] = useState(false);

  // Mock data for evidence drawers - using metrics to ensure consistency
  const waterConsumption = MOCK_METRICS.total_impacts.water_consumption;
  const waterScarcityImpact = MOCK_METRICS.total_impacts.water_scarcity_aware;

  const waterSourceItems = [
    {
      id: '1',
      source: 'Primary Production (UK)',
      location: 'Herefordshire, UK',
      consumption: waterConsumption * 0.45,
      riskFactor: 6.2,
      riskLevel: 'low' as const,
      netImpact: waterScarcityImpact * 0.10
    },
    {
      id: '2',
      source: 'Glass Manufacturing',
      location: 'Castilla-La Mancha, Spain',
      consumption: waterConsumption * 0.40,
      riskFactor: 48.5,
      riskLevel: 'high' as const,
      netImpact: waterScarcityImpact * 0.82
    },
    {
      id: '3',
      source: 'Sugar Refining',
      location: 'Thames Valley, UK',
      consumption: waterConsumption * 0.15,
      riskFactor: 7.8,
      riskLevel: 'low' as const,
      netImpact: waterScarcityImpact * 0.08
    },
  ];

  const circularityPercentage = MOCK_METRICS.circularity_percentage;
  const estimatedTotalWaste = 0.45; // kg per unit
  const linearWasteMass = estimatedTotalWaste * (100 - circularityPercentage) / 100;
  const circularWasteMass = estimatedTotalWaste * circularityPercentage / 100;

  const wasteStreams = [
    { id: '1', stream: 'Glass Bottle', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000 * 0.72), circularityScore: 100 },
    { id: '2', stream: 'Label (Paper)', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000 * 0.18), circularityScore: 100 },
    { id: '3', stream: 'Cap (Aluminium)', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000 * 0.10), circularityScore: 100 },
    { id: '4', stream: 'Process Waste', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 1000), circularityScore: 0 },
  ];

  const totalLandUse = MOCK_METRICS.total_impacts.land_use;

  const landUseItems = [
    { id: '1', ingredient: 'Sugar Beet', origin: 'UK', mass: 0.028, landIntensity: 1.8, totalFootprint: Math.round(totalLandUse * 0.03 * 1000) / 1000 },
    { id: '2', ingredient: 'Elderflower', origin: 'Austria', mass: 0.004, landIntensity: 0.9, totalFootprint: Math.round(totalLandUse * 0.02 * 1000) / 1000 },
    { id: '3', ingredient: 'Glass (Silica Sand)', origin: 'Spain', mass: 0.250, landIntensity: 5.2, totalFootprint: Math.round(totalLandUse * 0.70 * 1000) / 1000 },
    { id: '4', ingredient: 'Citric Acid', origin: 'China', mass: 0.002, landIntensity: 12.5, totalFootprint: Math.round(totalLandUse * 0.25 * 1000) / 1000 },
  ];

  const totalWaterConsumption = waterSourceItems.reduce((sum, item) => sum + item.consumption, 0);
  const totalWaterImpact = waterSourceItems.reduce((sum, item) => sum + item.netImpact, 0);
  const totalWaste = wasteStreams.reduce((sum, item) => sum + item.mass, 0) / 1000; // Convert to kg
  const circularWaste = wasteStreams.reduce((sum, item) => sum + (item.mass * item.circularityScore / 100), 0) / 1000;
  const circularityRate = (circularWaste / totalWaste) * 100;
  const totalLandUseSum = landUseItems.reduce((sum, item) => sum + item.totalFootprint, 0);

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Link href={`/products/${productId}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Product
            </Button>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">{MOCK_LCA_REPORT.title}</h1>
          <div className="flex items-center gap-4">
            <p className="text-lg text-muted-foreground">{MOCK_LCA_REPORT.product_name}</p>
            <Badge variant="default" className="bg-green-600">
              {MOCK_LCA_REPORT.status.charAt(0).toUpperCase() + MOCK_LCA_REPORT.status.slice(1)}
            </Badge>
            <Badge variant="outline">v{MOCK_LCA_REPORT.version}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Assessment Period: {MOCK_LCA_REPORT.assessment_period} • Published: {new Date(MOCK_LCA_REPORT.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Button variant="outline" className="gap-2">
            <Download className="h-4 w-4" />
            Download PDF
          </Button>
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share Report
          </Button>
        </div>
      </div>

      {/* Trust Signal: DQI Gauge */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <DQIGauge score={MOCK_LCA_REPORT.dqi_score} size="md" />
        </div>
        <div className="md:col-span-3">
          <Card>
            <CardHeader>
              <CardTitle>Report Summary</CardTitle>
              <CardDescription>Key information about this LCA assessment</CardDescription>
            </CardHeader>
            <CardContent className="grid md:grid-cols-2 gap-6">
              <div>
                <h4 className="text-sm font-semibold mb-2">System Boundary</h4>
                <p className="text-sm text-muted-foreground">{MOCK_LCA_REPORT.system_boundary}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Functional Unit</h4>
                <p className="text-sm text-muted-foreground">{MOCK_LCA_REPORT.functional_unit}</p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Standards</h4>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">ISO 14044:2006</Badge>
                  <Badge variant="outline" className="text-xs">CSRD E1</Badge>
                  <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                </div>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Assessment Method</h4>
                <p className="text-sm text-muted-foreground">ReCiPe 2016 Midpoint (H)</p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Main Content: Tabbed Interface */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="planet">Planet</TabsTrigger>
          <TabsTrigger value="people" disabled>
            <Lock className="h-3 w-3 mr-2" />
            People
          </TabsTrigger>
          <TabsTrigger value="transparency">Transparency</TabsTrigger>
        </TabsList>

        {/* Tab A: Planet (Active) */}
        <TabsContent value="planet" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <ClimateCard metrics={MOCK_METRICS as any} loading={false} />
            <WaterCard metrics={MOCK_METRICS as any} loading={false} onClick={() => setWaterSheetOpen(true)} />
            <WasteCard metrics={MOCK_METRICS as any} loading={false} onClick={() => setCircularitySheetOpen(true)} />
            <NatureCard metrics={MOCK_METRICS as any} loading={false} onClick={() => setNatureSheetOpen(true)} />
          </div>
        </TabsContent>

        {/* Tab B: People (Locked/Roadmap) */}
        <TabsContent value="people" className="space-y-6">
          <Card className="relative overflow-hidden">
            <div className="absolute inset-0 backdrop-blur-sm bg-white/60 z-10 flex items-center justify-center">
              <div className="text-center space-y-4 p-8">
                <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-gray-200">
                  <Lock className="h-10 w-10 text-gray-500" />
                </div>
                <div>
                  <h3 className="text-xl font-bold mb-2">Social Impact Module</h3>
                  <p className="text-sm text-muted-foreground mb-4">
                    Status: In Development (Q3 2026)
                  </p>
                  <p className="text-sm text-muted-foreground max-w-md">
                    Tracks UN S-LCA indicators for Labour & Community including Fair Wage, Working Conditions, and Local Economic Impact.
                  </p>
                </div>
                <Badge variant="outline" className="text-xs">Roadmap Feature</Badge>
              </div>
            </div>
            <CardContent className="p-12 space-y-8">
              <Skeleton className="h-64 w-full" />
              <div className="grid md:grid-cols-3 gap-4">
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
                <Skeleton className="h-32 w-full" />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Tab C: Transparency (Active) */}
        <TabsContent value="transparency" className="space-y-6">
          {/* Section 1: Data Provenance */}
          <Card>
            <CardHeader>
              <CardTitle>Data Provenance</CardTitle>
              <CardDescription>
                Complete traceability of all data sources used in this assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {DATA_SOURCES.map((source, idx) => (
                <div key={idx} className="flex items-start justify-between border-b pb-4 last:border-0">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">{source.name}</h4>
                    <p className="text-sm text-muted-foreground">{source.description}</p>
                  </div>
                  <Badge variant="outline">{source.count} processes</Badge>
                </div>
              ))}
            </CardContent>
          </Card>

          {/* Section 2: System Boundary */}
          <Card>
            <CardHeader>
              <CardTitle>System Boundary</CardTitle>
              <CardDescription>
                Scope and boundaries of this LCA assessment
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold text-sm mb-2">Boundary Definition</h4>
                <p className="text-sm text-muted-foreground">
                  {MOCK_LCA_REPORT.system_boundary}
                </p>
              </div>
              <div className="grid md:grid-cols-3 gap-4 mt-4">
                <div className="p-4 border rounded-lg bg-green-50 border-green-200">
                  <Eye className="h-5 w-5 text-green-600 mb-2" />
                  <h5 className="font-semibold text-sm mb-1">Included</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Raw material extraction</li>
                    <li>• Primary production</li>
                    <li>• Packaging manufacture</li>
                    <li>• Factory operations</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg bg-gray-50 border-gray-200">
                  <EyeOff className="h-5 w-5 text-gray-600 mb-2" />
                  <h5 className="font-semibold text-sm mb-1">Excluded</h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Distribution to retailers</li>
                    <li>• Consumer use phase</li>
                    <li>• End-of-life disposal</li>
                    <li>• Capital goods</li>
                  </ul>
                </div>
                <div className="p-4 border rounded-lg bg-amber-50 border-amber-200">
                  <Badge variant="outline" className="mb-2 text-xs">Cut-off Criteria</Badge>
                  <p className="text-xs text-muted-foreground">
                    Processes contributing less than 1% to total impact and cumulatively less than 5% were excluded per ISO 14044.
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      {/* Evidence Drawers */}
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
        totalLandUse={totalLandUseSum}
        ingredientCount={landUseItems.length}
        landUseItems={landUseItems}
      />
    </div>
  );
}
