'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
import { Plus, Trash2, TrendingUp, TrendingDown, Sprout, Info } from 'lucide-react';
import { StateChip } from '@/components/studio/state-chip';
import type { WorkingTone } from '@/components/studio/theme';
import { toast } from 'sonner';
import {
  computeAnnualStockChange,
  type SoilCarbonSample,
} from '@/lib/soil-carbon';
import type { LandUnitType } from '@/lib/soil-carbon-server';

interface SampleRow extends SoilCarbonSample {
  id: string;
}

interface Props {
  landUnitType: LandUnitType;
  landUnitId: string;
  /** Practice-based default (kg CO2e/ha/yr) shown in the estimate→measured nudge. */
  practiceDefaultKgPerHa?: number;
  practiceLabel?: string;
  /** Fired whenever the computed measured change changes, so the host can refresh. */
  onChangeComputed?: () => void;
}

const VERIFICATION_OPTIONS = [
  { value: 'unverified', label: 'Not verified' },
  { value: 'pending', label: 'Verification pending' },
  { value: 'verified', label: 'Third-party verified' },
];

const CONFIDENCE_TONE: Record<string, WorkingTone> = {
  HIGH: 'good',
  MEDIUM: 'attention',
  LOW: 'stale',
};

const emptyDraft = {
  sample_date: '',
  depth_cm: 30,
  soc_input_method: 'stock' as 'stock' | 'concentration',
  soc_stock_tc_ha: '' as string,
  soc_concentration_pct: '' as string,
  bulk_density_g_cm3: '' as string,
  sampling_points: '' as string,
  lab_name: '',
  methodology: '',
  verification_status: 'unverified',
};

export function SoilCarbonSamplesPanel({
  landUnitType,
  landUnitId,
  practiceDefaultKgPerHa,
  practiceLabel,
  onChangeComputed,
}: Props) {
  const [samples, setSamples] = useState<SampleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState({ ...emptyDraft });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(
        `/api/soil-carbon/samples?land_unit_type=${landUnitType}&land_unit_id=${landUnitId}`,
      );
      const json = await res.json();
      if (res.ok) setSamples((json.data ?? []) as SampleRow[]);
    } finally {
      setLoading(false);
    }
  }, [landUnitType, landUnitId]);

  useEffect(() => {
    void load();
  }, [load]);

  const change = useMemo(() => computeAnnualStockChange(samples), [samples]);

  const resetDraft = () => {
    setDraft({ ...emptyDraft });
    setAdding(false);
  };

  const saveDraft = async () => {
    if (!draft.sample_date) {
      toast.error('Add the date the sample was taken.');
      return;
    }
    if (draft.soc_input_method === 'stock' && !draft.soc_stock_tc_ha) {
      toast.error('Enter the measured SOC stock (tonnes C per hectare).');
      return;
    }
    if (
      draft.soc_input_method === 'concentration' &&
      (!draft.soc_concentration_pct || !draft.bulk_density_g_cm3)
    ) {
      toast.error('Enter both the SOC concentration and the bulk density.');
      return;
    }
    setSaving(true);
    try {
      const res = await fetch('/api/soil-carbon/samples', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          land_unit_type: landUnitType,
          land_unit_id: landUnitId,
          sample_date: draft.sample_date,
          depth_cm: Number(draft.depth_cm),
          soc_input_method: draft.soc_input_method,
          soc_stock_tc_ha: draft.soc_stock_tc_ha ? Number(draft.soc_stock_tc_ha) : null,
          soc_concentration_pct: draft.soc_concentration_pct ? Number(draft.soc_concentration_pct) : null,
          bulk_density_g_cm3: draft.bulk_density_g_cm3 ? Number(draft.bulk_density_g_cm3) : null,
          sampling_points: draft.sampling_points ? Number(draft.sampling_points) : null,
          lab_name: draft.lab_name || null,
          methodology: draft.methodology || null,
          verification_status: draft.verification_status,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        toast.error(j.error || 'Could not save the measurement.');
        return;
      }
      toast.success('Soil carbon measurement saved.');
      resetDraft();
      await load();
      onChangeComputed?.();
    } finally {
      setSaving(false);
    }
  };

  const remove = async (id: string) => {
    const res = await fetch(`/api/soil-carbon/samples/${id}`, { method: 'DELETE' });
    if (res.ok) {
      toast.success('Measurement removed.');
      await load();
      onChangeComputed?.();
    } else {
      toast.error('Could not remove the measurement.');
    }
  };

  if (loading) {
    return (
      <div className="py-4 text-sm text-muted-foreground">Loading measurements…</div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Computed change headline */}
      {change.methodology === 'measured_stock_change' && (
        <div className="rounded-[6px] border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
            {change.is_loss ? (
              <TrendingDown className="h-4 w-4 text-studio-stale" />
            ) : (
              <TrendingUp className="h-4 w-4 text-studio-good" />
            )}
            Measured soil carbon trajectory
            {change.confidence && (
              <StateChip tone={CONFIDENCE_TONE[change.confidence]}>
                {change.confidence} confidence
              </StateChip>
            )}
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {change.baseline_stock_tc_ha?.toFixed(1)} → {change.latest_stock_tc_ha?.toFixed(1)} tC/ha
            over {change.years_elapsed?.toFixed(1)} years.{' '}
            <span className="font-medium text-foreground">
              {change.is_loss
                ? 'Soil carbon has declined; this counts as a removal of zero.'
                : `${Math.round(change.annual_kg_co2e_per_ha).toLocaleString()} kg CO2e/ha/yr removal`}
            </span>
            {change.discount_applied > 0 && !change.is_loss && (
              <span> (after a {Math.round(change.discount_applied * 100)}% conservatism discount)</span>
            )}
            .
          </p>
        </div>
      )}

      {/* Estimate → measured nudge */}
      {change.methodology !== 'measured_stock_change' && (
        <div className="rounded-[6px] border border-border bg-card p-4">
          <div className="flex items-center gap-2 text-sm font-medium text-foreground">
            <Sprout className="h-4 w-4 text-studio-forest" /> Move from estimate to measured
          </div>
          <p className="mt-1.5 text-xs text-muted-foreground">
            {change.methodology === 'baseline_only'
              ? 'Baseline recorded. Re-measure at the same depth and lab in a few years to claim the measured change in soil carbon.'
              : practiceDefaultKgPerHa != null
                ? `Currently using the practice-based default${practiceLabel ? ` for ${practiceLabel}` : ''} (${practiceDefaultKgPerHa} kg CO2e/ha/yr). Add repeated soil samples to claim your measured trajectory instead.`
                : 'Add repeated soil samples (same depth, same lab) to claim a measured soil carbon trajectory.'}
          </p>
          {change.warning && (
            <p className="mt-1.5 flex items-start gap-1.5 text-xs text-studio-attention">
              <Info className="mt-0.5 h-3 w-3 shrink-0" /> {change.warning}
            </p>
          )}
        </div>
      )}

      {/* Sample list */}
      {samples.length > 0 && (
        <div className="space-y-2">
          {samples.map((s) => {
            const stock =
              s.soc_input_method === 'stock'
                ? Number(s.soc_stock_tc_ha)
                : Number(s.soc_concentration_pct) * Number(s.bulk_density_g_cm3) * Number(s.depth_cm);
            return (
              <div
                key={s.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border bg-background px-3 py-2 text-sm"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="font-medium text-foreground">{s.sample_date}</span>
                  <span className="text-muted-foreground">{stock.toFixed(1)} tC/ha</span>
                  <span className="text-xs text-muted-foreground">{s.depth_cm} cm</span>
                  {s.verification_status === 'verified' && (
                    <StateChip tone="good">Verified</StateChip>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(s.id)}
                  className="h-7 w-7 p-0 text-muted-foreground hover:text-studio-stale"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div className="space-y-3 rounded-[6px] border border-border bg-card p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sample date</Label>
              <Input
                type="date"
                value={draft.sample_date}
                onChange={(e) => setDraft({ ...draft, sample_date: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Sampling depth (cm)</Label>
              <Input
                type="number"
                min={1}
                value={draft.depth_cm}
                onChange={(e) => setDraft({ ...draft, depth_cm: Number(e.target.value) })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">How was it measured?</Label>
            <Select
              value={draft.soc_input_method}
              onValueChange={(v) => setDraft({ ...draft, soc_input_method: v as 'stock' | 'concentration' })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="stock">SOC stock (tonnes C per hectare)</SelectItem>
                <SelectItem value="concentration">Lab values (concentration % + bulk density)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {draft.soc_input_method === 'stock' ? (
            <div>
              <Label className="text-xs">SOC stock (tonnes C / ha)</Label>
              <Input
                type="number"
                step="0.1"
                value={draft.soc_stock_tc_ha}
                onChange={(e) => setDraft({ ...draft, soc_stock_tc_ha: e.target.value })}
              />
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs">SOC concentration (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.soc_concentration_pct}
                  onChange={(e) => setDraft({ ...draft, soc_concentration_pct: e.target.value })}
                />
              </div>
              <div>
                <Label className="text-xs">Bulk density (g/cm³)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={draft.bulk_density_g_cm3}
                  onChange={(e) => setDraft({ ...draft, bulk_density_g_cm3: e.target.value })}
                />
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">Sampling points (optional)</Label>
              <Input
                type="number"
                value={draft.sampling_points}
                onChange={(e) => setDraft({ ...draft, sampling_points: e.target.value })}
              />
            </div>
            <div>
              <Label className="text-xs">Lab (optional)</Label>
              <Input
                value={draft.lab_name}
                onChange={(e) => setDraft({ ...draft, lab_name: e.target.value })}
              />
            </div>
          </div>

          <div>
            <Label className="text-xs">Verification</Label>
            <Select
              value={draft.verification_status}
              onValueChange={(v) => setDraft({ ...draft, verification_status: v })}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {VERIFICATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex justify-end gap-2">
            <Button type="button" variant="ghost" size="sm" onClick={resetDraft} disabled={saving}>
              Cancel
            </Button>
            <Button type="button" size="sm" onClick={saveDraft} disabled={saving}>
              {saving ? 'Saving…' : 'Save measurement'}
            </Button>
          </div>
        </div>
      ) : (
        <Button type="button" variant="outline" size="sm" onClick={() => setAdding(true)}>
          <Plus className="mr-1.5 h-3.5 w-3.5" /> Add soil carbon measurement
        </Button>
      )}
    </div>
  );
}
