import {
  DRINKS_CO_ORG_ID,
  FACILITIES,
  KEEP_PRODUCT_IDS,
  OWNER_USER_ID,
  PRODUCTS,
  VINEYARD_ID,
  type SeedCtx,
} from './shared';

/**
 * Foundation pass: make the seed self-sufficient on an EMPTY environment
 * (staging, a fresh local stack) while being a no-op on production, where the
 * org, its owner, the six facilities and the nine showcase products already
 * exist.
 *
 * The rest of the seeder was written against production's existing data and
 * assumes those rows: entities.ts curates them, lca.ts reads their BOMs,
 * operations/epr/hospitality key off the fixed ids. Without this pass a fresh
 * environment fails at the first FK (the orchard's facility_id), previously
 * silently, then fatally in rebuildCalvados.
 *
 * Prod-safety rule: every step here is create-if-missing. Rows that already
 * exist are never updated, renamed or re-branded by this module; the curation
 * code in entities.ts owns any deliberate touch-ups.
 */

/** What each keeper product must look like when it has to be created. */
const PRODUCT_SEEDS: Record<number, { name: string; category: string; sizeValue: number | null; sizeUnit: string | null }> = {
  [PRODUCTS.bacchus]: { name: 'Bacchus English White Wine', category: 'Wine', sizeValue: 750, sizeUnit: 'ml' },
  [PRODUCTS.highlandMalt]: { name: 'Highland Reserve 12 Year Old Single Malt', category: 'Spirits', sizeValue: 700, sizeUnit: 'ml' },
  [PRODUCTS.sessionAle]: { name: 'West Country Session Ale', category: 'Beer & Cider', sizeValue: 500, sizeUnit: 'ml' },
  [PRODUCTS.botanicaZero]: { name: 'Botanica Zero', category: 'Non-Alcoholic', sizeValue: 500, sizeUnit: 'ml' },
  [PRODUCTS.bathGin]: { name: 'Bath Gin', category: 'Spirits', sizeValue: 700, sizeUnit: 'ml' },
  [PRODUCTS.calvadosGlass]: { name: 'Orchard Calvados (Glass Bottle)', category: 'Spirits', sizeValue: 700, sizeUnit: 'ml' },
  [PRODUCTS.calvadosPaper]: { name: 'Orchard Calvados (Paper Bottle)', category: 'Spirits', sizeValue: 700, sizeUnit: 'ml' },
  // Name must match the hardcoded PCF product_name in lca.ts.
  [PRODUCTS.ipaCase]: { name: 'Floral Haze IPA - 24 × 330ml Can', category: 'Beer & Cider', sizeValue: null, sizeUnit: null },
  [PRODUCTS.ipaCan]: { name: 'Floral Haze IPA 330ml Can', category: 'Beer & Cider', sizeValue: 330, sizeUnit: 'ml' },
};

/** The six facilities, when they have to be created (names match entities.ts ALLOCATIONS). */
const FACILITY_SEEDS: { id: string; name: string; operational_control: 'owned' | 'third_party'; city: string }[] = [
  { id: FACILITIES.winery, name: 'Cotswolds Estate Winery', operational_control: 'owned', city: 'Cheltenham' },
  { id: FACILITIES.distillery, name: 'Highland Malt Distillery', operational_control: 'owned', city: 'Inverness' },
  { id: FACILITIES.bottling, name: 'Premier Bottling Services', operational_control: 'third_party', city: 'Glasgow' },
  { id: FACILITIES.brewery, name: 'West Country Brewery', operational_control: 'owned', city: 'Bristol' },
  { id: FACILITIES.headOffice, name: 'Bristol Head Office', operational_control: 'owned', city: 'Bristol' },
  { id: FACILITIES.botanical, name: 'Botanical Partners Ltd', operational_control: 'third_party', city: 'Leeds' },
];

type Bom = Record<string, unknown>[];

function ingredient(productId: number, name: string, quantity: number, unit: string, extra: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    product_id: productId,
    material_name: name,
    material_type: 'ingredient',
    quantity,
    unit,
    is_self_grown: false,
    origin_country: 'United Kingdom',
    origin_country_code: 'GB',
    transport_mode: 'truck',
    distance_km: 120,
    ...extra,
  };
}

function packaging(
  productId: number,
  name: string,
  category: 'container' | 'closure' | 'label' | 'secondary' | 'tertiary',
  netWeightG: number,
  extra: Record<string, unknown> = {},
): Record<string, unknown> {
  return {
    product_id: productId,
    material_name: name,
    material_type: 'packaging',
    packaging_category: category,
    quantity: netWeightG / 1000,
    unit: 'kg',
    net_weight_g: netWeightG,
    total_weight_kg: netWeightG / 1000,
    is_self_grown: false,
    recycled_content_percentage: 0,
    origin_country: 'United Kingdom',
    origin_country_code: 'GB',
    transport_mode: 'truck',
    distance_km: 200,
    ...extra,
  };
}

/**
 * Minimal, plausible bills of materials for products created from nothing.
 * Only written when a product has NO material rows at all, so production's
 * real BOMs are never touched. The two Calvados variants are excluded:
 * entities.ts rebuildCalvados() owns their BOMs unconditionally.
 *
 * Without these, an empty environment would seed products with no materials,
 * lca.ts would skip their PCFs (it requires at least one material) and the EPR
 * module would have no packaging to report.
 */
const BASELINE_BOMS: Record<number, Bom> = {
  [PRODUCTS.bacchus]: [
    // ensureAgriculture() marks this exact material self-grown + links the vineyard.
    ingredient(PRODUCTS.bacchus, 'Bacchus Grapes', 1.2, 'kg', { distance_km: 20 }),
    ingredient(PRODUCTS.bacchus, 'Winemaking Yeast (Saccharomyces cerevisiae)', 0.001, 'kg'),
    ingredient(PRODUCTS.bacchus, 'Water', 0.15, 'l', { transport_mode: null, distance_km: null }),
    packaging(PRODUCTS.bacchus, '750ml Green Glass Bottle', 'container', 480, { recycled_content_percentage: 60, epr_is_drinks_container: true }),
    packaging(PRODUCTS.bacchus, 'Natural Cork Stopper', 'closure', 5, { origin_country: 'Portugal', origin_country_code: 'PT', distance_km: 1800 }),
    packaging(PRODUCTS.bacchus, 'Paper Label (Front & Back)', 'label', 3, { recycled_content_percentage: 30 }),
    packaging(PRODUCTS.bacchus, 'Cardboard Case (6pk)', 'secondary', 70, { recycled_content_percentage: 80, units_per_group: 6 }),
  ],
  [PRODUCTS.highlandMalt]: [
    ingredient(PRODUCTS.highlandMalt, 'Malted Barley', 1.9, 'kg'),
    ingredient(PRODUCTS.highlandMalt, 'Distillers Yeast (Saccharomyces cerevisiae)', 0.002, 'kg', { distance_km: 250 }),
    ingredient(PRODUCTS.highlandMalt, 'Water', 0.9, 'l', { transport_mode: null, distance_km: null }),
    packaging(PRODUCTS.highlandMalt, '700ml Flint Glass Bottle', 'container', 550, { recycled_content_percentage: 40, epr_is_drinks_container: true }),
    packaging(PRODUCTS.highlandMalt, 'Wooden Bar Top Stopper', 'closure', 15),
    packaging(PRODUCTS.highlandMalt, 'Paper Label (Front & Back)', 'label', 3, { recycled_content_percentage: 30 }),
    packaging(PRODUCTS.highlandMalt, 'Presentation Gift Box', 'secondary', 150, { recycled_content_percentage: 60, units_per_group: 1 }),
  ],
  [PRODUCTS.sessionAle]: [
    ingredient(PRODUCTS.sessionAle, 'Pale Ale Malt', 0.11, 'kg'),
    ingredient(PRODUCTS.sessionAle, 'Fuggles Hops', 0.0012, 'kg'),
    ingredient(PRODUCTS.sessionAle, 'Brewing Yeast', 0.0005, 'kg'),
    ingredient(PRODUCTS.sessionAle, 'Water', 0.45, 'l', { transport_mode: null, distance_km: null }),
    packaging(PRODUCTS.sessionAle, '500ml Amber Glass Bottle', 'container', 300, { recycled_content_percentage: 55, epr_is_drinks_container: true }),
    packaging(PRODUCTS.sessionAle, 'Steel Crown Cap', 'closure', 2),
    packaging(PRODUCTS.sessionAle, 'Paper Label (Front & Back)', 'label', 2, { recycled_content_percentage: 30 }),
    packaging(PRODUCTS.sessionAle, 'Cardboard Tray (12pk)', 'secondary', 55, { recycled_content_percentage: 80, units_per_group: 12 }),
  ],
  [PRODUCTS.botanicaZero]: [
    ingredient(PRODUCTS.botanicaZero, 'Juniper & Citrus Botanical Blend', 0.02, 'kg'),
    ingredient(PRODUCTS.botanicaZero, 'Natural Sweetener', 0.012, 'kg'),
    ingredient(PRODUCTS.botanicaZero, 'Water', 0.47, 'l', { transport_mode: null, distance_km: null }),
    packaging(PRODUCTS.botanicaZero, '500ml Flint Glass Bottle', 'container', 420, { recycled_content_percentage: 50, epr_is_drinks_container: true }),
    packaging(PRODUCTS.botanicaZero, 'Aluminium Screw Cap', 'closure', 5),
    packaging(PRODUCTS.botanicaZero, 'Paper Label (Front & Back)', 'label', 3, { recycled_content_percentage: 30 }),
  ],
  [PRODUCTS.bathGin]: [
    ingredient(PRODUCTS.bathGin, 'Neutral Grain Spirit', 0.65, 'l'),
    ingredient(PRODUCTS.bathGin, 'Juniper Berries', 0.014, 'kg', { origin_country: 'North Macedonia', origin_country_code: 'MK', distance_km: 2200 }),
    ingredient(PRODUCTS.bathGin, 'Coriander Seed', 0.005, 'kg'),
    ingredient(PRODUCTS.bathGin, 'Angelica Root', 0.002, 'kg'),
    ingredient(PRODUCTS.bathGin, 'Water', 0.2, 'l', { transport_mode: null, distance_km: null }),
    packaging(PRODUCTS.bathGin, '700ml Flint Glass Bottle', 'container', 500, { recycled_content_percentage: 45, epr_is_drinks_container: true }),
    packaging(PRODUCTS.bathGin, 'Wooden Bar Top Stopper', 'closure', 18),
    packaging(PRODUCTS.bathGin, 'Paper Label (Front & Back)', 'label', 3, { recycled_content_percentage: 30 }),
    packaging(PRODUCTS.bathGin, 'Cardboard Case (6pk)', 'secondary', 70, { recycled_content_percentage: 80, units_per_group: 6 }),
  ],
  [PRODUCTS.ipaCan]: [
    ingredient(PRODUCTS.ipaCan, 'Pale Ale Malt', 0.078, 'kg'),
    ingredient(PRODUCTS.ipaCan, 'Citra Hops', 0.002, 'kg', { origin_country: 'United States', origin_country_code: 'US', transport_mode: 'ship', distance_km: 7500 }),
    ingredient(PRODUCTS.ipaCan, 'Brewing Yeast', 0.0004, 'kg'),
    ingredient(PRODUCTS.ipaCan, 'Water', 0.3, 'l', { transport_mode: null, distance_km: null }),
    packaging(PRODUCTS.ipaCan, '330ml Aluminium Can', 'container', 13, { recycled_content_percentage: 70, epr_is_drinks_container: true }),
    packaging(PRODUCTS.ipaCan, 'Aluminium Can End (Ring Pull)', 'closure', 3, { recycled_content_percentage: 70 }),
  ],
  // The case is a multipack of the can: only its own secondary/tertiary packaging.
  [PRODUCTS.ipaCase]: [
    packaging(PRODUCTS.ipaCase, 'Cardboard 24-can Case', 'secondary', 320, { recycled_content_percentage: 85, units_per_group: 24 }),
    packaging(PRODUCTS.ipaCase, 'LDPE Shrink Wrap', 'tertiary', 18, { units_per_group: 24 }),
  ],
};

/**
 * Resolve the auth user the seed attributes rows to. Prefers production's
 * owner account, falls back to any alkatera admin profile, then the first
 * auth user. Throws when the environment has no users at all: several seeded
 * tables have NOT NULL user FKs, so there is nothing sensible to write.
 */
async function resolveOwnerUser(ctx: SeedCtx): Promise<string> {
  const { svc } = ctx;

  const { data: prodOwner } = await svc.auth.admin.getUserById(OWNER_USER_ID);
  if (prodOwner?.user) return OWNER_USER_ID;

  const { data: admin } = await svc
    .from('profiles')
    .select('id')
    .eq('is_alkatera_admin', true)
    .limit(1)
    .maybeSingle();
  if (admin?.id) return admin.id as string;

  const { data: list } = await svc.auth.admin.listUsers({ page: 1, perPage: 1 });
  const first = list?.users?.[0]?.id;
  if (first) return first;

  throw new Error('foundation: no auth users exist in this environment. Create at least one account, then re-run the seed.');
}

/** Create the org if it is missing. An existing org is never modified here. */
async function ensureOrg(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;
  const { data: existing, error: readErr } = await svc.from('organizations').select('id').eq('id', orgId).maybeSingle();
  if (readErr) throw new Error(`foundation: organizations read: ${readErr.message}`);
  if (existing) return;

  // Mirrors how app code creates orgs (name + slug + subscription fields).
  // canopy/active so the product- and facility-limit triggers admit the full
  // demo dataset (9 showcase products + hospitality recipes + 6 facilities).
  const row = {
    id: orgId,
    name: 'alkatera Drinks Co',
    country: 'United Kingdom',
    industry_sector: 'Drinks production',
    company_size: '11-50 employees',
    subscription_tier: 'canopy',
    subscription_status: 'active',
  };

  const { error } = await svc.from('organizations').insert({ ...row, slug: 'alkatera-drinks-co' });
  if (!error) return;
  // Another org may already hold the slug (it is unique); retry with a suffix.
  if (/duplicate|unique/i.test(error.message)) {
    const { error: retryErr } = await svc.from('organizations').insert({ ...row, slug: `alkatera-drinks-co-${orgId.slice(0, 8)}` });
    if (retryErr) throw new Error(`foundation: organizations insert: ${retryErr.message}`);
    return;
  }
  throw new Error(`foundation: organizations insert: ${error.message}`);
}

/** Make sure the resolved owner is an owner-role member, so the org is reachable in the UI. */
async function ensureMembership(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;
  const { data: role, error: roleErr } = await svc.from('roles').select('id').eq('name', 'owner').maybeSingle();
  if (roleErr || !role) throw new Error(`foundation: owner role lookup failed: ${roleErr?.message ?? 'roles table has no owner row'}`);

  // Create-if-missing: an existing membership (whatever its role) is kept as-is.
  const { error } = await svc
    .from('organization_members')
    .upsert(
      { organization_id: orgId, user_id: ctx.ownerUserId, role_id: (role as { id: string }).id },
      { onConflict: 'organization_id,user_id', ignoreDuplicates: true },
    );
  if (error) throw new Error(`foundation: organization_members: ${error.message}`);
}

/** Create any of the six fixed-UUID facilities that are missing. Existing rows untouched. */
async function ensureFacilities(ctx: SeedCtx): Promise<number> {
  const { svc, orgId } = ctx;
  const ids = FACILITY_SEEDS.map((f) => f.id);
  const { data: existing, error: readErr } = await svc.from('facilities').select('id').in('id', ids);
  if (readErr) throw new Error(`foundation: facilities read: ${readErr.message}`);
  const have = new Set((existing ?? []).map((r: { id: string }) => r.id));
  const missing = FACILITY_SEEDS.filter((f) => !have.has(f.id));
  if (missing.length === 0) return 0;

  const rows = missing.map((f) => ({
    id: f.id,
    organization_id: orgId,
    name: f.name,
    operational_control: f.operational_control,
    address_city: f.city,
    address_country: 'United Kingdom',
    location_country_code: 'GB',
  }));
  const { error } = await svc.from('facilities').insert(rows);
  if (error) throw new Error(`foundation: facilities insert: ${error.message}`);
  return missing.length;
}

/**
 * Create the estate vineyard if it is missing. entities.ts and energy-geo.ts
 * only ever UPDATE this fixed UUID (it pre-exists on prod), and the Bacchus
 * grape material is linked to it, so an empty environment needs the row.
 */
async function ensureVineyard(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;
  const { data: existing, error: readErr } = await svc.from('vineyards').select('id').eq('id', VINEYARD_ID).maybeSingle();
  if (readErr) throw new Error(`foundation: vineyards read: ${readErr.message}`);
  if (existing) return;

  const { error } = await svc.from('vineyards').insert({
    id: VINEYARD_ID,
    organization_id: orgId,
    facility_id: FACILITIES.winery,
    name: 'Estate Bacchus Vineyard',
    hectares: 6.5,
    grape_varieties: ['Bacchus'],
    annual_yield_tonnes: 42,
    yield_tonnes_per_ha: 6.5,
    location_country_code: 'GB',
    address_country: 'United Kingdom',
  });
  if (error) throw new Error(`foundation: vineyards insert: ${error.message}`);
}

/**
 * Create any missing keeper products under their fixed bigint ids. Existing
 * rows are never renamed or recategorised here (curation owns touch-ups).
 * Returns the ids that were created.
 */
async function ensureProducts(ctx: SeedCtx): Promise<number[]> {
  const { svc, orgId } = ctx;
  const { data: existing, error: readErr } = await svc.from('products').select('id, organization_id').in('id', KEEP_PRODUCT_IDS);
  if (readErr) throw new Error(`foundation: products read: ${readErr.message}`);

  const foreign = (existing ?? []).filter((r: { organization_id: string }) => r.organization_id !== orgId);
  if (foreign.length > 0) {
    throw new Error(
      `foundation: product id(s) ${foreign.map((r: { id: number }) => r.id).join(', ')} already belong to a different organisation in this environment. ` +
        'The demo seed curates these fixed ids in place and would corrupt that data. Resolve the collision before seeding.',
    );
  }

  const have = new Set((existing ?? []).map((r: { id: number }) => r.id));
  const missing = KEEP_PRODUCT_IDS.filter((id) => !have.has(id));
  if (missing.length === 0) return [];

  const rows = missing.map((id) => {
    const seed = PRODUCT_SEEDS[id];
    return {
      id,
      organization_id: orgId,
      name: seed.name,
      product_category: seed.category,
      unit_size_value: seed.sizeValue,
      unit_size_unit: seed.sizeUnit,
      is_draft: false,
      created_by: ctx.ownerUserId,
    };
  });
  const { error } = await svc.from('products').insert(rows);
  if (error) throw new Error(`foundation: products insert: ${error.message}`);
  return missing;
}

/** Write a baseline BOM for any keeper product that has no materials at all. */
async function ensureBaselineBoms(ctx: SeedCtx): Promise<number> {
  const { svc } = ctx;
  let written = 0;
  for (const [pidStr, bom] of Object.entries(BASELINE_BOMS)) {
    const pid = Number(pidStr);
    const { data: any1, error: readErr } = await svc.from('product_materials').select('id').eq('product_id', pid).limit(1);
    if (readErr) throw new Error(`foundation: product_materials read ${pid}: ${readErr.message}`);
    if ((any1 ?? []).length > 0) continue; // the product already has a real BOM
    const { error } = await svc.from('product_materials').insert(bom);
    if (error) throw new Error(`foundation: baseline BOM ${pid}: ${error.message}`);
    written++;
  }
  return written;
}

/**
 * products.id is a bigint identity. After inserting the keepers under explicit
 * ids the sequence still sits below them, so later natural inserts (the
 * hospitality recipes, or a user creating a product) would eventually collide
 * with the fixed ids. PostgREST cannot call setval, so the sequence is advanced
 * by burning values: batches of throwaway rows inserted with default ids
 * (conflicts ignored; a conflicting row still consumes its sequence value) and
 * deleted immediately, until an assigned id clears the highest keeper id.
 *
 * Only runs when this seed actually created keeper products, so production
 * (where they all exist and the sequence is already past them) never enters.
 */
async function syncProductIdSequence(ctx: SeedCtx, createdIds: number[]): Promise<void> {
  if (createdIds.length === 0) return;
  const { svc, orgId } = ctx;
  const maxKeep = Math.max(...KEEP_PRODUCT_IDS);
  const BATCH = 40; // stays well inside the org's product-limit trigger headroom

  for (let i = 0; i < 8; i++) {
    const rows = Array.from({ length: BATCH }, () => ({
      organization_id: orgId,
      name: 'zz demo seed sequence sync (transient)',
      is_draft: true,
      created_by: ctx.ownerUserId,
    }));
    const { data, error } = await svc.from('products').upsert(rows, { ignoreDuplicates: true }).select('id');
    if (error) throw new Error(`foundation: products id sequence sync: ${error.message}`);
    const ids = (data ?? []).map((r: { id: number }) => Number(r.id));
    if (ids.length > 0) {
      const { error: delErr } = await svc.from('products').delete().in('id', ids);
      if (delErr) throw new Error(`foundation: sequence sync cleanup: ${delErr.message}`);
    }
    if (ids.some((id) => id > maxKeep)) return;
  }
  throw new Error('foundation: could not advance the products id sequence past the seeded ids');
}

/**
 * Ensure the org, owner membership, facilities, vineyard and keeper products
 * exist before the rest of the seed curates them. Must run FIRST.
 */
export async function ensureFoundation(ctx: SeedCtx): Promise<void> {
  ctx.ownerUserId = await resolveOwnerUser(ctx);

  await ensureOrg(ctx);
  await ensureMembership(ctx);
  const createdFacilities = await ensureFacilities(ctx);
  await ensureVineyard(ctx);
  const createdProducts = await ensureProducts(ctx);
  const bomsWritten = await ensureBaselineBoms(ctx);
  await syncProductIdSequence(ctx, createdProducts);

  ctx.report.foundation =
    createdFacilities === 0 && createdProducts.length === 0 && bomsWritten === 0
      ? 'org, facilities and products already present (no-op)'
      : `created ${createdProducts.length} products, ${createdFacilities} facilities, ${bomsWritten} baseline BOMs (empty-environment bootstrap)`;
}
