import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getBcorpV21Requirement } from './frameworks/bcorp-v2';
import { queryProbeEvidence } from './platform-probes';
import { queryPlatformEvidence } from './platform-data';
import type { PlatformEvidenceResult } from './platform-data';

/**
 * Resolve B Corp auto-evidence for a requirement code, the SAME way the
 * auto-evidence route does (app/api/certifications/auto-evidence/[requirementId]):
 * the current v2.1 requirements (codes like CA1.1, PSG1.1) carry a shared
 * `probe`, so prefer that; only fall back to the legacy B Corp module mapping
 * (old IT-codes) when the code isn't a known v2.1 requirement.
 *
 * Keep this in lockstep with that route so the answer key, Rosa and the
 * per-requirement panel all surface identical evidence. Returns null when the
 * requirement has no platform mapping (manual evidence only).
 */
export async function queryBcorpAutoEvidence(
  supabase: SupabaseClient,
  requirementCode: string,
  organizationId: string,
): Promise<PlatformEvidenceResult | null> {
  const bcorpReq = getBcorpV21Requirement(requirementCode);
  return bcorpReq
    ? await queryProbeEvidence(supabase, bcorpReq.probe ?? null, organizationId)
    : await queryPlatformEvidence(supabase, requirementCode, organizationId);
}
