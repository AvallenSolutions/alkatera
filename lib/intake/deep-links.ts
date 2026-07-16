/**
 * Real deep-links for `agent_exceptions` kinds that need a human to finish
 * the job in a wizard rather than an auto-write — the same `?stash_id=` /
 * `&stash_kind=` URLs the Universal Dropzone's own handoff panels build
 * (`components/layouts/UniversalDropzone.tsx`), read back out by
 * `hooks/useIngestStash.ts` and the hospitality managers. Building the same
 * URL shape here means clicking through from the queue lands on a page that
 * genuinely knows how to pick the file back up — no dead ends.
 *
 * Every ingest-classified kind's payload nests its extraction under a
 * camelCase key that carries a `stashId` field (see
 * `lib/ingest/classify-document.ts` shapeIngestResultInner) — that's the
 * storage path in the `ingest-staging` bucket, i.e. exactly what
 * `stash_id` needs to be on the target URL.
 */

export type AssetPickerType = 'vineyards' | 'orchards' | 'arable-fields' | 'products';

export interface AssetTypeMeta {
  type: AssetPickerType;
  label: string;
  apiPath: string;
  pageBase: string;
}

/** The three growing-record asset types the AssetHandoffPanel-style picker offers. */
export const GROWING_ASSET_TYPES: AssetTypeMeta[] = [
  { type: 'vineyards', label: 'Vineyard', apiPath: '/api/vineyards', pageBase: '/vineyards' },
  { type: 'orchards', label: 'Orchard', apiPath: '/api/orchards', pageBase: '/orchards' },
  { type: 'arable-fields', label: 'Arable field', apiPath: '/api/arable-fields', pageBase: '/arable-fields' },
];

export const PRODUCT_ASSET_TYPE: AssetTypeMeta = {
  type: 'products',
  label: 'Product',
  apiPath: '/api/products',
  pageBase: '/products',
};

/** Which nested payload key (per classify-document.ts) carries this kind's `stashId`. */
const PAYLOAD_KEY_BY_KIND: Record<string, string> = {
  bom: 'bom',
  spray_diary: 'sprayDiary',
  soil_carbon_evidence: 'soilCarbonEvidence',
  hospitality_menu: 'hospitalityMenu',
  pos_sales_export: 'posSalesExport',
  packaging_spec: 'packagingSpec',
};

export function getStashId(kind: string, payload: any): string | null {
  const key = PAYLOAD_KEY_BY_KIND[kind];
  if (!key) return null;
  const stashId = payload?.[key]?.stashId;
  return typeof stashId === 'string' && stashId.length > 0 ? stashId : null;
}

export interface HandoffConfig {
  /** Does approving this kind need the user to pick a record first? */
  assetPicker: 'growing' | 'product' | null;
  /** The `stash_kind` query param the TARGET page's useIngestStash hook expects
   *  — this can differ from the exception `kind` (e.g. spray_diary -> 'spray'). */
  stashKind: 'bom' | 'spray' | 'evidence' | 'hospitality_menu' | 'pos_sales' | null;
  /** Fixed destination for kinds with no per-record picker. */
  staticHref: string | null;
  /** Shown next to the deep-link button so the user knows what finishing looks like. */
  helperText: string;
  buttonLabel: string;
}

export const HANDOFF_CONFIG: Record<string, HandoffConfig> = {
  bom: {
    assetPicker: 'product',
    stashKind: 'bom',
    staticHref: null,
    helperText: 'Pick the product to attach this recipe to.',
    buttonLabel: 'Finish in the recipe editor',
  },
  spray_diary: {
    assetPicker: 'growing',
    stashKind: 'spray',
    staticHref: null,
    helperText: 'Pick which vineyard, orchard or field this diary belongs to.',
    buttonLabel: 'Finish on the growing profile',
  },
  soil_carbon_evidence: {
    assetPicker: 'growing',
    stashKind: 'evidence',
    staticHref: null,
    helperText: 'Pick which vineyard, orchard or field this evidence supports.',
    buttonLabel: 'Finish on the growing profile',
  },
  hospitality_menu: {
    assetPicker: null,
    stashKind: 'hospitality_menu',
    staticHref: '/hospitality/menus',
    helperText: 'Map the menu items to products.',
    buttonLabel: 'Finish in Menus',
  },
  pos_sales_export: {
    assetPicker: null,
    stashKind: 'pos_sales',
    staticHref: '/hospitality/sales',
    helperText: 'Map the sales export to products.',
    buttonLabel: 'Finish in Sales',
  },
  packaging_spec: {
    assetPicker: null,
    stashKind: null,
    staticHref: '/products',
    helperText: "Reopen Smart Upload from the product's Packaging tab — the file itself isn't carried across automatically.",
    buttonLabel: 'Go to Products',
  },
  bulk_xlsx: {
    assetPicker: null,
    stashKind: null,
    staticHref: '/products/import',
    helperText: 'Reopen the bulk import wizard with this file.',
    buttonLabel: 'Open bulk import',
  },
  accounts_csv: {
    assetPicker: null,
    stashKind: null,
    staticHref: '/data/spend-data',
    helperText: 'Import this export from the spend-data page.',
    buttonLabel: 'Go to spend data',
  },
  website_import: {
    assetPicker: null,
    stashKind: null,
    staticHref: '/products',
    helperText: 'Review the products this website import created.',
    buttonLabel: 'View products',
  },
  supplier_catalog_import: {
    assetPicker: null,
    stashKind: null,
    staticHref: '/supplier-portal/products',
    helperText: 'Reopen Smart Import to review and confirm these products.',
    buttonLabel: 'Open Smart Import',
  },
};

export function isHandoffKind(kind: string): boolean {
  return kind in HANDOFF_CONFIG;
}

/**
 * Build the real URL for a handoff kind. Returns null when a picker is
 * required and no asset has been chosen yet (`assetId`/`assetType` missing)
 * — the caller should render the picker rather than the button in that case.
 */
export function buildDeepLink(
  kind: string,
  opts: { stashId?: string | null; assetType?: AssetPickerType | null; assetId?: string | null },
): string | null {
  const cfg = HANDOFF_CONFIG[kind];
  if (!cfg) return null;

  if (cfg.assetPicker) {
    if (!opts.assetId || !opts.assetType) return null;
    const meta =
      opts.assetType === 'products' ? PRODUCT_ASSET_TYPE : GROWING_ASSET_TYPES.find((a) => a.type === opts.assetType);
    if (!meta) return null;
    const suffix = meta.type === 'products' ? '/recipe' : '';
    const base = `${meta.pageBase}/${opts.assetId}${suffix}`;
    if (!opts.stashId || !cfg.stashKind) return base;
    const params = new URLSearchParams({ stash_id: opts.stashId, stash_kind: cfg.stashKind });
    return `${base}?${params.toString()}`;
  }

  if (!cfg.staticHref) return null;
  if (cfg.stashKind && opts.stashId) {
    const params = new URLSearchParams({ stash_id: opts.stashId, stash_kind: cfg.stashKind });
    return `${cfg.staticHref}?${params.toString()}`;
  }
  return cfg.staticHref;
}
