'use client';

/**
 * Sales / service volumes — record how many of each hospitality product were
 * served over a period (manual add or CSV import). These feed the company total
 * via calculateHospitality. Shows each row's company contribution and the total.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { Plus, Upload, Trash2, BarChart3 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import type { HospitalityProductOption, ServiceVolumeRow, VolumeImportSummary } from '@/lib/hospitality/volume-types';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

const KIND_LABEL: Record<string, string> = {
  hospitality_meal: 'Meal',
  hospitality_drink: 'Drink',
  hospitality_room_night: 'Room',
};

export function SalesManager() {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [volumes, setVolumes] = useState<ServiceVolumeRow[]>([]);
  const [products, setProducts] = useState<HospitalityProductOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [addOpen, setAddOpen] = useState(false);
  const [productId, setProductId] = useState('');
  const [units, setUnits] = useState('');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [importResult, setImportResult] = useState<VolumeImportSummary | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/hospitality/volumes', { credentials: 'include' });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || 'Failed to load volumes');
      }
      const body = await res.json();
      setVolumes(body.volumes ?? []);
      setProducts(body.products ?? []);
      setError(null);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load volumes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const submitAdd = async () => {
    if (!productId) return setFormError('Pick a product.');
    setSubmitting(true);
    setFormError(null);
    try {
      const res = await fetch('/api/hospitality/volumes', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ product_id: Number(productId), units_sold: Number(units), period_start: start, period_end: end }),
      });
      if (!res.ok) {
        const b = await res.json().catch(() => ({}));
        throw new Error(b?.error || 'Could not add');
      }
      setAddOpen(false);
      setProductId('');
      setUnits('');
      await load();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : 'Could not add');
    } finally {
      setSubmitting(false);
    }
  };

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) e.target.value = '';
    if (!file) return;
    setImportResult(null);
    try {
      const csv = await file.text();
      const res = await fetch('/api/hospitality/volumes/import', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Import failed');
      setImportResult(body);
      toast({ title: `Imported ${body.inserted} row${body.inserted === 1 ? '' : 's'}` });
      await load();
    } catch (e: unknown) {
      toast({ title: 'Import failed', description: e instanceof Error ? e.message : '', variant: 'destructive' });
    }
  };

  const remove = async (id: string) => {
    try {
      const res = await fetch(`/api/hospitality/volumes/${id}`, { method: 'DELETE', credentials: 'include' });
      if (!res.ok) throw new Error('delete failed');
      await load();
    } catch {
      toast({ title: 'Could not remove row', variant: 'destructive' });
    }
  };

  const totalContribution = volumes.reduce((s, v) => s + (v.contribution_co2e ?? 0), 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <div>
          <h2 className="text-lg font-semibold">Sales &amp; volumes</h2>
          <p className="text-sm text-muted-foreground">
            How many of each meal, drink and room were served. This drives your company total.
          </p>
        </div>
        <div className="flex gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <Button variant="outline" onClick={() => fileRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Import CSV
          </Button>
          <Button onClick={() => { setFormError(null); setAddOpen(true); }} disabled={products.length === 0}>
            <Plus className="mr-2 h-4 w-4" />
            Add
          </Button>
        </div>
      </div>

      {error && <p className="text-sm text-destructive">{error}</p>}

      {importResult && (
        <div className="rounded-lg border bg-muted/40 p-3 text-sm">
          <p>Imported {importResult.inserted} row(s).</p>
          {importResult.unmatched.length > 0 && (
            <p className="text-muted-foreground">
              Unmatched product names (skipped): {importResult.unmatched.map((u) => `"${u.product}"`).join(', ')}
            </p>
          )}
          {importResult.errors.length > 0 && (
            <p className="text-destructive">{importResult.errors.join('; ')}</p>
          )}
        </div>
      )}

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
          <BarChart3 className="h-4 w-4 text-primary" />
          <CardTitle className="text-sm font-medium text-muted-foreground">
            Recorded contribution to company total
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-2xl font-semibold">{fmt(totalContribution)} kg CO₂e</p>
          <p className="text-xs text-muted-foreground">across {volumes.length} volume row(s)</p>
        </CardContent>
      </Card>

      {loading ? (
        <Skeleton className="h-40 w-full rounded-lg" />
      ) : volumes.length === 0 ? (
        <div className="rounded-lg border border-dashed py-12 text-center">
          <p className="font-medium">No volumes yet</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Add how many covers, drinks and room-nights you served, or import a CSV
            (columns: product, units, period_start, period_end).
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="p-2 font-medium">Product</th>
                <th className="p-2 font-medium">Period</th>
                <th className="p-2 text-right font-medium">Units</th>
                <th className="p-2 text-right font-medium">Contribution</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.id} className="border-t">
                  <td className="p-2">
                    <span className="font-medium">{v.product_name}</span>{' '}
                    <Badge variant="outline" className="ml-1 text-[10px]">{KIND_LABEL[v.product_kind] ?? v.product_kind}</Badge>
                  </td>
                  <td className="p-2 text-muted-foreground">{v.period_start} → {v.period_end}</td>
                  <td className="p-2 text-right">{fmt(v.units_sold, 0)}</td>
                  <td className="p-2 text-right font-medium">
                    {v.contribution_co2e != null ? `${fmt(v.contribution_co2e)} kg` : '—'}
                  </td>
                  <td className="p-2 text-right">
                    <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => remove(v.id)} aria-label="Remove">
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
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
            <DialogTitle>Add service volume</DialogTitle>
            <DialogDescription>How many of a product were served over a period.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="vol-product">Product</Label>
              <Select value={productId} onValueChange={setProductId}>
                <SelectTrigger id="vol-product">
                  <SelectValue placeholder="Choose…" />
                </SelectTrigger>
                <SelectContent>
                  {products.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.name} ({KIND_LABEL[p.product_kind] ?? p.product_kind})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="vol-units">Units sold</Label>
              <Input id="vol-units" type="number" min="0" step="1" value={units} onChange={(e) => setUnits(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="vol-start">Period start</Label>
                <Input id="vol-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="vol-end">Period end</Label>
                <Input id="vol-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
              </div>
            </div>
            {formError && <p className="text-xs text-destructive">{formError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>Cancel</Button>
            <Button onClick={submitAdd} disabled={submitting}>{submitting ? 'Adding…' : 'Add'}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
