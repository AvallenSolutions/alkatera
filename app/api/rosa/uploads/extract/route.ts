/**
 * Rosa — document extraction endpoint.
 *
 * POST /api/rosa/uploads/extract
 * Body: { file_id: string }
 *
 * Loads the uploaded file from storage, runs a structured extraction pass
 * via Claude Sonnet vision, and returns the extracted fields alongside the
 * org's facility list so the client can render a review + import modal in
 * one round-trip.
 */
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { loadAttachment, extractStructured } from '@/lib/rosa/document-extraction';
import { checkRateLimit } from '@/lib/rosa/rate-limiter';

export const runtime = 'nodejs';
export const maxDuration = 60;

const EXTRACT_RATE_LIMIT = 5; // per minute — Claude vision is the most expensive call on the platform

export async function POST(request: NextRequest) {
  const userSupabase = getSupabaseServerClient();
  const { data: { user }, error: userErr } = await userSupabase.auth.getUser();
  if (userErr || !user) {
    return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
  }

  const rl = checkRateLimit(`extract:${user.id}`, EXTRACT_RATE_LIMIT);
  if (!rl.allowed) {
    return NextResponse.json(
      { error: `Too many extraction requests. Please wait ${Math.ceil(rl.retryAfterMs / 1000)} seconds.` },
      { status: 429 },
    );
  }

  const { data: membership } = await userSupabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) {
    return NextResponse.json({ error: 'No organisation membership' }, { status: 403 });
  }
  const organizationId = (membership as any).organization_id as string;

  let body: { file_id?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const fileId = body?.file_id;
  if (!fileId || typeof fileId !== 'string') {
    return NextResponse.json({ error: 'file_id is required' }, { status: 400 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (!supabaseUrl || !supabaseKey) {
    return NextResponse.json({ error: 'Supabase service role not configured' }, { status: 500 });
  }
  if (!anthropicKey) {
    return NextResponse.json({ error: 'Anthropic API key not configured' }, { status: 500 });
  }

  const service = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const [attachmentResult, facilitiesResult] = await Promise.all([
    loadAttachment(service, fileId, organizationId, user.id),
    service
      .from('facilities')
      .select('id, name, address_country')
      .eq('organization_id', organizationId)
      .order('name'),
  ]);

  if (!attachmentResult) {
    return NextResponse.json({ error: 'File not found or access denied' }, { status: 404 });
  }

  const facilities = (facilitiesResult.data ?? []) as Array<{
    id: string;
    name: string;
    address_country: string | null;
  }>;

  const extraction = await extractStructured(
    anthropicKey,
    attachmentResult,
    [
      'document_type',
      'utility_type',
      'supplier_name',
      'account_number',
      'period_start',
      'period_end',
      'quantity_value',
      'quantity_unit',
      'total_cost',
      'currency',
      'notes',
    ],
    'utility bill, invoice, meter reading, supplier spec sheet, or LCA report',
  );

  if (!extraction.ok) {
    return NextResponse.json({
      ok: false,
      error: extraction.error,
      facilities,
    });
  }

  const data = extraction.data;

  const documentType = normaliseDocumentType(String(data.document_type ?? ''));
  const utilityType = normaliseUtilityType(String(data.utility_type ?? ''));

  return NextResponse.json({
    ok: true,
    document_type: documentType,
    utility_type: utilityType,
    supplier_name: data.supplier_name ?? null,
    account_number: data.account_number ?? null,
    period_start: data.period_start ?? null,
    period_end: data.period_end ?? null,
    quantity_value: data.quantity_value ?? null,
    quantity_unit: data.quantity_unit ?? null,
    total_cost: data.total_cost ?? null,
    currency: data.currency ?? null,
    notes: data.notes ?? null,
    facilities,
  });
}

function normaliseDocumentType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('utility') || lower.includes('bill') || lower.includes('electric') || lower.includes('gas') || lower.includes('water') || lower.includes('meter')) return 'utility_bill';
  if (lower.includes('invoice')) return 'invoice';
  if (lower.includes('lca') || lower.includes('life cycle')) return 'lca_report';
  if (lower.includes('supplier') || lower.includes('spec')) return 'supplier_spec';
  if (lower.includes('meter') || lower.includes('reading')) return 'meter_reading';
  return 'other';
}

function normaliseUtilityType(raw: string): string {
  const lower = raw.toLowerCase();
  if (lower.includes('electric')) return 'electricity_grid';
  if (lower.includes('gas') && !lower.includes('lpg')) return 'natural_gas';
  if (lower.includes('lpg') || lower.includes('propane')) return 'lpg';
  if (lower.includes('heat') || lower.includes('steam')) return 'heat_steam_purchased';
  if (lower.includes('water')) return 'water_intake';
  if (lower.includes('diesel') && (lower.includes('fleet') || lower.includes('vehicle') || lower.includes('mobile'))) return 'diesel_mobile';
  if (lower.includes('diesel')) return 'diesel_stationary';
  if (lower.includes('petrol') || lower.includes('gasoline')) return 'petrol_mobile';
  return '';
}
