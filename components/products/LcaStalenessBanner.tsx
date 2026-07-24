'use client';

/**
 * Product-wide "your LCA is out of date" banner. Unlike RecipeStalenessBanner
 * (materials-only, recipe-editor-only) this asks the server staleness endpoint,
 * which compares the latest completed LCA against EVERY input that feeds it
 * (recipe, packaging, maturation, facility utility data, and — for a multipack
 * — its component products). Use it on the product overview, passport, EPR
 * page and multipack overview so a footprint changed by an import, an admin
 * edit or a component recalculation is visibly flagged rather than silently
 * shown out of date.
 *
 * One-click recalculate reuses the shared recalculateProductLca helper; if the
 * saved facility allocations cannot be recovered it points at the LCA wizard.
 */

import { useState, useEffect, useCallback } from 'react';
import { PillButton } from '@/components/studio/pill-button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { recalculateProductLca } from '@/lib/utils/recalculate-product-lca';

interface LcaStalenessBannerProps {
  productId: string;
  organizationId: string;
  /** Called after a successful recalculation so the parent can refetch. */
  onRecalculated?: () => void;
}

export function LcaStalenessBanner({ productId, organizationId, onRecalculated }: LcaStalenessBannerProps) {
  const [stale, setStale] = useState(false);
  const [reasons, setReasons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [justRecalculated, setJustRecalculated] = useState(false);

  const checkStale = useCallback(async () => {
    try {
      const res = await fetch(`/api/products/${productId}/lca-staleness`);
      if (!res.ok) return;
      const data = await res.json();
      setStale(!!data.stale);
      setReasons(Array.isArray(data.reasons) ? data.reasons : []);
    } catch {
      // Non-fatal: a failed staleness check just shows no banner.
    }
  }, [productId]);

  useEffect(() => {
    checkStale();
    const onFocus = () => checkStale();
    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onFocus);
    return () => {
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onFocus);
    };
  }, [checkStale]);

  const recalculate = async () => {
    setBusy(true);
    setNote(null);
    try {
      const sb = getSupabaseBrowserClient();
      const { data: product } = await sb
        .from('products')
        .select('*')
        .eq('id', parseInt(productId, 10))
        .maybeSingle();
      if (!product) throw new Error('Product not found');

      const outcome = await recalculateProductLca(sb, product as any, organizationId);
      if (outcome === 'skipped') {
        setNote('Could not recalculate automatically — no saved facility data. Open the LCA wizard and run the Calculation step.');
      } else {
        setStale(false);
        setJustRecalculated(true);
        onRecalculated?.();
      }
    } catch (err) {
      setNote(err instanceof Error ? err.message : 'Recalculation failed');
    } finally {
      setBusy(false);
    }
  };

  if (justRecalculated && !stale) {
    return (
      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-good">
        Recalculated. Your reports are up to date.
      </p>
    );
  }

  if (!stale && !note) return null;

  const reasonText = reasons.length > 0
    ? `Changes to ${reasons.join(', ')} have not reached it yet.`
    : 'Some inputs have changed since it was last calculated.';

  // A hairline attention row, not a yellow box. This is a true thing worth
  // saying, not an alarm: the figure above is simply older than the recipe.
  return (
    <div className="border-y border-studio-hairline py-3">
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-2">
        <div className="min-w-0 flex-1">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-attention">
            Out of date
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {reasonText} Recalculate so the footprint and the reports agree.
          </p>
          {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
        </div>
        <PillButton variant="outline" onClick={recalculate} disabled={busy}>
          {busy ? 'Recalculating…' : 'Recalculate'}
        </PillButton>
      </div>
    </div>
  );
}
