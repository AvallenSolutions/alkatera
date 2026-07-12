/**
 * The growth score: how complete the org's data is, 0 to 100.
 *
 * Feeds the growth field (the living forest behind the desk and the room
 * landings): bare ground for a new org, closed canopy at 100. Composed from
 * cheap head counts because no single completeness number exists in the
 * platform; the vitality composite is a performance score (and goes null
 * when data is sparse), onboarding progress is per-user and saturates the
 * moment the wizard closes.
 *
 * Six bands follow the platform journey, each saturating so the score grows
 * steadily rather than jumping: foundations (facilities, team, integrations),
 * production (products + LCA coverage), measurement (activity entries),
 * network (suppliers, ESG, attestations), evidence (certifications, targets,
 * reports) and stewardship (the three social/governance scores).
 *
 * scoreFromIngredients is pure and unit-tested; computeGrowthScore gathers
 * the ingredients in one Promise.all of head counts plus one
 * metric_snapshots read (lca_completeness_pct, the only ready-made
 * org-wide coverage number, written daily by the Pulse cron).
 */

export interface GrowthIngredients {
  facilities: number;
  members: number;
  integrations: number;
  products: number;
  /** Latest lca_completeness_pct snapshot, or null before the first cron run. */
  lcaCompletenessPct: number | null;
  /** Fallback numerator when no snapshot exists yet. */
  lcasCompleted: number;
  /** facility_activity_entries in the trailing 12 months. */
  activityEntries12m: number;
  suppliers: number;
  esgSubmitted: number;
  /** Responsible-sourcing attestations, out of six. */
  responsibilityAttested: number;
  certificationsActive: number;
  targetsActive: number;
  reportsGenerated: number;
  peopleScore: number | null;
  governanceScore: number | null;
  communityScore: number | null;
}

export type GrowthBandKey =
  | 'foundations'
  | 'production'
  | 'measurement'
  | 'network'
  | 'evidence'
  | 'stewardship';

export interface GrowthScore {
  /** 0 to 100, rounded. */
  score: number;
  /** Points earned per band (each capped at its weight below). */
  bands: Record<GrowthBandKey, number>;
}

/** Band weights; they sum to 100. */
export const GROWTH_WEIGHTS: Record<GrowthBandKey, number> = {
  foundations: 15,
  production: 25,
  measurement: 20,
  network: 15,
  evidence: 15,
  stewardship: 10,
};

/** count/target clamped to 0..1: saturating credit, monotonic in count. */
function sat(count: number, target: number): number {
  if (target <= 0) return 0;
  return Math.min(1, Math.max(0, count) / target);
}

export function scoreFromIngredients(i: GrowthIngredients): GrowthScore {
  // Foundations: a site, a team, a pipe in.
  const foundations =
    (i.facilities > 0 ? 6 : 0) + sat(i.members, 3) * 6 + (i.integrations > 0 ? 3 : 0);

  // Production: products on the shelf, and how many carry a completed LCA.
  // Prefer the daily snapshot; fall back to a live ratio before the first cron.
  const lcaPct =
    i.lcaCompletenessPct !== null
      ? Math.min(100, Math.max(0, i.lcaCompletenessPct))
      : i.products > 0
        ? Math.min(100, (i.lcasCompleted / i.products) * 100)
        : 0;
  const production = sat(i.products, 6) * 12.5 + (lcaPct / 100) * 12.5;

  // Measurement: activity flowing in, two entries a month for a year.
  const measurement = sat(i.activityEntries12m, 24) * 20;

  // Network: the chain known, heard from, and attested.
  const esgRatio = i.suppliers > 0 ? sat(i.esgSubmitted, i.suppliers) : 0;
  const network = sat(i.suppliers, 8) * 7 + esgRatio * 4 + sat(i.responsibilityAttested, 6) * 4;

  // Evidence: claims that stand up.
  const evidence =
    sat(i.certificationsActive, 2) * 5 + sat(i.targetsActive, 2) * 5 + sat(i.reportsGenerated, 3) * 5;

  // Stewardship: the three social/governance scores have been run at all.
  const present = [i.peopleScore, i.governanceScore, i.communityScore].filter(
    (s) => s !== null,
  ).length;
  const stewardship = (present / 3) * 10;

  const bands: Record<GrowthBandKey, number> = {
    foundations,
    production,
    measurement,
    network,
    evidence,
    stewardship,
  };
  const total = Object.values(bands).reduce((a, b) => a + b, 0);
  return { score: Math.min(100, Math.max(0, Math.round(total))), bands };
}

/**
 * A single setup action behind a growth-band signal: what it is, whether
 * it's done, and where to do it. Never-empty desk (Phase 1) reads these to
 * fill Rosa's priorities for a new org that has no real priorities yet.
 */
export interface GrowthSignal {
  id: string;
  label: string;
  href: string;
  done: boolean;
}

function signal(done: boolean, id: string, label: string, href: string): GrowthSignal {
  return { id, label, href, done };
}

/**
 * Per-band setup signals, derived from the same ingredients the score uses
 * so the checklists, the desk priorities and the forest can never disagree.
 * Additive alongside scoreFromIngredients — same inputs, a different view.
 */
export function computeGrowthSignals(i: GrowthIngredients): Record<GrowthBandKey, GrowthSignal[]> {
  return {
    foundations: [
      signal(i.facilities > 0, 'facility', 'Add your first facility.', '/company/facilities/'),
      signal(i.members >= 3, 'team', 'Invite your team.', '/settings?tab=team'),
      signal(i.integrations > 0, 'integration', 'Connect an integration.', '/settings/integrations'),
    ],
    production: [
      signal(i.products > 0, 'product', 'Add your first product.', '/products/'),
      signal((i.lcaCompletenessPct ?? 0) > 0 || i.lcasCompleted > 0, 'lca', 'Complete a product LCA.', '/reports/lcas/'),
    ],
    measurement: [
      signal(i.activityEntries12m > 0, 'activity', 'Log your energy or fuel use.', '/data/scope-1-2/'),
    ],
    network: [
      signal(i.suppliers > 0, 'supplier', 'Add a supplier.', '/suppliers/'),
      signal(i.esgSubmitted > 0, 'esg', 'Request supplier ESG data.', '/suppliers/'),
      signal(i.responsibilityAttested > 0, 'attestation', 'Confirm responsible sourcing.', '/supplier-responsibility/'),
    ],
    evidence: [
      signal(i.certificationsActive > 0, 'certification', 'Start a certification.', '/certifications/'),
      signal(i.targetsActive > 0, 'target', 'Set a reduction target.', '/pulse/targets/'),
      signal(i.reportsGenerated > 0, 'report', 'Generate a sustainability report.', '/reports/sustainability/'),
    ],
    stewardship: [
      signal(i.peopleScore !== null, 'people', 'Run your people and culture score.', '/people-culture/'),
      signal(i.governanceScore !== null, 'governance', 'Run your governance score.', '/governance/'),
      signal(i.communityScore !== null, 'community', 'Run your community impact score.', '/community-impact/'),
    ],
  };
}

/** ISO date a year ago, for the trailing activity window. */
function yearAgoISO(): string {
  const d = new Date();
  d.setFullYear(d.getFullYear() - 1);
  return d.toISOString().slice(0, 10);
}

/**
 * Gather the ingredients: ~14 head counts and three latest-row reads, all
 * org-scoped, one round trip. Any failed query degrades to zero rather than
 * failing the score; the forest simply grows a little later.
 */
export async function gatherGrowthIngredients(
  db: any,
  organizationId: string,
): Promise<GrowthIngredients> {
  const count = async (
    table: string,
    refine?: (q: any) => any,
  ): Promise<number> => {
    let q = db
      .from(table)
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId);
    if (refine) q = refine(q);
    const { count: n, error } = await q;
    return error ? 0 : (n ?? 0);
  };

  /** Latest overall_score from a *_scores table, or null before first calc. */
  const latestScore = async (table: string): Promise<number | null> => {
    const { data, error } = await db
      .from(table)
      .select('overall_score')
      .eq('organization_id', organizationId)
      .order('calculation_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return error ? null : (data?.overall_score ?? null);
  };

  /** Latest lca_completeness_pct snapshot value, or null. */
  const lcaSnapshot = async (): Promise<number | null> => {
    const { data, error } = await db
      .from('metric_snapshots')
      .select('value')
      .eq('organization_id', organizationId)
      .eq('metric_key', 'lca_completeness_pct')
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle();
    return error ? null : (data?.value ?? null);
  };

  /** ESG assessments submitted by the org's suppliers (needs the join). */
  const esgSubmitted = async (): Promise<number> => {
    const { count: n, error } = await db
      .from('supplier_esg_assessments')
      .select('id, suppliers!inner(organization_id)', { count: 'exact', head: true })
      .eq('suppliers.organization_id', organizationId)
      .not('submitted_at', 'is', null);
    return error ? 0 : (n ?? 0);
  };

  const [
    facilities,
    members,
    integrations,
    products,
    lcaCompletenessPct,
    lcasCompleted,
    activityEntries12m,
    suppliers,
    esg,
    responsibilityAttested,
    certificationsActive,
    targetsActive,
    reportsGenerated,
    peopleScore,
    governanceScore,
    communityScore,
  ] = await Promise.all([
    count('facilities'),
    count('organization_members'),
    count('integration_connections'),
    count('products'),
    lcaSnapshot(),
    count('product_carbon_footprints', (q) => q.eq('status', 'completed')),
    count('facility_activity_entries', (q) => q.gte('reporting_period_start', yearAgoISO())),
    count('suppliers'),
    esgSubmitted(),
    count('supplier_responsibility_attestations', (q) => q.eq('is_attested', true)),
    count('organization_certifications', (q) => q.neq('status', 'not_started')),
    count('sustainability_targets', (q) => q.eq('status', 'active')),
    count('generated_reports', (q) => q.eq('status', 'completed')),
    latestScore('people_culture_scores'),
    latestScore('governance_scores'),
    latestScore('community_impact_scores'),
  ]);

  return {
    facilities,
    members,
    integrations,
    products,
    lcaCompletenessPct,
    lcasCompleted,
    activityEntries12m,
    suppliers,
    esgSubmitted: esg,
    responsibilityAttested,
    certificationsActive,
    targetsActive,
    reportsGenerated,
    peopleScore,
    governanceScore,
    communityScore,
  };
}

/** Convenience wrapper: gather ingredients, then score them. */
export async function computeGrowthScore(
  db: any,
  organizationId: string,
): Promise<GrowthScore> {
  const ingredients = await gatherGrowthIngredients(db, organizationId);
  return scoreFromIngredients(ingredients);
}
