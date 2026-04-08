import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateRisksAndOpportunities } from '@/lib/claude/transition-risks-assistant';
import type { ReductionTarget, TransitionMilestone, RiskOpportunity } from '@/lib/transition-plan/types';

/**
 * Transition Plan API
 *
 * GET  /api/transition-plan?year=2026&orgId=xxx  — fetch plan for org + year
 * POST /api/transition-plan                       — upsert plan; pass generateRisks: true to trigger AI R&O generation
 * PATCH /api/transition-plan                      — update R&O items only (no AI re-generation)
 *
 * Authentication: Bearer token (Supabase session)
 */

export const runtime = 'nodejs';
export const maxDuration = 60; // AI R&O generation can take up to ~20s

async function getAuthenticatedClient(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader?.startsWith('Bearer ')) return { client: null, user: null };

  const token = authHeader.replace('Bearer ', '');
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { global: { headers: { Authorization: `Bearer ${token}` } } },
  );
  const { data: { user } } = await client.auth.getUser();
  return { client, user };
}

export async function GET(request: NextRequest) {
  const { client, user } = await getAuthenticatedClient(request);
  if (!client || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const orgId = searchParams.get('orgId');

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const { data, error } = await client
    .from('transition_plans')
    .select('*')
    .eq('organization_id', orgId)
    .eq('plan_year', year)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ plan: data });
}

export async function POST(request: NextRequest) {
  const { client, user } = await getAuthenticatedClient(request);
  if (!client || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json();
  const {
    orgId,
    planYear,
    baselineYear,
    baselineEmissionsTco2e,
    targets,
    milestones,
    sbtiAligned,
    sbtiTargetYear,
    generateRisks,
  } = body;

  if (!orgId || !planYear || !baselineYear) {
    return NextResponse.json({ error: 'orgId, planYear, and baselineYear are required' }, { status: 400 });
  }

  const payload = {
    organization_id: orgId,
    plan_year: planYear,
    baseline_year: baselineYear,
    baseline_emissions_tco2e: baselineEmissionsTco2e ?? null,
    targets: (targets as ReductionTarget[]) || [],
    milestones: (milestones as TransitionMilestone[]) || [],
    sbti_aligned: sbtiAligned ?? false,
    sbti_target_year: sbtiTargetYear ?? null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data: saved, error } = await client
    .from('transition_plans')
    .upsert(payload, { onConflict: 'organization_id,plan_year' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  // Generate AI risks and opportunities if requested
  if (generateRisks) {
    try {
      // Fetch materiality priority topics for context (non-fatal if unavailable)
      let priorityMaterialTopics: string[] = [];
      try {
        const { data: matData } = await client
          .from('materiality_assessments')
          .select('priority_topics')
          .eq('organization_id', orgId)
          .eq('assessment_year', planYear)
          .maybeSingle();
        if (matData?.priority_topics) priorityMaterialTopics = matData.priority_topics;
      } catch { /* non-fatal */ }

      // Fetch current year emissions for context (non-fatal if unavailable)
      let currentEmissionsTco2e: number | undefined;
      try {
        const { data: corpReport } = await client
          .from('corporate_reports')
          .select('total_emissions')
          .eq('organization_id', orgId)
          .eq('year', planYear)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();
        if (corpReport?.total_emissions) currentEmissionsTco2e = corpReport.total_emissions;
      } catch { /* non-fatal */ }

      // Fetch org name for context
      const { data: org } = await client
        .from('organizations')
        .select('name, industry_sector')
        .eq('id', orgId)
        .single();

      const result = await generateRisksAndOpportunities({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        planYear,
        baselineYear,
        baselineEmissionsTco2e: baselineEmissionsTco2e ?? null,
        currentEmissionsTco2e,
        targets: (targets as ReductionTarget[]) || [],
        milestones: (milestones as TransitionMilestone[]) || [],
        priorityMaterialTopics,
      });

      if (result.items.length > 0) {
        // Update the row with generated R&O
        const { data: updated, error: updateError } = await client
          .from('transition_plans')
          .update({ risks_and_opportunities: result.items, updated_at: new Date().toISOString() })
          .eq('id', saved.id)
          .select()
          .single();

        if (!updateError && updated) {
          return NextResponse.json({ plan: updated, risksGenerated: true });
        }
      }
    } catch (aiErr) {
      console.error('[Transition Plan API] R&O generation failed (non-fatal):', aiErr);
      // Return saved plan without R&O — client can retry
    }
  }

  return NextResponse.json({ plan: saved, risksGenerated: false });
}

export async function PATCH(request: NextRequest) {
  const { client, user } = await getAuthenticatedClient(request);
  if (!client || !user) return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });

  const body = await request.json();
  const { planId, risksAndOpportunities, regenerate, orgId, planYear } = body;

  if (!planId) return NextResponse.json({ error: 'planId required' }, { status: 400 });

  // If regenerate requested, force a fresh AI generation
  if (regenerate && orgId && planYear) {
    try {
      // Fetch current plan for context
      const { data: currentPlan } = await client
        .from('transition_plans')
        .select('*')
        .eq('id', planId)
        .single();

      const { data: org } = await client
        .from('organizations')
        .select('name, industry_sector')
        .eq('id', orgId)
        .single();

      let priorityMaterialTopics: string[] = [];
      try {
        const { data: matData } = await client
          .from('materiality_assessments')
          .select('priority_topics')
          .eq('organization_id', orgId)
          .eq('assessment_year', planYear)
          .maybeSingle();
        if (matData?.priority_topics) priorityMaterialTopics = matData.priority_topics;
      } catch { /* non-fatal */ }

      const result = await generateRisksAndOpportunities({
        organisationName: org?.name || 'Organisation',
        sector: org?.industry_sector,
        planYear: currentPlan?.plan_year || planYear,
        baselineYear: currentPlan?.baseline_year || planYear - 1,
        baselineEmissionsTco2e: currentPlan?.baseline_emissions_tco2e ?? null,
        targets: currentPlan?.targets || [],
        milestones: currentPlan?.milestones || [],
        priorityMaterialTopics,
      }, true /* force */);

      const { data: updated, error } = await client
        .from('transition_plans')
        .update({ risks_and_opportunities: result.items, updated_at: new Date().toISOString() })
        .eq('id', planId)
        .select()
        .single();

      if (error) return NextResponse.json({ error: error.message }, { status: 500 });
      return NextResponse.json({ plan: updated });
    } catch (err) {
      console.error('[Transition Plan API] Regeneration failed:', err);
      return NextResponse.json({ error: 'Regeneration failed' }, { status: 500 });
    }
  }

  // Otherwise save user edits directly
  const items = risksAndOpportunities as RiskOpportunity[];
  const { data, error } = await client
    .from('transition_plans')
    .update({ risks_and_opportunities: items, updated_at: new Date().toISOString() })
    .eq('id', planId)
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ plan: data });
}
