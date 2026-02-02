import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/db_types';

/**
 * Get Grace Period Status
 *
 * GET /api/organizations/[id]/grace-period
 *
 * Returns the current grace period status for an organization.
 */

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is a member of the organization
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member) {
      return NextResponse.json({ error: 'Not a member of this organization' }, { status: 403 });
    }

    // Get organization's grace period data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('grace_period_end, grace_period_started_at, subscription_tier, subscription_status')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organization not found' }, { status: 404 });
    }

    // If no grace period, return null
    if (!org.grace_period_end) {
      return NextResponse.json({ grace_period_end: null, subscription_status: org.subscription_status });
    }

    return NextResponse.json({
      grace_period_end: org.grace_period_end,
      grace_period_started_at: org.grace_period_started_at,
      subscription_status: org.subscription_status,
      daysRemaining: Math.max(
        0,
        Math.ceil(
          (new Date(org.grace_period_end).getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        )
      ),
    });
  } catch (error: any) {
    console.error('Error getting grace period:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to get grace period status' },
      { status: 500 }
    );
  }
}

/**
 * Clear Grace Period
 *
 * DELETE /api/organizations/[id]/grace-period
 *
 * Clears the grace period (e.g., when user has reduced usage within limits).
 */

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: organizationId } = await params;
    const cookieStore = await cookies();
    const supabase = createRouteHandlerClient<Database>({ cookies: () => cookieStore });

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Verify user is an admin or owner
    const { data: member, error: memberError } = await supabase
      .from('organization_members')
      .select('role')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .single();

    if (memberError || !member || !['owner', 'admin'].includes(member.role)) {
      return NextResponse.json(
        { error: 'Only owners and admins can clear grace periods' },
        { status: 403 }
      );
    }

    // Clear the grace period
    const { error } = await supabase.rpc('clear_grace_period', {
      p_organization_id: organizationId,
    });

    if (error) {
      console.error('Error clearing grace period:', error);
      return NextResponse.json(
        { error: 'Failed to clear grace period' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error clearing grace period:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to clear grace period' },
      { status: 500 }
    );
  }
}
