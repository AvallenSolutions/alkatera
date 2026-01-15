import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const organizationId = searchParams.get('organization_id');
    const year = searchParams.get('year');
    const donationType = searchParams.get('donation_type');

    let query = supabase
      .from('community_donations')
      .select('*')
      .order('donation_date', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (year) {
      query = query.eq('reporting_year', parseInt(year));
    }

    if (donationType) {
      query = query.eq('donation_type', donationType);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching donations:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate summary metrics
    const donations = data || [];
    const summary = {
      total_donations: donations.length,
      total_cash: donations
        .filter(d => d.donation_type === 'cash')
        .reduce((sum, d) => sum + (d.donation_amount || 0), 0),
      total_in_kind_value: donations
        .filter(d => d.donation_type === 'in_kind')
        .reduce((sum, d) => sum + (d.estimated_value || 0), 0),
      total_hours: donations.reduce((sum, d) => sum + (d.hours_donated || 0), 0),
      total_beneficiaries: donations.reduce((sum, d) => sum + (d.beneficiaries_count || 0), 0),
      by_type: {
        cash: donations.filter(d => d.donation_type === 'cash').length,
        in_kind: donations.filter(d => d.donation_type === 'in_kind').length,
        time: donations.filter(d => d.donation_type === 'time').length,
        pro_bono: donations.filter(d => d.donation_type === 'pro_bono').length,
      },
      by_cause: donations.reduce((acc, d) => {
        if (d.recipient_cause) {
          acc[d.recipient_cause] = (acc[d.recipient_cause] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>),
    };

    return NextResponse.json({
      donations: data,
      summary,
    });
  } catch (error) {
    console.error('Error in GET /api/community-impact/donations:', error);
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

    if (!body.donation_name || !body.donation_type || !body.recipient_name) {
      return NextResponse.json(
        { error: 'donation_name, donation_type, and recipient_name are required' },
        { status: 400 }
      );
    }

    const { data, error } = await supabase
      .from('community_donations')
      .insert({
        organization_id: body.organization_id || organizationId,
        donation_name: body.donation_name,
        donation_type: body.donation_type,
        description: body.description,
        recipient_name: body.recipient_name,
        recipient_type: body.recipient_type,
        recipient_registration_number: body.recipient_registration_number,
        recipient_cause: body.recipient_cause,
        donation_amount: body.donation_amount,
        currency: body.currency || 'GBP',
        estimated_value: body.estimated_value,
        hours_donated: body.hours_donated,
        donation_date: body.donation_date,
        reporting_year: body.reporting_year || new Date().getFullYear(),
        beneficiaries_count: body.beneficiaries_count,
        impact_description: body.impact_description,
        evidence_url: body.evidence_url,
        receipt_reference: body.receipt_reference,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating donation:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community-impact/donations:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
