'use client';

import React, { useState } from 'react';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { SectionTabs } from '@/components/studio/section-tabs';
import { Button } from '@/components/ui/button';
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

/**
 * Every category bar takes the room's ink.
 *
 * This was a fifteen-hue rainbow, one per GHG Protocol category. Fifteen hues
 * are not distinguishable to a reader and the category is named in words on
 * the same row, so the colour was encoding something already said — while
 * making the panel look like a chart of nothing in particular. The bar's job
 * is magnitude, and its width already carries that.
 */
const CATEGORY_BAR = 'bg-room-accent';

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
  const [tab, setTab] = useState('products');
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
    color: CATEGORY_BAR,
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
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <p className="text-xs text-studio-good dark:text-studio-good">Products</p>
                <p className="text-2xl font-bold text-studio-good">
                  {productDetails.length}
                </p>
              </div>
            </section>
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">Units Produced</p>
                <p className="text-2xl font-bold text-foreground">
                  {productDetails
                    .reduce((sum, p) => sum + p.unitsProduced, 0)
                    .toLocaleString()}
                </p>
              </div>
            </section>
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <p className="text-xs text-studio-attention dark:text-studio-attention">Total Emissions</p>
                <p className="text-2xl font-bold text-studio-attention">
                  {formatEmissions(selectedCategory.totalEmissions)} CO₂e
                </p>
              </div>
            </section>
          </div>

          
            <SectionTabs value={tab} onChange={setTab} tabs={[{ value: 'products', label: 'By Product' }, { value: 'materials', label: 'Top Materials' }, { value: 'entries', label: 'All Entries' }]} />

            {tab === 'products' && (
<div className="mt-4 space-y-3">
              {productDetails
                .sort((a, b) => b.totalEmissions - a.totalEmissions)
                .map(product => (
                  <section key={product.productId} className="border-t border-studio-hairline pt-5">
                    <div className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div>
                          <h4 className="font-semibold text-foreground">
                            {product.productName}
                          </h4>
                          {product.sku && (
                            <p className="text-xs text-muted-foreground">SKU: {product.sku}</p>
                          )}
                        </div>
                        <StateChip>
                          {formatEmissions(product.totalEmissions)} CO₂e
                        </StateChip>
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

                      <div className="w-full rounded-full h-2">
                        <div
                          className="h-full rounded-full bg-room-accent"
                          style={{
                            width: `${
                              (product.totalEmissions / selectedCategory.totalEmissions) * 100
                            }%`,
                          }}
                        />
                      </div>

                      {(product.materials.length > 0 || product.packaging.length > 0) && (
                        <div className="mt-4 pt-4 border-t">
                          <div className="grid md:grid-cols-2 gap-4">
                            {product.materials.length > 0 && (
                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2">
                                  Top Ingredients
                                </p>
                                <div className="space-y-1">
                                  {product.materials.map((m, idx) => (
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
                                  {product.packaging.map((p, idx) => (
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
                  </section>
                ))}
            </div>
)}

            {tab === 'materials' && (
<div className="mt-4 space-y-3">
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
            </div>
)}

            {tab === 'entries' && (
<div className="mt-4 space-y-3">
              <EmissionsDrillDownTable
                entries={entries}
                showCategory={false}
                emptyMessage="No individual entries recorded"
              />
            </div>
)}
          
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
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">Trips</p>
                <p className="text-2xl font-bold text-foreground">
                  {travelDetails.length}
                </p>
              </div>
            </section>
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground dark:text-muted-foreground">Total Distance</p>
                <p className="text-2xl font-bold text-foreground">
                  {travelDetails
                    .reduce((sum, t) => sum + (t.distance || 0), 0)
                    .toLocaleString()}{' '}
                  km
                </p>
              </div>
            </section>
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <p className="text-xs text-studio-attention dark:text-studio-attention">Total Emissions</p>
                <p className="text-2xl font-bold text-studio-attention">
                  {formatEmissions(selectedCategory.totalEmissions)} CO₂e
                </p>
              </div>
            </section>
          </div>

          <section className="border-t border-studio-hairline pt-5">
            <div className="mb-3">
              <Eyebrow>By Transport Mode</Eyebrow>
            </div>
            <div className="space-y-3">
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
            </div>
          </section>

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
          <section className="border-t border-studio-hairline pt-5">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Entries</p>
              <p className="text-2xl font-bold">{selectedCategory.entryCount}</p>
            </div>
          </section>
          <section className="border-t border-studio-hairline pt-5">
            <div className="space-y-3">
              <p className="text-xs text-muted-foreground">Total Emissions</p>
              <p className="text-2xl font-bold">
                {formatEmissions(selectedCategory.totalEmissions)} CO₂e
              </p>
            </div>
          </section>
        </div>

        {entries.length > 0 ? (
          <EmissionsDrillDownTable entries={entries} showCategory={false} />
        ) : (
          <section className="border-t border-studio-hairline pt-5">
            <div className="space-y-3">
              <Info className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
              <p className="text-sm text-muted-foreground">
                No detailed entries available for this category.
              </p>
              <p className="text-xs text-muted-foreground mt-2">
                Add data through the Company Footprint builder to see detailed breakdowns.
              </p>
            </div>
          </section>
        )}
      </div>
    );
  };

  if (isLoading) {
    return (
      <div className={cn('space-y-4', className)}>
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-studio-ink/10 rounded w-1/3" />
          <div className="h-64 bg-studio-ink/10 rounded" />
        </div>
      </div>
    );
  }

  return (
    <div className={cn('space-y-6', className)}>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-foreground">
            Scope 3 Emissions by Category
          </h3>
          <p className="text-sm text-muted-foreground">
            GHG Protocol Corporate Value Chain (Scope 3) Standard
          </p>
        </div>
        <StateChip>
          {formatEmissions(totalScope3)} CO₂e
        </StateChip>
      </div>

      <div className="grid grid-cols-4 gap-3">
        <section className="border-t border-studio-hairline pt-5">
          <div className="space-y-3">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-studio-good" />
            <p className="text-xl font-bold text-studio-good">
              {qualityStats.primary}
            </p>
            <p className="text-xs text-studio-good dark:text-studio-good">Primary Data</p>
          </div>
        </section>
        <section className="border-t border-studio-hairline pt-5">
          <div className="space-y-3">
            <CheckCircle2 className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">
              {qualityStats.secondary}
            </p>
            <p className="text-xs text-muted-foreground dark:text-muted-foreground">Secondary Data</p>
          </div>
        </section>
        <section className="border-t border-studio-hairline pt-5">
          <div className="space-y-3">
            <AlertCircle className="h-5 w-5 mx-auto mb-1 text-studio-attention" />
            <p className="text-xl font-bold text-studio-attention">
              {qualityStats.estimated}
            </p>
            <p className="text-xs text-studio-attention dark:text-studio-attention">Estimated</p>
          </div>
        </section>
        <section className="border-t border-studio-hairline pt-5">
          <div className="space-y-3">
            <AlertCircle className="h-5 w-5 mx-auto mb-1 text-muted-foreground" />
            <p className="text-xl font-bold text-foreground">
              {qualityStats.missing}
            </p>
            <p className="text-xs text-muted-foreground">Not Reported</p>
          </div>
        </section>
      </div>

      <section className="border-t border-studio-hairline pt-5">
        <div className="mb-3">
          <Eyebrow>Active Categories</Eyebrow>
          <p className="text-sm text-muted-foreground">
            {activeCategories.length} of 15 Scope 3 categories have reported emissions
          </p>
        </div>
        <div className="space-y-3">
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
        </div>
      </section>

      {inactiveCategories.length > 0 && (
        <section className="border-t border-studio-hairline pt-5">
          <div className="mb-3">
            <Eyebrow>Not Reported</Eyebrow>
          </div>
          <div className="space-y-3">
            <div className="flex flex-wrap gap-2">
              {inactiveCategories.map(cat => {
                const Icon = CATEGORY_ICONS[cat.category] || Package;
                return (
                  <StateChip>
                    <Icon className="h-3 w-3" />
                    Cat {cat.category}
                  </StateChip>
                );
              })}
            </div>
          </div>
        </section>
      )}

      <Sheet open={detailSheetOpen} onOpenChange={setDetailSheetOpen}>
        <SheetContent side="right" className="w-full sm:max-w-2xl overflow-y-auto">
          {selectedCategory && (
            <>
              <SheetHeader className="space-y-4 mb-6 pb-4 border-b">
                <div className="flex items-center gap-3">
                  <div
                    className={cn(
                      'p-2.5 rounded-[6px]',
                      CATEGORY_BAR
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
