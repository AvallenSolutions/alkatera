import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';

async function getAuthenticatedSupabase() {
  const cookieStore = cookies();
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) { return cookieStore.get(name)?.value },
        set(name: string, value: string, options: CookieOptions) {
          try { cookieStore.set({ name, value, ...options }) } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try { cookieStore.set({ name, value: '', ...options }) } catch {}
        },
      },
    }
  );
  const { data: { user }, error } = await supabase.auth.getUser();
  if (error || !user) return null;
  return supabase;
}

export interface ProductToConfirm {
  name: string;
  description: string;
  abv: number | null;
  unit_size_value: number | null;
  unit_size_unit: string | null;
  product_category: string;
  product_image_url: string | null;
  packaging_type?: 'glass_bottle' | 'aluminium_can' | 'keg_cask' | 'pet_bag' | null;
  ingredients?: string[];
  certifications?: string[];
  included: boolean;
}

const PACKAGING_TYPE_NAMES: Record<string, string> = {
  glass_bottle: 'Glass Bottle',
  aluminium_can: 'Aluminium Can',
  keg_cask: 'Keg / Cask',
  pet_bag: 'PET / Bag-in-Box',
}

/**
 * POST /api/products/import-from-url/confirm
 *
 * Bulk-creates draft product records from the reviewed extraction results.
 *
 * Body: { organizationId: string, products: ProductToConfirm[] }
 * Returns: { created: number, productIds: string[] }
 */
export async function POST(request: NextRequest) {
  try {
    const supabase = await getAuthenticatedSupabase();
    if (!supabase) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, products, orgDescription }: {
      organizationId: string;
      products: ProductToConfirm[];
      orgDescription?: string | null;
    } = body;

    if (!organizationId) {
      return NextResponse.json({ error: 'organizationId is required' }, { status: 400 });
    }
    if (!Array.isArray(products) || products.length === 0) {
      return NextResponse.json({ error: 'products array is required' }, { status: 400 });
    }

    const includedProducts = products.filter(p => p.included);
    if (includedProducts.length === 0) {
      return NextResponse.json({ error: 'No products selected for import' }, { status: 400 });
    }

    // Insert all selected products as drafts
    const rows = includedProducts.map(p => ({
      organization_id: organizationId,
      name: p.name.trim(),
      product_description: p.description?.trim() || null,
      product_image_url: p.product_image_url || null,
      unit_size_value: p.unit_size_value,
      unit_size_unit: p.unit_size_unit,
      product_category: p.product_category,
      is_draft: true,
      certifications: p.certifications?.length
        ? p.certifications.map(name => ({ name }))
        : null,
    }));

    const { data, error } = await supabase
      .from('products')
      .insert(rows)
      .select('id');

    if (error) throw error;

    const createdIds: string[] = (data ?? []).map((p: any) => String(p.id));

    // Increment product count for subscription tracking (once per product created)
    for (let i = 0; i < includedProducts.length; i++) {
      await supabase.rpc('increment_product_count', {
        p_organization_id: organizationId,
      });
    }

    // Auto-create packaging_types + ingredients + product_materials for each product
    const packagingTypeCache: Record<string, string> = {}; // packageKey → packaging_types.id

    for (let i = 0; i < includedProducts.length; i++) {
      const product = includedProducts[i];
      const productId = createdIds[i];
      if (!productId) continue;

      // Packaging
      const packagingKey = product.packaging_type;
      if (packagingKey) {
        const packagingName = PACKAGING_TYPE_NAMES[packagingKey] ?? packagingKey;

        if (!packagingTypeCache[packagingKey]) {
          // Check if a packaging type with this name already exists for the org
          const { data: existing } = await supabase
            .from('packaging_types')
            .select('id')
            .eq('organization_id', organizationId)
            .eq('name', packagingName)
            .maybeSingle();

          if (existing) {
            packagingTypeCache[packagingKey] = existing.id;
          } else {
            const { data: newPt } = await supabase
              .from('packaging_types')
              .insert({ organization_id: organizationId, name: packagingName, category: 'primary' })
              .select('id')
              .single();
            if (newPt) packagingTypeCache[packagingKey] = newPt.id;
          }
        }

        const packagingTypeId = packagingTypeCache[packagingKey];
        if (packagingTypeId) {
          await supabase.from('product_materials').insert({
            product_id: productId,
            material_name: packagingName,
            material_type: 'packaging',
            material_id: packagingTypeId,
            quantity: 1,
          });
        }
      }

      // Ingredients
      const ingredients = product.ingredients ?? [];
      for (const ingredientName of ingredients) {
        if (!ingredientName.trim()) continue;
        const name = ingredientName.trim();

        // Check if ingredient already exists for this org
        const { data: existingIng } = await supabase
          .from('ingredients')
          .select('id')
          .eq('organization_id', organizationId)
          .ilike('name', name)
          .maybeSingle();

        let ingredientId: string | null = existingIng?.id ?? null;

        if (!ingredientId) {
          const { data: newIng } = await supabase
            .from('ingredients')
            .insert({ organization_id: organizationId, name })
            .select('id')
            .single();
          ingredientId = newIng?.id ?? null;
        }

        if (ingredientId) {
          await supabase.from('product_materials').insert({
            product_id: productId,
            material_name: name,
            material_type: 'ingredient',
            material_id: ingredientId,
            quantity: 1,
          });
        }
      }
    }

    // Save org description if provided and org description is currently empty
    if (orgDescription?.trim()) {
      const { data: org } = await supabase
        .from('organizations')
        .select('description')
        .eq('id', organizationId)
        .single();

      if (org && !org.description) {
        await supabase
          .from('organizations')
          .update({ description: orgDescription.trim() })
          .eq('id', organizationId);
      }
    }

    return NextResponse.json({
      created: createdIds.length,
      productIds: createdIds,
    });
  } catch (error: any) {
    console.error('[import-from-url/confirm] Error:', error);
    return NextResponse.json({ error: 'Failed to create products' }, { status: 500 });
  }
}
