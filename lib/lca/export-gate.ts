import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { checkProductProvenanceGate, type ProvenanceBlocker } from '@/lib/provenance/gate';
import { TIER_LEVELS, type TierName } from '@/lib/subscription/feature-catalog';

/**
 * Can this footprint leave the building?
 *
 * Two separate questions, deliberately kept apart:
 *
 *   1. Is enough of it confirmed? Internal surfaces (the cellar, the forest,
 *      the vitality score) compute from labelled estimates, because an
 *      estimate you can see is more useful than a blank. A signed report is
 *      different: nothing unconfirmed should reach a customer, an auditor or a
 *      retailer under alkatera's name.
 *
 *   2. Does their plan cover a footprint this wide? Boundary width used to be
 *      gated at the point of estimating, which meant a Seed customer could not
 *      even see what their full footprint might look like. Estimating is now
 *      free at any width and the tier is checked at export, so the paywall
 *      lands on the thing being sold rather than on the truth.
 *
 * A refusal always says which of the two it is, and what to do about it.
 */

/** Minimum tier that may export a footprint of each width. */
export const BOUNDARY_EXPORT_TIER: Record<string, TierName> = {
  'cradle-to-gate': 'seed',
  'cradle-to-shelf': 'blossom',
  'cradle-to-consumer': 'canopy',
  'cradle-to-grave': 'canopy',
};

export interface ExportGateResult {
  allowed: boolean;
  /** 'provenance' when the data is not confirmed enough, 'tier' when the plan does not cover it. */
  reason?: 'provenance' | 'tier';
  message?: string;
  confirmedPct: number;
  threshold: number;
  blockers: ProvenanceBlocker[];
  /** Set only when reason is 'tier': the plan they would need. */
  requiredTier?: TierName;
  currentTier?: TierName;
}

/**
 * Check both gates for one product's footprint.
 *
 * Order matters: the tier check runs first, because "your plan does not cover
 * this" is a different conversation from "your data is not ready", and telling
 * someone to go and confirm eight ingredients before revealing they also need
 * to upgrade would waste their afternoon.
 */
export async function checkLcaExportGate(
  db: SupabaseClient,
  productId: string | number,
  systemBoundary: string | null,
  currentTier: TierName,
): Promise<ExportGateResult> {
  const provenance = await checkProductProvenanceGate(db as any, String(productId));

  const requiredTier = systemBoundary ? BOUNDARY_EXPORT_TIER[systemBoundary] : undefined;
  if (requiredTier && TIER_LEVELS[currentTier] < TIER_LEVELS[requiredTier]) {
    return {
      allowed: false,
      reason: 'tier',
      message:
        `This footprint follows the product beyond your factory gate. ` +
        `Sharing one that wide is part of the ${titleCase(requiredTier)} plan. ` +
        `You can keep working with it here on any plan.`,
      confirmedPct: provenance.confirmedPct,
      threshold: provenance.threshold,
      blockers: provenance.blockers,
      requiredTier,
      currentTier,
    };
  }

  if (!provenance.allowed) {
    return {
      allowed: false,
      reason: 'provenance',
      message:
        `Reports need ${provenance.threshold}% of a footprint confirmed, and this one is at ` +
        `${provenance.confirmedPct}%. Confirm the biggest few figures and it will open up.`,
      confirmedPct: provenance.confirmedPct,
      threshold: provenance.threshold,
      blockers: provenance.blockers,
    };
  }

  return {
    allowed: true,
    confirmedPct: provenance.confirmedPct,
    threshold: provenance.threshold,
    blockers: [],
  };
}

function titleCase(tier: TierName): string {
  return tier.charAt(0).toUpperCase() + tier.slice(1);
}
