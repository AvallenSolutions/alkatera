/**
 * Confirmed-share gating for external artefacts (tasks/data-revolution-plan.md,
 * Pillar 2: "reports, exports and passports require confirmed data" —
 * internal dashboards never gate). Builds on the Phase A rollup
 * (`lib/provenance/rollup.ts`, `/api/provenance`): an artefact whose
 * relevant scope hasn't reached `CONFIRMED_SHARE_EXPORT_THRESHOLD` shows a
 * polite dialog listing what needs confirming, with deep links, instead of
 * generating the artefact. Mirrors the shape of the existing
 * `enforceExportAllowed` (middleware/subscription-check.ts) so the two
 * gates compose the same way at a route: check subscription, then check
 * provenance.
 */

import { NextResponse } from 'next/server';
import {
  computeConfirmedShare,
  gatherProvenanceIngredients,
  type ProvenanceArea,
  type ProvenanceRollup,
} from './rollup';

/** Below this confirmed share, an external artefact is blocked. Deliberately mid-range: enough real data to stand behind, not so strict that a mostly-set-up org can never produce a first report. */
export const CONFIRMED_SHARE_EXPORT_THRESHOLD = 80;

export interface ProvenanceBlocker {
  area: ProvenanceArea;
  confirmedPct: number;
  /** How many records in this area still need a look. */
  unconfirmedCount: number;
  label: string;
  deepLink: string;
}

export interface ProvenanceGateResult {
  allowed: boolean;
  confirmedPct: number;
  threshold: number;
  blockers: ProvenanceBlocker[];
}

const AREA_LABEL: Record<ProvenanceArea, string> = {
  products: 'product ingredients and packaging',
  utilities: 'facility utility readings',
  packaging: 'packaging materials',
};

const AREA_DEEP_LINK: Record<ProvenanceArea, string> = {
  products: '/products',
  utilities: '/company/facilities',
  packaging: '/products',
};

/**
 * Checks a specific scope (or the whole org, 'overall') against the
 * threshold. Every area below threshold is listed as a blocker — even when
 * checking 'overall', so the dialog can point at the specific area dragging
 * the number down rather than just saying "not enough".
 */
export async function checkProvenanceGate(
  db: any,
  organizationId: string,
  scope: ProvenanceArea | 'overall' = 'overall',
): Promise<ProvenanceGateResult> {
  const ingredients = await gatherProvenanceIngredients(db, organizationId);
  const rollup: ProvenanceRollup = await computeConfirmedShare(db, organizationId);

  const relevantPct = scope === 'overall' ? rollup.confirmedPct : rollup.byArea[scope];
  const areasToCheck: ProvenanceArea[] = scope === 'overall' ? ['products', 'utilities', 'packaging'] : [scope];

  const totals: Record<ProvenanceArea, { total: number; confirmed: number }> = {
    products: { total: ingredients.productsTotal, confirmed: ingredients.productsConfirmed },
    utilities: { total: ingredients.utilitiesTotal, confirmed: ingredients.utilitiesConfirmed },
    packaging: { total: ingredients.packagingTotal, confirmed: ingredients.packagingConfirmed },
  };

  const blockers: ProvenanceBlocker[] = areasToCheck
    .filter((area) => rollup.byArea[area] < CONFIRMED_SHARE_EXPORT_THRESHOLD && totals[area].total > 0)
    .map((area) => ({
      area,
      confirmedPct: rollup.byArea[area],
      unconfirmedCount: Math.max(0, totals[area].total - totals[area].confirmed),
      label: AREA_LABEL[area],
      deepLink: AREA_DEEP_LINK[area],
    }));

  return {
    allowed: relevantPct >= CONFIRMED_SHARE_EXPORT_THRESHOLD,
    confirmedPct: relevantPct,
    threshold: CONFIRMED_SHARE_EXPORT_THRESHOLD,
    blockers,
  };
}

/**
 * Single-product check, for publishing ONE product's LCA.
 *
 * The org-wide `products` area answers "how much of your catalogue has an
 * LCA", which is coverage, not quality: using it here blocked a perfectly
 * evidenced LCA because OTHER products lacked one, and adding a new product
 * could retroactively block a report that published yesterday. A reader of
 * this LCA relies on the materials behind THIS product, so that is what we
 * check.
 *
 * Confirmed means a real, non-proxy factor: a matched library factor, or a
 * parametric factor derived from pinned endpoints (which deliberately has no
 * matched_source_name because nothing was searched).
 */
export async function checkProductProvenanceGate(
  db: any,
  productId: string,
): Promise<ProvenanceGateResult> {
  const countRows = async (refine?: (q: any) => any): Promise<number> => {
    let q = db.from('product_materials').select('id', { count: 'exact', head: true }).eq('product_id', productId);
    if (refine) q = refine(q);
    const { count, error } = await q;
    return error ? 0 : (count ?? 0);
  };

  const [total, matched, parametric] = await Promise.all([
    countRows(),
    countRows((q) => q.not('matched_source_name', 'is', null).neq('ef_source_type', 'proxy')),
    countRows((q) => q.eq('data_source', 'parametric').is('matched_source_name', null)),
  ]);

  // A footprint with no material rows has nothing to confirm; the LCA route's
  // own completeness checks own that case.
  if (total <= 0) {
    return { allowed: true, confirmedPct: 100, threshold: CONFIRMED_SHARE_EXPORT_THRESHOLD, blockers: [] };
  }

  const confirmed = Math.min(total, matched + parametric);
  const confirmedPct = Math.round((confirmed / total) * 100);
  const allowed = confirmedPct >= CONFIRMED_SHARE_EXPORT_THRESHOLD;

  return {
    allowed,
    confirmedPct,
    threshold: CONFIRMED_SHARE_EXPORT_THRESHOLD,
    blockers: allowed
      ? []
      : [{
          area: 'products',
          confirmedPct,
          unconfirmedCount: Math.max(0, total - confirmed),
          label: "this product's ingredients and packaging",
          deepLink: `/products/${productId}`,
        }],
  };
}

/**
 * Route-level guard for a single product's LCA. Same shape as
 * `enforceProvenanceGate`, scoped to the product being published.
 */
export async function enforceProductProvenanceGate(
  db: any,
  productId: string,
): Promise<NextResponse | null> {
  const result = await checkProductProvenanceGate(db, productId);
  if (result.allowed) return null;

  const unconfirmed = result.blockers[0]?.unconfirmedCount ?? 0;
  return NextResponse.json(
    {
      error: 'Not enough confirmed data for this product yet',
      message: unconfirmed > 0
        ? `This LCA needs ${unconfirmed} number${unconfirmed === 1 ? '' : 's'} confirmed first.`
        : `Only ${result.confirmedPct}% of this product's data is confirmed — published LCAs need at least ${result.threshold}%.`,
      reason: 'provenance_gate',
      confirmedPct: result.confirmedPct,
      threshold: result.threshold,
      blockers: result.blockers,
    },
    { status: 403 },
  );
}

/**
 * Route-level guard, same call shape as `enforceExportAllowed`: returns a
 * ready-to-return 403 NextResponse when blocked, or null when the artefact
 * may proceed. The JSON body carries enough structure (`blockers`) for a
 * client to render the "needs confirming first" dialog rather than just an
 * error toast.
 */
export async function enforceProvenanceGate(
  db: any,
  organizationId: string,
  scope: ProvenanceArea | 'overall' = 'overall',
): Promise<NextResponse | null> {
  const result = await checkProvenanceGate(db, organizationId, scope);
  if (result.allowed) return null;

  const totalUnconfirmed = result.blockers.reduce((sum, b) => sum + b.unconfirmedCount, 0);

  return NextResponse.json(
    {
      error: 'Not enough confirmed data for this report yet',
      message:
        totalUnconfirmed > 0
          ? `Your report needs ${totalUnconfirmed} number${totalUnconfirmed === 1 ? '' : 's'} confirmed first.`
          : `Only ${result.confirmedPct}% of this data is confirmed — reports, passports and exports need at least ${result.threshold}%.`,
      reason: 'provenance_gate',
      confirmedPct: result.confirmedPct,
      threshold: result.threshold,
      blockers: result.blockers,
    },
    { status: 403 },
  );
}
