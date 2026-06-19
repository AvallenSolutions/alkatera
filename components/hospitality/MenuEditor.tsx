'use client';

/**
 * Menu editor — items with LIVE per-serving impact, menu aggregate, and an
 * add-item flow that can attach a meal, a made-drink, or one of the org's own
 * wines (whose impact is pulled live from the product's LCA — requirement #3).
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { QRCodeSVG } from 'qrcode.react';
import { ChevronLeft, Plus, Trash2, Leaf, UtensilsCrossed, Wine, Grape, Globe, Copy } from 'lucide-react';
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
import {
  DEFAULT_SERVES_PER_BOTTLE,
  type MenuDetail,
  type MenuItemKind,
} from '@/lib/hospitality/menu-types';

function fmt(n: number, digits = 2): string {
  return n.toLocaleString('en-GB', { maximumFractionDigits: digits });
}

const KIND_META: Record<MenuItemKind, { label: string; icon: typeof Wine }> = {
  meal: { label: 'Meal', icon: UtensilsCrossed },
  made_drink: { label: 'Made drink', icon: Wine },
  own_product_drink: { label: 'Own wine', icon: Grape },
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

  if (loading) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full rounded-lg" />
      </div>
    );
  }
  if (loadError || !menu) {
    return (
      <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
        <Link href="/hospitality/menus/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
          <ChevronLeft className="mr-1 h-4 w-4" />
          Menus
        </Link>
        <p className="text-sm text-destructive">{loadError || 'Menu not found'}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl space-y-5 p-4 sm:p-6">
      <Link href="/hospitality/menus/" className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
        <ChevronLeft className="mr-1 h-4 w-4" />
        Menus
      </Link>

      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-semibold">{menu.name}</h1>
          {menu.venue_name && <p className="text-sm text-muted-foreground">{menu.venue_name}</p>}
        </div>
        <Button onClick={openAdd}>
          <Plus className="mr-2 h-4 w-4" />
          Add item
        </Button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Items</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{menu.aggregate.item_count}</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center gap-2 space-y-0 pb-2">
            <Leaf className="h-4 w-4 text-primary" />
            <CardTitle className="text-sm font-medium text-muted-foreground">Average / cover</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmt(menu.aggregate.avg_co2e)}</p>
            <p className="text-xs text-muted-foreground">kg CO₂e</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">Full menu total</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-2xl font-semibold">{fmt(menu.aggregate.total_co2e)}</p>
            <p className="text-xs text-muted-foreground">kg CO₂e</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Items</CardTitle>
        </CardHeader>
        <CardContent>
          {menu.items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No items yet. Add a meal, a drink, or one of your own wines.
            </p>
          ) : (
            <ul className="divide-y">
              {menu.items.map((item) => {
                const Meta = KIND_META[item.item_kind];
                const Icon = Meta.icon;
                return (
                  <li key={item.id} className="flex items-center justify-between gap-3 py-3">
                    <div className="flex min-w-0 items-center gap-3">
                      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <div className="min-w-0">
                        <p className="truncate font-medium">{item.product_name}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
                          <Badge variant="outline" className="text-[10px]">{Meta.label}</Badge>
                          {item.item_kind === 'own_product_drink' && (
                            <span className="text-xs text-muted-foreground">{fmt(item.serves, 0)} serves/bottle</span>
                          )}
                          {item.internal_consumption && (
                            <Badge variant="secondary" className="text-[10px]">internal</Badge>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {item.impact ? (
                          <>
                            <p className="font-semibold">{fmt(item.impact.per_cover_co2e)} kg CO₂e</p>
                            <p className="text-xs text-muted-foreground">per serving</p>
                          </>
                        ) : (
                          <p className="text-xs text-muted-foreground">Not calculated</p>
                        )}
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-destructive"
                        onClick={() => removeItem(item.id)}
                        aria-label="Remove item"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center gap-2 space-y-0">
          <Globe className="h-5 w-5" />
          <CardTitle className="text-base">Public menu &amp; QR</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {menu.is_public && publicUrl ? (
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <div className="rounded-lg bg-white p-2">
                <QRCodeSVG value={publicUrl} size={120} />
              </div>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="text-sm text-muted-foreground">
                  This menu is live. Print the QR or share the link — guests see each dish&apos;s
                  carbon footprint.
                </p>
                <div className="flex items-center gap-2">
                  <a href={publicUrl} target="_blank" rel="noreferrer" className="truncate text-sm text-primary underline">
                    {publicUrl}
                  </a>
                  <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={copyLink} aria-label="Copy link">
                    <Copy className="h-3.5 w-3.5" />
                  </Button>
                  {copied && <span className="text-xs text-muted-foreground">Copied</span>}
                </div>
                <Button variant="outline" size="sm" onClick={() => togglePublish(false)} disabled={publishing}>
                  {publishing ? 'Updating…' : 'Unpublish'}
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <p className="text-sm text-muted-foreground">
                Publish this menu to get a public page and QR code with consumer carbon labels.
              </p>
              <Button onClick={() => togglePublish(true)} disabled={publishing}>
                <Globe className="mr-2 h-4 w-4" />
                {publishing ? 'Publishing…' : 'Publish'}
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

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
                      {c.per_bottle_co2e != null ? ` — ${fmt(c.per_bottle_co2e)} kg CO₂e/bottle` : ''}
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
