import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

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

    // Get auth token from Authorization header
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized - No token provided' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Create client with the user's access token
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    // Verify the token is valid
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError || !userData?.user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid token' },
        { status: 401 }
      );
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'Organization ID is required' },
        { status: 400 }
      );
    }

    // Verify user has access to the organization
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

    // ========================================
    // WATERFALL STAGE 1: STAGING_EMISSION_FACTORS
    // ========================================
    if (query && query.trim().length > 0) {
      const normalizedQuery = query.trim().toLowerCase();

      const { data: stagingFactors, error: stagingError } = await supabase
        .from('staging_emission_factors')
        .select('*')
        .or(`name.ilike.%${normalizedQuery}%`)
        .in('category', ['Ingredient', 'Packaging'])
        .order('name');

      if (!stagingError && stagingFactors && stagingFactors.length > 0) {
        const stagingResults: SupplierProductSearchResult[] = stagingFactors.map((factor: any) => ({
          id: factor.id,
          name: factor.name,
          supplier_name: 'Internal Proxy Library',
          category: factor.category,
          unit: factor.reference_unit,
          carbon_intensity: factor.co2_factor,
          product_code: `STAGING-${factor.id.substring(0, 8)}`,
          _source: 'staging_emission_factors',
        }));

        // Continue to check supplier products too
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
          .ilike('name', `%${query.trim()}%`)
          .order('name')
          .limit(30);

        const { data: supplierProducts } = await supplierQuery;

        const supplierResults: SupplierProductSearchResult[] = (supplierProducts || []).map((product: any) => ({
          id: product.id,
          name: product.name,
          supplier_name: product.suppliers?.name || 'Unknown Supplier',
          category: product.category,
          unit: product.unit,
          carbon_intensity: product.carbon_intensity,
          product_code: product.product_code,
          _source: 'supplier_products',
        }));

        // Combine: staging factors first (priority), then supplier products
        const combinedResults = [...stagingResults, ...supplierResults];

        return NextResponse.json({
          results: combinedResults,
          count: combinedResults.length,
          waterfall_stage: 1,
          note: 'Staging factors shown first (highest priority), followed by supplier products',
        });
      }
    }

    // ========================================
    // WATERFALL STAGE 2: SUPPLIER_PRODUCTS ONLY
    // ========================================
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
        { error: 'Failed to fetch supplier products', details: error.message },
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
      _source: 'supplier_products',
    }));

    return NextResponse.json({
      results,
      count: results.length,
      waterfall_stage: 2,
    });

  } catch (error) {
    console.error('Error in supplier products search API:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
