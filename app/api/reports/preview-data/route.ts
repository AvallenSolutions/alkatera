import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Preview Data Availability Check
 *
 * POST /api/reports/preview-data
 *
 * Lightweight DB check: returns a data availability map for each section
 * so the report builder preview panel can show green/amber/grey dots.
 *
 * Body: { organizationId: string, reportYear: number, sections: string[] }
 * Auth: Bearer token header
 *
 * Returns: { availability: Record<sectionId, 'available' | 'partial' | 'unavailable'>, summary: {...} }
 */

export const runtime = 'nodejs';
export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, reportYear, sections } = body as {
      organizationId: string;
      reportYear: number;
      sections: string[];
    };

    if (!organizationId || !reportYear) {
      return NextResponse.json({ error: 'organizationId and reportYear are required' }, { status: 400 });
    }

    // Run all availability checks in parallel
    const [
      corpReport,
      products,
      facilities,
      suppliers,
      peopleCulture,
      governance,
      communityImpact,
      materiality,
      transitionPlan,
    ] = await Promise.all([
      supabase
        .from('corporate_reports')
        .select('id, total_emissions')
        .eq('organization_id', organizationId)
        .eq('report_year', reportYear)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),

      supabase
        .from('product_carbon_footprints')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('status', 'completed'),

      supabase
        .from('facilities')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),

      supabase
        .from('supplier_relationships')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId),

      supabase
        .from('people_culture_data')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportYear),

      supabase
        .from('governance_data')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportYear),

      supabase
        .from('community_impact_data')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('reporting_year', reportYear),

      supabase
        .from('materiality_assessments')
        .select('id, completed_at')
        .eq('organization_id', organizationId)
        .eq('assessment_year', reportYear)
        .maybeSingle(),

      supabase
        .from('transition_plans')
        .select('id, targets, milestones, risks_and_opportunities')
        .eq('organization_id', organizationId)
        .eq('plan_year', reportYear)
        .maybeSingle(),
    ]);

    const hasEmissions = !!(corpReport.data && corpReport.data.total_emissions > 0);
    const hasProducts = (products.count ?? 0) > 0;
    const hasFacilities = (facilities.count ?? 0) > 0;
    const hasSuppliers = (suppliers.count ?? 0) > 0;
    const hasPeopleCulture = (peopleCulture.count ?? 0) > 0;
    const hasGovernance = (governance.count ?? 0) > 0;
    const hasCommunityImpact = (communityImpact.count ?? 0) > 0;
    const hasMaterialityComplete = !!materiality.data?.completed_at;
    const hasMaterialityStarted = !!materiality.data;
    const tp = transitionPlan.data as any;
    const hasTransitionPlan = !!tp;
    const hasTargets = hasTransitionPlan && (tp?.targets?.length ?? 0) > 0;
    const hasMilestones = hasTransitionPlan && (tp?.milestones?.length ?? 0) > 0;
    const hasRisks = hasTransitionPlan && (tp?.risks_and_opportunities?.length ?? 0) > 0;

    const sectionAvailability: Record<string, 'available' | 'partial' | 'unavailable'> = {
      'executive-summary': hasEmissions ? 'available' : 'partial',
      'company-overview': 'available',
      'scope-1-2-3': hasEmissions ? 'available' : 'unavailable',
      'ghg-inventory': hasEmissions ? 'available' : 'unavailable',
      'carbon-origin': hasEmissions ? 'partial' : 'unavailable',
      'flag-removals': hasEmissions ? 'partial' : 'unavailable',
      'tnfd-nature': 'partial',
      'product-footprints': hasProducts ? 'available' : 'unavailable',
      'multi-capital': hasProducts ? 'partial' : 'unavailable',
      'impact-valuation': hasEmissions ? 'partial' : 'unavailable',
      'people-culture': hasPeopleCulture ? 'available' : 'unavailable',
      'governance': hasGovernance ? 'available' : 'unavailable',
      'community-impact': hasCommunityImpact ? 'available' : 'unavailable',
      'supply-chain': hasSuppliers ? 'available' : 'unavailable',
      'facilities': hasFacilities ? 'available' : 'unavailable',
      'key-findings': hasEmissions ? 'available' : 'unavailable',
      'trends': hasEmissions ? 'partial' : 'unavailable',
      'targets': hasTargets ? 'available' : 'unavailable',
      'transition-roadmap': hasMilestones ? 'available' : hasTransitionPlan ? 'partial' : 'unavailable',
      'risks-and-opportunities': hasRisks ? 'available' : hasTransitionPlan ? 'partial' : 'unavailable',
      'methodology': hasEmissions ? 'available' : 'partial',
      'regulatory': hasMaterialityComplete ? 'available' : hasMaterialityStarted ? 'partial' : 'unavailable',
      'appendix': hasEmissions ? 'available' : 'partial',
    };

    // Filter to only the requested sections
    const availability: Record<string, 'available' | 'partial' | 'unavailable'> = {};
    for (const sectionId of (sections?.length ? sections : Object.keys(sectionAvailability))) {
      availability[sectionId] = sectionAvailability[sectionId] ?? 'unavailable';
    }

    return NextResponse.json({
      availability,
      summary: {
        hasEmissions,
        hasProducts,
        hasFacilities,
        hasSuppliers,
        hasPeopleCulture,
        hasGovernance,
        hasCommunityImpact,
        hasMaterialityComplete,
        hasTransitionPlan,
      },
    });
  } catch (error: any) {
    console.error('[preview-data] Error:', error);
    return NextResponse.json({ error: 'Failed to check data availability' }, { status: 500 });
  }
}
