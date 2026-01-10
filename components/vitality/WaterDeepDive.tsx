'use client';

import React, { useState, useMemo, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Droplets,
  AlertTriangle,
  ChevronRight,
  ArrowLeft,
  TrendingDown,
  Search,
  Filter,
  Download,
  BarChart3,
  Map,
  Clock,
  Recycle,
  Factory,
  Waves,
  Sparkles,
  RefreshCw,
  Loader2,
} from 'lucide-react';
import { FacilityWaterRisk } from '@/hooks/data/useCompanyMetrics';
import type {
  FacilityWaterSummary,
  CompanyWaterOverview,
  WaterSourceBreakdown,
  WaterTimeSeries,
} from '@/hooks/data/useFacilityWaterData';
import { WaterConsumptionChart } from '@/components/water/WaterConsumptionChart';
import { WaterSourceBreakdownChart } from '@/components/water/WaterSourceBreakdownChart';
import { WaterIntensityComparisonChart } from '@/components/water/WaterIntensityComparisonChart';

const FacilityWaterRiskMap = dynamic(
  () => import('@/components/water/FacilityWaterRiskMap').then(mod => mod.FacilityWaterRiskMap),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[400px] rounded-lg" />,
  }
);

interface WaterDeepDiveProps {
  facilityWaterRisks: FacilityWaterRisk[];
  facilitySummaries?: FacilityWaterSummary[];
  companyOverview?: CompanyWaterOverview | null;
  sourceBreakdown?: WaterSourceBreakdown[];
  waterTimeSeries?: WaterTimeSeries[];
  loading?: boolean;
  productLcaWaterConsumption?: number;
  productLcaWaterScarcity?: number;
}

type RiskFilter = 'all' | 'high' | 'medium' | 'low';
type SortOption = 'consumption' | 'risk' | 'name' | 'intensity';

export function WaterDeepDive({
  facilityWaterRisks,
  facilitySummaries = [],
  companyOverview,
  sourceBreakdown = [],
  waterTimeSeries = [],
  loading = false,
  productLcaWaterConsumption = 0,
  productLcaWaterScarcity = 0,
}: WaterDeepDiveProps) {
  const [selectedFacility, setSelectedFacility] = useState<FacilityWaterSummary | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('consumption');
  const [activeTab, setActiveTab] = useState('overview');

  const facilities = useMemo((): FacilityWaterSummary[] => {
    if (facilitySummaries.length > 0) {
      return facilitySummaries;
    }
    return facilityWaterRisks.map(f => {
      const totalConsumption = f.total_water_consumption_m3 || 0;
      const scarcityWeighted = f.scarcity_weighted_consumption_m3 || (totalConsumption * f.water_scarcity_aware);
      const productionVol = f.production_volume || 0;

      return {
        facility_id: f.facility_id,
        organization_id: '',
        facility_name: f.facility_name,
        city: null,
        country: f.location_country_code,
        country_code: f.location_country_code,
        latitude: f.latitude,
        longitude: f.longitude,
        total_consumption_m3: totalConsumption,
        municipal_consumption_m3: totalConsumption,
        groundwater_consumption_m3: 0,
        surface_water_consumption_m3: 0,
        rainwater_consumption_m3: 0,
        recycled_consumption_m3: 0,
        total_discharge_m3: 0,
        net_consumption_m3: totalConsumption,
        aware_factor: f.water_scarcity_aware,
        scarcity_weighted_consumption_m3: scarcityWeighted,
        risk_level: f.risk_level,
        recycling_rate_percent: 0,
        avg_water_intensity_m3_per_unit: productionVol > 0 ? totalConsumption / productionVol : null,
        data_points_count: f.products_linked?.length || 0,
        measured_data_points: 0,
        earliest_data: null,
        latest_data: null,
        products_linked: f.products_linked || [],
      } as FacilityWaterSummary;
    });
  }, [facilitySummaries, facilityWaterRisks]);

  const filteredFacilities = useMemo((): FacilityWaterSummary[] => {
    let result = [...facilities];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(f =>
        f.facility_name.toLowerCase().includes(query) ||
        f.city?.toLowerCase().includes(query) ||
        f.country?.toLowerCase().includes(query)
      );
    }

    if (riskFilter !== 'all') {
      result = result.filter(f => f.risk_level === riskFilter);
    }

    switch (sortBy) {
      case 'consumption':
        result.sort((a, b) => b.total_consumption_m3 - a.total_consumption_m3);
        break;
      case 'risk':
        const riskOrder = { high: 0, medium: 1, low: 2 };
        result.sort((a, b) => riskOrder[a.risk_level] - riskOrder[b.risk_level]);
        break;
      case 'name':
        result.sort((a, b) => a.facility_name.localeCompare(b.facility_name));
        break;
      case 'intensity':
        result.sort((a, b) => (b.avg_water_intensity_m3_per_unit || 0) - (a.avg_water_intensity_m3_per_unit || 0));
        break;
    }

    return result;
  }, [facilities, searchQuery, riskFilter, sortBy]);

  const riskCounts = useMemo(() => ({
    high: facilities.filter(f => f.risk_level === 'high').length,
    medium: facilities.filter(f => f.risk_level === 'medium').length,
    low: facilities.filter(f => f.risk_level === 'low').length,
  }), [facilities]);

  if (selectedFacility) {
    return (
      <FacilityDetailView
        facility={selectedFacility}
        onBack={() => setSelectedFacility(null)}
      />
    );
  }

  const totalConsumption = companyOverview?.total_consumption_m3 || productLcaWaterConsumption || 0;
  const scarcityImpact = companyOverview?.scarcity_weighted_consumption_m3 || productLcaWaterScarcity || 0;
  const netConsumption = companyOverview?.net_consumption_m3 || totalConsumption;
  const recyclingRate = companyOverview?.avg_recycling_rate || 0;
  const hasOperationalData = (companyOverview?.total_consumption_m3 || 0) > 0;
  const hasProductLcaData = productLcaWaterConsumption > 0 || productLcaWaterScarcity > 0;

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          title="Total Consumption"
          value={totalConsumption}
          unit="m³"
          icon={Droplets}
          color="blue"
          subtitle={hasOperationalData ? 'Facility data' : hasProductLcaData ? 'From Product LCAs' : undefined}
        />
        <MetricCard
          title="Scarcity Impact"
          value={scarcityImpact}
          unit="m³ eq"
          icon={Waves}
          color="amber"
          subtitle={hasOperationalData ? 'AWARE weighted' : hasProductLcaData ? 'From Product LCAs' : undefined}
        />
        <MetricCard
          title="Net Consumption"
          value={netConsumption}
          unit="m³"
          icon={TrendingDown}
          color="cyan"
          subtitle={hasOperationalData ? 'After discharge' : hasProductLcaData ? 'Estimated' : undefined}
        />
        <MetricCard
          title="Recycling Rate"
          value={recyclingRate}
          unit="%"
          icon={Recycle}
          color="green"
          subtitle={!hasOperationalData ? 'No facility data' : undefined}
        />
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview" className="gap-2">
            <Map className="h-4 w-4" />
            <span className="hidden sm:inline">Risk Overview</span>
          </TabsTrigger>
          <TabsTrigger value="consumption" className="gap-2">
            <BarChart3 className="h-4 w-4" />
            <span className="hidden sm:inline">Consumption</span>
          </TabsTrigger>
          <TabsTrigger value="sources" className="gap-2">
            <Droplets className="h-4 w-4" />
            <span className="hidden sm:inline">Sources</span>
          </TabsTrigger>
          <TabsTrigger value="trends" className="gap-2">
            <Clock className="h-4 w-4" />
            <span className="hidden sm:inline">Trends</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          <FacilityWaterRiskMap
            facilities={filteredFacilities}
            loading={loading}
            onFacilityClick={setSelectedFacility}
          />

          <Card>
            <CardHeader className="pb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-base">Facility Risk Details</CardTitle>
                  <CardDescription>
                    {filteredFacilities.length} facilities
                    {riskFilter !== 'all' && ` (${riskFilter} risk)`}
                  </CardDescription>
                </div>
                <div className="flex flex-wrap gap-2">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
                    <Input
                      placeholder="Search facilities..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="pl-8 w-[180px] h-9"
                    />
                  </div>
                  <Select value={riskFilter} onValueChange={(v) => setRiskFilter(v as RiskFilter)}>
                    <SelectTrigger className="w-[120px] h-9">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Risks</SelectItem>
                      <SelectItem value="high">High Risk</SelectItem>
                      <SelectItem value="medium">Medium Risk</SelectItem>
                      <SelectItem value="low">Low Risk</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortOption)}>
                    <SelectTrigger className="w-[140px] h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="consumption">By Consumption</SelectItem>
                      <SelectItem value="risk">By Risk Level</SelectItem>
                      <SelectItem value="name">By Name</SelectItem>
                      <SelectItem value="intensity">By Intensity</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {loading ? (
                  Array.from({ length: 3 }).map((_, i) => (
                    <Skeleton key={i} className="h-20 w-full" />
                  ))
                ) : filteredFacilities.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Factory className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No facilities match your filters</p>
                  </div>
                ) : (
                  filteredFacilities.map((facility) => (
                    <FacilityRow
                      key={facility.facility_id}
                      facility={facility}
                      onClick={() => setSelectedFacility(facility)}
                    />
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="consumption" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <WaterConsumptionChart
              data={waterTimeSeries}
              loading={loading}
              title="Monthly Water Consumption"
              showDischarge={true}
              showScarcityWeighted={true}
            />
            <WaterIntensityComparisonChart
              facilities={filteredFacilities}
              loading={loading}
              title="Water Intensity by Facility"
              maxFacilities={8}
              onFacilityClick={setSelectedFacility}
            />
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Consumption Summary</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-lg bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Intake</p>
                  <p className="text-2xl font-bold text-blue-900 dark:text-blue-100">
                    {(companyOverview?.total_consumption_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">cubic metres</p>
                </div>
                <div className="p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Discharge</p>
                  <p className="text-2xl font-bold text-green-900 dark:text-green-100">
                    {(companyOverview?.total_discharge_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">cubic metres</p>
                </div>
                <div className="p-4 rounded-lg bg-cyan-50 dark:bg-cyan-900/20 border border-cyan-200 dark:border-cyan-800">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Consumption</p>
                  <p className="text-2xl font-bold text-cyan-900 dark:text-cyan-100">
                    {(companyOverview?.net_consumption_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">cubic metres</p>
                </div>
                <div className="p-4 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Scarcity Weighted</p>
                  <p className="text-2xl font-bold text-amber-900 dark:text-amber-100">
                    {(companyOverview?.scarcity_weighted_consumption_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">m³ world equivalent</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="sources" className="space-y-6">
          <div className="grid lg:grid-cols-2 gap-6">
            <WaterSourceBreakdownChart
              data={sourceBreakdown}
              loading={loading}
              title="Water Sources Breakdown"
              height={320}
            />
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Source Distribution</CardTitle>
                <CardDescription>Percentage of water from each source type</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {sourceBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Droplets className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No source data available</p>
                  </div>
                ) : (
                  sourceBreakdown.map((source, index) => (
                    <div key={index} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <div
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: source.color }}
                          />
                          <span>{source.source}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{source.percentage.toFixed(1)}%</span>
                          <span className="text-muted-foreground text-xs">
                            ({source.value.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³)
                          </span>
                        </div>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="h-full rounded-full transition-all"
                          style={{
                            width: `${source.percentage}%`,
                            backgroundColor: source.color,
                          }}
                        />
                      </div>
                    </div>
                  ))
                )}

                {companyOverview && companyOverview.recycled_consumption_m3 > 0 && (
                  <div className="mt-6 p-4 rounded-lg bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800">
                    <div className="flex items-center gap-2 mb-2">
                      <Recycle className="h-4 w-4 text-green-600" />
                      <span className="font-medium text-green-900 dark:text-green-100">Water Recycling</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {companyOverview.recycled_percent.toFixed(1)}% of water consumed comes from recycled/reused sources,
                      totalling {companyOverview.recycled_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <WaterConsumptionChart
            data={waterTimeSeries}
            loading={loading}
            title="Water Consumption Over Time"
            height={350}
            showDischarge={true}
            showScarcityWeighted={true}
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Period Analysis</CardTitle>
              </CardHeader>
              <CardContent>
                {waterTimeSeries.length < 2 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>Not enough data for trend analysis</p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <TrendMetric
                      label="Consumption Trend"
                      data={waterTimeSeries}
                      metric="consumption"
                    />
                    <TrendMetric
                      label="Net Consumption Trend"
                      data={waterTimeSeries}
                      metric="netConsumption"
                    />
                    <TrendMetric
                      label="Scarcity Impact Trend"
                      data={waterTimeSeries}
                      metric="scarcityWeighted"
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
              <CardHeader>
                <CardTitle className="text-base text-blue-900 dark:text-blue-100">About AWARE Methodology</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 text-sm">
                <p className="text-muted-foreground">
                  The AWARE (Available WAter REmaining) method quantifies relative water availability
                  per area in a watershed, after human and aquatic ecosystem demands have been met.
                </p>
                <p className="text-muted-foreground">
                  Higher factors indicate greater water scarcity. Net impact multiplies consumption
                  by the location-specific AWARE factor to provide m³ world equivalent.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <Badge variant="outline" className="text-xs">ISO 14046</Badge>
                  <Badge variant="outline" className="text-xs">CSRD E3</Badge>
                  <Badge variant="outline" className="text-xs">AWARE v1.3</Badge>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}

function MetricCard({
  title,
  value,
  unit,
  icon: Icon,
  color,
  subtitle,
}: {
  title: string;
  value: number;
  unit: string;
  icon: any;
  color: 'blue' | 'amber' | 'cyan' | 'green';
  subtitle?: string;
}) {
  const colorClasses = {
    blue: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800 text-blue-600',
    amber: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800 text-amber-600',
    cyan: 'bg-cyan-50 dark:bg-cyan-900/20 border-cyan-200 dark:border-cyan-800 text-cyan-600',
    green: 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800 text-green-600',
  };

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toFixed(1);
  };

  return (
    <Card className={`${colorClasses[color]} border`}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium uppercase tracking-wide opacity-80">{title}</span>
          <Icon className="h-4 w-4" />
        </div>
        <div className="flex items-baseline gap-1">
          <span className="text-2xl font-bold">{formatValue(value)}</span>
          <span className="text-xs opacity-70">{unit}</span>
        </div>
        {subtitle && (
          <div className="mt-1">
            <span className="text-[10px] opacity-60">{subtitle}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function FacilityRow({
  facility,
  onClick,
}: {
  facility: FacilityWaterSummary;
  onClick: () => void;
}) {
  const riskConfig = {
    high: {
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-700 dark:text-red-300',
      badgeClass: 'bg-red-600',
    },
    medium: {
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-700 dark:text-amber-300',
      badgeClass: 'bg-amber-600',
    },
    low: {
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-300',
      badgeClass: 'bg-green-600',
    },
  };

  const config = riskConfig[facility.risk_level];

  return (
    <Card
      className={`${config.bgColor} ${config.borderColor} border cursor-pointer hover:shadow-md transition-all`}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <div className="space-y-1.5 flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <MapPin className={`h-4 w-4 ${config.textColor} flex-shrink-0`} />
              <span className="font-semibold truncate">{facility.facility_name}</span>
            </div>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
              <span>{facility.city || facility.country || facility.country_code}</span>
              <span>AWARE: {facility.aware_factor.toFixed(2)}</span>
              {facility.total_consumption_m3 > 0 && (
                <span>{facility.total_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
              )}
              {facility.recycling_rate_percent > 0 && (
                <span className="text-green-600">{facility.recycling_rate_percent.toFixed(1)}% recycled</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <Badge variant="default" className={config.badgeClass}>
              {facility.risk_level.toUpperCase()}
            </Badge>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

interface AIRecommendations {
  recommendations: string[];
  analysis: string;
  priority_action: string;
}

function FacilityDetailView({
  facility,
  onBack,
}: {
  facility: FacilityWaterSummary;
  onBack: () => void;
}) {
  const [aiRecommendations, setAiRecommendations] = useState<AIRecommendations | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const riskConfig = {
    high: {
      bgColor: 'bg-red-50 dark:bg-red-900/20',
      borderColor: 'border-red-200 dark:border-red-800',
      textColor: 'text-red-700 dark:text-red-300',
      badgeClass: 'bg-red-600',
    },
    medium: {
      bgColor: 'bg-amber-50 dark:bg-amber-900/20',
      borderColor: 'border-amber-200 dark:border-amber-800',
      textColor: 'text-amber-700 dark:text-amber-300',
      badgeClass: 'bg-amber-600',
    },
    low: {
      bgColor: 'bg-green-50 dark:bg-green-900/20',
      borderColor: 'border-green-200 dark:border-green-800',
      textColor: 'text-green-700 dark:text-green-300',
      badgeClass: 'bg-green-600',
    },
  };

  const config = riskConfig[facility.risk_level];
  const hasWaterData = facility.total_consumption_m3 > 0;
  const hasProducts = (facility.products_linked?.length || 0) > 0;

  const fetchAIRecommendations = async () => {
    setLoadingAI(true);
    setAiError(null);

    try {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing');
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/generate-water-recommendations`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          facility_name: facility.facility_name,
          country: facility.country || facility.country_code,
          risk_level: facility.risk_level,
          aware_factor: facility.aware_factor,
          total_consumption_m3: facility.total_consumption_m3,
          scarcity_weighted_consumption_m3: facility.scarcity_weighted_consumption_m3,
          net_consumption_m3: facility.net_consumption_m3,
          recycling_rate_percent: facility.recycling_rate_percent,
          products_linked: facility.products_linked || [],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to fetch AI recommendations');
      }

      const data = await response.json();
      setAiRecommendations(data);
    } catch (error) {
      console.error('AI recommendations error:', error);
      setAiError(error instanceof Error ? error.message : 'Failed to load AI recommendations');
    } finally {
      setLoadingAI(false);
    }
  };

  useEffect(() => {
    fetchAIRecommendations();
  }, [facility.facility_id]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Overview
            </Button>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="space-y-1">
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5" />
                {facility.facility_name}
              </CardTitle>
              <CardDescription>
                {facility.city && `${facility.city}, `}{facility.country || facility.country_code}
              </CardDescription>
            </div>
            <Badge variant="default" className={config.badgeClass}>
              {facility.risk_level.toUpperCase()} RISK
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          {hasProducts && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Products:</span>
              {facility.products_linked?.map((product, idx) => (
                <Badge key={idx} variant="outline" className="text-xs">{product}</Badge>
              ))}
            </div>
          )}

          {!hasWaterData && (
            <Card className="bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100">No Water Data Available</p>
                    <p className="text-xs text-amber-700 dark:text-amber-300 mt-1">
                      This facility has no production sites linked to completed product LCAs.
                      To see water data, link this facility to a product's production sites.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className={`${config.bgColor} border-2 ${config.borderColor}`}>
            <CardContent className="p-6">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">AWARE Factor</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{facility.aware_factor.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">m³ eq/m³</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Total Consumption</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {hasWaterData ? facility.total_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '-'}
                    </span>
                    {hasWaterData && <span className="text-sm text-muted-foreground">m³</span>}
                  </div>
                  {hasWaterData && <span className="text-xs text-muted-foreground">From Product LCAs</span>}
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Scarcity Impact</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {hasWaterData ? facility.scarcity_weighted_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '-'}
                    </span>
                    {hasWaterData && <span className="text-sm text-muted-foreground">m³ eq</span>}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Water Balance</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Intake</span>
                  <span className="font-medium">{facility.total_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Total Discharge</span>
                  <span className="font-medium">{facility.total_discharge_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                </div>
                <div className="flex justify-between text-sm border-t pt-2">
                  <span className="text-muted-foreground">Net Consumption</span>
                  <span className="font-bold">{facility.net_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                </div>
                {facility.recycling_rate_percent > 0 && (
                  <div className="flex justify-between text-sm text-green-600">
                    <span>Recycling Rate</span>
                    <span className="font-medium">{facility.recycling_rate_percent.toFixed(1)}%</span>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="border-2 border-blue-200 dark:border-blue-800">
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-blue-600" />
                    AI-Powered Recommendations
                  </CardTitle>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={fetchAIRecommendations}
                    disabled={loadingAI}
                    className="h-7 px-2"
                  >
                    {loadingAI ? (
                      <Loader2 className="h-3 w-3 animate-spin" />
                    ) : (
                      <RefreshCw className="h-3 w-3" />
                    )}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {loadingAI ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : aiError ? (
                  <div className="text-sm text-red-600 dark:text-red-400">
                    <p>{aiError}</p>
                    <Button variant="link" size="sm" onClick={fetchAIRecommendations} className="p-0 h-auto mt-1">
                      Try again
                    </Button>
                  </div>
                ) : aiRecommendations ? (
                  <>
                    {aiRecommendations.priority_action && (
                      <div className="p-2 rounded-md bg-blue-100 dark:bg-blue-900/30 mb-3">
                        <p className="text-xs font-semibold text-blue-800 dark:text-blue-200 uppercase tracking-wide mb-1">Priority Action</p>
                        <p className="text-xs text-blue-900 dark:text-blue-100">{aiRecommendations.priority_action}</p>
                      </div>
                    )}
                    {aiRecommendations.recommendations.slice(0, 4).map((rec, idx) => (
                      <ActionItem key={idx}>{rec}</ActionItem>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading recommendations...</p>
                )}
              </CardContent>
            </Card>
          </div>

          {aiRecommendations?.analysis && (
            <Card className="bg-slate-50 dark:bg-slate-900/20 border-slate-200 dark:border-slate-800">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-1">AI Analysis</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiRecommendations.analysis}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Card className="bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800">
            <CardContent className="p-4 space-y-2">
              <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">About AWARE</p>
              <p className="text-xs text-muted-foreground">
                The AWARE method quantifies relative available water remaining per area in a watershed,
                after human and aquatic ecosystem demands have been met. A higher factor indicates greater water scarcity.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <Badge variant="outline" className="text-xs">Low: &lt;1</Badge>
                <Badge variant="outline" className="text-xs">Medium: 1-10</Badge>
                <Badge variant="outline" className="text-xs">High: &gt;10</Badge>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
    </div>
  );
}

function ActionItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <TrendingDown className="h-4 w-4 text-blue-600 mt-0.5 flex-shrink-0" />
      <p className="text-xs">{children}</p>
    </div>
  );
}

function TrendMetric({
  label,
  data,
  metric,
}: {
  label: string;
  data: WaterTimeSeries[];
  metric: 'consumption' | 'netConsumption' | 'scarcityWeighted';
}) {
  const trend = useMemo(() => {
    if (data.length < 4) return { direction: 'stable' as const, percentage: 0 };

    const recent = data.slice(-2);
    const previous = data.slice(-4, -2);

    const recentAvg = recent.reduce((sum, d) => sum + d[metric], 0) / recent.length;
    const previousAvg = previous.reduce((sum, d) => sum + d[metric], 0) / previous.length;

    if (previousAvg === 0) return { direction: 'stable' as const, percentage: 0 };

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    return {
      direction: change > 5 ? 'up' as const : change < -5 ? 'down' as const : 'stable' as const,
      percentage: Math.abs(change),
    };
  }, [data, metric]);

  const TrendIcon = trend.direction === 'up' ? TrendingDown : trend.direction === 'down' ? TrendingDown : Clock;
  const trendColor = trend.direction === 'down' ? 'text-green-600' : trend.direction === 'up' ? 'text-amber-600' : 'text-slate-500';

  return (
    <div className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
      <span className="text-sm font-medium">{label}</span>
      <div className={`flex items-center gap-1.5 ${trendColor}`}>
        <TrendIcon className="h-4 w-4" />
        <span className="text-sm font-medium">
          {trend.direction === 'stable' ? 'Stable' : `${trend.percentage.toFixed(1)}% ${trend.direction === 'down' ? 'decrease' : 'increase'}`}
        </span>
      </div>
    </div>
  );
}
