import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Mountain, Leaf, Droplets, Wind, TrendingUp, Info, Sparkles, ArrowRight } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { NatureMetrics } from '@/hooks/data/useCompanyMetrics';
import {
  NATURE_PERFORMANCE_THRESHOLDS,
  RECIPE_2016_CATEGORIES,
  getPerformanceLevel,
  getPerformanceLabel,
  getPerformanceColorClass,
  getPerformanceBgColorClass,
  getPerformanceBarColorClass,
  getTargetGuidanceText,
  formatImpactValue,
  type PerformanceLevel,
  type NatureImpactCategory,
} from '@/lib/calculations/nature-biodiversity';

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

  // Use shared service for consistent performance evaluation
  const getPerformance = (category: NatureImpactCategory, value: number) => {
    const level = getPerformanceLevel(category, value);
    return {
      level: getPerformanceLabel(level),
      color: getPerformanceColorClass(level),
      bgColor: getPerformanceBgColorClass(level),
      barColor: getPerformanceBarColorClass(level),
    };
  };

  // Build metrics array using shared constants
  const metrics = [
    {
      name: RECIPE_2016_CATEGORIES.LAND_USE.name,
      category: 'land_use' as NatureImpactCategory,
      perUnit: perUnit.land_use,
      total: total.land_use,
      unit: RECIPE_2016_CATEGORIES.LAND_USE.unit,
      unitShort: RECIPE_2016_CATEGORIES.LAND_USE.unitShort,
      icon: Mountain,
      color: 'text-green-600',
      bgColor: 'bg-green-100',
      description: RECIPE_2016_CATEGORIES.LAND_USE.description,
      interpretation: 'Lower is better - less land transformed',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.LAND_USE.GOOD,
      },
      targetGuidance: getTargetGuidanceText('land_use'),
    },
    {
      name: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.name,
      category: 'terrestrial_ecotoxicity' as NatureImpactCategory,
      perUnit: perUnit.terrestrial_ecotoxicity,
      total: total.terrestrial_ecotoxicity,
      unit: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.unit,
      unitShort: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.unitShort,
      icon: Leaf,
      color: 'text-emerald-600',
      bgColor: 'bg-emerald-100',
      description: RECIPE_2016_CATEGORIES.TERRESTRIAL_ECOTOXICITY.description,
      interpretation: 'Lower is better - less toxic impact',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ECOTOXICITY.GOOD,
      },
      targetGuidance: getTargetGuidanceText('terrestrial_ecotoxicity'),
    },
    {
      name: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.name,
      category: 'freshwater_eutrophication' as NatureImpactCategory,
      perUnit: perUnit.freshwater_eutrophication,
      total: total.freshwater_eutrophication,
      unit: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.unit,
      unitShort: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.unitShort,
      icon: Droplets,
      color: 'text-blue-600',
      bgColor: 'bg-blue-100',
      description: RECIPE_2016_CATEGORIES.FRESHWATER_EUTROPHICATION.description,
      interpretation: 'Lower is better - less water pollution',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.FRESHWATER_EUTROPHICATION.GOOD,
      },
      targetGuidance: getTargetGuidanceText('freshwater_eutrophication'),
    },
    {
      name: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.name,
      category: 'terrestrial_acidification' as NatureImpactCategory,
      perUnit: perUnit.terrestrial_acidification,
      total: total.terrestrial_acidification,
      unit: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.unit,
      unitShort: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.unitShort,
      icon: Wind,
      color: 'text-purple-600',
      bgColor: 'bg-purple-100',
      description: RECIPE_2016_CATEGORIES.TERRESTRIAL_ACIDIFICATION.description,
      interpretation: 'Lower is better - less soil acidification',
      benchmark: {
        good: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.EXCELLENT,
        fair: NATURE_PERFORMANCE_THRESHOLDS.TERRESTRIAL_ACIDIFICATION.GOOD,
      },
      targetGuidance: getTargetGuidanceText('terrestrial_acidification'),
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
              const performance = getPerformance(metric.category, metric.perUnit);
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

          <Card className="border-2 border-teal-200 bg-gradient-to-br from-teal-50 to-emerald-50">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-teal-500 to-emerald-500">
                  <Sparkles className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-teal-900">
                    Get Nature-Positive Recommendations
                  </h3>
                  <p className="text-xs text-teal-700">
                    Personalised actions based on your actual data
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-lg bg-white border border-teal-200 space-y-3">
                <p className="text-sm text-teal-800">
                  Rosa can analyse your nature impact data and provide specific recommendations to:
                </p>
                <ul className="text-xs text-teal-700 space-y-1.5 ml-4 list-disc">
                  <li>Identify your highest-impact materials and suppliers</li>
                  <li>Suggest alternative sourcing strategies to reduce land use</li>
                  <li>Recommend actions to minimise ecotoxicity and eutrophication</li>
                  <li>Prioritise improvement initiatives based on your data</li>
                </ul>
              </div>

              <Link href="/rosa/" className="block">
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-teal-600 to-emerald-600 hover:from-teal-700 hover:to-emerald-700"
                >
                  <Sparkles className="h-4 w-4" />
                  Ask Rosa for Nature Recommendations
                  <ArrowRight className="h-4 w-4 ml-auto" />
                </Button>
              </Link>

              <p className="text-xs text-center text-teal-600">
                Try: &quot;What actions can I take to reduce my nature impact based on my product data?&quot;
              </p>
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
