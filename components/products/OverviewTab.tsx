"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Package, Droplets, Zap, Wind, MapPin, Bot, AlertTriangle, FileText, TrendingUp, CheckCircle2 } from "lucide-react";
import type { Product, ProductIngredient, ProductPackaging, ProductLCA } from "@/hooks/data/useProductData";
import { formatDistanceToNow } from "date-fns";

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

    materials.forEach((mat: any) => {
      if (mat.material_type === 'ingredient') {
        ingredientsTotal += mat.climate_change_gwp100 || 0;
      } else if (mat.material_type === 'packaging') {
        packagingTotal += mat.climate_change_gwp100 || 0;
      }
    });

    if (latestLCA.aggregated_impacts.breakdown?.by_lifecycle_stage) {
      const stages = latestLCA.aggregated_impacts.breakdown.by_lifecycle_stage;
      const transport = stages.find((s: any) => s.stage_name === 'A2: Transport' || s.stage_name === 'Distribution');
      if (transport) {
        logisticsTotal = transport.climate_change_gwp100 || 0;
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
              <CardTitle className="text-2xl text-white">Digital Twin</CardTitle>
              <CardDescription className="text-slate-400">Carbon Impact Visualization</CardDescription>
            </div>
            {hasLCAData && (
              <Badge className="bg-lime-500/20 text-lime-400 border-lime-500/30">
                {totalCarbon.toFixed(2)} kg CO₂e
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center py-8 relative">
            {/* Bottle Visualization */}
            <div className="relative">
              {/* Bottle Container */}
              <div className="relative w-48 h-96 mx-auto">
                {/* Bottle Shape - SVG */}
                <svg
                  viewBox="0 0 200 400"
                  className="w-full h-full drop-shadow-2xl"
                  style={{ filter: 'drop-shadow(0 0 20px rgba(132, 204, 22, 0.3))' }}
                >
                  <defs>
                    <linearGradient id="bottleGlass" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="rgba(255, 255, 255, 0.2)" />
                      <stop offset="100%" stopColor="rgba(255, 255, 255, 0.05)" />
                    </linearGradient>
                    <linearGradient id="liquidFill" x1="0%" y1="0%" x2="0%" y2="100%">
                      <stop offset="0%" stopColor="rgba(132, 204, 22, 0.8)" />
                      <stop offset="100%" stopColor="rgba(132, 204, 22, 0.4)" />
                    </linearGradient>
                  </defs>

                  {/* Bottle Neck */}
                  <rect x="75" y="10" width="50" height="40" fill="url(#bottleGlass)" stroke="rgba(255, 255, 255, 0.3)" strokeWidth="2" rx="5" />

                  {/* Bottle Body - Main Container */}
                  <path
                    d="M 60 50 L 60 350 Q 60 370, 80 370 L 120 370 Q 140 370, 140 350 L 140 50 Z"
                    fill="url(#bottleGlass)"
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="2"
                  />

                  {/* Liquid Fill - Animated based on total impact */}
                  <path
                    d="M 60 250 L 60 350 Q 60 370, 80 370 L 120 370 Q 140 370, 140 350 L 140 250 Z"
                    fill="url(#liquidFill)"
                    className="animate-pulse"
                  />

                  {/* Bubbles in liquid */}
                  <circle cx="80" cy="300" r="3" fill="rgba(255, 255, 255, 0.4)" className="animate-bounce" />
                  <circle cx="110" cy="320" r="2" fill="rgba(255, 255, 255, 0.3)" className="animate-bounce delay-300" />
                  <circle cx="95" cy="280" r="2.5" fill="rgba(255, 255, 255, 0.3)" className="animate-bounce delay-500" />
                </svg>

                {/* Glow Effect Behind Bottle */}
                <div className="absolute inset-0 -z-10 blur-3xl bg-lime-500/20 rounded-full scale-150" />
              </div>
            </div>

            {/* Impact Metrics Below Bottle */}
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md">
              <div className="grid grid-cols-3 gap-4 px-4">
                {/* Packaging */}
                <div className="backdrop-blur-xl bg-orange-500/10 border border-orange-500/20 rounded-lg p-3 text-center">
                  <Package className="h-5 w-5 text-orange-400 mx-auto mb-1" />
                  <div className="text-xs text-slate-400">Packaging</div>
                  <div className="text-lg font-bold text-orange-400">{breakdown.packaging}%</div>
                </div>

                {/* Ingredients - Highlighted */}
                <div className="backdrop-blur-xl bg-lime-500/20 border-2 border-lime-500/40 rounded-lg p-3 text-center shadow-lg shadow-lime-500/20">
                  <Droplets className="h-5 w-5 text-lime-400 mx-auto mb-1" />
                  <div className="text-xs text-lime-300">Ingredients</div>
                  <div className="text-lg font-bold text-lime-400">{breakdown.ingredients}%</div>
                  <Badge className="mt-1 text-[10px] bg-lime-500/30 text-lime-300 border-lime-500/50">High Impact</Badge>
                </div>

                {/* Logistics */}
                <div className="backdrop-blur-xl bg-cyan-500/10 border border-cyan-500/20 rounded-lg p-3 text-center">
                  <MapPin className="h-5 w-5 text-cyan-400 mx-auto mb-1" />
                  <div className="text-xs text-slate-400">Logistics</div>
                  <div className="text-lg font-bold text-cyan-400">{breakdown.logistics}%</div>
                </div>
              </div>
            </div>
          </div>

          {!hasLCAData && (
            <div className="text-center mt-4 p-4 backdrop-blur-xl bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-300">
                Calculate LCA to see real environmental impact data visualised in the bottle
              </p>
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
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-cyan-500/20 flex items-center justify-center shadow-lg shadow-cyan-500/20">
              <FileText className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <CardTitle className="text-white">LCA Reports</CardTitle>
              <CardDescription className="text-slate-400">Calculation history</CardDescription>
            </div>
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
            lcaReports.slice(0, 3).map((lca, idx) => (
              <div
                key={lca.id}
                className="p-3 backdrop-blur-xl bg-white/5 border border-white/10 rounded-lg hover:bg-white/10 transition-all"
              >
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
            ))
          )}
        </CardContent>
      </Card>
    </div>
  );
}
