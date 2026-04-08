import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Materiality Assessment API
 *
 * GET  /api/materiality?year=2025 — fetch the assessment for the current org and year
 * POST /api/materiality            — upsert an assessment (create or update)
 *
 * Authentication: Bearer token (Supabase session)
 */

export const runtime = 'nodejs';

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
  if (!client || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const year = parseInt(searchParams.get('year') || String(new Date().getFullYear()), 10);
  const orgId = searchParams.get('orgId');

  if (!orgId) return NextResponse.json({ error: 'orgId required' }, { status: 400 });

  const { data, error } = await client
    .from('materiality_assessments')
    .select('*')
    .eq('organization_id', orgId)
    .eq('assessment_year', year)
    .maybeSingle();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assessment: data });
}

export async function POST(request: NextRequest) {
  const { client, user } = await getAuthenticatedClient(request);
  if (!client || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const body = await request.json();
  const { orgId, assessmentYear, topics, priorityTopics, completedAt } = body;

  if (!orgId || !assessmentYear) {
    return NextResponse.json({ error: 'orgId and assessmentYear required' }, { status: 400 });
  }

  const payload = {
    organization_id: orgId,
    assessment_year: assessmentYear,
    topics: topics || [],
    priority_topics: priorityTopics || [],
    completed_at: completedAt || null,
    created_by: user.id,
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await client
    .from('materiality_assessments')
    .upsert(payload, { onConflict: 'organization_id,assessment_year' })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ assessment: data });
}
