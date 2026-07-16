'use client';

/**
 * Covers served + F&B revenue per period — the inputs behind the carbon-intensity
 * KPIs (per cover, per £, per room-night) on the hospitality dashboard.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';

interface Period {
  id: string;
  period_start: string;
  period_end: string;
  covers: number;
  fnb_revenue: number;
  currency: string;
}

function fmt(n: number) {
  return n.toLocaleString('en-GB', { maximumFractionDigits: 0 });
}

export function OperatingPeriodsCard() {
  const { toast } = useToast();
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [covers, setCovers] = useState('');
  const [revenue, setRevenue] = useState('');
  const [currency, setCurrency] = useState('GBP');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hospitality/operating-periods', { credentials: 'include' });
      if (res.ok) setPeriods((await res.json()).periods ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const add = async () => {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch('/api/hospitality/operating-periods', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ period_start: start, period_end: end, covers: Number(covers), fnb_revenue: Number(revenue), currency }),
      });
      if (!res.ok) throw new Error((await res.json().catch(() => ({})))?.error || 'Could not save');
      setCovers('');
      setRevenue('');
      toast({ title: 'Operating data saved' });
      await load();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Could not save');
    } finally {
      setBusy(false);
    }
  };

  const remove = async (id: string) => {
    await fetch(`/api/hospitality/operating-periods/${id}`, { method: 'DELETE', credentials: 'include' });
    setPeriods((prev) => prev.filter((p) => p.id !== id));
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center gap-2 space-y-0">
        <Users className="h-5 w-5" />
        <CardTitle className="text-base">Covers &amp; revenue</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <p className="text-sm text-muted-foreground">
          Total covers served and F&amp;B revenue per period. These power the carbon-per-cover and
          carbon-per-revenue intensity figures on your dashboard.
        </p>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="space-y-1">
            <Label htmlFor="op-start" className="text-xs">Start</Label>
            <Input id="op-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-end" className="text-xs">End</Label>
            <Input id="op-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-covers" className="text-xs">Covers</Label>
            <Input id="op-covers" type="number" min="0" step="1" value={covers} onChange={(e) => setCovers(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-rev" className="text-xs">F&amp;B revenue</Label>
            <Input id="op-rev" type="number" min="0" step="any" value={revenue} onChange={(e) => setRevenue(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="op-cur" className="text-xs">Currency</Label>
            <Input id="op-cur" maxLength={3} value={currency} onChange={(e) => setCurrency(e.target.value.toUpperCase())} />
          </div>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Button size="sm" onClick={add} disabled={busy || !start || !end}>
          <Plus className="mr-2 h-4 w-4" />
          {busy ? 'Saving…' : 'Add period'}
        </Button>

        {!loading && periods.length > 0 && (
          <div className="divide-y rounded-lg border">
            {periods.map((p) => (
              <div key={p.id} className="flex items-center justify-between gap-2 p-2 text-sm">
                <span className="text-muted-foreground">{p.period_start} → {p.period_end}</span>
                <span className="flex items-center gap-3">
                  <span>{fmt(p.covers)} covers</span>
                  <span>{p.currency} {fmt(p.fnb_revenue)}</span>
                  <Button variant="ghost" size="icon" className="h-6 w-6 text-destructive" onClick={() => remove(p.id)} aria-label="Delete">
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
