/**
 * Golden cases for the cutover "numbers don't change" harness.
 *
 * Each case is a complete, realistic input to `aggregateProductImpacts`,
 * modelled on the Everleaf-style 500 ml flint bottle that the packaging golden
 * test already locks. Together they cover every branch that differs between
 * `main` and `redesign`:
 *
 *   gate            — upstream only. Proves the shared base didn't move.
 *   grave           — the full downstream chain (use phase + distribution +
 *                     end of life). This is the case that exercises redesign's
 *                     extraction of those three stages into
 *                     `lib/lca/downstream-stages.ts`.
 *   shelf_chilled   — the awkward `!use_phase && distribution` branch, where a
 *                     shelf-boundary study must still carry RETAIL
 *                     refrigeration. Easy to drop in a refactor; invisible
 *                     unless something asserts it.
 *   grave_with_loss — loss multiplier > 1.0 alongside downstream stages.
 *                     redesign computes the downstream stages BEFORE the loss
 *                     block where main computed them after, so this case pins
 *                     the ordering: upstream is scaled by the multiplier,
 *                     downstream is NOT.
 *
 * See `../support/aggregator-harness.ts` for the portability contract. Keep
 * this file identical across branches.
 */
import type { UsePhaseConfig } from '@/lib/use-phase-factors';
import type { EoLConfig } from '@/lib/end-of-life-factors';
import type { DistributionConfig } from '@/lib/distribution-factors';
import type { ProductLossConfig } from '@/lib/system-boundaries';
import type { AggregatorFixtureData } from '../support/aggregator-harness';

export const PCF_ID = 'c0000000-0000-4000-8000-000000000001';
export const PRODUCT_ID = '4242';

/**
 * One 500 ml bottle: a botanical ingredient, the flint bottle itself, and a
 * six-bottle corrugated case. Impact values are pre-resolved, exactly as the
 * calculator persists them into `product_carbon_footprint_materials` — the
 * aggregator never re-resolves factors, it sums what is already on the row.
 */
const MATERIALS: Array<Record<string, any>> = [
  {
    id: 'm0000000-0000-4000-8000-000000000001',
    material_name: 'Botanical extract blend',
    material_type: 'ingredient',
    quantity: 0.12,
    unit: 'kg',
    impact_climate: 0.264,
    impact_climate_fossil: 0.201,
    impact_climate_biogenic: 0.063,
    impact_climate_dluc: 0,
    impact_transport: 0.018,
    impact_water: 0.0089,
    impact_water_scarcity: 0.0141,
    impact_land: 0.0312,
    impact_waste: 0.0021,
    confidence_score: 72,
    data_quality_grade: 'B',
    impact_source: 'agribalyse',
    gwp_data_source: 'IPCC AR6',
  },
  {
    id: 'm0000000-0000-4000-8000-000000000002',
    material_name: '500ml flint glass bottle',
    material_type: 'packaging',
    packaging_category: 'primary',
    quantity: 0.38,
    unit: 'kg',
    impact_climate: 0.133, // 0.35 kg CO2e/kg recycled endpoint x 0.38 kg
    impact_climate_fossil: 0.133,
    impact_climate_biogenic: 0,
    impact_climate_dluc: 0,
    impact_transport: 0.009,
    impact_water: 0.00114,
    impact_water_scarcity: 0,
    impact_land: 0.0038,
    impact_waste: 0.0076,
    recycled_content_percent: 100,
    end_of_life_pathway: null,
    packaging_endpoint_id: 'a1000000-0000-4000-8000-000000000001',
    confidence_score: 85,
    data_quality_grade: 'A',
    impact_source: 'ecoinvent',
    gwp_data_source: 'IPCC AR6',
  },
  {
    id: 'm0000000-0000-4000-8000-000000000003',
    material_name: 'Corrugated shipping case',
    material_type: 'packaging',
    packaging_category: 'shipment',
    quantity: 0.05, // 300 g case already divided by 6 bottles
    unit: 'kg',
    impact_climate: 0.03595,
    impact_climate_fossil: 0.03595,
    impact_climate_biogenic: 0,
    impact_climate_dluc: 0,
    impact_transport: 0,
    impact_water: 0.0002,
    impact_water_scarcity: 0,
    impact_land: 0.0009,
    impact_waste: 0.0011,
    units_per_group: 6,
    recycled_content_percent: 70,
    end_of_life_pathway: null,
    confidence_score: 68,
    data_quality_grade: 'B',
    impact_source: 'ecoinvent',
    gwp_data_source: 'IPCC AR6',
  },
];

const FIXTURE: AggregatorFixtureData = {
  materials: MATERIALS,
  pcf: {
    product_id: PRODUCT_ID,
    organization_id: '06c7c058-0000-4000-8000-000000000000',
    system_boundary: null, // the boundary arg wins; left null on purpose
    reference_year: 2025,
  },
  product: {
    unit_size_value: 500,
    unit_size_unit: 'ml',
    functional_unit: '1 bottle (500 ml)',
  },
};

/** One production facility, already allocated to this product by the calculator. */
export const FACILITY_EMISSIONS = [
  {
    facilityId: 'f0000000-0000-4000-8000-000000000001',
    facilityName: 'Somerset distillery',
    isContractManufacturer: false,
    allocatedEmissions: 0.0912,
    scope1Emissions: 0.0331,
    scope2Emissions: 0.0581,
    allocatedWater: 0.0044,
    allocatedWaste: 0.0012,
    attributionRatio: 0.0001,
    productVolume: 12000,
    countryCode: 'GB',
    gridEmissionFactor: 0.207,
    electricityKwh: 0.2807,
    dataSource: 'facility_allocation' as const,
  },
];

const USE_PHASE: UsePhaseConfig = {
  needsRefrigeration: true,
  refrigerationDays: 7,
  retailRefrigerationSplit: 0.5,
  isCarbonated: false,
  consumerCountryCode: 'GB',
};

const DISTRIBUTION: DistributionConfig = {
  productWeightKg: 0.93, // liquid + bottle + case share
  legs: [
    { id: 'leg-1', label: 'Distillery to national warehouse', transportMode: 'truck', distanceKm: 220 },
    { id: 'leg-2', label: 'Warehouse to retailer', transportMode: 'truck', distanceKm: 140 },
  ],
};

const EOL: EoLConfig = {
  region: 'eu',
  pathways: {},
  allocationMethod: 'cut-off',
  transportKm: 0,
};

const LOSS: ProductLossConfig = {
  distributionLossPercent: 2,
  retailLossPercent: 3,
  consumerWastePercent: 5,
};

export interface GoldenCase {
  name: string;
  boundary: 'cradle-to-gate' | 'cradle-to-shelf' | 'cradle-to-consumer' | 'cradle-to-grave';
  fixture: AggregatorFixtureData;
  usePhaseConfig?: UsePhaseConfig;
  eolConfig?: EoLConfig;
  distributionConfig?: DistributionConfig;
  productLossConfig?: ProductLossConfig;
}

export const GOLDEN_CASES: GoldenCase[] = [
  {
    name: 'gate',
    boundary: 'cradle-to-gate',
    fixture: FIXTURE,
  },
  {
    name: 'grave',
    boundary: 'cradle-to-grave',
    fixture: FIXTURE,
    usePhaseConfig: USE_PHASE,
    distributionConfig: DISTRIBUTION,
    eolConfig: EOL,
  },
  {
    name: 'shelf_chilled',
    boundary: 'cradle-to-shelf',
    fixture: FIXTURE,
    usePhaseConfig: USE_PHASE,
    distributionConfig: DISTRIBUTION,
  },
  {
    name: 'grave_with_loss',
    boundary: 'cradle-to-grave',
    fixture: FIXTURE,
    usePhaseConfig: USE_PHASE,
    distributionConfig: DISTRIBUTION,
    eolConfig: EOL,
    productLossConfig: LOSS,
  },
];
