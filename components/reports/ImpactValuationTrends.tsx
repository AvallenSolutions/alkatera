'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, TrendingDown, ArrowUpRight, ArrowDownRight } from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from 'recharts';
import type { ImpactValuationTrendPoint } from '@/hooks/data/useImpactValuationTrends';

// ─── Formatting ─────────────────────────────────────────────────────────────

function formatGBP(value: number): string {
  return value.toLocaleString('en-GB', {
    style: 'currency',
    currency: 'GBP',
    maximumFractionDigits: 0,
  });
}

function formatCompact(value: number): string {
  const abs = Math.abs(value);
  if (abs >= 1_000_000) return `£${(value / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000) return `£${(value / 1_000).toFixed(0)}k`;
  return `£${value.toFixed(0)}`;
}

// ─── Custom tooltip ─────────────────────────────────────────────────────────

interface TooltipPayload {
  dataKey: string;
  name: string;
  value: number;
  color: string;
}

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: TooltipPayload[];
  label?: string;
}) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-lg border bg-background p-3 shadow-md">
      <p className="text-sm font-semibold mb-2">{label}</p>
      {payload.map((item) => (
        <div key={item.dataKey} className="flex items-center gap-2 text-sm">
          <div
            className="h-2.5 w-2.5 rounded-full"
            style={{ backgroundColor: item.color }}
          />
          <span className="text-muted-foreground">{item.name}:</span>
          <span className="font-medium">{formatGBP(item.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── Year-over-year delta ───────────────────────────────────────────────────

function YoYDelta({
  latest,
  previous,
}: {
  latest: ImpactValuationTrendPoint;
  previous: ImpactValuationTrendPoint;
}) {
  const absoluteChange = latest.grand_total - previous.grand_total;
  const percentChange =
    previous.grand_total !== 0
      ? (absoluteChange / Math.abs(previous.grand_total)) * 100
      : 0;

  // Positive change = net impact improved (more benefits or fewer costs)
  const improved = absoluteChange > 0;

  return (
    <div className="flex items-center gap-4 mb-4 p-3 rounded-lg bg-muted/30">
      <div className="flex items-center gap-2">
        {improved ? (
          <ArrowUpRight className="h-5 w-5 text-emerald-500" />
        ) : (
          <ArrowDownRight className="h-5 w-5 text-red-500" />
        )}
        <div>
          <p className="text-sm font-medium">
            {latest.reporting_year} vs {previous.reporting_year}
          </p>
          <p
            className={`text-lg font-bold ${
              improved
                ? 'text-emerald-600 dark:text-emerald-400'
                : 'text-red-600 dark:text-red-400'
            }`}
          >
            {improved ? '+' : ''}
            {formatGBP(absoluteChange)}
          </p>
        </div>
      </div>
      <Badge
        className={
          improved
            ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-300'
            : 'bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300'
        }
      >
        {improved ? '+' : ''}
        {percentChange.toFixed(1)}%
      </Badge>
    </div>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export function ImpactValuationTrends({
  trends,
}: {
  trends: ImpactValuationTrendPoint[];
}) {
  const [view, setView] = useState<'net' | 'capitals'>('net');

  if (trends.length === 0) return null;

  const latest = trends[trends.length - 1];
  const previous = trends.length >= 2 ? trends[trends.length - 2] : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-5 w-5 text-muted-foreground" />
            Impact Over Time
          </CardTitle>
          <div className="flex gap-1">
            <Button
              variant={view === 'net' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('net')}
              className="text-xs h-7"
            >
              Net Impact
            </Button>
            <Button
              variant={view === 'capitals' ? 'default' : 'outline'}
              size="sm"
              onClick={() => setView('capitals')}
              className="text-xs h-7"
            >
              By Capital
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {/* Year-over-year delta */}
        {previous && <YoYDelta latest={latest} previous={previous} />}

        {/* Chart */}
        <ResponsiveContainer width="100%" height={300}>
          {view === 'net' ? (
            <AreaChart data={trends} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="gradientNet" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(142, 76%, 36%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="reporting_year"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="grand_total"
                name="Net Impact"
                stroke="hsl(142, 76%, 36%)"
                fill="url(#gradientNet)"
                strokeWidth={2}
                dot={{ r: 4, fill: 'hsl(142, 76%, 36%)' }}
              />
            </AreaChart>
          ) : (
            <AreaChart data={trends} margin={{ top: 5, right: 20, left: 10, bottom: 5 }}>
              <defs>
                <linearGradient id="gradNatural" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(160, 84%, 39%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradHuman" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(217, 91%, 60%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradSocial" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(347, 77%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(347, 77%, 50%)" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gradGovernance" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="hsl(263, 70%, 50%)" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="hsl(263, 70%, 50%)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
              <XAxis
                dataKey="reporting_year"
                tick={{ fontSize: 12 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 12 }}
                tickFormatter={formatCompact}
                tickLine={false}
                axisLine={false}
                width={60}
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                iconType="circle"
                iconSize={8}
                wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="natural_total"
                name="Natural Capital"
                stroke="hsl(160, 84%, 39%)"
                fill="url(#gradNatural)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="human_total"
                name="Human Capital"
                stroke="hsl(217, 91%, 60%)"
                fill="url(#gradHuman)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="social_total"
                name="Social Capital"
                stroke="hsl(347, 77%, 50%)"
                fill="url(#gradSocial)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
              <Area
                type="monotone"
                dataKey="governance_total"
                name="Governance Capital"
                stroke="hsl(263, 70%, 50%)"
                fill="url(#gradGovernance)"
                strokeWidth={2}
                dot={{ r: 3 }}
              />
            </AreaChart>
          )}
        </ResponsiveContainer>

        {/* Single data point message */}
        {trends.length === 1 && (
          <p className="text-sm text-muted-foreground text-center mt-4">
            Only one year of data available. Run valuations for additional years to see trends.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
