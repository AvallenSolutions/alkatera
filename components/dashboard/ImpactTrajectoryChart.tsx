'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface ImpactTrajectoryChartProps {
  data: Array<{
    month: string;
    value: number;
  }>;
  className?: string;
}

const timePeriods = [
  { label: '1M', value: '1M' },
  { label: '3M', value: '3M' },
  { label: '6M', value: '6M' },
  { label: '1Y', value: '1Y' },
] as const;

export function ImpactTrajectoryChart({ data, className }: ImpactTrajectoryChartProps) {
  const [selectedPeriod, setSelectedPeriod] = useState('6M');

  return (
    <Card className={className}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-7">
        <h3 className="text-lg font-heading font-semibold">Impact Trajectory</h3>
        <div className="flex gap-2">
          {timePeriods.map((period) => (
            <Button
              key={period.value}
              variant="time-period"
              size="sm"
              data-active={selectedPeriod === period.value}
              onClick={() => setSelectedPeriod(period.value)}
              className="h-8 px-3"
            >
              {period.label}
            </Button>
          ))}
        </div>
      </CardHeader>
      <CardContent>
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart data={data}>
            <defs>
              <linearGradient id="colorValue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(var(--neon-lime))" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(var(--neon-lime))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
            <XAxis
              dataKey="month"
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              stroke="hsl(var(--muted-foreground))"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) => `${value / 1000}k`}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(var(--card))',
                border: '1px solid hsl(var(--border))',
                borderRadius: '0.5rem',
                padding: '0.75rem',
              }}
              labelStyle={{
                color: 'hsl(var(--foreground))',
                fontWeight: 600,
                marginBottom: '0.25rem',
              }}
              itemStyle={{
                color: 'hsl(var(--neon-lime))',
                fontFamily: 'var(--font-data)',
              }}
            />
            <Area
              type="natural"
              dataKey="value"
              stroke="hsl(var(--neon-lime))"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorValue)"
              animationDuration={1000}
              animationEasing="ease-out"
            />
          </AreaChart>
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}
