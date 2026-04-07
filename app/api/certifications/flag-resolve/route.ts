import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * GET /api/certifications/flag-resolve?organization_id=...
 *
 * Auto-resolves FLAG requirement evidence from platform data.
 * Returns the compliance status for each FLAG requirement based on:
 * - FLAG-1.1: Product LCA aggregated impacts (flag_threshold)
 * - FLAG-1.2/1.3: Supplier products with commodity_type + ESG env_09 answers
 * - FLAG-1.4/1.5/1.6: Manual (not auto-resolved)
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const organizationId = request.nextUrl.searchParams.get('organization_id');
    if (!organizationId) {
      return NextResponse.json({ error: 'organization_id is required' }, { status: 400 });
    }

    // Look up SBTi framework and its FLAG requirements
    const { data: sbtiFramework } = await supabase
      .from('certification_frameworks')
      .select('id')
      .eq('code', 'sbti')
      .single();

    if (!sbtiFramework) {
      return NextResponse.json({ error: 'SBTi framework not found' }, { status: 404 });
    }

    const { data: flagRequirements } = await supabase
      .from('certification_framework_requirements')
      .select('id, requirement_code, requirement_name, section, is_mandatory')
      .eq('framework_id', sbtiFramework.id)
      .like('requirement_code', 'FLAG-%')
      .order('order_index');

    if (!flagRequirements || flagRequirements.length === 0) {
      return NextResponse.json({ requirements: [], resolved: {} });
    }

    const resolved: Record<string, {
      status: 'compliant' | 'partial' | 'non_compliant' | 'not_assessed';
      source: 'platform_data' | 'manual';
      detail: string;
    }> = {};

    // FLAG-1.1: Check product LCA for FLAG threshold
    const { data: products } = await supabase
      .from('product_carbon_footprints')
      .select('product_name, aggregated_impacts')
      .eq('organization_id', organizationId)
      .eq('status', 'completed')
      .limit(50);

    const flag11 = flagRequirements.find(r => r.requirement_code === 'FLAG-1.1');
    if (flag11) {
      if (products && products.length > 0) {
        let anyExceeded = false;
        let maxPct = 0;
        for (const p of products) {
          const ft = (p.aggregated_impacts as any)?.breakdown?.flag_threshold;
          if (ft) {
            if (ft.flag_threshold_exceeded) anyExceeded = true;
            if (ft.flag_emissions_pct > maxPct) maxPct = ft.flag_emissions_pct;
          }
        }
        // If FLAG threshold exceeded, check whether FLAG targets have been set
        let flagTargetsExist = false;
        if (anyExceeded) {
          const { data: targets } = await supabase
            .from('flag_targets')
            .select('id')
            .eq('organization_id', organizationId)
            .limit(1);
          flagTargetsExist = !!(targets && targets.length > 0);
        }

        resolved[flag11.id] = {
          status: maxPct > 0
            ? (anyExceeded
                ? (flagTargetsExist ? 'compliant' : 'non_compliant')
                : 'compliant')
            : 'not_assessed',
          source: 'platform_data',
          detail: maxPct > 0
            ? anyExceeded
              ? flagTargetsExist
                ? `FLAG emissions at ${maxPct.toFixed(1)}% of total. Threshold exceeded and FLAG targets have been set.`
                : `FLAG emissions at ${maxPct.toFixed(1)}% of total. Threshold exceeded: FLAG targets required but not yet set.`
              : `FLAG emissions at ${maxPct.toFixed(1)}% of total. Below 20% threshold.`
            : 'No product LCA data with FLAG emissions found.',
        };
      } else {
        resolved[flag11.id] = {
          status: 'not_assessed',
          source: 'platform_data',
          detail: 'No completed product LCA data found.',
        };
      }
    }

    // FLAG-1.2 and FLAG-1.3: Check supplier products and ESG assessments
    const { data: commodityProducts } = await supabase
      .from('supplier_products')
      .select('id, supplier_id, commodity_type, deforestation_commitment_verified')
      .eq('organization_id', organizationId)
      .neq('commodity_type', 'none');

    const timberProducts = (commodityProducts || []).filter(p => p.commodity_type === 'timber');
    const otherCommodityProducts = (commodityProducts || []).filter(p => p.commodity_type !== 'timber');

    // Get ESG assessments for suppliers with commodity products
    const supplierIds = Array.from(new Set((commodityProducts || []).map(p => p.supplier_id)));
    let esgAnswers: Record<string, string> = {};
    if (supplierIds.length > 0) {
      const { data: assessments } = await supabase
        .from('supplier_esg_assessments')
        .select('supplier_id, answers')
        .in('supplier_id', supplierIds)
        .eq('is_verified', true);

      for (const a of assessments || []) {
        const ans = a.answers as Record<string, string>;
        if (ans?.env_09 === 'yes') {
          esgAnswers[a.supplier_id] = 'yes';
        } else if (ans?.env_09 === 'partial' && !esgAnswers[a.supplier_id]) {
          esgAnswers[a.supplier_id] = 'partial';
        }
      }
    }

    const flag12 = flagRequirements.find(r => r.requirement_code === 'FLAG-1.2');
    if (flag12) {
      if (timberProducts.length === 0) {
        resolved[flag12.id] = {
          status: 'not_assessed',
          source: 'platform_data',
          detail: 'No timber-classified supplier products found. Requirement is conditional.',
        };
      } else {
        const verifiedCount = timberProducts.filter(p =>
          p.deforestation_commitment_verified || esgAnswers[p.supplier_id] === 'yes'
        ).length;
        resolved[flag12.id] = {
          status: verifiedCount === timberProducts.length ? 'compliant' : verifiedCount > 0 ? 'partial' : 'non_compliant',
          source: 'platform_data',
          detail: `${verifiedCount} of ${timberProducts.length} timber suppliers have verified deforestation commitments.`,
        };
      }
    }

    const flag13 = flagRequirements.find(r => r.requirement_code === 'FLAG-1.3');
    if (flag13) {
      if (otherCommodityProducts.length === 0) {
        resolved[flag13.id] = {
          status: 'not_assessed',
          source: 'platform_data',
          detail: 'No other deforestation-linked commodity products found. Requirement is conditional.',
        };
      } else {
        const verifiedCount = otherCommodityProducts.filter(p =>
          p.deforestation_commitment_verified || esgAnswers[p.supplier_id] === 'yes'
        ).length;
        resolved[flag13.id] = {
          status: verifiedCount === otherCommodityProducts.length ? 'compliant' : verifiedCount > 0 ? 'partial' : 'non_compliant',
          source: 'platform_data',
          detail: `${verifiedCount} of ${otherCommodityProducts.length} commodity suppliers have verified deforestation commitments.`,
        };
      }
    }

    // FLAG-1.4, 1.5, 1.6: manual only
    for (const req of flagRequirements.filter(r => ['FLAG-1.4', 'FLAG-1.5', 'FLAG-1.6'].includes(r.requirement_code))) {
      resolved[req.id] = {
        status: 'not_assessed',
        source: 'manual',
        detail: 'Requires manual attestation or document upload.',
      };
    }

    return NextResponse.json({
      framework_id: sbtiFramework.id,
      requirements: flagRequirements,
      resolved,
    });
  } catch (error) {
    console.error('[FLAG Resolve] Error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
