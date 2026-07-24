import 'server-only';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { inngest } from '../client';
import { calculateProductLCA } from '@/lib/product-lca-calculator';
import { toValidAllocations } from '@/lib/utils/lca-recalc-allocations';
import { recomputeScenariosForPcf } from '@/lib/lca/scenarios';
import { snapshotSingleProductIntensity } from '@/lib/benchmarks/product-intensity';

/**
 * Recalculate one product's footprint, server-side.
 *
 * The calculator was written to run in a signed-in browser tab: the user
 * pressed Calculate and watched a blocking overlay, and navigating away lost
 * the run. That single fact is why the platform needs staleness banners and a
 * "recalculate" button on every surface, and why a footprint can be out of
 * date with its own recipe.
 *
 * Here the same calculator runs under Inngest, so a footprint refreshes
 * because something changed rather than because somebody clicked. The UI
 * polls `lca_calculation_runs` instead of holding a promise.
 *
 * Flow:
 *   POST /api/lca/recalc → insert lca_calculation_runs row (queued)
 *                        → inngest.send('lca/recalc.requested')
 *                                │
 *                                ▼
 *                        lcaRecalcRun  (this function)
 *                                │
 *   GET /api/lca/recalc/status ◄─┘ (UI polls the row)
 *
 * On the credential: the waterfall resolver reaches OpenLCA and the supplier
 * resolver over HTTP. In the browser it authenticates those hops with the
 * user's JWT. There is no session here, so we pass a service credential
 * (CRON_SECRET + base URL) through the CalculationContext. Without it those
 * two branches cannot authenticate, and the run would resolve from generic
 * factors while still reporting success: the same product, a quietly
 * different number. `preflight` below refuses to start rather than let that
 * happen.
 */

function service(): SupabaseClient {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service-role config');
  return createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
}

async function patchRun(
  supabase: SupabaseClient,
  runId: string,
  patch: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from('lca_calculation_runs')
    .update({ ...patch, updated_at: new Date().toISOString() })
    .eq('id', runId);
}

export const lcaRecalcRun = inngest.createFunction(
  {
    id: 'lca-recalc-run',
    name: 'LCA: recalculate a product footprint',
    // Each run makes a burst of OpenLCA calls (the resolver itself caps at 4
    // in flight). A handful of products at once is plenty; more would queue
    // behind the gdt-server anyway.
    concurrency: { limit: 4 },
    retries: 1,
    triggers: [{ event: 'lca/recalc.requested' }],
    onFailure: async ({ event, error }) => {
      // Without this a crashed run leaves the row at 'running' forever and the
      // UI polls a status that will never change.
      const runId = (event as any)?.data?.event?.data?.run_id as string | undefined;
      if (!runId) return;
      const supabase = service();
      await patchRun(supabase, runId, {
        status: 'failed',
        error: `Failed after retries: ${error.message}`.slice(0, 500),
      });
    },
  },
  async ({ event, step }) => {
    const { run_id: runId, base_url: baseUrl } = event.data as {
      run_id: string;
      base_url: string;
    };
    const supabase = service();

    // ── Preflight ────────────────────────────────────────────────────────
    // Establish that this run can produce a trustworthy number before it
    // produces any number at all.
    const plan = await step.run('preflight', async () => {
      const cronSecret = process.env.CRON_SECRET;
      if (!cronSecret) {
        throw new Error(
          'CRON_SECRET is not set: a server-side run cannot reach OpenLCA or supplier data, ' +
            'and would silently resolve from generic factors',
        );
      }
      if (!baseUrl) {
        throw new Error('base_url is required: Node cannot resolve relative API paths');
      }

      const { data: run } = await supabase
        .from('lca_calculation_runs')
        .select('id, product_id, organization_id, requested_by, trigger')
        .eq('id', runId)
        .maybeSingle();
      if (!run) throw new Error(`Run ${runId} not found`);

      const { data: product } = await supabase
        .from('products')
        .select('id, name, unit, organization_id, last_wizard_settings')
        .eq('id', run.product_id)
        .maybeSingle();
      if (!product) throw new Error(`Product ${run.product_id} not found`);

      const settings = (product.last_wizard_settings ?? {}) as Record<string, any>;
      // Deliberately mirrors recalculateProductLca: a missing boundary once
      // silently replaced a published cradle-to-grave footprint with a
      // gate-only one, and the number shrank with nobody able to see why.
      if (!settings.systemBoundary) {
        throw new Error(
          'This product has no saved system boundary. Set one in the LCA before recalculating.',
        );
      }

      const { data: pcfs } = await supabase
        .from('product_carbon_footprints')
        .select('id, status, draft_data')
        .eq('product_id', run.product_id)
        .eq('organization_id', run.organization_id)
        .order('updated_at', { ascending: false })
        .limit(5);
      const pcfsForPromotion = pcfs;

      let allocations: any[] = [];
      for (const pcf of (pcfs ?? []) as Array<{ draft_data: any }>) {
        const found = toValidAllocations(pcf?.draft_data?.facilityAllocations);
        if (found.length > 0) {
          allocations = found;
          break;
        }
      }
      // A product's very first estimate legitimately has no facility data yet:
      // nobody has linked a site, and refusing here would leave the cellar
      // showing a blank where the whole point is to show something honest.
      // Materials-only is the correct starting picture, and the dossier says so
      // plainly ("no site is linked yet, so making it counts as zero, that is
      // almost certainly too low").
      //
      // For any other trigger the guard stands: recalculating an established
      // footprint without the facility data it previously had would silently
      // shrink the number with nobody able to see why.
      const firstEstimate = run.trigger === 'first_recipe';
      if (allocations.length === 0 && !firstEstimate) {
        throw new Error(
          'No facility allocations found. Recalculating without them would understate ' +
            'processing emissions, so this product must be re-run through the LCA first.',
        );
      }

      // Promote an existing estimate or draft in place rather than inserting a
      // second row beside it. Without this, a product born with an estimated
      // footprint would end up with two records, and the newer one would lose
      // the boundary_source='defaulted' marker that makes the boundary ask
      // fire, so the assumption would quietly become indistinguishable from a
      // decision somebody made.
      const promotable = (pcfsForPromotion ?? []).find((p: any) =>
        ['estimate', 'draft', 'failed'].includes(p.status),
      );

      await patchRun(supabase, runId, {
        status: 'running',
        percent: 5,
        phase_message: 'Loading product data',
      });

      return {
        productId: String(product.id),
        productName: product.name as string,
        unit: (product.unit as string) || 'unit',
        requestedBy: run.requested_by as string | null,
        draftPcfId: (promotable as any)?.id ?? null,
        settings,
        allocations,
      };
    });

    // ── Calculate ────────────────────────────────────────────────────────
    // One step: the calculator is a single long transaction against the PCF
    // row and is not safely resumable part-way. Progress is written to the run
    // row as it goes, so the UI still sees movement.
    const outcome = await step.run('calculate', async () => {
      const result = await calculateProductLCA({
        productId: plan.productId,
        functionalUnit: `1 ${plan.unit} of ${plan.productName}`,
        systemBoundary: plan.settings.systemBoundary,
        referenceYear: plan.settings.referenceYear,
        facilityAllocations: plan.allocations,
        usePhaseConfig: plan.settings.usePhaseConfig,
        eolConfig: plan.settings.eolConfig,
        distributionConfig: plan.settings.distributionConfig,
        productLossConfig: plan.settings.productLossConfig,
        draftPcfId: plan.draftPcfId ?? undefined,
        userId: plan.requestedBy ?? undefined,
        context: {
          supabase,
          service: { secret: process.env.CRON_SECRET!, baseUrl },
        },
        onProgress: (phase, percent) => {
          // Fire and forget: progress is a courtesy to the watching UI, and
          // must never slow down or fail the calculation itself.
          void patchRun(supabase, runId, { percent, phase_message: phase });
        },
      });

      if (!result.success) {
        throw new Error(result.error || 'Calculation failed');
      }
      return { pcfId: result.pcfId };
    });

    // ── Scenarios ────────────────────────────────────────────────────────
    // One core, N cheap downstream passes. Separate step so a scenario failure
    // retries on its own rather than re-running the expensive calculation, and
    // so a product with no scenarios costs nothing.
    await step.run('recompute-scenarios', async () => {
      if (!outcome.pcfId) return { computed: 0 };
      await patchRun(supabase, runId, { percent: 95, phase_message: 'Updating routes to market' });
      const result = await recomputeScenariosForPcf(supabase, outcome.pcfId);
      if (result.computed > 0) {
        console.log(`[lcaRecalcRun] Recomputed ${result.computed} end-use scenario(s)`);
      }
      return result;
    });

    // ── Peer benchmark cohort ────────────────────────────────────────────
    // A fresh footprint joins the cohort the moment it exists, rather than
    // waiting for tomorrow's sweep. Its own step so a benchmark write retries
    // without re-running the calculation, and it never fails the run: the
    // helper swallows its own errors and this step only reports what happened.
    await step.run('snapshot-benchmark-intensity', async () => {
      if (!outcome.pcfId) return { written: 0 };
      const result = await snapshotSingleProductIntensity(supabase, outcome.pcfId);
      if (result.error) {
        console.error(`[lcaRecalcRun] benchmark snapshot failed: ${result.error}`);
      } else if (result.skipped) {
        console.log(`[lcaRecalcRun] product excluded from the benchmark cohort: ${result.skipped}`);
      }
      return { written: result.row ? 1 : 0, skipped: result.skipped };
    });

    await step.run('finalise', async () => {
      await patchRun(supabase, runId, {
        status: 'completed',
        percent: 100,
        phase_message: null,
        pcf_id: outcome.pcfId ?? null,
        error: null,
      });
    });

    return { runId, pcfId: outcome.pcfId };
  },
);
