'use client';

/**
 * Review ingredient -> supplier-product match suggestions. Accepting a match
 * links the ingredient to the supplier's real data (Priority 1 in the LCA
 * waterfall); the brand recalculates the product to apply it.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { useOrganization } from '@/lib/organizationContext';
import { Statement } from '@/components/studio/statement';
import { BigNumber } from '@/components/studio/big-number';
import { Eyebrow } from '@/components/studio/eyebrow';
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';

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

  const total = suggestions?.length ?? 0;

  return (
    <div className="mx-auto max-w-3xl space-y-8">
      <Link
        href="/products"
        className="inline-flex items-center gap-1.5 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3 w-3" />
        The products
      </Link>

      <Statement eyebrow="THE CELLAR · SUPPLIER MATCHES" headline="Matches to review.">
        {total > 0 ? <BigNumber size="display" value={total} label="Suggestions" tone="room" /> : null}
      </Statement>

      <p className="max-w-xl text-sm text-muted-foreground">
        Supplier products that may match your ingredients. Accepting one links your ingredient to the
        supplier&apos;s real data. Recalculate the product afterwards to apply it.
      </p>

      {suggestions === null ? (
        <p className="text-sm text-muted-foreground">Loading the suggestions.</p>
      ) : suggestions.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          No matches to review. Connect more suppliers, or add supplier products, and they will show up here.
        </p>
      ) : (
        <div className="space-y-8">
          {grouped.map((rows) => (
            <section key={String(rows[0].product_id)} className="space-y-3">
              <Link href={`/products/${rows[0].product_id}`}>
                <Eyebrow>{`PRODUCT · ${rows.length} ${rows.length === 1 ? 'MATCH' : 'MATCHES'}`}</Eyebrow>
              </Link>
              <ul className="divide-y divide-border">
                {rows.map((s) => (
                  <li key={s.id} className="flex flex-wrap items-center gap-x-4 gap-y-2 py-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        <span className="font-medium">{s.ingredient_name}</span>
                        <span className="mx-2 text-muted-foreground">→</span>
                        <span className="font-medium">{s.supplier_product_name}</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {s.supplier_name ? `${s.supplier_name} · ` : ''}
                        {s.match_reason}
                      </p>
                    </div>
                    <StateChip tone={s.match_confidence >= 0.75 ? 'good' : 'attention'}>
                      {Math.round(s.match_confidence * 100)}% match
                    </StateChip>
                    <PillButton
                      variant="room"
                      size="sm"
                      disabled={busyId === s.id}
                      onClick={() => act(s.id, 'accept')}
                    >
                      {busyId === s.id ? 'Linking…' : 'Accept'}
                    </PillButton>
                    <PillButton
                      variant="ghost"
                      size="sm"
                      disabled={busyId === s.id}
                      onClick={() => act(s.id, 'dismiss')}
                    >
                      Dismiss
                    </PillButton>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
