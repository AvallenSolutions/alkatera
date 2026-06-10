'use client';

/**
 * Shows in the recipe editor when the product's ingredients/packaging have been
 * edited since its last completed LCA calculation. Editing materials updates
 * product_materials but does NOT refresh the stored PCF snapshot — only a
 * recalculation does — so without this the user can edit, walk away, and later
 * generate a silently out-of-date report. (The report generator also guards
 * against this; this is the proactive, in-editor heads-up.)
 *
 * Offers a one-click recalculate using the product's saved wizard settings via
 * the shared recalculateProductLca helper. If the saved facility allocations
 * can't be recovered, it points the user at the LCA wizard instead.
 */

import { useState, useEffect, useCallback } from 'react';
import { Loader2, RefreshCw, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client';
import { recalculateProductLca } from '@/lib/utils/recalculate-product-lca';

interface RecipeStalenessBannerProps {
  productId: string;
  organizationId: string;
}

export function RecipeStalenessBanner({ productId, organizationId }: RecipeStalenessBannerProps) {
  const [stale, setStale] = useState(false);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);
  const [justRecalculated, setJustRecalculated] = useState(false);

  const checkStale = useCallback(async () => {
    const sb = getSupabaseBrowserClient();
    const pid = parseInt(productId, 10);
    if (!Number.isFinite(pid)) return;

    // The most recent completed LCA — nothing to be stale against without one.
    const { data: pcf } = await sb
      .from('product_carbon_footprints')
      .select('id, updated_at')
      .eq('product_id', pid)
      .eq('status', 'completed')
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!pcf) { setStale(false); return; }

    const [{ data: snap }, { data: latestMat }] = await Promise.all([
      sb.from('product_carbon_footprint_materials')
        .select('created_at')
        .eq('product_carbon_footprint_id', pcf.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      sb.from('product_materials')
        .select('updated_at')
        .eq('product_id', pid)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const snapTime = snap?.created_at
      ? new Date(snap.created_at).getTime()
      : (pcf.updated_at ? new Date(pcf.updated_at).getTime() : 0);
    const editTime = latestMat?.updated_at ? new Date(latestMat.updated_at).getTime() : 0;
    setStale(editTime > 0 && snapTime > 0 && editTime > snapTime);
  }, [productId]);

  // Re-check on mount and whenever the tab regains focus (e.g. after saving
  // edits and coming back), so the banner reflects the latest state.
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
        LCA recalculated with your latest recipe. Your reports are up to date.
      </div>
    );
  }

  if (!stale && !note) return null;

  return (
    <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 dark:border-amber-800 dark:bg-amber-950/20">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-start gap-2 text-sm text-amber-900 dark:text-amber-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
          <span>
            Your recipe has changed since the last LCA calculation. Recalculate so your reports
            reflect these edits.
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
