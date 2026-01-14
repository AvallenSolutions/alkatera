import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import type { Database } from '@/types/db_types';

/**
 * Check Downgrade Limits
 *
 * POST /api/stripe/check-downgrade-limits
 *
 * Checks if a downgrade would exceed the new tier's limits and returns
 * details about which resources are over limit.
 */

export async function POST(request: NextRequest) {
  try {
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

    const body = await request.json();
    const { organizationId, newTier } = body;

    if (!organizationId || !newTier) {
      return NextResponse.json(
        { error: 'Organization ID and new tier are required' },
        { status: 400 }
      );
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

    // Call the database function to check downgrade limits
    const { data: limits, error: limitsError } = await supabase.rpc('check_downgrade_limits', {
      p_organization_id: organizationId,
      p_new_tier: newTier,
    });

    if (limitsError) {
      console.error('Error checking downgrade limits:', limitsError);
      return NextResponse.json(
        { error: 'Failed to check downgrade limits' },
        { status: 500 }
      );
    }

    // Process the results
    const overLimitResources = limits.filter((l: any) => l.over_limit);
    const hasOverLimit = overLimitResources.length > 0;

    return NextResponse.json({
      hasOverLimit,
      resources: limits.map((l: any) => ({
        resourceType: l.resource_type,
        currentUsage: l.current_usage,
        newLimit: l.new_limit,
        overLimit: l.over_limit,
        excessCount: l.excess_count,
      })),
      overLimitResources: overLimitResources.map((l: any) => ({
        resourceType: l.resource_type,
        currentUsage: l.current_usage,
        newLimit: l.new_limit,
        excessCount: l.excess_count,
      })),
      gracePeriodRequired: hasOverLimit,
      gracePeriodDays: 7,
    });
  } catch (error: any) {
    console.error('Error checking downgrade limits:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to check downgrade limits' },
      { status: 500 }
    );
  }
}
