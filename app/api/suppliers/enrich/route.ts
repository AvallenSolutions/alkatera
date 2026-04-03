import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/suppliers/enrich
 *
 * Accepts an array of supplier contact emails and returns enriched data
 * from the suppliers table (which is RLS-protected to the supplier's own org).
 * Uses the service role client to bypass RLS.
 *
 * Also returns product counts per supplier.
 *
 * Body: { emails: string[] }
 * Returns: { suppliers: Record<email, { ...fields, product_count }> }
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Verify the caller is authenticated
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const emails: string[] = body.emails;

    if (!Array.isArray(emails) || emails.length === 0) {
      return NextResponse.json({ suppliers: {} });
    }

    // Cap at 100 emails to prevent abuse
    const safeEmails = emails.slice(0, 100);

    // Fetch supplier records by email
    const { data: supplierRecords, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, contact_email, contact_name, name, logo_url, description, country, industry_sector, website, address, city, country_code, lat, lng, phone, catalogue_url')
      .in('contact_email', safeEmails);

    if (supplierError) {
      console.error('Error fetching suppliers:', supplierError);
      return NextResponse.json({ error: 'Failed to fetch supplier data' }, { status: 500 });
    }

    if (!supplierRecords || supplierRecords.length === 0) {
      return NextResponse.json({ suppliers: {} });
    }

    // Fetch active product counts for all resolved suppliers
    const supplierIds = supplierRecords.map(s => s.id);
    const { data: products } = await adminClient
      .from('supplier_products')
      .select('supplier_id')
      .in('supplier_id', supplierIds)
      .eq('is_active', true);

    const countBySupplier = new Map<string, number>();
    if (products) {
      for (const row of products) {
        countBySupplier.set(row.supplier_id, (countBySupplier.get(row.supplier_id) || 0) + 1);
      }
    }

    // Build response keyed by email
    const result: Record<string, any> = {};
    for (const record of supplierRecords) {
      if (record.contact_email) {
        result[record.contact_email] = {
          supplier_id: record.id,
          name: record.name,
          contact_name: record.contact_name,
          logo_url: record.logo_url,
          description: record.description,
          country: record.country,
          industry_sector: record.industry_sector,
          website: record.website,
          address: record.address,
          city: record.city,
          country_code: record.country_code,
          lat: record.lat,
          lng: record.lng,
          phone: record.phone,
          catalogue_url: record.catalogue_url,
          product_count: countBySupplier.get(record.id) || 0,
        };
      }
    }

    return NextResponse.json({ suppliers: result });
  } catch (error: any) {
    console.error('Error in supplier enrich:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
