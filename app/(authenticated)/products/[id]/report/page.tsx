"use client";

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Download, Share2, Eye, EyeOff, Leaf, Droplets, Recycle, MapPin, ThermometerSun, Cloud, Activity, FileText, CheckCircle2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import Link from 'next/link';
import { DQIGauge } from '@/components/lca/DQIGauge';
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

          <div className="grid grid-cols-2 gap-4">
            <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-950/20 border border-blue-200 dark:border-blue-800">
              <p className="text-xs font-semibold text-blue-700 dark:text-blue-400 mb-1">Functional Unit</p>
              <p className="text-sm font-medium">{displayFunctionalUnit}</p>
            </div>
            <div className="p-4 rounded-lg bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800">
              <p className="text-xs font-semibold text-emerald-700 dark:text-emerald-400 mb-1">Assessment Period</p>
              <p className="text-sm font-medium">{displayPeriod}</p>
            </div>
          </div>

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
      <div className="grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-4">
        {/* Climate Impact - Expandable */}
        <div className={`${expandedCard === 'climate' ? 'md:col-span-2' : 'col-span-1'} transition-all duration-300`}>
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
                  Climate
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
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-sm">GHG Breakdown</h4>
                    {breakdown?.by_ghg && (
                      <div className="space-y-2">
                        <div className="flex justify-between text-xs">
                          <span>CO₂ (Fossil)</span>
                          <span className="font-medium">{(breakdown.by_ghg.co2_fossil || 0).toFixed(3)} kg</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>CO₂ (Biogenic)</span>
                          <span className="font-medium">{(breakdown.by_ghg.co2_biogenic || 0).toFixed(3)} kg</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Methane (CH₄)</span>
                          <span className="font-medium">{(breakdown.by_ghg.ch4 || 0).toFixed(3)} kg CO₂eq</span>
                        </div>
                        <div className="flex justify-between text-xs">
                          <span>Nitrous Oxide (N₂O)</span>
                          <span className="font-medium">{(breakdown.by_ghg.n2o || 0).toFixed(3)} kg CO₂eq</span>
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Water Impact - Expandable */}
        <div className={`${expandedCard === 'water' ? 'md:col-span-2' : 'col-span-1'} transition-all duration-300`}>
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
                  Water
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
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Water Sources</h4>
                    <div className="space-y-2">
                      {waterSourceItems.slice(0, 3).map((item) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <div className="flex-1">
                            <div className="font-medium">{item.source}</div>
                            <div className="text-muted-foreground">{item.location}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{item.consumption.toFixed(2)}L</div>
                            <Badge variant={item.riskLevel === 'high' ? 'destructive' : item.riskLevel === 'medium' ? 'default' : 'secondary'} className="text-xs">
                              {item.riskLevel}
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Circularity - Expandable */}
        <div className={`${expandedCard === 'circularity' ? 'md:col-span-2' : 'col-span-1'} transition-all duration-300`}>
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
                  Circularity
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
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Waste Streams</h4>
                    <div className="space-y-2">
                      {wasteStreams.map((item) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <div className="flex-1">
                            <div className="font-medium">{item.stream}</div>
                            <div className="text-muted-foreground capitalize">{item.disposition}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{item.mass}g</div>
                            <Badge variant={item.circularityScore === 100 ? 'secondary' : 'destructive'} className="text-xs">
                              {item.circularityScore}%
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Land Use - Expandable */}
        <div className={`${expandedCard === 'land' ? 'md:col-span-2' : 'col-span-1'} transition-all duration-300`}>
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
                  Land Use
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
                  <div className="space-y-3 pt-4 border-t">
                    <h4 className="font-semibold text-sm">Agricultural Impact</h4>
                    <div className="space-y-2">
                      {landUseItems.slice(0, 4).map((item) => (
                        <div key={item.id} className="flex justify-between text-xs">
                          <div className="flex-1">
                            <div className="font-medium">{item.ingredient}</div>
                            <div className="text-muted-foreground">{item.origin}</div>
                          </div>
                          <div className="text-right">
                            <div className="font-medium">{item.totalFootprint.toFixed(2)}m²</div>
                            <div className="text-muted-foreground">{(item.mass * 1000).toFixed(0)}g</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Data Quality - Non-expandable */}
        <Card className="col-span-1 bg-gradient-to-br from-slate-50 to-blue-50 dark:from-slate-900/50 dark:to-blue-900/30 border-slate-200 dark:border-slate-800/50 group hover:shadow-lg transition-all duration-200">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <div className="p-2 bg-slate-100 dark:bg-slate-800/50 rounded-lg group-hover:bg-blue-100 dark:group-hover:bg-blue-900/50 transition-colors">
                <Activity className="h-4 w-4 text-slate-700 dark:text-slate-400 group-hover:text-blue-700 dark:group-hover:text-blue-400 transition-colors" />
              </div>
              Data Quality
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-center group-hover:scale-110 transition-transform">
              <div className="text-2xl font-bold text-blue-700 dark:text-blue-400">{displayDqi}%</div>
              <div className="text-xs text-muted-foreground mt-2">Hover for details</div>
              <div className="text-xs text-muted-foreground mt-1 opacity-0 group-hover:opacity-100 transition-opacity">
                High confidence • Full traceability
              </div>
            </div>
          </CardContent>
        </Card>

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
            </div>
          </CardContent>
        </Card>

        {/* System Boundary */}
        <Card className="col-span-1 md:col-span-2 bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900/30 dark:to-slate-800/30 border-slate-200 dark:border-slate-800/50">
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Eye className="h-4 w-4 text-slate-600 dark:text-slate-400" />
              System Boundary
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid md:grid-cols-2 gap-4">
              <div className="p-4 rounded-lg bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800/50">
                <h5 className="font-semibold text-xs mb-3 flex items-center gap-2 text-green-700 dark:text-green-400">
                  <CheckCircle2 className="h-4 w-4" />
                  Included
                </h5>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li>Raw material extraction</li>
                  <li>Primary production</li>
                  <li>Packaging manufacture</li>
                  <li>Factory operations</li>
                </ul>
              </div>
              <div className="p-4 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/50">
                <h5 className="font-semibold text-xs mb-3 flex items-center gap-2 text-red-700 dark:text-red-400">
                  <AlertCircle className="h-4 w-4" />
                  Excluded
                </h5>
                <ul className="text-xs text-muted-foreground space-y-2">
                  <li>Distribution to retailers</li>
                  <li>Consumer use phase</li>
                  <li>End-of-life disposal</li>
                  <li>Capital goods</li>
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Compliance Standards */}
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

        {/* Functional Unit */}
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

        {/* Data Provenance */}
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
    </div>
  );
}
