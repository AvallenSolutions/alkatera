import { NextRequest, NextResponse } from 'next/server';
import { stripe } from '@/lib/stripe-config';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { getMemberRole } from '../_helpers/get-member-role';

export const dynamic = 'force-dynamic';

/**
 * Billing Details API
 *
 * GET /api/stripe/billing-details?organizationId=xxx
 *   Returns billing details from local DB + Stripe customer
 *
 * PUT /api/stripe/billing-details
 *   Updates billing details locally and syncs to Stripe customer
 */

/**
 * Detect Stripe tax ID type from value format
 */
function detectTaxIdType(value: string, country?: string): string {
  const trimmed = value.trim().toUpperCase();

  // GB VAT: GB + 9 or 12 digits
  if (/^GB\d{9,12}$/.test(trimmed)) return 'gb_vat';

  // EU VAT: 2-letter country code + digits
  if (/^[A-Z]{2}\d{5,}/.test(trimmed)) return 'eu_vat';

  // US EIN: XX-XXXXXXX
  if (/^\d{2}-\d{7}$/.test(trimmed)) return 'us_ein';

  // Australian ABN
  if (/^\d{11}$/.test(trimmed) && country === 'AU') return 'au_abn';

  // Default to EU VAT if we have a country hint
  if (country) {
    const euCountries = ['AT', 'BE', 'BG', 'HR', 'CY', 'CZ', 'DK', 'EE', 'FI', 'FR', 'DE', 'GR', 'HU', 'IE', 'IT', 'LV', 'LT', 'LU', 'MT', 'NL', 'PL', 'PT', 'RO', 'SK', 'SI', 'ES', 'SE'];
    if (euCountries.includes(country.toUpperCase())) return 'eu_vat';
  }

  // Fallback
  return 'eu_vat';
}

export async function GET(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const organizationId = searchParams.get('organizationId');

    if (!organizationId) {
      return NextResponse.json({ error: 'Organisation ID is required' }, { status: 400 });
    }

    // Verify user is a member
    const role = await getMemberRole(supabase, organizationId, user.id);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 });
    }

    // Get organisation data
    const { data: org, error: orgError } = await supabase
      .from('organizations')
      .select('name, billing_email, billing_name, billing_address_line1, billing_address_city, billing_address_country, billing_address_postal_code, tax_id, stripe_customer_id, country')
      .eq('id', organizationId)
      .single();

    if (orgError || !org) {
      return NextResponse.json({ error: 'Organisation not found' }, { status: 404 });
    }

    // Build response from local data
    const billingDetails: Record<string, any> = {
      organisationName: org.name,
      billingEmail: org.billing_email,
      billingName: org.billing_name,
      taxId: org.tax_id,
      address: {
        line1: org.billing_address_line1,
        city: org.billing_address_city,
        country: org.billing_address_country || org.country,
        postalCode: org.billing_address_postal_code,
      },
      stripeConnected: !!org.stripe_customer_id,
    };

    return NextResponse.json({ billingDetails });
  } catch (error: any) {
    console.error('Error fetching billing details:', error);
    return NextResponse.json(
      { error: 'Failed to fetch billing details' },
      { status: 500 }
    );
  }
}

export async function PUT(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, billingEmail, billingName, taxId, address, city, country, postalCode } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'Organisation ID is required' }, { status: 400 });
    }

    // Verify user is admin/owner
    const role = await getMemberRole(supabase, organizationId, user.id);
    if (!role) {
      return NextResponse.json({ error: 'Not a member of this organisation' }, { status: 403 });
    }

    if (role !== 'owner' && role !== 'admin') {
      return NextResponse.json({ error: 'Only admins can update billing details' }, { status: 403 });
    }

    // Update local org record
    const updateData: Record<string, any> = {
      updated_at: new Date().toISOString(),
    };

    if (billingEmail !== undefined) updateData.billing_email = billingEmail || null;
    if (billingName !== undefined) updateData.billing_name = billingName || null;
    if (taxId !== undefined) updateData.tax_id = taxId || null;
    if (address !== undefined) updateData.billing_address_line1 = address || null;
    if (city !== undefined) updateData.billing_address_city = city || null;
    if (country !== undefined) updateData.billing_address_country = country || null;
    if (postalCode !== undefined) updateData.billing_address_postal_code = postalCode || null;

    const { error: updateError } = await supabase
      .from('organizations')
      .update(updateData)
      .eq('id', organizationId);

    if (updateError) {
      console.error('Error updating billing details:', updateError);
      return NextResponse.json({ error: 'Failed to update billing details' }, { status: 500 });
    }

    // Sync to Stripe if customer exists
    const { data: org } = await supabase
      .from('organizations')
      .select('stripe_customer_id')
      .eq('id', organizationId)
      .single();

    if (org?.stripe_customer_id) {
      try {
        // Update Stripe customer
        const stripeUpdate: Record<string, any> = {};
        if (billingEmail) stripeUpdate.email = billingEmail;
        if (billingName) stripeUpdate.name = billingName;

        const addressFields: Record<string, string> = {};
        if (address) addressFields.line1 = address;
        if (city) addressFields.city = city;
        if (country) addressFields.country = country;
        if (postalCode) addressFields.postal_code = postalCode;

        if (Object.keys(addressFields).length > 0) {
          stripeUpdate.address = addressFields;
        }

        if (Object.keys(stripeUpdate).length > 0) {
          await stripe.customers.update(org.stripe_customer_id, stripeUpdate);
        }

        // Sync tax ID if provided
        if (taxId) {
          // Remove existing tax IDs first
          const existingTaxIds = await stripe.customers.listTaxIds(org.stripe_customer_id);
          for (const existing of existingTaxIds.data) {
            await stripe.customers.deleteTaxId(org.stripe_customer_id, existing.id);
          }

          // Add new tax ID
          const taxIdType = detectTaxIdType(taxId, country);
          try {
            await stripe.customers.createTaxId(org.stripe_customer_id, {
              type: taxIdType as any,
              value: taxId,
            });
          } catch (taxError: any) {
            // Tax ID validation may fail - log but don't block the update
            console.error('Failed to sync tax ID to Stripe:', taxError.message);
          }
        }
      } catch (stripeError: any) {
        // Stripe sync is best-effort - local update already succeeded
        console.error('Failed to sync billing details to Stripe:', stripeError.message);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    console.error('Error updating billing details:', error);
    return NextResponse.json(
      { error: 'Failed to update billing details' },
      { status: 500 }
    );
  }
}
