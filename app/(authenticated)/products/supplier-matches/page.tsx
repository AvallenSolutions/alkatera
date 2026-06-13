'use client';

/**
 * Review ingredient -> supplier-product match suggestions. Accepting a match
 * links the ingredient to the supplier's real data (Priority 1 in the LCA
 * waterfall); the brand recalculates the product to apply it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Check, X, Loader2, Sparkles } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

interface Suggestion {
  id: string;
  product_id: number | string;
  product_material_id: string;
  ingredient_name: string;
  supplier_product_name: string;
  supplier_name: string | null;
  match_confidence: number;
  match_reason: string;
}

export default function SupplierMatchesPage() {
  const { currentOrganization } = useOrganization();
  const orgId = currentOrganization?.id;
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!orgId) return;
    const res = await fetch(`/api/products/ingredient-matches?organization_id=${orgId}`);
    const body = await res.json().catch(() => ({}));
    setSuggestions(res.ok ? body.suggestions ?? [] : []);
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  async function act(id: string, action: 'accept' | 'dismiss') {
    setBusyId(id);
    const res = await fetch('/api/products/ingredient-matches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id, action }),
    });
    if (res.ok) setSuggestions((prev) => (prev ?? []).filter((s) => s.id !== id));
    setBusyId(null);
  }

  // Group by product for a tidy review.
  const grouped = useMemo(() => {
    const map = new Map<string, Suggestion[]>();
    for (const s of suggestions ?? []) {
      const key = String(s.product_id);
      (map.get(key) ?? map.set(key, []).get(key)!).push(s);
    }
    return Array.from(map.values());
  }, [suggestions]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <Link href="/products" className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3 w-3" />
          Back to products
        </Link>
        <div className="flex items-center gap-2">
          <Sparkles className="h-6 w-6 text-[#ccff00]" />
          <h1 className="text-3xl font-semibold tracking-tight">Supplier matches</h1>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          We found supplier products that may match your ingredients. Accepting one links your
          ingredient to the supplier&apos;s real data. Recalculate the product afterwards to apply it.
        </p>
      </header>

      {suggestions === null ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : suggestions.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            No matches to review. Use &quot;Find supplier matches&quot; on the products page to look again,
            or connect more suppliers.
          </CardContent>
        </Card>
      ) : (
        grouped.map((rows) => (
          <Card key={String(rows[0].product_id)}>
            <CardHeader>
              <CardTitle className="text-base">
                <Link href={`/products/${rows[0].product_id}`} className="hover:underline">
                  Product matches ({rows.length})
                </Link>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {rows.map((s) => (
                <div key={s.id} className="flex flex-wrap items-center gap-3 rounded-md border border-border/60 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">
                      <span className="font-medium">{s.ingredient_name}</span>
                      <span className="mx-2 text-muted-foreground">→</span>
                      <span className="font-medium">{s.supplier_product_name}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {s.supplier_name ? `${s.supplier_name} · ` : ''}{s.match_reason}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {Math.round(s.match_confidence * 100)}% match
                  </Badge>
                  <Button size="sm" className="h-7 text-xs" disabled={busyId === s.id} onClick={() => act(s.id, 'accept')}>
                    {busyId === s.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="mr-1 h-3.5 w-3.5" />}
                    Accept
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-muted-foreground" disabled={busyId === s.id} onClick={() => act(s.id, 'dismiss')}>
                    <X className="mr-1 h-3.5 w-3.5" />
                    Dismiss
                  </Button>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
