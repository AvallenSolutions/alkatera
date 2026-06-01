'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import type { TierDistribution } from '@/lib/procurement/dashboard';

const TIER_LABEL: Record<TierDistribution['tier'], string> = {
  leader: 'Leader',
  progressing: 'Progressing',
  developing: 'Developing',
  insufficient: 'Insufficient',
  unknown: 'No data yet',
};

const TIER_COLOUR: Record<TierDistribution['tier'], string> = {
  leader: '#059669',
  progressing: '#0d9488',
  developing: '#f59e0b',
  insufficient: '#ef4444',
  unknown: '#cbd5e1',
};

interface Props {
  tiers: TierDistribution[];
  metric: 'brand_count' | 'sku_count';
}

export function TierBar({ tiers, metric }: Props) {
  const data = tiers
    .filter((t) => (metric === 'brand_count' ? t.brand_count : t.sku_count) > 0)
    .map((t) => ({
      tier: t.tier,
      label: TIER_LABEL[t.tier],
      value: metric === 'brand_count' ? t.brand_count : t.sku_count,
    }));
  if (data.length === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
        No tier data yet
      </div>
    );
  }
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} layout="vertical" margin={{ top: 8, right: 12, bottom: 4, left: 96 }}>
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
            width={96}
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
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={TIER_COLOUR[d.tier]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
