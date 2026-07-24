'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { CHART } from '@/components/studio/theme';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { SectionTabs } from '@/components/studio/section-tabs';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { aggregateWaterUseRatio, formatWaterRatio } from '@/lib/calculations/water-use-ratio';
import { RelatableMetric } from '@/components/shared/RelatableMetric';

const FacilityWaterRiskMap = dynamic(
  () => import('@/components/water/FacilityWaterRiskMap').then(mod => mod.FacilityWaterRiskMap),
  {
    ssr: false,
    loading: () => <Skeleton className="w-full h-[400px] rounded-[6px]" />,
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
  const [tab, setTab] = useState('overview');
  const [searchQuery, setSearchQuery] = useState('');
  const [riskFilter, setRiskFilter] = useState<RiskFilter>('all');
  const [sortBy, setSortBy] = useState<SortOption>('consumption');
  const [activeTab, setActiveTab] = useState('overview');

  // Derive a basic source breakdown from facility water risks if detailed source data isn't available
  const derivedSourceBreakdown = useMemo((): WaterSourceBreakdown[] => {
    // If we have detailed source breakdown from facility water data, use that
    if (sourceBreakdown.length > 0) {
      return sourceBreakdown;
    }

    // Otherwise, derive a basic breakdown from operational vs embedded water
    const totalOperational = facilityWaterRisks.reduce((sum, f) => sum + (f.operational_water_intake_m3 || 0), 0);
    const totalEmbedded = facilityWaterRisks.reduce((sum, f) => sum + (f.product_lca_water_m3 || 0), 0);

    // Also include product LCA water that might not be facility-linked
    const embeddedWithProductLca = totalEmbedded > 0 ? totalEmbedded : productLcaWaterConsumption;

    const total = totalOperational + embeddedWithProductLca;
    if (total === 0) return [];

    const breakdown: WaterSourceBreakdown[] = [];

    if (totalOperational > 0) {
      breakdown.push({
        source: 'Operational (Direct)',
        value: totalOperational,
        percentage: (totalOperational / total) * 100,
        color: CHART.series[0],
      });
    }

    if (embeddedWithProductLca > 0) {
      breakdown.push({
        source: 'Embedded (Supply Chain)',
        value: embeddedWithProductLca,
        percentage: (embeddedWithProductLca / total) * 100,
        color: CHART.series[2],
      });
    }

    return breakdown;
  }, [sourceBreakdown, facilityWaterRisks, productLcaWaterConsumption]);

  const facilities = useMemo((): FacilityWaterSummary[] => {
    if (facilitySummaries.length > 0) {
      return facilitySummaries;
    }
    return facilityWaterRisks.map(f => {
      const operationalIntake = f.operational_water_intake_m3 || 0;
      const operationalDischarge = f.operational_water_discharge_m3 || 0;
      const operationalNet = f.operational_net_consumption_m3 || 0;
      const productLcaWater = f.product_lca_water_m3 || 0;
      const hasOperational = f.has_operational_data || false;

      const totalConsumption = hasOperational ? operationalIntake : productLcaWater;
      const netConsumption = hasOperational ? operationalNet : productLcaWater;
      const scarcityWeighted = f.scarcity_weighted_consumption_m3 || (netConsumption * f.water_scarcity_aware);
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
        municipal_consumption_m3: operationalIntake,
        groundwater_consumption_m3: 0,
        surface_water_consumption_m3: 0,
        rainwater_consumption_m3: 0,
        recycled_consumption_m3: 0,
        total_discharge_m3: operationalDischarge,
        net_consumption_m3: netConsumption,
        aware_factor: f.water_scarcity_aware,
        scarcity_weighted_consumption_m3: scarcityWeighted,
        risk_level: f.risk_level,
        recycling_rate_percent: 0,
        avg_water_intensity_m3_per_unit: productionVol > 0 ? netConsumption / productionVol : null,
        production_volume_total: productionVol > 0 ? productionVol : null,
        production_unit: (f as any).production_unit ?? null,
        data_points_count: f.products_linked?.length || 0,
        measured_data_points: hasOperational ? 1 : 0,
        earliest_data: null,
        latest_data: null,
        products_linked: f.products_linked || [],
        operational_water_intake_m3: operationalIntake,
        operational_water_discharge_m3: operationalDischarge,
        operational_net_consumption_m3: operationalNet,
        product_lca_water_m3: productLcaWater,
        has_operational_data: hasOperational,
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

  // Litres of water per litre of product, across facilities reporting output
  // in a volume unit (the recognised drinks-industry water-use ratio).
  const waterUseRatio = useMemo(
    () =>
      aggregateWaterUseRatio(
        facilities.map((f) => ({
          netWaterM3: f.net_consumption_m3,
          productionVolume: f.production_volume_total ?? null,
          productionUnit: f.production_unit ?? null,
        })),
      ),
    [facilities],
  );

  const riskCounts = useMemo(() => ({
    high: facilities.filter(f => f.risk_level === 'high').length,
    medium: facilities.filter(f => f.risk_level === 'medium').length,
    low: facilities.filter(f => f.risk_level === 'low').length,
  }), [facilities]);

  const totalOperationalWater = useMemo(() => {
    return facilityWaterRisks.reduce((sum, f) => sum + (f.operational_water_intake_m3 || 0), 0);
  }, [facilityWaterRisks]);

  const totalOperationalNet = useMemo(() => {
    return facilityWaterRisks.reduce((sum, f) => sum + (f.operational_net_consumption_m3 || 0), 0);
  }, [facilityWaterRisks]);

  const totalOperationalDischarge = useMemo(() => {
    return facilityWaterRisks.reduce((sum, f) => sum + (f.operational_water_discharge_m3 || 0), 0);
  }, [facilityWaterRisks]);

  const totalScarcityWeighted = useMemo(() => {
    return facilityWaterRisks.reduce((sum, f) => sum + (f.scarcity_weighted_consumption_m3 || 0), 0);
  }, [facilityWaterRisks]);

  const hasOperationalWaterData = totalOperationalWater > 0;
  const hasProductLcaData = productLcaWaterConsumption > 0 || productLcaWaterScarcity > 0;

  const displayTotalConsumption = hasOperationalWaterData
    ? totalOperationalWater
    : (companyOverview?.total_consumption_m3 || productLcaWaterConsumption || 0);

  const displayScarcityImpact = hasOperationalWaterData
    ? totalScarcityWeighted
    : (companyOverview?.scarcity_weighted_consumption_m3 || productLcaWaterScarcity || 0);

  const displayNetConsumption = hasOperationalWaterData
    ? totalOperationalNet
    : (companyOverview?.net_consumption_m3 || productLcaWaterConsumption || 0);

  const recyclingRate = companyOverview?.avg_recycling_rate || 0;

  if (selectedFacility) {
    return (
      <FacilityDetailView
        facility={selectedFacility}
        onBack={() => setSelectedFacility(null)}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid md:grid-cols-4 gap-4">
        <MetricCard
          title="Facility Water Intake"
          value={displayTotalConsumption}
          unit="m³"
          icon={Droplets}
          color="blue"
          subtitle={hasOperationalWaterData ? 'Direct facility data' : hasProductLcaData ? 'From Product Environmental Impacts' : undefined}
        />
        <MetricCard
          title="Scarcity Impact"
          value={displayScarcityImpact}
          unit="m³ eq"
          icon={Waves}
          color="amber"
          subtitle={hasOperationalWaterData ? 'AWARE weighted' : hasProductLcaData ? 'From Product Environmental Impacts' : undefined}
        />
        <MetricCard
          title="Net Consumption"
          value={displayNetConsumption}
          unit="m³"
          icon={TrendingDown}
          color="cyan"
          subtitle={hasOperationalWaterData ? 'After discharge' : hasProductLcaData ? 'Estimated' : undefined}
        />
        <MetricCard
          title="Recycling Rate"
          value={recyclingRate}
          unit="%"
          icon={Recycle}
          color="green"
          subtitle={!hasOperationalWaterData ? 'No facility data' : undefined}
        />
      </div>

      {waterUseRatio.ratio !== null && (
        <section className="border-t border-studio-hairline pt-5">
          <div className="space-y-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Water use ratio
              </p>
              <p className="mt-1 text-3xl font-semibold text-foreground">
                {formatWaterRatio(waterUseRatio.ratio)}
              </p>
              <p className="mt-1 text-xs text-muted-foreground">
                How much water it takes to make a litre of your product, across{' '}
                {waterUseRatio.facilityCount} site{waterUseRatio.facilityCount === 1 ? '' : 's'} reporting
                production in litres.
              </p>
            </div>
            <Droplets className="h-8 w-8 shrink-0 text-muted-foreground/70" aria-hidden="true" />
          </div>
        </section>
      )}

      {displayTotalConsumption > 0 && (
        <RelatableMetric
          kind="water"
          valueM3={displayTotalConsumption}
          variant="light"
        />
      )}

      
        <SectionTabs value={tab} onChange={setTab} tabs={[{ value: 'overview', label: 'Risk Overview' }, { value: 'consumption', label: 'Consumption' }, { value: 'sources', label: 'Sources' }, { value: 'trends', label: 'Trends' }]} />

        {tab === 'overview' && (
<div className="mt-4 space-y-4">
          <FacilityWaterRiskMap
            facilities={filteredFacilities}
            loading={loading}
            onFacilityClick={setSelectedFacility}
          />

          <section className="border-t border-studio-hairline pt-5">
            <div className="mb-3">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                  <Eyebrow>Facility Risk Details</Eyebrow>
                  <p className="mt-1 text-sm text-muted-foreground">
                    {filteredFacilities.length} facilities
                    {riskFilter !== 'all' && ` (${riskFilter} risk)`}
                  </p>
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
            </div>
            <div className="space-y-3">
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
            </div>
          </section>
        </div>
)}

        {tab === 'consumption' && (
<div className="mt-4 space-y-4">
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

          <section className="border-t border-studio-hairline pt-5">
            <div className="mb-3">
              <Eyebrow>Consumption Summary</Eyebrow>
            </div>
            <div className="space-y-3">
              <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="p-4 rounded-[6px]/20 border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Intake</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(companyOverview?.total_consumption_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">cubic metres</p>
                </div>
                <div className="p-4 rounded-[6px]/20 border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Total Discharge</p>
                  <p className="text-2xl font-bold text-studio-good">
                    {(companyOverview?.total_discharge_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">cubic metres</p>
                </div>
                <div className="p-4 rounded-[6px]/20 border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Net Consumption</p>
                  <p className="text-2xl font-bold text-foreground">
                    {(companyOverview?.net_consumption_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">cubic metres</p>
                </div>
                <div className="p-4 rounded-[6px]/20 border">
                  <p className="text-xs text-muted-foreground uppercase tracking-wide">Scarcity Weighted</p>
                  <p className="text-2xl font-bold text-studio-attention">
                    {(companyOverview?.scarcity_weighted_consumption_m3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })}
                  </p>
                  <p className="text-xs text-muted-foreground">m³ world equivalent</p>
                </div>
              </div>
            </div>
          </section>
        </div>
)}

        {tab === 'sources' && (
<div className="mt-4 space-y-4">
          <div className="grid lg:grid-cols-2 gap-6">
            <WaterSourceBreakdownChart
              data={derivedSourceBreakdown}
              loading={loading}
              title="Water Sources Breakdown"
              height={320}
            />
            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <Eyebrow>Source Distribution</Eyebrow>
                <p className="mt-1 text-sm text-muted-foreground">Percentage of water from each source type</p>
              </div>
              <div className="space-y-3">
                {derivedSourceBreakdown.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Droplets className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p>No source data available</p>
                  </div>
                ) : (
                  derivedSourceBreakdown.map((source, index) => (
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
                  <div className="mt-6 p-4 rounded-[6px]/20 border">
                    <div className="flex items-center gap-2 mb-2">
                      <Recycle className="h-4 w-4 text-studio-good" />
                      <span className="font-medium text-studio-good">Water Recycling</span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {companyOverview.recycled_percent.toFixed(1)}% of water consumed comes from recycled/reused sources,
                      totalling {companyOverview.recycled_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³.
                    </p>
                  </div>
                )}
              </div>
            </section>
          </div>
        </div>
)}

        {tab === 'trends' && (
<div className="mt-4 space-y-4">
          <WaterConsumptionChart
            data={waterTimeSeries}
            loading={loading}
            title="Water Consumption Over Time"
            height={350}
            showDischarge={true}
            showScarcityWeighted={true}
          />

          <div className="grid lg:grid-cols-2 gap-6">
            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <Eyebrow>Period Analysis</Eyebrow>
              </div>
              <div className="space-y-3">
                {waterTimeSeries.length < 2 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Clock className="h-10 w-10 mx-auto mb-2 opacity-50" />
                    <p className="font-medium">Not enough data for trend analysis</p>
                    <p className="text-xs mt-1 max-w-xs mx-auto">
                      Log water data across multiple reporting periods to see consumption trends and patterns
                    </p>
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
              </div>
            </section>

            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <Eyebrow>About AWARE Methodology</Eyebrow>
              </div>
              <div className="space-y-3">
                <p className="text-muted-foreground">
                  The AWARE (Available WAter REmaining) method quantifies relative water availability
                  per area in a watershed, after human and aquatic ecosystem demands have been met.
                </p>
                <p className="text-muted-foreground">
                  Higher factors indicate greater water scarcity. Net impact multiplies consumption
                  by the location-specific AWARE factor to provide m³ world equivalent.
                </p>
                <div className="flex flex-wrap gap-2 pt-2">
                  <StateChip>ISO 14046</StateChip>
                  <StateChip>CSRD E3</StateChip>
                  <StateChip>AWARE v1.3</StateChip>
                </div>
              </div>
            </section>
          </div>
        </div>
)}
      
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
    blue: '/20 text-muted-foreground',
    amber: '/20 text-studio-attention',
    cyan: '/20 text-muted-foreground',
    green: '/20 text-studio-good',
  };

  const formatValue = (val: number) => {
    if (val >= 1000000) return `${(val / 1000000).toFixed(1)}M`;
    if (val >= 1000) return `${(val / 1000).toFixed(1)}k`;
    return val.toFixed(1);
  };

  return (
    <section className="border-t border-studio-hairline pt-5">
      <div className="space-y-3">
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
      </div>
    </section>
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
      bgColor: '/20',
      borderColor: '',
      textColor: 'text-studio-stale',
      badgeClass: 'bg-studio-stale',
    },
    medium: {
      bgColor: '/20',
      borderColor: '',
      textColor: 'text-studio-attention',
      badgeClass: 'bg-studio-attention',
    },
    low: {
      bgColor: '/20',
      borderColor: '',
      textColor: 'text-studio-good',
      badgeClass: 'bg-studio-good',
    },
  };

  const config = riskConfig[facility.risk_level];

  return (
    <section className="border-t border-studio-hairline pt-5">
      <div className="space-y-3">
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
                <span className="text-studio-good">{facility.recycling_rate_percent.toFixed(1)}% recycled</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-shrink-0">
            <StateChip>
              {facility.risk_level.toUpperCase()}
            </StateChip>
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          </div>
        </div>
      </div>
    </section>
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
      bgColor: '/20',
      borderColor: '',
      textColor: 'text-studio-stale',
      badgeClass: 'bg-studio-stale',
    },
    medium: {
      bgColor: '/20',
      borderColor: '',
      textColor: 'text-studio-attention',
      badgeClass: 'bg-studio-attention',
    },
    low: {
      bgColor: '/20',
      borderColor: '',
      textColor: 'text-studio-good',
      badgeClass: 'bg-studio-good',
    },
  };

  const config = riskConfig[facility.risk_level];

  const operationalIntake = facility.operational_water_intake_m3 || 0;
  const operationalDischarge = facility.operational_water_discharge_m3 || 0;
  const operationalNet = facility.operational_net_consumption_m3 || 0;
  const productLcaWater = facility.product_lca_water_m3 || 0;
  const hasOperationalData = facility.has_operational_data || operationalIntake > 0;
  const hasProductLcaData = productLcaWater > 0;
  const hasAnyWaterData = hasOperationalData || hasProductLcaData;
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
          total_consumption_m3: operationalIntake || productLcaWater,
          scarcity_weighted_consumption_m3: facility.scarcity_weighted_consumption_m3,
          net_consumption_m3: operationalNet || productLcaWater,
          recycling_rate_percent: facility.recycling_rate_percent,
          products_linked: facility.products_linked || [],
          operational_water_intake_m3: operationalIntake,
          operational_water_discharge_m3: operationalDischarge,
          product_lca_water_m3: productLcaWater,
          has_operational_data: hasOperationalData,
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
      <section className="border-t border-studio-hairline pt-5">
        <div className="mb-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={onBack} className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Overview
            </Button>
          </div>
          <div className="flex items-center justify-between mt-4">
            <div className="space-y-1">
              <Eyebrow>
                <MapPin className="h-5 w-5" />
                {facility.facility_name}
              </Eyebrow>
              <p className="mt-1 text-sm text-muted-foreground">
                {facility.city && `${facility.city}, `}{facility.country || facility.country_code}
              </p>
            </div>
            <StateChip>
              {facility.risk_level.toUpperCase()} RISK
            </StateChip>
          </div>
        </div>
        <div className="space-y-3">
          {hasProducts && (
            <div className="flex flex-wrap gap-2 mb-4">
              <span className="text-sm text-muted-foreground">Products:</span>
              {facility.products_linked?.map((product, idx) => (
                <StateChip>{product}</StateChip>
              ))}
            </div>
          )}

          {!hasAnyWaterData && (
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <AlertTriangle className="h-5 w-5 text-studio-attention mt-0.5" />
                  <div>
                    <p className="text-sm font-semibold text-studio-attention">No Water Data Available</p>
                    <p className="text-xs text-studio-attention mt-1">
                      This facility has no water activity data logged and no production sites linked to completed product LCAs.
                    </p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="border-t border-studio-hairline pt-5">
            <div className="space-y-3">
              <div className="grid md:grid-cols-3 gap-6">
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">AWARE Factor</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">{facility.aware_factor.toFixed(2)}</span>
                    <span className="text-sm text-muted-foreground">m³ eq/m³</span>
                  </div>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Operational Net</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {hasOperationalData ? operationalNet.toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '-'}
                    </span>
                    {hasOperationalData && <span className="text-sm text-muted-foreground">m³</span>}
                  </div>
                  <span className="text-xs text-muted-foreground">{hasOperationalData ? 'Direct facility data' : 'No data logged'}</span>
                </div>
                <div className="space-y-2">
                  <h3 className="text-sm font-semibold">Scarcity Impact</h3>
                  <div className="flex items-baseline gap-2">
                    <span className="text-4xl font-bold">
                      {hasOperationalData ? (operationalNet * facility.aware_factor).toLocaleString('en-GB', { maximumFractionDigits: 0 }) : '-'}
                    </span>
                    {hasOperationalData && <span className="text-sm text-muted-foreground">m³ eq</span>}
                  </div>
                </div>
              </div>
            </div>
          </section>

          <div className="grid md:grid-cols-2 gap-4">
            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <Eyebrow>
                  <Factory className="h-4 w-4" />
                  Facility Operational Water
                </Eyebrow>
                <p className="mt-1 text-sm text-muted-foreground">Direct water use at this facility</p>
              </div>
              <div className="space-y-3">
                {hasOperationalData ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Water Intake</span>
                      <span className="font-medium">{operationalIntake.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Wastewater Discharge</span>
                      <span className="font-medium">{operationalDischarge.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                    </div>
                    <div className="flex justify-between text-sm border-t pt-2">
                      <span className="text-muted-foreground">Net Consumption</span>
                      <span className="font-bold text-muted-foreground">{operationalNet.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                    </div>
                    <div className="flex justify-between text-sm text-studio-attention">
                      <span>Scarcity-Weighted</span>
                      <span className="font-medium">{(operationalNet * facility.aware_factor).toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³ eq</span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Droplets className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No operational water data logged for this facility</p>
                  </div>
                )}
              </div>
            </section>

            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <Eyebrow>
                  <Waves className="h-4 w-4" />
                  Product Environmental Impact Embedded Water
                </Eyebrow>
                <p className="mt-1 text-sm text-muted-foreground">Supply chain water from linked products</p>
              </div>
              <div className="space-y-3">
                {hasProductLcaData ? (
                  <>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Embedded Water</span>
                      <span className="font-medium">{productLcaWater.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³</span>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Water footprint from upstream supply chain and processing for products manufactured at this facility.
                    </div>
                    {hasProducts && (
                      <div className="pt-2 border-t">
                        <span className="text-xs text-muted-foreground">Products:</span>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {facility.products_linked?.slice(0, 3).map((p, i) => (
                            <StateChip>{p}</StateChip>
                          ))}
                          {(facility.products_linked?.length || 0) > 3 && (
                            <StateChip>+{(facility.products_linked?.length || 0) - 3} more</StateChip>
                          )}
                        </div>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-muted-foreground">
                    <Waves className="h-8 w-8 mx-auto mb-2 opacity-40" />
                    <p className="text-xs">No products with LCAs linked to this facility</p>
                  </div>
                )}
              </div>
            </section>
          </div>

          <div className="grid md:grid-cols-2 gap-4">

            <section className="border-t border-studio-hairline pt-5">
              <div className="mb-3">
                <div className="flex items-center justify-between">
                  <Eyebrow>
                    <Sparkles className="h-4 w-4 text-muted-foreground" />
                    AI-Powered Recommendations
                  </Eyebrow>
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
              </div>
              <div className="space-y-3">
                {loadingAI ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : aiError ? (
                  <div className="text-sm text-studio-stale">
                    <p>{aiError}</p>
                    <Button variant="link" size="sm" onClick={fetchAIRecommendations} className="p-0 h-auto mt-1">
                      Try again
                    </Button>
                  </div>
                ) : aiRecommendations ? (
                  <>
                    {aiRecommendations.priority_action && (
                      <div className="p-2 rounded-md/30 mb-3">
                        <p className="text-xs font-semibold text-foreground uppercase tracking-wide mb-1">Priority Action</p>
                        <p className="text-xs text-foreground">{aiRecommendations.priority_action}</p>
                      </div>
                    )}
                    {aiRecommendations.recommendations.slice(0, 4).map((rec, idx) => (
                      <ActionItem key={idx}>{rec}</ActionItem>
                    ))}
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground">Loading recommendations...</p>
                )}
              </div>
            </section>
          </div>

          {aiRecommendations?.analysis && (
            <section className="border-t border-studio-hairline pt-5">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <Sparkles className="h-5 w-5 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-sm font-semibold text-foreground mb-1">AI Analysis</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{aiRecommendations.analysis}</p>
                  </div>
                </div>
              </div>
            </section>
          )}

          <section className="border-t border-studio-hairline pt-5">
            <div className="space-y-3">
              <p className="text-sm font-semibold text-foreground">About AWARE</p>
              <p className="text-xs text-muted-foreground">
                The AWARE method quantifies relative available water remaining per area in a watershed,
                after human and aquatic ecosystem demands have been met. A higher factor indicates greater water scarcity.
              </p>
              <div className="flex flex-wrap gap-2 mt-2">
                <StateChip>Low: &lt;1</StateChip>
                <StateChip>Medium: 1-10</StateChip>
                <StateChip>High: &gt;10</StateChip>
              </div>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ActionItem({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2">
      <TrendingDown className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
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
  const trendColor = trend.direction === 'down' ? 'text-studio-good' : trend.direction === 'up' ? 'text-studio-attention' : 'text-muted-foreground';

  return (
    <div className="flex items-center justify-between p-3 rounded-[6px] bg-muted/50">
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
