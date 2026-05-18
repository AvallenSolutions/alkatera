import 'server-only';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  calculateCertificationReadiness,
  getBcorpFrameworkId,
} from './readiness';
import {
  computePlatformHealth,
  getMappedRequirementCodes,
} from './platform-data';

const EIGHTEEN_MONTHS_MS = 18 * 30 * 24 * 60 * 60 * 1000;

export interface HealthScoreBreakdown {
  evidenceCompleteness: number;
  dataRecency: number;
  platformDataQuality: number;
  year3Trajectory: number;
}

export interface HealthScoreResult {
  score: number;
  breakdown: HealthScoreBreakdown;
  trend: 'up' | 'down' | 'stable';
  previousScore: number | null;
}

/**
 * 0-100 certification health score:
 *  - evidence completeness 40%
 *  - data recency 25% (evidence > 18 months is stale)
 *  - platform data quality 25%
 *  - Year 3 trajectory 10%
 */
export async function computeHealthScore(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<HealthScoreResult | null> {
  const frameworkId = await getBcorpFrameworkId(supabase);
  if (!frameworkId) return null;

  const readiness = await calculateCertificationReadiness(
    supabase,
    organizationId,
  );
  if (!readiness.hasCertification) return null;

  const applicable = readiness.requirementStatuses.filter(
    (rs) => rs.status !== 'future',
  );
  const passed = applicable.filter((rs) => rs.status === 'passed').length;
  const evidenceCompleteness =
    applicable.length > 0 ? passed / applicable.length : 0;

  // Data recency
  const { data: verified } = await supabase
    .from('certification_evidence_links')
    .select('updated_at, created_at, verification_status')
    .eq('organization_id', organizationId)
    .eq('verification_status', 'verified');
  const vRows = verified ?? [];
  let dataRecency = 1;
  if (vRows.length > 0) {
    const now = Date.now();
    const fresh = vRows.filter((r: any) => {
      const ts = new Date(r.updated_at ?? r.created_at ?? 0).getTime();
      return now - ts <= EIGHTEEN_MONTHS_MS;
    }).length;
    dataRecency = fresh / vRows.length;
  } else {
    dataRecency = 0;
  }

  // Platform data quality
  const mappedCodes = new Set(getMappedRequirementCodes());
  const codes = readiness.requirementStatuses
    .map((rs) => rs.code)
    .filter((c) => mappedCodes.has(c));
  const ph = await computePlatformHealth(supabase, organizationId, codes);
  let platformDataQuality = 1;
  if (ph.length > 0) {
    const sum = ph.reduce(
      (acc, e) =>
        acc +
        (e.status === 'complete' ? 1 : e.status === 'partial' ? 0.5 : 0),
      0,
    );
    platformDataQuality = sum / ph.length;
  }

  // Year 3 trajectory
  const year3 = readiness.requirementStatuses.filter(
    (rs) => rs.applicableFromYear === 3 && mappedCodes.has(rs.code),
  );
  let year3Trajectory = 1;
  if (year3.length > 0) {
    const phByCode = new Set(
      ph
        .filter((e) => e.status !== 'missing')
        .flatMap((e) => e.requirementCodes),
    );
    const onTrack = year3.filter((rs) => phByCode.has(rs.code)).length;
    year3Trajectory = onTrack / year3.length;
  }

  const breakdown: HealthScoreBreakdown = {
    evidenceCompleteness,
    dataRecency,
    platformDataQuality,
    year3Trajectory,
  };

  const score = Math.round(
    40 * evidenceCompleteness +
      25 * dataRecency +
      25 * platformDataQuality +
      10 * year3Trajectory,
  );

  // Trend vs the most recent prior month's last recorded health score.
  const startOfMonth = new Date();
  startOfMonth.setDate(1);
  const startOfMonthIso = startOfMonth.toISOString().slice(0, 10);
  const { data: prior } = await supabase
    .from('certification_score_history')
    .select('health_score, score_date')
    .eq('organization_id', organizationId)
    .eq('framework_id', frameworkId)
    .lt('score_date', startOfMonthIso)
    .not('health_score', 'is', null)
    .order('score_date', { ascending: false })
    .limit(1)
    .maybeSingle();
  const previousScore =
    prior?.health_score != null ? Number(prior.health_score) : null;
  const trend: HealthScoreResult['trend'] =
    previousScore == null
      ? 'stable'
      : score > previousScore + 1
        ? 'up'
        : score < previousScore - 1
          ? 'down'
          : 'stable';

  // Persist today's health score onto the score-history row.
  const today = new Date().toISOString().slice(0, 10);
  await supabase
    .from('certification_score_history')
    .upsert(
      {
        organization_id: organizationId,
        framework_id: frameworkId,
        score_date: today,
        health_score: score,
      },
      { onConflict: 'organization_id,framework_id,score_date' },
    );

  return { score, breakdown, trend, previousScore };
}
