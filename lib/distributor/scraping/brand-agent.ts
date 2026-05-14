import type { SupabaseClient } from '@supabase/supabase-js';
import { ALL_SOURCES, type BrandSnapshot, type SourceFinding } from './sources';
import { scoreConfidence } from './confidence-scorer';
import { coerceFieldValue, type FieldKey } from './field-definitions';
import { delay } from './http';
import { recalculateCompleteness } from '../scoring/recalculate';

const DELAY_BETWEEN_SOURCES_MS = 2_000;

export interface RunBrandAgentArgs {
  supabase: SupabaseClient;
  brandProfileId: string;
  jobId: string;
}

export interface RunBrandAgentResult {
  sources_attempted: number;
  sources_succeeded: number;
  sources_skipped: number;
  findings_written: number;
  errors: string[];
  /** Informational, not failure: "source X skipped because Y". */
  skip_reasons: string[];
}

/**
 * Run every source for a single brand and persist findings.
 *
 * Flow:
 *   1. Load the brand snapshot.
 *   2. For each source: call run(brand), wait DELAY_BETWEEN_SOURCES_MS.
 *   3. For each finding: coerce → score confidence → soft-supersede any
 *      previous winner → insert a fresh scraped_brand_data row.
 *
 * The caller (cron route) is responsible for setting job status. This
 * function just returns counts + error messages.
 */
export async function runBrandAgent(args: RunBrandAgentArgs): Promise<RunBrandAgentResult> {
  const { supabase, brandProfileId, jobId } = args;

  const { data: brand, error } = await supabase
    .from('brand_profiles')
    .select('id, name, normalized_name, website, country_of_origin, category, outreach_email')
    .eq('id', brandProfileId)
    .maybeSingle();
  if (error || !brand) {
    return {
      sources_attempted: 0,
      sources_succeeded: 0,
      sources_skipped: 0,
      findings_written: 0,
      errors: [`brand_not_found: ${error?.message ?? brandProfileId}`],
      skip_reasons: [],
    };
  }

  const snapshot: BrandSnapshot = {
    id: brand.id,
    name: brand.name,
    normalized_name: brand.normalized_name,
    website: brand.website,
    country_of_origin: brand.country_of_origin,
    category: brand.category,
  };

  const errors: string[] = [];
  const skipReasons: string[] = [];
  let attempted = 0;
  let succeeded = 0;
  let skipped = 0;
  let written = 0;

  for (let i = 0; i < ALL_SOURCES.length; i++) {
    const source = ALL_SOURCES[i];
    attempted += 1;
    try {
      const result = await source.run(snapshot);
      if (result.skipped) {
        // Skips are intentional and not errors — just no data here. We
        // do still record the reason so the job log explains why this
        // source produced nothing (the brand has no website, the
        // Wikipedia page is a disambiguation, etc.).
        skipped += 1;
        skipReasons.push(`${source.name}: skipped (${result.reason ?? 'no_reason'})`);
      } else if (!result.ok) {
        errors.push(`${source.name}: ${result.reason ?? 'unknown_error'}`);
      } else {
        succeeded += 1;
        const newCount = await persistFindings(supabase, {
          brandProfileId,
          jobId,
          sourceName: source.name,
          sourceType: source.source_type,
          findings: result.findings,
        });
        written += newCount;
      }
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      errors.push(`${source.name}: threw ${message}`);
    }
    // Be polite — even on skip — so we don't flood a single source.
    if (i < ALL_SOURCES.length - 1) {
      await delay(DELAY_BETWEEN_SOURCES_MS);
    }
  }

  // Promote a scraped contact_email up onto brand_profiles.outreach_email
  // so the Phase 3 outreach dashboard can populate without manual input.
  // Only auto-fills when the brand has no outreach_email set — never
  // overwrites a value the distributor curated.
  if (!brand.outreach_email) {
    const { data: emailFinding } = await supabase
      .from('scraped_brand_data')
      .select('field_value, confidence')
      .eq('brand_profile_id', brandProfileId)
      .eq('field_key', 'contact_email')
      .is('superseded_by', null)
      .order('confidence', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (emailFinding?.field_value && emailFinding.confidence >= 0.5 && isEmail(emailFinding.field_value)) {
      await supabase
        .from('brand_profiles')
        .update({ outreach_email: emailFinding.field_value })
        .eq('id', brandProfileId)
        .is('outreach_email', null);
    }
  }

  // Refresh completeness score now that scraped_brand_data may have new
  // rows. Best-effort — if the Phase 5 migration is not yet applied,
  // the call no-ops because the snapshot insert fails silently.
  try {
    await recalculateCompleteness(supabase, brandProfileId);
  } catch {
    // swallow — score recalculation is a follow-on, not load-bearing.
  }

  return {
    sources_attempted: attempted,
    sources_succeeded: succeeded,
    sources_skipped: skipped,
    findings_written: written,
    errors,
    skip_reasons: skipReasons,
  };
}

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

async function persistFindings(
  supabase: SupabaseClient,
  args: {
    brandProfileId: string;
    jobId: string;
    sourceName: string;
    sourceType: 'certification_db' | 'brand_website' | 'regulatory_body' | 'company_registry' | 'other';
    findings: SourceFinding[];
  },
): Promise<number> {
  if (args.findings.length === 0) return 0;

  // Bucket by field_key so we only emit one new row per field per source
  // per run. If a source returned both a pattern_match and an llm_extract
  // for the same field, prefer pattern_match (cheaper signal, higher
  // confidence ceiling).
  const bestByField = new Map<FieldKey, SourceFinding>();
  for (const finding of args.findings) {
    const existing = bestByField.get(finding.field_key);
    if (!existing) {
      bestByField.set(finding.field_key, finding);
      continue;
    }
    const order: Record<SourceFinding['extraction_method'], number> = {
      api: 0,
      dom_parse: 1,
      pattern_match: 2,
      llm_extract: 3,
    };
    if (order[finding.extraction_method] < order[existing.extraction_method]) {
      bestByField.set(finding.field_key, finding);
    }
  }

  let written = 0;
  for (const [fieldKey, finding] of Array.from(bestByField.entries())) {
    const coerced = coerceFieldValue(fieldKey, finding.raw_value);
    if (!coerced) continue;

    const confidence = scoreConfidence(args.sourceType, finding.extraction_method);

    // Supersede any previous active row for the same brand+field+source
    // so the "current truth" view always returns one row per field.
    const { data: priors } = await supabase
      .from('scraped_brand_data')
      .select('id')
      .eq('brand_profile_id', args.brandProfileId)
      .eq('field_key', fieldKey)
      .eq('source_name', args.sourceName)
      .is('superseded_by', null);

    const { data: inserted, error: insertError } = await supabase
      .from('scraped_brand_data')
      .insert({
        brand_profile_id: args.brandProfileId,
        scraping_job_id: args.jobId,
        field_key: fieldKey,
        field_value: coerced.text,
        field_value_numeric: coerced.numeric,
        source_name: args.sourceName,
        source_url: finding.source_url,
        confidence,
        extraction_method: finding.extraction_method,
      })
      .select('id')
      .single();

    if (insertError || !inserted) continue;
    written += 1;

    if (priors && priors.length > 0) {
      const ids = priors.map((p: { id: string }) => p.id);
      await supabase
        .from('scraped_brand_data')
        .update({ superseded_by: inserted.id })
        .in('id', ids);
    }
  }

  return written;
}
