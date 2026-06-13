'use client';

import { useEffect, useState } from 'react';
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
import { cn } from '@/lib/utils';
import { supabase } from '@/lib/supabaseClient';
import { ALL_METRIC_KEYS, METRIC_DEFINITIONS, type MetricKey } from '@/lib/pulse/metric-keys';

const REDUCTION_CHIPS = [10, 20, 30, 42, 50];

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
  const [fieldErrors, setFieldErrors] = useState<{ baselineValue?: string; targetDate?: string }>({});

  const [metricKey, setMetricKey] = useState<MetricKey>('total_co2e');
  const [baselineValue, setBaselineValue] = useState('');
  const [baselineDate, setBaselineDate] = useState(new Date().toISOString().slice(0, 10));
  const [targetValue, setTargetValue] = useState('');
  const [targetDate, setTargetDate] = useState('2030-12-31');
  const [methodology, setMethodology] = useState('');
  const [notes, setNotes] = useState('');

  // Baseline prefill: the latest recorded value for the chosen metric (the
  // same daily snapshots the trajectory forecast uses). The user can always
  // type over it; once they have, we stop auto-filling.
  const [baselineTouched, setBaselineTouched] = useState(false);
  const [baselineSource, setBaselineSource] = useState<string | null>(null);

  // Target entry mode: an absolute number, or a percentage reduction from
  // the baseline. Reduction only makes sense for lower-is-better metrics.
  const [targetMode, setTargetMode] = useState<'absolute' | 'percent'>('absolute');
  const [reductionPct, setReductionPct] = useState('10');

  const metricDef = METRIC_DEFINITIONS[metricKey];
  const supportsReduction = !(metricDef?.higherIsBetter ?? false);

  useEffect(() => {
    let cancelled = false;
    setBaselineSource(null);
    (async () => {
      const { data } = await supabase
        .from('metric_snapshots')
        .select('snapshot_date, value')
        .eq('organization_id', organizationId)
        .eq('metric_key', metricKey)
        .order('snapshot_date', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled || !data) return;
      const formatted = new Date(data.snapshot_date as string).toLocaleDateString('en-GB', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
      });
      setBaselineSource(formatted);
      if (!baselineTouched) {
        setBaselineValue(String(Number(data.value)));
        setBaselineDate(String(data.snapshot_date));
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [organizationId, metricKey]);

  function changeMetric(key: MetricKey) {
    setMetricKey(key);
    onMetricKeyChange?.(key);
    if (METRIC_DEFINITIONS[key]?.higherIsBetter) setTargetMode('absolute');
  }

  /** The target value that will be saved, given the current entry mode. */
  function effectiveTargetValue(): number | null {
    if (targetMode === 'absolute') {
      return targetValue === '' ? null : Number(targetValue);
    }
    const baseline = Number(baselineValue);
    const pct = Number(reductionPct);
    if (!Number.isFinite(baseline) || !Number.isFinite(pct)) return null;
    return Number((baseline * (1 - pct / 100)).toFixed(2));
  }

  function applyPreset(preset: (typeof TARGET_PRESETS)[number]) {
    changeMetric(preset.metric as MetricKey);
    setTargetDate(`${preset.year}-12-31`);
    setMethodology(preset.methodology);
    setTargetMode('absolute');
    if (baselineValue) {
      const baseline = Number(baselineValue);
      const newTarget =
        preset.factor === 100 ? 100 : Number((baseline * preset.factor).toFixed(2));
      setTargetValue(String(newTarget));
    }
  }

  async function createTarget() {
    // Inline validation: positive baseline, and a target date after the
    // baseline date (the disabled guard already covers empty baseline/target).
    const errors: { baselineValue?: string; targetDate?: string } = {};
    const baselineNum = Number(baselineValue);
    if (!Number.isFinite(baselineNum) || baselineNum <= 0) {
      errors.baselineValue = 'Enter a baseline greater than zero.';
    }
    if (targetDate && baselineDate && targetDate <= baselineDate) {
      errors.targetDate = 'Target date must be after the baseline date.';
    }
    setFieldErrors(errors);
    if (Object.keys(errors).length > 0) return;

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
        target_value: effectiveTargetValue(),
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
    setBaselineTouched(false);
    setTargetValue('');
    setReductionPct('10');
    setTargetMode('absolute');
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
              onChange={e => {
                setBaselineTouched(true);
                setBaselineValue(e.target.value);
                setFieldErrors(prev => (prev.baselineValue ? { ...prev, baselineValue: undefined } : prev));
              }}
              placeholder="e.g. 1200"
              aria-invalid={!!fieldErrors.baselineValue}
            />
            {fieldErrors.baselineValue ? (
              <p className="text-xs font-medium text-destructive">{fieldErrors.baselineValue}</p>
            ) : (
              baselineSource && !baselineTouched && baselineValue !== '' && (
                <p className="text-xs text-muted-foreground">
                  Filled from your latest data ({baselineSource}). Type to change it.
                </p>
              )
            )}
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
            <div className="flex items-center justify-between">
              <Label htmlFor="target-value">Target</Label>
              {supportsReduction && (
                <div className="flex rounded-md border border-border/60 p-0.5">
                  <button
                    type="button"
                    onClick={() => setTargetMode('absolute')}
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                      targetMode === 'absolute' ? 'bg-[#ccff00]/20 text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    Value
                  </button>
                  <button
                    type="button"
                    onClick={() => setTargetMode('percent')}
                    className={cn(
                      'rounded px-2 py-0.5 text-[10px] font-medium transition-colors',
                      targetMode === 'percent' ? 'bg-[#ccff00]/20 text-foreground' : 'text-muted-foreground',
                    )}
                  >
                    % reduction
                  </button>
                </div>
              )}
            </div>
            {targetMode === 'absolute' ? (
              <Input
                id="target-value"
                type="number"
                value={targetValue}
                onChange={e => setTargetValue(e.target.value)}
                placeholder="e.g. 600"
              />
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center gap-1.5">
                  <Input
                    id="target-value"
                    type="number"
                    min={0}
                    max={100}
                    value={reductionPct}
                    onChange={e => setReductionPct(e.target.value)}
                    className="w-24"
                  />
                  <span className="text-sm text-muted-foreground">% less than baseline</span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {REDUCTION_CHIPS.map(pct => (
                    <button
                      key={pct}
                      type="button"
                      onClick={() => setReductionPct(String(pct))}
                      className={cn(
                        'rounded-full border px-2 py-0.5 text-[10px] font-medium transition-colors',
                        reductionPct === String(pct)
                          ? 'border-[#ccff00]/60 bg-[#ccff00]/15 text-foreground'
                          : 'border-border/60 text-muted-foreground hover:text-foreground',
                      )}
                    >
                      -{pct}%
                    </button>
                  ))}
                </div>
                {baselineValue !== '' && effectiveTargetValue() !== null && (
                  <p className="text-xs text-muted-foreground">
                    Works out at {effectiveTargetValue()!.toLocaleString('en-GB')} {metricDef?.unit ?? ''}
                  </p>
                )}
              </div>
            )}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="target-date">Target date</Label>
            <Input
              id="target-date"
              type="date"
              value={targetDate}
              onChange={e => {
                setTargetDate(e.target.value);
                setFieldErrors(prev => (prev.targetDate ? { ...prev, targetDate: undefined } : prev));
              }}
              aria-invalid={!!fieldErrors.targetDate}
            />
            {fieldErrors.targetDate && (
              <p className="text-xs font-medium text-destructive">{fieldErrors.targetDate}</p>
            )}
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
          <Button
            onClick={createTarget}
            loading={creating}
            disabled={creating || !baselineValue || effectiveTargetValue() === null}
          >
            Set target
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
