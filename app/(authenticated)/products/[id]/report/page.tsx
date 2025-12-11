"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Share2, Eye, EyeOff, Leaf, Droplets, Recycle, MapPin, ThermometerSun, Cloud, Activity, FileText, CheckCircle2, AlertCircle } from 'lucide-react';
import Link from 'next/link';
import { DQIGauge } from '@/components/lca/DQIGauge';
import { CarbonBreakdownSheet } from '@/components/vitality/CarbonBreakdownSheet';
import { WaterImpactSheet } from '@/components/vitality/WaterImpactSheet';
import { CircularitySheet } from '@/components/vitality/CircularitySheet';
import { NatureImpactSheet } from '@/components/vitality/NatureImpactSheet';
import { generateLcaReportPdf } from '@/lib/pdf-generator';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/lib/supabaseClient';

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
  const { toast } = useToast();

  const [carbonSheetOpen, setCarbonSheetOpen] = useState(false);
  const [waterSheetOpen, setWaterSheetOpen] = useState(false);
  const [circularitySheetOpen, setCircularitySheetOpen] = useState(false);
  const [natureSheetOpen, setNatureSheetOpen] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lcaData, setLcaData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      if (!productId) return;

      try {
        setLoading(true);

        const { data: product, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();

        if (productError) {
          console.error('Error fetching product:', productError);
          return;
        }

        setProductData(product);

        const { data: lca, error: lcaError } = await supabase
          .from('product_lcas')
          .select('*')
          .eq('product_id', productId)
          .eq('status', 'completed')
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        if (lcaError) {
          console.error('Error fetching LCA:', lcaError);
          return;
        }

        if (lca) {
          const { data: materials, error: materialsError } = await supabase
            .from('product_lca_materials')
            .select('*')
            .eq('product_lca_id', lca.id);

          if (!materialsError && materials) {
            lca.materials = materials;
          }

          setLcaData(lca);
        }
      } catch (error) {
        console.error('Error fetching data:', error);
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [productId]);

  const impacts = lcaData?.aggregated_impacts || MOCK_METRICS.total_impacts;
  const breakdown = lcaData?.aggregated_impacts?.breakdown;

  const waterConsumption = impacts.water_consumption || MOCK_METRICS.total_impacts.water_consumption;
  const waterScarcityImpact = impacts.water_scarcity_aware || MOCK_METRICS.total_impacts.water_scarcity_aware;

  const waterSourceItems = lcaData?.materials?.length > 0
    ? lcaData.materials.map((material: any, idx: number) => {
        const waterImpact = Number(material.impact_water) || 0;
        const waterScarcity = Number(material.impact_water_scarcity) || 0;

        let riskLevel: 'low' | 'medium' | 'high' = 'low';
        if (waterScarcity > waterImpact * 20) {
          riskLevel = 'high';
        } else if (waterScarcity > waterImpact * 10) {
          riskLevel = 'medium';
        }

        return {
          id: String(idx + 1),
          source: material.name,
          location: material.origin_country || 'Unknown',
          consumption: waterImpact,
          riskFactor: waterScarcity > 0 && waterImpact > 0 ? (waterScarcity / waterImpact) : 10,
          riskLevel: riskLevel,
          netImpact: waterScarcity,
        };
      })
    : [
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
  const estimatedTotalWaste = 0.45;
  const linearWasteMass = estimatedTotalWaste * (100 - circularityPercentage) / 100;
  const circularWasteMass = estimatedTotalWaste * circularityPercentage / 100;

  const wasteStreams = [
    { id: '1', stream: 'Glass Bottle', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000 * 0.72), circularityScore: 100 },
    { id: '2', stream: 'Label (Paper)', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000 * 0.18), circularityScore: 100 },
    { id: '3', stream: 'Cap (Aluminium)', disposition: 'recycling' as const, mass: Math.round(circularWasteMass * 1000 * 0.10), circularityScore: 100 },
    { id: '4', stream: 'Process Waste', disposition: 'landfill' as const, mass: Math.round(linearWasteMass * 1000), circularityScore: 0 },
  ];

  const totalLandUse = impacts.land_use || MOCK_METRICS.total_impacts.land_use;

  const landUseItems = lcaData?.materials?.length > 0
    ? lcaData.materials
        .filter((m: any) => Number(m.impact_land) > 0)
        .map((material: any, idx: number) => {
          const landImpact = Number(material.impact_land) || 0;
          const quantity = Number(material.quantity) || 0;
          const landIntensity = quantity > 0 ? landImpact / quantity : 0;

          return {
            id: String(idx + 1),
            ingredient: material.name,
            origin: material.origin_country || 'Unknown',
            mass: quantity,
            landIntensity: landIntensity,
            totalFootprint: landImpact,
          };
        })
    : [
        { id: '1', ingredient: 'Sugar Beet', origin: 'UK', mass: 0.028, landIntensity: 1.8, totalFootprint: Math.round(0.028 * 1.8 * 1000) / 1000 },
        { id: '2', ingredient: 'Elderflower', origin: 'Austria', mass: 0.004, landIntensity: 0.9, totalFootprint: Math.round(0.004 * 0.9 * 1000) / 1000 },
        { id: '3', ingredient: 'Glass (Silica Sand)', origin: 'Spain', mass: 0.250, landIntensity: 5.2, totalFootprint: Math.round(0.250 * 5.2 * 1000) / 1000 },
        { id: '4', ingredient: 'Citric Acid', origin: 'China', mass: 0.002, landIntensity: 12.5, totalFootprint: Math.round(0.002 * 12.5 * 1000) / 1000 },
      ];

  const totalWaterConsumption = waterSourceItems.reduce((sum: number, item: any) => sum + item.consumption, 0);
  const totalWaterImpact = waterSourceItems.reduce((sum: number, item: any) => sum + item.netImpact, 0);
  const totalWaste = wasteStreams.reduce((sum: number, item: any) => sum + item.mass, 0) / 1000;
  const circularWaste = wasteStreams.reduce((sum: number, item: any) => sum + (item.mass * item.circularityScore / 100), 0) / 1000;
  const circularityRate = (circularWaste / totalWaste) * 100;
  const totalLandUseSum = landUseItems.reduce((sum: number, item: any) => sum + item.totalFootprint, 0);

  const handleDownloadPdf = async () => {
    try {
      setIsGeneratingPdf(true);

      toast({
        title: 'Generating PDF',
        description: 'Creating your LCA report...',
      });

      await generateLcaReportPdf({
        title: displayTitle,
        version: displayVersion,
        productName: displayProductName,
        assessmentPeriod: displayPeriod,
        publishedDate: displayPublished,
        dqiScore: displayDqi,
        systemBoundary: displayBoundary,
        functionalUnit: displayFunctionalUnit,
        metrics: lcaData?.aggregated_impacts ? { ...MOCK_METRICS, total_impacts: lcaData.aggregated_impacts } : MOCK_METRICS,
        waterSources: waterSourceItems,
        wasteStreams: wasteStreams,
        landUseItems: landUseItems,
        dataSources: DATA_SOURCES,
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

  const displayTitle = lcaData ? '2025 Product Impact Assessment' : MOCK_LCA_REPORT.title;
  const displayProductName = productData?.name || lcaData?.product_name || MOCK_LCA_REPORT.product_name;
  const displayStatus = lcaData?.status || MOCK_LCA_REPORT.status;
  const displayVersion = lcaData?.lca_version || MOCK_LCA_REPORT.version;
  const displayPeriod = lcaData ? `${new Date(lcaData.reference_year, 0).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}` : MOCK_LCA_REPORT.assessment_period;
  const displayPublished = lcaData?.updated_at ? new Date(lcaData.updated_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }) : new Date(MOCK_LCA_REPORT.published_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const displayDqi = lcaData?.dqi_score || MOCK_LCA_REPORT.dqi_score;
  const displayBoundary = lcaData?.system_boundary || MOCK_LCA_REPORT.system_boundary;
  const displayFunctionalUnit = lcaData?.functional_unit || MOCK_LCA_REPORT.functional_unit;

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Link href={`/products/${productId}`}>
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Product
            </Button>
          </Link>
          <h1 className="text-4xl font-bold tracking-tight">{displayTitle}</h1>
          <div className="flex items-center gap-4">
            <p className="text-lg text-muted-foreground">{displayProductName}</p>
            <Badge variant="default" className="bg-green-600">
              {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
            </Badge>
            <Badge variant="outline">v{displayVersion}</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Assessment Period: {displayPeriod} • Published: {displayPublished}
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Button
            variant="outline"
            className="gap-2"
            onClick={handleDownloadPdf}
            disabled={isGeneratingPdf}
          >
            <Download className="h-4 w-4" />
            {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
          </Button>
          <Button variant="outline" className="gap-2">
            <Share2 className="h-4 w-4" />
            Share Report
          </Button>
        </div>
      </div>

      {/* Bento Box Grid Layout */}
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* DQI Score - 1x2 */}
        <Card className="col-span-1 bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/20 dark:to-cyan-950/20 border-blue-200 dark:border-blue-800">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center">
            <DQIGauge score={displayDqi} size="sm" />
            <p className="text-xs text-center text-muted-foreground mt-3">
              High confidence with full traceability
            </p>
          </CardContent>
        </Card>

        {/* Climate Impact - 1x2 */}
        <Card className="col-span-1 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCarbonSheetOpen(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Cloud className="h-4 w-4 text-green-600" />
              Climate Change
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-3xl font-bold text-green-600">
                  {impacts.climate_change_gwp100.toFixed(3)}
                </div>
                <div className="text-xs text-muted-foreground">kg CO₂eq per unit</div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-xs font-medium mb-1">GHG Protocol Compliant</div>
                <Badge variant="outline" className="text-xs">ISO 14067</Badge>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Water Consumption - 1x2 */}
        <Card className="col-span-1 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setWaterSheetOpen(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Droplets className="h-4 w-4 text-blue-600" />
              Water Impact
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-3xl font-bold text-blue-600">
                  {waterConsumption.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">Litres consumed</div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-xs text-muted-foreground">Scarcity-weighted</div>
                <div className="text-sm font-semibold">{waterScarcityImpact.toFixed(2)} m³ world eq</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Circularity - 1x2 */}
        <Card className="col-span-1 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setCircularitySheetOpen(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Recycle className="h-4 w-4 text-amber-600" />
              Circularity
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-3xl font-bold text-amber-600">
                  {circularityPercentage}%
                </div>
                <div className="text-xs text-muted-foreground">Material recovery rate</div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-xs text-muted-foreground">Total waste</div>
                <div className="text-sm font-semibold">{totalWaste.toFixed(3)} kg per unit</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Boundary - 2x1 */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-600" />
              System Boundary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm mb-4">{displayBoundary}</p>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-3 border rounded-lg bg-green-50 dark:bg-green-950/20 border-green-200 dark:border-green-800">
                <h5 className="font-semibold text-xs mb-2 flex items-center gap-1 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-3 w-3" />
                  Included
                </h5>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Raw material extraction</li>
                  <li>• Primary production</li>
                  <li>• Packaging manufacture</li>
                  <li>• Factory operations</li>
                </ul>
              </div>
              <div className="p-3 border rounded-lg bg-slate-50 dark:bg-slate-950/20 border-slate-200 dark:border-slate-800">
                <h5 className="font-semibold text-xs mb-2 flex items-center gap-1 text-slate-700 dark:text-slate-400">
                  <EyeOff className="h-3 w-3" />
                  Excluded
                </h5>
                <ul className="text-xs text-muted-foreground space-y-1">
                  <li>• Distribution to retailers</li>
                  <li>• Consumer use phase</li>
                  <li>• End-of-life disposal</li>
                  <li>• Capital goods</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Land Use - 1x2 */}
        <Card className="col-span-1 hover:shadow-lg transition-shadow cursor-pointer" onClick={() => setNatureSheetOpen(true)}>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <MapPin className="h-4 w-4 text-emerald-600" />
              Land Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-3xl font-bold text-emerald-600">
                  {totalLandUse.toFixed(2)}
                </div>
                <div className="text-xs text-muted-foreground">m² per unit</div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-xs font-medium mb-1">Agricultural footprint</div>
                <div className="text-xs text-muted-foreground">{landUseItems.length} materials tracked</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Resource Scarcity - 1x2 */}
        <Card className="col-span-1">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <ThermometerSun className="h-4 w-4 text-orange-600" />
              Resource Use
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <div>
                <div className="text-3xl font-bold text-orange-600">
                  {impacts.fossil_resource_scarcity?.toFixed(3) || '0.035'}
                </div>
                <div className="text-xs text-muted-foreground">kg oil eq</div>
              </div>
              <div className="pt-3 border-t">
                <div className="text-xs font-medium mb-1">Fossil resources</div>
                <div className="text-xs text-muted-foreground">Energy and materials</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Standards - 2x1 */}
        <Card className="col-span-1 md:col-span-2">
          <CardHeader>
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <FileText className="h-4 w-4 text-slate-600" />
              Compliance Framework
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div>
                <h4 className="text-xs font-semibold mb-2">Standards</h4>
                <div className="flex flex-wrap gap-2">
                  <Badge variant="outline" className="text-xs">ISO 14044:2006</Badge>
                  <Badge variant="outline" className="text-xs">ISO 14067:2018</Badge>
                  <Badge variant="outline" className="text-xs">CSRD E1</Badge>
                  <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                </div>
              </div>
              <div>
                <h4 className="text-xs font-semibold mb-2">Assessment Method</h4>
                <p className="text-xs text-muted-foreground">ReCiPe 2016 Midpoint (H) - Hierarchist perspective</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Functional Unit - 1x2 */}
        <Card className="col-span-1">
          <CardHeader>
            <CardTitle className="text-sm font-medium">Functional Unit</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-xl font-bold mb-1">{displayFunctionalUnit}</div>
            <p className="text-xs text-muted-foreground">
              All environmental impacts are calculated per functional unit
            </p>
          </CardContent>
        </Card>

        {/* Data Provenance - Full Width */}
        <Card className="col-span-full">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              Data Provenance & Transparency
            </CardTitle>
            <CardDescription>
              Complete traceability of all data sources used in this assessment
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
              {DATA_SOURCES.map((source, idx) => (
                <div key={idx} className="p-4 border rounded-lg bg-slate-50 dark:bg-slate-900/50">
                  <div className="flex items-start justify-between mb-2">
                    <h4 className="font-semibold text-sm">{source.name}</h4>
                    <Badge variant="secondary" className="text-xs">{source.count}</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{source.description}</p>
                </div>
              ))}
            </div>
            <div className="mt-4 p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded-lg">
              <div className="flex items-start gap-2">
                <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                <div>
                  <h5 className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">Cut-off Criteria</h5>
                  <p className="text-xs text-amber-800 dark:text-amber-200">
                    Processes contributing less than 1% to total impact and cumulatively less than 5% were excluded per ISO 14044 requirements.
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Evidence Drawers */}
      <CarbonBreakdownSheet
        open={carbonSheetOpen}
        onOpenChange={setCarbonSheetOpen}
        scopeBreakdown={breakdown?.by_scope ? {
          scope1: breakdown.by_scope.scope1 || 0,
          scope2: breakdown.by_scope.scope2 || 0,
          scope3: breakdown.by_scope.scope3 || 0,
        } : null}
        totalCO2={impacts.climate_change_gwp100 || 0}
        materialBreakdown={breakdown?.by_material?.map((m: any) => ({
          name: m.name,
          quantity: m.quantity,
          unit: m.unit,
          climate: m.emissions,
          source: m.dataSource,
        }))}
        ghgBreakdown={breakdown?.by_ghg ? {
          carbon_origin: {
            fossil: breakdown.by_ghg.co2_fossil || 0,
            biogenic: breakdown.by_ghg.co2_biogenic || 0,
            land_use_change: 0,
          },
          gas_inventory: {
            co2_fossil: breakdown.by_ghg.co2_fossil || 0,
            co2_biogenic: breakdown.by_ghg.co2_biogenic || 0,
            methane: breakdown.by_ghg.ch4 || 0,
            nitrous_oxide: breakdown.by_ghg.n2o || 0,
            hfc_pfc: 0,
          },
          gwp_factors: {
            methane_gwp100: 28,
            n2o_gwp100: 265,
            method: 'IPCC AR6',
          },
        } : null}
        lifecycleStageBreakdown={breakdown?.by_lifecycle_stage ? [
          { stage_name: 'Raw Materials', sub_stage_name: null, total_impact: breakdown.by_lifecycle_stage.raw_materials, percentage: 0, material_count: 0, top_contributors: [] },
          { stage_name: 'Processing', sub_stage_name: null, total_impact: breakdown.by_lifecycle_stage.processing, percentage: 0, material_count: 0, top_contributors: [] },
          { stage_name: 'Packaging', sub_stage_name: null, total_impact: breakdown.by_lifecycle_stage.packaging_stage, percentage: 0, material_count: 0, top_contributors: [] },
          { stage_name: 'Distribution', sub_stage_name: null, total_impact: breakdown.by_lifecycle_stage.distribution, percentage: 0, material_count: 0, top_contributors: [] },
          { stage_name: 'Use Phase', sub_stage_name: null, total_impact: breakdown.by_lifecycle_stage.use_phase, percentage: 0, material_count: 0, top_contributors: [] },
          { stage_name: 'End of Life', sub_stage_name: null, total_impact: breakdown.by_lifecycle_stage.end_of_life, percentage: 0, material_count: 0, top_contributors: [] },
        ] : undefined}
        facilityEmissionsBreakdown={breakdown?.by_facility?.map((f: any) => ({
          facility_name: f.facility_name,
          emissions: f.emissions,
          percentage: f.percentage,
          scope_1: f.scope1,
          scope_2: f.scope2,
        }))}
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
