'use client';

/**
 * Multi-year Scope 1/2/3 emissions trend. Stacked bar per reporting year,
 * fed by the company-footprint page's existing liveEmissions state (one
 * calculateCorporateEmissions() result per year), so it adds no fetching.
 */

import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { ScopeBreakdown } from '@/lib/calculations/corporate-emissions';
import { SCOPE_COLOURS, SCOPE_LABELS, formatCo2e } from '@/lib/reports/scope-display';

type LiveEmissions = Record<number, { total: number; breakdown: ScopeBreakdown | null }>;

export function EmissionsTrendChart({ liveEmissions }: { liveEmissions: LiveEmissions }) {
  const data = useMemo(() => {
    return Object.entries(liveEmissions)
      .map(([year, v]) => ({
        year: Number(year),
        scope1: v.breakdown?.scope1 ?? 0,
        scope2: v.breakdown?.scope2 ?? 0,
        scope3: v.breakdown?.scope3?.total ?? 0,
        total: v.total ?? 0,
      }))
      .filter((d) => d.total > 0)
      .sort((a, b) => a.year - b.year);
  }, [liveEmissions]);

  if (data.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Emissions over time</CardTitle>
      </CardHeader>
      <CardContent>
        <div style={{ width: '100%', height: 280 }}>
          <ResponsiveContainer>
            <BarChart data={data} margin={{ top: 24, right: 12, left: 4, bottom: 4 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="year" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
              <YAxis
                stroke="hsl(var(--muted-foreground))"
                fontSize={12}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v) => formatCo2e(Number(v))}
                width={56}
              />
              <Tooltip
                cursor={{ fill: 'hsl(var(--muted) / 0.3)' }}
                contentStyle={{
                  backgroundColor: 'hsl(var(--card))',
                  border: '1px solid hsl(var(--border))',
                  borderRadius: 8,
                  fontSize: 12,
                }}
                formatter={(value: number, name: string) => [formatCo2e(Number(value)), name]}
              />
              <Legend wrapperStyle={{ fontSize: 12 }} />
              <Bar dataKey="scope1" stackId="s" name={SCOPE_LABELS.scope1} fill={SCOPE_COLOURS.scope1} />
              <Bar dataKey="scope2" stackId="s" name={SCOPE_LABELS.scope2} fill={SCOPE_COLOURS.scope2} />
              <Bar dataKey="scope3" stackId="s" name={SCOPE_LABELS.scope3} fill={SCOPE_COLOURS.scope3} radius={[4, 4, 0, 0]}>
                <LabelList
                  dataKey="total"
                  position="top"
                  fontSize={11}
                  fill="hsl(var(--muted-foreground))"
                  formatter={(v: number) => formatCo2e(Number(v))}
                />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        {data.length === 1 && (
          <p className="mt-2 text-xs text-muted-foreground">
            Add reports for earlier years to see how your emissions are changing.
          </p>
        )}
      </CardContent>
    </Card>
  );
}
