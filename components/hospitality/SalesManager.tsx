'use client';

/**
 * Sales / service volumes — record how many of each hospitality product were
 * served over a period (manual add or CSV import). These feed the company total
 * via calculateHospitality. Shows each row's company contribution and the total.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
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
import { PosSalesImportDialog } from '@/components/hospitality/PosSalesImportDialog';
import type { HospitalityProductOption, ServiceVolumeRow, VolumeImportSummary } from '@/lib/hospitality/volume-types';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

const KIND_LABEL: Record<string, string> = {
  hospitality_meal: 'Meal',
  hospitality_drink: 'Drink',
  hospitality_room_night: 'Room',
};

/** Quiet mono kind annotation: typographic, no badge pill. */
function KindTag({ kind }: { kind: string }) {
  return (
    <span className="ml-2 font-mono text-[9px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
      {KIND_LABEL[kind] ?? kind}
    </span>
  );
}

const DAY_MS = 86_400_000;

function addDays(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Inclusive day span between two YYYY-MM-DD dates. */
function periodLengthDays(start: string, end: string): number {
  return Math.round((Date.parse(`${end}T00:00:00Z`) - Date.parse(`${start}T00:00:00Z`)) / DAY_MS);
}

interface CopyRow {
  product_id: number;
  product_name: string;
  product_kind: string;
  units: string;
}

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
  // Unmatched CSV rows → chosen product id (string), so they can be resolved in-app.
  const [resolveMap, setResolveMap] = useState<Record<number, string>>({});
  const [resolving, setResolving] = useState(false);
  const [posOpen, setPosOpen] = useState(false);
  const [posStashId, setPosStashId] = useState<string | null>(null);
  const router = useRouter();
  const searchParams = useSearchParams();

  // Smart Upload handoff: a POS sales export was stashed and deep-linked here.
  useEffect(() => {
    if (searchParams.get('stash_kind') === 'pos_sales') {
      const id = searchParams.get('stash_id');
      if (id) {
        setPosStashId(id);
        setPosOpen(true);
      }
    }
  }, [searchParams]);

  // Copy from last period
  const [copyOpen, setCopyOpen] = useState(false);
  const [copyRows, setCopyRows] = useState<CopyRow[]>([]);
  const [copyStart, setCopyStart] = useState('');
  const [copyEnd, setCopyEnd] = useState('');
  const [copySubmitting, setCopySubmitting] = useState(false);
  const [copyError, setCopyError] = useState<string | null>(null);

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

  // Pull the most recent period's rows, advance the dates by the same duration,
  // and open an editable confirm grid — so a recurring period is one click + tweaks.
  const openCopy = () => {
    if (volumes.length === 0) return;
    // volumes arrive sorted by period_start desc; the latest period is the first row's.
    const latestStart = volumes[0].period_start;
    const latestEnd = volumes
      .filter((v) => v.period_start === latestStart)
      .reduce((max, v) => (v.period_end > max ? v.period_end : max), volumes[0].period_end);
    const rows = volumes.filter((v) => v.period_start === latestStart && v.period_end === latestEnd);
    if (rows.length === 0) return;
    const len = periodLengthDays(latestStart, latestEnd);
    setCopyRows(
      rows.map((v) => ({
        product_id: v.product_id,
        product_name: v.product_name,
        product_kind: v.product_kind,
        units: String(v.units_sold),
      })),
    );
    setCopyStart(addDays(latestEnd, 1));
    setCopyEnd(addDays(latestEnd, 1 + len));
    setCopyError(null);
    setCopyOpen(true);
  };

  const updateCopyUnits = (productId: number, units: string) =>
    setCopyRows((prev) => prev.map((r) => (r.product_id === productId ? { ...r, units } : r)));

  const submitCopy = async () => {
    const rows = copyRows
      .map((r) => ({ product_id: r.product_id, units_sold: Number(r.units) }))
      .filter((r) => Number.isFinite(r.units_sold) && r.units_sold >= 0);
    if (rows.length === 0) {
      setCopyError('Nothing to copy.');
      return;
    }
    setCopySubmitting(true);
    setCopyError(null);
    try {
      const results = await Promise.all(
        rows.map((r) =>
          fetch('/api/hospitality/volumes', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...r, period_start: copyStart, period_end: copyEnd }),
          }),
        ),
      );
      const failed = results.filter((res) => !res.ok).length;
      setCopyOpen(false);
      await load();
      toast({
        title: `Added ${rows.length - failed} volume row${rows.length - failed === 1 ? '' : 's'}`,
        description: failed > 0 ? `${failed} could not be added.` : undefined,
      });
    } catch (e: unknown) {
      setCopyError(e instanceof Error ? e.message : 'Could not copy.');
    } finally {
      setCopySubmitting(false);
    }
  };

  // Add the unmatched CSV rows the user mapped to a product, without re-uploading.
  const submitResolve = async () => {
    if (!importResult) return;
    const rows = (importResult.unmatched ?? [])
      .map((u) => ({ u, productId: resolveMap[u.row] }))
      .filter((x) => x.productId && x.u.units_sold != null);
    if (rows.length === 0) return;
    setResolving(true);
    try {
      const results = await Promise.all(
        rows.map(({ u, productId }) =>
          fetch('/api/hospitality/volumes', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              product_id: Number(productId),
              units_sold: u.units_sold,
              period_start: u.period_start,
              period_end: u.period_end,
            }),
          }),
        ),
      );
      const ok = results.filter((r) => r.ok).length;
      const failed = results.length - ok;
      // Drop the rows we resolved from the import summary.
      const resolvedRowNums = new Set(rows.map((x) => x.u.row));
      setImportResult((prev) =>
        prev ? { ...prev, unmatched: prev.unmatched.filter((u) => !resolvedRowNums.has(u.row)) } : prev,
      );
      await load();
      toast({
        title: `Added ${ok} row${ok === 1 ? '' : 's'}`,
        description: failed > 0 ? `${failed} could not be added (check the period/units).` : undefined,
        variant: failed > 0 ? 'destructive' : undefined,
      });
    } finally {
      setResolving(false);
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
      // Pre-select the best suggestion for each unmatched row.
      const seed: Record<number, string> = {};
      for (const u of body.unmatched ?? []) {
        if (u.suggestions?.[0]) seed[u.row] = String(u.suggestions[0].id);
      }
      setResolveMap(seed);
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
    <div className="space-y-8">
      <div className="min-w-0">
        <Statement eyebrow="THE WORKBENCH · SALES" headline="The sales.">
          <BigNumber size="display" value={fmt(totalContribution)} label="KG CO₂E RECORDED" />
          <BigNumber
            size="display"
            value={volumes.length}
            label={volumes.length === 1 ? 'Volume row' : 'Volume rows'}
          />
        </Statement>
        <p className="mt-3 max-w-xl text-sm text-muted-foreground">
          How many of each meal, drink and room were served. This drives your company total.
        </p>
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onFile} />
          <PillButton variant="ghost" onClick={openCopy} disabled={volumes.length === 0}>
            Copy last period
          </PillButton>
          <PillButton variant="outline" onClick={() => setPosOpen(true)} disabled={products.length === 0}>
            Import POS sales
          </PillButton>
          <PillButton variant="outline" onClick={() => fileRef.current?.click()}>
            Import CSV
          </PillButton>
          <PillButton
            variant="room"
            onClick={() => { setFormError(null); setAddOpen(true); }}
            disabled={products.length === 0}
          >
            Add volume
          </PillButton>
        </div>
      </div>

      {error && <p className="text-sm text-studio-stale">{error}</p>}

      {importResult && (
        <div className="space-y-3 rounded-[6px] border border-border bg-card p-4 text-sm">
          <p>
            Imported {importResult.inserted} row(s)
            {importResult.auto_matched > 0 && ` (${importResult.auto_matched} matched by close name)`}.
          </p>
          {importResult.errors.length > 0 && (
            <p className="text-destructive">{importResult.errors.join('; ')}</p>
          )}
          {importResult.unmatched.length > 0 && (
            <div className="space-y-2">
              <p className="font-medium">
                {importResult.unmatched.length} row(s) didn&apos;t match a product. Map them below and add them.
              </p>
              <div className="space-y-2">
                {importResult.unmatched.map((u) => (
                  <div key={u.row} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr,auto,1fr]">
                    <span className="truncate">
                      <span className="font-medium">&ldquo;{u.product}&rdquo;</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {u.units_sold != null ? `${fmt(u.units_sold, 0)} units` : 'no units'} · {u.period_start} → {u.period_end}
                      </span>
                    </span>
                    <span className="hidden text-muted-foreground sm:inline">→</span>
                    <Select
                      value={resolveMap[u.row] ?? ''}
                      onValueChange={(v) => setResolveMap((prev) => ({ ...prev, [u.row]: v }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a product…" />
                      </SelectTrigger>
                      <SelectContent>
                        {u.suggestions.length > 0 && (
                          <>
                            {u.suggestions.map((s) => (
                              <SelectItem key={`s-${s.id}`} value={String(s.id)}>
                                {s.name} ({KIND_LABEL[s.product_kind] ?? s.product_kind}) · {Math.round(s.score * 100)}% match
                              </SelectItem>
                            ))}
                            <div className="my-1 border-t" />
                          </>
                        )}
                        {products
                          .filter((p) => !u.suggestions.some((s) => s.id === p.id))
                          .map((p) => (
                            <SelectItem key={`p-${p.id}`} value={String(p.id)}>
                              {p.name} ({KIND_LABEL[p.product_kind] ?? p.product_kind})
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                ))}
              </div>
              <PillButton size="sm" onClick={submitResolve} disabled={resolving}>
                {resolving ? 'Adding…' : 'Add mapped rows'}
              </PillButton>
            </div>
          )}
        </div>
      )}

      {loading ? (
        <Skeleton className="h-40 w-full rounded-[6px]" />
      ) : volumes.length === 0 ? (
        <div className="border-t border-border pt-6">
          <p className="text-sm text-muted-foreground">
            No volumes yet. Add how many covers, drinks and room-nights you served, or import a CSV
            (columns: product, units, period_start, period_end).
          </p>
        </div>
      ) : (
        <div className="border-t border-border">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left font-mono text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground">
                <th className="py-2 pr-2 font-bold">Product</th>
                <th className="p-2 font-bold">Period</th>
                <th className="p-2 text-right font-bold">Units</th>
                <th className="p-2 text-right font-bold">Contribution</th>
                <th className="p-2" />
              </tr>
            </thead>
            <tbody>
              {volumes.map((v) => (
                <tr key={v.id} className="border-b border-border">
                  <td className="py-2 pr-2">
                    <span className="font-display font-semibold">{v.product_name}</span>
                    <KindTag kind={v.product_kind} />
                  </td>
                  <td className="p-2 font-mono text-xs text-muted-foreground">{v.period_start} → {v.period_end}</td>
                  <td className="p-2 text-right tabular-nums">{fmt(v.units_sold, 0)}</td>
                  <td className="p-2 text-right font-semibold tabular-nums">
                    {v.contribution_co2e != null ? `${fmt(v.contribution_co2e)} kg` : '–'}
                  </td>
                  <td className="p-2 text-right">
                    <button
                      type="button"
                      aria-label={`Remove ${v.product_name}`}
                      className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
                      onClick={() => remove(v.id)}
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

      <PosSalesImportDialog
        open={posOpen}
        onOpenChange={(o) => {
          setPosOpen(o);
          if (!o) setPosStashId(null);
        }}
        initialStashId={posStashId}
        onStashConsumed={() => router.replace('/hospitality/sales')}
        products={products}
        onComplete={load}
      />

      <Dialog open={copyOpen} onOpenChange={setCopyOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Copy last period</DialogTitle>
            <DialogDescription>
              We&apos;ve carried over the volumes from your most recent period. Set the new dates and
              adjust any numbers, then add them all.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="copy-start">Period start</Label>
                <Input id="copy-start" type="date" value={copyStart} onChange={(e) => setCopyStart(e.target.value)} />
              </div>
              <div className="space-y-1">
                <Label htmlFor="copy-end">Period end</Label>
                <Input id="copy-end" type="date" value={copyEnd} onChange={(e) => setCopyEnd(e.target.value)} />
              </div>
            </div>
            <div className="max-h-64 space-y-2 overflow-y-auto pr-1">
              {copyRows.map((r) => (
                <div key={r.product_id} className="grid grid-cols-[1fr,6rem] items-center gap-2">
                  <span className="truncate text-sm">
                    {r.product_name}
                    <KindTag kind={r.product_kind} />
                  </span>
                  <Input
                    type="number"
                    min="0"
                    step="1"
                    value={r.units}
                    onChange={(e) => updateCopyUnits(r.product_id, e.target.value)}
                    aria-label={`Units for ${r.product_name}`}
                  />
                </div>
              ))}
            </div>
            {copyError && <p className="text-xs text-destructive">{copyError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCopyOpen(false)} disabled={copySubmitting}>Cancel</Button>
            <Button onClick={submitCopy} disabled={copySubmitting}>
              {copySubmitting ? 'Adding…' : `Add ${copyRows.length} row${copyRows.length === 1 ? '' : 's'}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              <p className="text-xs text-muted-foreground">
                How many individual covers, serves or room-nights you sold in the period. Each unit is multiplied by the item&apos;s per-serving footprint.
              </p>
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
