'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { Leaf, Zap } from 'lucide-react';
import { supabase } from '@/lib/supabaseClient';
import { Card, CardContent } from '@/components/ui/card';

interface Reading {
  recorded_at: string;
  intensity_g_per_kwh: number;
  forecast_g_per_kwh: number | null;
}

/**
 * Pulse — GridCarbonWidget
 *
 * Free UK Carbon Intensity data: shows the current g CO₂/kWh on the GB grid,
 * the day-ahead forecast strip, and the cleanest 3-hour window so users can
 * shift production into greener slots.
 *
 * For now: GB-NATIONAL only. Per-facility region resolution is a v2 follow-up.
 */
export function GridCarbonWidget() {
  const [readings, setReadings] = useState<Reading[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const today = new Date().toISOString().slice(0, 10);
      const { data } = await supabase
        .from('grid_carbon_readings')
        .select('recorded_at, intensity_g_per_kwh, forecast_g_per_kwh')
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
  const cleanestWindow = useMemo(() => findCleanestWindow(readings, 6), [readings]);

  if (loading) {
    return (
      <Card className="border-border/60">
        <CardContent className="p-5 text-sm text-muted-foreground">
          Loading grid carbon…
        </CardContent>
      </Card>
    );
  }

  if (readings.length === 0) {
    return (
      <Card className="border-dashed border-border/60 bg-card/40">
        <CardContent className="space-y-2 p-5">
          <div className="flex items-center gap-2">
            <Zap className="h-4 w-4 text-[#ccff00]" />
            <h3 className="text-sm font-semibold text-foreground">UK grid carbon</h3>
          </div>
          <p className="text-sm text-muted-foreground">
            Waiting for the first poll. The carbon-intensity cron writes every 30 minutes once scheduled.
          </p>
        </CardContent>
      </Card>
    );
  }

  const chartData = readings.map(r => ({
    time: r.recorded_at.slice(11, 16),
    intensity: r.intensity_g_per_kwh,
  }));

  return (
    <Card className="border-border/60">
      <CardContent className="flex flex-col space-y-3 p-5">
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-[#ccff00]" />
              <h3 className="text-sm font-semibold text-foreground">UK grid carbon</h3>
            </div>
            <p className="mt-0.5 text-xs text-muted-foreground">
              GB-NATIONAL · half-hourly via carbonintensity.org.uk
            </p>
          </div>
          {current && (
            <div className="text-right">
              <p className="text-2xl font-semibold tabular-nums text-foreground">
                {Math.round(current.intensity_g_per_kwh)}
                <span className="ml-1 text-xs text-muted-foreground">g CO₂/kWh</span>
              </p>
            </div>
          )}
        </header>

        <div className="h-40">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 4, bottom: 0, left: -16 }}>
              <XAxis
                dataKey="time"
                interval={Math.max(1, Math.floor(chartData.length / 8))}
                tick={{ fontSize: 10, fill: 'currentColor' }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis hide />
              <Tooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
              <Bar dataKey="intensity" fill="#ccff00" radius={[2, 2, 0, 0]} isAnimationActive={false} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {cleanestWindow && (
          <div className="rounded-md border border-emerald-500/20 bg-emerald-500/5 px-3 py-2 text-xs text-emerald-600 dark:text-emerald-400">
            <Leaf className="mr-1 inline h-3 w-3" />
            Cleanest window: {cleanestWindow.startTime}–{cleanestWindow.endTime} (~
            {Math.round(cleanestWindow.avg)} g/kWh, {Math.round(cleanestWindow.savingsPct)}% lower than peak)
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function findCleanestWindow(
  readings: Reading[],
  windowSize: number,
): { startTime: string; endTime: string; avg: number; savingsPct: number } | null {
  if (readings.length < windowSize) return null;
  let bestStart = 0;
  let bestSum = Infinity;
  let peakSum = -Infinity;
  for (let i = 0; i <= readings.length - windowSize; i++) {
    const slice = readings.slice(i, i + windowSize);
    const sum = slice.reduce((s, r) => s + r.intensity_g_per_kwh, 0);
    if (sum < bestSum) {
      bestSum = sum;
      bestStart = i;
    }
    if (sum > peakSum) peakSum = sum;
  }
  const avg = bestSum / windowSize;
  const peakAvg = peakSum / windowSize;
  const savingsPct = peakAvg === 0 ? 0 : ((peakAvg - avg) / peakAvg) * 100;
  return {
    startTime: readings[bestStart].recorded_at.slice(11, 16),
    endTime: readings[bestStart + windowSize - 1].recorded_at.slice(11, 16),
    avg,
    savingsPct,
  };
}
