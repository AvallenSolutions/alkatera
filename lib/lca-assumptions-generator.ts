/**
 * LCA Assumptions & Limitations Generator
 *
 * Generates context-aware ISO 14044/14067 compliant assumptions and limitations
 * based on the product configuration and calculation methodology used by the platform.
 *
 * These are auto-populated for the user in the Cut-off Criteria step of the
 * LCA wizard, ensuring all methodology choices are transparently documented
 * as required by ISO 14044 §4.2.3.3 and ISO 14067 §6.3.3.
 *
 * The user can edit, remove, or add additional assumptions after auto-fill.
 */

import { getBoundaryLabel, boundaryNeedsUsePhase, boundaryNeedsEndOfLife } from './system-boundaries';
import { GWP_REPORT_VERSION } from './ghg-constants';
import type { UsePhaseConfig } from './use-phase-factors';
import type { EoLConfig, EoLRegion } from './end-of-life-factors';
import { REGION_LABELS } from './end-of-life-factors';

// ============================================================================
// TYPES
// ============================================================================

export interface AssumptionContext {
  /** Product type (e.g. 'Spirits', 'Beer & Cider', 'Wine') */
  productType?: string;
  /** System boundary (e.g. 'cradle-to-gate', 'cradle-to-grave') */
  systemBoundary: string;
  /** Number of materials in the product */
  materialCount: number;
  /** Whether any facilities are linked */
  hasFacilities: boolean;
  /** Number of linked facilities */
  facilityCount: number;
  /** Use phase configuration (if boundary includes use phase) */
  usePhaseConfig?: UsePhaseConfig;
  /** End of life configuration (if boundary includes EoL) */
  eolConfig?: EoLConfig;
  /** Reference year for the study */
  referenceYear: number;
  /** Whether the product has packaging materials */
  hasPackaging: boolean;
  /** Whether the product has ingredient materials */
  hasIngredients: boolean;
}

// ============================================================================
// ASSUMPTION CATEGORIES
// ============================================================================

type AssumptionCategory =
  | 'methodology'
  | 'data_sources'
  | 'facility'
  | 'transport'
  | 'use_phase'
  | 'end_of_life'
  | 'limitations';

interface TaggedAssumption {
  category: AssumptionCategory;
  text: string;
}

// ============================================================================
// GENERATOR
// ============================================================================

/**
 * Generate a list of assumptions and limitations based on the product's
 * configuration and the calculation methodology.
 *
 * Returns strings ready to be used in the wizard's assumptions list.
 * Grouped logically: methodology → data sources → facilities → transport
 * → use phase → end of life → limitations.
 */
export function generateAssumptions(ctx: AssumptionContext): string[] {
  const assumptions: TaggedAssumption[] = [];

  // ──────────────────────────────────────────────────────────────────────────
  // 1. METHODOLOGY
  // ──────────────────────────────────────────────────────────────────────────

  assumptions.push({
    category: 'methodology',
    text: `System boundary: ${getBoundaryLabel(ctx.systemBoundary)}. ${getBoundaryScope(ctx.systemBoundary)}`,
  });

  assumptions.push({
    category: 'methodology',
    text: `Global warming potential (GWP-100) values from IPCC ${GWP_REPORT_VERSION}: CO₂ = 1, CH₄ = 27.9, N₂O = 273 kg CO₂e/kg.`,
  });

  assumptions.push({
    category: 'methodology',
    text: `Functional unit: 1 unit of finished product as sold. All impacts are expressed per functional unit.`,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 2. DATA SOURCES & QUALITY
  // ──────────────────────────────────────────────────────────────────────────

  assumptions.push({
    category: 'data_sources',
    text: `Emission factors sourced from a tiered hierarchy: (1) supplier-specific verified data, (2) DEFRA 2025 conversion factors, (3) ecoinvent 3.12 / AGRIBALYSE 3.2 generic data. Supplier data is prioritised where available.`,
  });

  assumptions.push({
    category: 'data_sources',
    text: `Data quality scored using an impact-weighted average of material confidence scores. Materials without quality scores default to 40% ("Poor") per ISO 14044 §4.2.3.6.`,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 3. FACILITY ALLOCATION
  // ──────────────────────────────────────────────────────────────────────────

  if (ctx.hasFacilities) {
    assumptions.push({
      category: 'facility',
      text: `Facility overhead emissions (Scope 1 & 2) allocated to the product using mass-based allocation (production volume ratio). ${ctx.facilityCount} production ${ctx.facilityCount === 1 ? 'facility' : 'facilities'} included.`,
    });

    assumptions.push({
      category: 'facility',
      text: `Electricity grid emission factors are country-specific (IEA 2023 / DEFRA 2025). Where the facility country is unknown, the global average (0.490 kg CO₂e/kWh) is used as a conservative fallback.`,
    });
  } else {
    assumptions.push({
      category: 'facility',
      text: `No production facilities linked. Scope 1 and Scope 2 facility overhead emissions are excluded from this assessment.`,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 4. TRANSPORT
  // ──────────────────────────────────────────────────────────────────────────

  if (ctx.systemBoundary !== 'cradle-to-gate') {
    assumptions.push({
      category: 'transport',
      text: `Distribution transport emission factors sourced from DEFRA 2025: road freight ~0.104 kg CO₂e/tonne-km (HGV, average laden), rail ~0.028, container ship ~0.016, air freight ~1.130. Factors assume average load utilisation.`,
    });
  }

  // Always include material transport assumption
  assumptions.push({
    category: 'transport',
    text: `Raw material transport impacts are embedded in the upstream emission factors from the database (cradle-to-gate factors include extraction, processing, and delivery to factory gate).`,
  });

  // ──────────────────────────────────────────────────────────────────────────
  // 5. USE PHASE (conditional)
  // ──────────────────────────────────────────────────────────────────────────

  if (boundaryNeedsUsePhase(ctx.systemBoundary) && ctx.usePhaseConfig) {
    const upc = ctx.usePhaseConfig;

    if (upc.needsRefrigeration) {
      const gridSource = upc.consumerCountryCode
        ? `consumer market grid factor (${upc.consumerCountryCode})`
        : 'global average grid factor (0.490 kg CO₂e/kWh, IEA 2023)';
      assumptions.push({
        category: 'use_phase',
        text: `Consumer refrigeration assumed for ${upc.refrigerationDays} days at ${Math.round((upc.retailRefrigerationSplit ?? 0.5) * 100)}% retail / ${Math.round((1 - (upc.retailRefrigerationSplit ?? 0.5)) * 100)}% domestic split. Electricity emissions based on ${gridSource}.`,
      });

      assumptions.push({
        category: 'use_phase',
        text: `Refrigeration energy: domestic fridge 0.00356 kWh/L/day (A-rated, Energy Saving Trust 2023), retail chiller 0.00636 kWh/L/day (Carbon Trust 2012). Uncertainty: ±30%.`,
      });
    } else {
      assumptions.push({
        category: 'use_phase',
        text: `No consumer refrigeration assumed — product is stored at ambient temperature.`,
      });
    }

    if (upc.isCarbonated && upc.carbonationType) {
      assumptions.push({
        category: 'use_phase',
        text: `Dissolved CO₂ released at consumption is classified as biogenic (fermentation-derived) and reported separately from fossil CO₂e. Does not contribute to net atmospheric CO₂ increase.`,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 6. END OF LIFE (conditional)
  // ──────────────────────────────────────────────────────────────────────────

  if (boundaryNeedsEndOfLife(ctx.systemBoundary) && ctx.eolConfig) {
    const regionLabel = REGION_LABELS[ctx.eolConfig.region as EoLRegion] || ctx.eolConfig.region;
    assumptions.push({
      category: 'end_of_life',
      text: `End-of-life modelled using the avoided burden (system expansion) method per ISO 14044 Annex D. Recycling credits offset gross disposal emissions.`,
    });

    assumptions.push({
      category: 'end_of_life',
      text: `Regional disposal pathway defaults based on ${regionLabel} published statistics (Eurostat 2023, DEFRA 2024, EPA 2019). User-adjusted percentages override defaults where specified.`,
    });

    if (ctx.hasPackaging) {
      assumptions.push({
        category: 'end_of_life',
        text: `Packaging materials are modelled individually with material-specific recycling rates and EoL emission factors. Consumer sorting behaviour is assumed to match regional averages.`,
      });
    }

    if (ctx.hasIngredients) {
      assumptions.push({
        category: 'end_of_life',
        text: `Ingredient waste (organic fraction) is aggregated into a single organic waste stream with region-specific composting, anaerobic digestion, and landfill split.`,
      });
    }
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 7. PRODUCT-TYPE SPECIFIC
  // ──────────────────────────────────────────────────────────────────────────

  const ptLower = (ctx.productType || '').toLowerCase();
  if (ptLower.includes('spirit') || ptLower.includes('wine')) {
    assumptions.push({
      category: 'methodology',
      text: `Barrel maturation impacts (if applicable) are included based on barrel type, ageing duration, and number of uses. Barrel impacts are amortised across the barrel's useful life.`,
    });
  }

  // ──────────────────────────────────────────────────────────────────────────
  // 8. LIMITATIONS
  // ──────────────────────────────────────────────────────────────────────────

  assumptions.push({
    category: 'limitations',
    text: `Where supplier-specific data is unavailable, generic emission factors are used as proxies. This may over- or under-estimate impacts for specific supply chains.`,
  });

  if (ctx.systemBoundary === 'cradle-to-gate') {
    assumptions.push({
      category: 'limitations',
      text: `Distribution, consumer use phase, and end-of-life stages are excluded from this cradle-to-gate assessment. Results do not represent the full lifecycle impact.`,
    });
  } else if (ctx.systemBoundary === 'cradle-to-shelf') {
    assumptions.push({
      category: 'limitations',
      text: `Consumer use phase and end-of-life stages are excluded from this cradle-to-shelf assessment. Results do not represent the full lifecycle impact.`,
    });
  }

  assumptions.push({
    category: 'limitations',
    text: `Capital goods (manufacturing equipment, buildings) and employee activities (commuting, business travel) are excluded per the stated cut-off criteria.`,
  });

  // Return just the text strings, in category order
  return assumptions.map((a) => a.text);
}

// ============================================================================
// HELPERS
// ============================================================================

function getBoundaryScope(boundary: string): string {
  switch (boundary) {
    case 'cradle-to-gate':
      return 'Includes raw material extraction, processing, and packaging up to the factory gate.';
    case 'cradle-to-shelf':
      return 'Includes raw materials, processing, packaging, and distribution to point of sale.';
    case 'cradle-to-consumer':
      return 'Includes raw materials, processing, packaging, distribution, and consumer use phase.';
    case 'cradle-to-grave':
      return 'Full lifecycle including raw materials, processing, packaging, distribution, consumer use phase, and end-of-life disposal/recycling.';
    default:
      return '';
  }
}
