import { NextResponse } from 'next/server';
import { requireDistributor } from '@/lib/distributor/auth';
import { syncAlkateraDataForBrand } from '@/lib/distributor/integration/alkatera-sync';
import { recalculateCompleteness } from '@/lib/distributor/scoring/recalculate';

/**
 * POST /api/distributor/brands/[id]/refresh-alkatera
 *
 * Triggers an immediate sync of alka**tera** live data for this brand
 * — useful when the distributor knows the brand just updated their
 * data on the alka**tera** side and doesn't want to wait for the
 * daily cron. Returns the count of fields written so the UI can show
 * "we just refreshed N fields" feedback.
 *
 * Owner / data_manager only.
 */
export async function POST(_request: Request, { params }: { params: { id: string } }) {
  const auth = await requireDistributor();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.reason }, { status: auth.status });
  }
  if (auth.member.role === 'viewer') {
    return NextResponse.json({ error: 'forbidden' }, { status: 403 });
  }

  const { data: brand } = await auth.supabase
    .from('brand_profiles')
    .select('id, brand_directory_id, alkatera_org_id')
    .eq('id', params.id)
    .eq('distributor_org_id', auth.organization.id)
    .maybeSingle();
  if (!brand) {
    return NextResponse.json({ error: 'brand_not_found' }, { status: 404 });
  }
  if (!(brand as { alkatera_org_id: string | null }).alkatera_org_id) {
    return NextResponse.json(
      { error: 'not_linked', message: 'This brand has no confirmed alkatera link.' },
      { status: 409 },
    );
  }

  const directoryId = (brand as { brand_directory_id: string }).brand_directory_id;
  const result = await syncAlkateraDataForBrand(auth.supabase, directoryId);

  // Recompute completeness now that the active findings set has changed.
  try {
    await recalculateCompleteness(auth.supabase, directoryId);
  } catch {
    // best-effort
  }

  return NextResponse.json(result);
}
