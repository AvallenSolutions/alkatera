import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper';
import { getSpendFactor, calculateSpendBasedEmissions } from '@/lib/xero/spend-factors';

/**
 * POST /api/spend/invoice
 *
 * Saves an extracted supplier invoice as spend-based Scope 3 rows on the
 * organisation's corporate report. One `corporate_overheads` row per line
 * item, with a DEFRA spend-based emission factor (Tier 4) the user can later
 * upgrade to activity data.
 *
 * Runs as the authenticated user (not service-role), so the org-scoped RLS on
 * corporate_reports / corporate_overheads is the access backstop.
 */

// corporate_overheads.category is CHECK-constrained; this subset is what a
// supplier invoice realistically maps to.
const ALLOWED_CATEGORIES = [
  'purchased_services',
  'capital_goods',
  'upstream_transportation',
  'operational_waste',
  'other',
] as const;
type SpendCategory = (typeof ALLOWED_CATEGORIES)[number];

const ALLOWED_CURRENCIES = ['GBP', 'USD', 'EUR'] as const;

// Map the coarse Scope 3 category onto a DEFRA spend-factor key.
const SPEND_FACTOR_KEY_BY_CATEGORY: Record<SpendCategory, string> = {
  purchased_services: 'professional_services',
  capital_goods: 'capital_goods',
  upstream_transportation: 'road_freight',
  operational_waste: 'waste',
  other: 'other',
};

interface InvoiceLine {
  description?: string;
  amount?: number;
}

export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation found' }, { status: 403 });
    }

    const body = await request.json();
    const supplierName: string = (body.supplier_name || '').toString().trim();
    const invoiceDate: string | undefined = body.invoice_date || undefined;

    const category: SpendCategory = ALLOWED_CATEGORIES.includes(body.category)
      ? body.category
      : 'purchased_services';
    const currency: string = ALLOWED_CURRENCIES.includes((body.currency || '').toUpperCase())
      ? body.currency.toUpperCase()
      : 'GBP';

    const rawLines: InvoiceLine[] = Array.isArray(body.line_items) ? body.line_items : [];
    const lines = rawLines
      .map((l) => ({ description: (l.description || '').toString().trim(), amount: Number(l.amount) }))
      .filter((l) => Number.isFinite(l.amount) && l.amount > 0);

    if (lines.length === 0) {
      return NextResponse.json({ error: 'No priced line items to save.' }, { status: 400 });
    }

    const year = deriveReportingYear(invoiceDate);
    const reportId = await getOrCreateCorporateReport(supabase, organizationId, year);

    const spendKey = SPEND_FACTOR_KEY_BY_CATEGORY[category];
    const emissionFactor = getSpendFactor(spendKey);

    const rows = lines.map((l) => ({
      report_id: reportId,
      category,
      description: supplierName
        ? `${supplierName}: ${l.description || 'Invoice line'}`
        : l.description || 'Invoice line',
      spend_amount: l.amount,
      currency,
      ...(invoiceDate ? { entry_date: invoiceDate } : {}),
      emission_factor: emissionFactor,
      computed_co2e: calculateSpendBasedEmissions(l.amount, spendKey, currency),
      data_source: 'invoice_upload',
    }));

    const { data, error } = await supabase.from('corporate_overheads').insert(rows).select('id');
    if (error) {
      console.error('[spend/invoice POST] Insert error:', error);
      return NextResponse.json({ error: 'Could not save the invoice.' }, { status: 500 });
    }

    const totalSpend = rows.reduce((s, r) => s + r.spend_amount, 0);
    const totalCo2eKg = rows.reduce((s, r) => s + r.computed_co2e, 0);

    return NextResponse.json(
      {
        saved: data?.length ?? rows.length,
        year,
        total_spend: totalSpend,
        total_co2e_kg: totalCo2eKg,
      },
      { status: 201 },
    );
  } catch (err) {
    console.error('[spend/invoice POST] Unexpected error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
