import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/suppliers/linked-products
 *
 * Returns all active supplier products from suppliers linked to the
 * brand's organisation. Uses the service-role client to bypass RLS
 * (supplier_products are RLS-protected to the supplier's own org).
 *
 * Body: { organization_id: string, category?: 'ingredient' | 'packaging', packaging_category?: string }
 * Returns: { products: Array<SupplierProduct & { supplier_name: string }> }
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
    const organizationId: string = body.organization_id;
    const category: string | undefined = body.category; // 'ingredient' | 'packaging'
    const packagingCategory: string | undefined = body.packaging_category;

    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Step 1: Get platform_supplier_ids linked to this brand org
    const { data: orgSuppliers, error: orgError } = await adminClient
      .from('organization_suppliers')
      .select('platform_supplier_id')
      .eq('organization_id', organizationId);

    if (orgError) {
      console.error('Error fetching org suppliers:', orgError);
      return NextResponse.json({ error: 'Failed to fetch organisation suppliers' }, { status: 500 });
    }

    if (!orgSuppliers || orgSuppliers.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const platformSupplierIds = orgSuppliers.map(s => s.platform_supplier_id).filter(Boolean);
    if (platformSupplierIds.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // Step 2: Get contact emails from platform_suppliers
    const { data: platformSuppliers, error: platformError } = await adminClient
      .from('platform_suppliers')
      .select('id, contact_email')
      .in('id', platformSupplierIds);

    if (platformError) {
      console.error('Error fetching platform suppliers:', platformError);
      return NextResponse.json({ error: 'Failed to fetch platform suppliers' }, { status: 500 });
    }

    const emails = (platformSuppliers || [])
      .map(s => s.contact_email)
      .filter((e): e is string => !!e);

    if (emails.length === 0) {
      return NextResponse.json({ products: [] });
    }

    // Step 3: Resolve suppliers by email match
    const { data: suppliers, error: supplierError } = await adminClient
      .from('suppliers')
      .select('id, name, contact_email, address, city, country, country_code, lat, lng')
      .in('contact_email', emails);

    if (supplierError) {
      console.error('Error fetching suppliers:', supplierError);
      return NextResponse.json({ error: 'Failed to fetch suppliers' }, { status: 500 });
    }

    if (!suppliers || suppliers.length === 0) {
      return NextResponse.json({ products: [] });
    }

    const supplierIds = suppliers.map(s => s.id);
    const supplierNameMap = new Map(suppliers.map(s => [s.id, s.name]));
    const supplierLocationMap = new Map(suppliers.map(s => [s.id, {
      address: s.address,
      city: s.city,
      country: s.country,
      country_code: s.country_code,
      lat: s.lat,
      lng: s.lng,
    }]));

    // Step 4: Fetch active supplier products
    let productQuery = adminClient
      .from('supplier_products')
      .select('*')
      .in('supplier_id', supplierIds)
      .eq('is_active', true);

    if (category) {
      productQuery = productQuery.eq('product_type', category);
    }
    if (packagingCategory) {
      productQuery = productQuery.eq('packaging_category', packagingCategory);
    }

    const { data: products, error: productError } = await productQuery
      .order('name');

    if (productError) {
      console.error('Error fetching supplier products:', productError);
      return NextResponse.json({ error: 'Failed to fetch supplier products' }, { status: 500 });
    }

    // Attach supplier_name and supplier location (as fallback for product origin)
    const enrichedProducts = (products || []).map(product => {
      const supplierLocation = supplierLocationMap.get(product.supplier_id);
      return {
        ...product,
        supplier_name: supplierNameMap.get(product.supplier_id) || 'Unknown Supplier',
        // Supplier-level location as fallback when product doesn't have its own origin
        supplier_address: supplierLocation?.address || null,
        supplier_city: supplierLocation?.city || null,
        supplier_country: supplierLocation?.country || null,
        supplier_country_code: supplierLocation?.country_code || null,
        supplier_lat: supplierLocation?.lat != null ? Number(supplierLocation.lat) : null,
        supplier_lng: supplierLocation?.lng != null ? Number(supplierLocation.lng) : null,
      };
    });

    return NextResponse.json({ products: enrichedProducts });
  } catch (error: any) {
    console.error('Error in linked-products:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
