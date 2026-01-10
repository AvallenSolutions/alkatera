'use client';

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  PieChart,
  Pie,
  Cell,
  ResponsiveContainer,
  Tooltip,
  Legend,
} from 'recharts';
import { Droplets } from 'lucide-react';
import type { WaterSourceBreakdown } from '@/hooks/data/useFacilityWaterData';

interface WaterSourceBreakdownChartProps {
  data: WaterSourceBreakdown[];
  loading?: boolean;
  height?: number;
  title?: string;
  showLegend?: boolean;
  innerRadius?: number;
  outerRadius?: number;
  className?: string;
}

const SOURCE_COLORS: Record<string, string> = {
  'Municipal': '#3b82f6',
  'Groundwater': '#22c55e',
  'Surface Water': '#06b6d4',
  'Rainwater': '#8b5cf6',
  'Recycled': '#10b981',
  'Seawater': '#0ea5e9',
  'Other': '#94a3b8',
};

const SOURCE_ICONS: Record<string, string> = {
  'Municipal': 'tap',
  'Groundwater': 'well',
  'Surface Water': 'river',
  'Rainwater': 'cloud',
  'Recycled': 'recycle',
};

export function WaterSourceBreakdownChart({
  data,
  loading = false,
  height = 280,
  title = 'Water Sources',
  showLegend = true,
  innerRadius = 50,
  outerRadius = 90,
  className,
}: WaterSourceBreakdownChartProps) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      color: item.color || SOURCE_COLORS[item.source] || SOURCE_COLORS['Other'],
    }));
  }, [data]);

  const totalVolume = useMemo(() => {
    return data.reduce((sum, item) => sum + item.value, 0);
  }, [data]);

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
            <Droplets className="h-8 w-8 opacity-50" />
            <span>No source data available</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const CustomTooltip = ({ active, payload }: any) => {
    if (!active || !payload || !payload.length) return null;

    const data = payload[0].payload;
    return (
      <div className="bg-popover border border-border rounded-lg p-3 shadow-lg">
        <div className="flex items-center gap-2 mb-1">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: data.color }}
          />
          <span className="font-medium text-sm">{data.source}</span>
        </div>
        <div className="text-xs text-muted-foreground space-y-0.5">
          <p>Volume: {data.value.toLocaleString('en-GB', { maximumFractionDigits: 2 })} m³</p>
          <p>Share: {data.percentage.toFixed(1)}%</p>
        </div>
      </div>
    );
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    if (percent < 0.05) return null;

    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);

    return (
      <text
        x={x}
        y={y}
        fill="white"
        textAnchor="middle"
        dominantBaseline="central"
        className="text-xs font-medium"
        style={{ textShadow: '0 1px 2px rgba(0,0,0,0.5)' }}
      >
        {(percent * 100).toFixed(0)}%
      </text>
    );
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base">{title}</CardTitle>
          <span className="text-xs text-muted-foreground">
            Total: {totalVolume.toLocaleString('en-GB', { maximumFractionDigits: 0 })} m³
          </span>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        <ResponsiveContainer width="100%" height={height}>
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius={innerRadius}
              outerRadius={outerRadius}
              paddingAngle={2}
              dataKey="value"
              labelLine={false}
              label={renderCustomizedLabel}
            >
              {chartData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={entry.color}
                  stroke="hsl(var(--background))"
                  strokeWidth={2}
                />
              ))}
            </Pie>
            <Tooltip content={<CustomTooltip />} />
          </PieChart>
        </ResponsiveContainer>

        {showLegend && (
          <div className="grid grid-cols-2 gap-2 mt-2">
            {chartData.map((item, index) => (
              <div
                key={index}
                className="flex items-center gap-2 p-2 rounded-md hover:bg-muted/50 transition-colors"
              >
                <div
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: item.color }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-medium truncate">{item.source}</p>
                  <p className="text-xs text-muted-foreground">
                    {item.percentage.toFixed(1)}%
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function WaterSourceBreakdownCompact({
  data,
  loading = false,
  className,
}: Pick<WaterSourceBreakdownChartProps, 'data' | 'loading' | 'className'>) {
  const chartData = useMemo(() => {
    return data.map(item => ({
      ...item,
      color: item.color || SOURCE_COLORS[item.source] || SOURCE_COLORS['Other'],
    }));
  }, [data]);

  if (loading) {
    return <Skeleton className="h-6 w-full rounded-full" />;
  }

  if (chartData.length === 0) {
    return (
      <div className="h-6 bg-muted rounded-full flex items-center justify-center text-xs text-muted-foreground">
        No data
      </div>
    );
  }

  return (
    <div className={className}>
      <div className="flex h-4 rounded-full overflow-hidden bg-muted">
        {chartData.map((item, index) => (
          <div
            key={index}
            className="h-full transition-all"
            style={{
              width: `${item.percentage}%`,
              backgroundColor: item.color,
            }}
            title={`${item.source}: ${item.percentage.toFixed(1)}%`}
          />
        ))}
      </div>
      <div className="flex gap-3 mt-2 text-xs text-muted-foreground flex-wrap">
        {chartData.map((item, index) => (
          <div key={index} className="flex items-center gap-1">
            <div
              className="w-2 h-2 rounded-full"
              style={{ backgroundColor: item.color }}
            />
            <span>{item.source}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
