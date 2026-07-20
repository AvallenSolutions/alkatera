import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '@/lib/inngest/client';

/**
 * Close the loop after an answer that changes how a footprint is calculated.
 *
 * Asking someone how far their product travels and then leaving the number
 * exactly as it was is worse than not asking: it teaches them their answers do
 * not matter. The dossier ask handlers return `recalc_product_id` when their
 * write affects the calculation, and this dispatches the recalculation.
 *
 * Best effort by design. A failure here must never fail the answer itself,
 * because the answer is the thing the user gave us and it is already saved.
 * The dossier's own Recalculate button remains the backstop.
 */
export async function dispatchRecalcIfNeeded(
  admin: SupabaseClient,
  organizationId: string,
  userId: string,
  appliedTo: Record<string, unknown> | null | undefined,
  baseUrl: string | null | undefined,
  trigger: 'ask_answered' | 'manual' = 'ask_answered',
): Promise<{ dispatched: boolean; reason?: string }> {
  const productId = appliedTo?.recalc_product_id;
  if (productId === undefined || productId === null) {
    return { dispatched: false };
  }
  if (!baseUrl) {
    return { dispatched: false, reason: 'no base URL to reach the internal APIs with' };
  }
  if (!process.env.INNGEST_EVENT_KEY) {
    return { dispatched: false, reason: 'background calculation is not configured here' };
  }

  try {
    // A run already in flight will pick up this change anyway; the partial
    // unique index would reject a second one regardless.
    const { data: active } = await admin
      .from('lca_calculation_runs')
      .select('id')
      .eq('product_id', productId)
      .in('status', ['queued', 'running'])
      .maybeSingle();
    if (active) return { dispatched: true };

    const { data: run, error } = await admin
      .from('lca_calculation_runs')
      .insert({
        organization_id: organizationId,
        product_id: productId,
        requested_by: userId,
        trigger,
        status: 'queued',
      })
      .select('id')
      .single();
    if (error || !run) {
      return { dispatched: false, reason: error?.message || 'could not record the run' };
    }

    await inngest.send({
      name: 'lca/recalc.requested',
      data: { run_id: run.id, base_url: baseUrl },
    });
    return { dispatched: true };
  } catch (err) {
    return {
      dispatched: false,
      reason: err instanceof Error ? err.message : 'unknown error',
    };
  }
}
