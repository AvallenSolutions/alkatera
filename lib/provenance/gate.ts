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
