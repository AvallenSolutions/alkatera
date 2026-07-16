/**
 * Shared approve-time writers for `agent_exceptions`.
 *
 * The Ask Queue (`app/api/agents/exceptions/[id]/route.ts`, driven by the
 * ExceptionQueue UI) and Rosa's tool-confirm flow
 * (`lib/rosa/actions.ts` execApproveException, driven by a chat proposal)
 * both need to turn an approved exception into a real write. This module is
 * the one place that business logic lives, so the two callers can never
 * drift apart. Mirrors the API routes it's extracted from line for line —
 * see the doc comment on each writer for its source of truth.
 *
 * `utility_bill` / `water_bill` / `waste_bill` are deliberately NOT covered
 * here: the queue and the Rosa flow already have working (if slightly
 * different — the queue's version also writes `activity_data` and richer
 * enrichment columns via /api/utilities/save-bill) dispatch for those three,
 * and harmonising them is a separate piece of work, not part of this pass.
 * Everything else — the kinds that only ever stamped `status='approved'`
 * with no write — lives here.
 *
 * Every writer throws a plain `Error` with a user-presentable message on
 * validation or write failure, matching the convention in
 * `lib/rosa/actions.ts`. Callers catch it and stamp `status='failed'` (Rosa
 * flow) or return a 4xx/5xx (API route) as they already do.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { REFRIGERANT_GWP, DEFAULT_REFRIGERANT_KEY } from '@/lib/ghg-constants';
import { getOrCreateCorporateReport, deriveReportingYear } from '@/lib/xero/report-helper';
import { getSpendFactor, calculateSpendBasedEmissions } from '@/lib/xero/spend-factors';
import { warmFactorCache } from '@/lib/external-data/cache';

export type AppliedTo = Record<string, unknown>;

/**
 * Kinds this module can turn into a real write on approve. Anything not in
 * this set needs either a deep-link (see `lib/intake/deep-links.ts`) or is
 * left to the existing utility/water/waste-bill dispatch already in place
 * at both call sites.
 */
export const DISPATCH_KINDS = [
  'refrigerant_service',
  'supplier_invoice',
  'freight_invoice',
  'website_supplier',
  'website_certification',
  'website_production_location',
] as const;

export type DispatchKind = (typeof DISPATCH_KINDS)[number];

export function isDispatchKind(kind: string): kind is DispatchKind {
  return (DISPATCH_KINDS as readonly string[]).includes(kind);
}

/**
 * Dispatch the approve-time write for one of `DISPATCH_KINDS`. `supabase`
 * must be able to write across the tables involved — in practice the
 * service-role client, since several of these tables (utility_data_entries,
 * corporate_overheads) have no `organization_id` column of their own and
 * rely on the facility/report lookups below rather than RLS.
 */
export async function dispatchExceptionWrite(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  kind: string,
  payload: any,
  overrides: { facilityId?: string | null; title?: string | null } = {},
): Promise<AppliedTo> {
  switch (kind) {
    case 'refrigerant_service':
      return writeRefrigerantService(supabase, organizationId, userId, payload, overrides.facilityId);
    case 'supplier_invoice':
      return writeSupplierInvoice(supabase, organizationId, payload);
    case 'freight_invoice':
      return writeFreightInvoice(supabase, organizationId, payload);
    case 'website_supplier':
      return writeWebsiteSupplier(supabase, organizationId, payload, overrides.title);
    case 'website_certification':
      return writeWebsiteCertification(supabase, organizationId, payload);
    case 'website_production_location':
      return writeWebsiteProductionLocation(supabase, organizationId, payload, overrides.title);
    default:
      throw new Error(`No dispatch writer for kind "${kind}".`);
  }
}

/**
 * Mirrors `POST /api/data/refrigerant` exactly: an F-gas service record
 * lands as a Scope 1 fugitive entry (utility_type 'refrigerant_leakage') in
 * utility_data_entries, facility-scoped. Facility is verified to belong to
 * the org first, since the table itself has no organization_id column.
 */
async function writeRefrigerantService(
  supabase: SupabaseClient,
  organizationId: string,
  userId: string,
  payload: any,
  facilityIdOverride?: string | null,
): Promise<AppliedTo> {
  const service = payload?.refrigerantService || payload || {};
  const facilityId = facilityIdOverride || service.facility_id;
  const quantityKg = Number(service.quantity_kg);

  if (!facilityId) throw new Error('A facility is required to approve a refrigerant service record.');
  if (!Number.isFinite(quantityKg) || quantityKg <= 0) {
    throw new Error('The refrigerant record has no valid recharged quantity (kg).');
  }

  const { data: facility } = await supabase
    .from('facilities')
    .select('id, organization_id')
    .eq('id', facilityId)
    .maybeSingle();
  if (!facility || (facility as any).organization_id !== organizationId) {
    throw new Error('Facility not found for this organisation.');
  }

  const refrigerantType: string = REFRIGERANT_GWP[service.refrigerant_type as string]
    ? service.refrigerant_type
    : DEFAULT_REFRIGERANT_KEY;
  const serviceDate: string = service.service_date || new Date().toISOString().slice(0, 10);

  const { data, error } = await supabase
    .from('utility_data_entries')
    .insert({
      facility_id: facilityId,
      utility_type: 'refrigerant_leakage',
      quantity: quantityKg,
      unit: 'kg',
      activity_date: serviceDate,
      reporting_period_start: serviceDate,
      reporting_period_end: serviceDate,
      data_quality: 'actual',
      calculated_scope: '',
      refrigerant_type: refrigerantType,
      created_by: userId,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);

  const gwp = REFRIGERANT_GWP[refrigerantType]?.gwp ?? REFRIGERANT_GWP[DEFAULT_REFRIGERANT_KEY].gwp;
  return {
    table: 'utility_data_entries',
    saved: 1,
    id: (data as any).id,
    facilityId,
    refrigerant_type: refrigerantType,
    co2e_kg: quantityKg * gwp,
  };
}

/**
 * Mirrors `POST /api/spend/invoice` exactly: one `corporate_overheads` row
 * per priced line item, spend-based Scope 3 with a DEFRA factor.
 */
async function writeSupplierInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  payload: any,
): Promise<AppliedTo> {
  const ALLOWED_CATEGORIES = [
    'purchased_services',
    'capital_goods',
    'upstream_transportation',
    'operational_waste',
    'other',
  ] as const;
  type SpendCategory = (typeof ALLOWED_CATEGORIES)[number];
  const SPEND_FACTOR_KEY_BY_CATEGORY: Record<SpendCategory, string> = {
    purchased_services: 'professional_services',
    capital_goods: 'capital_goods',
    upstream_transportation: 'road_freight',
    operational_waste: 'waste',
    other: 'other',
  };
  const ALLOWED_CURRENCIES = ['GBP', 'USD', 'EUR'];

  const invoice = payload?.supplierInvoice || payload || {};
  const supplierName: string = (invoice.supplier_name || '').toString().trim();
  const invoiceDate: string | undefined = invoice.invoice_date || undefined;
  const category: SpendCategory = ALLOWED_CATEGORIES.includes(invoice.category)
    ? invoice.category
    : ALLOWED_CATEGORIES.includes(invoice.suggested_category)
      ? invoice.suggested_category
      : 'purchased_services';
  const currency: string = ALLOWED_CURRENCIES.includes((invoice.currency || '').toUpperCase())
    ? invoice.currency.toUpperCase()
    : 'GBP';

  const rawLines: Array<{ description?: string; amount?: number }> = Array.isArray(invoice.line_items)
    ? invoice.line_items
    : [];
  const lines = rawLines
    .map((l) => ({ description: (l.description || '').toString().trim(), amount: Number(l.amount) }))
    .filter((l) => Number.isFinite(l.amount) && l.amount > 0);
  if (lines.length === 0) throw new Error('This invoice has no priced line items to save.');

  const year = deriveReportingYear(invoiceDate);
  const reportId = await getOrCreateCorporateReport(supabase, organizationId, year);
  await warmFactorCache(supabase);

  const spendKey = SPEND_FACTOR_KEY_BY_CATEGORY[category];
  const emissionFactor = getSpendFactor(spendKey);

  const rows = lines.map((l) => ({
    report_id: reportId,
    category,
    description: supplierName ? `${supplierName}: ${l.description || 'Invoice line'}` : l.description || 'Invoice line',
    spend_amount: l.amount,
    currency,
    ...(invoiceDate ? { entry_date: invoiceDate } : {}),
    emission_factor: emissionFactor,
    computed_co2e: calculateSpendBasedEmissions(l.amount, spendKey, currency),
    data_source: 'invoice_upload',
  }));

  const { data, error } = await supabase.from('corporate_overheads').insert(rows).select('id');
  if (error) throw new Error(error.message);

  const totalSpend = rows.reduce((s, r) => s + r.spend_amount, 0);
  const totalCo2eKg = rows.reduce((s, r) => s + r.computed_co2e, 0);
  return {
    table: 'corporate_overheads',
    saved: data?.length ?? rows.length,
    year,
    total_spend: totalSpend,
    total_co2e_kg: totalCo2eKg,
  };
}

/**
 * Mirrors `POST /api/spend/freight` exactly: a single `corporate_overheads`
 * row, activity-based (tonne-km) when weight+distance+mode are present,
 * spend-based fallback otherwise.
 */
async function writeFreightInvoice(
  supabase: SupabaseClient,
  organizationId: string,
  payload: any,
): Promise<AppliedTo> {
  type TransportMode = 'truck' | 'train' | 'ship' | 'air';
  const TRANSPORT_MODE_FACTOR_NAME: Record<TransportMode, string> = {
    truck: 'Freight - Road (HGV, Average laden)',
    train: 'Freight - Rail (Freight train, UK average)',
    ship: 'Freight - Sea (Container ship, Average)',
    air: 'Freight - Air (Dedicated freight service, Average)',
  };
  const DEFAULT_FACTOR: Record<TransportMode, number> = { truck: 0.104, train: 0.028, ship: 0.016, air: 1.13 };
  const ALLOWED_CURRENCIES = ['GBP', 'USD', 'EUR'];

  const freight = payload?.freightInvoice || payload || {};
  const carrierName: string = (freight.carrier_name || '').toString().trim();
  const shipmentDate: string | undefined = freight.shipment_date || undefined;
  const mode: TransportMode | undefined = TRANSPORT_MODE_FACTOR_NAME[freight.transport_mode as TransportMode]
    ? (freight.transport_mode as TransportMode)
    : undefined;
  const weightKg = Number(freight.weight_kg);
  const distanceKm = Number(freight.distance_km);
  const amount = Number(freight.amount);
  const currency: string = ALLOWED_CURRENCIES.includes((freight.currency || '').toUpperCase())
    ? freight.currency.toUpperCase()
    : 'GBP';

  const hasActivity = !!mode && Number.isFinite(weightKg) && weightKg > 0 && Number.isFinite(distanceKm) && distanceKm > 0;
  const hasSpend = Number.isFinite(amount) && amount > 0;
  if (!hasActivity && !hasSpend) {
    throw new Error('This freight record needs either weight + distance + mode, or an invoice amount.');
  }

  const year = deriveReportingYear(shipmentDate);
  const reportId = await getOrCreateCorporateReport(supabase, organizationId, year);
  await warmFactorCache(supabase);
  const descBase = carrierName ? `${carrierName}: freight` : 'Freight';

  let row: Record<string, unknown>;
  let method: 'activity' | 'spend';

  if (hasActivity) {
    const { data: factorRow } = await supabase
      .from('staging_emission_factors')
      .select('co2_factor')
      .eq('name', TRANSPORT_MODE_FACTOR_NAME[mode!])
      .eq('category', 'Transport')
      .maybeSingle();
    const factor = (factorRow as any)?.co2_factor != null ? Number((factorRow as any).co2_factor) : DEFAULT_FACTOR[mode!];
    const computed = (weightKg / 1000) * distanceKm * factor;
    method = 'activity';
    row = {
      report_id: reportId,
      category: 'upstream_transportation',
      description: `${descBase} (${mode}, ${weightKg} kg x ${distanceKm} km)`,
      spend_amount: hasSpend ? amount : 0,
      currency,
      ...(shipmentDate ? { entry_date: shipmentDate } : {}),
      transport_mode: mode,
      weight_kg: weightKg,
      distance_km: distanceKm,
      emission_factor: factor,
      computed_co2e: computed,
      data_source: 'invoice_upload',
    };
  } else {
    const factor = getSpendFactor('road_freight');
    method = 'spend';
    row = {
      report_id: reportId,
      category: 'upstream_transportation',
      description: descBase,
      spend_amount: amount,
      currency,
      ...(shipmentDate ? { entry_date: shipmentDate } : {}),
      emission_factor: factor,
      computed_co2e: calculateSpendBasedEmissions(amount, 'road_freight', currency),
      data_source: 'invoice_upload',
    };
  }

  const { error } = await supabase.from('corporate_overheads').insert(row).select('id');
  if (error) throw new Error(error.message);

  return { table: 'corporate_overheads', saved: 1, method, year, total_co2e_kg: row.computed_co2e };
}

/**
 * Approving a supplier proposed from a website crawl creates a real
 * `suppliers` row (or reuses a matching one). Mirrors the existing
 * `website_supplier` branch in the exceptions PATCH route.
 */
async function writeWebsiteSupplier(
  supabase: SupabaseClient,
  organizationId: string,
  payload: any,
  titleFallback?: string | null,
): Promise<AppliedTo> {
  const name = (payload?.supplier_name || titleFallback || '').toString().trim();
  if (!name) throw new Error('Supplier name missing from payload.');

  const { data: existing } = await supabase
    .from('suppliers')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', name)
    .maybeSingle();
  if ((existing as any)?.id) {
    return { table: 'suppliers', supplier_id: (existing as any).id, matched: 'existing' };
  }

  const { data: created, error } = await supabase
    .from('suppliers')
    .insert({ organization_id: organizationId, name, notes: 'Added from website crawl during onboarding.' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { table: 'suppliers', supplier_id: (created as any).id, matched: 'new' };
}

/**
 * Approving a certification claim found on the website inserts (or updates)
 * an `organization_certifications` row via the same table CertificationPanel
 * writes to, matched to a `certification_frameworks` row by name/code. The
 * claim is unverified, so it's stamped `self_declared` — the same status the
 * onboarding website-import confirm route already uses for this exact
 * scenario — never `certified`, which requires a human-entered cert number.
 */
async function writeWebsiteCertification(
  supabase: SupabaseClient,
  organizationId: string,
  payload: any,
): Promise<AppliedTo> {
  const certName = (payload?.certification || '').toString().trim();
  if (!certName) throw new Error('Certification name missing from payload.');

  const { data: frameworks } = await supabase
    .from('certification_frameworks')
    .select('id, framework_code, framework_name, code, name')
    .eq('is_active', true);

  const needle = certName.toLowerCase();
  const framework = (frameworks || []).find((f: any) =>
    [f.framework_code, f.framework_name, f.code, f.name]
      .filter(Boolean)
      .some((v: string) => v.toLowerCase() === needle || needle.includes(v.toLowerCase()) || v.toLowerCase().includes(needle)),
  );
  if (!framework) {
    throw new Error(
      `Could not match "${certName}" to a known certification framework. Add it manually from Settings > Certifications.`,
    );
  }
  const frameworkId = (framework as any).id;

  const { data: existing } = await supabase
    .from('organization_certifications')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('framework_id', frameworkId)
    .maybeSingle();

  if ((existing as any)?.id) {
    const { error } = await supabase
      .from('organization_certifications')
      .update({ status: 'self_declared' })
      .eq('id', (existing as any).id);
    if (error) throw new Error(error.message);
    return { table: 'organization_certifications', certification_id: (existing as any).id, matched: 'existing', framework_id: frameworkId };
  }

  const { data: created, error } = await supabase
    .from('organization_certifications')
    .insert({ organization_id: organizationId, framework_id: frameworkId, status: 'self_declared' })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { table: 'organization_certifications', certification_id: (created as any).id, matched: 'new', framework_id: frameworkId };
}

/**
 * Approving a production location found on the website creates a draft
 * `facilities` row (name + location only — the user fills in the rest from
 * the facility's own page). Dedupes on name within the org, same pattern as
 * `writeWebsiteSupplier`.
 */
async function writeWebsiteProductionLocation(
  supabase: SupabaseClient,
  organizationId: string,
  payload: any,
  titleFallback?: string | null,
): Promise<AppliedTo> {
  const location = (payload?.location || '').toString().trim();
  const name = location || (titleFallback || '').toString().trim();
  if (!name) throw new Error('Location missing from payload.');

  const { data: existing } = await supabase
    .from('facilities')
    .select('id')
    .eq('organization_id', organizationId)
    .ilike('name', name)
    .maybeSingle();
  if ((existing as any)?.id) {
    return { table: 'facilities', facility_id: (existing as any).id, matched: 'existing' };
  }

  const { data: created, error } = await supabase
    .from('facilities')
    .insert({
      organization_id: organizationId,
      name,
      location,
      location_address: location || null,
    })
    .select('id')
    .single();
  if (error) throw new Error(error.message);
  return { table: 'facilities', facility_id: (created as any).id, matched: 'new' };
}
