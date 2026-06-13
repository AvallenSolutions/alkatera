import {
  DELETE_PRODUCT_IDS,
  FACILITIES,
  JUNK_FACILITY_IDS,
  ORCHARD_ID,
  PRODUCTS,
  REFERENCE_YEAR,
  VINEYARD_ID,
  type SeedCtx,
} from './shared';

/**
 * Curate the existing org data: drop duplicate/incomplete draft products and
 * the two junk facilities, normalise categories, and un-draft the keepers.
 */
async function curate(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  // Remove clutter products (and their dependents) so the list reads cleanly.
  await svc.from('multipack_components').delete().in('component_product_id', DELETE_PRODUCT_IDS);
  await svc.from('multipack_components').delete().in('multipack_product_id', DELETE_PRODUCT_IDS);
  await svc.from('product_materials').delete().in('product_id', DELETE_PRODUCT_IDS);
  await svc.from('product_carbon_footprints').delete().in('product_id', DELETE_PRODUCT_IDS);
  const { error: delProd } = await svc.from('products').delete().eq('organization_id', orgId).in('id', DELETE_PRODUCT_IDS);
  if (delProd) ctx.warnings.push(`product cleanup: ${delProd.message}`);

  // Remove the two generic junk facilities (only if free of dependents).
  for (const fid of JUNK_FACILITY_IDS) {
    const { error } = await svc.from('facilities').delete().eq('id', fid).eq('organization_id', orgId);
    if (error) ctx.warnings.push(`junk facility ${fid.slice(0, 8)}: ${error.message}`);
  }

  // Normalise the lowercase "beer" category left by the Breww import.
  await svc.from('products').update({ product_category: 'Beer & Cider' }).eq('organization_id', orgId).eq('product_category', 'beer');

  ctx.report.curation = `removed ${DELETE_PRODUCT_IDS.length} clutter products + ${JUNK_FACILITY_IDS.length} junk facilities`;
}

/** Light facility touch-ups: ensure country code for grid + water-scarcity factors. */
async function ensureFacilities(ctx: SeedCtx): Promise<void> {
  const ids = Object.values(FACILITIES);
  await ctx.svc
    .from('facilities')
    .update({ location_country_code: 'GB', address_country: 'United Kingdom' })
    .in('id', ids)
    .is('location_country_code', null);
  ctx.report.facilities = `${ids.length} facilities confirmed (GB)`;
}

/**
 * Wire the agricultural features: link the existing vineyard + growing profile
 * to the Bacchus grape material, and create an apple orchard for the Calvados.
 */
async function ensureAgriculture(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  // --- Viticulture: vineyard -> Bacchus grapes ---
  await svc
    .from('vineyards')
    .update({
      vine_planting_year: 2012,
      climate_zone: 'temperate',
      previous_land_use_type: 'grassland',
      land_conversion_year: 2011,
      location_country_code: 'GB',
    })
    .eq('id', VINEYARD_ID);

  // Attach the 2024 growing profile to the wine product.
  await svc.from('vineyard_growing_profiles').update({ product_id: PRODUCTS.bacchus, is_draft: false }).eq('vineyard_id', VINEYARD_ID);

  // Mark the grape material self-grown so the calculator pulls cultivation data.
  await svc
    .from('product_materials')
    .update({ is_self_grown: true, vineyard_id: VINEYARD_ID })
    .eq('product_id', PRODUCTS.bacchus)
    .eq('material_name', 'Bacchus Grapes');

  // --- Orchard: apples -> Calvados ---
  await svc.from('orchards').upsert(
    {
      id: ORCHARD_ID,
      organization_id: orgId,
      facility_id: FACILITIES.distillery,
      name: 'West Country Cider Orchard',
      hectares: 14.5,
      orchard_type: 'apple',
      certification: 'organic',
      climate_zone: 'temperate',
      fruit_varieties: ['Dabinett', 'Yarlington Mill', 'Kingston Black'],
      annual_yield_tonnes: 290,
      yield_tonnes_per_ha: 20,
      planting_year: 2009,
      tree_density_per_ha: 420,
      location_country_code: 'GB',
      address_country: 'United Kingdom',
      previous_land_use_type: 'grassland',
      land_conversion_year: 2008,
      is_active: true,
    },
    { onConflict: 'id' },
  );

  await svc.from('orchard_growing_profiles').upsert(
    {
      orchard_id: ORCHARD_ID,
      organization_id: orgId,
      harvest_year: 2024,
      area_ha: 14.5,
      soil_management: 'cover_cropping',
      pruning_residue_returned: true,
      fertiliser_type: 'organic_compost',
      fertiliser_quantity_kg: 8200,
      fertiliser_n_content_percent: 1.5,
      uses_pesticides: false,
      pesticide_applications_per_year: 0,
      uses_herbicides: false,
      herbicide_applications_per_year: 0,
      diesel_litres_per_year: 2400,
      petrol_litres_per_year: 180,
      is_irrigated: false,
      water_m3_per_ha: 0,
      irrigation_energy_source: 'none',
      fruit_yield_tonnes: 290,
      transport_distance_km: 35,
      transport_mode: 'road',
      is_draft: false,
    },
    { onConflict: 'orchard_id,harvest_year' },
  );

  ctx.report.agriculture = 'vineyard linked to Bacchus; orchard created + linked to Calvados';
}

interface CalvadosBom {
  productId: number;
  /** 'glass' or 'paper' bottle variant. */
  bottle: { name: string; net_weight_g: number; recycled: number; category: string };
}

/** Rebuild the two Calvados BOMs cleanly (orchard apples + proper packaging). */
async function rebuildCalvados(ctx: SeedCtx): Promise<void> {
  const { svc } = ctx;
  const variants: CalvadosBom[] = [
    { productId: PRODUCTS.calvadosGlass, bottle: { name: '700ml Flint Glass Bottle', net_weight_g: 530, recycled: 45, category: 'container' } },
    { productId: PRODUCTS.calvadosPaper, bottle: { name: '700ml Moulded Paper Bottle', net_weight_g: 78, recycled: 95, category: 'container' } },
  ];

  for (const v of variants) {
    await svc.from('product_materials').delete().eq('product_id', v.productId);

    const ingredients = [
      {
        product_id: v.productId,
        material_name: 'Cider Apples',
        material_type: 'ingredient',
        quantity: 5.6,
        unit: 'kg',
        origin_country: 'United Kingdom',
        origin_country_code: 'GB',
        is_organic_certified: true,
        is_self_grown: true,
        orchard_id: ORCHARD_ID,
        transport_mode: 'truck',
        distance_km: 35,
        notes: 'Self-grown bittersweet cider apples from the West Country Cider Orchard. ~8 kg apples per litre of finished spirit.',
      },
      {
        product_id: v.productId,
        material_name: 'Distillers Yeast (Saccharomyces cerevisiae)',
        material_type: 'ingredient',
        quantity: 0.002,
        unit: 'kg',
        origin_country: 'United Kingdom',
        origin_country_code: 'GB',
        transport_mode: 'truck',
        distance_km: 250,
      },
      {
        product_id: v.productId,
        material_name: 'Water',
        material_type: 'ingredient',
        quantity: 0.4,
        unit: 'L',
        origin_country: 'United Kingdom',
        origin_country_code: 'GB',
      },
    ];

    const packaging = [
      {
        product_id: v.productId,
        material_name: v.bottle.name,
        material_type: 'packaging',
        packaging_category: v.bottle.category,
        quantity: v.bottle.net_weight_g / 1000,
        unit: 'kg',
        net_weight_g: v.bottle.net_weight_g,
        total_weight_kg: v.bottle.net_weight_g / 1000,
        recycled_content_percentage: v.bottle.recycled,
        epr_is_drinks_container: true,
        origin_country: 'United Kingdom',
        origin_country_code: 'GB',
        transport_mode: 'truck',
        distance_km: 300,
      },
      {
        product_id: v.productId,
        material_name: 'Natural Cork Stopper',
        material_type: 'packaging',
        packaging_category: 'closure',
        quantity: 0.006,
        unit: 'kg',
        net_weight_g: 6,
        total_weight_kg: 0.006,
        recycled_content_percentage: 0,
        origin_country: 'Portugal',
        origin_country_code: 'PT',
        transport_mode: 'truck',
        distance_km: 1800,
      },
      {
        product_id: v.productId,
        material_name: 'Paper Label (Front & Back)',
        material_type: 'packaging',
        packaging_category: 'label',
        quantity: 0.003,
        unit: 'kg',
        net_weight_g: 3,
        total_weight_kg: 0.003,
        recycled_content_percentage: 30,
        origin_country: 'United Kingdom',
        origin_country_code: 'GB',
        transport_mode: 'truck',
        distance_km: 120,
      },
      {
        product_id: v.productId,
        material_name: 'Cardboard Case (6pk)',
        material_type: 'packaging',
        packaging_category: 'secondary',
        quantity: 0.166667 * 0.42,
        unit: 'kg',
        net_weight_g: 70,
        total_weight_kg: 0.07,
        recycled_content_percentage: 80,
        origin_country: 'United Kingdom',
        origin_country_code: 'GB',
        transport_mode: 'truck',
        distance_km: 120,
      },
    ];

    const { error } = await svc.from('product_materials').insert([...ingredients, ...packaging]);
    if (error) throw new Error(`calvados BOM ${v.productId}: ${error.message}`);
  }
  ctx.report.calvados = 'rebuilt glass + paper Calvados BOMs (orchard apples)';
}

/** A whisky maturation profile so Highland Reserve carries cask + warehouse emissions. */
async function ensureMaturation(ctx: SeedCtx): Promise<void> {
  await ctx.svc.from('maturation_profiles').upsert(
    {
      product_id: PRODUCTS.highlandMalt,
      organization_id: ctx.orgId,
      barrel_type: 'american_oak_200',
      barrel_volume_litres: 200,
      barrel_use_number: 2,
      aging_duration_months: 144,
      angel_share_percent_per_year: 2.0,
      climate_zone: 'temperate',
      fill_volume_litres: 200,
      number_of_barrels: 1,
      warehouse_energy_kwh_per_barrel_year: 15.0,
      warehouse_energy_source: 'grid_electricity',
      allocation_method: 'cut_off',
      notes: 'Matured 12 years in refill ex-bourbon American oak (200L), cut-off allocation, traditional dunnage warehouse, ~2%/year angel share.',
    },
    { onConflict: 'product_id' },
  );
  ctx.report.maturation = 'Highland Reserve maturation profile set';
}

const ABV: Record<number, number> = {
  [PRODUCTS.bacchus]: 11.5,
  [PRODUCTS.highlandMalt]: 46,
  [PRODUCTS.sessionAle]: 4.2,
  [PRODUCTS.botanicaZero]: 0,
  [PRODUCTS.bathGin]: 42,
  [PRODUCTS.calvadosGlass]: 40,
  [PRODUCTS.calvadosPaper]: 40,
  [PRODUCTS.ipaCan]: 5.8,
  [PRODUCTS.ipaCase]: 5.8,
};

/** Finalise the keeper products: un-draft, set ABV + wizard settings + completeness. */
async function finaliseProducts(ctx: SeedCtx): Promise<void> {
  const { svc } = ctx;
  const wizard = { systemBoundary: 'cradle-to-gate', referenceYear: REFERENCE_YEAR };
  for (const [pid, abv] of Object.entries(ABV)) {
    const id = Number(pid);
    await svc
      .from('products')
      .update({
        is_draft: false,
        alcohol_content_abv: abv,
        recipe_scale_mode: 'per_unit',
        last_wizard_settings: wizard,
        upstream_ingredients_complete: true,
        upstream_packaging_complete: true,
        core_operations_complete: true,
        downstream_distribution_complete: true,
        use_end_of_life_complete: true,
      })
      .eq('id', id);
  }
  ctx.report.products = `${Object.keys(ABV).length} products finalised + recalc settings set`;
}

/** The IPA 24-can case becomes a real multipack of the single-can product. */
async function ensureMultipack(ctx: SeedCtx): Promise<void> {
  const { svc } = ctx;
  await svc.from('products').update({ is_multipack: true }).eq('id', PRODUCTS.ipaCase);
  await svc.from('products').update({ is_multipack: false }).eq('id', PRODUCTS.ipaCan);
  await svc.from('multipack_components').upsert(
    { multipack_product_id: PRODUCTS.ipaCase, component_product_id: PRODUCTS.ipaCan, quantity: 24 },
    { onConflict: 'multipack_product_id,component_product_id' },
  );
  await svc.from('multipack_secondary_packaging').delete().eq('multipack_product_id', PRODUCTS.ipaCase);
  await svc.from('multipack_secondary_packaging').insert([
    { multipack_product_id: PRODUCTS.ipaCase, material_name: 'Cardboard 24-can Case', material_type: 'cardboard', weight_grams: 320, is_recyclable: true, recycled_content_percentage: 85 },
    { multipack_product_id: PRODUCTS.ipaCase, material_name: 'LDPE Shrink Wrap', material_type: 'ldpe', weight_grams: 18, is_recyclable: false, recycled_content_percentage: 0 },
  ]);
  ctx.report.multipack = 'Floral Haze IPA 24-can case wired as multipack (24 × can)';
}

interface Allocation {
  facilityId: string;
  facilityName: string;
  operationalControl: 'owned' | 'third_party';
  productionVolume: number;
  facilityTotalProduction: number;
  dataCollectionMode?: 'primary' | 'archetype_proxy' | 'hybrid';
  archetypeSlug?: string;
  proxyJustification?: string;
}

/** Per-product facility allocations that drive the LCA recalc. */
const ALLOCATIONS: Record<number, Allocation[]> = {
  [PRODUCTS.bacchus]: [{ facilityId: FACILITIES.winery, facilityName: 'Cotswolds Estate Winery', operationalControl: 'owned', productionVolume: 28000, facilityTotalProduction: 60000 }],
  [PRODUCTS.highlandMalt]: [
    { facilityId: FACILITIES.distillery, facilityName: 'Highland Malt Distillery', operationalControl: 'owned', productionVolume: 42000, facilityTotalProduction: 180000 },
    { facilityId: FACILITIES.bottling, facilityName: 'Premier Bottling Services', operationalControl: 'third_party', productionVolume: 42000, facilityTotalProduction: 900000 },
  ],
  [PRODUCTS.sessionAle]: [{ facilityId: FACILITIES.brewery, facilityName: 'West Country Brewery', operationalControl: 'owned', productionVolume: 320000, facilityTotalProduction: 1200000 }],
  [PRODUCTS.botanicaZero]: [{ facilityId: FACILITIES.botanical, facilityName: 'Botanical Partners Ltd', operationalControl: 'third_party', productionVolume: 95000, facilityTotalProduction: 1500000, dataCollectionMode: 'archetype_proxy', archetypeSlug: 'co_pack_rtd', proxyJustification: 'Third-party co-packer cannot share metered energy data; modelled with an RTD co-pack archetype proxy per ISO 14044 §4.2.3.6.' }],
  [PRODUCTS.bathGin]: [{ facilityId: FACILITIES.distillery, facilityName: 'Highland Malt Distillery', operationalControl: 'owned', productionVolume: 36000, facilityTotalProduction: 180000 }],
  [PRODUCTS.calvadosGlass]: [{ facilityId: FACILITIES.distillery, facilityName: 'Highland Malt Distillery', operationalControl: 'owned', productionVolume: 12000, facilityTotalProduction: 180000 }],
  [PRODUCTS.calvadosPaper]: [{ facilityId: FACILITIES.distillery, facilityName: 'Highland Malt Distillery', operationalControl: 'owned', productionVolume: 6000, facilityTotalProduction: 180000 }],
  [PRODUCTS.ipaCan]: [{ facilityId: FACILITIES.brewery, facilityName: 'West Country Brewery', operationalControl: 'owned', productionVolume: 480000, facilityTotalProduction: 1200000 }],
};

/**
 * Seed one draft PCF per product carrying facility allocations in draft_data, so
 * the existing recalc tool finds valid allocations and produces a real LCA
 * instead of skipping. Also sets products.last_wizard_settings (in finalise).
 */
async function ensureRecalcReadiness(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  // Resolve archetype ids by slug for any proxy allocations.
  const { data: archetypes } = await svc.from('facility_archetypes').select('id, slug');
  const archetypeBySlug = new Map((archetypes ?? []).map((a: any) => [a.slug, a.id]));

  const ids = Object.keys(ALLOCATIONS).map(Number);
  const { data: products } = await svc
    .from('products')
    .select('id, name, unit_size_value, unit_size_unit')
    .in('id', ids);
  const byId = new Map((products ?? []).map((p: any) => [p.id, p]));

  // Clear our prior seed drafts, then insert fresh ones.
  await svc.from('product_carbon_footprints').delete().eq('organization_id', orgId).eq('status', 'draft').in('product_id', ids);

  const rows = ids.map((id) => {
    const p = byId.get(id);
    const allocs = ALLOCATIONS[id].map((a) => ({
      facilityId: a.facilityId,
      facilityName: a.facilityName,
      operationalControl: a.operationalControl,
      reportingPeriodStart: `${REFERENCE_YEAR}-01-01`,
      reportingPeriodEnd: `${REFERENCE_YEAR}-12-31`,
      productionVolume: a.productionVolume,
      productionVolumeUnit: 'bottles',
      facilityTotalProduction: a.facilityTotalProduction,
      facilityTotalProductionUnit: 'bottles',
      dataCollectionMode: a.dataCollectionMode ?? 'primary',
      archetypeId: a.archetypeSlug ? archetypeBySlug.get(a.archetypeSlug) ?? null : null,
      proxyJustification: a.proxyJustification ?? null,
    }));
    const size = p?.unit_size_value ? `${p.unit_size_value} ${p.unit_size_unit || ''}`.trim() : '1 unit';
    return {
      organization_id: orgId,
      product_id: id,
      product_name: p?.name ?? `Product ${id}`,
      functional_unit: `1 × ${size} of ${p?.name ?? 'product'}`,
      reference_year: REFERENCE_YEAR,
      status: 'draft',
      is_draft: true,
      system_boundary: 'cradle-to-gate',
      draft_data: { facilityAllocations: allocs, seedTag: 'drinks-co-demo' },
    };
  });

  const { error } = await svc.from('product_carbon_footprints').insert(rows);
  if (error) throw new Error(`recalc-ready PCFs: ${error.message}`);
  ctx.report.recalcReady = `${rows.length} products made recalc-ready (seed draft PCFs)`;
}

/** Run all entity-level seeding in dependency order. */
export async function seedEntities(ctx: SeedCtx): Promise<void> {
  await curate(ctx);
  await ensureFacilities(ctx);
  await ensureAgriculture(ctx);
  await rebuildCalvados(ctx);
  await ensureMaturation(ctx);
  await finaliseProducts(ctx);
  await ensureMultipack(ctx);
  await ensureRecalcReadiness(ctx);
}
