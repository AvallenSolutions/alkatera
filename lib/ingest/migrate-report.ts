// lib/ingest/migrate-report.ts
//
// Migration engine v1 — deep-extraction shape + drafted-record dispatch for
// historical report imports (data-revolution plan, Pillar 2b "Bring your
// history"). A prior consultant LCA, B Corp report, CDP/EcoVadis response or
// competitor-platform export mentions far more than the headline scope 1/2/3
// numbers the original historical_sustainability_report /
// historical_lca_report classifier tools captured: facilities, product-level
// PCFs, targets, certifications, suppliers and multi-year totals.
//
// This module is the single source of truth for that richer shape, shared by:
//   - lib/ingest/classify-document.ts (spreads MIGRATION_EXTRACTION_SCHEMA_PROPERTIES
//     into both historical tool schemas, so Claude fills it in)
//   - app/api/ingest/historical/route.ts (turns a saved extraction into
//     agent_exceptions rows via exceptionGroupsFromExtraction, and extra
//     historical_imports rows via additionalAnnualHistoricalRows)
//   - lib/intake/dispatch.ts (the approve-time writers for the four
//     migration_* kinds this module defines)
//
// Nothing here writes to the database — this is the shape + the batching
// logic only. historical_imports (the source-PDF-backed headline row) keeps
// working exactly as it did before; everything in this file is additive on
// top of it. Extracted data always lands as `agent_exceptions` rows first —
// the Ask Queue confirms in batches — never as a silent write.

export interface MigrationCompanyProfile {
  name?: string;
  sector?: string;
  founding_year?: number;
}

export interface MigrationFacility {
  name: string;
  location?: string;
  /** Free-text hint (e.g. "production", "warehouse", "office", "farm"); the
   *  facilities table has no matching enum column so this is carried through
   *  for the review card only, not persisted verbatim. */
  type?: string;
}

export interface MigrationAnnualTotal {
  year: number;
  scope1_tco2e?: number;
  scope2_tco2e_market?: number;
  scope2_tco2e_location?: number;
  scope3_tco2e?: number;
  energy_kwh?: number;
  water_m3?: number;
  waste_tonnes?: number;
}

export interface MigrationProductPcf {
  product_name: string;
  functional_unit?: string;
  system_boundary?: string;
  reference_year?: number;
  total_gwp_kgco2e?: number;
  methodology?: string;
}

export interface MigrationTarget {
  metric: string;
  /** Preferred shape when the document states absolute figures. */
  baseline_value?: number;
  baseline_year?: number;
  target_value?: number;
  target_date?: string;
  /** Back-compat with the original headline-only schema (a bare % + year). */
  percent_reduction?: number;
  year?: number;
}

export interface MigrationExtraction {
  company_profile?: MigrationCompanyProfile;
  facilities?: MigrationFacility[];
  baseline_year?: number;
  annual_totals?: MigrationAnnualTotal[];
  products?: MigrationProductPcf[];
  targets?: MigrationTarget[];
  certifications_held?: string[];
  supplier_names?: string[];
  methodology_notes?: string;
}

/**
 * JSON-schema `properties` fragment spread into both `extract_sustainability_report`
 * and `extract_lca_report` tool schemas in classify-document.ts. Everything here
 * is additive alongside each tool's existing headline fields — an older or
 * simpler document that only yields the headline numbers still classifies
 * exactly as before.
 */
export const MIGRATION_EXTRACTION_SCHEMA_PROPERTIES: Record<string, unknown> = {
  company_profile: {
    type: 'object',
    description: 'The reporting company itself, if named in the document.',
    properties: {
      name: { type: 'string' },
      sector: { type: 'string' },
      founding_year: { type: 'number' },
    },
  },
  facilities: {
    type: 'array',
    description:
      'Production sites, distilleries/breweries/wineries, warehouses or offices named in the document.',
    items: {
      type: 'object',
      properties: {
        name: { type: 'string' },
        location: { type: 'string' },
        type: { type: 'string', description: 'e.g. production, warehouse, office, farm' },
      },
      required: ['name'],
    },
  },
  baseline_year: {
    type: 'number',
    description: 'The baseline year targets are measured against, if stated.',
  },
  annual_totals: {
    type: 'array',
    description:
      'One entry PER REPORTING YEAR found in the document. Multi-year trend tables are common in ESG/CSR reports — capture every year shown, not just the headline year.',
    items: {
      type: 'object',
      properties: {
        year: { type: 'number' },
        scope1_tco2e: { type: 'number' },
        scope2_tco2e_market: { type: 'number' },
        scope2_tco2e_location: { type: 'number' },
        scope3_tco2e: { type: 'number' },
        energy_kwh: { type: 'number' },
        water_m3: { type: 'number' },
        waste_tonnes: { type: 'number' },
      },
      required: ['year'],
    },
  },
  products: {
    type: 'array',
    description:
      'Individual product/SKU carbon footprints stated in the document, if any (a report can cover more than one product).',
    items: {
      type: 'object',
      properties: {
        product_name: { type: 'string' },
        functional_unit: { type: 'string' },
        system_boundary: { type: 'string' },
        reference_year: { type: 'number' },
        total_gwp_kgco2e: { type: 'number' },
        methodology: { type: 'string' },
      },
      required: ['product_name'],
    },
  },
  supplier_names: {
    type: 'array',
    items: { type: 'string' },
    description: 'Named suppliers mentioned in the document (e.g. in a supply-chain or Scope 3 section).',
  },
  methodology_notes: {
    type: 'string',
    description: 'Free-text notes on the methodology or standard used (e.g. GHG Protocol, ISO 14064, PAS 2050, PEFCR).',
  },
};

/** Extends an existing `targets` array item schema (each tool already defines
 *  its own) with the richer absolute-value fields, keeping the original
 *  percent_reduction/year for back-compat. */
export const MIGRATION_TARGET_ITEM_EXTRA_PROPERTIES: Record<string, unknown> = {
  baseline_value: { type: 'number', description: 'Baseline figure the target is measured from, if stated.' },
  baseline_year: { type: 'number' },
  target_value: { type: 'number', description: 'Absolute target figure, if stated (not just a % reduction).' },
  target_date: { type: 'string', description: 'ISO date or year the target is due, if stated.' },
};

export interface ExceptionGroupContext {
  organizationId: string;
  historicalImportId: string;
  sourceDocumentName: string | null;
  reportingYear: number | null;
}

export interface ExceptionGroupRow {
  organization_id: string;
  kind: 'migration_facilities' | 'migration_products' | 'migration_targets' | 'migration_certifications';
  source: 'upload';
  source_ref: Record<string, unknown>;
  payload: Record<string, unknown>;
  title: string;
  summary: string | null;
  confidence: number;
  status: 'open';
}

function namesPreview(names: string[], max = 5): string {
  const shown = names.slice(0, max).join(', ');
  return names.length > max ? `${shown} +${names.length - max} more` : shown;
}

/**
 * Build up to four batched `agent_exceptions` rows (one per entity kind) from
 * a historical report's deep extraction. Called right after the
 * `historical_imports` row is written, so every group can cite it for
 * provenance via `source_ref.historicalImportId`. Groups with no usable items
 * are skipped entirely — nothing empty ever reaches the Ask Queue.
 */
export function exceptionGroupsFromExtraction(
  extraction: MigrationExtraction,
  context: ExceptionGroupContext,
): ExceptionGroupRow[] {
  const { organizationId, historicalImportId, sourceDocumentName, reportingYear } = context;
  const sourceLabel = sourceDocumentName || 'the imported report';
  const sourceRef = { historicalImportId, sourceDocumentName, reportingYear };
  const rows: ExceptionGroupRow[] = [];

  const facilities = (extraction.facilities || []).filter((f) => f?.name?.toString().trim());
  if (facilities.length > 0) {
    const names = facilities.map((f) => f.name.toString().trim());
    rows.push({
      organization_id: organizationId,
      kind: 'migration_facilities',
      source: 'upload',
      source_ref: sourceRef,
      payload: { items: facilities, sourceDocumentName, historicalImportId },
      title: `${facilities.length} facilit${facilities.length === 1 ? 'y' : 'ies'} found in ${sourceLabel}`,
      summary: namesPreview(names),
      confidence: 0.6,
      status: 'open',
    });
  }

  const products = (extraction.products || []).filter((p) => p?.product_name?.toString().trim());
  if (products.length > 0) {
    const names = products.map((p) => p.product_name.toString().trim());
    rows.push({
      organization_id: organizationId,
      kind: 'migration_products',
      source: 'upload',
      source_ref: sourceRef,
      payload: { items: products, sourceDocumentName, historicalImportId, reportingYear },
      title: `${products.length} product PCF${products.length === 1 ? '' : 's'} found in ${sourceLabel}`,
      summary: namesPreview(names),
      confidence: 0.55,
      status: 'open',
    });
  }

  const targets = (extraction.targets || []).filter((t) => t?.metric?.toString().trim());
  if (targets.length > 0) {
    const names = targets.map((t) => t.metric.toString().trim());
    rows.push({
      organization_id: organizationId,
      kind: 'migration_targets',
      source: 'upload',
      source_ref: sourceRef,
      payload: { items: targets, sourceDocumentName, historicalImportId },
      title: `${targets.length} target${targets.length === 1 ? '' : 's'} found in ${sourceLabel}`,
      summary: namesPreview(names),
      confidence: 0.6,
      status: 'open',
    });
  }

  const certifications = (extraction.certifications_held || []).filter((c) => c?.toString().trim());
  if (certifications.length > 0) {
    rows.push({
      organization_id: organizationId,
      kind: 'migration_certifications',
      source: 'upload',
      source_ref: sourceRef,
      payload: {
        items: certifications.map((name) => ({ name: name.toString().trim() })),
        sourceDocumentName,
        historicalImportId,
      },
      title: `${certifications.length} certification${certifications.length === 1 ? '' : 's'} found in ${sourceLabel}`,
      summary: namesPreview(certifications),
      confidence: 0.65,
      status: 'open',
    });
  }

  return rows;
}

/**
 * Turn extra years found in `annual_totals` into additional historical_imports
 * insert payloads, so the trend/CCF fallback (lib/trends/historical-fallback.ts,
 * queried per-year) has data for every year the document actually covers, not
 * just the single headline year the review panel captured. The caller writes
 * these with the same `kind`/`storage_object_path` as the primary row for
 * shared provenance; skips a year that matches the primary row to avoid a
 * duplicate.
 */
export function additionalAnnualHistoricalRows(
  annualTotals: MigrationAnnualTotal[] | undefined,
  primaryReportingYear: number | null,
): Array<{ reporting_year: number; extracted_data: Record<string, unknown> }> {
  if (!annualTotals?.length) return [];
  const seen = new Set<number>();
  const rows: Array<{ reporting_year: number; extracted_data: Record<string, unknown> }> = [];
  for (const t of annualTotals) {
    const year = Number(t?.year);
    if (!Number.isFinite(year) || year === primaryReportingYear || seen.has(year)) continue;
    seen.add(year);
    rows.push({
      reporting_year: year,
      extracted_data: {
        reporting_year: year,
        scope1_tco2e: t.scope1_tco2e,
        scope2_tco2e_market: t.scope2_tco2e_market,
        scope2_tco2e_location: t.scope2_tco2e_location,
        scope3_tco2e: t.scope3_tco2e,
        water_m3: t.water_m3,
        waste_tonnes: t.waste_tonnes,
        energy_kwh: t.energy_kwh,
      },
    });
  }
  return rows;
}
