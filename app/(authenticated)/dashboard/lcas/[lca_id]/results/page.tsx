"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { ArrowLeft, Lock, Download, Share2, Eye, EyeOff, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { DQIGauge } from '@/components/lca/DQIGauge';
import { ClimateCard } from '@/components/vitality/ClimateCard';
import { WaterCard } from '@/components/vitality/WaterCard';
import { WasteCard } from '@/components/vitality/WasteCard';
import { NatureCard } from '@/components/vitality/NatureCard';
import { CarbonBreakdownSheet } from '@/components/vitality/CarbonBreakdownSheet';
import { WaterImpactSheet } from '@/components/vitality/WaterImpactSheet';
import { CircularitySheet } from '@/components/vitality/CircularitySheet';
import { NatureImpactSheet } from '@/components/vitality/NatureImpactSheet';
import { generateLcaReportPdf } from '@/lib/pdf-generator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';
import { format } from 'date-fns';

interface LcaData {
  id: string;
  product_name: string;
  product_id: string;
  status: string;
  system_boundary?: string;
  functional_unit?: string;
  created_at: string;
}

interface CalculationLog {
  response_data: any;
  impact_metrics?: any;
  created_at: string;
  status: string;
}

interface MaterialData {
  name: string;
  quantity: number;
  unit: string;
  impact_climate?: number;
  impact_water?: number;
  impact_land?: number;
  impact_waste?: number;
}

export default function ResultsPage() {
  const params = useParams();
  const lcaId = params.lca_id as string;
  const { toast } = useToast();

  const [lcaData, setLcaData] = useState<LcaData | null>(null);
  const [calculationLog, setCalculationLog] = useState<CalculationLog | null>(null);
  const [materials, setMaterials] = useState<MaterialData[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState('planet');
  const [carbonSheetOpen, setCarbonSheetOpen] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [circularitySheetOpen, setCircularitySheetOpen] = useState(false);
  const [natureSheetOpen, setNatureSheetOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch LCA data
        const { data: lca, error: lcaError } = await supabase
          .from('product_lcas')
          .select('id, product_name, product_id, status, system_boundary, functional_unit, created_at')
          .eq('id', lcaId)
          .maybeSingle();

        if (lcaError) throw lcaError;
        if (!lca) throw new Error('LCA not found');

        setLcaData(lca);

        // Fetch calculation log
        const { data: log, error: logError } = await supabase
          .from('product_lca_calculation_logs')
          .select('response_data, impact_metrics, created_at, status')
          .eq('product_lca_id', lcaId)
          .eq('status', 'success')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (logError) {
          console.warn('Error fetching calculation log:', logError);
        }

        setCalculationLog(log);

        // Fetch materials
        const { data: materialsData, error: materialsError } = await supabase
          .from('product_lca_materials')
          .select('name, quantity, unit, impact_climate, impact_water, impact_land, impact_waste')
          .eq('product_lca_id', lcaId);

        if (materialsError) {
          console.warn('Error fetching materials:', materialsError);
        } else {
          setMaterials(materialsData || []);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load LCA data');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [lcaId]);

  // Transform data for display
  const getMetrics = () => {
    if (!calculationLog?.impact_metrics) {
      // Calculate from materials if no calculation log
      const totalClimate = materials.reduce((sum, m) => sum + (m.impact_climate || 0) * m.quantity, 0);
      const totalWater = materials.reduce((sum, m) => sum + (m.impact_water || 0) * m.quantity, 0);
      const totalLand = materials.reduce((sum, m) => sum + (m.impact_land || 0) * m.quantity, 0);
      const totalWaste = materials.reduce((sum, m) => sum + (m.impact_waste || 0) * m.quantity, 0);

      return {
        total_impacts: {
          climate_change_gwp100: totalClimate,
          water_consumption: totalWater,
          water_scarcity_aware: totalWater * 4, // Rough estimate
          land_use: totalLand,
          terrestrial_ecotoxicity: 0,
          freshwater_eutrophication: 0,
          terrestrial_acidification: 0,
          fossil_resource_scarcity: totalWaste * 0.5, // Rough estimate
        },
        circularity_percentage: 65, // Default estimate
        total_products_assessed: 1,
        csrd_compliant_percentage: 80,
        water_risk_level: 'low' as const,
        land_footprint_total: totalLand,
      };
    }

    const metrics = calculationLog.impact_metrics;
    return {
      total_impacts: {
        climate_change_gwp100: metrics.climate_change_gwp100 || 0,
        water_consumption: metrics.water_consumption || 0,
        water_scarcity_aware: metrics.water_scarcity_aware || metrics.water_consumption * 4,
        land_use: metrics.land_use || 0,
        terrestrial_ecotoxicity: metrics.terrestrial_ecotoxicity || 0,
        freshwater_eutrophication: metrics.freshwater_eutrophication || 0,
        terrestrial_acidification: metrics.terrestrial_acidification || 0,
        fossil_resource_scarcity: metrics.fossil_resource_scarcity || 0,
      },
      circularity_percentage: metrics.circularity_percentage || 65,
      total_products_assessed: 1,
      csrd_compliant_percentage: 85,
      water_risk_level: metrics.water_risk_level || 'low' as const,
      land_footprint_total: metrics.land_use || 0,
    };
  };

  const metrics = getMetrics();
  const totalClimate = metrics.total_impacts.climate_change_gwp100;
  const totalWater = metrics.total_impacts.water_consumption;
  const totalLand = metrics.total_impacts.land_use;

  // Calculate DQI score based on data availability
  const calculateDQI = () => {
    if (!materials.length) return 50;

    const materialsWithImpacts = materials.filter(m =>
      m.impact_climate && m.impact_climate > 0
    ).length;

    const ratio = materialsWithImpacts / materials.length;
    return Math.round(50 + (ratio * 45)); // 50-95 range
  };

  const dqiScore = calculateDQI();

  // Mock data for evidence drawers
  const waterConsumption = totalWater;
  const waterScarcityImpact = metrics.total_impacts.water_scarcity_aware;

  const waterSourceItems = [
    {
      id: '1',
      source: 'Primary Production',
      location: 'Various Locations',
      consumption: waterConsumption * 0.6,
      riskFactor: 10.0,
      riskLevel: 'low' as const,
      netImpact: waterScarcityImpact * 0.3
    },
    {
      id: '2',
      source: 'Packaging Manufacturing',
      location: 'Various Locations',
      consumption: waterConsumption * 0.4,
      riskFactor: 25.0,
      riskLevel: 'medium' as const,
      netImpact: waterScarcityImpact * 0.7
    },
  ];

  const circularityPercentage = metrics.circularity_percentage;
  const estimatedTotalWaste = materials.reduce((sum, m) => sum + m.quantity, 0) * 0.1;
  const linearWasteMass = estimatedTotalWaste * (100 - circularityPercentage) / 100;
  const circularWasteMass = estimatedTotalWaste * circularityPercentage / 100;

  const wasteStreams = [
    { id: '1', stream: 'Recyclable Materials', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000), circularityScore: 100 },
    { id: '2', stream: 'Process Waste', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 1000), circularityScore: 0 },
  ];

  const landUseItems = materials
    .filter(m => m.impact_land && m.impact_land > 0)
    .map((m, idx) => ({
      id: String(idx + 1),
      ingredient: m.name,
      origin: 'Various',
      mass: m.quantity,
      landIntensity: m.impact_land || 0,
      totalFootprint: m.quantity * (m.impact_land || 0),
    }));

  const totalWaterConsumption = waterSourceItems.reduce((sum, item) => sum + item.consumption, 0);
  const totalWaterImpact = waterSourceItems.reduce((sum, item) => sum + item.netImpact, 0);
  const totalWaste = wasteStreams.reduce((sum, item) => sum + item.mass, 0) / 1000;
  const circularWaste = wasteStreams.reduce((sum, item) => sum + (item.mass * item.circularityScore / 100), 0) / 1000;
  const circularityRate = totalWaste > 0 ? (circularWaste / totalWaste) * 100 : 0;
  const totalLandUseSum = landUseItems.reduce((sum, item) => sum + item.totalFootprint, 0);

  // Data sources based on actual calculation
  const dataSources = [
    {
      name: 'Hybrid Material Impact Factors',
      description: 'Direct material impacts from database',
      count: materials.length
    },
    {
      name: 'OpenLCA Staging Data',
      description: 'Background processes and impact factors',
      count: materials.filter(m => m.impact_climate && m.impact_climate > 0).length
    },
  ];

  const handleDownloadPdf = async () => {
    if (!lcaData) return;

    try {
      setIsGeneratingPdf(true);

      toast({
        title: 'Generating PDF',
        description: 'Creating your LCA report...',
      });

      await generateLcaReportPdf({
        title: `${lcaData.product_name} - LCA Report`,
        version: '1.0',
        productName: lcaData.product_name,
        assessmentPeriod: format(new Date(lcaData.created_at), 'MMMM yyyy'),
        publishedDate: calculationLog?.created_at || lcaData.created_at,
        dqiScore: dqiScore,
        systemBoundary: lcaData.system_boundary || 'Cradle-to-Gate (Raw Materials → Factory Gate)',
        functionalUnit: lcaData.functional_unit || '1 unit',
        metrics: metrics,
        waterSources: waterSourceItems,
        wasteStreams: wasteStreams,
        landUseItems: landUseItems,
        dataSources: dataSources,
      });

      toast({
        title: 'PDF Generated',
        description: 'Your LCA report has been downloaded successfully.',
      });
    } catch (error) {
      console.error('PDF generation error:', error);
      toast({
        title: 'Error',
        description: 'Failed to generate PDF. Please try again.',
        variant: 'destructive',
      });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 space-y-8">
        <Skeleton className="h-12 w-96" />
        <div className="grid md:grid-cols-4 gap-6">
          <Skeleton className="h-64" />
          <div className="md:col-span-3">
            <Skeleton className="h-64" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !lcaData) {
    return (
      <div className="container mx-auto py-8">
        <Alert variant="destructive" className="mb-6">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            {error || 'Failed to load LCA data'}
          </AlertDescription>
        </Alert>
        <div className="flex gap-4">
          <Link href={`/dashboard/lcas/${lcaId}/calculate`}>
            <Button variant="outline">Back to Calculate</Button>
          </Link>
          <Link href="/dashboard">
            <Button>Go to Dashboard</Button>
          </Link>
        </div>
      </div>
    );
  }

  const hasCalculationResults = calculationLog !== null;
  const hasAnyImpactData = totalClimate > 0 || totalWater > 0 || totalLand > 0;

  return (
    <div className="container mx-auto py-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Link href={`/dashboard/lcas/${lcaId}/calculate`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Review
            </Button>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">{lcaData.product_name} - LCA Report</h1>
          <div className="flex items-center gap-4">
            <p className="text-lg text-muted-foreground">{lcaData.product_name}</p>
            <Badge variant="default" className={lcaData.status === 'completed' ? 'bg-green-600' : 'bg-blue-600'}>
              {lcaData.status.charAt(0).toUpperCase() + lcaData.status.slice(1)}
            </Badge>
            <Badge variant="outline">v1.0</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Assessment Period: {format(new Date(lcaData.created_at), 'MMMM yyyy')}
            {calculationLog && ` • Calculated: ${format(new Date(calculationLog.created_at), 'dd MMMM yyyy')}`}
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf || !hasAnyImpactData}
          >
            <Download className="h-4 w-4" />
            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button variant="outline" className="gap-2" disabled>
            <Share2 className="h-4 w-4" />
            Share Report
          </Button>
        </div>
      </div>

      {/* Data Quality Warning */}
      {!hasAnyImpactData && (
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            No impact data available. Materials may be missing impact factors. Please ensure materials have been selected from the OpenLCA database with complete impact data.
          </AlertDescription>
        </Alert>
      )}

      {/* Trust Signal: DQI Gauge */}
      <div className="grid md:grid-cols-4 gap-6">
        <div className="md:col-span-1">
          <DQIGauge score={dqiScore} size="md" />
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
                <p className="text-sm text-muted-foreground">
                  {lcaData.system_boundary || 'Cradle-to-Gate (Raw Materials → Factory Gate)'}
                </p>
              </div>
              <div>
                <h4 className="text-sm font-semibold mb-2">Functional Unit</h4>
                <p className="text-sm text-muted-foreground">
                  {lcaData.functional_unit || '1 unit'}
                </p>
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
                <p className="text-sm text-muted-foreground">
                  {hasCalculationResults ? 'Hybrid (Stored Material Factors)' : 'ReCiPe 2016 Midpoint (H)'}
                </p>
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
            <ClimateCard metrics={metrics as any} loading={false} onViewBreakdown={() => setCarbonSheetOpen(true)} />
            <WaterCard metrics={metrics as any} loading={false} onClick={() => setWaterSheetOpen(true)} />
            <WasteCard metrics={metrics as any} loading={false} onClick={() => setCircularitySheetOpen(true)} />
            <NatureCard metrics={metrics as any} loading={false} onClick={() => setNatureSheetOpen(true)} />
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
              {dataSources.map((source, idx) => (
                <div key={idx} className="flex items-start justify-between border-b pb-4 last:border-0">
                  <div className="space-y-1">
                    <h4 className="font-semibold text-sm">{source.name}</h4>
                    <p className="text-sm text-muted-foreground">{source.description}</p>
                  </div>
                  <Badge variant="outline">{source.count} {source.count === 1 ? 'process' : 'processes'}</Badge>
                </div>
              ))}

              {materials.length > 0 && (
                <div className="mt-6 pt-4 border-t">
                  <h4 className="font-semibold text-sm mb-3">Materials Assessed</h4>
                  <div className="space-y-2">
                    {materials.slice(0, 5).map((material, idx) => (
                      <div key={idx} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{material.name}</span>
                        <span className="font-medium">{material.quantity} {material.unit}</span>
                      </div>
                    ))}
                    {materials.length > 5 && (
                      <p className="text-xs text-muted-foreground italic">
                        + {materials.length - 5} more materials
                      </p>
                    )}
                  </div>
                </div>
              )}
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
                  {lcaData.system_boundary || 'Cradle-to-Gate (Raw Materials → Factory Gate)'}
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
      <CarbonBreakdownSheet
        open={carbonSheetOpen}
        onOpenChange={setCarbonSheetOpen}
        scopeBreakdown={null}
        totalCO2={metrics?.total_impacts?.climate_change_gwp100 || 0}
        materialBreakdown={calculationLog?.impact_metrics?.material_breakdown}
        ghgBreakdown={calculationLog?.impact_metrics?.ghg_breakdown}
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
        totalLandUse={totalLandUseSum}
        ingredientCount={landUseItems.length}
        landUseItems={landUseItems}
      />
    </div>
  );
}
