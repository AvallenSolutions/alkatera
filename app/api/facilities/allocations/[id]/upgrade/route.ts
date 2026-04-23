/**
 * Upgrade a proxy-backed facility allocation to primary data.
 *
 * POST /api/facilities/allocations/[id]/upgrade
 *
 * Creates a NEW contract_manufacturer_allocations row with the primary
 * energy/water figures supplied by the user, marks the source proxy row as
 * superseded, and links the two via upgrade_from_allocation_id so the full
 * audit trail (and the old report) remain reproducible.
 */

import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

interface UpgradeRequest {
  totalFacilityCo2eKg: number;
  scope1Kg: number;
  scope2Kg: number;
  allocatedWaterLitres?: number;
  totalFacilityProductionVolume?: number;
  notes?: string;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } },
) {
  const allocationId = params.id;
  const supabase = getSupabaseServerClient();

  const { data: { user }, error: authError } = await supabase.auth.getUser();
  if (authError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = (await request.json()) as UpgradeRequest;
  if (
    typeof body.totalFacilityCo2eKg !== 'number' ||
    typeof body.scope1Kg !== 'number' ||
    typeof body.scope2Kg !== 'number'
  ) {
    return NextResponse.json(
      { error: 'totalFacilityCo2eKg, scope1Kg and scope2Kg are required' },
      { status: 400 },
    );
  }

  // Load the existing (proxy) allocation
  const { data: existing, error: loadError } = await supabase
    .from('contract_manufacturer_allocations')
    .select('*')
    .eq('id', allocationId)
    .maybeSingle();

  if (loadError || !existing) {
    return NextResponse.json({ error: 'Allocation not found' }, { status: 404 });
  }

  if ((existing as any).data_collection_mode === 'primary') {
    return NextResponse.json(
      { error: 'Allocation is already primary data \u2014 nothing to upgrade.' },
      { status: 400 },
    );
  }

  // Authorise: user must belong to the organisation
  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', (existing as any).organization_id)
    .maybeSingle();

  if (!membership) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const totalVolume =
    body.totalFacilityProductionVolume ?? (existing as any).total_facility_production_volume;
  const clientVolume = (existing as any).client_production_volume;
  const attributionRatio = totalVolume > 0 ? Math.min(1, clientVolume / totalVolume) : 1;

  const upgradeRow = {
    organization_id: (existing as any).organization_id,
    product_id: (existing as any).product_id,
    facility_id: (existing as any).facility_id,
    reporting_period_start: (existing as any).reporting_period_start,
    reporting_period_end: (existing as any).reporting_period_end,
    total_facility_production_volume: totalVolume,
    production_volume_unit: (existing as any).production_volume_unit,
    total_facility_co2e_kg: body.totalFacilityCo2eKg,
    co2e_entry_method: 'direct',
    client_production_volume: clientVolume,
    scope1_emissions_kg_co2e: body.scope1Kg * attributionRatio,
    scope2_emissions_kg_co2e: body.scope2Kg * attributionRatio,
    scope3_emissions_kg_co2e: 0,
    allocated_water_litres: body.allocatedWaterLitres ?? 0,
    allocated_waste_kg: 0,
    status: 'verified',
    data_source_tag: 'Primary - Upgraded from proxy',
    data_collection_mode: 'primary',
    upgrade_from_allocation_id: allocationId,
    verification_notes: body.notes ?? null,
    created_by: user.id,
  };

  const { data: inserted, error: insertError } = await supabase
    .from('contract_manufacturer_allocations')
    .insert(upgradeRow)
    .select()
    .single();

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 });
  }

  // Mark the proxy row as superseded — keep the row for audit reproducibility
  const { error: supersedeError } = await supabase
    .from('contract_manufacturer_allocations')
    .update({ superseded_at: new Date().toISOString() })
    .eq('id', allocationId);

  if (supersedeError) {
    console.warn('[facility upgrade] Failed to mark proxy row superseded:', supersedeError);
  }

  return NextResponse.json({
    success: true,
    upgradedAllocationId: (inserted as any).id,
    supersededAllocationId: allocationId,
    message:
      'Primary data recorded. Recalculate the LCA to see the updated footprint; the superseded proxy row has been preserved for audit.',
  });
}
