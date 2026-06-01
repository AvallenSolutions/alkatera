'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { CompletenessBand } from '@/lib/procurement/dashboard';

const BAND_COLOURS = ['#ef4444', '#f59e0b', '#0ea5e9', 'rgb(var(--brand-primary-rgb))'];

interface Props {
  bands: CompletenessBand[];
}

export function CompletenessBands({ bands }: Props) {
  const total = bands.reduce((acc, b) => acc + b.count, 0);
  if (total === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
        No coverage data yet
      </div>
    );
  }
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={bands} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 76 }}>
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
            width={76}
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
          <Bar dataKey="count" radius={[0, 6, 6, 0]} barSize={18}>
            {bands.map((_, i) => (
              <Cell key={i} fill={BAND_COLOURS[i % BAND_COLOURS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
