import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { computeLcaStaleness } from '@/lib/lca/staleness';

/**
 * GET /api/products/[id]/lca-staleness
 *
 * Cheap, no-recalculation staleness check: is the product's latest completed
 * LCA older than any of the inputs that feed it? The calculator is client-side
 * and writes the PCF snapshot once, so smart-upload ingest, bulk imports and
 * admin edits mutate the inputs server-side without refreshing the stored
 * numbers. This compares the PCF's created_at against the max updated_at of
 * every input table (materials, maturation, growing profiles, facility utility
 * data for allocated facilities, and — for a multipack — its components'
 * latest completed PCF).
 *
 * Returns { stale, reasons: string[], pcfId } or { stale:false } when there is
 * no completed LCA to be stale against.
 */
export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
  }

  const orgId = await resolveAccessibleOrg(supabase, user);
  if (!orgId) return NextResponse.json({ error: 'No organisation found' }, { status: 403 });

  const pid = parseInt(params.id, 10);
  if (!Number.isFinite(pid)) return NextResponse.json({ error: 'Invalid product id' }, { status: 400 });

  // Product must belong to the caller's org.
  const { data: product } = await supabase
    .from('products')
    .select('id, organization_id, is_multipack')
    .eq('id', pid)
    .maybeSingle();
  if (!product || product.organization_id !== orgId) {
    return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  }

  // Latest completed LCA — the snapshot everything is compared against.
  const { data: pcf } = await supabase
    .from('product_carbon_footprints')
    .select('id, created_at')
    .eq('product_id', pid)
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!pcf) return NextResponse.json({ stale: false });

  const snapTime = pcf.created_at ? new Date(pcf.created_at).getTime() : 0;
  const { stale, reasons } = await computeLcaStaleness(supabase, pid, snapTime, {
    isMultipack: !!product.is_multipack,
  });
  return NextResponse.json({ stale, reasons, pcfId: pcf.id });
}
