import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { BarChart3, Leaf, Package, FlaskConical, AlertCircle, CheckCircle2, Info, Globe } from 'lucide-react';
import { ScopeBreakdown } from '@/hooks/data/useCompanyMetrics';
import { MaterialBreakdownItem, GHGBreakdown } from './CarbonBreakdownSheet';
import { LifecycleStageBreakdown, FacilityEmissionsBreakdown } from '@/hooks/data/useCompanyMetrics';
import { Scope3CategoryBreakdown } from './Scope3CategoryBreakdown';
import {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

interface CarbonDeepDiveProps {
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
  materialBreakdown?: MaterialBreakdownItem[];
  ghgBreakdown?: GHGBreakdown | null;
  lifecycleStageBreakdown?: LifecycleStageBreakdown[];
  facilityEmissionsBreakdown?: FacilityEmissionsBreakdown[];
  scope3Categories?: Scope3CategoryData[];
  scope3ProductDetails?: ProductEmissionDetail[];
  scope3TravelDetails?: BusinessTravelDetail[];
  scope3LogisticsDetails?: LogisticsDetail[];
  scope3WasteDetails?: WasteDetail[];
  scope3Total?: number;
  year?: number;
  isLoadingScope3?: boolean;
}

export function CarbonDeepDive({
  scopeBreakdown,
  totalCO2,
  materialBreakdown,
  ghgBreakdown,
  lifecycleStageBreakdown,
  facilityEmissionsBreakdown,
  scope3Categories,
  scope3ProductDetails,
  scope3TravelDetails,
  scope3LogisticsDetails,
  scope3WasteDetails,
  scope3Total,
  year,
  isLoadingScope3,
}: CarbonDeepDiveProps) {
  const [sortBy, setSortBy] = useState<'impact' | 'name' | 'quantity'>('impact');
  const hasScope3Data = scope3Categories && scope3Categories.length > 0;

  // Check if we have any data to display
  const hasMaterialData = materialBreakdown && materialBreakdown.length > 0;
  const hasGhgData = ghgBreakdown && ghgBreakdown.carbon_origin;
  const hasScopeData = scopeBreakdown && (scopeBreakdown.scope1 > 0 || scopeBreakdown.scope2 > 0 || scopeBreakdown.scope3 > 0);
  const hasLifecycleData = lifecycleStageBreakdown && lifecycleStageBreakdown.length > 0;
  const hasFacilityData = facilityEmissionsBreakdown && facilityEmissionsBreakdown.length > 0;

  // We have data if we have ANY of these
  const hasData = hasMaterialData || hasGhgData || hasScopeData || hasLifecycleData || hasFacilityData;

  if (!hasData) {
    // Provide context-specific empty states
    const hasPartialData = totalCO2 > 0;

    return (
      <Card>
        <CardContent className="p-8 space-y-4">
          <div className="text-center text-muted-foreground">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />

            {hasPartialData ? (
              <>
                <p className="text-sm font-medium">Partial carbon data available</p>
                <div className="mt-4 p-4 bg-blue-50 rounded-lg text-left">
                  <p className="text-sm font-semibold text-blue-900">Summary metric: {(totalCO2 / 1000).toFixed(3)} tCO₂eq</p>
                  <p className="text-xs text-blue-700 mt-2">
                    Detailed breakdown pending. Run a full LCA calculation to see:
                  </p>
                  <ul className="text-xs text-blue-700 mt-2 space-y-1 list-disc list-inside">
                    <li>Material-level contributions</li>
                    <li>GHG gas inventory (CO₂, CH₄, N₂O)</li>
                    <li>Lifecycle stage breakdown</li>
                    <li>Facility operations data</li>
                  </ul>
                </div>
              </>
            ) : (
              <>
                <p className="text-sm font-medium">No carbon breakdown data available</p>
                <div className="mt-4 space-y-3">
                  <div className="p-4 bg-orange-50 rounded-lg text-left">
                    <p className="text-sm font-semibold text-orange-900">Getting Started</p>
                    <p className="text-xs text-orange-700 mt-2">
                      To see detailed carbon breakdowns:
                    </p>
                    <ol className="text-xs text-orange-700 mt-2 space-y-1 list-decimal list-inside">
                      <li>Navigate to Products → New Product</li>
                      <li>Add materials and packaging data</li>
                      <li>Run LCA calculation</li>
                      <li>Return here to view detailed breakdown</li>
                    </ol>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Once you have completed LCAs, this view will display rich insights including emissions by material, lifecycle stage, and production facility.
                  </p>
                </div>
              </>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  // Sort materials
  const sortedMaterials = materialBreakdown ? [...materialBreakdown].sort((a, b) => {
    if (sortBy === 'impact') return b.climate - a.climate;
    if (sortBy === 'name') return a.name.localeCompare(b.name);
    if (sortBy === 'quantity') return b.quantity - a.quantity;
    return 0;
  }) : [];

  // Calculate percentages
  const materialsWithPercentage = sortedMaterials.map(m => ({
    ...m,
    percentage: totalCO2 > 0 ? (m.climate / totalCO2) * 100 : 0,
  }));

  // Separate ingredients from packaging
  const ingredients = materialsWithPercentage.filter(m =>
    !m.name.toLowerCase().includes('bottle') &&
    !m.name.toLowerCase().includes('cap') &&
    !m.name.toLowerCase().includes('label') &&
    !m.name.toLowerCase().includes('packaging')
  );

  const packaging = materialsWithPercentage.filter(m =>
    m.name.toLowerCase().includes('bottle') ||
    m.name.toLowerCase().includes('cap') ||
    m.name.toLowerCase().includes('label') ||
    m.name.toLowerCase().includes('packaging')
  );

  const ingredientsTotal = ingredients.reduce((sum, m) => sum + m.climate, 0);
  const packagingTotal = packaging.reduce((sum, m) => sum + m.climate, 0);

  // Calculate scope total for percentage calculations
  const scopeTotal = scopeBreakdown
    ? scopeBreakdown.scope1 + scopeBreakdown.scope2 + scopeBreakdown.scope3
    : 0;

  const getDataSourceBadge = (source?: string) => {
    const config: Record<string, { label: string; className: string }> = {
      primary: { label: 'Primary Data', className: 'bg-green-600' },
      secondary_modelled: { label: 'Secondary', className: 'bg-blue-600' },
      secondary: { label: 'Secondary', className: 'bg-blue-600' },
      missing: { label: 'Missing Data', className: 'bg-red-600' },
      modelled: { label: 'Modelled', className: 'bg-amber-600' },
    };

    const badgeConfig = config[source || 'secondary_modelled'] || config.secondary_modelled;
    return <Badge variant="default" className={`${badgeConfig.className} text-xs`}>{badgeConfig.label}</Badge>;
  };

  return (
    <div className="space-y-6">
      <Tabs defaultValue="overview" className="w-full">
        <TabsList className="grid w-full grid-cols-5">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="scope3" className="flex items-center gap-1">
            <Globe className="h-3 w-3" />
            Scope 3
          </TabsTrigger>
          <TabsTrigger value="stages">Lifecycle</TabsTrigger>
          <TabsTrigger value="materials">Materials</TabsTrigger>
          <TabsTrigger value="ghg">GHG Detail</TabsTrigger>
        </TabsList>

        {/* Overview Tab with Scope Breakdown */}
        <TabsContent value="overview" className="space-y-4 mt-6">
          {/* Compliance Standards Banner */}
          <Card className="border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50">
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <CheckCircle2 className="h-5 w-5 text-blue-600 mt-0.5 flex-shrink-0" />
                <div className="space-y-2 flex-1">
                  <p className="text-sm font-semibold text-blue-900">Reporting Standards Compliance</p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-green-100 text-green-800 border-green-300">
                        ISO 14067
                      </Badge>
                      <span className="text-xs text-muted-foreground">Carbon footprint quantification</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 border-blue-300">
                        GHG Protocol
                      </Badge>
                      <span className="text-xs text-muted-foreground">Scope 1, 2, 3 accounting</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 border-purple-300">
                        CSRD E1-6
                      </Badge>
                      <span className="text-xs text-muted-foreground">EU sustainability reporting</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Data Quality Validation Banner */}
          {ghgBreakdown && (
            (() => {
              const fossilBiogenicLuc = ghgBreakdown.carbon_origin.fossil + ghgBreakdown.carbon_origin.biogenic + ghgBreakdown.carbon_origin.land_use_change;
              const variance = Math.abs(fossilBiogenicLuc - totalCO2);
              const variancePercent = totalCO2 > 0 ? (variance / totalCO2) * 100 : 0;
              const isValid = variancePercent <= 5;

              if (!isValid) {
                return (
                  <Card className="border-amber-300 bg-amber-50">
                    <CardContent className="p-4 flex items-start gap-3">
                      <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-amber-900">Data Quality Warning</p>
                        <p className="text-xs text-amber-700">
                          Carbon origin sum ({(fossilBiogenicLuc / 1000).toFixed(3)} t) deviates {variancePercent.toFixed(1)}% from total ({(totalCO2 / 1000).toFixed(3)} t).
                          ISO 14067 recommends &lt;5% variance.
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              } else {
                return (
                  <Card className="border-green-300 bg-green-50">
                    <CardContent className="p-4 flex items-start gap-3">
                      <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-green-900">ISO 14067 Validated</p>
                        <p className="text-xs text-green-700">
                          Carbon origin breakdown validated with {variancePercent.toFixed(2)}% variance (within 5% tolerance).
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              }
            })()
          )}

          <div className="grid md:grid-cols-2 gap-4">
            {/* Scope Breakdown Card */}
            {scopeBreakdown && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    GHG Protocol Scopes
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Scope 1 (Direct)</span>
                        <Badge variant="outline" className="bg-red-50 text-slate-900">
                          {(scopeBreakdown.scope1 / 1000).toFixed(3)} tCO₂eq
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-red-600 h-2 rounded-full"
                          style={{ width: `${scopeTotal > 0 ? (scopeBreakdown.scope1 / scopeTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scopeTotal > 0 ? ((scopeBreakdown.scope1 / scopeTotal) * 100).toFixed(1) : 0}% - Facility operations
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Scope 2 (Energy)</span>
                        <Badge variant="outline" className="bg-orange-50 text-slate-900">
                          {(scopeBreakdown.scope2 / 1000).toFixed(3)} tCO₂eq
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-orange-600 h-2 rounded-full"
                          style={{ width: `${scopeTotal > 0 ? (scopeBreakdown.scope2 / scopeTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scopeTotal > 0 ? ((scopeBreakdown.scope2 / scopeTotal) * 100).toFixed(1) : 0}% - Purchased electricity
                      </p>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium">Scope 3 (Value Chain)</span>
                        <Badge variant="outline" className="bg-yellow-50 text-slate-900">
                          {(scopeBreakdown.scope3 / 1000).toFixed(3)} tCO₂eq
                        </Badge>
                      </div>
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-yellow-600 h-2 rounded-full"
                          style={{ width: `${scopeTotal > 0 ? (scopeBreakdown.scope3 / scopeTotal) * 100 : 0}%` }}
                        />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {scopeTotal > 0 ? ((scopeBreakdown.scope3 / scopeTotal) * 100).toFixed(1) : 0}% - Materials, transport, end-of-life
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Summary Stats */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Carbon Footprint Summary</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-3">
                  <div className="flex items-center justify-between p-3 bg-orange-50 rounded-lg">
                    <span className="text-sm font-medium text-slate-900">Total Emissions</span>
                    <span className="text-lg font-bold text-orange-900">
                      {(totalCO2 / 1000).toFixed(3)} tCO₂eq
                    </span>
                  </div>

                  {materialBreakdown && materialBreakdown.length > 0 && (
                    <>
                      <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-900">Materials Tracked</span>
                        <span className="text-lg font-bold text-blue-900">
                          {materialBreakdown.length}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-900">Top Contributor</span>
                        <span className="text-sm font-bold text-green-900">
                          {materialBreakdown[0]?.name}
                        </span>
                      </div>

                      <div className="flex items-center justify-between p-3 bg-purple-50 rounded-lg">
                        <span className="text-sm font-medium text-slate-900">Contribution</span>
                        <span className="text-sm font-bold text-purple-900">
                          {(() => {
                            const climate = materialBreakdown[0]?.climate;
                            if (
                              climate != null &&
                              Number.isFinite(climate) &&
                              Number.isFinite(totalCO2) &&
                              totalCO2 > 0
                            ) {
                              const percentage = (climate / totalCO2) * 100;
                              return Number.isFinite(percentage) ? percentage.toFixed(1) : '0';
                            }
                            return '0';
                          })()}%
                        </span>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* Scope 3 Deep Dive Tab */}
        <TabsContent value="scope3" className="space-y-4 mt-6">
          {hasScope3Data ? (
            <Scope3CategoryBreakdown
              categories={scope3Categories}
              productDetails={scope3ProductDetails || []}
              travelDetails={scope3TravelDetails || []}
              logisticsDetails={scope3LogisticsDetails || []}
              wasteDetails={scope3WasteDetails || []}
              totalScope3={scope3Total || 0}
              year={year || new Date().getFullYear()}
              isLoading={isLoadingScope3}
            />
          ) : (
            <Card>
              <CardContent className="p-8 text-center">
                <Globe className="h-12 w-12 mx-auto mb-4 text-muted-foreground opacity-50" />
                <p className="text-sm font-medium text-muted-foreground">
                  No Scope 3 breakdown data available
                </p>
                <p className="text-xs text-muted-foreground mt-2">
                  Add product LCAs, business travel, or overhead data to see a detailed Scope 3 breakdown by GHG Protocol category.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Lifecycle Stages Tab */}
        <TabsContent value="stages" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Package className="h-5 w-5 text-green-600" />
                  <CardTitle className="text-lg">Emissions by Lifecycle Stage</CardTitle>
                </div>
                <Badge variant="outline" className="text-xs">ISO 14040/14044</Badge>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {lifecycleStageBreakdown && lifecycleStageBreakdown.length > 0 ? (
                <div className="space-y-4">
                  {lifecycleStageBreakdown.map((stage, index) => (
                    <Card key={index} className="border-2">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-center justify-between">
                          <h3 className="font-semibold text-sm">{stage.stage_name}</h3>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline">{(stage.percentage ?? 0).toFixed(1)}%</Badge>
                            <span className="text-sm font-bold">{((stage.total_impact ?? 0) / 1000).toFixed(3)} tCO₂eq</span>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-green-600 to-green-400 h-3 rounded-full"
                            style={{ width: `${stage.percentage ?? 0}%` }}
                          />
                        </div>

                        <div className="space-y-1">
                          <p className="text-xs text-muted-foreground">
                            {stage.material_count ?? 0} materials contributing
                          </p>
                          {stage.top_contributors && stage.top_contributors.length > 0 && (
                            <div className="flex flex-wrap gap-1 mt-2">
                              {stage.top_contributors.map((contrib, idx) => (
                                <Badge key={idx} variant="secondary" className="text-xs">
                                  {contrib.name}: {(contrib.impact ?? 0).toFixed(3)}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <Info className="h-12 w-12 mx-auto mb-4 opacity-50" />
                  <p className="text-sm">Lifecycle stage data unavailable</p>
                  <p className="text-xs mt-2">Ensure materials are classified with lifecycle stages in the LCA data</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Facility Operations Breakdown */}
          {facilityEmissionsBreakdown && facilityEmissionsBreakdown.length > 0 && (
            <Card className="mt-6">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5 text-blue-600" />
                    <CardTitle className="text-lg">Emissions by Production Facility</CardTitle>
                  </div>
                  <Badge variant="outline" className="text-xs">Operations Data</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-4">
                  {facilityEmissionsBreakdown.map((facility, index) => (
                    <Card key={index} className="border-2">
                      <CardContent className="p-4 space-y-3">
                        <div className="flex items-start justify-between">
                          <div className="space-y-1">
                            <h3 className="font-semibold text-sm">{facility.facility_name}</h3>
                            <p className="text-xs text-muted-foreground">
                              {facility.location_city}, {facility.location_country_code}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge variant="outline">{(facility.percentage ?? 0).toFixed(1)}%</Badge>
                            <p className="text-sm font-bold mt-1">{((facility.total_emissions ?? 0) / 1000).toFixed(3)} tCO₂eq</p>
                          </div>
                        </div>

                        <div className="w-full bg-gray-200 rounded-full h-3">
                          <div
                            className="bg-gradient-to-r from-blue-600 to-blue-400 h-3 rounded-full"
                            style={{ width: `${facility.percentage ?? 0}%` }}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs">
                          <div className="flex items-center justify-between p-2 bg-red-50 rounded">
                            <span className="text-muted-foreground">Scope 1</span>
                            <span className="font-semibold">{((facility.scope1_emissions ?? 0) / 1000).toFixed(3)} t</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-orange-50 rounded">
                            <span className="text-muted-foreground">Scope 2</span>
                            <span className="font-semibold">{((facility.scope2_emissions ?? 0) / 1000).toFixed(3)} t</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-blue-50 rounded">
                            <span className="text-muted-foreground">Production</span>
                            <span className="font-semibold">{(facility.production_volume ?? 0).toLocaleString()} units</span>
                          </div>
                          <div className="flex items-center justify-between p-2 bg-green-50 rounded">
                            <span className="text-muted-foreground">Intensity</span>
                            <span className="font-semibold">{((facility.facility_intensity ?? 0) / 1000).toFixed(6)} t/unit</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* GHG Gas Inventory Tab */}
        <TabsContent value="ghg" className="space-y-4 mt-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FlaskConical className="h-5 w-5 text-orange-600" />
                  <CardTitle className="text-lg">Greenhouse Gas Inventory</CardTitle>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline" className="text-xs">ISO 14067</Badge>
                  <Badge variant="outline" className="text-xs">GHG Protocol</Badge>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              {ghgBreakdown ? (
                <>
                  {/* Summary Cards */}
                  <div className="grid grid-cols-3 gap-4">
                    <Card className="bg-orange-50 border-orange-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-orange-900">
                            {(totalCO2 / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                          </span>
                          <span className="text-xs text-muted-foreground">tCO₂eq</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">Total GHG Emissions</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-blue-900">
                            {ghgBreakdown.gwp_factors.methane_gwp100}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">CH₄ Factor (100-year)</p>
                      </CardContent>
                    </Card>

                    <Card className="bg-blue-50 border-blue-200">
                      <CardContent className="p-4">
                        <div className="flex items-baseline gap-2">
                          <span className="text-2xl font-bold text-blue-900">
                            {ghgBreakdown.gwp_factors.n2o_gwp100}
                          </span>
                          <span className="text-xs text-muted-foreground">GWP</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">N₂O Factor (100-year)</p>
                      </CardContent>
                    </Card>
                  </div>

                  {/* Gas Inventory Table */}
                  <div>
                    <h3 className="text-sm font-semibold mb-3 flex items-center gap-2">
                      <Info className="h-4 w-4" />
                      Gas-by-Gas Breakdown
                    </h3>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-orange-50">
                            <TableHead className="font-semibold">Gas Species</TableHead>
                            <TableHead className="font-semibold text-right">Mass (t)</TableHead>
                            <TableHead className="font-semibold text-center">GWP100 Factor</TableHead>
                            <TableHead className="font-semibold text-right">CO₂eq (t)</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-red-500" />
                                CO₂ (Fossil)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {(ghgBreakdown.gas_inventory.co2_fossil / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right font-semibold">
                              {(ghgBreakdown.gas_inventory.co2_fossil / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.co2_fossil / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-green-500" />
                                CO₂ (Biogenic)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {(ghgBreakdown.gas_inventory.co2_biogenic / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">1</TableCell>
                            <TableCell className="text-right font-semibold">
                              {(ghgBreakdown.gas_inventory.co2_biogenic / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {((ghgBreakdown.gas_inventory.co2_biogenic / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-blue-500" />
                                Methane (CH₄)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {(ghgBreakdown.gas_inventory.methane / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">{ghgBreakdown.gwp_factors.methane_gwp100}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {((ghgBreakdown.gas_inventory.methane * ghgBreakdown.gwp_factors.methane_gwp100) / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {(((ghgBreakdown.gas_inventory.methane * ghgBreakdown.gwp_factors.methane_gwp100) / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          <TableRow>
                            <TableCell className="font-medium">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 rounded-full bg-purple-500" />
                                Nitrous Oxide (N₂O)
                              </div>
                            </TableCell>
                            <TableCell className="text-right">
                              {(ghgBreakdown.gas_inventory.nitrous_oxide / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-center">{ghgBreakdown.gwp_factors.n2o_gwp100}</TableCell>
                            <TableCell className="text-right font-semibold">
                              {((ghgBreakdown.gas_inventory.nitrous_oxide * ghgBreakdown.gwp_factors.n2o_gwp100) / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                            </TableCell>
                            <TableCell className="text-right">
                              {(((ghgBreakdown.gas_inventory.nitrous_oxide * ghgBreakdown.gwp_factors.n2o_gwp100) / totalCO2) * 100).toFixed(1)}%
                            </TableCell>
                          </TableRow>

                          {ghgBreakdown.gas_inventory.hfc_pfc > 0 && (
                            <TableRow>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <div className="w-3 h-3 rounded-full bg-amber-500" />
                                  F-gases (HFC/PFC)
                                </div>
                              </TableCell>
                              <TableCell className="text-right">-</TableCell>
                              <TableCell className="text-center">Various</TableCell>
                              <TableCell className="text-right font-semibold">
                                {(ghgBreakdown.gas_inventory.hfc_pfc / 1000).toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}
                              </TableCell>
                              <TableCell className="text-right">
                                {((ghgBreakdown.gas_inventory.hfc_pfc / totalCO2) * 100).toFixed(1)}%
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </div>

                  {/* Methodology Note */}
                  <Card className="bg-blue-50 border-blue-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <CheckCircle2 className="h-4 w-4 text-blue-600 mt-0.5" />
                        <div className="space-y-1">
                          <p className="text-sm font-semibold text-blue-900">Assessment Method: {ghgBreakdown.gwp_factors.method}</p>
                          <p className="text-xs text-muted-foreground">
                            Global Warming Potentials calculated using {ghgBreakdown.gwp_factors.method} characterisation factors.
                            All emissions converted to 100-year CO₂ equivalents per IPCC methodology.
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  {/* CSRD E1 Compliance Note */}
                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-purple-600 mt-0.5 flex-shrink-0" />
                        <div className="space-y-2">
                          <p className="text-sm font-semibold text-purple-900">CSRD E1-6: GHG Emissions</p>
                          <p className="text-xs text-muted-foreground leading-relaxed">
                            This breakdown satisfies European Sustainability Reporting Standards (ESRS) E1-6 disclosure requirements for gross Scope 1, 2, and 3 GHG emissions,
                            including disaggregation by greenhouse gas type (CO₂, CH₄, N₂O, HFCs) and biogenic/fossil origin distinction as required for EU sustainability reporting.
                          </p>
                          <div className="grid grid-cols-2 gap-2 mt-3">
                            <div className="text-xs">
                              <Badge variant="outline" className="bg-green-100 text-green-800 text-[10px] mb-1">Required</Badge>
                              <p className="text-muted-foreground">Scope 1, 2, 3 totals</p>
                            </div>
                            <div className="text-xs">
                              <Badge variant="outline" className="bg-green-100 text-green-800 text-[10px] mb-1">Required</Badge>
                              <p className="text-muted-foreground">Gas-by-gas breakdown</p>
                            </div>
                            <div className="text-xs">
                              <Badge variant="outline" className="bg-green-100 text-green-800 text-[10px] mb-1">Required</Badge>
                              <p className="text-muted-foreground">Biogenic CO₂ separate</p>
                            </div>
                            <div className="text-xs">
                              <Badge variant="outline" className="bg-blue-100 text-blue-800 text-[10px] mb-1">Optional</Badge>
                              <p className="text-muted-foreground">Land use change</p>
                            </div>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              ) : (
                <div className="text-center py-8 text-muted-foreground">
                  <p className="text-sm">GHG breakdown not available for this calculation</p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Material Breakdown Tab */}
        <TabsContent value="materials" className="space-y-4 mt-6">
          {materialBreakdown && materialBreakdown.length > 0 ? (
            <>
              {/* Summary Statistics */}
              <div className="grid grid-cols-3 gap-4">
                <Card className="bg-green-50 border-green-200">
                  <CardContent className="p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-green-900">
                        {ingredients.length}
                      </span>
                      <span className="text-xs text-muted-foreground">ingredients</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(ingredientsTotal / 1000).toFixed(3)} tCO₂eq total
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-blue-50 border-blue-200">
                  <CardContent className="p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-blue-900">
                        {packaging.length}
                      </span>
                      <span className="text-xs text-muted-foreground">packaging parts</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(packagingTotal / 1000).toFixed(3)} tCO₂eq total
                    </p>
                  </CardContent>
                </Card>

                <Card className="bg-orange-50 border-orange-200">
                  <CardContent className="p-4">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold text-orange-900">
                        {materialBreakdown.length}
                      </span>
                      <span className="text-xs text-muted-foreground">total materials</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {(totalCO2 / 1000).toFixed(3)} tCO₂eq combined
                    </p>
                  </CardContent>
                </Card>
              </div>

              {/* Sort Options */}
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  Material-by-Material Impact Analysis
                </h3>
                <div className="flex gap-2">
                  <Badge
                    variant={sortBy === 'impact' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSortBy('impact')}
                  >
                    By Impact
                  </Badge>
                  <Badge
                    variant={sortBy === 'name' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSortBy('name')}
                  >
                    By Name
                  </Badge>
                  <Badge
                    variant={sortBy === 'quantity' ? 'default' : 'outline'}
                    className="cursor-pointer"
                    onClick={() => setSortBy('quantity')}
                  >
                    By Quantity
                  </Badge>
                </div>
              </div>

              {/* Ingredients Section */}
              {ingredients.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Leaf className="h-4 w-4 text-green-600" />
                      Ingredients ({ingredients.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-green-50">
                            <TableHead className="font-semibold">Material Name</TableHead>
                            <TableHead className="font-semibold text-right">Quantity</TableHead>
                            <TableHead className="font-semibold text-right">Emission Factor</TableHead>
                            <TableHead className="font-semibold text-right">Total Impact</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                            <TableHead className="font-semibold text-center">Data Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {ingredients.map((material, idx) => {
                            const climateValue = material.climate ?? 0;
                            const quantityValue = material.quantity ?? 0;
                            const percentageValue = material.percentage ?? 0;
                            const emissionFactor = quantityValue > 0 ? climateValue / quantityValue : 0;
                            return (
                              <TableRow key={idx} className={percentageValue > 5 ? 'bg-orange-50/50' : ''}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.warning && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      {material.warning}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {quantityValue.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {material.unit || ''}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {(emissionFactor / 1000).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} tCO₂eq/{material.unit || ''}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {(climateValue / 1000).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} t
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-green-500"
                                        style={{ width: `${Math.min(percentageValue, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {percentageValue.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getDataSourceBadge(material.source)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}

              {/* Packaging Section */}
              {packaging.length > 0 && (
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base flex items-center gap-2">
                      <Package className="h-4 w-4 text-blue-600" />
                      Packaging ({packaging.length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="border rounded-lg overflow-hidden">
                      <Table>
                        <TableHeader>
                          <TableRow className="bg-blue-50">
                            <TableHead className="font-semibold">Material Name</TableHead>
                            <TableHead className="font-semibold text-right">Quantity</TableHead>
                            <TableHead className="font-semibold text-right">Emission Factor</TableHead>
                            <TableHead className="font-semibold text-right">Total Impact</TableHead>
                            <TableHead className="font-semibold text-right">% of Total</TableHead>
                            <TableHead className="font-semibold text-center">Data Source</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {packaging.map((material, idx) => {
                            const climateValue = material.climate ?? 0;
                            const quantityValue = material.quantity ?? 0;
                            const percentageValue = material.percentage ?? 0;
                            const emissionFactor = quantityValue > 0 ? climateValue / quantityValue : 0;
                            return (
                              <TableRow key={idx} className={percentageValue > 5 ? 'bg-orange-50/50' : ''}>
                                <TableCell className="font-medium">
                                  {material.name}
                                  {material.warning && (
                                    <Badge variant="destructive" className="ml-2 text-xs">
                                      {material.warning}
                                    </Badge>
                                  )}
                                </TableCell>
                                <TableCell className="text-right">
                                  {quantityValue.toLocaleString('en-GB', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} {material.unit || ''}
                                </TableCell>
                                <TableCell className="text-right text-xs text-muted-foreground">
                                  {(emissionFactor / 1000).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} tCO₂eq/{material.unit || ''}
                                </TableCell>
                                <TableCell className="text-right font-semibold">
                                  {(climateValue / 1000).toLocaleString('en-GB', { minimumFractionDigits: 6, maximumFractionDigits: 6 })} t
                                </TableCell>
                                <TableCell className="text-right">
                                  <div className="flex items-center justify-end gap-2">
                                    <div className="w-16 h-2 bg-gray-200 rounded-full overflow-hidden">
                                      <div
                                        className="h-full bg-blue-500"
                                        style={{ width: `${Math.min(percentageValue, 100)}%` }}
                                      />
                                    </div>
                                    <span className="text-xs font-medium w-12 text-right">
                                      {percentageValue.toFixed(1)}%
                                    </span>
                                  </div>
                                </TableCell>
                                <TableCell className="text-center">
                                  {getDataSourceBadge(material.source)}
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground">
                <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p className="text-sm font-medium">No material breakdown data available</p>
                <p className="text-xs mt-2">
                  Material-level emissions will appear here after LCA calculation
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
