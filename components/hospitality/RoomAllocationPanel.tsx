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
import { Zap, Info } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Zap className="h-5 w-5" />
        <CardTitle className="text-base">Allocated energy &amp; water</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Energy and water used per room-night. Enter the amount allocated to one night (e.g. the
          venue&apos;s annual utilities ÷ occupied room-nights).
        </p>

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
            <Label htmlFor="alloc-country">Grid country</Label>
            <Input id="alloc-country" maxLength={3} value={alloc.country}
              onChange={(e) => set({ country: e.target.value.toUpperCase() })} />
          </div>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : 'Save allocation'}
          </Button>
        </div>

        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <div className="grid grid-cols-2 gap-1 sm:grid-cols-4">
            <div>
              <p className="text-muted-foreground">Consumables</p>
              <p className="font-semibold">{fmt(consumables)} kg CO₂e</p>
            </div>
            <div>
              <p className="text-muted-foreground">Allocated energy/water</p>
              <p className="font-semibold">{fmt(allocated)} kg CO₂e</p>
            </div>
            <div className="col-span-2">
              <p className="text-muted-foreground">Total per night</p>
              <p className="text-lg font-semibold">{fmt(total)} kg CO₂e</p>
            </div>
          </div>
          <p className="mt-2 flex items-start gap-1.5 text-xs text-muted-foreground">
            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Allocated energy &amp; water is already counted in the venue&apos;s facility (Scope 1/2),
            so it&apos;s shown for per-night intensity only — only the consumables are added to your
            company total.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
