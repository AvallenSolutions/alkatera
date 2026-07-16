/**
 * The provenance vocabulary: one word for how sure alkatera is about any
 * number on the platform, used everywhere from the products room to
 * facilities to hospitality recipes.
 *
 * Generalises hospitality's `quantities_status` ('confirmed' | 'unconfirmed'
 * | 'estimated') into the platform-wide three states described in
 * tasks/data-revolution-plan.md ("The provenance model"). Existing tables
 * are NOT migrated onto a new column; this module maps their current
 * status/quality fields onto the shared vocabulary so every surface can
 * speak the same language without a schema change.
 */

/**
 * - `estimated` — a benchmark, archetype, typical value or Rosa proxy.
 *   Nobody looked at this specific number; it was computed so the platform
 *   never shows an empty field. Fine for internal views (dashboards, the
 *   growth field); not fine for anything that leaves the building.
 * - `drafted` — extracted from evidence the user gave us (a document, a
 *   website, an email, an integration sync) but nobody has confirmed it
 *   yet. Better than a guess, not yet trustworthy for external use.
 * - `confirmed` — a human touched it: typed it in, accepted a draft as-is,
 *   or corrected one. The only state that satisfies "requires confirmed
 *   data" gates (reports, exports, passports).
 */
export type Provenance = 'estimated' | 'drafted' | 'confirmed';

/** All three states, in ascending order of trust. Useful for `<select>` options and tests. */
export const PROVENANCE_VALUES: readonly Provenance[] = ['estimated', 'drafted', 'confirmed'];

// ---------------------------------------------------------------------------
// a. product_carbon_footprints.status
// ---------------------------------------------------------------------------

/**
 * Maps `product_carbon_footprints.status` to a Provenance.
 *
 * The real status set is the `product_carbon_footprints_status_check`
 * constraint added by `20260714170000_pcf_lifecycle_review.sql`: 'draft' |
 * 'pending' | 'estimate' | 'completed' | 'superseded' | 'failed'. That same
 * migration split ISO critical-review workflow states into a separate
 * `review_status` column ('none' | 'ready_for_review' | 'in_review' |
 * 'approved' | 'rejected') — `lib/types/lca.ts`'s `PcfStatus` type still
 * lists 'ready_for_review' / 'under_review' / 'revision_required' /
 * 'approved' / 'published' as if they lived in `status`, but nothing in the
 * codebase writes those values there any more. They're mapped below
 * defensively (treated as confirmed, since review only happens on a
 * completed calculation) in case a caller passes a `review_status` value by
 * mistake, but should not be relied upon; prefer passing `status`.
 *
 * - `'completed'` → confirmed: a user ran the calculation through to the end.
 * - `'superseded'` → confirmed: was a completed calculation before a newer
 *   recalculation replaced it (`product-lca-aggregator.ts`); the record
 *   itself was once user-confirmed, just no longer the active one.
 * - `'draft'` → drafted: the wizard or an import has values in progress,
 *   nobody has finished confirming them.
 * - `'estimate'` → estimated: computed from benchmarks/proxies, no user
 *   input at all yet (Rosa's `propose_apply_proxy`, sector defaults).
 * - `'pending'` → estimated: still queued/calculating; there's nothing to
 *   show as drafted or confirmed yet, so this defaults to the least
 *   trusted bucket rather than implying evidence exists.
 * - `'failed'` / null / unrecognised → estimated: the safe default. Never
 *   claim confirmed data that doesn't exist.
 */
export function provenanceFromPcfStatus(status: string | null | undefined): Provenance {
  switch (status) {
    case 'completed':
    case 'superseded':
    case 'approved':
    case 'published':
      return 'confirmed';
    case 'draft':
    case 'ready_for_review':
    case 'under_review':
    case 'revision_required':
      return 'drafted';
    case 'estimate':
    case 'pending':
    case 'failed':
    default:
      return 'estimated';
  }
}

// ---------------------------------------------------------------------------
// b. hospitality quantities_status
// ---------------------------------------------------------------------------

/**
 * Maps hospitality's `recipe_metadata.quantities_status`
 * (`lib/hospitality/meal-types.ts`'s `QuantitiesStatus`) to a Provenance.
 * This is the field the whole platform vocabulary is generalised from, so
 * the mapping is a straight rename:
 *
 * - `'unconfirmed'` → drafted: `BulkQuantityGrid`/menu-import placeholder
 *   quantities awaiting a look, same meaning as "extracted, not yet
 *   confirmed" elsewhere on the platform.
 * - `'estimated'` → estimated: a computed/typical figure (recipe starter
 *   defaults), matches the shared vocabulary's word directly.
 * - `'confirmed'` → confirmed: `RecipeEditor` sets this the moment a user
 *   saves covers/quantities themselves.
 */
export function provenanceFromQuantitiesStatus(
  status: 'confirmed' | 'unconfirmed' | 'estimated' | string | null | undefined,
): Provenance {
  switch (status) {
    case 'confirmed':
      return 'confirmed';
    case 'estimated':
      return 'estimated';
    case 'unconfirmed':
    default:
      return 'drafted';
  }
}

// ---------------------------------------------------------------------------
// c. utility / facility data_quality (and facility_activity_entries'
//    richer data_provenance)
// ---------------------------------------------------------------------------

/**
 * Maps the several utility/facility data-quality vocabularies onto a
 * Provenance. There is no single column: three different tables carry
 * three different shapes, so this function is deliberately tolerant and
 * matches case-insensitively.
 *
 * Real sets found in the schema:
 * - `utility_data_entries.data_quality` (`data_quality_enum`, "Actual
 *   meter readings vs estimated consumption"): `'actual' | 'estimated'`.
 * - `facility_activity_entries.data_provenance` (`data_provenance_enum`,
 *   "Glass Box provenance tracking"): `'primary_supplier_verified' |
 *   'primary_measured_onsite' | 'secondary_calculated_allocation' |
 *   'secondary_modelled_industry_average'`. The DB function
 *   `calculate_provenance_confidence_score` already scores these 95/90/70/50.
 * - `fleet_activities.data_quality` (free `text`, CHECK-constrained):
 *   `'Primary' | 'Secondary' | 'Tertiary'` — the `FleetActivityEntry` form
 *   labels them "Direct measurement" / "Calculated/Estimated" /
 *   "Default/Proxy".
 *
 * Mapping decisions:
 * - `'actual'`, `'measured'`, `'verified'`, or anything starting with
 *   `'primary'` → confirmed. A meter reading, an on-site measurement, or a
 *   supplier-verified figure is exactly what "a human confirmed it" means
 *   for operational data — nobody typed the number by hand, but someone
 *   stood behind it as real, not modelled.
 * - `'calculated'` (`secondary_calculated_allocation`) → estimated. This is
 *   explicit per the plan: an allocation is a computed split of a real
 *   total, not itself a confirmed figure for this specific
 *   product/facility/period.
 * - `'estimated'` / `'modelled'` / anything starting with `'secondary'` or
 *   `'tertiary'` → estimated.
 * - null/unrecognised → estimated (safe default).
 */
export function provenanceFromDataQuality(raw: string | null | undefined): Provenance {
  if (!raw) return 'estimated';
  const v = raw.toLowerCase();
  if (v === 'actual' || v === 'measured' || v === 'verified' || v.startsWith('primary')) {
    return 'confirmed';
  }
  return 'estimated';
}

// ---------------------------------------------------------------------------
// d. ingredient/packaging ef_source_type
// ---------------------------------------------------------------------------

/**
 * Maps `product_materials.ef_source_type` (aka `source_type` on
 * `/api/ingredients/search` results, set by `ef-auto-match.ts` and
 * `lib/rosa/actions.ts`'s `execApplyProxy`) to a Provenance.
 *
 * Real set (`app/api/ingredients/search/route.ts`'s `SearchResult.source_type`
 * plus the literal `'proxy'` written by `execApplyProxy`): `'primary' |
 * 'staging' | 'global_library' | 'ecoinvent_proxy' | 'ecoinvent_live' |
 * 'agribalyse_live' | 'defra' | 'proxy'`.
 *
 * Unlike the other three mappers, source_type alone doesn't say whether a
 * human picked the result or the platform applied it silently — the same
 * `'ecoinvent_live'` match is `drafted` when `autoMatchEmissionFactor`
 * attaches it behind the scenes and `confirmed` the moment a user accepts
 * it in `InlineIngredientSearch`. Callers must pass `userAccepted` from
 * their own context (e.g. did this write come from the manual picker vs.
 * the wizard's silent auto-match / recalculation pass).
 *
 * - `'proxy'` (Rosa's `propose_apply_proxy` / `execApplyProxy`) → estimated,
 *   always: a proxy is explicitly a conservative substitute, never a real
 *   match, regardless of who applied it.
 * - `'primary'` (a real supplier product record) → confirmed when
 *   user-accepted, drafted when auto-applied: it's real supplier data
 *   either way, just not yet looked at if nobody chose it.
 * - `'ecoinvent_live'` / `'agribalyse_live'` / `'defra'` / `'global_library'`
 *   / `'staging'` (a live database or curated factor match) → confirmed
 *   when user-accepted, drafted when auto-applied (the confident-match gate
 *   in `ef-auto-match.ts` still means nobody has looked at it).
 * - `'ecoinvent_proxy'` → estimated, always: despite the name overlap with
 *   the org-scoped proxy table, this is the DEFRA-to-ecoinvent GWP-split
 *   fallback in `impact-waterfall-resolver.ts` — a documented substitute,
 *   not a confirmed factor.
 * - null/unrecognised → estimated when not user-accepted, drafted when
 *   user-accepted (matched nothing we recognise, but a human still chose it).
 */
export function provenanceFromEfSourceType(
  sourceType: string | null | undefined,
  opts: { userAccepted?: boolean } = {},
): Provenance {
  const userAccepted = opts.userAccepted ?? false;
  if (sourceType === 'proxy' || sourceType === 'ecoinvent_proxy') return 'estimated';
  if (userAccepted) return 'confirmed';
  if (!sourceType) return 'estimated';
  return 'drafted';
}

/**
 * Namespace bundling all four legacy mappers, for callers that want one
 * import (`provenanceFromLegacy.pcfStatus(...)`) rather than four named
 * imports. Each function is also exported individually above.
 */
export const provenanceFromLegacy = {
  pcfStatus: provenanceFromPcfStatus,
  quantitiesStatus: provenanceFromQuantitiesStatus,
  dataQuality: provenanceFromDataQuality,
  efSourceType: provenanceFromEfSourceType,
};

// ---------------------------------------------------------------------------
// Confidence scale: 0-100, unifying every confidence shape in the platform.
// ---------------------------------------------------------------------------

/** The handful of confidence shapes actually stored on the platform today. */
export type LegacyConfidence =
  | { kind: 'classification'; value: 'high' | 'medium' | 'low' | string }
  | { kind: 'fraction'; value: number }
  | { kind: 'score100'; value: number }
  | { kind: 'uncertaintyPercent'; value: number };

/**
 * Maps any of the platform's confidence shapes onto one 0-100 scale, so a
 * single "how sure is this?" indicator can be built once and reused.
 *
 * - `classification` — `ingest_document_profiles`/classify-document.ts's
 *   `classification_confidence`: `'high' | 'medium' | 'low'` →
 *   `90 | 60 | 30`. An unrecognised string defaults to 30 (least sure).
 * - `fraction` — `agent_exceptions.confidence`, a `numeric` CHECKed to
 *   `0..1` → multiplied by 100.
 * - `score100` — LCA `confidence_score` (`lib/types/lca.ts`,
 *   `lca-interpretation-engine.ts`), already 0-100 → passed through
 *   (clamped, in case a caller's data is out of range).
 * - `uncertaintyPercent` — `product_materials.ef_uncertainty_percent`
 *   (`lib/rosa/actions.ts`'s `execApplyProxy` writes `100 - confidence_pct`
 *   here) → inverted back to a confidence: `100 - uncertainty`.
 *
 * Pure and total: always returns a number clamped to [0, 100].
 */
export function confidenceToScale(confidence: LegacyConfidence): number {
  switch (confidence.kind) {
    case 'classification':
      return clamp100(classificationToScale(confidence.value));
    case 'fraction':
      return clamp100(confidence.value * 100);
    case 'score100':
      return clamp100(confidence.value);
    case 'uncertaintyPercent':
      return clamp100(100 - confidence.value);
    default:
      return 0;
  }
}

function classificationToScale(value: string): number {
  switch (value) {
    case 'high':
      return 90;
    case 'medium':
      return 60;
    case 'low':
      return 30;
    default:
      return 30;
  }
}

function clamp100(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.min(100, Math.max(0, n));
}
