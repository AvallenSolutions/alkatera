import type { SupabaseClient } from '@supabase/supabase-js';
import { DELETE_PRODUCT_IDS, KEEP_PRODUCT_IDS, ORCHARD_ID, makeCtx, type SeedCtx } from './shared';
import { seedEntities } from './entities';
import { seedOperations } from './operations';
import { seedProgramme } from './programme';
import { seedSupplyChain } from './supply-chain';

export interface SeedOutcome {
  ok: boolean;
  report: Record<string, string>;
  warnings: string[];
  nextSteps: string[];
}

/**
 * Build the complete alkatera Drinks Co demo dataset. Idempotent and
 * service-role: re-running converges on the same state. The LCA numbers
 * themselves come from the browser recalc tool afterwards (the calculator is
 * client-side), which is why products are left "recalc-ready".
 */
export async function seedDrinksCoDemo(svc: SupabaseClient): Promise<SeedOutcome> {
  const ctx: SeedCtx = makeCtx(svc);

  await seedEntities(ctx);
  await seedOperations(ctx);
  await seedProgramme(ctx);
  await seedSupplyChain(ctx);

  return {
    ok: true,
    report: ctx.report,
    warnings: ctx.warnings,
    nextSteps: [
      'Switch to the alkatera Drinks Co org, then open Admin Tools → Recalculate LCAs and run it to compute the real product footprints (the calculator runs in the browser).',
      'Verify one regenerated LCA report (e.g. the Cotswolds Estate Bacchus wine) before relying on the batch.',
      'Walk the Pulse overview, company footprint, water dashboard, targets + MACC, B Corp readiness, social sections and suppliers to confirm every area renders.',
    ],
  };
}

/**
 * Remove the demo dataset this seeder owns (best-effort), leaving the org shell,
 * the six real facilities and the keeper products in place. Used by the reset
 * button so a demo can be rebuilt cleanly.
 */
export async function resetDrinksCoDemo(svc: SupabaseClient): Promise<SeedOutcome> {
  const ctx: SeedCtx = makeCtx(svc);
  const { orgId } = ctx;
  const removed: string[] = [];

  const ownedFacilities = await svc.from('facilities').select('id').eq('organization_id', orgId);
  const facIds = (ownedFacilities.data ?? []).map((r: any) => r.id);

  const clear = async (table: string, col: string, val: unknown) => {
    const { error } = await svc.from(table).delete().eq(col, val as never);
    if (error) ctx.warnings.push(`${table}: ${error.message}`);
    else removed.push(table);
  };

  // operational + programme + supply-chain data is fully owned by the seed
  if (facIds.length) {
    await svc.from('utility_data_entries').delete().in('facility_id', facIds);
    removed.push('utility_data_entries');
  }
  await clear('facility_activity_entries', 'organization_id', orgId);
  await clear('production_logs', 'organization_id', orgId);
  await clear('vitality_score_snapshots', 'organization_id', orgId);
  await clear('organization_vitality_scores', 'organization_id', orgId);
  await clear('reduction_initiatives', 'organization_id', orgId); // cascades initiative_target_links
  await clear('sustainability_targets', 'organization_id', orgId);
  await clear('flag_targets', 'organization_id', orgId);
  await clear('carbon_budgets', 'organization_id', orgId);
  await clear('certification_score_history', 'organization_id', orgId);
  await clear('evidence_suggestions', 'organization_id', orgId);
  await clear('evidence_documents', 'organization_id', orgId);
  await clear('organization_certifications', 'organization_id', orgId);
  await clear('people_employee_compensation', 'organization_id', orgId);
  await clear('community_impact_stories', 'organization_id', orgId);
  await clear('community_engagements', 'organization_id', orgId);
  await clear('governance_ethics_records', 'organization_id', orgId);
  await clear('suppliers', 'organization_id', orgId); // cascades ESG + engagements
  await clear('xero_transactions', 'organization_id', orgId);
  await clear('xero_connections', 'organization_id', orgId);
  await clear('operational_change_events', 'organization_id', orgId);
  await clear('dashboard_anomalies', 'organization_id', orgId);
  await svc.from('orchard_growing_profiles').delete().eq('orchard_id', ORCHARD_ID);
  await svc.from('orchards').delete().eq('id', ORCHARD_ID);
  // seed draft PCFs + computed PCFs for the keeper products
  await svc.from('product_carbon_footprints').delete().eq('organization_id', orgId).in('product_id', KEEP_PRODUCT_IDS);

  ctx.report.reset = `cleared ${new Set(removed).size} seed tables`;
  return { ok: true, report: ctx.report, warnings: ctx.warnings, nextSteps: ['Re-run the seed to rebuild the demo dataset.'] };
}

export { DELETE_PRODUCT_IDS, KEEP_PRODUCT_IDS };
