/**
 * Pulse -- Regulatory exposure calculator.
 *
 * Pure functions that estimate the org's £ liability under each of the live
 * UK/EU regimes drinks businesses need to budget for in 2026-2030:
 *
 *   1. UK ETS             - Emissions Trading Scheme allowance shortfall cost
 *   2. CBAM               - EU Carbon Border Adjustment on steel/aluminium imports
 *   3. Plastic Packaging Tax (PPT)
 *                         - £217.85/t for packaging <30% recycled content
 *   4. Packaging EPR (pEPR)
 *                         - UK extended producer responsibility fees
 *
 * Figures are UK-gov / HMRC / Defra published rates at time of writing
 * (Q2 2026). They're periodically reviewed -- when rates change, update the
 * constants here and redeploy. Source URLs in the comments.
 */

export interface RegulatoryInput {
  /** Trailing-12-month Scope 1+2 in tonnes CO2e. */
  annual_tonnes_co2e: number;
  /** Estimated free-allocation of UK ETS allowances (tonnes). 0 if none / unknown. */
  uk_ets_free_allocation_t?: number;
  /** Estimated imports subject to CBAM (tonnes of embedded CO2e). 0 if none / unknown. */
  cbam_embedded_tonnes?: number;
  /** Tonnage of plastic packaging placed on market. 0 if none / unknown. */
  plastic_packaging_tonnes?: number;
  /** Share of plastic packaging that is >=30% recycled content (0-1). */
  plastic_recycled_share?: number;
  /** Tonnage of packaging placed on market, by material. */
  packaging_by_material_t?: {
    paper_card?: number;
    plastic?: number;
    glass?: number;
    aluminium?: number;
    steel?: number;
    wood?: number;
  };
}

export interface RegulatoryLine {
  id: string;
  label: string;
  annual_cost_gbp: number;
  basis: string;
  source: string;
  /** UI hint on where to act. */
  fix_href: string;
  /** True if the calculation used a default assumption the user can refine. */
  assumed: boolean;
}

export interface RegulatoryResult {
  total_annual_gbp: number;
  lines: RegulatoryLine[];
  generated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Reference rates. Update quarterly alongside lib/pulse/reference-shadow-prices.ts.
// ─────────────────────────────────────────────────────────────────────────

/** UK ETS auction clearing price, reference. Use shadow carbon price if live. */
const UK_ETS_PRICE_GBP_PER_TONNE = 85;

/** EU CBAM uses EU ETS price; ~€85 mid-2026 -> ~£72/t at £/€ 0.85. */
const CBAM_PRICE_GBP_PER_TONNE = 72;

/** UK Plastic Packaging Tax standard rate, from 1 April 2026. */
const PPT_GBP_PER_TONNE = 223.69;

/**
 * UK packaging EPR (pEPR) illustrative base fees by material (Defra, 2025
 * modulation factors pending). Real fees depend on weight, modulation and
 * recycling performance -- we use mid-range defaults.
 */
const EPR_GBP_PER_TONNE: Record<string, number> = {
  paper_card: 215,
  plastic: 485,
  glass: 240,
  aluminium: 435,
  steel: 305,
  wood: 120,
};

export function calculateRegulatoryExposure(input: RegulatoryInput): RegulatoryResult {
  const lines: RegulatoryLine[] = [];

  // 1. UK ETS shortfall -------------------------------------------------------
  const freeAlloc = Math.max(0, input.uk_ets_free_allocation_t ?? 0);
  const etsShortfallT = Math.max(0, input.annual_tonnes_co2e - freeAlloc);
  const etsCost = etsShortfallT * UK_ETS_PRICE_GBP_PER_TONNE;
  lines.push({
    id: 'uk_ets',
    label: 'UK ETS allowance shortfall',
    annual_cost_gbp: etsCost,
    basis:
      freeAlloc > 0
        ? `${etsShortfallT.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e × £${UK_ETS_PRICE_GBP_PER_TONNE}/t (after ${freeAlloc.toLocaleString('en-GB')} t free allocation)`
        : `${etsShortfallT.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e × £${UK_ETS_PRICE_GBP_PER_TONNE}/t (no free allocation assumed)`,
    source: 'UK ETS guidance, gov.uk',
    fix_href: '/pulse/settings/shadow-prices/',
    assumed: freeAlloc === 0,
  });

  // 2. CBAM on imports --------------------------------------------------------
  const cbamT = Math.max(0, input.cbam_embedded_tonnes ?? 0);
  const cbamCost = cbamT * CBAM_PRICE_GBP_PER_TONNE;
  lines.push({
    id: 'cbam',
    label: 'EU CBAM on imported goods',
    annual_cost_gbp: cbamCost,
    basis:
      cbamT > 0
        ? `${cbamT.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e embedded × £${CBAM_PRICE_GBP_PER_TONNE}/t`
        : 'No CBAM-in-scope imports configured yet',
    source: 'EU Regulation 2023/956; EU ETS price ~£72/t',
    fix_href: '/settings/organization/',
    assumed: cbamT === 0,
  });

  // 3. Plastic Packaging Tax --------------------------------------------------
  const ppTonnes = Math.max(0, input.plastic_packaging_tonnes ?? 0);
  const recycledShare = Math.max(0, Math.min(1, input.plastic_recycled_share ?? 0));
  // Only packaging <30% recycled pays PPT. We approximate: taxed tonnage =
  // plastic_t × (1 - recycled_share_at_30pct_threshold).
  const taxedT = ppTonnes * (1 - recycledShare);
  const pptCost = taxedT * PPT_GBP_PER_TONNE;
  lines.push({
    id: 'plastic_tax',
    label: 'UK Plastic Packaging Tax',
    annual_cost_gbp: pptCost,
    basis:
      ppTonnes > 0
        ? `${taxedT.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t taxable × £${PPT_GBP_PER_TONNE}/t (${Math.round(recycledShare * 100)}% recycled share)`
        : 'No plastic packaging tonnage configured yet',
    source: 'HMRC PPT standard rate, effective 1 April 2026',
    fix_href: '/products',
    assumed: ppTonnes === 0,
  });

  // 4. Packaging EPR ---------------------------------------------------------
  const byMaterial = input.packaging_by_material_t ?? {};
  let eprCost = 0;
  const eprBreakdown: string[] = [];
  for (const [mat, rate] of Object.entries(EPR_GBP_PER_TONNE)) {
    const t = Math.max(0, Number((byMaterial as Record<string, number | undefined>)[mat] ?? 0));
    if (t > 0) {
      eprCost += t * rate;
      eprBreakdown.push(`${t.toLocaleString('en-GB', { maximumFractionDigits: 1 })} t ${mat.replace('_', ' ')} × £${rate}/t`);
    }
  }
  const totalPackT = Object.values(byMaterial).reduce(
    (s: number, v) => s + (Number(v) || 0),
    0,
  );
  lines.push({
    id: 'epr',
    label: 'UK Packaging EPR fees',
    annual_cost_gbp: eprCost,
    basis:
      totalPackT > 0
        ? eprBreakdown.join(' + ')
        : 'No packaging tonnage configured yet',
    source: 'Defra pEPR modulated base fees, 2025 reference rates',
    fix_href: '/products',
    assumed: totalPackT === 0,
  });

  const total = lines.reduce((s, l) => s + l.annual_cost_gbp, 0);
  return {
    total_annual_gbp: total,
    lines,
    generated_at: new Date().toISOString(),
  };
}
