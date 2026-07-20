import type { SupabaseClient } from '@supabase/supabase-js';
import { DELETE_PRODUCT_IDS, KEEP_PRODUCT_IDS, ORCHARD_ID, makeCtx, type SeedCtx } from './shared';
import { ensureFoundation } from './foundation';
import { seedEntities } from './entities';
import { seedCompletedLcas } from './lca';
import { seedOperations } from './operations';
import { seedProgramme } from './programme';
import { seedSupplyChain } from './supply-chain';
import { seedEnergyGeo } from './energy-geo';
import { seedRosa } from './rosa';
import { seedHospitality } from './hospitality';
import { seedEpr } from './epr';
import { seedReports } from './reports';

export interface SeedOutcome {
  ok: boolean;
  report: Record<string, string>;
  warnings: string[];
  nextSteps: string[];
}

/**
 * Build the complete alkatera Drinks Co demo dataset. Idempotent and
 * service-role: re-running converges on the same state.
 *
 * The calculator is browser-only, so a service-role seeder cannot invoke it.
 * lca.ts therefore writes COMPLETED PCFs with hand-modelled impacts and every
 * product shows a footprint immediately. Do NOT run the recalc tool afterwards:
 * it would find nothing to work from and skip every product. This comment used
 * to say the opposite.
 */
export async function seedDrinksCoDemo(svc: SupabaseClient): Promise<SeedOutcome> {
  const ctx: SeedCtx = makeCtx(svc);

  // First: on an empty environment (staging, fresh local) create the org,
  // owner membership, facilities, vineyard and keeper products the rest of the
  // seed assumes. On production, where they all exist, this changes nothing.
  await ensureFoundation(ctx);

  await seedEntities(ctx);
  await seedCompletedLcas(ctx);
  await seedOperations(ctx);
  await seedEnergyGeo(ctx); // after operations: replaces the head office's latest bill with smart-meter data
  await seedProgramme(ctx);
  await seedSupplyChain(ctx);
  // Breadth: these fill whole nav sections that previously rendered empty on a
  // fully-populated org, which reads as a broken feature rather than a demo
  // with nothing in it yet. Hospitality creates products (meals and drinks use
  // product_kind), so it runs after the product curation above.
  await seedHospitality(ctx);
  await seedEpr(ctx);
  await seedReports(ctx);
  await seedRosa(ctx);

  return {
    ok: true,
    report: ctx.report,
    warnings: ctx.warnings,
    nextSteps: [
      'Completed LCAs are seeded directly (realistic estimates), so every product shows a footprint immediately. Do NOT run Recalculate LCAs afterwards: the seeded footprints are the demo numbers, and a recalc would skip every product anyway.',
      'Switch to the alkatera Drinks Co org and walk the Pulse overview, products + an LCA report, company footprint, water dashboard, targets + MACC, B Corp readiness, social sections and suppliers to confirm every area renders.',
      'Newly filled this pass: Hospitality (venues, menus, 24 months of covers and waste), EPR (submissions, RPD lines, PRN obligations, audit trail), Rosa (past conversations, ratings, memories, a pending action) and the product Facilities tab / LCA production-sites section, which were empty because the seed threw its facility allocations away.',
      'Open the head office facility → "Energy & grid" tab for the half-hourly charts; the vineyard and orchard have coordinates + a SoilGrids soil-carbon baseline (give the Inngest job a moment).',
      'Check /admin/rosa-learning: the seeded ratings and telemetry should populate it, which is the quickest way to confirm the Rosa feedback loop works end to end.',
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
    await svc.from('smart_meter_readings').delete().in('facility_id', facIds);
    removed.push('smart_meter_readings');
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
  await clear('dashboard_insights', 'organization_id', orgId);

  // Breadth tables added alongside the hospitality / EPR / Rosa modules. All
  // three seeders are idempotent, so a re-seed converges without this, but a
  // reset that leaves their rows behind is not a reset.
  //
  // Hospitality meals and drinks are PRODUCTS (product_kind), not rows in
  // hospitality_meals, so they are removed by the product curation on the next
  // seed rather than here: deleting them blind would take real products with
  // them if the org ever gains hospitality products of its own.
  await clear('hospitality_menu_items', 'organization_id', orgId);
  await clear('hospitality_menus', 'organization_id', orgId);
  await clear('hospitality_service_volumes', 'organization_id', orgId);
  await clear('hospitality_operating_periods', 'organization_id', orgId);
  await clear('hospitality_waste', 'organization_id', orgId);
  await clear('hospitality_events', 'organization_id', orgId);
  await clear('hospitality_rooms', 'organization_id', orgId);
  await clear('hospitality_venues', 'organization_id', orgId);
  await clear('epr_submission_lines', 'organization_id', orgId);
  await clear('epr_submissions', 'organization_id', orgId);
  await clear('epr_prn_obligations', 'organization_id', orgId);
  await clear('epr_audit_log', 'organization_id', orgId);
  await clear('lca_report_templates', 'organization_id', orgId);
  await clear('historical_imports', 'organization_id', orgId);
  await clear('transition_plans', 'organization_id', orgId);
  await clear('materiality_assessments', 'organization_id', orgId);
  // generated_reports self-references via parent_report_id (NO ACTION), but a
  // whole-org delete removes parents and children together, so ordering is moot.
  await clear('generated_reports', 'organization_id', orgId);
  //
  // corporate_reports is deliberately NOT cleared. Its FKs cascade to
  // corporate_overheads and spend_import_batches, which the seed does not own:
  // they are user-entered overheads and imported spend. A reset that silently
  // destroys them is worse than one that leaves four report rows behind, and
  // reports.ts upserts on (organization_id, year) so a re-seed converges anyway.
  await clear('rosa_pending_actions', 'organization_id', orgId);
  await clear('rosa_telemetry', 'organization_id', orgId);
  await clear('rosa_memory', 'organization_id', orgId);
  await clear('gaia_conversations', 'organization_id', orgId); // cascades messages + feedback

  await svc.from('orchard_growing_profiles').delete().eq('orchard_id', ORCHARD_ID);
  await svc.from('orchards').delete().eq('id', ORCHARD_ID);
  // PCFs for the keeper products: clear children first (FKs don't cascade).
  const { data: pcfs } = await svc.from('product_carbon_footprints').select('id').eq('organization_id', orgId).in('product_id', KEEP_PRODUCT_IDS);
  const pcfIds = (pcfs ?? []).map((r: any) => r.id);
  if (pcfIds.length) {
    await svc.from('products').update({ latest_lca_id: null, has_active_lca: false }).eq('organization_id', orgId).in('id', KEEP_PRODUCT_IDS);
    await svc.from('product_carbon_footprint_materials').delete().in('product_carbon_footprint_id', pcfIds);
    await svc.from('product_carbon_footprint_production_sites').delete().in('product_carbon_footprint_id', pcfIds);
    await svc.from('product_carbon_footprints').delete().in('id', pcfIds);
  }

  ctx.report.reset = `cleared ${new Set(removed).size} seed tables`;
  return { ok: true, report: ctx.report, warnings: ctx.warnings, nextSteps: ['Re-run the seed to rebuild the demo dataset.'] };
}

export { DELETE_PRODUCT_IDS, KEEP_PRODUCT_IDS };
