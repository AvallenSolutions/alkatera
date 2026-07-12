/**
 * Rosa — action proposal + execution pipeline.
 *
 * Write-capable tools never mutate directly. They insert a row into
 * `rosa_pending_actions` with status='pending' and a human-readable preview.
 * The frontend renders an ActionProposalCard with Confirm / Cancel buttons.
 *
 *   - Confirm → POST /api/rosa/actions/[id]/confirm → executeAction()
 *   - Cancel  → POST /api/rosa/actions/[id]/cancel  → cancelAction()
 *
 * executeAction() dispatches on `tool_name` to the underlying mutation and
 * stores the result on the row for audit. One confirmation = one mutation.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { isReadOnlyAdvisor } from '@/lib/auth/advisor-access';
import { findSmartMeterOverlap } from '@/lib/energy/smart-meter-conflict';
import { createVolume } from '@/lib/hospitality/volume-service';
import { createWaste } from '@/lib/hospitality/waste-service';

export interface ProposeInput {
  organizationId: string;
  userId: string;
  conversationId?: string | null;
  messageId?: string | null;
  toolName: string;
  payload: Record<string, unknown>;
  preview: string;
}

export interface PendingAction {
  id: string;
  organization_id: string;
  user_id: string;
  tool_name: string;
  payload: Record<string, unknown>;
  preview: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'executed' | 'failed';
  result: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

export async function proposeAction(
  supabase: SupabaseClient,
  input: ProposeInput,
): Promise<{ ok: true; id: string } | { ok: false; error: string }> {
  const { data, error } = await supabase
    .from('rosa_pending_actions')
    .insert({
      organization_id: input.organizationId,
      user_id: input.userId,
      conversation_id: input.conversationId ?? null,
      message_id: input.messageId ?? null,
      tool_name: input.toolName,
      payload: input.payload,
      preview: input.preview,
      status: 'pending',
    })
    .select('id')
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, id: (data as any).id };
}

export async function loadPendingAction(
  supabase: SupabaseClient,
  actionId: string,
  userId: string,
): Promise<PendingAction | null> {
  const { data } = await supabase
    .from('rosa_pending_actions')
    .select('*')
    .eq('id', actionId)
    .eq('user_id', userId)
    .maybeSingle();
  return (data as any) ?? null;
}

export async function cancelAction(
  supabase: SupabaseClient,
  actionId: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const row = await loadPendingAction(supabase, actionId, userId);
  if (!row) return { ok: false, error: 'Action not found' };
  if (row.status !== 'pending') return { ok: false, error: `Action already ${row.status}` };
  const { error } = await supabase
    .from('rosa_pending_actions')
    .update({ status: 'cancelled', updated_at: new Date().toISOString() })
    .eq('id', actionId);
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

/**
 * Execute a confirmed action. Dispatches on tool_name to the specific mutation.
 * Stores the result on the row and returns it. Never throws: errors go into
 * status='failed' with an error string in `result`.
 */
export async function executeAction(
  supabase: SupabaseClient,
  actionId: string,
  userId: string,
): Promise<{ ok: boolean; result?: Record<string, unknown>; error?: string }> {
  const row = await loadPendingAction(supabase, actionId, userId);
  if (!row) return { ok: false, error: 'Action not found' };
  if (row.status !== 'pending') return { ok: false, error: `Action already ${row.status}` };

  // Read-only advisors may propose actions but must never apply them — the
  // dispatch below mutates org data via the service-role client, bypassing RLS.
  if (await isReadOnlyAdvisor(supabase, userId, row.organization_id)) {
    return { ok: false, error: 'Read-only advisors cannot apply changes to this organisation.' };
  }

  // Flag confirmed first so we never double-execute.
  await supabase
    .from('rosa_pending_actions')
    .update({ status: 'confirmed', updated_at: new Date().toISOString() })
    .eq('id', actionId);

  try {
    const result = await dispatchMutation(supabase, row);
    await supabase
      .from('rosa_pending_actions')
      .update({
        status: 'executed',
        result,
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId);
    return { ok: true, result };
  } catch (err: any) {
    const error = err?.message ?? 'Unknown error';
    await supabase
      .from('rosa_pending_actions')
      .update({
        status: 'failed',
        result: { error },
        updated_at: new Date().toISOString(),
      })
      .eq('id', actionId);
    return { ok: false, error };
  }
}

async function dispatchMutation(
  supabase: SupabaseClient,
  row: PendingAction,
): Promise<Record<string, unknown>> {
  const p = row.payload;
  switch (row.tool_name) {
    case 'propose_log_utility_entry':
      return await execLogUtilityEntry(supabase, row.organization_id, p);
    case 'propose_set_target':
      return await execSetTarget(supabase, row.organization_id, row.user_id, p);
    case 'propose_add_supplier':
      return await execAddSupplier(supabase, row.organization_id, p);
    case 'propose_approve_exception':
      return await execApproveException(supabase, row.organization_id, row.user_id, p);
    case 'propose_reject_exception':
      return await execRejectException(supabase, row.organization_id, row.user_id, p);
    case 'propose_match_emission_factor':
      return await execMatchEmissionFactor(supabase, row.organization_id, p);
    case 'propose_apply_proxy':
      return await execApplyProxy(supabase, row.organization_id, p);
    case 'propose_create_lca_draft':
      return await execCreateLcaDraft(supabase, row.organization_id, row.user_id, p);
    case 'propose_dismiss_anomaly':
      return await execDismissAnomaly(supabase, row.organization_id, row.user_id, p);
    case 'propose_set_progress_tracker':
      return await execSetProgressTracker(supabase, row.organization_id, row.user_id, p);
    case 'propose_save_bcorp_answer':
      return await execSaveBcorpAnswer(supabase, row.organization_id, p);
    case 'propose_log_service_volume':
      return await execLogServiceVolume(supabase, row.organization_id, p);
    case 'propose_log_hospitality_waste':
      return await execLogHospitalityWaste(supabase, row.organization_id, p);
    default:
      throw new Error(`Unsupported action tool: ${row.tool_name}`);
  }
}

const PROGRESS_TRACKER_IDS = [
  'total_emissions',
  'water_use',
  'lca_coverage',
  'supplier_esg_signal',
  'target_progress',
  'custom_rosa',
] as const;

async function execSetProgressTracker(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const trackerId = String(p?.tracker_id ?? '');
  if (!(PROGRESS_TRACKER_IDS as readonly string[]).includes(trackerId)) {
    throw new Error(`Invalid tracker_id: ${trackerId}`);
  }
  const targetId = p?.target_id ? String(p.target_id) : undefined;
  const stored = {
    v: 1 as const,
    tracker_id: trackerId,
    target_id: targetId,
    set_at: new Date().toISOString(),
    set_by: 'rosa_proposal' as const,
  };
  const value = JSON.stringify(stored).slice(0, 1000);

  // rosa_memory's unique index uses COALESCE(user_id, ...), so ON CONFLICT
  // can't match it — do the upsert manually.
  const { data: existing } = await supabase
    .from('rosa_memory')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .eq('scope', 'user')
    .eq('key', 'progress_tracker_v1')
    .maybeSingle();
  if (existing) {
    const { error } = await supabase
      .from('rosa_memory')
      .update({ value, updated_at: new Date().toISOString() })
      .eq('id', (existing as any).id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from('rosa_memory').insert({
      organization_id: organizationId,
      user_id: userId,
      scope: 'user',
      key: 'progress_tracker_v1',
      value,
    });
    if (error) throw new Error(error.message);
  }
  // Bust the tracker cache so the next GET regenerates.
  await supabase
    .from('rosa_progress_tracker_cache')
    .delete()
    .eq('organization_id', organizationId)
    .eq('user_id', userId);
  return { ok: true, tracker_id: trackerId, target_id: targetId };
}

/**
 * Save a Rosa-drafted answer onto a B Corp requirement as an evidence note.
 * Always UNVERIFIED (pending) — a draft never marks a requirement as met; a
 * human still has to verify it. Mirrors the evidence-POST route's insert +
 * readiness recalc.
 */
async function execSaveBcorpAnswer(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const code = String(p.requirement_code ?? '').trim();
  const answer = String(p.answer ?? '').trim();
  if (!code) throw new Error('requirement_code is required.');
  if (!answer) throw new Error('answer is required.');

  const { data: framework } = await supabase
    .from('certification_frameworks')
    .select('id')
    .eq('framework_code', 'bcorp_2026')
    .maybeSingle();
  if (!framework) throw new Error('B Corp 2026 framework not found.');
  const frameworkId = (framework as any).id;

  const { data: req } = await supabase
    .from('certification_framework_requirements')
    .select('id, requirement_name')
    .eq('framework_id', frameworkId)
    .ilike('requirement_code', code)
    .maybeSingle();
  if (!req) throw new Error(`No B Corp requirement matching "${code}" was found.`);
  const requirementId = (req as any).id;

  const { data, error } = await supabase
    .from('certification_evidence_links')
    .insert({
      organization_id: organizationId,
      framework_id: frameworkId,
      requirement_id: requirementId,
      evidence_type: 'note',
      source_module: 'rosa',
      evidence_description: answer,
      verification_status: 'pending',
      notes: 'Drafted with Rosa',
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  // Refresh readiness so the requirement flips to in-progress (pending review).
  try {
    const { recalculateAndNotify } = await import(
      '@/lib/certifications/recalculate'
    );
    await recalculateAndNotify(supabase, organizationId);
  } catch (e) {
    console.error('recalc after Rosa evidence save failed:', e);
  }

  return {
    evidence_id: (data as any).id,
    requirement_code: code,
    requirement_id: requirementId,
    verification_status: 'pending',
    table: 'certification_evidence_links',
  };
}

async function execLogServiceVolume(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const res = await createVolume(supabase as any, organizationId, {
    product_id: p.product_id,
    units_sold: p.units_sold,
    period_start: p.period_start,
    period_end: p.period_end,
    note: p.note,
  });
  if (!res.ok) throw new Error(res.error);
  return { volume_id: res.data.id, table: 'hospitality_service_volumes' };
}

async function execLogHospitalityWaste(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const res = await createWaste(supabase as any, organizationId, {
    waste_stream: p.waste_stream,
    treatment_method: p.treatment_method,
    mass_kg: p.mass_kg,
    period_start: p.period_start,
    period_end: p.period_end,
    venue_id: p.venue_id,
    note: p.note,
  });
  if (!res.ok) throw new Error(res.error);
  return { waste_id: res.data.id, table: 'hospitality_waste' };
}

async function execLogUtilityEntry(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const facilityId = String(p.facility_id);
  const row = {
    organization_id: organizationId,
    facility_id: facilityId,
    utility_type: String(p.utility_type),
    quantity: Number(p.quantity),
    unit: String(p.unit),
    reporting_period_start: String(p.reporting_period_start),
    reporting_period_end: String(p.reporting_period_end),
    activity_date: p.activity_date ? String(p.activity_date) : null,
    notes: p.notes ? String(p.notes) : null,
    data_quality: 'measured',
  };
  const { data, error } = await supabase
    .from('utility_data_entries')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { entry_id: (data as any).id, table: 'utility_data_entries' };
}

async function execSetTarget(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const row = {
    organization_id: organizationId,
    created_by: userId,
    metric_key: String(p.metric_key),
    baseline_value: Number(p.baseline_value),
    baseline_date: String(p.baseline_date),
    target_value: Number(p.target_value),
    target_date: String(p.target_date),
    scope: p.scope ? String(p.scope) : null,
    methodology: p.methodology ? String(p.methodology) : null,
    notes: p.notes ? String(p.notes) : null,
    status: 'active',
  };
  const { data, error } = await supabase
    .from('sustainability_targets')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { target_id: (data as any).id, table: 'sustainability_targets' };
}

async function execAddSupplier(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const row = {
    organization_id: organizationId,
    name: String(p.name),
    contact_name: p.contact_name ? String(p.contact_name) : null,
    contact_email: p.contact_email ? String(p.contact_email) : null,
    industry_sector: p.industry_sector ? String(p.industry_sector) : null,
    country: p.country ? String(p.country) : null,
    website: p.website ? String(p.website) : null,
    annual_spend: p.annual_spend !== undefined ? Number(p.annual_spend) : null,
    notes: p.notes ? String(p.notes) : null,
  };
  const { data, error } = await supabase
    .from('suppliers')
    .insert(row)
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { supplier_id: (data as any).id, table: 'suppliers' };
}

/**
 * Approve a queue item. v1 supports: setting status='approved' on the
 * exception and stamping reviewed metadata. The actual save dispatch to
 * downstream tables (utility_data_entries etc.) is performed via a small
 * helper that mirrors the approve path the queue UI uses, but stays
 * org-scoped via the service role client.
 *
 * For utility_bill / water_bill / waste_bill kinds we directly insert
 * the parsed entries; for other kinds we record approval and rely on the
 * user to follow the queue's deep-link to handle the doc on its native
 * page (matches the existing UI's behaviour).
 */
async function execApproveException(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const exceptionId = String(p.exception_id);
  const { data: ex, error: exErr } = await supabase
    .from('agent_exceptions')
    .select('*')
    .eq('id', exceptionId)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (exErr || !ex) throw new Error('Exception not found.');
  if ((ex as any).status !== 'open') {
    throw new Error(`Exception is not open (status: ${(ex as any).status}).`);
  }

  const facilityId = p.facility_id ?? (ex as any).suggested_facility_id;
  let appliedTo: Record<string, unknown> = { table: null, deferred_save: true, kind: (ex as any).kind };

  if (
    ((ex as any).kind === 'utility_bill' ||
      (ex as any).kind === 'water_bill' ||
      (ex as any).kind === 'waste_bill') &&
    facilityId
  ) {
    const payload = (ex as any).payload || {};
    const bill =
      (ex as any).kind === 'utility_bill' ? payload.utilityBill || payload :
      (ex as any).kind === 'water_bill' ? payload.waterBill || payload :
      payload.wasteBill || payload;
    const periodStart = bill?.period_start || null;
    const periodEnd = bill?.period_end || null;
    const entries = (bill?.entries || []).filter((e: any) => e?.quantity > 0);

    if (entries.length === 0) {
      throw new Error('No valid entries on this exception to write.');
    }
    if (!periodStart || !periodEnd) {
      throw new Error('Period dates missing on the parsed bill.');
    }

    if ((ex as any).kind === 'utility_bill') {
      // "Enter consumption once": block if smart-meter data already covers these
      // months for electricity/gas (resolve on the Energy & grid tab first).
      const overlap = await findSmartMeterOverlap(
        supabase,
        facilityId,
        entries.map((e: any) => e.utility_type),
        periodStart,
        periodEnd,
      );
      if (overlap.length > 0) {
        throw new Error(
          `Smart-meter data already covers ${periodStart} to ${periodEnd} for this facility, so saving this bill ` +
            `would double-count it. Resolve it on the facility's Energy & grid tab, then approve.`,
        );
      }
      const rows = entries.map((entry: any) => ({
        organization_id: organizationId,
        facility_id: facilityId,
        utility_type: entry.utility_type,
        quantity: Number(entry.quantity),
        unit: entry.unit || 'kWh',
        reporting_period_start: periodStart,
        reporting_period_end: periodEnd,
        data_quality: 'actual',
        created_by: userId,
        mpan: entry.mpan ? String(entry.mpan).replace(/\s+/g, '') : null,
        mprn: entry.mprn ? String(entry.mprn).replace(/\s+/g, '') : null,
        meter_type: entry.meter_type ?? null,
        rate_breakdown: entry.rate_breakdown ?? null,
      }));
      const { error } = await supabase.from('utility_data_entries').insert(rows);
      if (error) throw new Error(error.message);
      appliedTo = { table: 'utility_data_entries', saved: rows.length, facilityId };
    } else {
      const rows = entries.map((entry: any) => {
        const extra: Record<string, any> = {};
        if ((ex as any).kind === 'water_bill' && entry.water_source_type) {
          extra.water_source_type = entry.water_source_type;
        }
        if ((ex as any).kind === 'waste_bill' && entry.waste_treatment_method) {
          extra.waste_treatment_method = entry.waste_treatment_method;
        }
        return {
          organization_id: organizationId,
          facility_id: facilityId,
          activity_category: entry.activity_category,
          activity_date: periodStart,
          reporting_period_start: periodStart,
          reporting_period_end: periodEnd,
          quantity: Number(entry.quantity),
          unit: entry.unit || ((ex as any).kind === 'water_bill' ? 'm3' : 'kg'),
          data_provenance: 'primary_measured_onsite',
          allocation_basis: 'none',
          created_by: userId,
          ...extra,
        };
      });
      const { error } = await supabase.from('facility_activity_entries').insert(rows);
      if (error) throw new Error(error.message);
      appliedTo = { table: 'facility_activity_entries', saved: rows.length, facilityId };
    }
  }

  const { error: updErr } = await supabase
    .from('agent_exceptions')
    .update({
      status: 'approved',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      applied_to: appliedTo,
    })
    .eq('id', exceptionId);
  if (updErr) throw new Error(updErr.message);

  return { exception_id: exceptionId, ...appliedTo };
}

async function execRejectException(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const exceptionId = String(p.exception_id);
  const { error } = await supabase
    .from('agent_exceptions')
    .update({
      status: 'rejected',
      reviewed_by: userId,
      reviewed_at: new Date().toISOString(),
      review_notes: p.reason ? String(p.reason) : null,
    })
    .eq('id', exceptionId)
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return { exception_id: exceptionId, status: 'rejected' };
}

async function execMatchEmissionFactor(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const ingredientId = String(p.ingredient_id);
  const factorName = String(p.factor_name);
  const source = String(p.factor_source);
  const { error } = await supabase
    .from('recipe_ingredients')
    .update({
      matched_source_name: factorName,
      ef_source: source,
      ef_data_quality_grade: 'C',
      data_source: source,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ingredientId)
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return {
    ingredient_id: ingredientId,
    factor_name: factorName,
    factor_source: source,
    table: 'recipe_ingredients',
  };
}

async function execApplyProxy(
  supabase: SupabaseClient,
  organizationId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const ingredientId = String(p.ingredient_id);
  const factorName = String(p.proxy_factor_name);
  const source = String(p.proxy_factor_source);
  const confidence = Number(p.confidence_pct);
  const { error } = await supabase
    .from('recipe_ingredients')
    .update({
      matched_source_name: factorName,
      ef_source: source,
      ef_source_type: 'proxy',
      ef_data_quality_grade: confidence >= 75 ? 'C' : 'D',
      ef_uncertainty_percent: 100 - confidence,
      data_source: source,
      updated_at: new Date().toISOString(),
    })
    .eq('id', ingredientId)
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return {
    ingredient_id: ingredientId,
    proxy_factor_name: factorName,
    confidence_pct: confidence,
    table: 'recipe_ingredients',
  };
}

async function execCreateLcaDraft(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const productId = String(p.product_id);
  const systemBoundary = p.system_boundary ? String(p.system_boundary) : 'cradle-to-gate';

  const { data: product } = await supabase
    .from('products')
    .select('name')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle();

  const { data, error } = await supabase
    .from('product_carbon_footprints')
    .insert({
      organization_id: organizationId,
      product_id: productId,
      product_name: (product as any)?.name ?? null,
      status: 'draft',
      system_boundary: systemBoundary,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return {
    lca_id: (data as any).id,
    product_id: productId,
    table: 'product_carbon_footprints',
  };
}

async function execDismissAnomaly(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  p: any,
): Promise<Record<string, unknown>> {
  const anomalyId = String(p.anomaly_id);
  const { error } = await supabase
    .from('dashboard_anomalies')
    .update({
      status: 'dismissed',
      dismissed_at: new Date().toISOString(),
      acknowledged_by: userId,
      notes: p.reason ? String(p.reason) : null,
    })
    .eq('id', anomalyId)
    .eq('organization_id', organizationId);
  if (error) throw new Error(error.message);
  return { anomaly_id: anomalyId, status: 'dismissed' };
}
