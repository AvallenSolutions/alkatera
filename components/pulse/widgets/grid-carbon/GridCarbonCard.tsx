'use client';

/**
 * Pulse -- Grid carbon, compact card.
 *
 * Reads `grid_carbon_readings` directly from Supabase, same source as the
 * existing full `GridCarbonWidget`. Headline: current gCO2/kWh. Supporting:
 * intra-day mini line.
 */

import { useEffect, useState } from 'react';
import { Line, LineChart, ResponsiveContainer } from 'recharts';
import { Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { useWidgetDrill } from '@/lib/pulse/MetricDrillContext';
import { PulseCard } from '@/components/pulse/PulseCard';

interface Reading {
  recorded_at: string;
  intensity_g_per_kwh: number;
}

export function GridCarbonCard() {
  const { openDrill } = useWidgetDrill();
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('grid_carbon_readings')
        .select('recorded_at, intensity_g_per_kwh')
        .eq('region_code', 'GB-NATIONAL')
        .gte('recorded_at', `${today}T00:00:00Z`)
        .order('recorded_at', { ascending: true });
      if (cancelled) return;
      setReadings((data as Reading[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const current = readings[readings.length - 1] ?? null;
  const currentGramsPerKwh = current?.intensity_g_per_kwh;

  const status =
    currentGramsPerKwh !== undefined
      ? currentGramsPerKwh < 150
        ? ({ tone: 'good' as const, label: 'Clean' })
        : currentGramsPerKwh > 300
          ? ({ tone: 'bad' as const, label: 'Dirty' })
          : ({ tone: 'neutral' as const, label: 'Mixed' })
      : null;

  const chartData = readings.map(r => ({
    time: r.recorded_at.slice(11, 16),
    intensity: r.intensity_g_per_kwh,
  }));

  return (
    <PulseCard
      icon={Zap}
      label="Grid carbon"
      headline={currentGramsPerKwh !== undefined ? `${Math.round(currentGramsPerKwh)}g` : '—'}
      sub="CO₂ / kWh, GB-NATIONAL"
      status={status}
      footprint="1x1"
      loading={loading}
      onExpand={() => openDrill({ kind: 'widget', id: 'grid-carbon' })}
    >
      {chartData.length > 1 ? (
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
            <Line
              type="monotone"
              dataKey="intensity"
              stroke="#ccff00"
              strokeWidth={2}
              dot={false}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      ) : (
        <div className="flex h-full items-center justify-center text-[9px] uppercase tracking-wider text-muted-foreground/50">
          Waiting for readings
        </div>
      )}
    </PulseCard>
  );
}
