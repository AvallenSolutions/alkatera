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
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
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
      <div className="flex items-center gap-2 rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-2.5 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/20 dark:text-emerald-300">
        <CheckCircle2 className="h-4 w-4 flex-shrink-0" />
        LCA recalculated. Your reports are up to date.
      </div>
    );
  }

  if (!stale && !note) return null;

  const reasonText = reasons.length > 0
    ? `Changes to ${reasons.join(', ')} have not been reflected in the LCA yet.`
    : 'Some inputs have changed since the last LCA calculation.';

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            This product&apos;s LCA is out of date. {reasonText} Recalculate so your reports and
            footprint are up to date.
          </span>
        </div>
        <Button size="sm" onClick={recalculate} disabled={busy} className="gap-2">
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
          {busy ? 'Recalculating…' : 'Recalculate LCA'}
        </Button>
      </div>
      {note && <p className="mt-2 pl-6 text-xs text-amber-800 dark:text-amber-400">{note}</p>}
    </div>
  );
}
