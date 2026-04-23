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
    default:
      throw new Error(`Unsupported action tool: ${row.tool_name}`);
  }
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
