'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

export interface CompletenessBucket {
  label: string;
  count: number;
}

interface Props {
  buckets: CompletenessBucket[];
}

const BAR_COLOURS = ['#52525b', '#0d9488', '#14b8a6', '#5eead4'];

/**
 * Horizontal bar chart showing the distribution of brands across four
 * completeness bands (0–25 / 25–50 / 50–75 / 75–100). Server component
 * pre-computes the buckets so this stays purely presentational.
 */
export function CompletenessChart({ buckets }: Props) {
  return (
    <div className="h-44">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 32 }}>
          <XAxis type="number" stroke="#a1a1aa" fontSize={11} allowDecimals={false} />
          <YAxis type="category" dataKey="label" stroke="#a1a1aa" fontSize={11} width={70} />
          <Tooltip
            cursor={{ fill: 'rgba(20, 184, 166, 0.08)' }}
            contentStyle={{
              background: '#0a0a0a',
              border: '1px solid #1f1f1f',
              fontSize: 12,
              padding: '4px 8px',
            }}
          />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {buckets.map((_, i) => (
              <Cell key={i} fill={BAR_COLOURS[i % BAR_COLOURS.length]} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
