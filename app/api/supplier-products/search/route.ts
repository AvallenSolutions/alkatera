import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

export const dynamic = 'force-dynamic';

interface SupplierProductSearchResult {
  id: string;
  name: string;
  supplier_name: string;
  category: string | null;
  unit: string;
  carbon_intensity: number | null;
  product_code: string | null;
}

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get('q');
    const organizationId = searchParams.get('organization_id');

    const supabase = getSupabaseServerClient();

    const { data: userData } = await supabase.auth.getUser();
    if (!userData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    const { data: membership } = await supabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', userData.user.id)
      .eq('organization_id', organizationId)
      .maybeSingle();

    if (!membership) {
      return NextResponse.json(
        { error: 'Not authorized to access this organization' },
        { status: 403 }
      );
    }

    let supplierQuery = supabase
      .from('supplier_products')
      .select(`
        id,
        name,
        category,
        unit,
        carbon_intensity,
        product_code,
        suppliers!inner(
          name
        )
      `)
      .eq('organization_id', organizationId)
      .eq('is_active', true)
      .order('name');

    if (query && query.trim().length > 0) {
      supplierQuery = supplierQuery.ilike('name', `%${query.trim()}%`);
    }

    const { data: supplierProducts, error } = await supplierQuery.limit(50);

    if (error) {
      console.error('Error fetching supplier products:', error);
      return NextResponse.json(
        { error: 'Failed to fetch supplier products' },
        { status: 500 }
      );
    }

    const results: SupplierProductSearchResult[] = (supplierProducts || []).map((product: any) => ({
      id: product.id,
      name: product.name,
      supplier_name: product.suppliers?.name || 'Unknown Supplier',
      category: product.category,
      unit: product.unit,
      carbon_intensity: product.carbon_intensity,
      product_code: product.product_code,
    }));

    return NextResponse.json({
      results,
      count: results.length,
    });

  } catch (error) {
    console.error('Error in supplier products search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
