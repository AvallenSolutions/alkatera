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
import { StateChip } from '@/components/studio/state-chip';
import { PillButton } from '@/components/studio/pill-button';
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
      <div className="flex items-center gap-3 rounded-[6px] border border-border bg-card px-4 py-3 text-sm">
        <StateChip tone="good">Up to date</StateChip>
        <span className="text-foreground">
          LCA recalculated with your latest recipe. Your reports are up to date.
        </span>
      </div>
    );
  }

  if (!stale && !note) return null;

  return (
    <div className="rounded-[6px] border border-studio-attention/40 bg-card px-4 py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3 text-sm">
          <StateChip tone="attention">Recipe changed</StateChip>
          <span className="text-foreground">
            Your recipe has changed since the last LCA calculation. Recalculate so your reports
            reflect these edits.
          </span>
        </div>
        <PillButton size="sm" onClick={recalculate} disabled={busy}>
          {busy ? 'Recalculating…' : 'Recalculate LCA'}
        </PillButton>
      </div>
      {note && <p className="mt-2 text-xs text-studio-dim">{note}</p>}
    </div>
  );
}
