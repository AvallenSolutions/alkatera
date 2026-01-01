'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import {
  Package,
  Factory,
  Zap,
  Truck,
  Trash2,
  Plane,
  Users,
  Building2,
  ShoppingCart,
  Recycle,
  Briefcase,
  Home,
  Landmark,
  PiggyBank,
  ChevronRight,
  AlertCircle,
  CheckCircle2,
  Info,
  TrendingDown,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryContributionChart, CategoryData } from './CategoryContributionChart';
import { EmissionsDrillDownTable, DrillDownEntry } from './EmissionsDrillDownTable';
import {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

interface Scope3CategoryBreakdownProps {
  categories: Scope3CategoryData[];
  productDetails: ProductEmissionDetail[];
  travelDetails: BusinessTravelDetail[];
  logisticsDetails: LogisticsDetail[];
  wasteDetails: WasteDetail[];
  totalScope3: number;
  year: number;
  isLoading?: boolean;
  className?: string;
}

const CATEGORY_ICONS: Record<number, typeof Package> = {
  1: ShoppingCart,
  2: Factory,
  3: Zap,
  4: Truck,
  5: Trash2,
  6: Plane,
  7: Users,
  8: Building2,
  9: Truck,
  10: Factory,
  11: Package,
  12: Recycle,
  13: Home,
  14: Landmark,
  15: PiggyBank,
};

const CATEGORY_COLORS: Record<number, string> = {
  1: 'bg-emerald-500',
  2: 'bg-teal-500',
  3: 'bg-cyan-500',
  4: 'bg-sky-500',
  5: 'bg-amber-500',
  6: 'bg-blue-500',
  7: 'bg-indigo-500',
  8: 'bg-violet-500',
  9: 'bg-fuchsia-500',
  10: 'bg-pink-500',
  11: 'bg-rose-500',
  12: 'bg-orange-500',
  13: 'bg-yellow-500',
  14: 'bg-lime-500',
  15: 'bg-green-500',
};

export function Scope3CategoryBreakdown({
  categories,
  productDetails,
  travelDetails,
  logisticsDetails,
  wasteDetails,
  totalScope3,
  year,
  isLoading,
  className,
}: Scope3CategoryBreakdownProps) {
  const [selectedCategory, setSelectedCategory] = useState<Scope3CategoryData | null>(null);
  const [detailSheetOpen, setDetailSheetOpen] = useState(false);

  const formatEmissions = (value: number): string => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} t`;
    }
    return `${value.toFixed(2)} kg`;
  };

  const activeCategories = categories.filter(cat => cat.totalEmissions > 0);
  const inactiveCategories = categories.filter(cat => cat.totalEmissions === 0);

  const chartData: CategoryData[] = activeCategories.map(cat => ({
    id: cat.category,
    name: `Cat ${cat.category}: ${cat.name}`,
    value: cat.totalEmissions,
    percentage: totalScope3 > 0 ? (cat.totalEmissions / totalScope3) * 100 : 0,
    dataQuality: cat.dataQuality,
    trend: cat.trend,
    trendValue: cat.trendPercentage,
    color: CATEGORY_COLORS[cat.category],
    onClick: () => {
      setSelectedCategory(cat);
      setDetailSheetOpen(true);
    },
  }));

  const getDataQualityStats = () => {
    const stats = { primary: 0, secondary: 0, estimated: 0, missing: 0 };
    categories.forEach(cat => {
      stats[cat.dataQuality]++;
    });
    return stats;
  };

  const qualityStats = getDataQualityStats();

  const renderCategoryDetail = () => {
    if (!selectedCategory) return null;

    const Icon = CATEGORY_ICONS[selectedCategory.category] || Package;

    let entries: DrillDownEntry[] = selectedCategory.entries.map(e => ({
      id: e.id,
      date: e.date,
      description: e.description,
      emissions: e.emissions,
      source: e.source,
      dataQuality: e.dataQuality,
      metadata: e.metadata,
    }));

    if (selectedCategory.category === 1 && productDetails.length > 0) {
      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200">
              <CardContent className="p-4">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">Products</p>
                <p className="text-2xl font-bold text-emerald-900 dark:text-emerald-100">
                  {productDetails.length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <CardContent className="p-4">
                <p className="text-xs text-blue-700 dark:text-blue-400">Units Produced</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {productDetails
                    .reduce((sum, p) => sum + p.unitsProduced, 0)
                    .toLocaleString()}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
              <CardContent className="p-4">
                <p className="text-xs text-amber-700 dark:text-amber-400">Total Emissions</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {formatEmissions(selectedCategory.totalEmissions)} CO₂e
                </p>
              </CardContent>
            </Card>
          </div>

          <Tabs defaultValue="products" className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="products">By Product</TabsTrigger>
              <TabsTrigger value="materials">Top Materials</TabsTrigger>
              <TabsTrigger value="entries">All Entries</TabsTrigger>
            </TabsList>

            <TabsContent value="products" className="mt-4 space-y-3">
              {productDetails
                .sort((a, b) => b.totalEmissions - a.totalEmissions)
                .map(product => (
                  <Card key={product.productId} className="overflow-hidden">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-slate-900 dark:text-slate-100">
                            {product.productName}
                          </h4>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                          )}
                        </div>
                        <Badge variant="secondary">
                          {formatEmissions(product.totalEmissions)} CO₂e
                        </Badge>
                      </div>

                      <div className="grid grid-cols-3 gap-4 text-sm mb-3">
                        <div>
                          <span className="text-muted-foreground">Units:</span>
                          <span className="ml-2 font-medium">
                            {product.unitsProduced.toLocaleString()}
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Per Unit:</span>
                          <span className="ml-2 font-medium">
                            {product.emissionsPerUnit.toFixed(4)} kg
                          </span>
                        </div>
                        <div>
                          <span className="text-muted-foreground">Contribution:</span>
                          <span className="ml-2 font-medium">
                            {(
                              (product.totalEmissions / selectedCategory.totalEmissions) *
                              100
                            ).toFixed(1)}
                            %
                          </span>
                        </div>
                      </div>

                      <div className="w-full bg-slate-100 dark:bg-slate-800 rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-emerald-500"
                          style={{
                            width: `${
                              (product.totalEmissions / selectedCategory.totalEmissions) * 100
                            }%`,
                          }}
                        />
                      </div>

                      {(product.materials.length > 0 || product.packaging.length > 0) && (
                        <div className="mt-4 pt-4 border-t border-slate-200 dark:border-slate-700">
                          <div className="grid md:grid-cols-2 gap-4">
                            {product.materials.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Top Ingredients
                                </p>
                                <div className="space-y-1">
                                  {product.materials.slice(0, 3).map((m, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="truncate">{m.name}</span>
                                      <span className="text-muted-foreground ml-2">
                                        {m.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                            {product.packaging.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Packaging
                                </p>
                                <div className="space-y-1">
                                  {product.packaging.slice(0, 3).map((p, idx) => (
                                    <div
                                      key={idx}
                                      className="flex items-center justify-between text-xs"
                                    >
                                      <span className="truncate">{p.name}</span>
                                      <span className="text-muted-foreground ml-2">
                                        {p.percentage.toFixed(1)}%
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>
                  </Card>
                ))}
            </TabsContent>

            <TabsContent value="materials" className="mt-4">
              {(() => {
                const allMaterials = productDetails.flatMap(p => [
                  ...p.materials.map(m => ({ ...m, type: 'ingredient' as const })),
                  ...p.packaging.map(m => ({ ...m, type: 'packaging' as const })),
                ]);
                const aggregated = new Map<
                  string,
                  { name: string; emissions: number; type: string }
                >();
                allMaterials.forEach(m => {
                  const existing = aggregated.get(m.name);
                  if (existing) {
                    existing.emissions += m.emissions;
                  } else {
                    aggregated.set(m.name, {
                      name: m.name,
                      emissions: m.emissions,
                      type: m.type,
                    });
                  }
                });
                const sorted = Array.from(aggregated.values()).sort(
                  (a, b) => b.emissions - a.emissions
                );
                const totalMaterialEmissions = sorted.reduce((sum, m) => sum + m.emissions, 0);

                return (
                  <CategoryContributionChart
                    categories={sorted.slice(0, 10).map((m, idx) => ({
                      id: m.name,
                      name: m.name,
                      value: m.emissions,
                      percentage:
                        totalMaterialEmissions > 0
                          ? (m.emissions / totalMaterialEmissions) * 100
                          : 0,
                      dataQuality: 'secondary' as const,
                    }))}
                    showTrends={false}
                    maxCategories={10}
                  />
                );
              })()}
            </TabsContent>

            <TabsContent value="entries" className="mt-4">
              <EmissionsDrillDownTable
                entries={entries}
                showCategory={false}
                emptyMessage="No individual entries recorded"
              />
            </TabsContent>
          </Tabs>
        </div>
      );
    }

    if (selectedCategory.category === 6 && travelDetails.length > 0) {
      const byMode = new Map<string, number>();
      travelDetails.forEach(t => {
        const mode = t.transportMode || 'Unknown';
        byMode.set(mode, (byMode.get(mode) || 0) + t.emissions);
      });

      return (
        <div className="space-y-6">
          <div className="grid grid-cols-3 gap-4">
            <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
              <CardContent className="p-4">
                <p className="text-xs text-blue-700 dark:text-blue-400">Trips</p>
                <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                  {travelDetails.length}
                </p>
              </CardContent>
            </Card>
            <Card className="bg-sky-50 dark:bg-sky-950/20 border-sky-200">
              <CardContent className="p-4">
                <p className="text-xs text-sky-700 dark:text-sky-400">Total Distance</p>
                <p className="text-2xl font-bold text-sky-900 dark:text-sky-100">
                  {travelDetails
                    .reduce((sum, t) => sum + (t.distance || 0), 0)
                    .toLocaleString()}{' '}
                  km
                </p>
              </CardContent>
            </Card>
            <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
              <CardContent className="p-4">
                <p className="text-xs text-amber-700 dark:text-amber-400">Total Emissions</p>
                <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                  {formatEmissions(selectedCategory.totalEmissions)} CO₂e
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">By Transport Mode</CardTitle>
            </CardHeader>
            <CardContent>
              <CategoryContributionChart
                categories={Array.from(byMode.entries())
                  .sort((a, b) => b[1] - a[1])
                  .map(([mode, emissions]) => ({
                    id: mode,
                    name: mode,
                    value: emissions,
                    percentage:
                      selectedCategory.totalEmissions > 0
                        ? (emissions / selectedCategory.totalEmissions) * 100
                        : 0,
                  }))}
                showTrends={false}
              />
            </CardContent>
          </Card>

          <EmissionsDrillDownTable
            entries={travelDetails.map(t => ({
              id: t.id,
              date: t.date,
              description: `${t.transportMode}${t.cabinClass ? ` (${t.cabinClass})` : ''}`,
              emissions: t.emissions,
              source: t.distance ? 'Distance-based' : 'Spend-based',
              dataQuality: 'secondary' as const,
              metadata: {
                distance: t.distance ? `${t.distance} km` : undefined,
                spend: t.spend ? `${t.spend.toLocaleString()}` : undefined,
                cabinClass: t.cabinClass,
              },
            }))}
            title="All Business Travel"
          />
        </div>
      );
    }

    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-2xl font-bold">{selectedCategory.entryCount}</p>
            </CardContent>
          </Card>
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">Total Emissions</p>
              <p className="text-2xl font-bold">
                {formatEmissions(selectedCategory.totalEmissions)} CO₂e
              </p>
            </CardContent>
          </Card>
        </div>

        {entries.length > 0 ? (
          <EmissionsDrillDownTable entries={entries} showCategory={false} />
        ) : (
          <Card className="bg-slate-50 dark:bg-slate-900/50">
            <CardContent className="p-8 text-center">
              <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                No detailed entries available for this category.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Add data through the Company Footprint builder to see detailed breakdowns.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 dark:bg-slate-700 rounded w-1/3" />
          <div className="h-64 bg-slate-200 dark:bg-slate-700 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
            Scope 3 Emissions by Category
          </h3>
          <p className="text-sm text-muted-foreground">
            GHG Protocol Corporate Value Chain (Scope 3) Standard
          </p>
        </div>
        <Badge variant="outline" className="text-lg font-mono">
          {formatEmissions(totalScope3)} CO₂e
        </Badge>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <Card className="bg-green-50 dark:bg-green-950/20 border-green-200">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-green-600" />
            <p className="text-xl font-bold text-green-900 dark:text-green-100">
              {qualityStats.primary}
            </p>
            <p className="text-xs text-green-700 dark:text-green-400">Primary Data</p>
          </CardContent>
        </Card>
        <Card className="bg-blue-50 dark:bg-blue-950/20 border-blue-200">
          <CardContent className="p-3 text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-blue-600" />
            <p className="text-xl font-bold text-blue-900 dark:text-blue-100">
              {qualityStats.secondary}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-400">Secondary Data</p>
          </CardContent>
        </Card>
        <Card className="bg-amber-50 dark:bg-amber-950/20 border-amber-200">
          <CardContent className="p-3 text-center">
            <AlertCircle className="h-5 w-5 mx-auto mb-1 text-amber-600" />
            <p className="text-xl font-bold text-amber-900 dark:text-amber-100">
              {qualityStats.estimated}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-400">Estimated</p>
          </CardContent>
        </Card>
        <Card className="bg-slate-50 dark:bg-slate-900/50 border-slate-200">
          <CardContent className="p-3 text-center">
            <AlertCircle className="h-5 w-5 mx-auto mb-1 text-slate-400" />
            <p className="text-xl font-bold text-slate-900 dark:text-slate-100">
              {qualityStats.missing}
            </p>
            <p className="text-xs text-muted-foreground">Not Reported</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Active Categories</CardTitle>
          <CardDescription>
            {activeCategories.length} of 15 Scope 3 categories have reported emissions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {activeCategories.length > 0 ? (
            <CategoryContributionChart
              categories={chartData}
              showTrends={false}
              showDataQuality={true}
              onCategoryClick={cat => {
                const selected = categories.find(c => c.category === cat.id);
                if (selected) {
                  setSelectedCategory(selected);
                  setDetailSheetOpen(true);
                }
              }}
            />
          ) : (
            <div className="text-center py-8">
              <AlertCircle className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">No Scope 3 emissions data for {year}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Add product LCAs or corporate overhead data to calculate Scope 3 emissions.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {inactiveCategories.length > 0 && (
        <Card className="bg-slate-50 dark:bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-sm text-muted-foreground">Not Reported</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inactiveCategories.map(cat => {
                const Icon = CATEGORY_ICONS[cat.category] || Package;
                return (
                  <Badge
                    key={cat.category}
                    variant="outline"
                    className="text-muted-foreground gap-1"
                  >
                    <Icon className="h-3 w-3" />
                    Cat {cat.category}
                  </Badge>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCategory && (
            <>
              <SheetHeader className="space-y-4 mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2.5 rounded-lg',
                      CATEGORY_COLORS[selectedCategory.category]
                    )}
                  >
                    {(() => {
                      const Icon = CATEGORY_ICONS[selectedCategory.category] || Package;
                      return <Icon className="h-5 w-5 text-white" />;
                    })()}
                  </div>
                  <div>
                    <SheetTitle>
                      Category {selectedCategory.category}: {selectedCategory.name}
                    </SheetTitle>
                    <SheetDescription>{selectedCategory.description}</SheetDescription>
                  </div>
                </div>
              </SheetHeader>

              {renderCategoryDetail()}
            </>
          )}
        </SheetContent>
      </Sheet>
    </div>
  );
}
