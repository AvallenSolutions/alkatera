'use client';

import { useState } from 'react';
import { Loader2 } from 'lucide-react';
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

export const TARGET_PRESETS = [
  { label: 'SBTi 1.5°C: -42% absolute scope 1+2 by 2030', metric: 'total_co2e', factor: 0.58, year: 2030, methodology: 'SBTi 1.5C aligned' },
  { label: 'Net zero scope 1+2 by 2040', metric: 'total_co2e', factor: 0, year: 2040, methodology: 'Net zero commitment' },
  { label: '100% LCA coverage by 2027', metric: 'lca_completeness_pct', factor: 100, year: 2027, methodology: 'Internal coverage goal' },
] as const;

interface TargetFormProps {
  organizationId: string;
  onCreated: () => Promise<void> | void;
  onMetricKeyChange?: (key: MetricKey) => void;
}

/**
 * Create-a-target form with SBTi presets. Extracted unchanged from the
 * original targets page, plus a method field so the target carries the
 * standard behind it (this is what strengthens B Corp Climate Commitment
 * evidence).
 */
export function TargetForm({ organizationId, onCreated, onMetricKeyChange }: TargetFormProps) {
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [metricKey, setMetricKey] = useState<MetricKey>('total_co2e');
  const [baselineValue, setBaselineValue] = useState('');
  const [baselineDate, setBaselineDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetValue, setTargetValue] = useState('');
  const [targetDate, setTargetDate] = useState('2030-12-31');
  const [methodology, setMethodology] = useState('');
  const [notes, setNotes] = useState('');

  function changeMetric(key: MetricKey) {
    setMetricKey(key);
    onMetricKeyChange?.(key);
  }

  function applyPreset(preset: (typeof TARGET_PRESETS)[number]) {
    changeMetric(preset.metric as MetricKey);
    setTargetDate(`${preset.year}-12-31`);
    setMethodology(preset.methodology);
    if (baselineValue) {
      const baseline = Number(baselineValue);
      const newTarget =
        preset.factor === 100 ? 100 : Number((baseline * preset.factor).toFixed(2));
      setTargetValue(String(newTarget));
    }
  }

  async function createTarget() {
    setCreating(true);
    setError(null);
    const res = await fetch('/api/pulse/targets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        organization_id: organizationId,
        metric_key: metricKey,
        baseline_value: Number(baselineValue),
        baseline_date: baselineDate,
        target_value: Number(targetValue),
        target_date: targetDate,
        methodology: methodology || null,
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
    setMethodology('');
    setNotes('');
    await onCreated();
    setCreating(false);
  }

  return (
    <Card className="border-border/60">
      <CardContent className="space-y-4 p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Add a target
        </h2>

        <div className="flex flex-wrap gap-2">
          {TARGET_PRESETS.map(p => (
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
            <Select value={metricKey} onValueChange={v => changeMetric(v as MetricKey)}>
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
          <div className="space-y-1.5">
            <Label htmlFor="methodology">Method (optional)</Label>
            <Input
              id="methodology"
              value={methodology}
              onChange={e => setMethodology(e.target.value)}
              placeholder="e.g. SBTi 1.5C aligned"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2 lg:col-span-3">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. board-approved Q1 2026"
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
  );
}
