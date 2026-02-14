import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import type {
  ParsedProduct,
  ParsedIngredient,
  ParsedPackaging,
  ParsedPackagingComponent,
} from '@/lib/bulk-import/types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey);
}

async function getAuthenticatedUser() {
  const cookieStore = cookies();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }); } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }); } catch {}
      },
    },
  });

  const { data: { user }, error } = await authClient.auth.getUser();
  if (error || !user) return null;
  return user;
}

/** Map component material type to the aggregated weight column */
function getComponentWeightColumn(material: string): string | null {
  const map: Record<string, string> = {
    glass: 'component_glass_weight',
    aluminium: 'component_aluminium_weight',
    aluminum: 'component_aluminium_weight',
    steel: 'component_steel_weight',
    paper_cardboard: 'component_paper_weight',
    paper: 'component_paper_weight',
    cardboard: 'component_paper_weight',
    wood: 'component_wood_weight',
  };
  return map[material] || 'component_other_weight';
}

function aggregateComponentWeights(components: ParsedPackagingComponent[]) {
  const weights: Record<string, number> = {
    component_glass_weight: 0,
    component_aluminium_weight: 0,
    component_steel_weight: 0,
    component_paper_weight: 0,
    component_wood_weight: 0,
    component_other_weight: 0,
  };

  for (const comp of components) {
    if (comp.weight_g != null) {
      const col = getComponentWeightColumn(comp.material);
      if (col) weights[col] += comp.weight_g;
    }
  }

  return weights;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { importId: string } }
) {
  try {
    const user = await getAuthenticatedUser();
    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
    }

    const body = await request.json();
    const {
      organizationId,
      products,
      ingredients,
      packaging,
    } = body as {
      organizationId: string;
      products: ParsedProduct[];
      ingredients: ParsedIngredient[];
      packaging: ParsedPackaging[];
    };

    if (!organizationId) {
      return NextResponse.json({ error: 'Missing organizationId' }, { status: 400 });
    }
    if (!products?.length) {
      return NextResponse.json({ error: 'No products to import' }, { status: 400 });
    }

    const serviceClient = getServiceClient();

    // Verify user belongs to this organization
    const { data: membership } = await serviceClient
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle();

    if (!membership) {
      const { data: advisorAccess } = await serviceClient
        .from('advisor_organization_access')
        .select('id')
        .eq('organization_id', organizationId)
        .eq('advisor_user_id', user.id)
        .eq('is_active', true)
        .maybeSingle();

      if (!advisorAccess) {
        return NextResponse.json({ error: 'Not authorized for this organization' }, { status: 403 });
      }
    }

    // Create all products and collect their IDs keyed by SKU
    const skuToProductId: Record<string, number> = {};
    const createdProducts: string[] = [];

    for (const product of products) {
      const { data, error } = await serviceClient
        .from('products')
        .insert({
          organization_id: organizationId,
          name: product.name,
          sku: product.sku,
          product_category: product.category,
          created_by: user.id,
          is_draft: true,
        })
        .select('id, name')
        .single();

      if (error) {
        console.error('Failed to create product:', product.name, error);
        return NextResponse.json(
          { error: `Failed to create product "${product.name}": ${error.message}` },
          { status: 500 }
        );
      }

      skuToProductId[product.sku] = data.id;
      createdProducts.push(data.name);
    }

    // Increment product count (non-critical)
    try {
      for (let i = 0; i < products.length; i++) {
        await serviceClient.rpc('increment_product_count', {
          p_organization_id: organizationId,
        });
      }
    } catch {
      // Non-critical — count can be recalculated
    }

    // Insert ingredients as product_materials
    const ingredientRows = ingredients
      .filter(ing => skuToProductId[ing.product_sku])
      .map(ing => ({
        product_id: skuToProductId[ing.product_sku],
        material_name: ing.name,
        material_type: 'ingredient' as const,
        quantity: ing.quantity,
        unit: ing.unit,
        origin_address: ing.origin,
      }));

    if (ingredientRows.length > 0) {
      const { error } = await serviceClient
        .from('product_materials')
        .insert(ingredientRows);

      if (error) {
        console.error('Failed to insert ingredients:', error);
        return NextResponse.json(
          { error: `Failed to import ingredients: ${error.message}` },
          { status: 500 }
        );
      }
    }

    // Insert packaging as product_materials
    const packagingRows = packaging
      .filter(pkg => skuToProductId[pkg.product_sku])
      .map(pkg => {
        const componentWeights = aggregateComponentWeights(pkg.components);

        return {
          product_id: skuToProductId[pkg.product_sku],
          material_name: pkg.name,
          material_type: 'packaging' as const,
          quantity: pkg.weight_g,
          unit: 'g',
          packaging_category: pkg.category,
          origin_country: pkg.origin_country,
          transport_mode: pkg.transport_mode || null,
          distance_km: pkg.distance_km,
          recycled_content_percentage: pkg.recycled_pct,
          net_weight_g: pkg.net_content,
          // EPR fields
          epr_packaging_level: pkg.epr_level,
          epr_packaging_activity: pkg.epr_activity,
          epr_material_type: pkg.epr_material_type,
          epr_is_household: pkg.epr_is_household ?? false,
          epr_is_drinks_container: pkg.epr_is_drinks_container ?? false,
          epr_ram_rating: pkg.epr_ram_rating,
          epr_uk_nation: pkg.epr_uk_nation,
          // Component breakdown
          has_component_breakdown: pkg.components.length > 0,
          ...componentWeights,
        };
      });

    if (packagingRows.length > 0) {
      const { error } = await serviceClient
        .from('product_materials')
        .insert(packagingRows);

      if (error) {
        console.error('Failed to insert packaging:', error);
        return NextResponse.json(
          { error: `Failed to import packaging: ${error.message}` },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({
      success: true,
      created: {
        products: createdProducts.length,
        ingredients: ingredientRows.length,
        packaging: packagingRows.length,
      },
      productIds: Object.values(skuToProductId),
    });
  } catch (error) {
    console.error('Bulk import confirm error:', error);
    const message = error instanceof Error ? error.message : 'Import failed';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
