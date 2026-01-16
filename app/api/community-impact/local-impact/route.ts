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

    let query = supabase
      .from('community_local_impact')
      .select('*')
      .order('reporting_year', { ascending: false });

    if (organizationId) {
      query = query.eq('organization_id', organizationId);
    }

    if (year) {
      query = query.eq('reporting_year', parseInt(year));
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching local impact data:', error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Calculate latest metrics
    const latestRecord = data && data.length > 0 ? data[0] : null;
    const metrics = latestRecord ? {
      local_employment_rate: latestRecord.total_employees && latestRecord.local_employees
        ? (latestRecord.local_employees / latestRecord.total_employees) * 100
        : null,
      local_sourcing_rate: latestRecord.total_procurement_spend && latestRecord.local_procurement_spend
        ? (latestRecord.local_procurement_spend / latestRecord.total_procurement_spend) * 100
        : null,
      total_tax_contribution: (latestRecord.corporate_tax_paid || 0) +
        (latestRecord.payroll_taxes_paid || 0) +
        (latestRecord.business_rates_paid || 0),
      community_investment: latestRecord.community_investment_total || 0,
    } : null;

    return NextResponse.json({
      records: data,
      latest: latestRecord,
      metrics,
    });
  } catch (error) {
    console.error('Error in GET /api/community-impact/local-impact:', error);
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

    if (!body.reporting_year) {
      return NextResponse.json(
        { error: 'reporting_year is required' },
        { status: 400 }
      );
    }

    // Insert record
    console.log('[Local Impact API] Attempting to insert record for org:', organizationId);

    const { data, error } = await supabase
      .from('community_local_impact')
      .insert({
        organization_id: body.organization_id || organizationId,
        reporting_year: body.reporting_year,
        reporting_quarter: body.reporting_quarter || null,
        total_employees: body.total_employees,
        local_employees: body.local_employees,
        local_definition: body.local_definition,
        total_procurement_spend: body.total_procurement_spend,
        local_procurement_spend: body.local_procurement_spend,
        local_supplier_count: body.local_supplier_count,
        total_supplier_count: body.total_supplier_count,
        corporate_tax_paid: body.corporate_tax_paid,
        payroll_taxes_paid: body.payroll_taxes_paid,
        business_rates_paid: body.business_rates_paid,
        community_investment_total: body.community_investment_total,
        infrastructure_investment: body.infrastructure_investment,
        notes: body.notes,
      })
      .select()
      .single();

    if (error) {
      console.error('[Local Impact API] Error saving data:', {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      });
      return NextResponse.json({
        error: 'Failed to save local impact data',
        details: error.message,
        code: error.code,
      }, { status: 500 });
    }

    return NextResponse.json(data, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/community-impact/local-impact:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
