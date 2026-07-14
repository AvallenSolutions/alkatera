import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { guardOrgWrite } from '@/lib/auth/guard-org-write';
import { buildPackagingMaterialData } from '@/lib/products/packaging-material-data';
import type { PackagingFormData } from '@/components/products/PackagingFormCard';

/**
 * POST /api/products/[id]/packaging
 *
 * Saves extracted packaging-spec components onto a product as product_materials
 * rows. Always builds the row through buildPackagingMaterialData() (the single
 * shared builder) so it can never drift from the recipe editor. Runs as the
 * authenticated user; the product_materials INSERT RLS policy scopes by the
 * product's organisation.
 */

const SHARED_ROLES = new Set(['secondary', 'shipment', 'tertiary']);

interface ComponentInput {
  component_name?: string;
  material?: string;
  role?: string;
  weight_g?: number;
  recycled_content_pct?: number;
  recyclability_pct?: number;
  units_per_group?: number;
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();

    // Resolve against the org the upload was classified under when the client
    // sends it, so a multi-org user (or advisor) writes into the intended org
    // rather than whichever the server-side default resolves to.
    const organizationId = await resolveAccessibleOrg(supabase, user, body.organizationId);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const denied = await guardOrgWrite(supabase, user, organizationId);
    if (denied) return denied;

    const productId = params.id;
    // Verify the product belongs to the caller's organisation.
    const { data: product } = await supabase
      .from('products')
      .select('id, organization_id')
      .eq('id', productId)
      .maybeSingle();
    if (!product || product.organization_id !== organizationId) {
      return NextResponse.json({ error: 'Product not found' }, { status: 404 });
    }

    const components: ComponentInput[] = Array.isArray(body.components) ? body.components : [];
    const valid = components.filter((c) => c.component_name && Number(c.weight_g) > 0);
    if (valid.length === 0) {
      return NextResponse.json({ error: 'No packaging components with a name and weight to save.' }, { status: 400 });
    }

    const rows = valid.map((c) => {
      const role = c.role || 'container';
      // buildPackagingMaterialData reads a known subset of PackagingFormData;
      // we provide those fields and cast (a full form object is only built in
      // the recipe editor UI).
      const form = {
        name: c.component_name,
        packaging_category: role,
        container_material: c.material || null,
        net_weight_g: Number(c.weight_g),
        amount: Number(c.weight_g),
        unit: 'g',
        recycled_content_percentage: c.recycled_content_pct != null ? String(c.recycled_content_pct) : '',
        recyclability_percent: c.recyclability_pct != null ? c.recyclability_pct : '',
        has_component_breakdown: false,
        // Shared roles must be amortised across the pack; default to 1 when the
        // sheet does not say, so the row is still saveable.
        units_per_group: SHARED_ROLES.has(role) ? c.units_per_group || 1 : 1,
      } as unknown as PackagingFormData;
      return buildPackagingMaterialData(form, productId);
    });

    // Idempotent re-upload: this endpoint is append-only, so uploading the
    // same spec twice used to double every packaging row (and the footprint
    // and EPR tonnage). Replace any existing packaging rows for this product
    // that share a name with an incoming row before inserting.
    const incomingNames = Array.from(new Set(valid.map((c) => c.component_name!.trim())));
    if (incomingNames.length > 0) {
      const { error: delError } = await supabase
        .from('product_materials')
        .delete()
        .eq('product_id', productId)
        .eq('material_type', 'packaging')
        .in('material_name', incomingNames);
      if (delError) {
        console.error('[products/packaging POST] Dedupe delete error:', delError);
        return NextResponse.json({ error: 'Could not save the packaging components.' }, { status: 500 });
      }
    }

    const { data, error } = await supabase.from('product_materials').insert(rows).select('id');
    if (error) {
      console.error('[products/packaging POST] Insert error:', error);
      return NextResponse.json({ error: 'Could not save the packaging components.' }, { status: 500 });
    }

    return NextResponse.json({ saved: data?.length ?? rows.length }, { status: 201 });
  } catch (err) {
    console.error('[products/packaging POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
