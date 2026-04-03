import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * POST /api/supplier-products/resolve
 *
 * Fetches a single supplier product by ID. Used by the waterfall resolver
 * which needs to read cross-org supplier_products data (RLS-protected to
 * the supplier's own org).
 *
 * Body: { supplier_product_id: string }
 * Returns: { product: SupplierProduct | null }
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
    const supplierProductId: string = body.supplier_product_id;

    if (!supplierProductId) {
      return NextResponse.json({ error: 'supplier_product_id is required' }, { status: 400 });
    }

    const { data: product, error: productError } = await adminClient
      .from('supplier_products')
      .select('*')
      .eq('id', supplierProductId)
      .maybeSingle();

    if (productError) {
      console.error('Error fetching supplier product:', productError);
      return NextResponse.json({ error: 'Failed to fetch supplier product' }, { status: 500 });
    }

    return NextResponse.json({ product: product || null });
  } catch (error: any) {
    console.error('Error in supplier-products resolve:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
