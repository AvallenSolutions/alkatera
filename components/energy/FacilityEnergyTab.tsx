'use client';

/**
 * Facility "Energy & grid" tab (Programme 2 / Phase 3).
 *
 * Shows the facility's region, today's half-hourly grid carbon intensity, the
 * cleanest/dirtiest windows + a timing recommendation, and an upload for
 * half-hourly smart-meter data. GB facilities only.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { ResponsiveContainer, AreaChart, Area, ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ReferenceLine, Legend } from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StateChip } from '@/components/studio/state-chip';
import type { WorkingTone } from '@/components/studio/theme';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Zap, Upload, Leaf, AlertTriangle, Clock } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

interface TimingWindow {
  label: string;
  avgG: number;
}
interface Insight {
  region: string | null;
  regionName?: string;
  currentG?: number | null;
  points?: { recordedAt: string; gPerKwh: number }[];
  timing?: {
    cleanest: TimingWindow | null;
    dirtiest: TimingWindow | null;
    spreadG: number;
    savingKgPerKwh: number;
    recommendation: string | null;
  };
  hasHalfHourlyData?: boolean;
  consumption?: ConsumptionData | null;
  gasConsumption?: ConsumptionData | null;
  message?: string;
}

interface ConsumptionData {
  count: number;
  firstDate: string;
  lastDate: string;
  totalKwh: number;
  profile: { hhmm: string; avgKwh: number; avgIntensityG: number | null }[];
  flatAvgIntensityG: number | null;
  weightedAvgIntensityG: number | null;
}

function statusOf(g: number): { label: string; tone: WorkingTone } {
  if (g < 150) return { label: 'Clean', tone: 'good' };
  if (g < 300) return { label: 'Mixed', tone: 'attention' };
  return { label: 'Dirty', tone: 'stale' };
}

// Cream-panel tooltip in the studio language: hairline border, ink text.
const TOOLTIP_PROPS = {
  contentStyle: {
    background: '#F2F1EA',
    border: '1px solid #D9D6CB',
    borderRadius: 6,
    fontSize: 12,
    color: '#1A1B1D',
  } as React.CSSProperties,
  labelStyle: { color: '#6F6F68', marginBottom: 2 } as React.CSSProperties,
};

export function FacilityEnergyTab({ facilityId }: { facilityId: string }) {
  const { toast } = useToast();
  const [data, setData] = useState<Insight | null>(null);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fuel, setFuel] = useState<'electricity' | 'gas'>('electricity');
  const [conflict, setConflict] = useState<{
    fuel: string;
    span: { from: string; to: string };
    summary: { readings: number; totalKwh: number; months: number };
    existing: { from: string; to: string; quantity: number; unit: string }[];
  } | null>(null);
  const pendingFile = useRef<File | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/energy/facility-insight?facility_id=${facilityId}`);
      setData(await res.json());
    } catch {
      setData({ region: null, message: 'Could not load grid data.' });
    } finally {
      setLoading(false);
    }
  }, [facilityId]);

  useEffect(() => {
    load();
  }, [load]);

  const doUpload = async (file: File, resolution?: 'replace' | 'detail_only') => {
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('facility_id', facilityId);
      fd.append('fuel', fuel);
      const url = '/api/energy/smart-meter/upload' + (resolution ? `?resolution=${resolution}` : '');
      const res = await fetch(url, { method: 'POST', body: fd });
      const body = await res.json();
      if (res.status === 409 && body?.conflict) {
        pendingFile.current = file;
        setConflict(body);
        return;
      }
      if (!res.ok) throw new Error(body?.error || (body?.details ?? []).join('; ') || 'Upload failed');
      setConflict(null);
      pendingFile.current = null;
      toast({
        title: 'Half-hourly data imported',
        description:
          `${body.readingsWritten?.toLocaleString('en-GB')} readings` +
          (body.derivedEntries ? `, ${body.derivedEntries} monthly total(s) derived` : '') +
          (body.replacedBills ? `, ${body.replacedBills} bill(s) replaced` : '') + '.',
      });
      load();
    } catch (e) {
      toast({ title: 'Upload failed', description: e instanceof Error ? e.message : 'Please try again', variant: 'destructive' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  if (loading) return <Skeleton className="w-full rounded-lg" style={{ height: 420 }} />;

  if (!data || !data.region) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center gap-2 py-12 text-center text-sm text-muted-foreground">
          <Zap className="h-8 w-8 opacity-40" />
          <p className="font-medium">Live grid intensity isn&apos;t available for this facility</p>
          <p className="text-xs">{data?.message ?? 'Add a GB postcode to the facility to see its regional grid carbon and energy-timing.'}</p>
        </CardContent>
      </Card>
    );
  }

  const current = data.currentG ?? null;
  const st = current != null ? statusOf(current) : null;
  const chartData = (data.points ?? []).map((p) => ({ t: p.recordedAt.slice(11, 16), g: Math.round(p.gPerKwh) }));
  const timing = data.timing;

  return (
    <div className="space-y-4">
      {/* Headline row */}
      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="text-xs text-muted-foreground">Grid carbon now · {data.regionName}</div>
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold tabular-nums">{current != null ? Math.round(current) : '--'}</span>
              <span className="text-sm text-muted-foreground">g CO2/kWh</span>
            </div>
            {st && <StateChip tone={st.tone}>{st.label}</StateChip>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><Leaf className="h-3.5 w-3.5" /> Cleanest window today</div>
            <div className="text-2xl font-semibold">{timing?.cleanest?.label ?? '--'}</div>
            {timing?.cleanest && <div className="text-xs text-muted-foreground">≈{Math.round(timing.cleanest.avgG)} g/kWh</div>}
          </CardContent>
        </Card>
        <Card>
          <CardContent className="space-y-1 p-4">
            <div className="flex items-center gap-1 text-xs text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Dirtiest window today</div>
            <div className="text-2xl font-semibold">{timing?.dirtiest?.label ?? '--'}</div>
            {timing?.dirtiest && <div className="text-xs text-muted-foreground">≈{Math.round(timing.dirtiest.avgG)} g/kWh</div>}
          </CardContent>
        </Card>
      </div>

      {/* Today's intensity curve */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Today&apos;s grid carbon intensity · {data.regionName}</CardTitle>
        </CardHeader>
        <CardContent>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 8, bottom: 0, left: -10 }}>
                <defs>
                  <linearGradient id="gridGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#2B46C0" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="#2B46C0" stopOpacity={0.04} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="t" tick={{ fontSize: 11 }} interval={7} />
                <YAxis tick={{ fontSize: 11 }} width={40} />
                <Tooltip {...TOOLTIP_PROPS} formatter={(v) => [`${v} g/kWh`, 'Intensity']} labelFormatter={(l) => `at ${l}`} />
                <ReferenceLine y={150} stroke="#047857" strokeDasharray="3 3" />
                <ReferenceLine y={300} stroke="#BE123C" strokeDasharray="3 3" />
                <Area type="monotone" dataKey="g" stroke="#2B46C0" strokeWidth={2} fill="url(#gridGrad)" isAnimationActive={false} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">Regional forecast from the National Energy System Operator (Carbon Intensity API). Dashed lines: clean (150) / dirty (300) g/kWh.</p>
        </CardContent>
      </Card>

      {/* Uploaded consumption profile vs grid intensity */}
      {data.consumption && data.consumption.count > 0 && (() => {
        const c = data.consumption!;
        const profile = c.profile.map((p) => ({
          t: p.hhmm,
          kwh: Number(p.avgKwh.toFixed(2)),
          g: p.avgIntensityG != null ? Math.round(p.avgIntensityG) : null,
        }));
        const wt = c.weightedAvgIntensityG;
        const flat = c.flatAvgIntensityG;
        const pct = wt != null && flat != null && flat > 0 ? ((wt - flat) / flat) * 100 : null;
        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Your half-hourly consumption</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {c.firstDate} → {c.lastDate} · {Math.round(c.totalKwh).toLocaleString('en-GB')} kWh · {c.count.toLocaleString('en-GB')} readings
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ height: 260 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={profile} margin={{ top: 5, right: 4, bottom: 0, left: -10 }}>
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} interval={7} />
                    <YAxis yAxisId="kwh" tick={{ fontSize: 11 }} width={42} />
                    <YAxis yAxisId="g" orientation="right" tick={{ fontSize: 11 }} width={42} />
                    <Tooltip {...TOOLTIP_PROPS} />
                    <Legend wrapperStyle={{ fontSize: 11 }} />
                    <Bar yAxisId="kwh" dataKey="kwh" name="Avg consumption (kWh)" fill="#2B46C0" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                    <Line yAxisId="g" type="monotone" dataKey="g" name="Grid intensity (g/kWh)" stroke="#BE123C" strokeWidth={2} dot={false} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Average day across the uploaded period. Bars = your consumption; the line = grid carbon intensity for {data.regionName}.
              </p>
              {pct != null && Math.abs(pct) >= 1 && (
                <p className="mt-2 text-sm">
                  Your electricity falls in periods averaging{' '}
                  <span className="font-medium">{Math.round(wt as number)} g/kWh</span> vs{' '}
                  <span className="font-medium">{Math.round(flat as number)} g/kWh</span> if spread evenly:{' '}
                  {pct > 0 ? (
                    <span className="text-studio-attention">about {Math.round(pct)}% higher-carbon-timed, so there&apos;s room to shift load.</span>
                  ) : (
                    <span className="text-studio-good">about {Math.round(Math.abs(pct))}% lower-carbon-timed already.</span>
                  )}
                </p>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Gas consumption (visibility only — gas carbon is time-flat) */}
      {data.gasConsumption && data.gasConsumption.count > 0 && (() => {
        const g = data.gasConsumption!;
        const profile = g.profile.map((p) => ({ t: p.hhmm, kwh: Number(p.avgKwh.toFixed(2)) }));
        return (
          <Card>
            <CardHeader className="pb-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <CardTitle className="text-base">Your half-hourly gas use</CardTitle>
                <span className="text-xs text-muted-foreground">
                  {g.firstDate} → {g.lastDate} · {Math.round(g.totalKwh).toLocaleString('en-GB')} kWh · {g.count.toLocaleString('en-GB')} readings
                </span>
              </div>
            </CardHeader>
            <CardContent>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={profile} margin={{ top: 5, right: 4, bottom: 0, left: -10 }}>
                    <XAxis dataKey="t" tick={{ fontSize: 11 }} interval={7} />
                    <YAxis tick={{ fontSize: 11 }} width={42} />
                    <Tooltip {...TOOLTIP_PROPS} />
                    <Bar dataKey="kwh" name="Avg gas (kWh)" fill="#6F6F68" radius={[2, 2, 0, 0]} isAnimationActive={false} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                Average day across the uploaded period. Gas carbon is the same at any time of day, so there&apos;s no
                timing benefit. This is for visibility.
              </p>
            </CardContent>
          </Card>
        );
      })()}

      {/* Recommendation */}
      {timing?.recommendation && (
        <Card className="border-primary/30">
          <CardContent className="flex items-start gap-3 p-4">
            <Clock className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <div className="text-sm font-medium">Energy-timing tip</div>
              <p className="text-sm text-muted-foreground">{timing.recommendation}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* HH upload */}
      <Card>
        <CardContent className="space-y-3 p-4">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <div className="text-sm font-medium">Half-hourly meter data</div>
              <p className="text-xs text-muted-foreground">
                {data.hasHalfHourlyData
                  ? 'Half-hourly data is loaded: your monthly totals are derived from it, so no separate bill is needed for these months.'
                  : 'Got a smart meter? Upload your half-hourly export instead of a bill, and we work out your monthly totals from it.'}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <div className="inline-flex rounded-md border p-0.5 text-xs">
                {(['electricity', 'gas'] as const).map((f) => (
                  <button
                    key={f}
                    type="button"
                    onClick={() => setFuel(f)}
                    className={`rounded px-2 py-1 capitalize ${fuel === f ? 'bg-primary text-primary-foreground' : 'text-muted-foreground'}`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <input
                ref={fileRef}
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && doUpload(e.target.files[0])}
              />
              <Button variant="outline" disabled={uploading} onClick={() => fileRef.current?.click()}>
                <Upload className="mr-2 h-4 w-4" />
                {uploading ? 'Uploading…' : 'Upload CSV'}
              </Button>
            </div>
          </div>

          {conflict && (
            <div className="rounded-[6px] border border-border bg-card p-3 text-sm">
              <div className="flex items-center gap-2 font-medium text-studio-attention">
                <AlertTriangle className="h-4 w-4" /> You already have {conflict.fuel} bill data for these months
              </div>
              <p className="mt-1 text-xs text-muted-foreground">
                This upload covers {conflict.span.from} → {conflict.span.to} ({conflict.summary.months} month(s),{' '}
                {conflict.summary.totalKwh.toLocaleString('en-GB')} kWh), which overlaps{' '}
                {conflict.existing.length} existing entr{conflict.existing.length === 1 ? 'y' : 'ies'}. To avoid counting
                the same energy twice, choose one:
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Button size="sm" disabled={uploading} onClick={() => pendingFile.current && doUpload(pendingFile.current, 'replace')}>
                  Replace the bill with smart-meter data
                </Button>
                <Button size="sm" variant="outline" disabled={uploading} onClick={() => pendingFile.current && doUpload(pendingFile.current, 'detail_only')}>
                  Keep my bill (import detail only)
                </Button>
                <Button size="sm" variant="ghost" disabled={uploading} onClick={() => { setConflict(null); pendingFile.current = null; }}>
                  Cancel
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
