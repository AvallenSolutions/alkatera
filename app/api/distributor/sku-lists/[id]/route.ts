import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';

/**
 * GET /api/distributor/sku-lists/[id]
 * Returns the upload record for the given id, scoped to the caller's org.
 */
export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  const { data, error } = await auth.supabase
    .from('distributor_sku_lists')
    .select('*')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  if (!data) {
    return NextResponse.json({ error: 'not_found' }, { status: 404 });
  }
  return NextResponse.json({ sku_list: data });
}
