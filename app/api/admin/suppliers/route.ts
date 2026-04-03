import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/admin/suppliers
 *
 * Given a platform_supplier ID, returns the linked supplier profile
 * and their actual products (from the supplier_products table).
 *
 * Uses service-role client to bypass RLS on supplier_products.
 *
 * Body: { platform_supplier_id: string }
 * Returns: { supplier: Supplier | null, products: SupplierProduct[] }
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
    const platformSupplierId: string = body.platform_supplier_id;

    if (!platformSupplierId) {
      return NextResponse.json({ error: 'platform_supplier_id is required' }, { status: 400 });
    }

    // Step 1: Get the platform supplier's contact email
    const { data: platformSupplier, error: psError } = await adminClient
      .from('platform_suppliers')
      .select('id, contact_email, name')
      .eq('id', platformSupplierId)
      .maybeSingle();

    if (psError) {
      console.error('Error fetching platform supplier:', psError);
      return NextResponse.json({ error: 'Failed to fetch platform supplier' }, { status: 500 });
    }

    if (!platformSupplier?.contact_email) {
      return NextResponse.json({ supplier: null, products: [] });
    }

    // Step 2: Find the linked supplier by email match
    const { data: supplier, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, name, contact_email, address, city, country, country_code, lat, lng, website, organization_id, user_id, created_at')
      .eq('contact_email', platformSupplier.contact_email)
      .maybeSingle();

    if (supplierError) {
      console.error('Error fetching supplier:', supplierError);
      return NextResponse.json({ error: 'Failed to fetch supplier' }, { status: 500 });
    }

    if (!supplier) {
      return NextResponse.json({ supplier: null, products: [] });
    }

    // Step 3: Fetch all supplier products (active and inactive)
    const { data: products, error: productError } = await adminClient
      .from('supplier_products')
      .select('*')
      .eq('supplier_id', supplier.id)
      .order('name');

    if (productError) {
      console.error('Error fetching supplier products:', productError);
      return NextResponse.json({ error: 'Failed to fetch supplier products' }, { status: 500 });
    }

    return NextResponse.json({
      supplier,
      products: products || [],
    });
  } catch (error: any) {
    console.error('Error in admin suppliers API:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
