import { OWNER_USER_ID, PRODUCTS, REFERENCE_YEAR, replaceRows, type SeedCtx } from './shared';
import {
  deriveEprMaterialType,
  deriveMaterialSubtype,
  derivePackagingClass,
  derivePackagingType,
  mapActivityToRPD,
  mapMaterialToRPD,
  mapNationToRPD,
  mapRAMRatingToRPD,
} from '@/lib/epr/mappings';
import { calculateLineFee, getApplicableRate } from '@/lib/epr/fee-calculator';
import { extractComponentWeights, isDRSExcluded, processContainerComponents } from '@/lib/epr/drinks-container-rules';
import { calculateObligationTonnage, calculatePRNCost, determinePRNStatus } from '@/lib/epr/prn-calculator';
import { getPackagingUnitsPerGroup } from '@/lib/end-of-life-factors';
import { EPR_WIZARD_STEPS } from '@/lib/epr/wizard-types';
import { RAM_MODULATION, RPD_MATERIAL_NAMES } from '@/lib/epr/constants';
import type { EPRFeeRate, RPDMaterialCode, RPDPackagingType } from '@/lib/epr/types';
import type {
  EPRMaterialType,
  EPRPackagingActivity,
  EPRPackagingLevel,
  EPRRAMRating,
  EPRUKNation,
  PackagingCategory,
} from '@/lib/types/lca';

/**
 * Seed the UK packaging EPR module for the alkatera Drinks Co demo org.
 *
 * The seven /epr routes read five org-scoped tables plus two platform reference
 * tables. Every one of them was empty on the demo org, so the whole module
 * rendered as a wall of zero states even though the org already had
 * `epr_beta` on and drinks-container flags set on its Calvados packaging.
 *
 * The rule this file follows: seed what the app itself would have produced.
 * Rather than invent packaging, it reads the org's REAL `product_materials`
 * packaging rows and REAL `production_logs`, then runs them through the exact
 * same lib/epr helpers that `/api/epr/generate-submission` uses. That keeps the
 * seeded submission consistent with what Tim gets if he clicks "Generate" in
 * the UI — a seeded demo that disagreed with the live code path would be worse
 * than no demo at all.
 */

// =============================================================================
// Stable identifiers
// =============================================================================

/**
 * Deterministic submission UUIDs (b0a4… continues the seed's id family). Fixed
 * ids keep re-runs converging and let the audit trail reference real rows.
 */
const SUBMISSION_IDS = {
  h1_2025: 'b0a40001-0000-4000-8000-000000000001',
  h2_2025: 'b0a40001-0000-4000-8000-000000000002',
  h1_2026: 'b0a40001-0000-4000-8000-000000000003',
} as const;

/** The org's RPD portal registration (6-digit, as issued by the Defra portal). */
const RPD_ORGANISATION_ID = '104728';

// =============================================================================
// Platform reference data (Defra / PackUK published figures)
// =============================================================================

/**
 * Published PackUK base fees per tonne for 2025/26 (Year 1, flat rate).
 * Year 2 (2026/27) is eco-modulated, so green/amber/red are derived from the
 * same base using the RAM multipliers the app already ships in
 * `RAM_MODULATION` — that way the seeded fee figures and the app's own
 * calculator cannot drift apart.
 */
const BASE_FEE_PER_TONNE: Record<RPDMaterialCode, number> = {
  AL: 266,
  FC: 455,
  GL: 192,
  PC: 196,
  PL: 423,
  ST: 259,
  WD: 280,
  OT: 280,
};

/** Statutory business recycling targets (%) for the obligated PRN materials. */
const PRN_TARGET_PCT: Partial<Record<RPDMaterialCode, number>> = {
  AL: 61,
  GL: 78.5,
  PC: 79,
  PL: 61,
  ST: 82.5,
  WD: 46,
};

/** Indicative PRN market price per tonne, used for the demo's spend figures. */
const PRN_PRICE_PER_TONNE: Partial<Record<RPDMaterialCode, number>> = {
  AL: 84,
  GL: 46,
  PC: 22,
  PL: 165,
  ST: 38,
  WD: 24,
};

function buildFeeRates(feeYear: string): EPRFeeRate[] {
  const isModulated = feeYear === '2026-27';
  const mod = RAM_MODULATION['2026-27'];
  return (Object.keys(BASE_FEE_PER_TONNE) as RPDMaterialCode[]).map((code) => {
    const base = BASE_FEE_PER_TONNE[code];
    return {
      fee_year: feeYear,
      material_code: code,
      material_name: RPD_MATERIAL_NAMES[code],
      flat_rate_per_tonne: isModulated ? null : base,
      green_rate_per_tonne: isModulated ? round2(base * (mod.green ?? 1)) : null,
      amber_rate_per_tonne: isModulated ? round2(base * mod.amber) : null,
      red_rate_per_tonne: isModulated ? round2(base * mod.red) : null,
      is_modulated: isModulated,
    };
  });
}

// =============================================================================
// Submission periods
// =============================================================================

interface PeriodDef {
  id: string;
  period: string;
  feeYear: string;
  /** Calendar year, for the DRS cut-off test (DRS only bites from 2027). */
  calendarYear: number;
  from: string;
  to: string;
  status: 'draft' | 'ready' | 'submitted';
}

/**
 * Three periods so the submissions list has history AND something in flight:
 * a filed H1, an H2 with its CSV cut but not yet uploaded, and a fresh draft in
 * the modulated fee year (which also demonstrates the higher Year 2 rates).
 */
function buildPeriods(): PeriodDef[] {
  const y = REFERENCE_YEAR;
  return [
    { id: SUBMISSION_IDS.h1_2025, period: `${y}-H1`, feeYear: '2025-26', calendarYear: y, from: `${y}-01-01`, to: `${y}-06-30`, status: 'submitted' },
    { id: SUBMISSION_IDS.h2_2025, period: `${y}-H2`, feeYear: '2025-26', calendarYear: y, from: `${y}-07-01`, to: `${y}-12-31`, status: 'ready' },
    { id: SUBMISSION_IDS.h1_2026, period: `${y + 1}-H1`, feeYear: '2026-27', calendarYear: y + 1, from: `${y + 1}-01-01`, to: `${y + 1}-06-30`, status: 'draft' },
  ];
}

// =============================================================================
// Packaging + production inputs
// =============================================================================

interface PackagingRow {
  id: string;
  material_name: string | null;
  net_weight_g: number | null;
  packaging_category: string | null;
  material_type: string | null;
  container_material: string | null;
  matched_source_name: string | null;
  units_per_group: number | null;
  epr_material_type: string | null;
  epr_packaging_activity: string | null;
  epr_packaging_level: string | null;
  epr_is_drinks_container: boolean | null;
  epr_is_household: boolean | null;
  epr_ram_rating: string | null;
  epr_uk_nation: string | null;
  component_glass_weight: number | null;
  component_aluminium_weight: number | null;
  component_steel_weight: number | null;
  component_paper_weight: number | null;
  component_wood_weight: number | null;
  component_other_weight: number | null;
  product_id: number;
  product_name: string;
  unit_size_ml: number | null;
}

interface ProductionLog {
  product_id: number;
  date: string;
  units: number;
}

/** Load the org's packaging rows, flattened and joined to their product. */
async function loadPackaging(ctx: SeedCtx): Promise<PackagingRow[]> {
  const { data, error } = await ctx.svc
    .from('product_materials')
    .select(
      `id, material_name, net_weight_g, packaging_category, material_type, container_material,
       matched_source_name, units_per_group, epr_material_type, epr_packaging_activity,
       epr_packaging_level, epr_is_drinks_container, epr_is_household, epr_ram_rating, epr_uk_nation,
       component_glass_weight, component_aluminium_weight, component_steel_weight,
       component_paper_weight, component_wood_weight, component_other_weight,
       products!inner ( id, name, organization_id, unit_size_value, unit_size_unit )`,
    )
    .eq('products.organization_id', ctx.orgId)
    .not('packaging_category', 'is', null);

  if (error) throw new Error(`epr packaging read: ${error.message}`);

  return (data ?? []).map((row: any) => {
    const product = row.products;
    return {
      ...row,
      product_id: product.id,
      product_name: product.name,
      unit_size_ml: toMillilitres(product.unit_size_value, product.unit_size_unit),
    } as PackagingRow;
  });
}

/** Convert a product's declared unit size to ml (the DRS threshold's unit). */
function toMillilitres(value: number | null, unit: string | null): number | null {
  if (value == null || !unit) return null;
  const u = unit.toLowerCase();
  if (u === 'ml') return value;
  if (u === 'cl') return value * 10;
  if (u === 'l' || u === 'litre' || u === 'liter') return value * 1000;
  return null;
}

async function loadProductionLogs(ctx: SeedCtx): Promise<ProductionLog[]> {
  const { data, error } = await ctx.svc
    .from('production_logs')
    .select('product_id, date, units_produced')
    .eq('organization_id', ctx.orgId);
  if (error) throw new Error(`epr production_logs read: ${error.message}`);
  return (data ?? [])
    .filter((r: any) => Number(r.units_produced) > 0)
    .map((r: any) => ({ product_id: r.product_id, date: r.date, units: Number(r.units_produced) }));
}

/**
 * Units of a product made inside a reporting window.
 *
 * The demo's production history is a rolling 24 months, so a fixed calendar
 * window can fall outside it (for instance the 2026 H1 draft once the clock
 * moves on). Rather than emit an empty submission we fall back to the product's
 * mean monthly output scaled to the window length — still derived from the org's
 * real volumes, just annualised.
 */
function unitsInWindow(logs: ProductionLog[], productId: number, from: string, to: string, months: number): number {
  const forProduct = logs.filter((l) => l.product_id === productId);
  if (forProduct.length === 0) return 0;

  const inWindow = forProduct.filter((l) => l.date >= from && l.date <= to);
  if (inWindow.length > 0) return inWindow.reduce((sum, l) => sum + l.units, 0);

  const monthsLogged = new Set(forProduct.map((l) => l.date.slice(0, 7))).size || 1;
  const meanMonthly = forProduct.reduce((sum, l) => sum + l.units, 0) / monthsLogged;
  return Math.round(meanMonthly * months);
}

// =============================================================================
// Line derivation
// =============================================================================

interface DerivedLine {
  row: Record<string, unknown>;
  materialCode: RPDMaterialCode;
  weightKg: number;
  feeGbp: number;
}

/**
 * Turn one packaging row into its RPD submission lines for a period.
 *
 * This deliberately mirrors /api/epr/generate-submission step for step —
 * activity/nation fall back to the org defaults, glass drinks containers split
 * into per-component lines while aluminium/PET aggregate, and shared packaging
 * (a 6-pack case) is divided by units_per_group so the case is counted once per
 * pack rather than once per bottle.
 */
function deriveLines(
  material: PackagingRow,
  units: number,
  period: PeriodDef,
  settings: { activity: EPRPackagingActivity; nation: EPRUKNation; drsApplies: boolean },
  feeRates: EPRFeeRate[],
  isModulated: boolean,
): DerivedLine[] {
  if (!material.net_weight_g || material.net_weight_g <= 0 || units <= 0) return [];

  const activity = (material.epr_packaging_activity || settings.activity) as EPRPackagingActivity;
  const nation = (material.epr_uk_nation || settings.nation) as EPRUKNation;
  const ramRating = (material.epr_ram_rating || null) as EPRRAMRating | null;
  const packagingCategory = (material.packaging_category || 'container') as PackagingCategory;
  const packagingLevel = (material.epr_packaging_level || null) as EPRPackagingLevel | null;
  const isDrinksContainer = material.epr_is_drinks_container ?? false;
  const isHousehold = material.epr_is_household ?? true;

  // epr_material_type is only written by bulk-import and the modern packaging
  // builder, so older rows sit at NULL and would otherwise be billed at the
  // 'other' rate. Fall back to the same inference the app uses.
  const materialType = (material.epr_material_type as EPRMaterialType | null)
    ?? deriveEprMaterialType({
      container_material: material.container_material,
      packaging_category: material.packaging_category,
      material_name: material.material_name,
      matched_source_name: material.matched_source_name,
    });

  // DRS only excludes containers from Oct 2027, so nothing in 2025/26 is
  // excluded. Note the calendar year is passed as a NUMBER here (see the
  // findings note in the seeder's report).
  const drsExcluded = settings.drsApplies
    && isDRSExcluded(isDrinksContainer, material.unit_size_ml, materialType, period.calendarYear);

  const components = processContainerComponents(
    isDrinksContainer,
    materialType,
    extractComponentWeights(material),
    material.net_weight_g,
  );

  const unitsPerGroup = getPackagingUnitsPerGroup(material as any);
  const rpdPackagingType: RPDPackagingType = derivePackagingType(packagingCategory, isHousehold, isDrinksContainer);
  const rpdFromNation = mapNationToRPD(nation);

  const lines: DerivedLine[] = [];
  for (const component of components) {
    const materialCode = component.rpd_material_code;
    // Kept to 3dp rather than whole kilos: the weight column is numeric and
    // carries a `> 0` CHECK, so rounding a light component (a 3 g label at low
    // volume) to a whole number would either lose it or fail the insert.
    const weightKg = round3((component.weight_grams / 1000 / unitsPerGroup) * units);
    if (weightKg <= 0) continue;

    const feeRate = feeRates.find((r) => r.material_code === materialCode);
    const feeGbp = feeRate ? calculateLineFee(weightKg, feeRate, ramRating, drsExcluded) : 0;
    const ratePerTonne = feeRate ? getApplicableRate(feeRate, ramRating, drsExcluded) : 0;

    lines.push({
      materialCode,
      weightKg,
      feeGbp,
      row: {
        submission_id: period.id,
        organization_id: '', // filled in by the caller (it owns ctx.orgId)
        product_id: material.product_id,
        product_name: material.product_name,
        // product_material_id is a bigint column but product_materials.id is a
        // uuid, so it is left NULL — see the seeder's reported findings.
        product_material_id: null,
        rpd_organisation_id: RPD_ORGANISATION_ID,
        rpd_subsidiary_id: null,
        rpd_organisation_size: 'L',
        rpd_submission_period: period.period,
        rpd_packaging_activity: mapActivityToRPD(activity),
        rpd_packaging_type: rpdPackagingType,
        rpd_packaging_class: derivePackagingClass(packagingLevel, packagingCategory),
        rpd_packaging_material: materialCode,
        rpd_material_subtype: deriveMaterialSubtype(component.material_type),
        rpd_from_nation: rpdFromNation,
        rpd_to_nation: rpdFromNation,
        rpd_material_weight_kg: weightKg,
        rpd_material_units: rpdPackagingType === 'HDC' || rpdPackagingType === 'NDC' ? units : null,
        rpd_transitional_weight: null,
        rpd_recyclability_rating: mapRAMRatingToRPD(ramRating, isModulated),
        fee_rate_per_tonne: ratePerTonne,
        estimated_fee_gbp: feeGbp,
        is_drs_excluded: drsExcluded,
      },
    });
  }
  return lines;
}

// =============================================================================
// Sections
// =============================================================================

/**
 * Platform reference data. These two tables are global (no organization_id) and
 * in a real deployment are loaded by a platform admin, so we only fill the gaps
 * — an existing row is never overwritten. Without them the costs page prices
 * every tonne at zero and the PRN page cannot bootstrap an obligation.
 */
async function seedReferenceData(ctx: SeedCtx): Promise<void> {
  const { svc } = ctx;

  const feeRows = ['2025-26', '2026-27'].flatMap(buildFeeRates);
  const { data: existingRates } = await svc.from('epr_fee_rates').select('fee_year, material_code');
  const haveRate = new Set((existingRates ?? []).map((r: any) => `${r.fee_year}|${r.material_code}`));
  const missingRates = feeRows.filter((r) => !haveRate.has(`${r.fee_year}|${r.material_code}`));
  if (missingRates.length > 0) {
    const { error } = await svc.from('epr_fee_rates').insert(missingRates);
    if (error) ctx.warnings.push(`epr_fee_rates: ${error.message}`);
  }

  const targetRows = [REFERENCE_YEAR, REFERENCE_YEAR + 1].flatMap((year) =>
    (Object.keys(PRN_TARGET_PCT) as RPDMaterialCode[]).map((code) => ({
      obligation_year: year,
      material_code: code,
      material_name: RPD_MATERIAL_NAMES[code],
      recycling_target_pct: PRN_TARGET_PCT[code]!,
    })),
  );
  const { data: existingTargets } = await svc.from('epr_prn_targets').select('obligation_year, material_code');
  const haveTarget = new Set((existingTargets ?? []).map((r: any) => `${r.obligation_year}|${r.material_code}`));
  const missingTargets = targetRows.filter((r) => !haveTarget.has(`${r.obligation_year}|${r.material_code}`));
  if (missingTargets.length > 0) {
    const { error } = await svc.from('epr_prn_targets').insert(missingTargets);
    if (error) ctx.warnings.push(`epr_prn_targets: ${error.message}`);
  }

  ctx.report.eprReference =
    `fee rates +${missingRates.length}/${feeRows.length}, PRN targets +${missingTargets.length}/${targetRows.length} (existing platform rows left untouched)`;
}

/**
 * Org settings, including a completed wizard. The org is a large producer
 * (turnover over £2m and well over 50 tonnes), which is what makes it report
 * twice a year and drives the 'L' organisation size on every RPD line.
 */
async function seedSettings(ctx: SeedCtx, annualTonnage: number): Promise<void> {
  const { svc, orgId } = ctx;

  const wizardState = {
    completed: true,
    dismissed: false,
    currentStep: 'export-complete',
    completedSteps: EPR_WIZARD_STEPS.map((s) => s.id),
    startedAt: `${REFERENCE_YEAR}-07-14T09:12:00.000Z`,
    completedAt: `${REFERENCE_YEAR}-07-14T09:41:00.000Z`,
  };

  const { error } = await svc.from('epr_organization_settings').upsert(
    {
      organization_id: orgId,
      rpd_organization_id: RPD_ORGANISATION_ID,
      rpd_subsidiary_id: null,
      annual_turnover_gbp: 14_800_000,
      estimated_annual_packaging_tonnage: annualTonnage,
      obligation_size: 'large',
      default_packaging_activity: 'brand',
      default_uk_nation: 'england',
      // ONS population-weighted split, as produced by the nation estimator.
      nation_sales_england_pct: 84.3,
      nation_sales_scotland_pct: 8.2,
      nation_sales_wales_pct: 4.7,
      nation_sales_ni_pct: 2.8,
      nation_sales_method: 'auto_estimated',
      nation_sales_last_estimated_at: `${REFERENCE_YEAR}-07-14T09:26:00.000Z`,
      drs_applies: true,
      wizard_state: wizardState,
    },
    { onConflict: 'organization_id' },
  );
  if (error) throw new Error(`epr_organization_settings: ${error.message}`);

  ctx.report.eprSettings = `large producer, RPD ${RPD_ORGANISATION_ID}, ${annualTonnage.toFixed(1)} t/yr, wizard complete`;
}

/**
 * The HMRC registration templates. Four addresses and four contacts is the full
 * set the CSV generator expects, so the export step downloads a complete file
 * rather than one riddled with blanks.
 */
async function seedHmrc(ctx: SeedCtx, productNames: string[]): Promise<void> {
  const { svc, orgId } = ctx;

  const { error: detailsErr } = await svc.from('epr_hmrc_org_details').upsert(
    {
      organization_id: orgId,
      companies_house_number: '09472183',
      home_nation_code: 'EN',
      main_activity_sic: '11.01',
      organisation_type_code: 'LTD',
      registration_type_code: 'Individual',
      // Brand owner first; the Portuguese cork and the contract-bottled lines
      // mean packaging is also imported, hence IM as a secondary activity.
      activity_so: 'Primary',
      activity_pf: 'Secondary',
      activity_im: 'Secondary',
      activity_se: 'No',
      activity_hl: 'No',
      activity_om: 'No',
      activity_sl: 'Secondary',
      produce_blank_packaging_flag: false,
      liable_for_disposal_costs_flag: true,
      meet_reporting_requirements_flag: true,
      joiner_date: `${REFERENCE_YEAR}-01-01`,
    },
    { onConflict: 'organization_id' },
  );
  if (detailsErr) throw new Error(`epr_hmrc_org_details: ${detailsErr.message}`);

  const address = {
    line_1: 'Unit 4, Locksbrook Trade Park',
    line_2: 'Locksbrook Road',
    city: 'Bath',
    county: 'Somerset',
    postcode: 'BA1 3EN',
    country: 'United Kingdom',
  };
  const { error: addrErr } = await svc.from('epr_hmrc_addresses').upsert(
    [
      { organization_id: orgId, address_type: 'registered', ...address, phone: '+44 1225 447 200' },
      { organization_id: orgId, address_type: 'principal', ...address, phone: '+44 1225 447 200' },
      { organization_id: orgId, address_type: 'service_of_notice', ...address },
      {
        organization_id: orgId,
        address_type: 'audit',
        line_1: 'Somerset House Accountants',
        line_2: '14 Queen Square',
        city: 'Bristol',
        county: 'Bristol',
        postcode: 'BS1 4NT',
        country: 'United Kingdom',
      },
    ],
    { onConflict: 'organization_id,address_type' },
  );
  if (addrErr) throw new Error(`epr_hmrc_addresses: ${addrErr.message}`);

  const { error: contactErr } = await svc.from('epr_hmrc_contacts').upsert(
    [
      { organization_id: orgId, contact_type: 'approved_person', first_name: 'Marianne', last_name: 'Okafor', job_title: 'Managing Director', email: 'marianne.okafor@alkateradrinks.example', phone: '+44 1225 447 201' },
      { organization_id: orgId, contact_type: 'delegated_person', first_name: 'Rhys', last_name: 'Pemberton', job_title: 'Head of Sustainability', email: 'rhys.pemberton@alkateradrinks.example', phone: '+44 1225 447 204' },
      { organization_id: orgId, contact_type: 'primary_contact', first_name: 'Rhys', last_name: 'Pemberton', job_title: 'Head of Sustainability', email: 'rhys.pemberton@alkateradrinks.example', phone: '+44 1225 447 204' },
      { organization_id: orgId, contact_type: 'secondary_contact', first_name: 'Delia', last_name: 'Ashworth', job_title: 'Operations Manager', email: 'delia.ashworth@alkateradrinks.example', phone: '+44 1225 447 209' },
    ],
    { onConflict: 'organization_id,contact_type' },
  );
  if (contactErr) throw new Error(`epr_hmrc_contacts: ${contactErr.message}`);

  // HMRC wants every name that appears on the packaging, which the wizard
  // pre-fills from the product catalogue — so use the org's real product names.
  const brands = ['alkatera Drinks Co', ...productNames].slice(0, 12);
  const { error: brandErr } = await svc.from('epr_hmrc_brands').upsert(
    brands.map((name) => ({ organization_id: orgId, brand_name: name, brand_type_code: 'BN' })),
    { onConflict: 'organization_id,brand_name' },
  );
  if (brandErr) throw new Error(`epr_hmrc_brands: ${brandErr.message}`);

  // epr_hmrc_partners is deliberately left empty: partner rows are only valid
  // for organisation_type_code 'PAR', and this org is a private limited company.
  // Seeding them would contradict the org details and defeat the wizard's
  // partners-only auto-skip.
  ctx.report.eprHmrc = `org details + 4 addresses + 4 contacts + ${brands.length} brands (partners N/A for an Ltd)`;
}

/**
 * PRN obligations for the reference year, priced off the tonnage actually
 * placed on the market. Purchase levels are staggered so the page shows a
 * fulfilled, a partial and a not-started material rather than one flat state.
 */
async function seedPrnObligations(
  ctx: SeedCtx,
  tonnageByMaterial: Record<string, number>,
): Promise<{ code: RPDMaterialCode; id: string; status: string }[]> {
  const { svc, orgId } = ctx;

  /**
   * Share of the obligation already bought, per material. Producers buy the
   * cheap, plentiful PRNs early and leave the dearer ones until the compliance
   * deadline, so glass is settled, paper part-bought and aluminium untouched —
   * which also guarantees the page shows all three fulfilment states.
   */
  const purchasedShare: Partial<Record<RPDMaterialCode, number>> = {
    GL: 1,
    WD: 1,
    PC: 0.62,
    ST: 0.5,
    AL: 0,
    PL: 0,
  };

  const rows = (Object.keys(PRN_TARGET_PCT) as RPDMaterialCode[])
    .map((code) => {
      const tonnage = round3(tonnageByMaterial[code] ?? 0);
      const targetPct = PRN_TARGET_PCT[code]!;
      const obligation = calculateObligationTonnage(tonnage, targetPct);
      const purchased = round3(obligation * (purchasedShare[code] ?? 0));
      const pricePerTonne = PRN_PRICE_PER_TONNE[code] ?? 0;
      return {
        organization_id: orgId,
        obligation_year: REFERENCE_YEAR,
        material_code: code,
        material_name: RPD_MATERIAL_NAMES[code],
        total_tonnage_placed: tonnage,
        recycling_target_pct: targetPct,
        obligation_tonnage: obligation,
        prns_purchased_tonnage: purchased,
        prn_cost_per_tonne_gbp: purchased > 0 ? pricePerTonne : 0,
        total_prn_cost_gbp: calculatePRNCost(purchased, purchased > 0 ? pricePerTonne : 0),
        status: determinePRNStatus(obligation, purchased),
      };
    })
    // Materials the org does not place on the market would show as a zero row.
    .filter((r) => r.total_tonnage_placed > 0);

  // Replace rather than upsert, scoped to the reference year: if the org's
  // packaging mix changes between runs the old material's obligation must go,
  // not linger as a phantom row the PRN page still totals up.
  const { error: clearErr } = await svc
    .from('epr_prn_obligations')
    .delete()
    .eq('organization_id', orgId)
    .eq('obligation_year', REFERENCE_YEAR);
  if (clearErr) throw new Error(`epr_prn_obligations (clear): ${clearErr.message}`);

  if (rows.length === 0) return [];

  const { data, error } = await svc
    .from('epr_prn_obligations')
    .insert(rows)
    .select('id, material_code, status');
  if (error) throw new Error(`epr_prn_obligations: ${error.message}`);

  return (data ?? []).map((r: any) => ({ code: r.material_code as RPDMaterialCode, id: r.id, status: r.status }));
}

/**
 * A believable compliance trail. The audit page filters on entity_type and
 * action, so the trail covers every entity type and most actions rather than
 * repeating one shape.
 */
async function seedAuditLog(
  ctx: SeedCtx,
  periods: PeriodDef[],
  obligations: { code: RPDMaterialCode; id: string; status: string }[],
): Promise<number> {
  const { orgId } = ctx;
  const y = REFERENCE_YEAR;

  const entry = (
    at: string,
    entityType: string,
    entityId: string,
    action: string,
    extra: Record<string, unknown> = {},
  ) => ({
    organization_id: orgId,
    entity_type: entityType,
    entity_id: entityId,
    action,
    performed_by: OWNER_USER_ID,
    performed_at: at,
    ip_address: '203.0.113.24',
    user_agent: 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/126.0 Safari/537.36',
    ...extra,
  });

  const [h1, h2, draft] = periods;

  const rows: Record<string, unknown>[] = [
    entry(`${y}-07-14T09:14:00Z`, 'settings', orgId, 'create', {
      notes: 'EPR settings created during the setup wizard.',
      snapshot: { obligation_size: 'large', rpd_organization_id: RPD_ORGANISATION_ID },
    }),
    entry(`${y}-07-14T09:26:00Z`, 'settings', orgId, 'estimate_nations', {
      notes: 'Nation-of-sale split estimated from delivery postcodes.',
      field_changes: {
        nation_sales_method: { old: 'manual', new: 'auto_estimated' },
        nation_sales_england_pct: { old: 100, new: 84.3 },
        nation_sales_scotland_pct: { old: 0, new: 8.2 },
      },
    }),
    entry(`${y}-07-14T09:38:00Z`, 'settings', orgId, 'update', {
      notes: 'Turnover and packaging tonnage confirmed; obligation size set to large.',
      field_changes: { obligation_size: { old: 'pending', new: 'large' } },
    }),

    // --- H1: generated, checked, exported, filed ---
    entry(`${y}-08-02T10:05:00Z`, 'submission', h1.id, 'create', {
      notes: `${h1.period} submission generated from packaging and production data.`,
      snapshot: { submission_period: h1.period, fee_year: h1.feeYear },
    }),
    entry(`${y}-08-02T10:22:00Z`, 'submission_line', h1.id, 'update', {
      notes: 'Cork stopper reclassified from Other to Paper/Card after supplier confirmation.',
      field_changes: { rpd_packaging_material: { old: 'OT', new: 'PC' } },
    }),
    entry(`${y}-08-09T14:41:00Z`, 'submission', h1.id, 'approve', {
      notes: 'Reviewed and approved by the approved person (M. Okafor).',
    }),
    entry(`${y}-08-09T14:47:00Z`, 'submission', h1.id, 'generate_csv', {
      notes: 'RPD packaging data CSV generated.',
    }),
    entry(`${y}-08-11T08:55:00Z`, 'submission', h1.id, 'submit', {
      notes: 'Uploaded to the Defra Report Packaging Data portal.',
      snapshot: { submission_period: h1.period, status: 'submitted' },
    }),
    entry(`${y}-09-30T16:12:00Z`, 'submission', h1.id, 'amend', {
      notes: 'Minor tonnage correction for the 6-pack cases resubmitted before the 1 Oct deadline.',
    }),

    // --- H2: generated and cut to CSV, not yet uploaded ---
    entry(`${y + 1}-01-19T11:30:00Z`, 'submission', h2.id, 'create', {
      notes: `${h2.period} submission generated.`,
      snapshot: { submission_period: h2.period, fee_year: h2.feeYear },
    }),
    entry(`${y + 1}-01-19T11:58:00Z`, 'submission', h2.id, 'generate_csv', {
      notes: 'CSV cut and checked; awaiting sign-off before upload.',
    }),

    // --- The in-flight draft in the modulated fee year ---
    entry(`${y + 1}-07-06T09:02:00Z`, 'submission', draft.id, 'create', {
      notes: `${draft.period} draft opened — first submission on modulated (RAM) fee rates.`,
      snapshot: { submission_period: draft.period, fee_year: draft.feeYear },
    }),
  ];

  // PRN entries point at the real obligation rows, so the audit page's
  // entity_id matches what the PRN page shows.
  const purchased = obligations.filter((o) => o.status !== 'not_started');
  purchased.slice(0, 3).forEach((o, i) => {
    rows.push(
      entry(`${y}-${10 + i}-${14 + i}T13:20:00Z`, 'prn_obligation', o.id, 'update', {
        notes: o.status === 'fulfilled'
          ? `${o.code} PRNs purchased in full for the year.`
          : `Part-purchase of ${o.code} PRNs; remainder scheduled before the compliance deadline.`,
        field_changes: { status: { old: 'not_started', new: o.status } },
      }),
    );
  });

  return replaceRows(ctx, 'epr_audit_log', { organization_id: orgId }, rows);
}

// =============================================================================
// Entry point
// =============================================================================

export async function seedEpr(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  await seedReferenceData(ctx);

  const packaging = await loadPackaging(ctx);
  const logs = await loadProductionLogs(ctx);

  if (packaging.length === 0) {
    ctx.warnings.push('EPR: no packaging rows found for the org — settings and HMRC data seeded, but no submissions.');
  }
  if (logs.length === 0 && packaging.length > 0) {
    ctx.warnings.push('EPR: no production logs found — submission tonnages cannot be derived, so no submissions were seeded.');
  }

  // The multipack's own transit packaging still lives in the deprecated
  // multipack_secondary_packaging table for this org, and neither this seeder
  // nor /api/epr/generate-submission reads it, so the 24-can case is absent
  // from the RPD lines. Flagged rather than silently patched here.
  const hasCasePackaging = packaging.some((p) => p.product_id === PRODUCTS.ipaCase);
  if (!hasCasePackaging) {
    ctx.warnings.push(
      `EPR: product ${PRODUCTS.ipaCase} (24-can case) has no product_materials packaging rows, so its case + shrink wrap are missing from the RPD lines. Its packaging is still in the deprecated multipack_secondary_packaging table.`,
    );
  }

  const nonHousehold = packaging.filter((p) => p.epr_is_household === false).length;
  if (nonHousehold > 0) {
    ctx.warnings.push(
      `EPR: ${nonHousehold} packaging rows have epr_is_household = false, so they report as non-household (NDC/NH). Set them household if these are consumer sales.`,
    );
  }

  const periods = buildPeriods();
  const settingsDefaults = { activity: 'brand' as EPRPackagingActivity, nation: 'england' as EPRUKNation, drsApplies: true };

  const submissionRows: Record<string, unknown>[] = [];
  const lineRows: Record<string, unknown>[] = [];
  /** Reference-year tonnage per RPD material, for the PRN obligations. */
  const tonnageByMaterial: Record<string, number> = {};
  let annualTonnage = 0;

  for (const period of periods) {
    const isModulated = period.feeYear === '2026-27';
    const feeRates = buildFeeRates(period.feeYear);

    const periodLines: DerivedLine[] = [];
    for (const material of packaging) {
      const units = unitsInWindow(logs, material.product_id, period.from, period.to, 6);
      periodLines.push(...deriveLines(material, units, period, settingsDefaults, feeRates, isModulated));
    }
    if (periodLines.length === 0) continue;

    const totalWeightKg = round3(periodLines.reduce((sum, l) => sum + l.weightKg, 0));
    const totalFeeGbp = round2(periodLines.reduce((sum, l) => sum + l.feeGbp, 0));

    const materialSummary: Record<string, { weight_kg: number; fee_gbp: number; count: number }> = {};
    for (const line of periodLines) {
      const s = (materialSummary[line.materialCode] ||= { weight_kg: 0, fee_gbp: 0, count: 0 });
      s.weight_kg = round3(s.weight_kg + line.weightKg);
      s.fee_gbp = round2(s.fee_gbp + line.feeGbp);
      s.count += 1;
    }

    // Both 2025 halves together make the reference year's tonnage.
    if (period.calendarYear === REFERENCE_YEAR) {
      annualTonnage += totalWeightKg / 1000;
      for (const line of periodLines) {
        tonnageByMaterial[line.materialCode] = (tonnageByMaterial[line.materialCode] ?? 0) + line.weightKg / 1000;
      }
    }

    const filed = period.status === 'submitted';
    const csvCut = filed || period.status === 'ready';
    submissionRows.push({
      id: period.id,
      organization_id: orgId,
      submission_period: period.period,
      fee_year: period.feeYear,
      organization_size: 'L',
      status: period.status,
      total_packaging_weight_kg: totalWeightKg,
      total_estimated_fee_gbp: totalFeeGbp,
      total_line_items: periodLines.length,
      material_summary: materialSummary,
      csv_generated_at: csvCut ? `${period.to}T10:12:00Z` : null,
      csv_storage_path: csvCut ? `epr-submissions/${orgId}/${period.period}-rpd.csv` : null,
      csv_checksum: csvCut ? checksumFor(period.period) : null,
      submitted_to_rpd_at: filed ? `${REFERENCE_YEAR}-08-11T08:55:00Z` : null,
      submitted_by: filed ? OWNER_USER_ID : null,
      notes: filed
        ? `Filed via the Defra RPD portal; confirmation reference RPD-${period.period}-${RPD_ORGANISATION_ID}.`
        : period.status === 'ready'
          ? 'CSV generated and checked — awaiting sign-off before upload.'
          : 'Draft for the first modulated (RAM-rated) fee year.',
    });

    for (const line of periodLines) {
      lineRows.push({ ...line.row, organization_id: orgId });
    }
  }

  await seedSettings(ctx, round3(annualTonnage));

  const productNames = Array.from(new Set(packaging.map((p) => p.product_name).filter(Boolean)));
  await seedHmrc(ctx, productNames);

  // Submissions own their lines via ON DELETE CASCADE, so clearing the org's
  // submissions clears the lines with them — that is what keeps re-runs from
  // stacking duplicate RPD rows.
  await replaceRows(ctx, 'epr_submissions', { organization_id: orgId }, submissionRows);
  if (lineRows.length > 0) {
    const { error } = await svc.from('epr_submission_lines').insert(lineRows);
    if (error) throw new Error(`epr_submission_lines: ${error.message}`);
  }

  const obligations = await seedPrnObligations(ctx, tonnageByMaterial);
  const auditCount = await seedAuditLog(ctx, periods, obligations);

  ctx.report.eprSubmissions = submissionRows.length > 0
    ? `${submissionRows.length} submissions (${periods.map((p) => `${p.period}=${p.status}`).join(', ')}) with ${lineRows.length} RPD lines`
    : 'no submissions (no packaging or production volume to derive them from)';
  ctx.report.eprPrn = obligations.length > 0
    ? `${obligations.length} PRN obligations for ${REFERENCE_YEAR} (${obligations.map((o) => `${o.code}=${o.status}`).join(', ')})`
    : `no PRN obligations (no reference-year tonnage)`;
  ctx.report.eprAudit = `${auditCount} audit-trail entries`;
}

// =============================================================================
// Helpers
// =============================================================================

function round2(value: number): number {
  return Math.round(value * 100) / 100;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/** Stable pseudo-checksum so a re-run does not churn the value. */
function checksumFor(period: string): string {
  let hash = 0;
  for (let i = 0; i < period.length; i++) hash = (hash * 31 + period.charCodeAt(i)) >>> 0;
  return `sha256:${hash.toString(16).padStart(8, '0')}${'0'.repeat(48)}`;
}
