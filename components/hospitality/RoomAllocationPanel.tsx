'use client';

/**
 * Room-night energy/water allocation panel.
 *
 * Shows the per-night allocated electricity/gas/water (converted to CO2e) and
 * the per-night TOTAL = consumables (from the recipe above) + allocated. The
 * allocated portion is clearly flagged as already counted in the venue's
 * facility Scope 1/2 — it is shown for guest-facing intensity only and is not
 * re-added to the company total.
 */

import { useCallback, useEffect, useState } from 'react';
import { Wand2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import { useToast } from '@/hooks/use-toast';
import type { AllocatedImpact, RoomAllocationInput } from '@/lib/hospitality/room-allocation';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

export function RoomAllocationPanel({
  roomId,
  consumablesCo2e,
}: {
  roomId: string;
  consumablesCo2e: number | null;
}) {
  const { toast } = useToast();
  const [alloc, setAlloc] = useState<RoomAllocationInput | null>(null);
  const [impact, setImpact] = useState<AllocatedImpact | null>(null);
  const [saving, setSaving] = useState(false);
  const [deriving, setDeriving] = useState(false);
  const [provenance, setProvenance] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/hospitality/rooms/${roomId}/allocation`, { credentials: 'include' });
      if (!res.ok) return;
      const body = await res.json();
      setAlloc(body.allocation);
      setImpact(body.impact);
    } catch {
      /* ignore */
    }
  }, [roomId]);

  useEffect(() => {
    load();
  }, [load]);

  const set = (patch: Partial<RoomAllocationInput>) => setAlloc((a) => (a ? { ...a, ...patch } : a));

  const derive = async () => {
    setDeriving(true);
    setError(null);
    setProvenance(null);
    try {
      const res = await fetch(`/api/hospitality/rooms/${roomId}/allocation/derive`, { credentials: 'include' });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || 'Could not derive from facility data');
      if (!body.occupied_nights) {
        setError('No room-nights sold in the last year, so a per-night figure could not be worked out. Log service volumes for this room first, or enter the amounts manually.');
        return;
      }
      set({
        electricity_kwh: Number(body.electricity_kwh.toFixed(3)),
        gas_kwh: Number(body.gas_kwh.toFixed(3)),
        water_litres: Number(body.water_litres.toFixed(1)),
      });
      const nights = Math.round(body.occupied_nights);
      setProvenance(
        `Suggested from the venue's facility utilities over the last 12 months ÷ ${nights.toLocaleString('en-GB')} room-nights sold${body.water_metered ? ' (water from a hospitality meter)' : ''}. Review, then save.`,
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not derive from facility data');
    } finally {
      setDeriving(false);
    }
  };

  const save = async () => {
    if (!alloc) return;
    setSaving(true);
    setError(null);
    try {
      const res = await fetch(`/api/hospitality/rooms/${roomId}/allocation`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(alloc),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not save allocation');
      }
      const body = await res.json();
      setAlloc(body.allocation);
      setImpact(body.impact);
      toast({ title: 'Allocation saved' });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save allocation');
    } finally {
      setSaving(false);
    }
  };

  if (!alloc || !impact) return null;

  const allocated = impact.total_co2e;
  const consumables = consumablesCo2e ?? 0;
  const total = consumables + allocated;

  return (
    <section className="border-t border-border pt-5">
      <Eyebrow className="mb-4">Allocated energy &amp; water</Eyebrow>
      <div className="space-y-4">
        <p className="max-w-xl text-sm text-muted-foreground">
          Energy and water used per room-night. Enter the amount allocated to one night, or derive it
          from the venue&apos;s facility utilities ÷ room-nights sold.
        </p>

        <div className="flex flex-wrap items-center gap-2">
          <PillButton variant="outline" size="sm" onClick={derive} disabled={deriving}>
            <Wand2 className="h-4 w-4" />
            {deriving ? 'Deriving…' : 'Derive from facility data'}
          </PillButton>
          {provenance && <span className="text-xs text-muted-foreground">{provenance}</span>}
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="space-y-1">
            <Label htmlFor="alloc-occupancy">Occupancy (guests)</Label>
            <Input id="alloc-occupancy" type="number" min="1" step="1" value={alloc.occupancy}
              onChange={(e) => set({ occupancy: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alloc-elec">Electricity (kWh)</Label>
            <Input id="alloc-elec" type="number" min="0" step="any" value={alloc.electricity_kwh}
              onChange={(e) => set({ electricity_kwh: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alloc-gas">Gas (kWh)</Label>
            <Input id="alloc-gas" type="number" min="0" step="any" value={alloc.gas_kwh}
              onChange={(e) => set({ gas_kwh: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alloc-water">Water (litres)</Label>
            <Input id="alloc-water" type="number" min="0" step="any" value={alloc.water_litres}
              onChange={(e) => set({ water_litres: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alloc-laundry">Laundry (kWh)</Label>
            <Input id="alloc-laundry" type="number" min="0" step="any" value={alloc.laundry_kwh}
              onChange={(e) => set({ laundry_kwh: Number(e.target.value) })} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="alloc-country">Grid country</Label>
            <Input id="alloc-country" maxLength={3} value={alloc.country}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })} />
          </div>
        </div>

        {error && <p className="text-sm text-studio-stale">{error}</p>}

        <div className="flex items-center gap-2">
          <PillButton variant="outline" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save allocation'}
          </PillButton>
        </div>

        <div className="border-y border-border py-4">
          <div className="flex flex-wrap items-end gap-x-12 gap-y-4">
            <BigNumber value={fmt(consumables)} label="KG CO₂E CONSUMABLES" />
            <BigNumber value={fmt(allocated)} label="KG CO₂E ALLOCATED" />
            <BigNumber value={fmt(total)} label="KG CO₂E TOTAL / NIGHT" tone="room" />
            {alloc.occupancy > 0 && (
              <BigNumber value={fmt(total / alloc.occupancy)} label="KG CO₂E PER GUEST" />
            )}
          </div>
          <p className="mt-3 max-w-xl text-xs text-muted-foreground">
            Allocated energy &amp; water is already counted in the venue&apos;s facility (Scope 1/2),
            so it&apos;s shown for per-night intensity only: only the consumables are added to your
            company total.
          </p>
        </div>
      </div>
    </section>
  );
}
