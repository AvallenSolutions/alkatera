import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

type Recurrence = {
  frequency?: 'weekly' | 'biweekly' | 'monthly' | 'quarterly';
  end_date?: string;
};

const MAX_OCCURRENCES = 120;

/**
 * Expand a start date + recurrence rule into an array of ISO date strings
 * (YYYY-MM-DD). Returns [startDate] when there's no recurrence. Returns
 * null if the rule is malformed.
 */
function buildOccurrenceDates(
  startDate: string | undefined,
  recurrence: Recurrence | undefined | null,
): string[] | null {
  if (!startDate) return null;
  const start = new Date(`${startDate}T00:00:00Z`);
  if (Number.isNaN(start.getTime())) return null;

  if (!recurrence?.frequency || !recurrence.end_date) {
    return [formatISODate(start)];
  }

  const end = new Date(`${recurrence.end_date}T00:00:00Z`);
  if (Number.isNaN(end.getTime()) || end < start) return null;

  const dates: string[] = [];
  const cursor = new Date(start);
  while (cursor <= end && dates.length < MAX_OCCURRENCES) {
    dates.push(formatISODate(cursor));
    switch (recurrence.frequency) {
      case 'weekly':
        cursor.setUTCDate(cursor.getUTCDate() + 7);
        break;
      case 'biweekly':
        cursor.setUTCDate(cursor.getUTCDate() + 14);
        break;
      case 'monthly':
        cursor.setUTCMonth(cursor.getUTCMonth() + 1);
        break;
      case 'quarterly':
        cursor.setUTCMonth(cursor.getUTCMonth() + 3);
        break;
      default:
        return null;
    }
  }
  return dates;
}

function formatISODate(d: Date): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, '0');
  const day = String(d.getUTCDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const year = searchParams.get('year');

    let query = supabase
      .from('community_volunteer_activities')
      .select('*')
      .order('activity_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (year) {
      const startDate = `${year}-01-01`;
      const endDate = `${year}-12-31`;
      query = query.gte('activity_date', startDate).lte('activity_date', endDate);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching volunteer activities:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    // Calculate summary metrics
    const activities = data || [];
    const summary = {
      total_activities: activities.length,
      total_volunteer_hours: activities.reduce((sum, a) => sum + (a.total_volunteer_hours || 0), 0),
      total_participants: activities.reduce((sum, a) => sum + (a.participant_count || 0), 0),
      total_beneficiaries: activities.reduce((sum, a) => sum + (a.beneficiaries_reached || 0), 0),
      paid_time_activities: activities.filter(a => a.is_paid_time).length,
      by_type: {
        team_volunteering: activities.filter(a => a.activity_type === 'team_volunteering').length,
        individual: activities.filter(a => a.activity_type === 'individual').length,
        skills_based: activities.filter(a => a.activity_type === 'skills_based').length,
        board_service: activities.filter(a => a.activity_type === 'board_service').length,
      },
    };

    return NextResponse.json({
      activities: data,
      summary,
    });
  } catch (error) {
    console.error('Error in GET /api/community-impact/volunteering:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get user's current organization from metadata or first membership
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      const { data: membership, error: memberError } = await supabase
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .maybeSingle();

      if (memberError || !membership) {
        return NextResponse.json({ error: 'No organization found' }, { status: 403 });
      }
      organizationId = membership.organization_id;
    }

    const body = await request.json();

    if (!body.activity_name || !body.activity_type) {
      return NextResponse.json(
        { error: 'activity_name and activity_type are required' },
        { status: 400 }
      );
    }

    const validTypes = ['team_volunteering', 'individual', 'skills_based', 'board_service'];
    if (!validTypes.includes(body.activity_type)) {
      return NextResponse.json(
        { error: `activity_type must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      );
    }

    // Accept total_volunteer_hours directly, or calculate from duration_hours * participant_count
    const participantCount = body.participant_count || 1;
    const totalHours = body.total_volunteer_hours
      ? Number(body.total_volunteer_hours)
      : (body.duration_hours || 0) * participantCount;
    const durationHours = body.duration_hours
      ? Number(body.duration_hours)
      : participantCount > 0 ? totalHours / participantCount : totalHours;

    const occurrenceDates = buildOccurrenceDates(body.activity_date, body.recurrence);

    if (!occurrenceDates) {
      return NextResponse.json(
        { error: 'Invalid recurrence settings' },
        { status: 400 }
      );
    }

    const isRecurring = occurrenceDates.length > 1;
    const seriesId = isRecurring
      ? (typeof crypto !== 'undefined' && 'randomUUID' in crypto
          ? crypto.randomUUID()
          : null)
      : null;

    const baseRow = {
      organization_id: body.organization_id || organizationId,
      activity_name: body.activity_name,
      activity_type: body.activity_type,
      description: body.description || null,
      partner_organization: body.partner_organization || null,
      partner_cause: body.partner_cause || null,
      duration_hours: durationHours,
      participant_count: participantCount,
      total_volunteer_hours: totalHours,
      beneficiaries_reached: body.beneficiaries_reached || null,
      impact_description: body.impact_description || null,
      is_paid_time: body.is_paid_time || false,
      volunteer_policy_hours: body.volunteer_policy_hours || null,
      evidence_url: body.evidence_url || null,
      location: body.location || null,
      photo_urls: body.photo_urls || [],
      series_id: seriesId,
    };

    const rows = occurrenceDates.map(date => ({ ...baseRow, activity_date: date }));

    const { data, error } = await supabase
      .from('community_volunteer_activities')
      .insert(rows)
      .select();

    if (error) {
      console.error('Error creating volunteer activity:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json(
      {
        activities: data,
        created: data?.length ?? 0,
        series_id: seriesId,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error('Error in POST /api/community-impact/volunteering:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const id = searchParams.get('id');
    const seriesId = searchParams.get('series_id');

    if (!id && !seriesId) {
      return NextResponse.json({ error: 'id or series_id is required' }, { status: 400 });
    }

    let query = supabase.from('community_volunteer_activities').delete();
    if (seriesId) {
      query = query.eq('series_id', seriesId);
    } else if (id) {
      query = query.eq('id', id);
    }

    const { error } = await query;
    if (error) {
      console.error('Error deleting volunteer activity:', error);
      return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error in DELETE /api/community-impact/volunteering:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
