import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/suppliers/detail
 *
 * Given a supplier contact email, returns full detail data for the brand
 * detail page: supplier profile, products, and ESG assessment.
 *
 * Uses the service role client to bypass RLS (the suppliers, supplier_products,
 * and supplier_esg_assessments tables are all RLS-protected to the supplier's
 * own org, so brand users can't read them directly).
 *
 * Body: { email: string }
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
    const email: string = body.email;

    if (!email) {
      return NextResponse.json({ supplier: null, products: [], esg_assessment: null });
    }

    // Fetch the supplier record
    const { data: supplierRecord, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, contact_email, contact_name, name, logo_url, description, country, industry_sector, website, address, city, country_code, lat, lng, phone, catalogue_url')
      .eq('contact_email', email)
      .maybeSingle();

    if (supplierError) {
      console.error('Error fetching supplier:', supplierError);
      return NextResponse.json({ error: 'Failed to fetch supplier data' }, { status: 500 });
    }

    if (!supplierRecord) {
      return NextResponse.json({ supplier: null, products: [], esg_assessment: null });
    }

    // Fetch products and ESG assessment in parallel
    const [productsResult, esgResult] = await Promise.all([
      adminClient
        .from('supplier_products')
        .select('*')
        .eq('supplier_id', supplierRecord.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false }),
      adminClient
        .from('supplier_esg_assessments')
        .select('*')
        .eq('supplier_id', supplierRecord.id)
        .maybeSingle(),
    ]);

    return NextResponse.json({
      supplier: {
        supplier_id: supplierRecord.id,
        name: supplierRecord.name,
        contact_email: supplierRecord.contact_email,
        contact_name: supplierRecord.contact_name,
        logo_url: supplierRecord.logo_url,
        description: supplierRecord.description,
        country: supplierRecord.country,
        industry_sector: supplierRecord.industry_sector,
        website: supplierRecord.website,
        address: supplierRecord.address,
        city: supplierRecord.city,
        country_code: supplierRecord.country_code,
        lat: supplierRecord.lat,
        lng: supplierRecord.lng,
        phone: supplierRecord.phone,
        catalogue_url: supplierRecord.catalogue_url,
      },
      products: productsResult.data || [],
      esg_assessment: esgResult.data || null,
    });
  } catch (error: any) {
    console.error('Error in supplier detail:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
