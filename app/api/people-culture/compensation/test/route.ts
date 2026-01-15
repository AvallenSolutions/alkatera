import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/people-culture/compensation/test
 * Test endpoint to diagnose authentication and RLS issues
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    const diagnostics: any = {
      timestamp: new Date().toISOString(),
      auth: {
        hasUser: !!user,
        userId: user?.id,
        email: user?.email,
        authError: authError?.message,
        metadata: user?.user_metadata,
      },
      membership: null,
      rlsTest: null,
    };

    if (!user) {
      return NextResponse.json({
        ...diagnostics,
        error: 'No authenticated user found',
      }, { status: 200 });
    }

    // Check organization membership
    const { data: memberships, error: memberError } = await supabase
      .from('organization_members')
      .select('organization_id, role, organizations(name)')
      .eq('user_id', user.id);

    diagnostics.membership = {
      memberships,
      count: memberships?.length || 0,
      error: memberError?.message,
    };

    // Test if we can insert (will fail but shows RLS error)
    const testOrgId = memberships?.[0]?.organization_id;
    if (testOrgId) {
      const { data: testInsert, error: insertError } = await supabase
        .from('people_employee_compensation')
        .insert({
          organization_id: testOrgId,
          created_by: user.id,
          employment_type: 'full_time',
          annual_salary: 50000,
          reporting_year: 2026,
        })
        .select()
        .single();

      diagnostics.rlsTest = {
        attempted: true,
        success: !!testInsert,
        error: insertError?.message,
        errorCode: insertError?.code,
        errorDetails: insertError?.details,
        errorHint: insertError?.hint,
      };

      // If successful, delete the test record
      if (testInsert) {
        await supabase
          .from('people_employee_compensation')
          .delete()
          .eq('id', testInsert.id);
      }
    }

    return NextResponse.json(diagnostics, { status: 200 });
  } catch (error) {
    console.error('Diagnostic API error:', error);
    return NextResponse.json({
      error: 'An unexpected error occurred',
      details: error instanceof Error ? error.message : String(error),
    }, { status: 500 });
  }
}
