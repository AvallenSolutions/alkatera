"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Droplets, Zap, Wind, MapPin, Bot, AlertTriangle, FileText, TrendingUp, CheckCircle2, ArrowRight, Map } from "lucide-react";
import type { Product, ProductIngredient, ProductPackaging, ProductLCA } from "@/hooks/data/useProductData";
import { useFacilityLocation } from "@/hooks/data/useFacilityLocation";
import { SupplyChainMap } from "./SupplyChainMap";
import { formatDistanceToNow } from "date-fns";
import Link from "next/link";

interface OverviewTabProps {
  product: Product;
  ingredients: ProductIngredient[];
  packaging: ProductPackaging[];
  lcaReports: ProductLCA[];
  isHealthy: boolean;
}

export function OverviewTab({ product, ingredients, packaging, lcaReports, isHealthy }: OverviewTabProps) {
  const latestLCA = lcaReports[0];
  const hasLCAData = latestLCA && latestLCA.aggregated_impacts;
  const { facility } = useFacilityLocation(product.organization_id);

  const ingredientWeight = ingredients.reduce((sum, ing) => {
    const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
    return sum + weight;
  }, 0);

  const packagingWeight = packaging.reduce((sum, pkg) => sum + pkg.quantity, 0);

  const calculateMaterialBreakdown = () => {
    if (!hasLCAData) {
      return null;
    }

    const stages = latestLCA.aggregated_impacts?.breakdown?.by_lifecycle_stage;

    if (!stages) {
      return null;
    }

    const rawMaterialsTotal = stages.raw_materials || 0;
    const packagingTotal = stages.packaging_stage || 0;
    const processingTotal = stages.processing || 0;
    const transportationTotal = stages.distribution || 0;

    const total = rawMaterialsTotal + packagingTotal + processingTotal + transportationTotal;
    if (total === 0) return null;

    return {
      rawMaterials: Math.round((rawMaterialsTotal / total) * 100),
      packaging: Math.round((packagingTotal / total) * 100),
      processing: Math.round((processingTotal / total) * 100),
      transportation: Math.round((transportationTotal / total) * 100),
    };
  };

  const breakdown = calculateMaterialBreakdown();
  const totalCarbon = hasLCAData && latestLCA.aggregated_impacts ? latestLCA.aggregated_impacts.climate_change_gwp100 : 0;

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
      {/* Digital Twin Hero - Bottle Visualization */}
      <Card className="lg:col-span-7 backdrop-blur-xl bg-white/5 border border-white/10 shadow-2xl overflow-hidden relative group hover:bg-white/8 transition-all">
        <div className="absolute inset-0 bg-gradient-to-br from-lime-500/5 via-transparent to-cyan-500/5 opacity-0 group-hover:opacity-100 transition-opacity" />
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-2xl text-white truncate max-w-md">{product.name}</CardTitle>
              <CardDescription className="text-slate-400">Carbon Impact Visualisation</CardDescription>
            </div>
            {hasLCAData && (
              <Badge className="bg-lime-500/20 text-lime-400 border-lime-500/30">
                {totalCarbon.toFixed(2)} kg CO₂e
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {!breakdown ? (
            <div className="flex flex-col items-center justify-center py-12 space-y-6">
              <div className="relative w-64 h-96 opacity-30">
                <svg viewBox="0 0 200 400" className="w-full h-full">
                  <path
                    d="M 85 10 L 115 10 L 115 60 Q 120 63, 130 68 Q 145 72, 160 75 L 160 370 L 40 370 L 40 75 Q 55 72, 70 68 Q 80 63, 85 60 Z"
                    fill="rgba(255, 255, 255, 0.1)"
                    stroke="rgba(255, 255, 255, 0.2)"
                    strokeWidth="2"
                  />
                </svg>
              </div>
              <div className="text-center space-y-4 max-w-md">
                <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto" />
                <div>
                  <h3 className="text-lg font-semibold text-white mb-2">No LCA Data Available</h3>
                  <p className="text-sm text-slate-400">
                    Complete a Life Cycle Assessment to visualise the environmental impact of this product
                  </p>
                </div>
                <Link href={`/products/${product.id}/calculate-lca`}>
                  <Button className="bg-lime-500 hover:bg-lime-600 text-slate-900">
                    Calculate LCA
                    <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 space-y-8">
              {/* Bottle Visualization */}
              <div className="relative">
                <div className="relative w-64 h-[28rem] mx-auto">
                  <svg
                    viewBox="0 0 200 400"
                    className="w-full h-full drop-shadow-2xl relative z-10"
                  >
                    <defs>
                      <clipPath id="bottleClip">
                        <path d="M 85 10 L 115 10 L 115 60 Q 120 63, 130 68 Q 145 72, 160 75 L 160 370 L 40 370 L 40 75 Q 55 72, 70 68 Q 80 63, 85 60 Z" />
                      </clipPath>
                      <linearGradient id="glassShine" x1="0%" y1="0%" x2="100%" y2="0%">
                        <stop offset="0%" stopColor="rgba(255, 255, 255, 0.1)" />
                        <stop offset="50%" stopColor="rgba(255, 255, 255, 0.3)" />
                        <stop offset="100%" stopColor="rgba(255, 255, 255, 0.1)" />
                      </linearGradient>
                    </defs>

                    {/* Liquid Layers (stacked bottom to top) */}
                    <g clipPath="url(#bottleClip)">
                      {/* Transportation Layer (bottom) */}
                      {breakdown.transportation > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * breakdown.transportation / 100)}
                          width="120"
                          height={(295 * breakdown.transportation / 100)}
                          fill="rgba(34, 211, 238, 0.8)"
                        />
                      )}

                      {/* Packaging Layer */}
                      {breakdown.packaging > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * (breakdown.transportation + breakdown.packaging) / 100)}
                          width="120"
                          height={(295 * breakdown.packaging / 100)}
                          fill="rgba(251, 146, 60, 0.8)"
                        />
                      )}

                      {/* Processing Layer */}
                      {breakdown.processing > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * (breakdown.transportation + breakdown.packaging + breakdown.processing) / 100)}
                          width="120"
                          height={(295 * breakdown.processing / 100)}
                          fill="rgba(168, 85, 247, 0.8)"
                        />
                      )}

                      {/* Raw Materials Layer (top) */}
                      {breakdown.rawMaterials > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * (breakdown.transportation + breakdown.packaging + breakdown.processing + breakdown.rawMaterials) / 100)}
                          width="120"
                          height={(295 * breakdown.rawMaterials / 100)}
                          fill="rgba(132, 204, 22, 0.8)"
                        />
                      )}

                      {/* Bubbles */}
                      <circle cx="70" cy="320" r="2" fill="rgba(255, 255, 255, 0.5)">
                        <animate attributeName="cy" values="350;300;350" dur="3s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.5;0.8;0.5" dur="3s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="130" cy="280" r="1.5" fill="rgba(255, 255, 255, 0.4)">
                        <animate attributeName="cy" values="320;260;320" dur="4s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.4;0.7;0.4" dur="4s" repeatCount="indefinite" />
                      </circle>
                      <circle cx="100" cy="250" r="2.5" fill="rgba(255, 255, 255, 0.6)">
                        <animate attributeName="cy" values="290;230;290" dur="3.5s" repeatCount="indefinite" />
                        <animate attributeName="opacity" values="0.6;0.9;0.6" dur="3.5s" repeatCount="indefinite" />
                      </circle>
                    </g>

                    {/* Bottle Glass Outline */}
                    <path
                      d="M 85 10 L 115 10 L 115 60 Q 120 63, 130 68 Q 145 72, 160 75 L 160 370 L 40 370 L 40 75 Q 55 72, 70 68 Q 80 63, 85 60 Z"
                      fill="url(#glassShine)"
                      stroke="rgba(255, 255, 255, 0.4)"
                      strokeWidth="2"
                      fillOpacity="0.15"
                    />

                    {/* Glass Highlights */}
                    <path
                      d="M 50 80 L 50 360"
                      stroke="rgba(255, 255, 255, 0.5)"
                      strokeWidth="2"
                      fill="none"
                      opacity="0.6"
                    />
                    <path
                      d="M 150 80 L 150 360"
                      stroke="rgba(255, 255, 255, 0.3)"
                      strokeWidth="1.5"
                      fill="none"
                      opacity="0.4"
                    />
                  </svg>

                  {/* Glow Effect */}
                  <div className="absolute inset-0 -z-10 blur-3xl opacity-40">
                    <div className="w-full absolute bg-cyan-500/30" style={{ bottom: '0', height: `${breakdown.transportation}%` }} />
                    <div className="w-full absolute bg-orange-500/30" style={{ bottom: `${breakdown.transportation}%`, height: `${breakdown.packaging}%` }} />
                    <div className="w-full absolute bg-purple-500/30" style={{ bottom: `${breakdown.transportation + breakdown.packaging}%`, height: `${breakdown.processing}%` }} />
                    <div className="w-full absolute bg-lime-500/30" style={{ bottom: `${breakdown.transportation + breakdown.packaging + breakdown.processing}%`, height: `${breakdown.rawMaterials}%` }} />
                  </div>
                </div>
              </div>

              {/* Impact Metrics Below Bottle */}
              <div className="w-full max-w-2xl">
                <div className="grid grid-cols-4 gap-3">
                  {/* Transportation */}
                  <div className="backdrop-blur-xl bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 text-center hover:bg-cyan-500/15 transition-all">
                    <MapPin className="h-5 w-5 text-cyan-400 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 mb-1">Transportation</div>
                    <div className="text-xl font-bold text-cyan-400">{breakdown.transportation}%</div>
                  </div>

                  {/* Packaging */}
                  <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center hover:bg-orange-500/15 transition-all">
                    <Package className="h-5 w-5 text-orange-400 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 mb-1">Packaging</div>
                    <div className="text-xl font-bold text-orange-400">{breakdown.packaging}%</div>
                  </div>

                  {/* Processing */}
                  <div className="backdrop-blur-xl bg-purple-500/10 border border-purple-500/20 rounded-lg p-3 text-center hover:bg-purple-500/15 transition-all">
                    <Zap className="h-5 w-5 text-purple-400 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 mb-1">Processing</div>
                    <div className="text-xl font-bold text-purple-400">{breakdown.processing}%</div>
                  </div>

                  {/* Raw Materials */}
                  <div className="backdrop-blur-xl bg-lime-500/10 border border-lime-500/20 rounded-lg p-3 text-center hover:bg-lime-500/15 transition-all">
                    <Droplets className="h-5 w-5 text-lime-400 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 mb-1">Raw Materials</div>
                    <div className="text-xl font-bold text-lime-400">{breakdown.rawMaterials}%</div>
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Planet Impact Cards */}
      <div className="lg:col-span-5 space-y-4">
        {/* Climate Impact */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Zap className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Climate Impact</p>
                  <p className="text-xs text-slate-400">Total greenhouse gas emissions (CSRD E1)</p>
                </div>
              </div>
              {hasLCAData && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  CSRD
                </Badge>
              )}
            </div>
            <div className="mb-4">
              <p className="text-3xl font-bold text-white">
                {hasLCAData ? `${totalCarbon.toFixed(3)}` : '—'}
                <span className="text-base font-normal text-slate-400 ml-2">kg CO₂eq</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Across 1 products assessed</p>
            </div>
            {hasLCAData && (
              <Button
                variant="link"
                className="text-red-400 hover:text-red-300 p-0 h-auto font-normal text-sm group-hover:underline"
                asChild
              >
                <Link href={`/products/${product.id}/report`}>
                  View carbon breakdown
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Water Impact */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Droplets className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Water Impact</p>
                  <p className="text-xs text-slate-400">Water consumption & scarcity (CSRD E3)</p>
                </div>
              </div>
              {hasLCAData && latestLCA.aggregated_impacts?.water_scarcity_aware && (
                <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 text-xs">
                  E3
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Consumption</p>
                <p className="text-2xl font-bold text-white">
                  {hasLCAData && latestLCA.aggregated_impacts?.water_consumption
                    ? `${latestLCA.aggregated_impacts.water_consumption.toFixed(3)}`
                    : '—'}
                  <span className="text-sm font-normal text-slate-400 ml-1">m³</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Scarcity Impact</p>
                <p className="text-2xl font-bold text-white">
                  {hasLCAData && latestLCA.aggregated_impacts?.water_scarcity_aware
                    ? `${latestLCA.aggregated_impacts.water_scarcity_aware.toFixed(3)}`
                    : '—'}
                  <span className="text-sm font-normal text-slate-400 ml-1">m³ world eq</span>
                </p>
              </div>
            </div>
            {hasLCAData && latestLCA.aggregated_impacts?.water_risk_level && (
              <>
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs mb-3">
                  {latestLCA.aggregated_impacts.water_risk_level === 'low' ? 'Low Risk' :
                   latestLCA.aggregated_impacts.water_risk_level === 'medium' ? 'Medium Risk' : 'High Risk'}
                </Badge>
                <p className="text-xs text-slate-500 mb-3">Based on spatially-explicit water scarcity factors across operations</p>
                <Button
                  variant="link"
                  className="text-blue-400 hover:text-blue-300 p-0 h-auto font-normal text-sm group-hover:underline"
                  asChild
                >
                  <Link href={`/products/${product.id}/report`}>
                    View facility water risks
                    <ArrowRight className="ml-2 h-3 w-3" />
                  </Link>
                </Button>
              </>
            )}
          </CardContent>
        </Card>

        {/* Circularity Score */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center shadow-lg shadow-amber-500/20">
                  <Package className="h-5 w-5 text-amber-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Circularity</p>
                  <p className="text-xs text-slate-400">Resource use & circular economy (CSRD E5)</p>
                </div>
              </div>
              {hasLCAData && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  E5
                </Badge>
              )}
            </div>
            <div className="mb-4">
              <p className="text-xs text-slate-500 mb-2">Circularity Score</p>
              <p className="text-3xl font-bold text-white mb-2">
                {hasLCAData && latestLCA.aggregated_impacts?.circularity_percentage !== undefined
                  ? `${latestLCA.aggregated_impacts.circularity_percentage}`
                  : '—'}
                <span className="text-base font-normal text-slate-400 ml-2">%</span>
              </p>
              {hasLCAData && latestLCA.aggregated_impacts?.circularity_percentage !== undefined && (
                <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                  {latestLCA.aggregated_impacts.circularity_percentage >= 75 ? 'EXCELLENT' :
                   latestLCA.aggregated_impacts.circularity_percentage >= 50 ? 'GOOD' :
                   latestLCA.aggregated_impacts.circularity_percentage >= 25 ? 'FAIR' : 'POOR'}
                </Badge>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-3">Material circularity based on virgin resource use and recycled content</p>
            <div className="mb-3">
              <p className="text-xs text-slate-500 uppercase mb-1">Fossil Resource Use</p>
              <p className="text-xl font-bold text-white">
                {hasLCAData && latestLCA.aggregated_impacts?.fossil_resource_scarcity !== undefined
                  ? `${latestLCA.aggregated_impacts.fossil_resource_scarcity}`
                  : '0'}
                <span className="text-sm font-normal text-slate-400 ml-1">kg oil eq</span>
              </p>
              <p className="text-xs text-slate-500 mt-1">Virgin fossil resources consumed in product lifecycle</p>
            </div>
            {hasLCAData && (
              <Button
                variant="link"
                className="text-amber-400 hover:text-amber-300 p-0 h-auto font-normal text-sm group-hover:underline"
                asChild
              >
                <Link href={`/products/${product.id}/report`}>
                  View material flows
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>

        {/* Land & Biodiversity Impact */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg group">
          <CardContent className="p-5">
            <div className="flex items-start justify-between mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Wind className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">Nature Impact</p>
                  <p className="text-xs text-slate-400">Land use & biodiversity impact (CSRD E4 / TNFD)</p>
                </div>
              </div>
              {hasLCAData && (
                <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                  E4
                </Badge>
              )}
            </div>
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Land Use</p>
                <p className="text-2xl font-bold text-white">
                  {hasLCAData && latestLCA.aggregated_impacts?.land_use
                    ? `${latestLCA.aggregated_impacts.land_use.toFixed(3)}`
                    : '—'}
                  <span className="text-sm font-normal text-slate-400 ml-1">m²a</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-slate-500 uppercase mb-1">Ecotoxicity</p>
                <p className="text-2xl font-bold text-white">
                  {hasLCAData && latestLCA.aggregated_impacts?.terrestrial_ecotoxicity !== undefined
                    ? `${latestLCA.aggregated_impacts.terrestrial_ecotoxicity.toFixed(3)}`
                    : '0.000'}
                  <span className="text-sm font-normal text-slate-400 ml-1">kg DCB</span>
                </p>
              </div>
            </div>
            <div className="flex gap-2 mb-3">
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                ReCiPe 2016
              </Badge>
              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 text-xs">
                Multi-capital Assessment
              </Badge>
            </div>
            <p className="text-xs text-slate-500 mb-3">
              Comprehensive biodiversity impact across land transformation, habitat quality, and ecosystem toxicity
            </p>
            {hasLCAData && (
              <Button
                variant="link"
                className="text-green-400 hover:text-green-300 p-0 h-auto font-normal text-sm group-hover:underline"
                asChild
              >
                <Link href={`/products/${product.id}/report`}>
                  View nature metrics
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Link>
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Supply Chain Network Map */}
      <Card className="lg:col-span-12 backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <Map className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-white">Supply Chain Network</CardTitle>
                <CardDescription className="text-slate-400">
                  Geographic distribution of materials and production facility
                </CardDescription>
              </div>
            </div>
            {facility && (ingredients.filter(i => i.origin_lat && i.origin_lng).length > 0 || packaging.filter(p => p.origin_lat && p.origin_lng).length > 0) && (
              <Badge className="bg-cyan-500/20 text-cyan-400 border-cyan-500/30">
                {1 + ingredients.filter(i => i.origin_lat && i.origin_lng).length + packaging.filter(p => p.origin_lat && p.origin_lng).length} locations
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <SupplyChainMap
            facility={facility}
            ingredients={ingredients}
            packaging={packaging}
            productId={product.id}
            productName={product.name}
          />
        </CardContent>
      </Card>

      {/* Product Health Status */}
      <Card className="lg:col-span-6 backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-lime-500/20 flex items-center justify-center shadow-lg shadow-lime-500/20">
              <CheckCircle2 className="h-5 w-5 text-lime-400" />
            </div>
            <div>
              <CardTitle className="text-white">Data Completeness</CardTitle>
              <CardDescription className="text-slate-400">Product readiness score</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between p-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${ingredients.length > 0 ? 'bg-green-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">Ingredients</span>
            </div>
            <span className="text-sm font-medium text-white">{ingredients.length} added ({ingredientWeight.toFixed(2)} kg)</span>
          </div>

          <div className="flex items-center justify-between p-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${packaging.length > 0 ? 'bg-green-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">Packaging</span>
            </div>
            <span className="text-sm font-medium text-white">{packaging.length} added ({packagingWeight.toFixed(1)} g)</span>
          </div>

          <div className="flex items-center justify-between p-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg">
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${lcaReports.length > 0 ? 'bg-green-500' : 'bg-slate-600'}`} />
              <span className="text-sm text-slate-300">LCA Calculations</span>
            </div>
            <span className="text-sm font-medium text-white">{lcaReports.length} report{lcaReports.length !== 1 ? 's' : ''}</span>
          </div>

          <div className="pt-2">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs text-slate-400">Overall Progress</span>
              <span className="text-xs font-medium text-white">{isHealthy ? '100%' : ingredients.length > 0 || packaging.length > 0 ? '66%' : '33%'}</span>
            </div>
            <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-lime-500 to-green-500 transition-all duration-500"
                style={{ width: `${isHealthy ? 100 : ingredients.length > 0 || packaging.length > 0 ? 66 : 33}%` }}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* LCA Reports Feed */}
      <Card className="lg:col-span-6 backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/20">
                <FileText className="h-5 w-5 text-cyan-400" />
              </div>
              <div>
                <CardTitle className="text-white">LCA Reports</CardTitle>
                <CardDescription className="text-slate-400">Calculation history</CardDescription>
              </div>
            </div>
            {lcaReports.length > 0 && (
              <Link href="/reports/lcas">
                <Button variant="ghost" size="sm" className="text-cyan-400 hover:text-cyan-300 hover:bg-cyan-500/10">
                  View All
                  <ArrowRight className="ml-2 h-3 w-3" />
                </Button>
              </Link>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {lcaReports.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <FileText className="h-12 w-12 mx-auto mb-3 text-slate-600" />
              <p className="text-sm font-medium text-slate-300">No LCA reports yet</p>
              <p className="text-xs text-slate-500 mt-1">Calculate your first LCA to see results here</p>
            </div>
          ) : (
            <>
              {lcaReports.slice(0, 3).map((lca, idx) => (
                <Link key={lca.id} href={`/products/${product.id}/report`}>
                  <div className="p-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all cursor-pointer">
                    <div className="flex items-center justify-between mb-2">
                      <Badge className={`${lca.status === 'completed' ? 'bg-green-500/20 text-green-400 border-green-500/30' : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'}`}>
                        {lca.status}
                      </Badge>
                      <span className="text-xs text-slate-400">
                        {formatDistanceToNow(new Date(lca.created_at), { addSuffix: true })}
                      </span>
                    </div>
                    {lca.aggregated_impacts && (
                      <div className="flex items-center justify-between">
                        <span className="text-sm text-slate-300">Total Impact</span>
                        <span className="text-sm font-bold text-white">
                          {lca.aggregated_impacts.climate_change_gwp100.toFixed(2)} kg CO₂e
                        </span>
                      </div>
                    )}
                    {lca.system_boundary && (
                      <div className="text-xs text-slate-500 mt-1">
                        Boundary: {lca.system_boundary}
                      </div>
                    )}
                  </div>
                </Link>
              ))}
              {lcaReports.length > 3 && (
                <div className="text-center pt-2">
                  <Link href="/reports/lcas">
                    <Button variant="outline" size="sm" className="text-slate-400 hover:text-white border-slate-700 hover:bg-white/5">
                      View {lcaReports.length - 3} more report{lcaReports.length - 3 !== 1 ? 's' : ''}
                    </Button>
                  </Link>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
