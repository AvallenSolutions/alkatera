'use client';

import { useMemo, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine,
} from 'recharts';
import { TrendingDown, TrendingUp, Minus } from 'lucide-react';
import type { WaterTimeSeries } from '@/hooks/data/useFacilityWaterData';

interface WaterConsumptionChartProps {
  data: WaterTimeSeries[];
  loading?: boolean;
  showDischarge?: boolean;
  showScarcityWeighted?: boolean;
  height?: number;
  title?: string;
  className?: string;
}

type ViewMode = 'consumption' | 'net' | 'scarcity';

const MONTH_NAMES = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function WaterConsumptionChart({
  data,
  loading = false,
  showDischarge = true,
  showScarcityWeighted = true,
  height = 300,
  title = 'Water Consumption Trend',
  className,
}: WaterConsumptionChartProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('consumption');

  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      label: `${MONTH_NAMES[item.month - 1]} ${item.year}`,
      shortLabel: MONTH_NAMES[item.month - 1],
    }));
  }, [data]);

  const trend = useMemo(() => {
    if (chartData.length < 2) return { direction: 'stable' as const, percentage: 0 };

    const recentMonths = chartData.slice(-3);
    const previousMonths = chartData.slice(-6, -3);

    if (previousMonths.length === 0 || recentMonths.length === 0) {
      return { direction: 'stable' as const, percentage: 0 };
    }

    const recentAvg = recentMonths.reduce((sum, d) => sum + d.consumption, 0) / recentMonths.length;
    const previousAvg = previousMonths.reduce((sum, d) => sum + d.consumption, 0) / previousMonths.length;

    if (previousAvg === 0) return { direction: 'stable' as const, percentage: 0 };

    const change = ((recentAvg - previousAvg) / previousAvg) * 100;

    return {
      direction: change > 5 ? 'up' as const : change < -5 ? 'down' as const : 'stable' as const,
      percentage: Math.abs(change),
    };
  }, [chartData]);

  const averageConsumption = useMemo(() => {
    if (chartData.length === 0) return 0;
    return chartData.reduce((sum, d) => sum + d.consumption, 0) / chartData.length;
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
            className="flex items-center justify-center text-muted-foreground text-sm"
            style={{ height }}
          >
            No water consumption data available
          </div>
        </CardContent>
      </Card>
    );
  }

  const TrendIcon = trend.direction === 'up' ? TrendingUp : trend.direction === 'down' ? TrendingDown : Minus;
  const trendColor = trend.direction === 'down' ? 'text-green-600' : trend.direction === 'up' ? 'text-amber-600' : 'text-slate-500';

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <CardTitle className="text-base">{title}</CardTitle>
            {trend.percentage > 0 && (
              <div className={`flex items-center gap-1 ${trendColor}`}>
                <TrendIcon className="h-4 w-4" />
                <span className="text-sm font-medium">
                  {trend.percentage.toFixed(1)}%
                </span>
              </div>
            )}
          </div>
          <div className="flex gap-1">
            <Button
              variant={viewMode === 'consumption' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setViewMode('consumption')}
            >
              Consumption
            </Button>
            <Button
              variant={viewMode === 'net' ? 'default' : 'ghost'}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setViewMode('net')}
            >
              Net
            </Button>
            {showScarcityWeighted && (
              <Button
                variant={viewMode === 'scarcity' ? 'default' : 'ghost'}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setViewMode('scarcity')}
              >
                Scarcity
              </Button>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent className="pt-2">
        <ResponsiveContainer width="100%" height={height}>
          <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id="consumptionGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="dischargeGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="scarcityGradient" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.3} />
                <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
            <XAxis
              dataKey="shortLabel"
              className="text-xs"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
            />
            <YAxis
              className="text-xs"
              tick={{ fontSize: 11 }}
              tickLine={false}
              axisLine={{ stroke: 'hsl(var(--border))' }}
              tickFormatter={(value) => value >= 1000 ? `${(value/1000).toFixed(0)}k` : value.toFixed(0)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--popover))',
                border: '1px solid hsl(var(--border))',
                borderRadius: 'var(--radius)',
                fontSize: '12px',
              }}
              formatter={(value: number, name: string) => {
                const label = name === 'consumption' ? 'Consumption' :
                              name === 'discharge' ? 'Discharge' :
                              name === 'netConsumption' ? 'Net Consumption' :
                              'Scarcity Weighted';
                return [`${value.toLocaleString('en-GB', { maximumFractionDigits: 2 })} m³`, label];
              }}
              labelFormatter={(label) => chartData.find(d => d.shortLabel === label)?.label || label}
            />

            {viewMode === 'consumption' && (
              <>
                <Area
                  type="monotone"
                  dataKey="consumption"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  fill="url(#consumptionGradient)"
                  name="consumption"
                />
                {showDischarge && (
                  <Area
                    type="monotone"
                    dataKey="discharge"
                    stroke="#10b981"
                    strokeWidth={2}
                    fill="url(#dischargeGradient)"
                    name="discharge"
                  />
                )}
                <ReferenceLine
                  y={averageConsumption}
                  stroke="#94a3b8"
                  strokeDasharray="5 5"
                  label={{ value: 'Avg', position: 'right', fontSize: 10, fill: '#94a3b8' }}
                />
              </>
            )}

            {viewMode === 'net' && (
              <Area
                type="monotone"
                dataKey="netConsumption"
                stroke="#06b6d4"
                strokeWidth={2}
                fill="url(#consumptionGradient)"
                name="netConsumption"
              />
            )}

            {viewMode === 'scarcity' && (
              <Area
                type="monotone"
                dataKey="scarcityWeighted"
                stroke="#f59e0b"
                strokeWidth={2}
                fill="url(#scarcityGradient)"
                name="scarcityWeighted"
              />
            )}
          </AreaChart>
        </ResponsiveContainer>

        <div className="flex gap-4 mt-3 text-xs text-muted-foreground justify-center">
          {viewMode === 'consumption' && (
            <>
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-blue-500 rounded" />
                <span>Consumption</span>
              </div>
              {showDischarge && (
                <div className="flex items-center gap-1.5">
                  <div className="w-3 h-0.5 bg-emerald-500 rounded" />
                  <span>Discharge</span>
                </div>
              )}
              <div className="flex items-center gap-1.5">
                <div className="w-3 h-0.5 bg-slate-400 rounded border-dashed" />
                <span>Average</span>
              </div>
            </>
          )}
          {viewMode === 'net' && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-cyan-500 rounded" />
              <span>Net Consumption (Intake - Discharge)</span>
            </div>
          )}
          {viewMode === 'scarcity' && (
            <div className="flex items-center gap-1.5">
              <div className="w-3 h-0.5 bg-amber-500 rounded" />
              <span>Scarcity-Weighted (m³ world eq)</span>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
