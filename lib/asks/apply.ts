/**
 * Applying an answer to an ask — tasks/data-revolution-plan.md, Pillar 3,
 * "Answering". Shared by the exceptions PATCH route's new 'answer' action
 * (app/api/agents/exceptions/[id]/route.ts) and Rosa's propose_answer_ask
 * tool (lib/rosa/tools.ts / lib/rosa/actions.ts execAnswerAsk), the same
 * way lib/intake/dispatch.ts is shared by the approve path on both — one
 * place owns "what does answering this kind of ask actually write."
 *
 * Every branch ends by flipping the target row's provenance signal to
 * "a human touched this": `match_status='verified'` (the exact value the
 * manual "Confirm" button on IngredientRow/PackagingRow already writes —
 * see components/products/IngredientRow.tsx), `quantities_status='confirmed'`
 * (RecipeEditor's own save path), `data_provenance='primary_supplier_verified'`
 * / `data_quality='actual'` (a human said the estimate is right, which is
 * exactly what those confirmed values already mean per
 * lib/provenance/index.ts), or `verification_status='self_declared'`
 * (production_run_resource_data's own vocabulary for "a human stands behind
 * this figure").
 *
 * A "no" / "I have the real figure" answer is still a real answer — it
 * counts as answered (telemetry logs it, the exception closes) but writes
 * nothing, since the honest next step is the deep link, not a guessed
 * value.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { logRosaTelemetry } from '@/lib/rosa/budget';
import type { AskPayload } from './types';

export interface AskExceptionRow {
  id: string;
  kind: string;
  status: string;
  organization_id: string;
  payload: AskPayload;
}

export type AppliedTo = Record<string, unknown>;

/**
 * Validate + apply one answer. Throws a plain, user-presentable Error on
 * any validation failure (matching the lib/intake/dispatch.ts convention) —
 * callers catch it and surface it as a 4xx / a failed pending action.
 * `supabase` must be able to write the target tables (service-role in
 * practice, same as dispatchExceptionWrite).
 */
export async function applyAskAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  exception: AskExceptionRow,
  answer: unknown,
): Promise<AppliedTo> {
  if (exception.kind !== 'ask') throw new Error('Not an ask.');
  if (exception.status !== 'open') throw new Error(`This ask is already ${exception.status}.`);
  if (exception.organization_id !== organizationId) throw new Error('Forbidden.');

  const payload = exception.payload;
  const askType = payload?.ask_type;

  const appliedTo = await applyByAskType(supabase, organizationId, payload, answer);

  await logRosaTelemetry(supabase, organizationId, userId, 'ask.answered', {
    exceptionId: exception.id,
    askType,
    answerShape: payload?.answer_shape,
    answer,
    written: appliedTo.written !== false,
  });

  return appliedTo;
}

async function applyByAskType(
  supabase: SupabaseClient,
  organizationId: string,
  payload: AskPayload,
  answer: unknown,
): Promise<AppliedTo> {
  switch (payload.ask_type) {
    case 'draft_gap_material':
      return applyDraftGapMaterial(supabase, organizationId, payload, answer);
    case 'draft_gap_hospitality_quantities':
      return applyHospitalityQuantities(supabase, organizationId, payload, answer);
    case 'draft_gap_utility':
      return applyDraftGapUtility(supabase, organizationId, payload, answer);
    case 'plausibility_production_run':
      return applyPlausibilityProductionRun(supabase, organizationId, payload, answer);
    case 'plausibility_packaging_weight':
      return applyPlausibilityPackagingWeight(supabase, organizationId, payload, answer);
    case 'growth_signal':
      throw new Error('Growth-band asks resolve by going and adding the record — approve or defer, not answer.');
    default:
      throw new Error(`No answer handler for ask_type "${payload.ask_type}".`);
  }
}

/** Ownership check for a product_materials row: it belongs to this org via its product. */
async function assertMaterialInOrg(supabase: SupabaseClient, organizationId: string, materialId: string): Promise<void> {
  const { data, error } = await supabase
    .from('product_materials')
    .select('id, products!inner(organization_id)')
    .eq('id', materialId)
    .eq('products.organization_id', organizationId)
    .maybeSingle();
  if (error || !data) throw new Error('Material not found for this organisation.');
}

async function applyDraftGapMaterial(
  supabase: SupabaseClient,
  organizationId: string,
  payload: AskPayload,
  answer: unknown,
): Promise<AppliedTo> {
  if (answer !== true) throw new Error('This ask only accepts a confirm — use defer if the amount looks wrong.');
  const target = payload.target;
  if (!target || target.table !== 'product_materials') throw new Error('Malformed ask target.');
  await assertMaterialInOrg(supabase, organizationId, target.id);

  const { error } = await supabase.from('product_materials').update({ match_status: 'verified' }).eq('id', target.id);
  if (error) throw new Error(error.message);
  return { table: 'product_materials', id: target.id, field: 'match_status', value: 'verified', written: true };
}

async function applyHospitalityQuantities(
  supabase: SupabaseClient,
  organizationId: string,
  payload: AskPayload,
  answer: unknown,
): Promise<AppliedTo> {
  if (typeof answer !== 'boolean') throw new Error('This ask needs a yes or no.');
  const target = payload.target;
  if (!target || target.table !== 'hospitality_meal_meta') throw new Error('Malformed ask target.');

  if (!answer) {
    return { table: null, written: false, note: 'Left as unconfirmed — open the recipe to fix the quantities.' };
  }

  const { error } = await supabase
    .from('hospitality_meal_meta')
    .update({ quantities_status: 'confirmed' })
    .eq('id', target.id)
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return { table: 'hospitality_meal_meta', id: target.id, field: 'quantities_status', value: 'confirmed', written: true };
}

async function applyDraftGapUtility(
  supabase: SupabaseClient,
  organizationId: string,
  payload: AskPayload,
  answer: unknown,
): Promise<AppliedTo> {
  const target = payload.target;
  if (!target) throw new Error('Malformed ask target.');
  const choice = String(answer);
  const validValues = new Set((payload.options ?? []).map((o) => o.value));
  if (!validValues.has(choice)) throw new Error('Pick one of the options offered.');

  if (choice === 'have_real_figure') {
    return { table: null, written: false, note: 'Left as estimated — enter the real figure from Scope 1 & 2 data entry.' };
  }

  if (target.table === 'facility_activity_entries') {
    const { data: row, error: fetchErr } = await supabase
      .from('facility_activity_entries')
      .select('id, organization_id')
      .eq('id', target.id)
      .maybeSingle();
    if (fetchErr || !row || (row as any).organization_id !== organizationId) {
      throw new Error('Entry not found for this organisation.');
    }
    const { error } = await supabase
      .from('facility_activity_entries')
      .update({ data_provenance: 'primary_supplier_verified' })
      .eq('id', target.id);
    if (error) throw new Error(error.message);
    return { table: 'facility_activity_entries', id: target.id, field: 'data_provenance', value: 'primary_supplier_verified', written: true };
  }

  if (target.table === 'utility_data_entries') {
    const { data: row, error: fetchErr } = await supabase
      .from('utility_data_entries')
      .select('id, facility_id, facilities!inner(organization_id)')
      .eq('id', target.id)
      .eq('facilities.organization_id', organizationId)
      .maybeSingle();
    if (fetchErr || !row) throw new Error('Entry not found for this organisation.');
    const { error } = await supabase.from('utility_data_entries').update({ data_quality: 'actual' }).eq('id', target.id);
    if (error) throw new Error(error.message);
    return { table: 'utility_data_entries', id: target.id, field: 'data_quality', value: 'actual', written: true };
  }

  throw new Error('Malformed ask target.');
}

function toPositiveNumber(answer: unknown): number {
  const n = Number(answer);
  if (!Number.isFinite(n) || n <= 0) throw new Error('Enter a number greater than zero.');
  return n;
}

async function applyPlausibilityProductionRun(
  supabase: SupabaseClient,
  organizationId: string,
  payload: AskPayload,
  answer: unknown,
): Promise<AppliedTo> {
  const target = payload.target;
  if (!target || target.table !== 'production_run_resource_data') throw new Error('Malformed ask target.');
  const value = toPositiveNumber(answer);

  const { data: row, error: fetchErr } = await supabase
    .from('production_run_resource_data')
    .select('id, organization_id')
    .eq('id', target.id)
    .maybeSingle();
  if (fetchErr || !row || (row as any).organization_id !== organizationId) {
    throw new Error('Production run not found for this organisation.');
  }

  const { error } = await supabase
    .from('production_run_resource_data')
    .update({ production_volume: value, verification_status: 'self_declared' })
    .eq('id', target.id);
  if (error) throw new Error(error.message);
  return { table: 'production_run_resource_data', id: target.id, field: 'production_volume', value, written: true };
}

async function applyPlausibilityPackagingWeight(
  supabase: SupabaseClient,
  organizationId: string,
  payload: AskPayload,
  answer: unknown,
): Promise<AppliedTo> {
  const target = payload.target;
  if (!target || target.table !== 'product_materials') throw new Error('Malformed ask target.');
  const value = toPositiveNumber(answer);
  await assertMaterialInOrg(supabase, organizationId, target.id);

  const { error } = await supabase
    .from('product_materials')
    .update({ net_weight_g: value, match_status: 'verified' })
    .eq('id', target.id);
  if (error) throw new Error(error.message);
  return { table: 'product_materials', id: target.id, field: 'net_weight_g', value, written: true };
}
