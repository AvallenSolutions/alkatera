import { PRODUCTS, REFERENCE_YEAR, type SeedCtx } from './shared';

/**
 * Seed COMPLETED product carbon footprints directly (the browser-only calculator
 * couldn't be driven remotely). For each product we compute plausible,
 * internally-consistent per-material climate impacts, roll them into the same
 * `aggregated_impacts` shape the real aggregator emits (the UI's source of
 * truth — `total_ghg_emissions` is 0 even on real completed PCFs), insert the
 * PCF + per-material rows, and flag the product as having an active LCA.
 */

// kg CO2e per kg of material, by keyword (rough but realistic cradle-to-gate).
function climateFactor(name: string, type: string, pkgCat: string | null): number {
  const n = name.toLowerCase();
  if (type === 'packaging') {
    if (/alumin|can\b|foil|capsule|ring pull/.test(n)) return 9.0;
    if (/glass|bottle/.test(n) && !/paper/.test(n)) return 1.1;
    if (/paper bottle|moulded|frugal|pulp/.test(n)) return 1.3;
    if (/cork/.test(n)) return 0.5;
    if (/cardboard|case|box|carton|firkin|keg|cask/.test(n)) return /firkin|keg|cask/.test(n) ? 2.0 : 0.24;
    if (/shrink|ldpe|plastic|pet|wrap/.test(n)) return 2.5;
    if (/label/.test(n)) return 1.1;
    if (/wood|bar top|stopper/.test(n)) return 0.6;
    return 1.0;
  }
  // ingredients
  if (/water/.test(n)) return 0.0003;
  if (/malt|barley|wheat/.test(n)) return 0.7;
  if (/hop|amarillo|citra|goldings|fuggle/.test(n)) return 2.6;
  if (/yeast/.test(n)) return 1.8;
  if (/grape/.test(n)) return 0.7; // overridden if self-grown
  if (/apple/.test(n)) return 0.45; // overridden if self-grown
  if (/juniper|coriander|angelica|orris|peel|liquorice|botanical|root/.test(n)) return 3.0;
  if (/neutral grain spirit|spirit/.test(n)) return 1.6;
  if (/glycerine|sweetener|sugar/.test(n)) return 1.1;
  if (/acid|metabisulphite|bentonite|gypsum|sulphate|fining/.test(n)) return 1.0;
  return 1.0;
}

// fallback per-unit mass (kg) for packaging quantified in 'unit'.
function packagingMassKg(name: string): number {
  const n = name.toLowerCase();
  if (/gift box/.test(n)) return 0.15;
  if (/case|box|carton/.test(n)) return 0.42;
  if (/glass|bottle/.test(n) && !/paper/.test(n)) return 0.5;
  if (/paper bottle|moulded/.test(n)) return 0.08;
  if (/\bcan\b|aluminium can/.test(n)) return 0.015;
  if (/cork|stopper/.test(n)) return 0.006;
  if (/cap|capsule|foil/.test(n)) return 0.004;
  if (/label|sleeve/.test(n)) return 0.003;
  if (/wood|bar top/.test(n)) return 0.02;
  if (/firkin|keg|cask/.test(n)) return 0.5;
  if (/shrink|wrap/.test(n)) return 0.01;
  return 0.05;
}

// per-unit processing (energy) emissions by product, split scope1 (gas) / scope2 (elec).
const PROCESSING: Record<number, number> = {
  [PRODUCTS.bacchus]: 0.18,
  [PRODUCTS.highlandMalt]: 0.55,
  [PRODUCTS.sessionAle]: 0.09,
  [PRODUCTS.botanicaZero]: 0.12,
  [PRODUCTS.bathGin]: 0.42,
  [PRODUCTS.calvadosGlass]: 0.46,
  [PRODUCTS.calvadosPaper]: 0.46,
  [PRODUCTS.ipaCan]: 0.09,
};

interface MatRow {
  material_name: string;
  material_type: string;
  quantity: number | null;
  unit: string | null;
  packaging_category: string | null;
  net_weight_g: number | null;
  total_weight_kg: number | null;
  is_self_grown: boolean | null;
  recycled_content_percentage: number | null;
  origin_country_code: string | null;
}

interface Computed {
  name: string;
  type: string;
  quantity: number;
  unit: string;
  massKg: number;
  climate: number;
  fossil: number;
  biogenic: number;
  removals: number;
  land: number;
  water: number;
  transport: number;
  stage: string;
  selfGrown: boolean;
}

function massOf(m: MatRow): number {
  const q = Number(m.quantity ?? 0);
  switch (m.unit) {
    case 'kg': return q;
    case 'l': return q; // ~1 kg/l
    case 'ml': return q / 1000; // ~1 kg/l
    case 'g': return q / 1000;
    case 'mg': return q / 1e6;
    case 't': return q * 1000;
  }
  // 'unit' (or unknown): use recorded weight or a keyword default × quantity
  const each = m.total_weight_kg ?? (m.net_weight_g != null ? m.net_weight_g / 1000 : packagingMassKg(m.material_name));
  return Number(each) * (q || 1);
}

function computeMaterial(m: MatRow): Computed {
  const mass = massOf(m);
  const selfGrown = !!m.is_self_grown;
  let climate: number, removals = 0, biogenicShare: number, stage: string;

  if (selfGrown && /grape/i.test(m.material_name)) {
    climate = mass * 0.25; removals = -mass * 0.06; biogenicShare = 0.35; stage = 'viticulture';
  } else if (selfGrown && /apple/i.test(m.material_name)) {
    climate = mass * 0.18; removals = -mass * 0.05; biogenicShare = 0.4; stage = 'orchard';
  } else if (m.material_type === 'packaging') {
    climate = mass * climateFactor(m.material_name, m.material_type, m.packaging_category); biogenicShare = /paper|cardboard|cork|label|wood|case|box/i.test(m.material_name) ? 0.25 : 0.05; stage = 'packaging';
  } else {
    climate = mass * climateFactor(m.material_name, m.material_type, m.packaging_category); biogenicShare = /water|acid/i.test(m.material_name) ? 0.05 : 0.18; stage = 'raw_materials';
  }
  const transport = mass * 0.02; // small inbound transport, embedded
  climate += transport;
  const fossil = +(climate * (1 - biogenicShare)).toFixed(6);
  const biogenic = +(climate * biogenicShare).toFixed(6);
  return {
    name: m.material_name, type: m.material_type, quantity: Number(m.quantity ?? 0), unit: m.unit ?? 'kg', massKg: mass,
    climate: +climate.toFixed(6), fossil, biogenic, removals: +removals.toFixed(6),
    land: +(mass * (stage === 'viticulture' || stage === 'orchard' ? 0.08 : stage === 'raw_materials' ? 0.04 : 0.005)).toFixed(6),
    water: +(mass * 0.02).toFixed(6), transport: +transport.toFixed(6), stage, selfGrown,
  };
}

function round(n: number, dp = 4): number { return +n.toFixed(dp); }

/**
 * Remove every PCF (and its children) for a product. The child material/site
 * FKs are NOT cascading, so a bare PCF delete aborts atomically when materials
 * exist — we must clear children first, or re-runs accumulate duplicates.
 */
async function clearProductPcfs(ctx: SeedCtx, productId: number): Promise<void> {
  const { svc, orgId } = ctx;
  const { data: existing } = await svc.from('product_carbon_footprints').select('id').eq('organization_id', orgId).eq('product_id', productId);
  const ids = (existing ?? []).map((r: any) => r.id);
  if (ids.length === 0) return;
  // products.latest_lca_id FKs a PCF — null it before deleting, or the delete is blocked.
  await svc.from('products').update({ latest_lca_id: null, has_active_lca: false }).eq('id', productId);
  await svc.from('product_carbon_footprint_materials').delete().in('product_carbon_footprint_id', ids);
  await svc.from('product_carbon_footprint_production_sites').delete().in('product_carbon_footprint_id', ids);
  const { error } = await svc.from('product_carbon_footprints').delete().in('id', ids);
  if (error) ctx.warnings.push(`clear PCFs ${productId}: ${error.message}`);
}

async function seedOneLca(ctx: SeedCtx, productId: number): Promise<number> {
  const { svc, orgId } = ctx;
  const { data: prod } = await svc.from('products').select('id, name, unit_size_value, unit_size_unit').eq('id', productId).maybeSingle();
  if (!prod) return 0;
  const { data: matsRaw } = await svc
    .from('product_materials')
    .select('material_name, material_type, quantity, unit, packaging_category, net_weight_g, total_weight_kg, is_self_grown, recycled_content_percentage, origin_country_code')
    .eq('product_id', productId);
  const mats = (matsRaw ?? []) as MatRow[];
  if (mats.length === 0) return 0;

  const computed = mats.map(computeMaterial);
  const proc = PROCESSING[productId] ?? 0.1;
  const procScope1 = +(proc * 0.4).toFixed(6); // gas
  const procScope2 = +(proc * 0.6).toFixed(6); // electricity

  const matClimate = computed.reduce((a, c) => a + c.climate, 0);
  const totalRemovals = computed.reduce((a, c) => a + c.removals, 0);
  const total = +(matClimate + proc + totalRemovals).toFixed(4);

  // stage rollup
  const stageTotals: Record<string, number> = { raw_materials: 0, viticulture: 0, orchard: 0, packaging: 0, processing: proc, distribution: 0, use_phase: 0, end_of_life: 0, inbound_containers: 0 };
  for (const c of computed) stageTotals[c.stage] = (stageTotals[c.stage] ?? 0) + c.climate + c.removals;
  for (const k of Object.keys(stageTotals)) stageTotals[k] = round(stageTotals[k], 4);

  const fossil = +(computed.reduce((a, c) => a + c.fossil, 0) + proc * 0.9).toFixed(4);
  const biogenic = +(computed.reduce((a, c) => a + c.biogenic, 0) + proc * 0.1).toFixed(4);
  const land = round(computed.reduce((a, c) => a + c.land, 0));
  const water = round(computed.reduce((a, c) => a + c.water, 0) + 0.05);
  const transport = round(computed.reduce((a, c) => a + c.transport, 0));

  const byMaterial = computed
    .map((c) => ({ name: c.name, unit: c.unit, source: 'secondary_modelled', climate: round(c.climate, 6), quantity: c.quantity }))
    .sort((a, b) => b.climate - a.climate);
  const top = byMaterial.slice(0, 4);
  const hotspots = top.map((m) => ({ name: m.name, category: 'material', impact_kg_co2e: m.climate, contribution_pct: round((m.climate / total) * 100, 1) }));
  const dominantStage = Object.entries(stageTotals).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1])[0] ?? ['raw_materials', 0];

  const scope3 = round(total - proc, 4);
  const aggregated_impacts = {
    total_climate: total,
    climate_change_gwp100: total,
    total_carbon_footprint: total,
    total_climate_fossil: fossil,
    total_climate_biogenic: biogenic,
    total_climate_dluc: 0,
    total_land: land,
    total_water: water,
    total_water_scarcity: water,
    water_scarcity_aware: water,
    water_consumption: water,
    total_waste: round(water * 0.08),
    total_transport: transport,
    land_use: land,
    materials_count: computed.length,
    circularity_percentage: round(computed.filter((c) => c.type === 'packaging').reduce((a, c) => a + (c.massKg), 0) > 0 ? 55 : 0, 0),
    calculation_version: '2.3.0',
    calculated_at: `${REFERENCE_YEAR}-12-31T12:00:00.000Z`,
    report_metadata: { version: '2.0', generated_at: `${REFERENCE_YEAR}-12-31T12:00:00.000Z`, calculation_engine: 'alkatera-demo-seed' },
    breakdown: {
      by_ghg: { co2_fossil: fossil, co2_biogenic: biogenic, ch4: 0, ch4_fossil: 0, ch4_biogenic: 0, n2o: round(total * 0.04, 4), hfc_pfc: 0 },
      by_scope: { scope1: procScope1, scope2: procScope2, scope3 },
      by_material: byMaterial,
      by_lifecycle_stage: stageTotals,
      by_resource: { land_occupation: land, fossil_fuel_usage: round(fossil * 0.25), water_consumption: water },
      flag_removals: { soil_carbon_co2e: round(totalRemovals, 4), viticulture_notes: null, orchard_notes: null, methodology: 'IPCC AR6 / SBTi FLAG' },
      flag_threshold: { flag_emissions_co2e: round(stageTotals.viticulture + stageTotals.orchard + stageTotals.raw_materials, 4), non_flag_emissions_co2e: round(total - (stageTotals.viticulture + stageTotals.orchard), 4), flag_emissions_pct: 0, flag_threshold_exceeded: false },
    },
    ghg_breakdown: {
      gwp_factors: { method: 'IPCC AR6', n2o_gwp100: 273, methane_gwp100: 27.9 },
      carbon_origin: { fossil, biogenic, land_use_change: 0 },
    },
    data_quality: { score: 72, rating: 'Good', overall_confidence: 'MEDIUM' },
    facility_detail: [],
    interpretation: {
      conclusions: {
        key_findings: [
          `The total carbon footprint is ${total.toFixed(3)} kg CO₂e per functional unit.`,
          `${hotspots[0]?.name ?? 'Packaging'} is the largest single contributor at ${hotspots[0]?.contribution_pct ?? 0}% of the total.`,
          `The ${dominantStage[0].replace('_', ' ')} stage dominates the footprint.`,
        ],
        recommendations: [
          `Prioritise supplier engagement for ${hotspots[0]?.name ?? 'the largest contributor'} to obtain primary verified data.`,
          'Increase the proportion of primary verified data to reduce uncertainty.',
        ],
        limitations: ['Demo dataset: impacts are realistic estimates using secondary emission factors, not a verified primary-data study.'],
      },
      significant_issues: {
        hotspots,
        summary: `The most significant contributors are ${top.map((t) => t.name).slice(0, 3).join(', ')}.`,
        dominant_lifecycle_stage: dominantStage[0],
        dominant_stage_pct: round((dominantStage[1] / total) * 100, 1),
        dominant_scope: 'Scope 3 (Value Chain)',
        dominant_scope_pct: round((scope3 / total) * 100, 0),
      },
    },
  };

  // Replace any existing PCFs for this product with one completed PCF.
  await clearProductPcfs(ctx, productId);
  const size = prod.unit_size_value ? `${prod.unit_size_value} ${prod.unit_size_unit || ''}`.trim() : '1 unit';
  const { data: pcf, error: pcfErr } = await svc
    .from('product_carbon_footprints')
    .insert({
      organization_id: orgId, product_id: productId, product_name: prod.name,
      functional_unit: `1 × ${size} of ${prod.name}`, reference_year: REFERENCE_YEAR,
      status: 'completed', is_draft: false, system_boundary: 'cradle-to-gate', lca_scope_type: 'cradle-to-gate',
      lca_methodology: 'recipe_2016', lca_version: '1.0',
      total_ghg_emissions: total, total_ghg_emissions_fossil: fossil, total_ghg_emissions_biogenic: biogenic, total_ghg_emissions_dluc: 0,
      total_ghg_raw_materials: round(stageTotals.raw_materials + stageTotals.viticulture + stageTotals.orchard, 4),
      total_ghg_packaging: stageTotals.packaging, total_ghg_processing: proc, total_ghg_transport: transport,
      total_ghg_use: 0, total_ghg_end_of_life: 0,
      aggregated_impacts, ingredients_complete: true, packaging_complete: true, production_complete: true,
      per_unit_emissions_verified: true,
    })
    .select('id')
    .single();
  if (pcfErr) throw new Error(`completed PCF ${productId}: ${pcfErr.message}`);
  const pcfId = (pcf as any).id;

  // per-material rows
  const matRows = computed.map((c) => ({
    product_carbon_footprint_id: pcfId, material_name: c.name, name: c.name, material_type: c.type, quantity: c.quantity, unit: c.unit, unit_name: c.unit,
    impact_climate: c.climate, impact_climate_fossil: c.fossil, impact_climate_biogenic: c.biogenic, impact_climate_dluc: 0,
    impact_removals_co2e: c.removals, impact_land: c.land, impact_water: c.water, impact_water_scarcity: c.water, impact_transport: c.transport,
    // data_source left null (the integrity CHECK requires a real factor id for
    // 'openlca'/'supplier'; we have none). data_quality_tag still drives the badge.
    data_priority: c.selfGrown ? 1 : 3, data_quality_tag: c.selfGrown ? 'Primary' : 'Secondary_Modelled',
  }));
  const { error: matErr } = await svc.from('product_carbon_footprint_materials').insert(matRows);
  if (matErr) throw new Error(`PCF materials ${productId}: ${matErr.message}`);

  await svc.from('products').update({ has_active_lca: true, latest_lca_id: pcfId, system_boundary: 'cradle_to_gate' }).eq('id', productId);
  return total;
}

/** Seed completed LCAs for all single products + derive the multipack total. */
export async function seedCompletedLcas(ctx: SeedCtx): Promise<void> {
  const singles = [PRODUCTS.bacchus, PRODUCTS.highlandMalt, PRODUCTS.sessionAle, PRODUCTS.botanicaZero, PRODUCTS.bathGin, PRODUCTS.calvadosGlass, PRODUCTS.calvadosPaper, PRODUCTS.ipaCan];
  const totals: Record<number, number> = {};
  for (const id of singles) totals[id] = await seedOneLca(ctx, id);

  // Multipack (235) = 24 × the single can (236) + secondary packaging share.
  const canTotal = totals[PRODUCTS.ipaCan] ?? 0;
  if (canTotal > 0) {
    const { svc, orgId } = ctx;
    const caseTotal = round(canTotal * 24 + 0.35, 4); // + cardboard/shrink case
    const agg = {
      total_climate: caseTotal, climate_change_gwp100: caseTotal, total_carbon_footprint: caseTotal,
      total_climate_fossil: round(caseTotal * 0.9), total_climate_biogenic: round(caseTotal * 0.1), total_climate_dluc: 0,
      materials_count: 1, calculation_version: '2.3.0',
      breakdown: { by_scope: { scope1: 0, scope2: 0, scope3: caseTotal }, by_lifecycle_stage: { raw_materials: round(canTotal * 24 * 0.5), packaging: round(canTotal * 24 * 0.4 + 0.35), processing: round(canTotal * 24 * 0.1) } },
      interpretation: { conclusions: { key_findings: [`The 24-can case footprint is ${caseTotal.toFixed(2)} kg CO₂e (24 × single can + secondary packaging).`], recommendations: [], limitations: ['Demo dataset: derived from the single-can footprint.'] }, significant_issues: { hotspots: [] } },
      report_metadata: { version: '2.0', calculation_engine: 'alkatera-demo-seed' },
    };
    await clearProductPcfs(ctx, PRODUCTS.ipaCase);
    const { data: pcf, error } = await svc.from('product_carbon_footprints').insert({
      organization_id: orgId, product_id: PRODUCTS.ipaCase, product_name: 'Floral Haze IPA - 24 × 330ml Can',
      functional_unit: '1 × 24-can case', reference_year: REFERENCE_YEAR, status: 'completed', is_draft: false,
      system_boundary: 'cradle-to-gate', lca_scope_type: 'cradle-to-gate', lca_methodology: 'recipe_2016', lca_version: '1.0',
      total_ghg_emissions: caseTotal, total_ghg_emissions_fossil: round(caseTotal * 0.9), total_ghg_emissions_biogenic: round(caseTotal * 0.1),
      total_ghg_packaging: round(canTotal * 24 * 0.4 + 0.35), aggregated_impacts: agg,
      ingredients_complete: true, packaging_complete: true, production_complete: true, per_unit_emissions_verified: true,
    }).select('id').single();
    if (error) throw new Error(`multipack PCF: ${error.message}`);
    await svc.from('products').update({ has_active_lca: true, latest_lca_id: (pcf as any).id, system_boundary: 'cradle_to_gate' }).eq('id', PRODUCTS.ipaCase);
  }

  const summary = Object.entries(totals).map(([id, t]) => `${id}:${t.toFixed(2)}`).join(' ');
  ctx.report.completedLcas = `9 completed LCAs seeded (kg CO2e/unit → ${summary})`;
}
