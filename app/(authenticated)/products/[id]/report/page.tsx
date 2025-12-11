"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Share2, Eye, Leaf, Droplets, Recycle, MapPin, ThermometerSun, Cloud, Activity, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp, Info, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import Link from 'next/link';
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

  const [expandedCard, setExpandedCard] = useState<string | null>(null);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const [lcaData, setLcaData] = useState<any>(null);
  const [productData, setProductData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [productImageUrl, setProductImageUrl] = useState<string | null>(null);

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

        if (product?.main_image_path) {
          const { data: { publicUrl } } = supabase.storage
            .from('product_images')
            .getPublicUrl(product.main_image_path);
          setProductImageUrl(publicUrl);
        }

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

  // Calculate scope breakdowns (use real data, not mocks)
  const scope1 = breakdown?.by_scope?.scope1 || 0;
  const scope2 = breakdown?.by_scope?.scope2 || 0;
  const scope3 = breakdown?.by_scope?.scope3 || 0;
  const totalEmissions = impacts.climate_change_gwp100;

  // Check if we have facility data
  const hasFacilityData = scope1 > 0 || scope2 > 0;

  // Lifecycle stage breakdowns (use real data)
  const lifecycleStages = breakdown?.by_lifecycle_stage || {
    raw_materials: 0,
    processing: 0,
    packaging_stage: 0,
    distribution: 0,
    use_phase: 0,
    end_of_life: 0,
  };

  return (
    <div className="container mx-auto py-8 space-y-8">
      <Link href={`/products/${productId}`}>
        <Button variant="ghost" size="sm" className="gap-2 mb-4">
          <ArrowLeft className="h-4 w-4" />
          Back to Product
        </Button>
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-1">
          {productImageUrl ? (
            <div className="relative rounded-2xl overflow-hidden shadow-lg h-80 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800">
              <img
                src={productImageUrl}
                alt={displayProductName}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="relative rounded-2xl overflow-hidden shadow-lg h-80 bg-gradient-to-br from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-800 flex items-center justify-center">
              <div className="text-center">
                <FileText className="h-16 w-16 text-slate-300 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">No image available</p>
              </div>
            </div>
          )}
        </div>

        <div className="lg:col-span-2 space-y-6">
          <div className="space-y-3">
            <div className="flex items-start justify-between gap-4">
              <div className="space-y-2">
                <h1 className="text-4xl font-bold tracking-tight">{displayTitle}</h1>
                <p className="text-xl text-muted-foreground">{displayProductName}</p>
              </div>
              <div className="flex gap-2">
                <Badge className="bg-emerald-600 hover:bg-emerald-700">
                  {displayStatus.charAt(0).toUpperCase() + displayStatus.slice(1)}
                </Badge>
                <Badge variant="outline">v{displayVersion}</Badge>
              </div>
            </div>
            <p className="text-sm text-muted-foreground">
              Cradle-to-gate assessment • {displayPeriod} • Published {displayPublished}
            </p>
          </div>

          {/* Functional Unit - Prominent Display */}
          <div className="p-4 rounded-lg bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-2 border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                <Info className="h-5 w-5 text-blue-700 dark:text-blue-400" />
              </div>
              <div>
                <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Functional Unit</p>
                <p className="text-lg font-bold mb-1">{displayFunctionalUnit}</p>
                <p className="text-xs text-muted-foreground">
                  All environmental impacts in this report are calculated per functional unit. This ensures fair comparison across different products and brands.
                </p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Assessment Period</p>
              <p className="text-sm font-medium">{displayPeriod}</p>
            </div>

            {/* Data Quality - Small Card */}
            <div
              className="p-4 rounded-lg bg-slate-50 dark:bg-slate-950/20 border border-slate-200 dark:border-slate-800 cursor-pointer hover:shadow-md transition-all"
              onClick={() => setExpandedCard(expandedCard === 'dqi' ? null : 'dqi')}
            >
              <div className="flex items-center justify-between mb-1">
                <p className="text-xs font-semibold text-slate-700 dark:text-slate-400">Data Quality</p>
                {expandedCard === 'dqi' ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
              </div>
              <p className="text-2xl font-bold text-blue-700 dark:text-blue-400">{displayDqi}%</p>
              <p className="text-xs text-muted-foreground">Click for details</p>
            </div>
          </div>

          {/* Expanded Data Quality Explanation */}
          {expandedCard === 'dqi' && (
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800 space-y-3">
              <h4 className="font-semibold text-sm flex items-center gap-2">
                <Activity className="h-4 w-4" />
                Understanding Data Quality
              </h4>
              <p className="text-xs text-muted-foreground">
                Data Quality Index (DQI) measures the reliability and accuracy of the environmental data used in this assessment. A score of {displayDqi}% indicates high-quality, traceable data.
              </p>
              <div className="space-y-2">
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="h-4 w-4 text-green-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">90-100%: Excellent</p>
                    <p className="text-xs text-muted-foreground">Primary data from verified suppliers with full traceability</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <Minus className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">70-89%: Good</p>
                    <p className="text-xs text-muted-foreground">Mix of primary and secondary data from reliable databases</p>
                  </div>
                </div>
                <div className="flex items-start gap-2">
                  <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-semibold">Below 70%: Needs Improvement</p>
                    <p className="text-xs text-muted-foreground">Significant use of industry averages or estimates</p>
                  </div>
                </div>
              </div>
              <div className="pt-2 border-t">
                <p className="text-xs font-semibold mb-2">How to improve:</p>
                <ul className="text-xs text-muted-foreground space-y-1 list-disc list-inside">
                  <li>Request Environmental Product Declarations (EPDs) from suppliers</li>
                  <li>Replace generic database values with supplier-specific data</li>
                  <li>Verify origin locations and transport distances</li>
                  <li>Obtain energy consumption data from production facilities</li>
                </ul>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button
              className="gap-2 bg-blue-600 hover:bg-blue-700"
              onClick={handleDownloadPdf}
              disabled={isGeneratingPdf}
            >
              <Download className="h-4 w-4" />
              {isGeneratingPdf ? 'Generating...' : 'Download PDF'}
            </Button>
            <Button variant="outline" className="gap-2">
              <Share2 className="h-4 w-4" />
              Share
            </Button>
          </div>
        </div>
      </div>

      {/* Impact Cards Grid */}
      <div className="space-y-6">
        <h2 className="text-2xl font-bold">Environmental Impact Summary</h2>

        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
          {/* Climate Impact - Comprehensive Expandable */}
          <div className={`${expandedCard === 'climate' ? 'md:col-span-4' : 'col-span-1'} transition-all duration-300`}>
            <Card
              className="bg-gradient-to-br from-green-50 to-emerald-50 dark:from-green-950/30 dark:to-emerald-950/30 border-green-200 dark:border-green-800/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => setExpandedCard(expandedCard === 'climate' ? null : 'climate')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-green-100 dark:bg-green-900/50 rounded-lg">
                      <Cloud className="h-4 w-4 text-green-700 dark:text-green-400" />
                    </div>
                    Climate Impact (GHG Protocol)
                  </div>
                  {expandedCard === 'climate' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-green-700 dark:text-green-400">
                      {impacts.climate_change_gwp100.toFixed(3)}
                    </div>
                    <div className="text-xs text-muted-foreground">kg CO₂eq per unit</div>
                  </div>

                  {expandedCard === 'climate' && (
                    <div className="space-y-6 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">
                          This product generates {impacts.climate_change_gwp100.toFixed(3)} kg of greenhouse gas emissions per {displayFunctionalUnit}. This includes all direct and indirect emissions across the supply chain.
                        </p>
                      </div>

                      {/* Scope Breakdown - GHG Protocol Compliant */}
                      <div>
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                          Emissions by Scope
                        </h4>

                        {!hasFacilityData && totalEmissions > 0 && (
                          <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                            <div className="flex items-start gap-2">
                              <AlertCircle className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                              <div>
                                <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">Production Site Data Missing</p>
                                <p className="text-xs text-amber-800 dark:text-amber-200">
                                  Scope 1 & 2 emissions require production site allocation. Visit the <strong>Production Sites</strong> tab to link facilities and calculate manufacturing emissions.
                                </p>
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-xs font-semibold">Scope 1: Direct Emissions</p>
                                <p className="text-xs text-muted-foreground">Emissions from owned or controlled sources</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">{scope1.toFixed(3)} kg</p>
                                <p className="text-xs text-muted-foreground">{((scope1 / totalEmissions) * 100).toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div className="bg-red-500 h-2 rounded-full" style={{ width: `${(scope1 / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-xs font-semibold">Scope 2: Energy Indirect Emissions</p>
                                <p className="text-xs text-muted-foreground">Emissions from purchased electricity, heat, or steam</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">{scope2.toFixed(3)} kg</p>
                                <p className="text-xs text-muted-foreground">{((scope2 / totalEmissions) * 100).toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div className="bg-orange-500 h-2 rounded-full" style={{ width: `${(scope2 / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-start mb-2">
                              <div>
                                <p className="text-xs font-semibold">Scope 3: Value Chain Emissions</p>
                                <p className="text-xs text-muted-foreground">All other indirect emissions in supply chain</p>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold">{scope3.toFixed(3)} kg</p>
                                <p className="text-xs text-muted-foreground">{((scope3 / totalEmissions) * 100).toFixed(1)}%</p>
                              </div>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                              <div className="bg-amber-500 h-2 rounded-full" style={{ width: `${(scope3 / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Lifecycle Stage Breakdown - ISO 14044 Compliant */}
                      <div>
                        <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                          <Badge variant="outline" className="text-xs">ISO 14044</Badge>
                          Emissions by Lifecycle Stage
                        </h4>

                        {!hasFacilityData && totalEmissions > 0 && (
                          <p className="text-xs text-muted-foreground mb-3 italic">
                            Note: Processing stage emissions are currently 0 because production site data has not been linked. This data comes from facility-level Scope 1 & 2 reporting.
                          </p>
                        )}

                        <div className="grid md:grid-cols-2 gap-3">
                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium">Raw Materials</span>
                              <span className="text-sm font-bold">{lifecycleStages.raw_materials.toFixed(3)} kg</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                              <div className="bg-green-600 h-1.5 rounded-full" style={{ width: `${(lifecycleStages.raw_materials / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium">Processing</span>
                              <span className="text-sm font-bold">{lifecycleStages.processing.toFixed(3)} kg</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                              <div className="bg-blue-600 h-1.5 rounded-full" style={{ width: `${(lifecycleStages.processing / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium">Packaging</span>
                              <span className="text-sm font-bold">{lifecycleStages.packaging_stage.toFixed(3)} kg</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                              <div className="bg-amber-600 h-1.5 rounded-full" style={{ width: `${(lifecycleStages.packaging_stage / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>

                          <div className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                            <div className="flex justify-between items-center">
                              <span className="text-xs font-medium">Distribution</span>
                              <span className="text-sm font-bold">{lifecycleStages.distribution.toFixed(3)} kg</span>
                            </div>
                            <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-1.5 mt-2">
                              <div className="bg-orange-600 h-1.5 rounded-full" style={{ width: `${(lifecycleStages.distribution / totalEmissions) * 100}%` }}></div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* GHG Gas Breakdown - IPCC AR6 */}
                      {breakdown?.by_ghg && (
                        <div>
                          <h4 className="font-semibold text-sm mb-3 flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">IPCC AR6</Badge>
                            Breakdown by Greenhouse Gas
                          </h4>
                          <div className="space-y-2">
                            <div className="flex justify-between text-xs p-2 rounded bg-white dark:bg-slate-900/50">
                              <div>
                                <span className="font-medium">Carbon Dioxide (Fossil)</span>
                                <p className="text-muted-foreground">From burning fossil fuels</p>
                              </div>
                              <span className="font-bold">{(breakdown.by_ghg.co2_fossil || 0).toFixed(3)} kg</span>
                            </div>
                            <div className="flex justify-between text-xs p-2 rounded bg-white dark:bg-slate-900/50">
                              <div>
                                <span className="font-medium">Carbon Dioxide (Biogenic)</span>
                                <p className="text-muted-foreground">From biological sources</p>
                              </div>
                              <span className="font-bold">{(breakdown.by_ghg.co2_biogenic || 0).toFixed(3)} kg</span>
                            </div>
                            <div className="flex justify-between text-xs p-2 rounded bg-white dark:bg-slate-900/50">
                              <div>
                                <span className="font-medium">Methane (CH₄)</span>
                                <p className="text-muted-foreground">28× more potent than CO₂</p>
                              </div>
                              <span className="font-bold">{(breakdown.by_ghg.ch4 || 0).toFixed(3)} kg CO₂eq</span>
                            </div>
                            <div className="flex justify-between text-xs p-2 rounded bg-white dark:bg-slate-900/50">
                              <div>
                                <span className="font-medium">Nitrous Oxide (N₂O)</span>
                                <p className="text-muted-foreground">265× more potent than CO₂</p>
                              </div>
                              <span className="font-bold">{(breakdown.by_ghg.n2o || 0).toFixed(3)} kg CO₂eq</span>
                            </div>
                          </div>
                        </div>
                      )}

                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">What is CO₂eq?</p>
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              CO₂ equivalent (CO₂eq) converts all greenhouse gases into a common unit based on their global warming potential over 100 years. This allows us to compare the climate impact of different gases on a level playing field.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Water Impact - Comprehensive Expandable */}
          <div className={`${expandedCard === 'water' ? 'md:col-span-4' : 'col-span-1'} transition-all duration-300`}>
            <Card
              className="bg-gradient-to-br from-blue-50 to-cyan-50 dark:from-blue-950/30 dark:to-cyan-950/30 border-blue-200 dark:border-blue-800/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => setExpandedCard(expandedCard === 'water' ? null : 'water')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-blue-100 dark:bg-blue-900/50 rounded-lg">
                      <Droplets className="h-4 w-4 text-blue-700 dark:text-blue-400" />
                    </div>
                    Water Footprint
                  </div>
                  {expandedCard === 'water' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-blue-700 dark:text-blue-400">
                      {waterConsumption.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">Litres consumed</div>
                  </div>

                  {expandedCard === 'water' && (
                    <div className="space-y-6 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">
                          This product uses {waterConsumption.toFixed(1)} litres of water across its lifecycle. Water scarcity varies by region, so we assess both consumption and location-specific scarcity impacts.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-3">Water Sources by Location</h4>
                        <div className="space-y-3">
                          {waterSourceItems.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-sm">{item.source}</p>
                                    <Badge variant={item.riskLevel === 'high' ? 'destructive' : item.riskLevel === 'medium' ? 'default' : 'secondary'} className="text-xs">
                                      {item.riskLevel} risk
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground">{item.location}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold">{item.consumption.toFixed(2)}L</p>
                                  <p className="text-xs text-muted-foreground">Scarcity: {item.netImpact.toFixed(2)}L eq</p>
                                </div>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${
                                    item.riskLevel === 'high' ? 'bg-red-500' :
                                    item.riskLevel === 'medium' ? 'bg-amber-500' :
                                    'bg-green-500'
                                  }`}
                                  style={{ width: `${(item.consumption / totalWaterConsumption) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-blue-900 dark:text-blue-100 mb-1">Understanding Water Scarcity</p>
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              Water scarcity measures the impact of water use in water-stressed regions. A litre used in a water-scarce region (like Spain) has a much higher environmental impact than the same litre used in a water-abundant region (like the UK).
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Circularity - Comprehensive Expandable */}
          <div className={`${expandedCard === 'circularity' ? 'md:col-span-4' : 'col-span-1'} transition-all duration-300`}>
            <Card
              className="bg-gradient-to-br from-amber-50 to-orange-50 dark:from-amber-950/30 dark:to-orange-950/30 border-amber-200 dark:border-amber-800/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => setExpandedCard(expandedCard === 'circularity' ? null : 'circularity')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-amber-100 dark:bg-amber-900/50 rounded-lg">
                      <Recycle className="h-4 w-4 text-amber-700 dark:text-amber-400" />
                    </div>
                    Circularity & Waste
                  </div>
                  {expandedCard === 'circularity' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-amber-700 dark:text-amber-400">
                      {circularityPercentage}%
                    </div>
                    <div className="text-xs text-muted-foreground">Recovery rate</div>
                  </div>

                  {expandedCard === 'circularity' && (
                    <div className="space-y-6 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">
                          {circularityPercentage}% of this product can be recovered through recycling or composting at end-of-life, diverting {(circularWaste * 1000).toFixed(0)}g of waste from landfill.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-3">Waste Stream Analysis</h4>
                        <div className="space-y-3">
                          {wasteStreams.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <p className="font-medium text-sm">{item.stream}</p>
                                    <Badge variant={item.circularityScore === 100 ? 'secondary' : 'destructive'} className="text-xs">
                                      {item.circularityScore}% circular
                                    </Badge>
                                  </div>
                                  <p className="text-xs text-muted-foreground capitalize">{item.disposition}</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold">{item.mass}g</p>
                                  <p className="text-xs text-muted-foreground">{((item.mass / (totalWaste * 1000)) * 100).toFixed(1)}%</p>
                                </div>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className={`h-2 rounded-full ${item.circularityScore === 100 ? 'bg-green-500' : 'bg-red-500'}`}
                                  style={{ width: `${(item.mass / (totalWaste * 1000)) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-amber-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-amber-900 dark:text-amber-100 mb-1">Improving Circularity</p>
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                              To improve circularity: design for disassembly, use mono-materials where possible, increase recycled content, and support infrastructure for collection and recycling.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Land Use - Comprehensive Expandable */}
          <div className={`${expandedCard === 'land' ? 'md:col-span-4' : 'col-span-1'} transition-all duration-300`}>
            <Card
              className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-950/30 dark:to-teal-950/30 border-emerald-200 dark:border-emerald-800/50 hover:shadow-lg transition-all duration-200 cursor-pointer"
              onClick={() => setExpandedCard(expandedCard === 'land' ? null : 'land')}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm font-semibold flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <div className="p-2 bg-emerald-100 dark:bg-emerald-900/50 rounded-lg">
                      <MapPin className="h-4 w-4 text-emerald-700 dark:text-emerald-400" />
                    </div>
                    Land Use Impact
                  </div>
                  {expandedCard === 'land' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div>
                    <div className="text-3xl font-bold text-emerald-700 dark:text-emerald-400">
                      {totalLandUse.toFixed(1)}
                    </div>
                    <div className="text-xs text-muted-foreground">m² per unit</div>
                  </div>

                  {expandedCard === 'land' && (
                    <div className="space-y-6 pt-4 border-t">
                      <div>
                        <p className="text-sm text-muted-foreground mb-4">
                          This product requires {totalLandUse.toFixed(1)} square metres of agricultural and industrial land. This includes land for growing ingredients, extracting raw materials, and manufacturing.
                        </p>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm mb-3">Land Use by Ingredient</h4>
                        <div className="space-y-3">
                          {landUseItems.map((item) => (
                            <div key={item.id} className="p-3 rounded-lg bg-white dark:bg-slate-900/50 border">
                              <div className="flex justify-between items-start mb-2">
                                <div className="flex-1">
                                  <p className="font-medium text-sm">{item.ingredient}</p>
                                  <p className="text-xs text-muted-foreground">{item.origin} • {(item.mass * 1000).toFixed(0)}g</p>
                                </div>
                                <div className="text-right">
                                  <p className="text-sm font-bold">{item.totalFootprint.toFixed(2)}m²</p>
                                  <p className="text-xs text-muted-foreground">{(item.landIntensity * 1000).toFixed(1)}m²/kg</p>
                                </div>
                              </div>
                              <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-full h-2">
                                <div
                                  className="bg-emerald-600 h-2 rounded-full"
                                  style={{ width: `${(item.totalFootprint / totalLandUseSum) * 100}%` }}
                                ></div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      <div className="p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
                        <div className="flex items-start gap-2">
                          <Info className="h-4 w-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                          <div>
                            <p className="text-xs font-semibold text-emerald-900 dark:text-emerald-100 mb-1">Why Land Use Matters</p>
                            <p className="text-xs text-emerald-800 dark:text-emerald-200">
                              Land use affects biodiversity, carbon storage, and ecosystem services. Intensive agriculture can lead to habitat loss, while sustainable practices can support wildlife and soil health.
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Resource Scarcity - Non-expandable */}
          <Card className="col-span-1 bg-gradient-to-br from-orange-50 to-red-50 dark:from-orange-950/30 dark:to-red-950/30 border-orange-200 dark:border-orange-800/50 hover:shadow-lg hover:scale-105 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <div className="p-2 bg-orange-100 dark:bg-orange-900/50 rounded-lg">
                  <ThermometerSun className="h-4 w-4 text-orange-700 dark:text-orange-400" />
                </div>
                Resources
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <div>
                  <div className="text-3xl font-bold text-orange-700 dark:text-orange-400">
                    {impacts.fossil_resource_scarcity?.toFixed(3) || '0.035'}
                  </div>
                  <div className="text-xs text-muted-foreground">kg oil equivalent</div>
                </div>
                <p className="text-xs text-muted-foreground pt-2">
                  Fossil fuel use across supply chain
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Compliance Information */}
        <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 mt-6">
          {/* System Boundary */}
          <Card className="bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30 border-slate-200 dark:border-slate-800/50">
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
                System Boundary
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                <div className="p-3 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50">
                  <h5 className="font-semibold text-xs mb-2 flex items-center gap-2 text-green-700 dark:text-green-400">
                    <CheckCircle2 className="h-4 w-4" />
                    Included
                  </h5>
                  <ul className="text-xs text-muted-foreground space-y-1">
                    <li>• Raw material extraction</li>
                    <li>• Primary production</li>
                    <li>• Packaging manufacture</li>
                    <li>• Factory operations</li>
                  </ul>
                </div>
                <div className="p-3 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                  <h5 className="font-semibold text-xs mb-2 flex items-center gap-2 text-red-700 dark:text-red-400">
                    <AlertCircle className="h-4 w-4" />
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

          {/* Compliance Standards */}
          <Card className="md:col-span-2">
            <CardHeader>
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4 text-slate-600" />
                Compliance & Standards
              </CardTitle>
              <CardDescription className="text-xs">
                This assessment meets international reporting requirements
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div>
                  <h4 className="text-xs font-semibold mb-2">Reporting Standards</h4>
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
                <div>
                  <h4 className="text-xs font-semibold mb-2">Third-Party Review</h4>
                  <p className="text-xs text-muted-foreground">Internal review completed • External verification pending</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Provenance */}
        <Card className="mt-6">
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
    </div>
  );
}
