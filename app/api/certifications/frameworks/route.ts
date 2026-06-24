import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

// Transform database framework to API format expected by UI
function transformFramework(dbFramework: any) {
  return {
    id: dbFramework.id,
    name: dbFramework.name || dbFramework.framework_name,
    code: dbFramework.code || dbFramework.framework_code,
    version: dbFramework.version || dbFramework.framework_version,
    description: dbFramework.description,
    category: dbFramework.category || 'General',
    passing_score: dbFramework.passing_score,
    total_points: dbFramework.total_points || 0,
    is_active: dbFramework.is_active,
    display_order: dbFramework.display_order || 0,
    governing_body: dbFramework.governing_body,
    website_url: dbFramework.website_url,
    scoring_model: dbFramework.scoring_model || 'points',
    progression_model: dbFramework.progression_model || null,
    requirements: (dbFramework.requirements || []).map((req: any) => ({
      id: req.id,
      framework_id: req.framework_id,
      requirement_code: req.requirement_code,
      requirement_name: req.requirement_name,
      description: req.description,
      category: req.requirement_category,
      sub_category: req.subsection || req.section,
      points_available: req.points_available || req.max_points || 0,
      is_required: req.is_required || req.is_mandatory || false,
      guidance: req.guidance || req.examples,
      data_sources: req.data_sources || req.required_data_sources || [],
      applicable_from_year: req.applicable_from_year ?? 0,
      size_threshold: req.size_threshold || 'all',
      topic_area: req.topic_area || null,
    })),
  };
}

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const activeOnly = searchParams.get('active_only') === 'true';

    // Get all frameworks (no PostgREST relationship joins - schema cache unreliable)
    let frameworksQuery = supabase
      .from('certification_frameworks')
      .select('*')
      .neq('framework_code', 'ecovadis')
      .order('framework_name', { ascending: true });

    if (activeOnly) {
      frameworksQuery = frameworksQuery.eq('is_active', true);
    }

    const { data: rawFrameworks, error: frameworksError } = await frameworksQuery;

    if (frameworksError) {
      console.error('Error fetching frameworks:', frameworksError);
      return NextResponse.json({ error: frameworksError.message }, { status: 500 });
    }

    // Fetch requirements from both tables (legacy frameworks use framework_requirements,
    // newer frameworks like B Corp 2026 use certification_framework_requirements)
    const fwIds = (rawFrameworks || []).map((f: any) => f.id);
    let requirementsByFramework: Record<string, any[]> = {};
    if (fwIds.length > 0) {
      const [{ data: reqs1 }, { data: reqs2 }] = await Promise.all([
        supabase
          .from('framework_requirements')
          .select('*')
          .in('framework_id', fwIds)
          .order('order_index', { ascending: true }),
        supabase
          .from('certification_framework_requirements')
          .select('*')
          .in('framework_id', fwIds)
          .order('order_index', { ascending: true }),
      ]);

      // Index framework_requirements
      (reqs1 || []).forEach((req: any) => {
        if (!requirementsByFramework[req.framework_id]) {
          requirementsByFramework[req.framework_id] = [];
        }
        requirementsByFramework[req.framework_id].push(req);
      });

      // Add certification_framework_requirements only for frameworks that
      // had no entries in framework_requirements (avoids duplicates)
      const fwIdsWithReqs = new Set(Object.keys(requirementsByFramework));
      (reqs2 || []).forEach((req: any) => {
        if (!fwIdsWithReqs.has(req.framework_id)) {
          if (!requirementsByFramework[req.framework_id]) {
            requirementsByFramework[req.framework_id] = [];
          }
          requirementsByFramework[req.framework_id].push(req);
        }
      });
    }

    // Merge requirements into frameworks
    const frameworks = (rawFrameworks || []).map((f: any) => ({
      ...f,
      requirements: requirementsByFramework[f.id] || [],
    }));

    // Transform frameworks to expected format
    const transformedFrameworks = (frameworks || []).map(transformFramework);

    // If organization_id provided, also get their certification status.
    // We only return certs whose framework is still active — without this
    // filter, orphan rows pointing at deactivated frameworks (e.g. the
    // legacy "bcorp_21" B Corp standard that was superseded by "bcorp_2026")
    // show up in counts and progress widgets without appearing in the
    // framework picker, which made the page report "4 in progress" while
    // only rendering 3 cards.
    let certifications = null;
    if (organizationId) {
      // Resolve the set of active framework IDs from the frameworks we
      // already loaded above. activeFrameworkIds is null when the caller
      // didn't pass active_only=true, in which case we return everything.
      const activeFrameworkIds = activeOnly
        ? new Set((rawFrameworks || []).map((f: any) => f.id))
        : null;

      const { data: orgCertifications, error: certError } = await supabase
        .from('organization_certifications')
        .select('*')
        .eq('organization_id', organizationId);

      if (certError) {
        console.error('Error fetching org certifications:', certError);
      } else {
        const filtered = activeFrameworkIds
          ? (orgCertifications || []).filter((c: any) => activeFrameworkIds.has(c.framework_id))
          : (orgCertifications || []);
        // Transform certifications to expected format
        certifications = filtered.map((cert: any) => ({
          id: cert.id,
          organization_id: cert.organization_id,
          framework_id: cert.framework_id,
          status: cert.status,
          target_date: cert.target_date,
          certification_date: cert.certified_date || cert.certification_date,
          expiry_date: cert.expiry_date,
          certificate_number: cert.certification_number || cert.certificate_number,
          current_score: cert.readiness_score || cert.current_score || cert.score_achieved,
          current_year: cert.current_year ?? 0,
        }));
      }
    }

    return NextResponse.json({
      frameworks: transformedFrameworks,
      certifications,
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/frameworks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const denied = await denyReadOnlyAdvisor(supabase, user, organizationId);
    if (denied) return denied;

    const body = await request.json();

    if (!body.framework_id) {
      return NextResponse.json(
        { error: 'framework_id is required' },
        { status: 400 }
      );
    }

    // Build the payload. Only verified org is used, never body.organization_id.
    const payload: Record<string, unknown> = {
      organization_id: organizationId,
      framework_id: body.framework_id,
      status: body.status || 'not_started',
      target_date: body.target_date,
      certified_date: body.certification_date || body.certified_date,
      expiry_date: body.expiry_date,
      certification_number:
        body.certificate_number || body.certification_number,
      readiness_score: body.current_score || body.readiness_score,
      notes: body.notes,
    };
    if (body.certification_type !== undefined) {
      payload.certification_type = body.certification_type;
    }
    if (body.certification_start_date !== undefined) {
      payload.certification_start_date = body.certification_start_date;
    }
    if (body.ecgt_applicable !== undefined) {
      payload.ecgt_applicable = body.ecgt_applicable;
    }
    if (body.previous_bia_score !== undefined) {
      payload.previous_bia_score = body.previous_bia_score;
    }

    // Avoid duplicate cert rows: update the existing row for this
    // org + framework if one already exists, otherwise insert.
    const { data: existing } = await supabase
      .from('organization_certifications')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('framework_id', body.framework_id)
      .maybeSingle();

    const { data, error } = existing
      ? await supabase
          .from('organization_certifications')
          .update(payload)
          .eq('id', existing.id)
          .select()
          .single()
      : await supabase
          .from('organization_certifications')
          .insert(payload)
          .select()
          .single();

    if (error) {
      console.error('[Certifications API] Error saving data:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({
        error: 'Failed to save certification data',
        details: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/certifications/frameworks:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
