'use client';

/**
 * Menu editor — items with LIVE per-serving impact, menu aggregate, and an
 * add-item flow that can attach a meal, a made-drink, or one of the org's own
 * wines (whose impact is pulled live from the product's LCA — requirement #3).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { Statement } from '@/components/studio/statement';
import { Eyebrow } from '@/components/studio/eyebrow';
import { BigNumber } from '@/components/studio/big-number';
import { PillButton } from '@/components/studio/pill-button';
import { FactList, type FactRowItem } from '@/components/studio/fact-list';
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
import {
  DEFAULT_SERVES_PER_BOTTLE,
  type MenuDetail,
  type MenuItemKind,
} from '@/lib/hospitality/menu-types';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

const KIND_LABEL: Record<MenuItemKind, string> = {
  meal: 'Meal',
  made_drink: 'Made drink',
  own_product_drink: 'Own wine',
};

interface Candidate {
  id: number;
  name: string;
  serves_per_container?: number | null;
  per_bottle_co2e?: number | null;
}

export function MenuEditor({ menuId }: { menuId: string }) {
  const { toast } = useToast();
  const [menu, setMenu] = useState<MenuDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [publishing, setPublishing] = useState(false);
  const [copied, setCopied] = useState(false);

  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<MenuItemKind>('meal');
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [candLoading, setCandLoading] = useState(false);
  const [productId, setProductId] = useState<string>('');
  const [serves, setServes] = useState<string>(String(DEFAULT_SERVES_PER_BOTTLE));
  const [submitting, setSubmitting] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/hospitality/menus/${menuId}`, { credentials: 'include' });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Failed to load menu');
      }
      const body = await res.json();
      setMenu(body.menu);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : 'Failed to load menu');
    } finally {
      setLoading(false);
    }
  }, [menuId]);

  useEffect(() => {
    load();
  }, [load]);

  const loadCandidates = useCallback(async (k: MenuItemKind) => {
    setCandLoading(true);
    setProductId('');
    try {
      const path =
        k === 'meal' ? '/api/hospitality/meals' : k === 'made_drink' ? '/api/hospitality/drinks' : '/api/hospitality/wines';
      const res = await fetch(path, { credentials: 'include' });
      const body = await res.json();
      const list: Candidate[] = k === 'own_product_drink' ? body.wines ?? [] : body.recipes ?? [];
      setCandidates(list);
    } catch {
      setCandidates([]);
    } finally {
      setCandLoading(false);
    }
  }, []);

  const openAdd = () => {
    setKind('meal');
    setServes(String(DEFAULT_SERVES_PER_BOTTLE));
    setAddError(null);
    setAddOpen(true);
    loadCandidates('meal');
  };

  const onKindChange = (k: MenuItemKind) => {
    setKind(k);
    setAddError(null);
    loadCandidates(k);
  };

  const submitAdd = async () => {
    if (!productId) {
      setAddError('Pick an item to add.');
      return;
    }
    setSubmitting(true);
    setAddError(null);
    try {
      const payload: Record<string, unknown> = { item_kind: kind, product_id: Number(productId) };
      if (kind === 'own_product_drink' && serves) payload.serves_per_container = Number(serves);
      const res = await fetch(`/api/hospitality/menus/${menuId}/items`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not add item');
      }
      setAddOpen(false);
      await load();
    } catch (e: unknown) {
      setAddError(e instanceof Error ? e.message : 'Could not add item');
    } finally {
      setSubmitting(false);
    }
  };

  const removeItem = async (itemId: string) => {
    try {
      const res = await fetch(`/api/hospitality/menus/${menuId}/items/${itemId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not remove item');
      }
      await load();
    } catch (e: unknown) {
      toast({
        title: 'Could not remove item',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    }
  };

  const togglePublish = async (next: boolean) => {
    setPublishing(true);
    try {
      const res = await fetch(`/api/hospitality/menus/${menuId}/publish`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_public: next }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || 'Could not update');
      }
      await load();
    } catch (e: unknown) {
      toast({
        title: 'Could not update sharing',
        description: e instanceof Error ? e.message : 'Please try again',
        variant: 'destructive',
      });
    } finally {
      setPublishing(false);
    }
  };

  const publicUrl =
    menu?.public_slug && typeof window !== 'undefined'
      ? `${window.location.origin}/menu/${menu.public_slug}`
      : null;

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const backLink = (
    <Link
      href="/hospitality/menus/"
      className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
    >
      ← Menus
    </Link>
  );

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-[6px]" />
      </div>
    );
  }
  if (loadError || !menu) {
    return (
      <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
        {backLink}
        <p className="text-sm text-studio-stale">{loadError || 'Menu not found'}</p>
      </div>
    );
  }

  const itemRows: FactRowItem[] = menu.items.map((item) => {
    const hintParts = [
      KIND_LABEL[item.item_kind],
      item.item_kind === 'own_product_drink' ? `${fmt(item.serves, 0)} serves/bottle` : null,
      item.internal_consumption ? 'internal' : null,
    ].filter(Boolean);
    return {
      id: item.id,
      title: item.product_name,
      hint: hintParts.join(' · '),
      value: item.impact ? fmt(item.impact.per_cover_co2e) : undefined,
      unit: item.impact ? 'KG CO₂E / SERVING' : undefined,
      chip: item.impact ? undefined : { tone: 'quiet' as const, label: 'Not calculated' },
      trailing: (
        <button
          type="button"
          aria-label={`Remove ${item.product_name}`}
          className="rounded px-2 py-1 text-base leading-none text-muted-foreground transition-colors duration-150 hover:text-studio-stale"
          onClick={() => removeItem(item.id)}
        >
          &times;
        </button>
      ),
    };
  });

  return (
    <div className="mx-auto max-w-4xl space-y-8 p-4 sm:p-6">
      {backLink}

      <div className="min-w-0">
        <Statement
          eyebrow="THE WORKBENCH · MENUS"
          headline={menu.name.endsWith('.') ? menu.name : `${menu.name}.`}
        >
          <BigNumber
            size="display"
            value={menu.aggregate.item_count}
            label={menu.aggregate.item_count === 1 ? 'Item' : 'Items'}
          />
          <BigNumber size="display" value={fmt(menu.aggregate.avg_co2e)} label="KG CO₂E AVG / COVER" />
          <BigNumber size="display" value={fmt(menu.aggregate.total_co2e)} label="KG CO₂E FULL MENU" />
        </Statement>
        {menu.venue_name && (
          <p className="mt-3 text-sm text-muted-foreground">{menu.venue_name}</p>
        )}
      </div>

      <section className="border-t border-border pt-5">
        <div className="mb-2 flex items-center justify-between gap-4">
          <Eyebrow>Items</Eyebrow>
          <PillButton variant="room" size="sm" onClick={openAdd}>
            Add item
          </PillButton>
        </div>
        {menu.items.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No items yet. Add a meal, a drink, or one of your own wines.
          </p>
        ) : (
          <FactList items={itemRows} />
        )}
      </section>

      <section className="border-t border-border pt-5">
        <Eyebrow className="mb-4">Public menu · QR</Eyebrow>
        {menu.is_public && publicUrl ? (
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <div className="rounded-[6px] bg-white p-2">
              <QRCodeSVG value={publicUrl} size={120} />
            </div>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="text-sm text-muted-foreground">
                This menu is live. Print the QR or share the link: guests see each dish&apos;s
                carbon footprint.
              </p>
              <div className="flex items-center gap-2">
                <a href={publicUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-room-accent underline">
                  {publicUrl}
                </a>
                <button
                  type="button"
                  onClick={copyLink}
                  className="shrink-0 rounded px-2 py-1 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors duration-150 hover:text-foreground"
                >
                  {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
              <PillButton variant="outline" size="sm" onClick={() => togglePublish(false)} disabled={publishing}>
                {publishing ? 'Updating…' : 'Unpublish'}
              </PillButton>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-muted-foreground">
              Publish this menu to get a public page and QR code with consumer carbon labels.
            </p>
            <PillButton onClick={() => togglePublish(true)} disabled={publishing}>
              {publishing ? 'Publishing…' : 'Publish'}
            </PillButton>
          </div>
        )}
      </section>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add item to menu</DialogTitle>
            <DialogDescription>
              Add an existing meal or made-drink, or one of your own wines (its impact is pulled
              live from the product&apos;s LCA).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="item-kind">Type</Label>
              <Select value={kind} onValueChange={(v) => onKindChange(v as MenuItemKind)}>
                <SelectTrigger id="item-kind">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="meal">Meal</SelectItem>
                  <SelectItem value="made_drink">Made drink</SelectItem>
                  <SelectItem value="own_product_drink">Own wine</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="item-product">{kind === 'own_product_drink' ? 'Wine' : 'Item'}</Label>
              <Select value={productId} onValueChange={setProductId} disabled={candLoading}>
                <SelectTrigger id="item-product">
                  <SelectValue placeholder={candLoading ? 'Loading…' : candidates.length ? 'Choose…' : 'None available'} />
                </SelectTrigger>
                <SelectContent>
                  {candidates.map((c) => (
                    <SelectItem key={c.id} value={String(c.id)}>
                      {c.name}
                      {c.per_bottle_co2e != null ? ` · ${fmt(c.per_bottle_co2e)} kg CO₂e/bottle` : ''}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {kind === 'own_product_drink' && (
              <div className="w-40 space-y-1">
                <Label htmlFor="item-serves">Serves per bottle</Label>
                <Input
                  id="item-serves"
                  type="number"
                  min="1"
                  step="1"
                  value={serves}
                  onChange={(e) => setServes(e.target.value)}
                />
              </div>
            )}
            {addError && <p className="text-xs text-destructive">{addError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)} disabled={submitting}>
              Cancel
            </Button>
            <Button onClick={submitAdd} disabled={submitting || candLoading}>
              {submitting ? 'Adding…' : 'Add to menu'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
