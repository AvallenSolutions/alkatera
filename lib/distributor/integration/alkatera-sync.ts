import type { SupabaseClient } from '@supabase/supabase-js';
import { coerceFieldValue, type FieldKey } from '../scraping/field-definitions';
import { recalculateCompleteness } from '../scoring/recalculate';
import { tierForScore } from '../scoring/vitality-calculator';

/**
 * Sync an alka**tera** brand's live sustainability data into the
 * canonical brand_directory entry as scraped_brand_data rows tagged
 * source_name='alkatera_live'. Because Phase 3 keys findings by
 * brand_directory_id, a single sync naturally fans out to every
 * distributor that lists the brand. The Phase 6 RPC (now
 * directory-scoped, see migration 20262606900000) overlays these onto
 * each linked distributor's view, applying per-distributor sharing
 * preferences.
 *
 * Triggers:
 *   - createBrandDistributorLink (Phase 6) after a confirmed link
 *   - Daily run-brand-matching cron, for every linked directory entry
 *   - /api/distributor/brands/[id]/refresh-alkatera (manual button)
 *
 * Defensive by design: the alka**tera** customer schema is large and
 * evolves independently. Each field's read is wrapped in try/catch and
 * unrecognised column shapes just produce no finding for that field.
 * We'd rather sync 6/10 fields successfully than fail the whole sync
 * because one optional column doesn't exist.
 */

export interface SyncResult {
  ok: boolean;
  brand_directory_id: string;
  alkatera_org_id: string;
  fields_written: number;
  fields_skipped: string[];
  error?: string;
}

const SOURCE_NAME = 'alkatera_live';
const CONFIDENCE = 0.99;

interface SyncedField {
  field_key: FieldKey;
  raw_value: unknown;
}

export async function syncAlkateraDataForBrand(
  supabase: SupabaseClient,
  brandDirectoryId: string,
): Promise<SyncResult> {
  // 1. The directory entry tells us which alkatera org this brand is.
  //    The per-distributor sharing gate lives in the RPC the merger
  //    calls — sync writes unconditionally because the data belongs to
  //    the brand, not to any one distributor.
  const { data: directory } = await supabase
    .from('brand_directory')
    .select('id, alkatera_org_id')
    .eq('id', brandDirectoryId)
    .maybeSingle();

  if (!directory) {
    return {
      ok: false,
      brand_directory_id: brandDirectoryId,
      alkatera_org_id: '',
      fields_written: 0,
      fields_skipped: [],
      error: 'directory_not_found',
    };
  }
  const alkateraOrgId = (directory as { alkatera_org_id: string | null }).alkatera_org_id;
  if (!alkateraOrgId) {
    return {
      ok: false,
      brand_directory_id: brandDirectoryId,
      alkatera_org_id: '',
      fields_written: 0,
      fields_skipped: [],
      error: 'no_alkatera_org_linked',
    };
  }

  const findings: SyncedField[] = [];
  const skipped: string[] = [];

  // 2. Pull each field defensively. Order doesn't matter for results
  //    but we group reads by source table to keep query budget low.

  // organizations: hq_country, founding_year, (and contact_email if present)
  try {
    const { data } = await supabase
      .from('organizations')
      .select('country, founding_year, website, description')
      .eq('id', alkateraOrgId)
      .maybeSingle();
    if (data) {
      const org = data as {
        country: string | null;
        founding_year: number | null;
        website: string | null;
        description: string | null;
      };
      if (org.country) findings.push({ field_key: 'hq_country', raw_value: org.country });
      if (org.founding_year) findings.push({ field_key: 'founding_year', raw_value: org.founding_year });
      // The brand's self-authored description on alkatera is much more
      // trustworthy than the LLM-generated one from website scraping —
      // it's written by the brand themselves. We surface it as a
      // company_description finding with the standard alkatera_live
      // confidence (0.99), which will outrank the scraped 0.65.
      if (org.description && org.description.trim().length > 40) {
        findings.push({ field_key: 'company_description', raw_value: org.description.trim() });
      }
    }
  } catch {
    skipped.push('organizations');
  }

  // organization_certifications → boolean cert fields. The framework
  // identity lives on a separate certification_frameworks table that
  // we join through (framework_id FK). We accept several status
  // values as "this brand is certified" because the alka**tera**
  // schema uses various workflow terms.
  try {
    const { data } = await supabase
      .from('organization_certifications')
      .select(
        'status, certification_frameworks!inner(framework_code, framework_name, code, name)',
      )
      .eq('organization_id', alkateraOrgId);
    type FrameworkRow = {
      framework_code: string | null;
      framework_name: string | null;
      code: string | null;
      name: string | null;
    };
    type CertRow = {
      status: string | null;
      certification_frameworks: FrameworkRow | FrameworkRow[] | null;
    };
    const rows = (data ?? []) as CertRow[];
    for (const row of rows) {
      if (!isCertifiedStatus(row.status)) continue;
      const fw = Array.isArray(row.certification_frameworks)
        ? row.certification_frameworks[0]
        : row.certification_frameworks;
      if (!fw) continue;
      // Try the most discriminating field first (framework_code is
      // typically machine-readable, e.g. 'b_corp'); fall back to
      // the human label if code is null.
      const label = fw.framework_code ?? fw.code ?? fw.framework_name ?? fw.name ?? null;
      const fieldKey = certLabelToField(label);
      if (fieldKey) {
        findings.push({ field_key: fieldKey, raw_value: true });
      }
    }
  } catch {
    skipped.push('organization_certifications');
  }

  // ghg_emissions aggregated by scope category. We sum total_emissions
  // bucketed into Scope 1, 2, 3. Category names vary so we look at
  // a `category_name` / `scope` / `category_id` column conservatively.
  try {
    const { data } = await supabase
      .from('ghg_emissions')
      .select('*')
      .eq('organization_id', alkateraOrgId);
    type EmissionRow = Record<string, unknown> & {
      total_emissions?: number | string | null;
    };
    const rows = (data ?? []) as EmissionRow[];
    const totals = { 1: 0, 2: 0, 3: 0 };
    let foundAny = false;
    for (const row of rows) {
      const scope = inferScope(row);
      if (!scope) continue;
      const n = parseNum(row.total_emissions);
      if (n == null) continue;
      totals[scope] += n;
      foundAny = true;
    }
    if (foundAny) {
      // Convert kg → tCO2e if it looks like kg (heuristic: > 100,000 is plausibly kg).
      // Most LCA systems already store in tonnes; we report as-is.
      if (totals[1] > 0) findings.push({ field_key: 'scope_1_tco2e', raw_value: totals[1] });
      if (totals[2] > 0) findings.push({ field_key: 'scope_2_tco2e', raw_value: totals[2] });
      if (totals[3] > 0) findings.push({ field_key: 'scope_3_tco2e', raw_value: totals[3] });
    }
  } catch {
    skipped.push('ghg_emissions');
  }

  // product_carbon_footprints → carbon_intensity_kgco2e_per_litre,
  // averaged across the org's products. Only include products whose
  // bulk_volume_per_functional_unit is in litres-ish units.
  try {
    const { data } = await supabase
      .from('product_carbon_footprints')
      .select('total_ghg_emissions, bulk_volume_per_functional_unit, volume_unit')
      .eq('organization_id', alkateraOrgId);
    type PcfRow = {
      total_ghg_emissions: number | string | null;
      bulk_volume_per_functional_unit: number | string | null;
      volume_unit: string | null;
    };
    const rows = (data ?? []) as PcfRow[];
    const intensities: number[] = [];
    for (const row of rows) {
      const emissions = parseNum(row.total_ghg_emissions);
      const volume = parseNum(row.bulk_volume_per_functional_unit);
      if (emissions == null || volume == null || volume <= 0) continue;
      const unit = (row.volume_unit ?? '').toLowerCase();
      // Normalise to per-litre. Skip exotic units to avoid garbage values.
      let perLitre: number | null = null;
      if (unit === 'l' || unit === 'litre' || unit === 'litres' || unit === 'liter' || unit === 'liters') {
        perLitre = emissions / volume;
      } else if (unit === 'ml' || unit === 'millilitre' || unit === 'milliliters') {
        perLitre = emissions / (volume / 1000);
      } else if (unit === 'cl' || unit === 'centilitre' || unit === 'centilitres') {
        perLitre = emissions / (volume / 100);
      } else if (!unit) {
        perLitre = emissions / volume; // assume litres
      }
      if (perLitre != null && Number.isFinite(perLitre) && perLitre > 0 && perLitre < 100) {
        intensities.push(perLitre);
      }
    }
    if (intensities.length > 0) {
      const avg = intensities.reduce((a, b) => a + b, 0) / intensities.length;
      findings.push({ field_key: 'carbon_intensity_kgco2e_per_litre', raw_value: avg });
    }
  } catch {
    skipped.push('product_carbon_footprints');
  }

  // transition_plans → net_zero_target_year. Prefer the latest target.
  try {
    const { data } = await supabase
      .from('transition_plans')
      .select('sbti_target_year, sbti_aligned')
      .eq('organization_id', alkateraOrgId)
      .order('sbti_target_year', { ascending: false })
      .limit(1)
      .maybeSingle();
    const target = (data as { sbti_target_year: number | null } | null)?.sbti_target_year;
    if (target) {
      findings.push({ field_key: 'net_zero_target_year', raw_value: target });
    }
  } catch {
    // fall through to flag_targets
  }
  try {
    const probe = findings.find((f) => f.field_key === 'net_zero_target_year');
    if (!probe) {
      const { data } = await supabase
        .from('flag_targets')
        .select('target_year')
        .eq('organization_id', alkateraOrgId)
        .order('target_year', { ascending: false })
        .limit(1)
        .maybeSingle();
      const target = (data as { target_year: number | null } | null)?.target_year;
      if (target) findings.push({ field_key: 'net_zero_target_year', raw_value: target });
    }
  } catch {
    skipped.push('targets');
  }

  // facility_water_data → water_usage_litres_per_litre (avg of per-litre
  // consumption across facilities) + water_recycled_percentage (avg).
  // The alka**tera** schema for this table evolves; we sniff several
  // plausible column names rather than assuming one shape, so a column
  // rename doesn't silently drop the finding.
  try {
    const { data } = await supabase
      .from('facility_water_data')
      .select('*')
      .eq('organization_id', alkateraOrgId);
    type FacilityWaterRow = Record<string, unknown>;
    const rows = (data ?? []) as FacilityWaterRow[];
    const perLitreValues: number[] = [];
    const recycledPctValues: number[] = [];
    for (const row of rows) {
      // Litres-per-litre intensity. Names we've seen across alkatera
      // schemas: water_per_litre, water_consumption_l_per_litre,
      // water_intensity, l_per_l.
      const perLitre =
        parseNum(row.water_per_litre) ??
        parseNum(row.water_consumption_l_per_litre) ??
        parseNum(row.water_intensity) ??
        parseNum(row.l_per_l);
      if (perLitre != null && perLitre > 0 && perLitre < 1000) {
        perLitreValues.push(perLitre);
      }
      const recycledPct =
        parseNum(row.recycled_water_percentage) ??
        parseNum(row.water_recycled_percentage) ??
        parseNum(row.recycled_percentage);
      if (recycledPct != null && recycledPct >= 0 && recycledPct <= 100) {
        recycledPctValues.push(recycledPct);
      }
    }
    if (perLitreValues.length > 0) {
      const avg = perLitreValues.reduce((a, b) => a + b, 0) / perLitreValues.length;
      findings.push({ field_key: 'water_usage_litres_per_litre', raw_value: avg });
    }
    if (recycledPctValues.length > 0) {
      const avg = recycledPctValues.reduce((a, b) => a + b, 0) / recycledPctValues.length;
      findings.push({ field_key: 'water_recycled_percentage', raw_value: avg });
    }
  } catch {
    skipped.push('facility_water_data');
  }

  // packaging_circularity_profiles → recycled_packaging_percentage (avg),
  // packaging_primary_material (most common material_type).
  try {
    const { data } = await supabase
      .from('packaging_circularity_profiles')
      .select('recycled_content_percentage, material_type, material_name')
      .eq('organization_id', alkateraOrgId);
    type PkgRow = {
      recycled_content_percentage: number | string | null;
      material_type: string | null;
      material_name: string | null;
    };
    const rows = (data ?? []) as PkgRow[];
    if (rows.length > 0) {
      const pcts = rows
        .map((r) => parseNum(r.recycled_content_percentage))
        .filter((v): v is number => v != null);
      if (pcts.length > 0) {
        const avg = pcts.reduce((a, b) => a + b, 0) / pcts.length;
        findings.push({ field_key: 'recycled_packaging_percentage', raw_value: avg });
      }
      // Most common material_type.
      const counts = new Map<string, number>();
      for (const r of rows) {
        const m = (r.material_type ?? r.material_name ?? '').trim();
        if (!m) continue;
        counts.set(m, (counts.get(m) ?? 0) + 1);
      }
      let topMaterial: string | null = null;
      let topCount = 0;
      for (const [m, n] of Array.from(counts.entries())) {
        if (n > topCount) {
          topCount = n;
          topMaterial = m;
        }
      }
      if (topMaterial) {
        findings.push({ field_key: 'packaging_primary_material', raw_value: topMaterial });
      }
    }
  } catch {
    skipped.push('packaging_circularity_profiles');
  }

  // 3. Persist. Supersede every existing alkatera_live row for this
  //    directory in one pass, then insert the fresh batch. Cheaper than
  //    per-field supersede + insert; safe because the conflict
  //    resolver treats alkatera_live as authoritative anyway.
  if (findings.length > 0) {
    const { data: priors } = await supabase
      .from('scraped_brand_data')
      .select('id')
      .eq('brand_directory_id', brandDirectoryId)
      .eq('source_name', SOURCE_NAME)
      .is('superseded_by', null);

    const inserts = findings
      .map((f) => {
        const coerced = coerceFieldValue(f.field_key, f.raw_value);
        if (!coerced) return null;
        return {
          brand_directory_id: brandDirectoryId,
          field_key: f.field_key,
          field_value: coerced.text,
          field_value_numeric: coerced.numeric,
          source_name: SOURCE_NAME,
          source_url: null,
          confidence: CONFIDENCE,
          extraction_method: 'api' as const,
        };
      })
      .filter((v): v is NonNullable<typeof v> => v !== null);

    if (inserts.length > 0) {
      const { data: inserted, error: insertError } = await supabase
        .from('scraped_brand_data')
        .insert(inserts)
        .select('id');
      if (insertError) {
        return {
          ok: false,
          brand_directory_id: brandDirectoryId,
          alkatera_org_id: alkateraOrgId,
          fields_written: 0,
          fields_skipped: skipped,
          error: `insert_failed: ${insertError.message}`,
        };
      }
      // Point every prior alkatera_live row at the first new inserted id
      // (it's enough to mark them superseded — the supersede chain is
      // about visibility, not lineage).
      const supersedeTargetId = (inserted as Array<{ id: string }>)[0]?.id;
      if (supersedeTargetId && priors && priors.length > 0) {
        await supabase
          .from('scraped_brand_data')
          .update({ superseded_by: supersedeTargetId })
          .in('id', (priors as Array<{ id: string }>).map((p) => p.id));
      }
    }
  }

  // 4. Stamp brand_directory.last_synced_at so UI surfaces can show
  //    "Synced N minutes ago" without scanning the queue. We also
  //    auto-verify here: this brand is alka**tera**-linked (it owns its
  //    data), so it's trusted and can go live in Discover without
  //    manual review. Best-effort — a failure doesn't invalidate the sync.
  try {
    await supabase
      .from('brand_directory')
      .update({
        last_synced_at: new Date().toISOString(),
        verification_status: 'verified',
        verified_at: new Date().toISOString(),
      })
      .eq('id', brandDirectoryId);
  } catch {
    /* swallow */
  }

  // 5. Mirror product-level LCA from alkatera into product_directory.
  //    For every product_carbon_footprints row this org owns, find a
  //    matching product_directory entry by either alkatera_product_id
  //    (if the link was already set) or by matching the brand_skus row
  //    we know about for this product. Updates embodied_carbon_kgco2e
  //    and last_synced_at.
  try {
    await mirrorAlkateraProductFootprints(supabase, brandDirectoryId, alkateraOrgId);
  } catch {
    skipped.push('product_directory_mirror');
  }

  // 6. Recompute completeness + vitality from the local scraped_brand_data
  //    so completeness_score is fresh. Best-effort — a recalc failure
  //    doesn't invalidate the sync itself.
  try {
    await recalculateCompleteness(supabase, brandDirectoryId);
  } catch {
    skipped.push('recalc_after_sync');
  }

  // 7. Override sustainability_score AND completeness_score with the
  //    authoritative alka**tera** ESG composite. The Rosa hub computes
  //    a far richer score from facility data, anomalies, B Corp
  //    evidence, targets and more — cached daily into
  //    esg_score_snapshots by the /api/vitality/composite handler.
  //
  //    For completeness we derive a distributor-meaningful signal:
  //    the fraction of E/S/G sub-pillars that have non-zero data in
  //    the latest snapshot breakdown. A brand with 8/9 sub-pillars
  //    populated shows 89%; a brand with only climate data shows ~11%.
  try {
    const { data: snapshot } = await supabase
      .from('esg_score_snapshots')
      .select('composite, breakdown, snapshot_date')
      .eq('organization_id', alkateraOrgId)
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    const snap = snapshot as {
      composite: number | null;
      breakdown:
        | {
            e?: Record<string, number | null>;
            s?: Record<string, number | null>;
            g?: Record<string, number | null>;
          }
        | null;
    } | null;

    if (snap) {
      const update: Record<string, unknown> = {
        score_updated_at: new Date().toISOString(),
      };
      if (snap.composite != null && Number.isFinite(snap.composite)) {
        update.sustainability_score = snap.composite;
        update.score_tier = tierForScore(snap.composite);
      }
      if (snap.breakdown) {
        const pillarsWithData = countPopulatedSubPillars(snap.breakdown);
        if (pillarsWithData.total > 0) {
          update.completeness_score =
            Math.round((pillarsWithData.populated / pillarsWithData.total) * 10000) /
            100;
        }
      }
      if (Object.keys(update).length > 1) {
        await supabase
          .from('brand_directory')
          .update(update)
          .eq('id', brandDirectoryId);
      }
    }
  } catch {
    skipped.push('alkatera_vitality_override');
  }

  return {
    ok: true,
    brand_directory_id: brandDirectoryId,
    alkatera_org_id: alkateraOrgId,
    fields_written: findings.length,
    fields_skipped: skipped,
  };
}

/**
 * Push the alka**tera** customer's per-product carbon footprints into
 * the canonical product_directory. Matching is best-effort:
 *   1. If a product_directory row already carries alkatera_product_id,
 *      update it in place.
 *   2. Otherwise try to match by (brand_directory_id, name).
 *   3. Otherwise CREATE a fresh product_directory row from the PCF —
 *      this is what gives distributors access to alka**tera**-only
 *      products in Discover before any of their distributors list the
 *      brand.
 */
async function mirrorAlkateraProductFootprints(
  supabase: SupabaseClient,
  brandDirectoryId: string,
  alkateraOrgId: string,
): Promise<void> {
  const { data: pcfRows } = await supabase
    .from('product_carbon_footprints')
    .select('id, product_name, total_ghg_emissions, status')
    .eq('organization_id', alkateraOrgId);

  type PcfRow = {
    id: string;
    product_name: string | null;
    total_ghg_emissions: number | string | null;
    status: string | null;
  };
  const rows = (pcfRows ?? []) as PcfRow[];
  if (rows.length === 0) return;

  for (const pcf of rows) {
    const productName = (pcf.product_name ?? '').trim();
    if (!productName) continue;
    const emissions = parseNum(pcf.total_ghg_emissions);
    const normalised = productName
      .toLowerCase()
      .replace(/[^a-z0-9 ]+/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!normalised) continue;

    // 1. By alkatera_product_id (if previously linked).
    const { data: byLink } = await supabase
      .from('product_directory')
      .select('id')
      .eq('alkatera_product_id', pcf.id)
      .maybeSingle();
    let targetId: string | null = (byLink as { id: string } | null)?.id ?? null;

    // 2. By (brand, normalised name).
    if (!targetId) {
      const { data: byName } = await supabase
        .from('product_directory')
        .select('id')
        .eq('brand_directory_id', brandDirectoryId)
        .eq('normalized_name', normalised)
        .maybeSingle();
      targetId = (byName as { id: string } | null)?.id ?? null;
    }

    // 3. Create a fresh product_directory row from the PCF. This is
    //    what surfaces alka**tera**-only products in Discover for
    //    brands that no distributor has listed yet.
    if (!targetId) {
      const { data: inserted, error: insertError } = await supabase
        .from('product_directory')
        .insert({
          brand_directory_id: brandDirectoryId,
          name: productName,
          normalized_name: normalised,
          alkatera_product_id: pcf.id,
          embodied_carbon_kgco2e: emissions,
          discovered_via: 'alkatera_signup',
          last_synced_at: new Date().toISOString(),
          // alka**tera** product data is brand-owned and trusted.
          verification_status: 'verified',
          verified_at: new Date().toISOString(),
        })
        .select('id')
        .single();
      if (insertError || !inserted) continue;
      continue; // already populated by the insert
    }

    await supabase
      .from('product_directory')
      .update({
        embodied_carbon_kgco2e: emissions,
        verification_status: 'verified',
        alkatera_product_id: pcf.id,
        last_synced_at: new Date().toISOString(),
      })
      .eq('id', targetId);
  }
}

// ------------------------------------------------------------
// Helpers
// ------------------------------------------------------------

function parseNum(value: unknown): number | null {
  if (value === null || value === undefined || value === '') return null;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

/**
 * Count how many ESG sub-pillars in a snapshot's breakdown carry
 * non-null, non-zero data. The breakdown shape (see /api/vitality/composite)
 * is `{ e: { climate, water, nature, circularity }, s: { community,
 * supplier_esg, people_culture }, g: { governance, certifications } }`.
 *
 * A sub-pillar at 0 counts as "no real data" — at-zero usually means the
 * brand hasn't entered anything on that axis yet. Brands that have
 * meaningfully scored even a single sub-pillar above zero get partial
 * completeness credit; brands that have populated all 9 sub-pillars get
 * 100%.
 */
function countPopulatedSubPillars(breakdown: {
  e?: Record<string, number | null>;
  s?: Record<string, number | null>;
  g?: Record<string, number | null>;
}): { populated: number; total: number } {
  let populated = 0;
  let total = 0;
  for (const pillar of ['e', 's', 'g'] as const) {
    const sub = breakdown[pillar];
    if (!sub) continue;
    for (const v of Object.values(sub)) {
      total += 1;
      const n = typeof v === 'number' ? v : null;
      if (n != null && n > 0) populated += 1;
    }
  }
  return { populated, total };
}

/**
 * The alka**tera** schema uses various workflow terms in
 * organization_certifications.status — "certified" is the obvious
 * one, but completed audits sometimes land as "achieved" or "active".
 * "in_progress", "not_started", "lapsed", "expired" do NOT count.
 */
function isCertifiedStatus(status: string | null): boolean {
  if (!status) return false;
  const s = status.toLowerCase().trim();
  return ['certified', 'achieved', 'active', 'complete', 'completed'].includes(s);
}

function certLabelToField(label: string | null): FieldKey | null {
  if (!label) return null;
  // Normalise hyphens / underscores / whitespace so we handle both
  // human labels ("B Corp Certified") and the alkatera framework_code
  // snake_case ("b_corp", "iso_14001").
  const l = label.toLowerCase().replace(/[_\-]/g, ' ').replace(/\s+/g, ' ').trim();
  if (l.includes('b corp') || l.includes('bcorp')) return 'bcorp_certified';
  if (l.includes('carbon trust')) return 'carbon_trust_certified';
  if (l.includes('iso 14001') || l.includes('iso14001')) return 'iso_14001_certified';
  if (l.includes('iso 50001') || l.includes('iso50001')) return 'iso_50001_certified';
  if (l.includes('fairtrade') || l.includes('fair trade')) return 'fairtrade_certified';
  if (l.includes('rainforest alliance')) return 'rainforest_alliance_certified';
  if (l.includes('organic') || l.includes('soil association') || l.includes('ofg')) return 'organic_certified';
  return null;
}

/**
 * Infer Scope 1/2/3 from a ghg_emissions row. Looks at the most likely
 * column names; the alka**tera** schema uses a `category_id` FK that
 * resolves to a category name, but for now we sniff string columns.
 */
function inferScope(row: Record<string, unknown>): 1 | 2 | 3 | null {
  const candidates = [
    row.scope,
    row.scope_name,
    row.category_name,
    row.category,
  ];
  for (const c of candidates) {
    if (typeof c === 'string') {
      const v = c.toLowerCase();
      if (v.includes('scope 1') || v === '1') return 1;
      if (v.includes('scope 2') || v === '2') return 2;
      if (v.includes('scope 3') || v === '3') return 3;
    }
    if (typeof c === 'number') {
      if (c === 1) return 1;
      if (c === 2) return 2;
      if (c === 3) return 3;
    }
  }
  return null;
}
