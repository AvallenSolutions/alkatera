/**
 * Foundation A: generic versioned upsert into factor_sets / reference_factors.
 *
 * Loading a release:
 *   1. If this exact (provider, dataset, version) set already exists, REFRESH it
 *      (delete its factors, re-insert) — idempotent re-runs, no history churn.
 *   2. Otherwise mark the prior current set for this (provider, dataset) as
 *      superseded (stamp valid_to = the new set's valid_from), then insert the
 *      new set as current (valid_to = null) and its factors.
 *
 * Requires a service-role Supabase client (writes bypass RLS, like the Agribalyse
 * backfill). Returns a small summary for logging.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import type { FactorSetSpec, ParsedFactor, LoadFactorSetResult } from './types'

export async function loadFactorSet(
  supabase: SupabaseClient,
  spec: FactorSetSpec,
  factors: ParsedFactor[],
): Promise<LoadFactorSetResult> {
  if (factors.length === 0) {
    throw new Error(`Loader for ${spec.provider}/${spec.dataset}@${spec.version} produced no factors`)
  }

  // 1. Existing exact version? Refresh in place.
  const { data: existing } = await supabase
    .from('factor_sets')
    .select('id')
    .eq('provider', spec.provider)
    .eq('dataset', spec.dataset)
    .eq('version', spec.version)
    .maybeSingle()

  let setId: string
  let supersededVersion: string | null = null

  if (existing?.id) {
    setId = existing.id
    await supabase.from('reference_factors').delete().eq('factor_set_id', setId)
  } else {
    // 2. Supersede the current set for this provider/dataset (if any).
    const { data: current } = await supabase
      .from('factor_sets')
      .select('id, version')
      .eq('provider', spec.provider)
      .eq('dataset', spec.dataset)
      .is('valid_to', null)
      .maybeSingle()

    if (current?.id) {
      supersededVersion = current.version ?? null
      await supabase
        .from('factor_sets')
        .update({ valid_to: spec.validFrom })
        .eq('id', current.id)
    }

    const { data: inserted, error: insertErr } = await supabase
      .from('factor_sets')
      .insert({
        provider: spec.provider,
        dataset: spec.dataset,
        version: spec.version,
        valid_from: spec.validFrom,
        valid_to: null,
        licence: spec.licence,
        source_url: spec.sourceUrl ?? null,
        metadata: spec.metadata ?? {},
      })
      .select('id')
      .single()

    if (insertErr || !inserted?.id) {
      throw new Error(`Failed to insert factor_set: ${insertErr?.message ?? 'unknown error'}`)
    }
    setId = inserted.id
  }

  // Insert the factors.
  const rows = factors.map((f) => ({
    factor_set_id: setId,
    kind: f.kind,
    lookup_key: f.lookupKey,
    scope: f.scope ?? null,
    factor: f.factor,
    unit: f.unit,
    uncertainty: f.uncertainty ?? null,
    geographic_scope: f.geographicScope ?? null,
    metadata: f.metadata ?? {},
  }))

  const { error: factorsErr } = await supabase.from('reference_factors').insert(rows)
  if (factorsErr) {
    throw new Error(`Failed to insert reference_factors: ${factorsErr.message}`)
  }

  return {
    provider: spec.provider,
    dataset: spec.dataset,
    version: spec.version,
    factorsInserted: rows.length,
    supersededVersion,
  }
}
