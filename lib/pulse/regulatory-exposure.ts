/**
 * Pulse -- Regulatory exposure calculator.
 *
 * Pure functions that estimate the org's £ liability under the UK/EU regimes
 * drinks businesses budget for in 2026-2030. Crucially, each regime is GATED by
 * real eligibility — most craft drinks producers are NOT in UK ETS and fall
 * below the EPR / Plastic Packaging Tax thresholds, so the card must say "not in
 * scope" rather than invent a cost.
 *
 *   1. UK ETS  - only if the org operates an ETS-covered installation
 *                (combustion >20MW, power generation, aviation). Off by default:
 *                typical drinks producers are below the threshold.
 *   2. UK CBAM - carbon border adjustment on imported aluminium/steel/etc.,
 *                from 1 Jan 2027. Only on configured in-scope imports.
 *   3. Plastic Packaging Tax (PPT)
 *              - £223.69/t for plastic packaging <30% recycled content, and ONLY
 *                if you handle 10+ tonnes of plastic packaging a year.
 *   4. Packaging EPR (pEPR)
 *              - disposal fees apply ONLY to large producers (£2m+ turnover AND
 *                50t+ packaging). Below £1m / 25t you are exempt; in between you
 *                report data but pay no disposal fees yet.
 *
 * Figures are UK-gov / HMRC / Defra published rates (Q2 2026). Update the
 * constants here and redeploy when rates change.
 */

export interface RegulatoryInput {
  /** Trailing-12-month Scope 1+2 in tonnes CO2e. */
  annual_tonnes_co2e: number;
  /** True only if the org runs a UK ETS-covered installation. Default false. */
  uk_ets_covered?: boolean;
  /** Estimated free-allocation of UK ETS allowances (tonnes). 0 if none / unknown. */
  uk_ets_free_allocation_t?: number;
  /** Estimated imports subject to CBAM (tonnes of embedded CO2e). 0 if none / unknown. */
  cbam_embedded_tonnes?: number;
  /** Annual plastic packaging placed on market (tonnes). 0 if none / unknown. */
  plastic_packaging_tonnes?: number;
  /** Share of plastic packaging that is >=30% recycled content (0-1). */
  plastic_recycled_share?: number;
  /** Annual packaging placed on market, by material (tonnes). */
  packaging_by_material_t?: {
    paper_card?: number;
    plastic?: number;
    glass?: number;
    aluminium?: number;
    steel?: number;
    wood?: number;
  };
  /** Annual turnover (£), used for the EPR producer-size test. Optional. */
  annual_turnover_gbp?: number;
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
  /** False when the regime does not apply to this org (exempt / out of scope). */
  applies: boolean;
}

export interface RegulatoryResult {
  total_annual_gbp: number;
  lines: RegulatoryLine[];
  generated_at: string;
}

// ─────────────────────────────────────────────────────────────────────────
// Reference rates + thresholds. Update quarterly alongside reference-shadow-prices.ts.
// ─────────────────────────────────────────────────────────────────────────

/** UK ETS auction clearing price, reference. */
const UK_ETS_PRICE_GBP_PER_TONNE = 85;
/** UK CBAM uses the UK carbon price; ~£72/t reference. */
const CBAM_PRICE_GBP_PER_TONNE = 72;
/** UK Plastic Packaging Tax standard rate, from 1 April 2026. */
const PPT_GBP_PER_TONNE = 223.69;
/** PPT registration de-minimis: liable only at 10+ tonnes/year. */
const PPT_DE_MINIMIS_T = 10;

/** pEPR producer-size thresholds (Defra). Fees apply only to large producers. */
const EPR_EXEMPT_BELOW_TURNOVER = 1_000_000;
const EPR_LARGE_MIN_TURNOVER = 2_000_000;
const EPR_EXEMPT_BELOW_PACK_T = 25;
const EPR_LARGE_MIN_PACK_T = 50;

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

const fmtT = (t: number, dp = 1) =>
  t.toLocaleString('en-GB', { maximumFractionDigits: dp });

export function calculateRegulatoryExposure(input: RegulatoryInput): RegulatoryResult {
  const lines: RegulatoryLine[] = [];

  // 1. UK ETS — only for covered installations. ----------------------------
  if (input.uk_ets_covered === true) {
    const freeAlloc = Math.max(0, input.uk_ets_free_allocation_t ?? 0);
    const shortfallT = Math.max(0, input.annual_tonnes_co2e - freeAlloc);
    lines.push({
      id: 'uk_ets',
      label: 'UK ETS allowance shortfall',
      annual_cost_gbp: shortfallT * UK_ETS_PRICE_GBP_PER_TONNE,
      basis: `${fmtT(shortfallT, 0)} tCO2e × £${UK_ETS_PRICE_GBP_PER_TONNE}/t${freeAlloc > 0 ? ` (after ${fmtT(freeAlloc, 0)} t free allocation)` : ' (no free allocation assumed)'}`,
      source: 'UK ETS guidance, gov.uk',
      fix_href: '/pulse/settings/shadow-prices/',
      assumed: freeAlloc === 0,
      applies: true,
    });
  } else {
    lines.push({
      id: 'uk_ets',
      label: 'UK ETS allowance shortfall',
      annual_cost_gbp: 0,
      basis:
        'Not in scope. UK ETS covers combustion installations above 20MW net rated thermal input, power generation and aviation — drinks producers fall below this threshold and are not in the scheme.',
      source: 'UK ETS scope, gov.uk',
      fix_href: '/pulse/settings/shadow-prices/',
      assumed: false,
      applies: false,
    });
  }

  // 2. UK CBAM on imports (from Jan 2027). --------------------------------
  const cbamT = Math.max(0, input.cbam_embedded_tonnes ?? 0);
  lines.push({
    id: 'cbam',
    label: 'UK CBAM on imported goods',
    annual_cost_gbp: cbamT * CBAM_PRICE_GBP_PER_TONNE,
    basis:
      cbamT > 0
        ? `${fmtT(cbamT, 0)} tCO2e embedded × £${CBAM_PRICE_GBP_PER_TONNE}/t`
        : 'No CBAM-liable imports configured. From 1 Jan 2027 the UK CBAM charges imported aluminium, steel, cement, fertiliser and hydrogen above a £50k/year threshold.',
    source: 'UK CBAM (HMRC), effective 1 Jan 2027',
    fix_href: '/settings/organization/',
    assumed: cbamT === 0,
    applies: cbamT > 0,
  });

  // 3. Plastic Packaging Tax — 10 t/year de-minimis. ----------------------
  const ppTonnes = Math.max(0, input.plastic_packaging_tonnes ?? 0);
  const recycledShare = Math.max(0, Math.min(1, input.plastic_recycled_share ?? 0));
  if (ppTonnes >= PPT_DE_MINIMIS_T) {
    const taxedT = ppTonnes * (1 - recycledShare);
    lines.push({
      id: 'plastic_tax',
      label: 'UK Plastic Packaging Tax',
      annual_cost_gbp: taxedT * PPT_GBP_PER_TONNE,
      basis: `${fmtT(taxedT)} t taxable × £${PPT_GBP_PER_TONNE}/t (${Math.round(recycledShare * 100)}% of your plastic is ≥30% recycled and exempt)`,
      source: 'HMRC PPT standard rate, effective 1 April 2026',
      fix_href: '/products',
      assumed: false,
      applies: true,
    });
  } else {
    lines.push({
      id: 'plastic_tax',
      label: 'UK Plastic Packaging Tax',
      annual_cost_gbp: 0,
      basis:
        ppTonnes > 0
          ? `Exempt: ${fmtT(ppTonnes)} t plastic packaging is below the 10 t/year registration threshold.`
          : 'No plastic packaging recorded. PPT applies once you manufacture or import 10+ tonnes/year of plastic packaging with <30% recycled content.',
      source: 'HMRC PPT registration threshold',
      fix_href: '/products',
      assumed: ppTonnes === 0,
      applies: false,
    });
  }

  // 4. Packaging EPR — producer-size gated. -------------------------------
  const byMaterial = input.packaging_by_material_t ?? {};
  const totalPackT = Object.values(byMaterial).reduce((s: number, v) => s + (Number(v) || 0), 0);
  const turnover = input.annual_turnover_gbp;
  const turnoverKnown = typeof turnover === 'number';

  if (totalPackT === 0) {
    lines.push({
      id: 'epr',
      label: 'UK Packaging EPR fees',
      annual_cost_gbp: 0,
      basis:
        'No packaging tonnage recorded yet. pEPR disposal fees apply to large producers only (£2m+ turnover and 50t+ packaging a year).',
      source: 'Defra pEPR thresholds',
      fix_href: '/products',
      assumed: true,
      applies: false,
    });
  } else {
    const exempt = totalPackT < EPR_EXEMPT_BELOW_PACK_T || (turnoverKnown && turnover! < EPR_EXEMPT_BELOW_TURNOVER);
    const large = totalPackT >= EPR_LARGE_MIN_PACK_T && (!turnoverKnown || turnover! >= EPR_LARGE_MIN_TURNOVER);

    if (exempt) {
      lines.push({
        id: 'epr',
        label: 'UK Packaging EPR fees',
        annual_cost_gbp: 0,
        basis: `Exempt: you place ${fmtT(totalPackT)} t of packaging on the market — below the pEPR thresholds (£1m turnover and 25 t packaging a year).`,
        source: 'Defra pEPR thresholds',
        fix_href: '/products',
        assumed: false,
        applies: false,
      });
    } else if (!large) {
      lines.push({
        id: 'epr',
        label: 'UK Packaging EPR fees',
        annual_cost_gbp: 0,
        basis: `Small producer (${fmtT(totalPackT)} t): data reporting only — disposal fees apply to large producers (£2m+ turnover and 50t+ packaging a year).`,
        source: 'Defra pEPR producer tiers',
        fix_href: '/products',
        assumed: false,
        applies: false,
      });
    } else {
      let eprCost = 0;
      const parts: string[] = [];
      for (const [mat, rate] of Object.entries(EPR_GBP_PER_TONNE)) {
        const t = Math.max(0, Number((byMaterial as Record<string, number | undefined>)[mat] ?? 0));
        if (t > 0) {
          eprCost += t * rate;
          parts.push(`${fmtT(t)} t ${mat.replace('_', ' ')} × £${rate}/t`);
        }
      }
      lines.push({
        id: 'epr',
        label: 'UK Packaging EPR fees',
        annual_cost_gbp: eprCost,
        basis: `Large producer (${fmtT(totalPackT)} t): ${parts.join(' + ')}${turnoverKnown ? '' : ' — assumes turnover ≥ £2m; confirm in settings'}`,
        source: 'Defra pEPR modulated base fees, 2025 reference rates',
        fix_href: '/products',
        assumed: !turnoverKnown,
        applies: true,
      });
    }
  }

  const total = lines.reduce((s, l) => s + l.annual_cost_gbp, 0);
  return { total_annual_gbp: total, lines, generated_at: new Date().toISOString() };
}
