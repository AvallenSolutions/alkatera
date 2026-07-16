'use client';

/**
 * HCMI/CHSB hotel benchmarking: shows carbon/energy/water per occupied
 * room-night for the year and offers a CSV download for submission.
 */

import { useCallback, useEffect, useState } from 'react';
import { Download, Gauge } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface Bench {
  year: number;
  room_nights: number;
  energy_kwh_per_night: number | null;
  water_litres_per_night: number | null;
  co2e_per_night: number | null;
  facilities: number;
}

function fmt(n: number | null, d = 2) {
  return n == null ? '--' : n.toLocaleString('en-GB', { maximumFractionDigits: d });
}

export function BenchmarkingExport() {
  const year = new Date().getFullYear();
  const [data, setData] = useState<Bench | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/hospitality/benchmarking?year=${year}`, { credentials: 'include' });
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
    }
  }, [year]);

  useEffect(() => { load(); }, [load]);

  if (loading || !data || data.facilities === 0) return null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <Gauge className="h-5 w-5" /> Hotel benchmarking (HCMI / CHSB) — {year}
        </CardTitle>
        <Button variant="outline" size="sm" asChild>
          <a href={`/api/hospitality/benchmarking?year=${year}&format=csv`}>
            <Download className="mr-2 h-4 w-4" /> Export CSV
          </a>
        </Button>
      </CardHeader>
      <CardContent>
        <div className="grid gap-3 sm:grid-cols-4">
          <Metric label="Room-nights" value={fmt(data.room_nights, 0)} unit="nights" />
          <Metric label="Carbon / room-night" value={fmt(data.co2e_per_night)} unit="kg CO₂e" />
          <Metric label="Energy / room-night" value={fmt(data.energy_kwh_per_night)} unit="kWh" />
          <Metric label="Water / room-night" value={fmt(data.water_litres_per_night, 0)} unit="litres" />
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          Energy and water are taken from your accommodation facilities&apos; meters and divided by room-nights
          sold, aligned to the Hotel Carbon &amp; Water Measurement Initiatives.
        </p>
      </CardContent>
    </Card>
  );
}

function Metric({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-lg border bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-lg font-semibold">{value}</p>
      <p className="text-[11px] text-muted-foreground">{unit}</p>
    </div>
  );
}
