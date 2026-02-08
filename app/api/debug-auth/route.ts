import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

/**
 * GET /api/debug-auth
 * Debug endpoint to check authentication status and organisation membership
 */
export async function GET(request: NextRequest) {
  // Only available in development — disabled in production
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  try {
    const supabase = getSupabaseServerClient();

    // Get authenticated user
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError) {
      return NextResponse.json({
        authenticated: false,
        error: 'Authentication error',
        details: authError.message
      }, { status: 401 });
    }

    if (!user) {
      return NextResponse.json({
        authenticated: false,
        error: 'No user found',
        message: 'User is not authenticated'
      }, { status: 401 });
    }

    // Get user's profile
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .maybeSingle();

    // Get user's organisation membership
    const { data: membership, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, joined_at')
      .eq('user_id', user.id)
      .maybeSingle();

    // If membership exists, get organisation details
    let organisation = null;
    let organisationError = null;
    if (membership?.organization_id) {
      const { data: org, error: orgError } = await supabase
        .from('organizations')
        .select('id, name, slug, industry, subscription_tier, created_at')
        .eq('id', membership.organization_id)
        .maybeSingle();

      organisation = org;
      organisationError = orgError;
    }

    // Get all memberships (in case user has multiple)
    const { data: allMemberships, error: allMembershipsError } = await supabase
      .from('organization_members')
      .select('organization_id, role, joined_at')
      .eq('user_id', user.id);

    return NextResponse.json({
      authenticated: true,
      user: {
        id: user.id,
        email: user.email,
        email_confirmed: user.email_confirmed_at ? true : false,
        created_at: user.created_at,
        last_sign_in: user.last_sign_in_at,
      },
      profile: profile || null,
      profileError: profileError?.message || null,
      membership: membership || null,
      membershipError: memberError?.message || null,
      organisation: organisation || null,
      organisationError: organisationError?.message || null,
      allMemberships: allMemberships || [],
      allMembershipsError: allMembershipsError?.message || null,
      totalMemberships: allMemberships?.length || 0,
    }, { status: 200 });

  } catch (error) {
    console.error('Debug auth API error:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
