'use client';

/**
 * "Where your supply-chain emissions come from": a sorted horizontal bar
 * chart of the Scope 3 categories for a chosen year. Plainer than an
 * accountant's waterfall, which is the point for a non-specialist reader.
 * Fed by the page's liveEmissions; the GHG category number sits in the
 * tooltip, not the visible label.
 */

import { useMemo, useState } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Panel, Eyebrow } from '@/components/studio';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { ScopeBreakdown } from '@/lib/calculations/corporate-emissions';
import { SCOPE_COLOURS, formatCo2e, scope3Bars } from '@/lib/reports/scope-display';

type LiveEmissions = Record<number, { total: number; breakdown: ScopeBreakdown | null }>;

export function Scope3BreakdownChart({ liveEmissions }: { liveEmissions: LiveEmissions }) {
  const yearsWithScope3 = useMemo(
    () =>
      Object.entries(liveEmissions)
        .filter(([, v]) => (v.breakdown?.scope3?.total ?? 0) > 0)
        .map(([year]) => Number(year))
        .sort((a, b) => b - a),
    [liveEmissions],
  );

  const [year, setYear] = useState<number | null>(yearsWithScope3[0] ?? null);
  const activeYear = year ?? yearsWithScope3[0] ?? null;

  const bars = useMemo(() => {
    if (activeYear === null) return [];
    const breakdown = liveEmissions[activeYear]?.breakdown?.scope3;
    return breakdown ? scope3Bars(breakdown) : [];
  }, [liveEmissions, activeYear]);

  if (yearsWithScope3.length === 0 || bars.length === 0) return null;

  return (
    <Panel>
      <div className="mb-4 flex flex-row items-center justify-between gap-3">
        <Eyebrow tone="dim">WHERE YOUR SUPPLY-CHAIN EMISSIONS COME FROM</Eyebrow>
        {yearsWithScope3.length > 1 && (
          <Select value={String(activeYear)} onValueChange={(v) => setYear(Number(v))}>
            <SelectTrigger className="h-8 w-24 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {yearsWithScope3.map((y) => (
                <SelectItem key={y} value={String(y)}>
                  {y}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>
      <div>
        <div style={{ width: '100%', height: Math.max(200, bars.length * 38) }}>
          <ResponsiveContainer>
            <BarChart data={bars} layout="vertical" margin={{ top: 4, right: 16, left: 8, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
              <XAxis
                type="number"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCo2e(Number(v))}
              />
              <YAxis
                type="category"
                dataKey="label"
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                width={180}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, _name, item: any) => [
                  `${formatCo2e(Number(value))} (${Math.round(item?.payload?.pct ?? 0)}% of Scope 3)`,
                  `GHG category ${item?.payload?.ghgCategory ?? ''}`,
                ]}
              />
              <Bar dataKey="value" fill={SCOPE_COLOURS.scope3} radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Your biggest reduction opportunities usually sit in the largest bars here.
        </p>
      </div>
    </Panel>
  );
}
