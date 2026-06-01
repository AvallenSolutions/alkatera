'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface Props {
  data: Array<{ label: string; value: number }>;
  /** Recharts colour string. Pass an `rgb(var(...))` expression to read a brand CSS variable. */
  fill?: string;
  emptyText?: string;
}

/**
 * Generic horizontal bar chart for category / country breakdowns.
 * Server component computes the [{ label, value }] payload; this is
 * purely presentational.
 */
export function HorizontalBar({ data, fill, emptyText }: Props) {
  if (data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
        {emptyText ?? 'No data yet'}
      </div>
    );
  }
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 110 }}>
          <XAxis
            type="number"
            stroke="#94a3b8"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            allowDecimals={false}
          />
          <YAxis
            type="category"
            dataKey="label"
            stroke="#475569"
            fontSize={11}
            tickLine={false}
            axisLine={false}
            width={110}
          />
          <Tooltip
            cursor={{ fill: 'rgba(61, 186, 198, 0.08)' }}
            contentStyle={{
              background: 'white',
              border: '1px solid #e2e8f0',
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
          />
          <Bar
            dataKey="value"
            radius={[0, 6, 6, 0]}
            barSize={18}
            fill={fill ?? 'rgb(var(--brand-primary-rgb))'}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
