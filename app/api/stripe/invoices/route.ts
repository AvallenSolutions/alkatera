import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-config';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '../_helpers/get-member-role';

export const dynamic = 'force-dynamic';

/**
 * Get Invoices from Stripe
 *
 * GET /api/stripe/invoices?organizationId=xxx
 *
 * Returns the invoice history for an organisation directly from Stripe.
 */

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Verify authentication
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');
    const limit = parseInt(searchParams.get('limit') || '50', 10);

    if (!organizationId) {
      return NextResponse.json({ error: 'Organisation ID is required' }, { status: 400 });
    }

    // Verify user is a member of the organisation
    const role = await getMemberRole(supabase, organizationId, user.id);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 });
    }

    // Get organisation's Stripe customer ID
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    if (!org.stripe_customer_id) {
      return NextResponse.json({ invoices: [] });
    }

    // Fetch invoices from Stripe
    const stripeInvoices = await stripe.invoices.list({
      customer: org.stripe_customer_id,
      limit: Math.min(limit, 100),
    });

    const invoices = stripeInvoices.data.map((invoice) => ({
      id: invoice.id,
      created: invoice.created,
      number: invoice.number,
      status: invoice.status,
      amount_paid: invoice.amount_paid,
      amount_due: invoice.amount_due,
      currency: invoice.currency,
      invoice_pdf: invoice.invoice_pdf,
      hosted_invoice_url: invoice.hosted_invoice_url,
      period_start: invoice.period_start,
      period_end: invoice.period_end,
    }));

    return NextResponse.json({ invoices });
  } catch (error: any) {
    console.error('Error fetching invoices:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to fetch invoices' },
      { status: 500 }
    );
  }
}
