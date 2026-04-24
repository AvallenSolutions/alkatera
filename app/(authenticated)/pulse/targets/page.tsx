'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Loader2, Target as TargetIcon, Trash2 } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ALL_METRIC_KEYS, METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

interface Target {
  id: string;
  metric_key: MetricKey;
  baseline_value: number;
  baseline_date: string;
  target_value: number;
  target_date: string;
  notes: string | null;
}

const PRESETS = [
  { label: 'SBTi 1.5°C: -42% absolute scope 1+2 by 2030', metric: 'total_co2e', factor: 0.58, year: 2030 },
  { label: 'Net zero scope 1+2 by 2040', metric: 'total_co2e', factor: 0, year: 2040 },
  { label: '100% LCA coverage by 2027', metric: 'lca_completeness_pct', factor: 100, year: 2027 },
] as const;

export default function TargetsPage() {
  const { currentOrganization } = useOrganization();
  const [targets, setTargets] = useState<Target[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form state
  const [metricKey, setMetricKey] = useState<MetricKey>('total_co2e');
  const [baselineValue, setBaselineValue] = useState('');
  const [baselineDate, setBaselineDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetValue, setTargetValue] = useState('');
  const [targetDate, setTargetDate] = useState('2030-12-31');
  const [notes, setNotes] = useState('');

  async function refresh() {
    if (!currentOrganization?.id) return;
    setLoading(true);
    const res = await fetch(`/api/pulse/targets?organization_id=${currentOrganization.id}`);
    const body = await res.json().catch(() => ({}));
    setTargets(body.targets ?? []);
    setLoading(false);
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentOrganization?.id]);

  async function createTarget() {
    if (!currentOrganization?.id) return;
    setCreating(true);
    setError(null);
    const res = await fetch('/api/pulse/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: currentOrganization.id,
        metric_key: metricKey,
        baseline_value: Number(baselineValue),
        baseline_date: baselineDate,
        target_value: Number(targetValue),
        target_date: targetDate,
        notes: notes || null,
      }),
    });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(body.error ?? `Failed (${res.status})`);
      setCreating(false);
      return;
    }
    setBaselineValue('');
    setTargetValue('');
    setNotes('');
    await refresh();
    setCreating(false);
  }

  async function deleteTarget(id: string) {
    await fetch(`/api/pulse/targets?id=${id}`, { method: 'DELETE' });
    await refresh();
  }

  function applyPreset(preset: (typeof PRESETS)[number]) {
    setMetricKey(preset.metric as MetricKey);
    setTargetDate(`${preset.year}-12-31`);
    if (baselineValue) {
      const baseline = Number(baselineValue);
      const newTarget =
        preset.factor === 100 ? 100 : Number((baseline * preset.factor).toFixed(2));
      setTargetValue(String(newTarget));
    }
  }

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link
          href="/pulse"
          className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3 w-3" />
          Back to Pulse
        </Link>
        <div className="flex items-center gap-2">
          <TargetIcon className="h-6 w-6 text-[#ccff00]" />
          <h1 className="text-3xl font-semibold tracking-tight">Targets</h1>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Set sustainability commitments. Pulse will project your trajectory at the current
          pace and flag whether you are on track, at risk, or off track.
        </p>
      </header>

      <Card className="border-border/60">
        <CardContent className="space-y-4 p-6">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Add a target
          </h2>

          <div className="flex flex-wrap gap-2">
            {PRESETS.map(p => (
              <Button
                key={p.label}
                size="sm"
                variant="outline"
                onClick={() => applyPreset(p)}
                className="text-xs"
              >
                {p.label}
              </Button>
            ))}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="metric">Metric</Label>
              <Select value={metricKey} onValueChange={v => setMetricKey(v as MetricKey)}>
                <SelectTrigger id="metric">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_METRIC_KEYS.map(k => (
                    <SelectItem key={k} value={k}>
                      {METRIC_DEFINITIONS[k].label} ({METRIC_DEFINITIONS[k].unit})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseline-value">Baseline value</Label>
              <Input
                id="baseline-value"
                type="number"
                value={baselineValue}
                onChange={e => setBaselineValue(e.target.value)}
                placeholder="e.g. 1200"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="baseline-date">Baseline date</Label>
              <Input
                id="baseline-date"
                type="date"
                value={baselineDate}
                onChange={e => setBaselineDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-value">Target value</Label>
              <Input
                id="target-value"
                type="number"
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder="e.g. 600"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-date">Target date</Label>
              <Input
                id="target-date"
                type="date"
                value={targetDate}
                onChange={e => setTargetDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Input
                id="notes"
                value={notes}
                onChange={e => setNotes(e.target.value)}
                placeholder="e.g. SBTi-validated, board-approved Q1 2026"
              />
            </div>
          </div>

          {error && (
            <p className="rounded-md border border-amber-500/30 bg-amber-500/5 px-3 py-2 text-xs text-amber-600 dark:text-amber-300">
              {error}
            </p>
          )}

          <div className="flex justify-end">
            <Button onClick={createTarget} disabled={creating || !baselineValue || !targetValue}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Set target
            </Button>
          </div>
        </CardContent>
      </Card>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active targets
        </h2>
        {loading ? (
          <p className="text-sm text-muted-foreground">Loading…</p>
        ) : targets.length === 0 ? (
          <Card className="border-dashed border-border/60">
            <CardContent className="p-6 text-sm text-muted-foreground">
              No active targets yet.
            </CardContent>
          </Card>
        ) : (
          <ul className="space-y-2">
            {targets.map(t => {
              const def = METRIC_DEFINITIONS[t.metric_key];
              return (
                <li key={t.id}>
                  <Card className="border-border/60">
                    <CardContent className="flex items-center justify-between gap-4 p-4">
                      <div>
                        <p className="text-sm font-medium text-foreground">
                          {def?.label ?? t.metric_key} → {t.target_value.toLocaleString('en-GB')}{' '}
                          {def?.unit ?? ''} by {t.target_date}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Baseline {t.baseline_value.toLocaleString('en-GB')} {def?.unit ?? ''} on{' '}
                          {t.baseline_date}
                          {t.notes ? ` · ${t.notes}` : ''}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => deleteTarget(t.id)}
                        className="text-muted-foreground hover:text-red-500"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </CardContent>
                  </Card>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
