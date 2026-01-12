import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Mountain, TrendingUp, ArrowRight, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NatureMetrics } from '@/hooks/data/useCompanyMetrics';
import {
  NATURE_PERFORMANCE_THRESHOLDS,
  getPerformanceLevel,
  getPerformanceLabel,
  getPerformanceColorClass,
  getPerformanceBgColorClass,
  formatImpactValue,
  type PerformanceLevel,
} from '@/lib/calculations/nature-biodiversity';

interface NatureCardProps {
  natureMetrics: NatureMetrics | null;
  loading: boolean;
  onClick?: () => void;
}

export function NatureCard({ natureMetrics, loading, onClick }: NatureCardProps) {
  if (loading) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="pb-3">
          <Skeleton className="h-6 w-32" />
          <Skeleton className="h-4 w-48 mt-2" />
        </CardHeader>
        <CardContent className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-8 w-3/4" />
        </CardContent>
      </Card>
    );
  }

  if (!natureMetrics) {
    return (
      <Card className="border-green-200 bg-gradient-to-br from-green-50 to-white">
        <CardHeader className="pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100">
              <Mountain className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle className="text-lg">Nature & Biodiversity</CardTitle>
          </div>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const perUnit = natureMetrics.per_unit;
  const totalProduction = natureMetrics.total_production_volume;

  // Use shared service for consistent performance evaluation
  const getPerformance = (level: PerformanceLevel) => ({
    label: getPerformanceLabel(level),
    color: getPerformanceColorClass(level),
    bgColor: getPerformanceBgColorClass(level),
  });

  // Calculate performance levels using shared thresholds
  const ecotoxLevel = getPerformanceLevel('terrestrial_ecotoxicity', perUnit.terrestrial_ecotoxicity);
  const eutroLevel = getPerformanceLevel('freshwater_eutrophication', perUnit.freshwater_eutrophication);
  const acidLevel = getPerformanceLevel('terrestrial_acidification', perUnit.terrestrial_acidification);
  const landLevel = getPerformanceLevel('land_use', perUnit.land_use);

  const ecotoxPerf = getPerformance(ecotoxLevel);
  const eutroPerf = getPerformance(eutroLevel);
  const acidPerf = getPerformance(acidLevel);
  const landPerf = getPerformance(landLevel);

  return (
    <Card
      className="border-green-200 bg-gradient-to-br from-green-50 to-white hover:shadow-lg transition-shadow cursor-pointer"
      onClick={onClick}
    >
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-green-100">
              <Mountain className="h-5 w-5 text-green-600" />
            </div>
            <CardTitle className="text-lg">Nature & Biodiversity</CardTitle>
          </div>
          <div className="flex gap-1">
            <Badge variant="default" className="bg-green-600 text-xs">
              E4
            </Badge>
            <Badge variant="outline" className="text-xs">
              TNFD
            </Badge>
          </div>
        </div>
        <CardDescription>ReCiPe 2016 impact assessment (per unit avg.)</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="p-4 rounded-lg bg-white border-2 border-green-200">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-green-900">Best Performance</span>
            <Badge className={`${eutroPerf.bgColor} ${eutroPerf.color} border-0`}>
              {eutroPerf.label}
            </Badge>
          </div>
          <div className="flex items-baseline gap-2">
            <span className="text-3xl font-bold text-green-900">
              {perUnit.freshwater_eutrophication.toFixed(4)}
            </span>
            <span className="text-sm text-muted-foreground">kg P eq / unit</span>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            Freshwater Eutrophication • Benchmark: Good &lt;0.3
          </p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricCard
            label="Ecotoxicity"
            value={perUnit.terrestrial_ecotoxicity}
            unit="kg DCB"
            total={natureMetrics.terrestrial_ecotoxicity}
            production={totalProduction}
            performance={ecotoxPerf}
            benchmark="<5"
          />
          <MetricCard
            label="Acidification"
            value={perUnit.terrestrial_acidification}
            unit="kg SO₂"
            total={natureMetrics.terrestrial_acidification}
            production={totalProduction}
            performance={acidPerf}
            benchmark="<1.5"
          />
          <MetricCard
            label="Land Use"
            value={perUnit.land_use}
            unit="m²a"
            total={natureMetrics.land_use}
            production={totalProduction}
            performance={landPerf}
            benchmark="<500"
          />
          <div className="p-3 rounded-lg bg-blue-50 border border-blue-200 space-y-1">
            <div className="flex items-center gap-1">
              <TrendingUp className="h-3 w-3 text-blue-600" />
              <span className="text-xs font-semibold text-blue-900">Production</span>
            </div>
            <div className="text-lg font-bold text-blue-900">
              {totalProduction.toLocaleString()}
            </div>
            <p className="text-xs text-blue-700">Total units</p>
          </div>
        </div>

        <div className="p-3 rounded-lg bg-green-100/50 border border-green-200">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-xs border-green-300 text-green-700">
              ReCiPe 2016
            </Badge>
            <span className="text-xs text-green-800 font-medium">
              Biodiversity Assessment
            </span>
          </div>
          <p className="text-xs text-muted-foreground">
            Metrics show average per-unit impact across your product portfolio
          </p>
        </div>

        <button className="w-full flex items-center justify-between p-2 rounded-lg hover:bg-green-100/50 transition-colors text-sm font-medium text-green-900">
          <span>View detailed breakdown</span>
          <ArrowRight className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}

interface MetricCardProps {
  label: string;
  value: number;
  unit: string;
  total: number;
  production: number;
  performance: { label: string; color: string; bgColor: string };
  benchmark: string;
}

function MetricCard({ label, value, unit, total, production, performance, benchmark }: MetricCardProps) {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`p-3 rounded-lg border ${performance.bgColor.replace('100', '50')} border-green-200 space-y-1 cursor-help`}>
            <div className="flex items-center gap-1">
              <span className="text-xs font-semibold text-green-900">{label}</span>
              <Info className="h-3 w-3 text-muted-foreground" />
            </div>
            <div className="text-base font-bold text-green-900">
              {value >= 1 ? value.toFixed(2) : value.toFixed(4)}
            </div>
            <p className="text-xs text-muted-foreground">{unit} / unit</p>
            <Badge className={`${performance.bgColor} ${performance.color} border-0 text-xs`}>
              {performance.label}
            </Badge>
          </div>
        </TooltipTrigger>
        <TooltipContent>
          <div className="space-y-1">
            <p className="font-semibold">{label}</p>
            <p className="text-sm">Per unit: {value >= 1 ? value.toFixed(2) : value.toFixed(4)} {unit}</p>
            <p className="text-sm">Total ({production.toLocaleString()} units): {total.toLocaleString(undefined, { maximumFractionDigits: 0 })} {unit}</p>
            <p className="text-sm text-muted-foreground">Benchmark (Good): {benchmark} {unit}/unit</p>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
