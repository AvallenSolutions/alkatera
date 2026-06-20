'use client';

/**
 * Import a POS item-sales export (Square / Toast / Lightspeed, etc.).
 *
 * POS exports carry the real per-item quantities a venue sold, which Xero does
 * not. The user sets one period, uploads the export, and we aggregate + match
 * each item to a hospitality product (reusing the volumes fuzzy matcher). They
 * confirm matches and resolve the rest, then we create the volume rows.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import { UploadCloud, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
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
import type { HospitalityProductOption, PosSalesPreview } from '@/lib/hospitality/volume-types';

const KIND_LABEL: Record<string, string> = {
  hospitality_meal: 'Meal',
  hospitality_drink: 'Drink',
  hospitality_room_night: 'Room',
};

/** First and last day of the previous calendar month, as YYYY-MM-DD. */
function defaultPeriod(): { start: string; end: string } {
  const now = new Date();
  const firstThis = new Date(now.getFullYear(), now.getMonth(), 1);
  const lastPrev = new Date(firstThis.getTime() - 86_400_000);
  const firstPrev = new Date(lastPrev.getFullYear(), lastPrev.getMonth(), 1);
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  return { start: iso(firstPrev), end: iso(lastPrev) };
}

export function PosSalesImportDialog({
  open,
  onOpenChange,
  products,
  onComplete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  products: HospitalityProductOption[];
  onComplete: () => void;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<'upload' | 'review'>('upload');
  const [start, setStart] = useState('');
  const [end, setEnd] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [preview, setPreview] = useState<PosSalesPreview | null>(null);
  const [matchedUnits, setMatchedUnits] = useState<Record<number, string>>({});
  const [resolveProduct, setResolveProduct] = useState<Record<number, string>>({});
  const [resolveUnits, setResolveUnits] = useState<Record<number, string>>({});

  const reset = useCallback(() => {
    const p = defaultPeriod();
    setPhase('upload');
    setStart(p.start);
    setEnd(p.end);
    setBusy(false);
    setError(null);
    setPreview(null);
    setMatchedUnits({});
    setResolveProduct({});
    setResolveUnits({});
  }, []);

  // The dialog is opened by external state, so seed defaults whenever it opens.
  useEffect(() => {
    if (open) reset();
  }, [open, reset]);

  const handleOpenChange = (next: boolean) => {
    onOpenChange(next);
  };

  const validPeriod = /^\d{4}-\d{2}-\d{2}$/.test(start) && /^\d{4}-\d{2}-\d{2}$/.test(end) && end >= start;

  const onPick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!validPeriod) {
      setError('Set a valid period (end on or after start) first.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const csv = await file.text();
      const res = await fetch('/api/hospitality/volumes/pos-preview', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ csv }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body?.error || 'Could not read the export.');
      const p = body as PosSalesPreview;
      if (p.matched.length === 0 && p.unmatched.length === 0) {
        throw new Error('No items with quantities found in that export.');
      }
      setPreview(p);
      setMatchedUnits(Object.fromEntries(p.matched.map((m) => [m.product_id, String(m.units)])));
      setResolveProduct(
        Object.fromEntries(p.unmatched.map((u, i) => [i, u.suggestions[0] ? String(u.suggestions[0].id) : ''])),
      );
      setResolveUnits(Object.fromEntries(p.unmatched.map((u, i) => [i, String(u.units)])));
      setPhase('review');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not read the export.');
    } finally {
      setBusy(false);
    }
  };

  const commit = async () => {
    if (!preview) return;
    const rows: Array<{ product_id: number; units_sold: number }> = [];
    for (const m of preview.matched) {
      const units = Number(matchedUnits[m.product_id]);
      if (Number.isFinite(units) && units >= 0) rows.push({ product_id: m.product_id, units_sold: units });
    }
    preview.unmatched.forEach((u, i) => {
      const pid = resolveProduct[i];
      const units = Number(resolveUnits[i]);
      if (pid && Number.isFinite(units) && units >= 0) rows.push({ product_id: Number(pid), units_sold: units });
    });
    if (rows.length === 0) {
      setError('Map at least one item to a product.');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const results = await Promise.all(
        rows.map((r) =>
          fetch('/api/hospitality/volumes', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...r, period_start: start, period_end: end }),
          }),
        ),
      );
      const okCount = results.filter((res) => res.ok).length;
      const failed = results.length - okCount;
      handleOpenChange(false);
      onComplete();
      toast({
        title: `Added ${okCount} volume row${okCount === 1 ? '' : 's'}`,
        description: failed > 0 ? `${failed} could not be added.` : undefined,
        variant: failed > 0 ? 'destructive' : undefined,
      });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Could not import.');
    } finally {
      setBusy(false);
    }
  };

  const totalRows =
    (preview?.matched.length ?? 0) +
    (preview?.unmatched.filter((_, i) => resolveProduct[i]).length ?? 0);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Import POS sales</DialogTitle>
          <DialogDescription>
            Upload your point-of-sale item-sales export (Square, Toast, Lightspeed and the like). Set the period it
            covers, and we&apos;ll match each item to a product and total the units sold.
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1">
            <Label htmlFor="pos-start">Period start</Label>
            <Input id="pos-start" type="date" value={start} onChange={(e) => setStart(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="pos-end">Period end</Label>
            <Input id="pos-end" type="date" value={end} onChange={(e) => setEnd(e.target.value)} />
          </div>
        </div>

        {phase === 'upload' ? (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              disabled={busy || !validPeriod}
              className="flex w-full flex-col items-center justify-center rounded-lg border-2 border-dashed border-muted-foreground/25 py-10 text-center transition-colors hover:border-primary/50 disabled:opacity-50"
            >
              {busy ? (
                <>
                  <Loader2 className="mb-3 h-7 w-7 animate-spin text-primary" />
                  <p className="font-medium">Reading your export…</p>
                </>
              ) : (
                <>
                  <UploadCloud className="mb-3 h-7 w-7 text-muted-foreground" />
                  <p className="font-medium">Choose a POS export (CSV)</p>
                  <p className="text-sm text-muted-foreground">Needs an item-name column and a quantity column.</p>
                </>
              )}
            </button>
            <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={onPick} />
            {!validPeriod && <p className="text-xs text-muted-foreground">Set the period above to enable upload.</p>}
            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : preview ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              {preview.matched.length} matched, {preview.unmatched.length} to resolve
              {preview.skipped_no_quantity > 0 && `, ${preview.skipped_no_quantity} skipped (no quantity)`}.
            </p>

            <ScrollArea className="max-h-[42vh] pr-3">
              <div className="space-y-4">
                {preview.matched.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Matched products</p>
                    {preview.matched.map((m) => (
                      <div key={m.product_id} className="grid grid-cols-[1fr,6rem] items-center gap-2">
                        <span className="truncate text-sm">
                          {m.product_name}{' '}
                          <Badge variant="outline" className="ml-1 text-[10px]">
                            {KIND_LABEL[m.product_kind] ?? m.product_kind}
                          </Badge>
                          {m.matched_from.length > 1 && (
                            <span className="ml-1 text-xs text-muted-foreground">({m.matched_from.length} lines)</span>
                          )}
                        </span>
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={matchedUnits[m.product_id] ?? ''}
                          onChange={(e) => setMatchedUnits((prev) => ({ ...prev, [m.product_id]: e.target.value }))}
                          aria-label={`Units for ${m.product_name}`}
                        />
                      </div>
                    ))}
                  </div>
                )}

                {preview.unmatched.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-medium text-muted-foreground">Items to map</p>
                    {preview.unmatched.map((u, i) => (
                      <div key={`${u.name}-${i}`} className="grid grid-cols-1 items-center gap-2 sm:grid-cols-[1fr,1fr,5rem]">
                        <span className="truncate text-sm">&ldquo;{u.name}&rdquo;</span>
                        <Select
                          value={resolveProduct[i] ?? ''}
                          onValueChange={(v) => setResolveProduct((prev) => ({ ...prev, [i]: v }))}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Choose a product…" />
                          </SelectTrigger>
                          <SelectContent>
                            {u.suggestions.length > 0 && (
                              <>
                                {u.suggestions.map((s) => (
                                  <SelectItem key={`s-${s.id}`} value={String(s.id)}>
                                    {s.name} · {Math.round(s.score * 100)}% match
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
                        <Input
                          type="number"
                          min="0"
                          step="1"
                          value={resolveUnits[i] ?? ''}
                          onChange={(e) => setResolveUnits((prev) => ({ ...prev, [i]: e.target.value }))}
                          aria-label={`Units for ${u.name}`}
                        />
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </ScrollArea>

            {error && <p className="text-sm text-destructive">{error}</p>}
          </div>
        ) : null}

        <DialogFooter>
          {phase === 'review' && (
            <Button variant="ghost" onClick={reset} disabled={busy}>
              Choose a different file
            </Button>
          )}
          <Button variant="outline" onClick={() => handleOpenChange(false)} disabled={busy}>
            Cancel
          </Button>
          {phase === 'review' && (
            <Button onClick={commit} disabled={busy || totalRows === 0}>
              {busy ? 'Importing…' : `Add ${totalRows} row${totalRows === 1 ? '' : 's'}`}
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
