'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
  Cell,
} from 'recharts';
import { TrendingDown, TrendingUp, Award, AlertTriangle } from 'lucide-react';
import type { FacilityWaterSummary } from '@/hooks/data/useFacilityWaterData';

interface WaterIntensityComparisonChartProps {
  facilities: FacilityWaterSummary[];
  loading?: boolean;
  height?: number;
  title?: string;
  maxFacilities?: number;
  industryBenchmark?: number;
  onFacilityClick?: (facility: FacilityWaterSummary) => void;
  className?: string;
}

export function WaterIntensityComparisonChart({
  facilities,
  loading = false,
  height = 300,
  title = 'Water Intensity by Facility',
  maxFacilities = 10,
  industryBenchmark,
  onFacilityClick,
  className,
}: WaterIntensityComparisonChartProps) {
  const chartData = useMemo(() => {
    return facilities
      .filter(f => f.avg_water_intensity_m3_per_unit !== null && f.avg_water_intensity_m3_per_unit > 0)
      .sort((a, b) => (b.avg_water_intensity_m3_per_unit || 0) - (a.avg_water_intensity_m3_per_unit || 0))
      .slice(0, maxFacilities)
      .map((facility, index, arr) => {
        const intensity = facility.avg_water_intensity_m3_per_unit || 0;
        const maxIntensity = arr[0]?.avg_water_intensity_m3_per_unit || 1;
        const minIntensity = arr[arr.length - 1]?.avg_water_intensity_m3_per_unit || 0;

        let status: 'best' | 'worst' | 'average' = 'average';
        if (index === arr.length - 1) status = 'best';
        if (index === 0) status = 'worst';

        return {
          ...facility,
          name: facility.facility_name.length > 20
            ? facility.facility_name.substring(0, 18) + '...'
            : facility.facility_name,
          fullName: facility.facility_name,
          intensity,
          status,
          aboveBenchmark: industryBenchmark ? intensity > industryBenchmark : false,
        };
      });
  }, [facilities, maxFacilities, industryBenchmark]);

  const avgIntensity = useMemo(() => {
    if (chartData.length === 0) return 0;
    const sum = chartData.reduce((acc, f) => acc + f.intensity, 0);
    return sum / chartData.length;
  }, [chartData]);

  const bestPerformer = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData[chartData.length - 1];
  }, [chartData]);

  const worstPerformer = useMemo(() => {
    if (chartData.length === 0) return null;
    return chartData[0];
  }, [chartData]);

  if (loading) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Skeleton className="w-full" style={{ height }} />
        </CardContent>
      </Card>
    );
  }

  if (chartData.length === 0) {
    return (
      <Card className={className}>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            className="flex flex-col items-center justify-center text-muted-foreground text-sm gap-2"
            style={{ height }}
          >
            <AlertTriangle className="h-8 w-8 opacity-50" />
            <span>No intensity data available</span>
            <span className="text-xs">Add production volume data to calculate intensities</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const getBarColor = (entry: typeof chartData[0]) => {
    if (entry.status === 'best') return '#22c55e';
    if (entry.status === 'worst') return '#ef4444';
    if (entry.aboveBenchmark) return '#f59e0b';
    return '#3b82f6';
  };

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <div className="font-medium text-sm mb-2">{data.fullName}</div>
        <div className="space-y-1 text-xs">
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Water Intensity:</span>
            <span className="font-medium">
              {data.intensity.toFixed(4)} m³/unit
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Total Consumption:</span>
            <span className="font-medium">
              {data.total_consumption_m3.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³
            </span>
          </div>
          <div className="flex justify-between gap-4">
            <span className="text-muted-foreground">Risk Level:</span>
            <Badge
              variant="outline"
              className={`text-xs ${
                data.risk_level === 'high' ? 'bg-red-100 text-red-700' :
                data.risk_level === 'medium' ? 'bg-amber-100 text-amber-700' :
                'bg-green-100 text-green-700'
              }`}
            >
              {data.risk_level.charAt(0).toUpperCase() + data.risk_level.slice(1)}
            </Badge>
          </div>
          {industryBenchmark && (
            <div className="flex justify-between gap-4 pt-1 border-t">
              <span className="text-muted-foreground">vs Benchmark:</span>
              <span className={data.aboveBenchmark ? 'text-amber-600' : 'text-green-600'}>
                {data.aboveBenchmark ? '+' : ''}{((data.intensity - industryBenchmark) / industryBenchmark * 100).toFixed(1)}%
              </span>
            </div>
          )}
        </div>
      </div>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Avg:</span>
            <span className="font-medium">{avgIntensity.toFixed(4)} m³/unit</span>
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <BarChart
            data={chartData}
            layout="vertical"
            margin={{ top: 5, right: 30, left: 0, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" horizontal={true} vertical={false} className="stroke-muted" />
            <XAxis
              type="number"
              className="text-xs"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) => value.toFixed(3)}
            />
            <YAxis
              type="category"
              dataKey="name"
              className="text-xs"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              width={100}
            />
            <Tooltip content={<CustomTooltip />} />

            {industryBenchmark && (
              <ReferenceLine
                x={industryBenchmark}
                stroke="#94a3b8"
                strokeDasharray="5 5"
                label={{ value: 'Benchmark', position: 'top', fontSize: 10, fill: '#94a3b8' }}
              />
            )}

            <ReferenceLine
              x={avgIntensity}
              stroke="#3b82f6"
              strokeDasharray="3 3"
              strokeOpacity={0.5}
            />

            <Bar
              dataKey="intensity"
              radius={[0, 4, 4, 0]}
              cursor={onFacilityClick ? 'pointer' : 'default'}
              onClick={(data) => {
                const facility = facilities.find(f => f.facility_id === data.facility_id);
                if (facility && onFacilityClick) {
                  onFacilityClick(facility);
                }
              }}
            >
              {chartData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>

        <div className="flex items-center justify-between mt-3 text-xs">
          <div className="flex gap-4">
            {bestPerformer && (
              <div className="flex items-center gap-1.5">
                <Award className="h-3.5 w-3.5 text-green-600" />
                <span className="text-muted-foreground">Best:</span>
                <span className="font-medium text-green-600">
                  {bestPerformer.fullName.substring(0, 15)}
                  {bestPerformer.fullName.length > 15 ? '...' : ''}
                </span>
              </div>
            )}
            {worstPerformer && worstPerformer !== bestPerformer && (
              <div className="flex items-center gap-1.5">
                <TrendingUp className="h-3.5 w-3.5 text-red-600" />
                <span className="text-muted-foreground">Highest:</span>
                <span className="font-medium text-red-600">
                  {worstPerformer.fullName.substring(0, 15)}
                  {worstPerformer.fullName.length > 15 ? '...' : ''}
                </span>
              </div>
            )}
          </div>
          <span className="text-muted-foreground">m³ per production unit</span>
        </div>
      </CardContent>
    </Card>
  );
}
