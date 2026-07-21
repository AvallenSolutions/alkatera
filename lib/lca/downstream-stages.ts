/**
 * Downstream lifecycle stages, as a pure function.
 *
 * Everything up to the gate (ingredients, processing, packaging) is identical
 * for a SKU no matter where it is sold. Everything after the gate —
 * distribution, use phase, end of life, and the product-loss multiplier that
 * couples them back to upstream — varies by where the product actually goes.
 * This module is that dividing line, extracted so one core calculation can
 * serve many end-use scenarios (a bar and a supermarket are the same liquid in
 * the same bottle; only the journey and the bin differ).
 *
 * See `tasks/lca-end-use-scenarios-plan.md`. This is phase 1: the code below
 * was moved VERBATIM out of `aggregateProductImpacts` and the aggregator now
 * delegates to it, so single-scenario output is unchanged. Behaviour changes
 * belong in a separate commit from a move like this one.
 *
 * Deliberately pure: no Supabase client, no PCF row, no I/O beyond the factor
 * lookups the stage calculators already do. Everything it needs is passed in,
 * which is what makes it cheap enough to run once per scenario on every
 * recalculation.
 */

import { tryNormalizeToKg } from '../impact-waterfall-resolver';
import { calculateUsePhaseEmissions, type UsePhaseConfig } from '../use-phase-factors';
import {
  calculateMaterialEoL,
  getMaterialFactorKey,
  getPackagingUnitsPerGroup,
  getRegionalDefaults,
  isStalePathwayOverride,
  type EoLRegion,
  type EoLConfig,
} from '../end-of-life-factors';
import { calculateDistributionEmissions, type DistributionConfig } from '../distribution-factors';
import { isStageIncluded, calculateLossMultiplier, type ProductLossConfig } from '../system-boundaries';

/**
 * The subset of a PCF material row the downstream stages actually read.
 * Structural, not nominal, so the aggregator's richer `Material` satisfies it.
 */
export interface DownstreamMaterial {
  id: string;
  material_name: string;
  material_type: string;
  quantity: number;
  unit: string;
  [key: string]: unknown;
}

/** The bundle of assumptions that makes one end-use scenario differ from another. */
export interface DownstreamConfigs {
  distributionConfig?: DistributionConfig;
  usePhaseConfig?: UsePhaseConfig;
  eolConfig?: EoLConfig;
  productLossConfig?: ProductLossConfig;
}

export interface DownstreamStageInput extends DownstreamConfigs {
  /** Normalised system boundary (`normaliseBoundary` output). Bounds which stages run at all. */
  boundary: string;
  /** PCF material rows. Only packaging rows carry an end-of-life burden. */
  materials: DownstreamMaterial[];
  /** Unit volume in litres, for the use phase. Zero or negative skips it. */
  volumeLitres: number;
}

export interface EolMaterialRow {
  material: string;
  massKg: number;
  factorKey: string;
  region: string;
  recyclingPct: number;
  landfillPct: number;
  incinerationPct: number;
  compostingPct: number;
  adPct: number;
  grossEmissions: number;
  avoidedEmissions: number;
  netEmissions: number;
  allocationMethod: string;
}

/**
 * Stage totals plus the exact fossil/biogenic deltas the caller must fold into
 * its running totals. Returning deltas rather than mutating shared state is
 * what lets the same core be reused across scenarios.
 */
export interface DownstreamStageResults {
  /** Scalar applied to UPSTREAM totals: lost units still carry their full upstream burden. */
  lossMultiplier: number;
  distribution: {
    total: number;
    perLeg: Array<{ label: string; mode: string; distanceKm: number; emissions: number }>;
  };
  usePhase: {
    total: number;
    climateFossilDelta: number;
    climateBiogenicDelta: number;
    co2FossilDelta: number;
    co2BiogenicDelta: number;
  };
  endOfLife: {
    total: number;
    climateFossilDelta: number;
    climateBiogenicDelta: number;
    co2FossilDelta: number;
    co2BiogenicDelta: number;
    breakdown: EolMaterialRow[];
  };
  /** User-facing warnings, appended to the aggregator's own list. */
  warnings: string[];
}

/**
 * Compute distribution, use phase, end of life and the loss multiplier for one
 * end-use scenario over an already-computed core.
 *
 * Async only because distribution factor lookup is; there is no database round
 * trip here, so running this N times for N scenarios costs milliseconds.
 */
export async function computeDownstreamStages(
  input: DownstreamStageInput,
): Promise<DownstreamStageResults> {
  const {
    boundary,
    materials,
    volumeLitres,
    distributionConfig,
    usePhaseConfig,
    eolConfig,
    productLossConfig,
  } = input;

  const warnings: string[] = [];

  const results: DownstreamStageResults = {
    lossMultiplier: calculateLossMultiplier(boundary, productLossConfig),
    distribution: { total: 0, perLeg: [] },
    usePhase: {
      total: 0,
      climateFossilDelta: 0,
      climateBiogenicDelta: 0,
      co2FossilDelta: 0,
      co2BiogenicDelta: 0,
    },
    endOfLife: {
      total: 0,
      climateFossilDelta: 0,
      climateBiogenicDelta: 0,
      co2FossilDelta: 0,
      co2BiogenicDelta: 0,
      breakdown: [],
    },
    warnings,
  };

  // ── Use phase (cradle-to-consumer or cradle-to-grave) ────────────────────
  if (isStageIncluded(boundary, 'use_phase') && usePhaseConfig) {
    if (volumeLitres > 0) {
      const useResult = calculateUsePhaseEmissions(usePhaseConfig, volumeLitres);
      results.usePhase.total = useResult.total;
      results.usePhase.climateFossilDelta += useResult.refrigeration; // refrigeration is grid electricity
      results.usePhase.co2FossilDelta += useResult.refrigeration;
      // Carbonation origin depends on the CO2 source: fermentation CO2 (beer,
      // sparkling wine) is biogenic, but soft drinks and most RTDs are
      // carbonated with fossil-derived industrial CO2 (ammonia-plant
      // by-product). Booking everything biogenic misstated the ISO 14067
      // origin split for every carbonated soft drink.
      if (usePhaseConfig.carbonationType === 'soft_drink') {
        results.usePhase.climateFossilDelta += useResult.carbonation;
        results.usePhase.co2FossilDelta += useResult.carbonation;
      } else {
        results.usePhase.climateBiogenicDelta += useResult.carbonation;
        results.usePhase.co2BiogenicDelta += useResult.carbonation;
      }
    }
  }

  // ── Retail refrigeration at cradle-to-shelf ──────────────────────────────
  // The retail share of chilled storage happens BEFORE the consumer buys the
  // product, so a shelf-boundary study must include it even though the use
  // phase (a consumer-boundary concept) is excluded. Without this, chilled
  // RTDs sold at shelf boundary carried zero retail chiller energy.
  if (
    !isStageIncluded(boundary, 'use_phase') &&
    isStageIncluded(boundary, 'distribution') &&
    usePhaseConfig &&
    volumeLitres > 0
  ) {
    const useResult = calculateUsePhaseEmissions(usePhaseConfig, volumeLitres);
    const retailRefrigeration = useResult.breakdown?.retailRefrigeration ?? 0;
    if (retailRefrigeration > 0) {
      results.usePhase.total += retailRefrigeration;
      results.usePhase.climateFossilDelta += retailRefrigeration;
      results.usePhase.co2FossilDelta += retailRefrigeration;
    }
  }

  // ── Distribution (cradle-to-shelf, -consumer, -grave) ────────────────────
  if (isStageIncluded(boundary, 'distribution') && distributionConfig) {
    try {
      const distResult = await calculateDistributionEmissions(distributionConfig);
      results.distribution.total = distResult.total;
      results.distribution.perLeg = distResult.perLeg;
    } catch (err: any) {
      warnings.push(
        `Distribution calculation failed: ${err.message}. Distribution emissions will be zero.`,
      );
    }
  }

  // ── End of life (cradle-to-grave only) ───────────────────────────────────
  if (isStageIncluded(boundary, 'end_of_life')) {
    const eolRegion: EoLRegion = eolConfig?.region || 'eu';
    const doubleCreditMaterials: Array<{ name: string; recycledPct: number }> = [];
    // Cut-off is the default allocation (GHG Protocol / PAS 2050 recycled-
    // content convention): the recycling benefit is claimed once, on the input
    // side, by whoever uses recycled material. Avoided-burden remains an
    // explicit opt-in for legacy (non-parametric) rows only — parametric rows
    // already carry their recycled benefit in the endpoint interpolation, so
    // crediting them again at EoL would double-count and could net a bottle
    // carbon-negative.
    const requestedEolAllocation = eolConfig?.allocationMethod ?? 'cut-off';
    let warnedParametricAvoidedBurden = false;

    for (const material of materials) {
      const materialType = (material.material_type || '').toLowerCase();
      // Defensive unit normalisation. product_carbon_footprint_materials rows
      // are written by the calculator already in kg (unit: 'kg'), so this is
      // normally a no-op — but it guards against any non-kg packaging row
      // producing a 1000x EoL inflation.
      const normalised = tryNormalizeToKg(material.quantity || 0, material.unit || 'kg');
      if (!normalised.recognised) {
        warnings.push(
          `The packaging item "${material.material_name}" has an unrecognised unit "${material.unit}", ` +
          `so its end-of-life impact was estimated assuming the amount is in kilograms. ` +
          `Please edit the item and pick a unit from the list.`
        );
      }
      const rawQuantity = normalised.kg;
      if (rawQuantity <= 0) continue;

      // Circularity: reuse_trips amortises a reusable container's physical
      // material over many sales trips. The same 9 kg firkin serves 100 pints
      // before going for scrap, so the EoL burden attributable to one pint is
      // 1/100 of the scrap-event emissions. Must match the production-side
      // divisor applied in product-lca-calculator.ts, otherwise reusables get a
      // 100x EoL over-count.
      const rawReuseTrips = (material as any).reuse_trips;
      const reuseTrips = Number.isFinite(Number(rawReuseTrips)) && Number(rawReuseTrips) >= 1
        ? Number(rawReuseTrips)
        : 1;

      // Shared-packaging allocation (ISO 14044 §4.3.4.2). Secondary/shipment/
      // tertiary packaging (a 4-pack carton, a shipping case) serves multiple
      // product units, so its EoL burden must be divided by units_per_group —
      // the SAME divisor the production side applies in
      // product-lca-calculator.ts. Without this, the full multipack carton was
      // disposed against every single bottle, over-counting EoL by the pack
      // factor (x4, x6, ...).
      const unitsPerGroup = getPackagingUnitsPerGroup(material as any);

      const quantity = rawQuantity / reuseTrips / unitsPerGroup;

      // EoL applies only to PACKAGING materials. PRIMARY ingredients (barley,
      // water, hops, grapes) are consumed during processing — they have no
      // end-of-life in the product sense. Applying 'organic' waste factors to
      // 500kg of malt falsely adds large EoL emissions to the total. Synthetic
      // maturation rows are excluded too.
      const isPackaging = materialType === 'packaging' || materialType === 'packaging_material';
      const packagingCategory = (material as any).packaging_category || '';
      const isMaturationRow = (material.material_name || '').startsWith('[Maturation]');

      if (!isPackaging || isMaturationRow) {
        continue;
      }

      // Resolve the material composition (glass/paper/aluminium/…) for EoL
      // factors. Wizard-created rows carry the material identity directly in
      // container_material, which getMaterialFactorKey resolves exactly; manual
      // rows fall back to name/factor-name inference because packaging_category
      // holds a packaging *role*, not a material.
      const factorName = (material as any).matched_source_name || (material as any).gwp_data_source || '';
      const containerMaterial = (material as any).container_material || '';
      const factorKey = getMaterialFactorKey(
        containerMaterial || packagingCategory || 'other',
        material.material_name,
        factorName,
      );

      // Get user pathway overrides from the wizard. The wizard keys pathways by
      // the product_materials row id it loaded pre-calculation, which is carried
      // onto this PCF row as source_material_id — that key is the one that
      // actually matches. material.id (the freshly inserted PCF row id) is kept
      // for completeness and factorKey for legacy configs.
      let pathwayOverrides =
        ((material as any).source_material_id
          ? eolConfig?.pathways?.[(material as any).source_material_id]
          : undefined) ||
        eolConfig?.pathways?.[material.id] ||
        eolConfig?.pathways?.[factorKey];

      // Self-heal stale overrides: if the material was reclassified since the
      // override was seeded (e.g. a glass bottle once read as 'other'), the
      // stored split is a pristine default for the WRONG material. Discard it so
      // we fall through to the correct regional default for the current factor —
      // glass's 74/8/18 instead of 'other''s 28/22/50. Hand-edited splits, which
      // match no regional default, are kept.
      if (isStalePathwayOverride(pathwayOverrides, eolRegion, factorKey)) {
        pathwayOverrides = undefined;
      }

      const storedPathway = (material as any).end_of_life_pathway as string | null | undefined;
      if (!pathwayOverrides && storedPathway) {
        const pathwayMap: Record<string, { recycling: number; landfill: number; incineration: number; composting: number; anaerobic_digestion: number }> = {
          recycling: { recycling: 100, landfill: 0, incineration: 0, composting: 0, anaerobic_digestion: 0 },
          reuse: { recycling: 100, landfill: 0, incineration: 0, composting: 0, anaerobic_digestion: 0 },
          landfill: { recycling: 0, landfill: 100, incineration: 0, composting: 0, anaerobic_digestion: 0 },
          incineration: { recycling: 0, landfill: 0, incineration: 100, composting: 0, anaerobic_digestion: 0 },
          composting: { recycling: 0, landfill: 0, incineration: 0, composting: 100, anaerobic_digestion: 0 },
        };
        if (pathwayMap[storedPathway]) {
          pathwayOverrides = pathwayMap[storedPathway];
        }
      }

      // Recyclability cap: if this item is only partly recyclable (e.g. a
      // laminated pouch at 70%), clamp the recycling share and push the
      // remainder into the regional landfill/incineration split. Prevents
      // overstated recycling credits.
      const rawRecyclability = (material as any).recyclability_percent;
      // Treat null/undefined/'' as "not set" — Number(null) is 0, which would
      // otherwise cap the user's recycling pathway to 0% whenever the field was
      // simply never filled in on the material row.
      const recyclabilityPct =
        rawRecyclability === null || rawRecyclability === undefined || rawRecyclability === ''
          ? null
          : Number.isFinite(Number(rawRecyclability))
          ? Math.max(0, Math.min(100, Number(rawRecyclability)))
          : null;
      if (recyclabilityPct != null && pathwayOverrides && pathwayOverrides.recycling > recyclabilityPct) {
        const regional = getRegionalDefaults(eolRegion, factorKey);
        const excess = pathwayOverrides.recycling - recyclabilityPct;
        // Split excess between landfill and incineration according to the
        // regional ratio between the two; fall back to 70/30 if both zero.
        const lf = regional.landfill ?? 0;
        const inc = regional.incineration ?? 0;
        const lfShare = lf + inc > 0 ? lf / (lf + inc) : 0.7;
        pathwayOverrides = {
          ...pathwayOverrides,
          recycling: recyclabilityPct,
          landfill: (pathwayOverrides.landfill ?? 0) + excess * lfShare,
          incineration: (pathwayOverrides.incineration ?? 0) + excess * (1 - lfShare),
        };
      }

      // Parametric rows (pinned endpoint) are FORCED to cut-off; an
      // avoided-burden request is acknowledged with a warning, not honoured.
      const rowIsParametric = Boolean((material as any).packaging_endpoint_id);
      const rowAllocationMethod = rowIsParametric ? 'cut-off' : requestedEolAllocation;
      if (
        rowIsParametric &&
        eolConfig?.allocationMethod === 'avoided-burden' &&
        !warnedParametricAvoidedBurden
      ) {
        warnedParametricAvoidedBurden = true;
        warnings.push(
          'The avoided-burden end-of-life credit was not applied to packaging modelled with the parametric ' +
          'factor library: its recycling benefit is already counted in the recycled-content input, and crediting ' +
          'it again at end-of-life would count the same benefit twice.'
        );
      }

      const eolResult = calculateMaterialEoL(quantity, factorKey, eolRegion, pathwayOverrides, {
        allocationMethod: rowAllocationMethod,
        transportKm: eolConfig?.transportKm,
      });

      results.endOfLife.total += eolResult.net;

      // Biogenic/fossil split per ISO 14067 §6.4.9: paper and organic materials
      // produce biogenic CH4/CO2 when decomposing in landfill or composting/AD.
      // Fossil-origin materials (glass, aluminium, plastics, steel) produce
      // fossil CO2. Recycling credits always reduce fossil CO2 (avoiding virgin
      // production of fossil-origin materials).
      //
      // KNOWN SIMPLIFICATION: ISO 14067 strictly treats methane from anaerobic
      // decomposition of biogenic materials as fossil-equivalent for GWP because
      // the radiative forcing is not part of the short-cycle carbon exchange.
      // Our EOL_FACTORS table reports a single CO2e value per pathway and we
      // route the entire amount to the biogenic bucket below for biogenic
      // materials. Splitting CH4 vs CO2 within the EoL factor would require
      // separate factor entries — tracked as a follow-up.
      const isBiogenicMaterial = factorKey === 'paper' || factorKey === 'organic' || factorKey === 'cork';
      if (isBiogenicMaterial) {
        results.endOfLife.climateBiogenicDelta += eolResult.gross;
        results.endOfLife.co2BiogenicDelta += eolResult.gross;
        // Recycling credits for paper/cork still displace virgin fossil production
        results.endOfLife.climateFossilDelta += eolResult.avoided;
        results.endOfLife.co2FossilDelta += eolResult.avoided;
      } else {
        results.endOfLife.climateFossilDelta += eolResult.gross;
        results.endOfLife.co2FossilDelta += eolResult.gross;
        results.endOfLife.climateFossilDelta += eolResult.avoided;
        results.endOfLife.co2FossilDelta += eolResult.avoided;
      }

      const resolvedPathways = pathwayOverrides || getRegionalDefaults(eolRegion, factorKey);
      results.endOfLife.breakdown.push({
        material: material.material_name || 'Packaging',
        massKg: quantity,
        factorKey,
        region: eolRegion,
        recyclingPct: resolvedPathways.recycling ?? 0,
        landfillPct: resolvedPathways.landfill ?? 0,
        incinerationPct: resolvedPathways.incineration ?? 0,
        compostingPct: resolvedPathways.composting ?? 0,
        adPct: resolvedPathways.anaerobic_digestion ?? 0,
        grossEmissions: eolResult.gross,
        avoidedEmissions: eolResult.avoided,
        netEmissions: eolResult.net,
        allocationMethod: rowAllocationMethod,
      });

      // Potential double-count: recycled-content discount on production AND an
      // actual avoided-burden credit at EoL (avoided < 0 means a credit was
      // applied) for the same material.
      const materialRecycledPct = Number((material as any).recycled_content_percentage || 0);
      if (!rowIsParametric && materialRecycledPct > 0 && rowAllocationMethod === 'avoided-burden' && eolResult.avoided < 0) {
        doubleCreditMaterials.push({
          name: material.material_name || 'Packaging',
          recycledPct: materialRecycledPct,
        });
      }
    }

    if (doubleCreditMaterials.length > 0) {
      const list = doubleCreditMaterials
        .map(m => `"${m.name}" (${m.recycledPct}% recycled)`)
        .join(', ');
      warnings.push(
        `The packaging item${doubleCreditMaterials.length === 1 ? '' : 's'} ${list} already ` +
        `receive${doubleCreditMaterials.length === 1 ? 's' : ''} a discount for recycled content, and the end-of-life settings ` +
        `also give full credit for future recycling. This can count the same benefit twice and make the footprint ` +
        `look smaller than it really is. Consider switching the end-of-life recycling credit to "cut-off" in the End of Life step.`
      );
    }
  }

  return results;
}
