'use client';

/**
 * Waste log — record food waste and dry waste sent off site per period and venue,
 * with the treatment route. CO2e is derived from DEFRA waste factors and feeds the
 * hospitality footprint (Scope 3 Cat 5). Food and dry are tracked separately.
 */

import { useCallback, useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { useHospitalityVenues } from '@/hooks/data/useHospitalityVenues';
import {
  FOOD_TREATMENTS,
  DRY_TREATMENTS,
  TREATMENT_LABELS,
  DIVERTED_TREATMENTS,
  type HospitalityWasteRow,
  type WasteStream,
  type WasteTreatment,
} from '@/lib/hospitality/waste-types';

const NO_VENUE = '__none__';

function fmt(n: number, digits = 1): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

export function WasteManager() {
  const { toast } = useToast();
  const { venues } = useHospitalityVenues();
  const [rows, setRows] = useState<HospitalityWasteRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [stream, setStream] = useState<WasteStream>('food');
  const [treatment, setTreatment] = useState<WasteTreatment>('anaerobic_digestion');
  const [mass, setMass] = useState('');
  const [venueId, setVenueId] = useState<string>(NO_VENUE);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hospitality/waste', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load waste');
      const body = await res.json();
      setRows(body.waste ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load waste');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const treatmentsForStream = stream === 'food' ? FOOD_TREATMENTS : DRY_TREATMENTS;

  const openAdd = () => {
    setStream('food');
    setTreatment('anaerobic_digestion');
    setMass('');
    setVenueId(NO_VENUE);
    setFormError(null);
    setAddOpen(true);
  };

  const onStreamChange = (s: WasteStream) => {
    setStream(s);
    setTreatment(s === 'food' ? 'anaerobic_digestion' : 'recycling');
  };

  const submit = async () => {
    const massNum = Number(mass);
    if (!Number.isFinite(massNum) || massNum < 0) return setFormError('Enter a weight in kg.');
    if (!start || !end) return setFormError('Set the period dates.');
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/hospitality/waste', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          waste_stream: stream,
          treatment_method: treatment,
          mass_kg: massNum,
          period_start: start,
          period_end: end,
          venue_id: venueId === NO_VENUE ? null : venueId,
        }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || 'Could not add');
      }
      setAddOpen(false);
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setSubmitting(false);
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/hospitality/waste/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('delete failed');
      await load();
    } catch {
      toast({ title: 'Could not remove row', variant: 'destructive' });
    }
  };

  const foodKg = rows.filter((r) => r.waste_stream === 'food').reduce((s, r) => s + r.mass_kg, 0);
  const dryKg = rows.filter((r) => r.waste_stream === 'dry').reduce((s, r) => s + r.mass_kg, 0);
  const totalKg = foodKg + dryKg;
  const divertedKg = rows.filter((r) => DIVERTED_TREATMENTS.includes(r.treatment_method)).reduce((s, r) => s + r.mass_kg, 0);
  const diversion = totalKg > 0 ? (divertedKg / totalKg) * 100 : 0;
  const totalCo2e = rows.reduce((s, r) => s + r.co2e, 0);

  return (
    <div className="space-y-8">
      <div className="min-w-0">
        <Statement eyebrow="THE WORKBENCH · WASTE" headline="The waste.">
          <BigNumber size="display" value={fmt(totalCo2e, 0)} label="KG CO₂E" />
          <PillButton variant="room" onClick={openAdd}>
            Log waste
          </PillButton>
        </Statement>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          Log food waste and dry waste sent off site, with how it&apos;s treated. This feeds your footprint.
        </p>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      <div className="flex flex-wrap items-end gap-x-12 gap-y-4 border-y border-border py-4">
        <BigNumber value={fmt(foodKg, 0)} label="KG FOOD WASTE" />
        <BigNumber value={fmt(dryKg, 0)} label="KG DRY WASTE" />
        <BigNumber value={`${fmt(diversion, 0)}%`} label="DIVERTED FROM DISPOSAL" />
      </div>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-[6px]" />
      ) : rows.length === 0 ? (
        <div>
          <p className="text-sm text-muted-foreground">
            No waste logged yet. Log food and dry waste by period to track diversion and emissions.
          </p>
        </div>
      ) : (
        <div>
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                <th className="py-2 pr-2 font-bold">Stream</th>
                <th className="p-2 font-bold">Treatment</th>
                <th className="p-2 font-bold">Venue</th>
                <th className="p-2 font-bold">Period</th>
                <th className="p-2 text-right font-bold">Weight</th>
                <th className="p-2 text-right font-bold">CO₂e</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border">
                  <td className="py-2 pr-2 font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                    {r.waste_stream}
                  </td>
                  <td className="p-2">{TREATMENT_LABELS[r.treatment_method]}</td>
                  <td className="p-2 text-muted-foreground">{r.venue_name ?? '–'}</td>
                  <td className="p-2 font-mono text-xs text-muted-foreground">{r.period_start} → {r.period_end}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(r.mass_kg, 0)} kg</td>
                  <td className="p-2 text-right font-semibold tabular-nums">{fmt(r.co2e, 1)} kg</td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      aria-label="Remove waste row"
                      className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
                      onClick={() => remove(r.id)}
                    >
                      &times;
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Log waste</DialogTitle>
            <DialogDescription>How much waste left site over a period, and how it was treated.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="w-stream">Stream</Label>
                <Select value={stream} onValueChange={(v) => onStreamChange(v as WasteStream)}>
                  <SelectTrigger id="w-stream"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="food">Food waste</SelectItem>
                    <SelectItem value="dry">Dry waste</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-mass">Weight (kg)</Label>
                <Input id="w-mass" type="number" min="0" step="any" value={mass} onChange={(e) => setMass(e.target.value)} />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="w-treatment">Treatment</Label>
              <Select value={treatment} onValueChange={(v) => setTreatment(v as WasteTreatment)}>
                <SelectTrigger id="w-treatment"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {treatmentsForStream.map((t) => (
                    <SelectItem key={t} value={t}>{TREATMENT_LABELS[t]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="w-venue">Venue (optional)</Label>
              <Select value={venueId} onValueChange={setVenueId}>
                <SelectTrigger id="w-venue"><SelectValue placeholder="No venue" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value={NO_VENUE}>No venue</SelectItem>
                  {venues.map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="w-start">Period start</Label>
                <Input id="w-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="w-end">Period end</Label>
                <Input id="w-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submit} disabled={submitting}>{submitting ? 'Saving…' : 'Log waste'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
