'use client';

import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import type { ChannelBreakdown } from '@/lib/procurement/dashboard';
import { CHANNEL_COLOURS as SLICE_COLOURS } from '@/lib/procurement/channel-colours';

interface Props {
  channels: ChannelBreakdown[];
  metric: 'sku_count' | 'volume_liters';
}

export function ChannelPie({ channels, metric }: Props) {
  const data = channels.map((c) => ({
    name: c.channel,
    value: metric === 'sku_count' ? c.sku_count : c.volume_liters,
  }));
  const total = data.reduce((acc, d) => acc + d.value, 0);
  if (total === 0) {
    return (
      <div className="h-44 flex items-center justify-center text-xs text-muted-foreground">
        No data yet
      </div>
    );
  }
  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            dataKey="value"
            nameKey="name"
            innerRadius={44}
            outerRadius={78}
            paddingAngle={3}
            stroke="white"
            strokeWidth={2}
          >
            {data.map((_, i) => (
              <Cell key={i} fill={SLICE_COLOURS[i % SLICE_COLOURS.length]} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: 'white',
              border: '1px solid #e2e8f0',
              fontSize: 12,
              padding: '6px 10px',
              borderRadius: 8,
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.08)',
            }}
            formatter={(value: number, name) => [
              metric === 'volume_liters'
                ? `${Math.round(value).toLocaleString('en-GB')} L`
                : value.toLocaleString('en-GB'),
              name,
            ]}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
