import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Toggle a category as "not applicable" on a corporate report.
 *
 * PATCH /api/reports/[id]/not-applicable
 * Body: { category: string, isNotApplicable: boolean }
 *
 * N/A categories are excluded from the completeness denominator entirely —
 * they count neither for nor against the score.
 */

const VALID_CATEGORIES = [
  'fleet',
  'business_travel',
  'employee_commuting',
  'capital_goods',
  'purchased_services',
  'marketing_materials',
  'downstream_logistics',
  'operational_waste',
];

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const body = await request.json();
    const { category, isNotApplicable } = body;

    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: `Invalid category: ${category}` }, { status: 400 });
    }

    if (typeof isNotApplicable !== 'boolean') {
      return NextResponse.json({ error: 'isNotApplicable must be a boolean' }, { status: 400 });
    }

    // Fetch current flags (RLS ensures the user can only access their own reports)
    const { data: report, error: fetchError } = await supabase
      .from('corporate_reports')
      .select('id, not_applicable_categories')
      .eq('id', reportId)
      .single();

    if (fetchError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    const current: string[] = report.not_applicable_categories || [];
    const updated = isNotApplicable
      ? current.includes(category) ? current : [...current, category]
      : current.filter((c) => c !== category);

    const { error: updateError } = await supabase
      .from('corporate_reports')
      .update({ not_applicable_categories: updated })
      .eq('id', reportId);

    if (updateError) throw updateError;

    return NextResponse.json({ success: true, not_applicable_categories: updated });
  } catch (error: any) {
    console.error('[not-applicable] Error:', error);
    return NextResponse.json({ error: error.message || 'Internal server error' }, { status: 500 });
  }
}
