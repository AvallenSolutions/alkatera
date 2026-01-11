import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mountain, Leaf, Droplets, Wind, TrendingUp, Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NatureMetrics } from '@/hooks/data/useCompanyMetrics';

interface NatureDeepDiveProps {
  natureMetrics: NatureMetrics | null;
}

export function NatureDeepDive({ natureMetrics }: NatureDeepDiveProps) {
  if (!natureMetrics) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Nature Impact Assessment</CardTitle>
          <CardDescription>No data available</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  const perUnit = natureMetrics.per_unit;
  const total = natureMetrics;
  const production = natureMetrics.total_production_volume;

  const getPerformance = (value: number, goodThreshold: number, fairThreshold: number) => {
    if (value < goodThreshold) {
      return { level: 'Excellent', color: 'text-green-600', bgColor: 'bg-green-100', barColor: 'bg-green-500' };
    }
    if (value < fairThreshold) {
      return { level: 'Good', color: 'text-emerald-600', bgColor: 'bg-emerald-100', barColor: 'bg-emerald-500' };
    }
    return { level: 'Needs Improvement', color: 'text-amber-600', bgColor: 'bg-amber-100', barColor: 'bg-amber-500' };
  };

  const metrics = [
    {
      name: 'Land Use',
      perUnit: perUnit.land_use,
      total: total.land_use,
      unit: 'm²a crop eq',
      unitShort: 'm²a',
      icon: Mountain,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: 'Land occupation and transformation impact',
      interpretation: 'Lower is better - less land transformed',
      benchmark: { good: 500, fair: 2000 },
      targetGuidance: 'Excellent: <500 | Good: 500-2,000 | Needs Work: >2,000',
    },
    {
      name: 'Terrestrial Ecotoxicity',
      perUnit: perUnit.terrestrial_ecotoxicity,
      total: total.terrestrial_ecotoxicity,
      unit: 'kg 1,4-DCB eq',
      unitShort: 'kg DCB',
      icon: Leaf,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      description: 'Toxic impact on terrestrial ecosystems',
      interpretation: 'Lower is better - less toxic impact',
      benchmark: { good: 5, fair: 15 },
      targetGuidance: 'Excellent: <5 | Good: 5-15 | Needs Work: >15',
    },
    {
      name: 'Freshwater Eutrophication',
      perUnit: perUnit.freshwater_eutrophication,
      total: total.freshwater_eutrophication,
      unit: 'kg P eq',
      unitShort: 'kg P eq',
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: 'Nutrient loading in freshwater bodies',
      interpretation: 'Lower is better - less water pollution',
      benchmark: { good: 0.3, fair: 0.7 },
      targetGuidance: 'Excellent: <0.3 | Good: 0.3-0.7 | Needs Work: >0.7',
    },
    {
      name: 'Terrestrial Acidification',
      perUnit: perUnit.terrestrial_acidification,
      total: total.terrestrial_acidification,
      unit: 'kg SO₂ eq',
      unitShort: 'kg SO₂',
      icon: Wind,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: 'Acidifying emissions affecting soil and plants',
      interpretation: 'Lower is better - less soil acidification',
      benchmark: { good: 1.5, fair: 3.0 },
      targetGuidance: 'Excellent: <1.5 | Good: 1.5-3.0 | Needs Work: >3.0',
    },
  ];

  const maxPerUnitValue = Math.max(...metrics.map(m => (m.perUnit / m.benchmark.fair) * 100));

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <Mountain className="h-5 w-5" />
                Nature Impact Assessment
              </CardTitle>
              <CardDescription>
                Per-unit biodiversity metrics • {production.toLocaleString()} units produced
              </CardDescription>
            </div>
            <div className="flex gap-1">
              <Badge variant="outline" className="text-xs">CSRD E4</Badge>
              <Badge variant="outline" className="text-xs">TNFD</Badge>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid md:grid-cols-2 gap-4">
            {metrics.map((metric) => {
              const IconComponent = metric.icon;
              const performance = getPerformance(metric.perUnit, metric.benchmark.good, metric.benchmark.fair);
              const percentageOfFair = metric.benchmark.fair > 0 ? (metric.perUnit / metric.benchmark.fair) * 100 : 0;
              const relativeIntensity = maxPerUnitValue > 0 ? (percentageOfFair / maxPerUnitValue) * 100 : 0;

              const getTitleClass = () => {
                if (metric.name === 'Land Use') return 'text-green-900';
                if (metric.name === 'Terrestrial Ecotoxicity') return 'text-green-900';
                if (metric.name === 'Freshwater Eutrophication') return 'text-blue-900';
                if (metric.name === 'Terrestrial Acidification') return 'text-purple-900';
                return 'text-slate-900';
              };

              return (
                <Card key={metric.name} className={`border-2 ${metric.bgColor} border-opacity-30`}>
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <div className={`p-2 rounded-lg ${metric.bgColor}`}>
                          <IconComponent className={`h-4 w-4 ${metric.color}`} />
                        </div>
                        <CardTitle className={`text-sm ${getTitleClass()}`}>{metric.name}</CardTitle>
                      </div>
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger>
                            <Info className="h-4 w-4 text-muted-foreground" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="text-sm max-w-xs">{metric.description}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-muted-foreground uppercase tracking-wide font-medium">Per Unit</span>
                        <Badge className={`${performance.bgColor} ${performance.color} border-0 text-xs`}>
                          {performance.level}
                        </Badge>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-3xl font-bold ${getTitleClass()}`}>
                          {metric.perUnit >= 1 ? metric.perUnit.toFixed(2) : metric.perUnit.toFixed(4)}
                        </span>
                        <span className={`text-sm ${getTitleClass()}`}>{metric.unitShort}</span>
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className={`font-medium ${getTitleClass()}`}>{metric.interpretation}</span>
                        <span className="text-muted-foreground">vs benchmark</span>
                      </div>
                      <div className="h-2 w-full bg-gray-200 rounded-full overflow-hidden">
                        <div
                          className={`h-full ${performance.barColor} transition-all duration-500`}
                          style={{ width: `${Math.min(relativeIntensity, 100)}%` }}
                        />
                      </div>
                    </div>

                    <div className="pt-2 border-t space-y-1">
                      <div className="flex items-center justify-between">
                        <span className={`text-xs font-medium ${getTitleClass()}`}>Total Company Impact</span>
                        <div className="flex items-center gap-1">
                          <TrendingUp className="h-3 w-3 text-muted-foreground" />
                          <span className="text-xs text-muted-foreground">{production.toLocaleString()} units</span>
                        </div>
                      </div>
                      <div className="flex items-baseline gap-2">
                        <span className={`text-xl font-bold ${getTitleClass()}`}>
                          {metric.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                        </span>
                        <span className={`text-xs ${getTitleClass()}`}>{metric.unitShort}</span>
                      </div>
                    </div>

                    <div className="pt-2 border-t">
                      <p className={`text-xs font-medium ${getTitleClass()} mb-1`}>Benchmark:</p>
                      <p className={`text-xs ${getTitleClass()}`}>{metric.targetGuidance}</p>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <Card className="border-2 border-green-200 bg-green-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold text-green-900">
                  Nature-Positive Actions
                </h3>
                <Badge variant="outline" className="text-xs border-green-300 text-green-700">
                  ReCiPe 2016
                </Badge>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-200">
                  <Mountain className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900">Reduce Land Footprint</p>
                    <p className="text-xs text-green-700">
                      Optimise sourcing from low-impact suppliers and prioritise regenerative agriculture
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-200">
                  <Leaf className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900">Minimise Ecotoxicity</p>
                    <p className="text-xs text-green-700">
                      Phase out harmful chemicals and support organic/sustainable farming practices
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3 p-3 rounded-lg bg-white border border-green-200">
                  <Droplets className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-sm font-medium text-green-900">Control Nutrient Loading</p>
                    <p className="text-xs text-green-700">
                      Improve wastewater treatment and reduce agricultural runoff in supply chain
                    </p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900">
                Understanding These Metrics
              </p>
              <p className="text-xs text-blue-700">
                These metrics show average per-unit impacts across your product portfolio. Per-unit values allow fair comparison against industry benchmarks regardless of production volume. Total company impacts help you understand your overall nature footprint and prioritise reduction initiatives.
              </p>
            </CardContent>
          </Card>

          <Card className="bg-blue-50 border-blue-200">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900">
                TNFD LEAP Approach
              </p>
              <p className="text-xs text-blue-700">
                These metrics support the Taskforce on Nature-related Financial Disclosures (TNFD) framework. Use this data to identify nature-related dependencies, impacts, risks, and opportunities across your value chain.
              </p>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}
