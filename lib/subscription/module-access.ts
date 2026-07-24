/**
 * Server-side gate for the four "what do you work with?" modules.
 *
 * One check, used by every module route (vineyards, orchards, arable fields,
 * hospitality) so they cannot drift apart. Tier-only: the beta-flag override
 * these routes each carried their own copy of went away on 2026-07-24 (see
 * lib/subscription/works-with.ts).
 */

import { NextResponse } from 'next/server';
import { MODULE_LABEL, tierOpensModules, type WorksWithModule } from './works-with';

/**
 * Returns null when the org may use the module, or a 403 NextResponse when it
 * may not. Callers should `const denied = await requireModuleAccess(...); if
 * (denied) return denied;`.
 */
export async function requireModuleAccess(
  supabase: any,
  organizationId: string,
  module: WorksWithModule,
): Promise<NextResponse | null> {
  const { data: org } = await supabase
    .from('organizations')
    .select('subscription_tier')
    .eq('id', organizationId)
    .maybeSingle();

  if (tierOpensModules(org?.subscription_tier)) return null;

  return NextResponse.json(
    { error: `${MODULE_LABEL[module]} are part of the Canopy plan.`, upgradeTo: 'canopy' },
    { status: 403 },
  );
}
