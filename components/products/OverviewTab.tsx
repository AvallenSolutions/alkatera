"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Package, Droplets, Zap, Wind, MapPin, Bot, AlertTriangle, FileText, TrendingUp, CheckCircle2, ArrowRight } from "lucide-react";
import type { Product, ProductIngredient, ProductPackaging, ProductLCA } from "@/hooks/data/useProductData";
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

  const ingredientWeight = ingredients.reduce((sum, ing) => {
    const weight = ing.unit === 'kg' ? ing.quantity : ing.quantity / 1000;
    return sum + weight;
  }, 0);

  const packagingWeight = packaging.reduce((sum, pkg) => sum + pkg.quantity, 0);

  const calculateMaterialBreakdown = () => {
    if (!hasLCAData || !latestLCA.aggregated_impacts?.breakdown?.by_material) {
      return { ingredients: 45, packaging: 35, logistics: 20 };
    }

    const materials = latestLCA.aggregated_impacts.breakdown.by_material;
    let ingredientsTotal = 0;
    let packagingTotal = 0;
    let logisticsTotal = 0;

    if (Array.isArray(materials)) {
      materials.forEach((mat: any) => {
        if (mat.material_type === 'ingredient') {
          ingredientsTotal += mat.climate_change_gwp100 || 0;
        } else if (mat.material_type === 'packaging') {
          packagingTotal += mat.climate_change_gwp100 || 0;
        }
      });
    }

    if (latestLCA.aggregated_impacts.breakdown?.by_lifecycle_stage) {
      const stages = latestLCA.aggregated_impacts.breakdown.by_lifecycle_stage;
      if (Array.isArray(stages)) {
        const transport = stages.find((s: any) => s.stage_name === 'A2: Transport' || s.stage_name === 'Distribution');
        if (transport) {
          logisticsTotal = transport.climate_change_gwp100 || 0;
        }
      }
    }

    const total = ingredientsTotal + packagingTotal + logisticsTotal;
    if (total === 0) return { ingredients: 45, packaging: 35, logistics: 20 };

    return {
      ingredients: Math.round((ingredientsTotal / total) * 100),
      packaging: Math.round((packagingTotal / total) * 100),
      logistics: Math.round((logisticsTotal / total) * 100),
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
          {!hasLCAData ? (
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
                      {/* Logistics Layer (bottom - 0% to 20% of bottle) */}
                      {breakdown.logistics > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * breakdown.logistics / 100)}
                          width="120"
                          height="0"
                          fill="rgba(34, 211, 238, 0.8)"
                        >
                          <animate
                            attributeName="height"
                            from="0"
                            to={(295 * breakdown.logistics / 100)}
                            dur="0.8s"
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="y"
                            from="370"
                            to={370 - (295 * breakdown.logistics / 100)}
                            dur="0.8s"
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                          />
                        </rect>
                      )}

                      {/* Packaging Layer (middle - 20% to 55% of bottle) */}
                      {breakdown.packaging > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * (breakdown.logistics + breakdown.packaging) / 100)}
                          width="120"
                          height="0"
                          fill="rgba(251, 146, 60, 0.8)"
                        >
                          <animate
                            attributeName="height"
                            from="0"
                            to={(295 * breakdown.packaging / 100)}
                            begin="0.8s"
                            dur="0.8s"
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="y"
                            from={370 - (295 * breakdown.logistics / 100)}
                            to={370 - (295 * (breakdown.logistics + breakdown.packaging) / 100)}
                            begin="0.8s"
                            dur="0.8s"
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                          />
                        </rect>
                      )}

                      {/* Ingredients Layer (top - 55% to 100% of bottle) */}
                      {breakdown.ingredients > 0 && (
                        <rect
                          x="40"
                          y={370 - (295 * (breakdown.logistics + breakdown.packaging + breakdown.ingredients) / 100)}
                          width="120"
                          height="0"
                          fill="rgba(132, 204, 22, 0.8)"
                        >
                          <animate
                            attributeName="height"
                            from="0"
                            to={(295 * breakdown.ingredients / 100)}
                            begin="1.6s"
                            dur="0.8s"
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                          />
                          <animate
                            attributeName="y"
                            from={370 - (295 * (breakdown.logistics + breakdown.packaging) / 100)}
                            to={370 - (295 * (breakdown.logistics + breakdown.packaging + breakdown.ingredients) / 100)}
                            begin="1.6s"
                            dur="0.8s"
                            fill="freeze"
                            calcMode="spline"
                            keySplines="0.4 0 0.2 1"
                          />
                        </rect>
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
                    <div className="w-full absolute bg-cyan-500/30" style={{ bottom: '0', height: `${breakdown.logistics}%` }} />
                    <div className="w-full absolute bg-orange-500/30" style={{ bottom: `${breakdown.logistics}%`, height: `${breakdown.packaging}%` }} />
                    <div className="w-full absolute bg-lime-500/30" style={{ bottom: `${breakdown.logistics + breakdown.packaging}%`, height: `${breakdown.ingredients}%` }} />
                  </div>
                </div>
              </div>

              {/* Impact Metrics Below Bottle */}
              <div className="w-full max-w-lg">
                <div className="grid grid-cols-3 gap-4">
                  {/* Logistics */}
                  <div className="backdrop-blur-xl bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-4 text-center hover:bg-cyan-500/15 transition-all">
                    <MapPin className="h-6 w-6 text-cyan-400 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 mb-1">Logistics</div>
                    <div className="text-2xl font-bold text-cyan-400">{breakdown.logistics}%</div>
                  </div>

                  {/* Packaging */}
                  <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-500/20 rounded-lg p-4 text-center hover:bg-orange-500/15 transition-all">
                    <Package className="h-6 w-6 text-orange-400 mx-auto mb-2" />
                    <div className="text-xs text-slate-400 mb-1">Packaging</div>
                    <div className="text-2xl font-bold text-orange-400">{breakdown.packaging}%</div>
                  </div>

                  {/* Ingredients - Highlighted */}
                  <div className="backdrop-blur-xl bg-lime-500/20 border-2 border-lime-500/40 rounded-lg p-4 text-center shadow-lg shadow-lime-500/20 hover:bg-lime-500/25 transition-all">
                    <Droplets className="h-6 w-6 text-lime-400 mx-auto mb-2" />
                    <div className="text-xs text-lime-300 mb-1">Ingredients</div>
                    <div className="text-2xl font-bold text-lime-400">{breakdown.ingredients}%</div>
                    {breakdown.ingredients > 50 && (
                      <Badge className="mt-2 text-[10px] bg-lime-500/30 text-lime-300 border-lime-500/50">High Impact</Badge>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pulse Strip - Key Metrics */}
      <div className="lg:col-span-5 space-y-4">
        {/* Scope 1 - Direct Emissions */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-red-500/20 flex items-center justify-center shadow-lg shadow-red-500/20">
                  <Zap className="h-5 w-5 text-red-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Carbon Footprint</p>
                  <p className="text-2xl font-bold text-white">
                    {hasLCAData ? `${totalCarbon.toFixed(2)}` : '—'}
                    <span className="text-sm font-normal text-slate-400 ml-1">kg CO₂e</span>
                  </p>
                </div>
              </div>
              {hasLCAData && (
                <div className="text-right">
                  <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                    <TrendingUp className="h-3 w-3 mr-1" />
                    Tracked
                  </Badge>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Water Consumption */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-blue-500/20 flex items-center justify-center shadow-lg shadow-blue-500/20">
                  <Droplets className="h-5 w-5 text-blue-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Water Footprint</p>
                  <p className="text-2xl font-bold text-white">
                    {hasLCAData && latestLCA.aggregated_impacts?.water_consumption
                      ? `${latestLCA.aggregated_impacts.water_consumption.toFixed(2)}`
                      : '—'}
                    <span className="text-sm font-normal text-slate-400 ml-1">L</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Land Use */}
        <Card className="backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-all shadow-lg">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-green-500/20 flex items-center justify-center shadow-lg shadow-green-500/20">
                  <Wind className="h-5 w-5 text-green-400" />
                </div>
                <div>
                  <p className="text-xs text-slate-400">Land Use</p>
                  <p className="text-2xl font-bold text-white">
                    {hasLCAData && latestLCA.aggregated_impacts?.land_use
                      ? `${latestLCA.aggregated_impacts.land_use.toFixed(2)}`
                      : '—'}
                    <span className="text-sm font-normal text-slate-400 ml-1">m²</span>
                  </p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

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
