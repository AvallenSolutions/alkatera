import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

interface SupplierProductSearchResult {
  id: string;
  name: string;
  supplier_name: string;
  category: string | null;
  unit: string;
  product_code: string | null;
  // Legacy carbon field (maintained for backward compatibility)
  carbon_intensity: number | null;
  // Multi-category impacts
  impact_climate: number | null;
  impact_water: number | null;
  impact_waste: number | null;
  impact_land: number | null;
  // GHG breakdown
  ghg_fossil: number | null;
  ghg_biogenic: number | null;
  ghg_land_use_change: number | null;
  // Water breakdown
  water_blue: number | null;
  water_green: number | null;
  water_grey: number | null;
  water_scarcity_factor: number | null;
  // Circularity
  recycled_content_pct: number | null;
  recyclability_pct: number | null;
  circularity_score: number | null;
  // Nature impacts
  terrestrial_ecotoxicity: number | null;
  freshwater_eutrophication: number | null;
  terrestrial_acidification: number | null;
  // Data quality
  data_quality_score: number | null;
  data_confidence_pct: number | null;
  data_source_type: string | null;
  methodology_standard: string | null;
  functional_unit: string | null;
  system_boundary: string | null;
  // Verification
  is_externally_verified: boolean | null;
  verifier_name: string | null;
  // Validity period
  valid_from: string | null;
  valid_until: string | null;
  reference_year: number | null;
  geographic_scope: string | null;
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
    // SEARCH SUPPLIER PRODUCTS ONLY
    // Note: Staging emission factors should NOT be returned by this endpoint
    // They belong in /api/ingredients/search as secondary data
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
        impact_climate,
        impact_water,
        impact_waste,
        impact_land,
        ghg_fossil,
        ghg_biogenic,
        ghg_land_use_change,
        water_blue,
        water_green,
        water_grey,
        water_scarcity_factor,
        recycled_content_pct,
        recyclability_pct,
        circularity_score,
        terrestrial_ecotoxicity,
        freshwater_eutrophication,
        terrestrial_acidification,
        data_quality_score,
        data_confidence_pct,
        data_source_type,
        methodology_standard,
        functional_unit,
        system_boundary,
        is_externally_verified,
        verifier_name,
        valid_from,
        valid_until,
        reference_year,
        geographic_scope,
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
      product_code: product.product_code,
      // Legacy carbon field
      carbon_intensity: product.carbon_intensity,
      // Multi-category impacts
      impact_climate: product.impact_climate,
      impact_water: product.impact_water,
      impact_waste: product.impact_waste,
      impact_land: product.impact_land,
      // GHG breakdown
      ghg_fossil: product.ghg_fossil,
      ghg_biogenic: product.ghg_biogenic,
      ghg_land_use_change: product.ghg_land_use_change,
      // Water breakdown
      water_blue: product.water_blue,
      water_green: product.water_green,
      water_grey: product.water_grey,
      water_scarcity_factor: product.water_scarcity_factor,
      // Circularity
      recycled_content_pct: product.recycled_content_pct,
      recyclability_pct: product.recyclability_pct,
      circularity_score: product.circularity_score,
      // Nature impacts
      terrestrial_ecotoxicity: product.terrestrial_ecotoxicity,
      freshwater_eutrophication: product.freshwater_eutrophication,
      terrestrial_acidification: product.terrestrial_acidification,
      // Data quality
      data_quality_score: product.data_quality_score,
      data_confidence_pct: product.data_confidence_pct,
      data_source_type: product.data_source_type,
      methodology_standard: product.methodology_standard,
      functional_unit: product.functional_unit,
      system_boundary: product.system_boundary,
      // Verification
      is_externally_verified: product.is_externally_verified,
      verifier_name: product.verifier_name,
      // Validity period
      valid_from: product.valid_from,
      valid_until: product.valid_until,
      reference_year: product.reference_year,
      geographic_scope: product.geographic_scope,
      _source: 'supplier_products',
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
