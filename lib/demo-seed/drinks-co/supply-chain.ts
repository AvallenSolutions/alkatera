import { monthEnd, type SeedCtx } from './shared';

interface SupplierSeed {
  name: string;
  sector: string;
  country: string;
  spend: number;
  email: string;
  esg: { labour: number; environment: number; ethics: number; hs: number; mgmt: number; rating: 'leader' | 'progressing' | 'needs_improvement'; submitted: boolean };
  engagement: { status: 'invited' | 'active' | 'data_provided' | 'inactive'; quality?: number };
}

const SUPPLIERS: SupplierSeed[] = [
  { name: 'Verallia UK', sector: 'Glass packaging', country: 'United Kingdom', spend: 142000, email: 'sales@verallia.example', esg: { labour: 78, environment: 72, ethics: 80, hs: 82, mgmt: 75, rating: 'progressing', submitted: true }, engagement: { status: 'data_provided', quality: 84 } },
  { name: 'Ardagh Metal Packaging', sector: 'Aluminium cans', country: 'United Kingdom', spend: 98000, email: 'uk@ardagh.example', esg: { labour: 84, environment: 86, ethics: 85, hs: 88, mgmt: 83, rating: 'leader', submitted: true }, engagement: { status: 'data_provided', quality: 91 } },
  { name: 'Crisp Malt', sector: 'Malted barley', country: 'United Kingdom', spend: 76000, email: 'orders@crispmalt.example', esg: { labour: 70, environment: 66, ethics: 72, hs: 74, mgmt: 68, rating: 'progressing', submitted: true }, engagement: { status: 'active', quality: 70 } },
  { name: 'Charles Faram', sector: 'Hops', country: 'United Kingdom', spend: 41000, email: 'hops@faram.example', esg: { labour: 64, environment: 60, ethics: 66, hs: 68, mgmt: 62, rating: 'progressing', submitted: true }, engagement: { status: 'active', quality: 63 } },
  { name: 'Amorim Cork', sector: 'Closures', country: 'Portugal', spend: 33000, email: 'export@amorim.example', esg: { labour: 80, environment: 90, ethics: 82, hs: 84, mgmt: 81, rating: 'leader', submitted: true }, engagement: { status: 'data_provided', quality: 88 } },
  { name: 'Multi-Color Labels', sector: 'Labels', country: 'United Kingdom', spend: 28000, email: 'hello@mclabels.example', esg: { labour: 58, environment: 52, ethics: 60, hs: 62, mgmt: 55, rating: 'needs_improvement', submitted: true }, engagement: { status: 'active', quality: 48 } },
  { name: 'DS Smith', sector: 'Secondary packaging', country: 'United Kingdom', spend: 36000, email: 'trade@dssmith.example', esg: { labour: 82, environment: 84, ethics: 80, hs: 83, mgmt: 79, rating: 'leader', submitted: true }, engagement: { status: 'data_provided', quality: 86 } },
  { name: 'Frugalpac', sector: 'Paper bottles', country: 'United Kingdom', spend: 19000, email: 'sales@frugalpac.example', esg: { labour: 72, environment: 88, ethics: 74, hs: 70, mgmt: 71, rating: 'progressing', submitted: true }, engagement: { status: 'active', quality: 67 } },
  { name: 'Kuehne + Nagel', sector: 'Logistics', country: 'United Kingdom', spend: 54000, email: 'uk.drinks@kn.example', esg: { labour: 66, environment: 58, ethics: 68, hs: 72, mgmt: 64, rating: 'progressing', submitted: false }, engagement: { status: 'invited' } },
  { name: 'Botanical Sourcing Co', sector: 'Botanicals', country: 'United Kingdom', spend: 22000, email: 'supply@botanical.example', esg: { labour: 50, environment: 48, ethics: 54, hs: 56, mgmt: 52, rating: 'needs_improvement', submitted: false }, engagement: { status: 'invited' } },
];

async function seedSuppliers(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  // suppliers cascade to ESG + engagements, so clearing the parent is enough.
  await svc.from('suppliers').delete().eq('organization_id', orgId);
  const { data: inserted, error } = await svc
    .from('suppliers')
    .insert(SUPPLIERS.map((s) => ({ organization_id: orgId, name: s.name, industry_sector: s.sector, country: s.country, annual_spend: s.spend, spend_currency: 'GBP', contact_email: s.email })))
    .select('id, name');
  if (error) throw new Error(`suppliers: ${error.message}`);
  const idByName = new Map((inserted ?? []).map((r: any) => [r.name, r.id]));

  const esgRows: Record<string, unknown>[] = [];
  const engRows: Record<string, unknown>[] = [];
  for (const s of SUPPLIERS) {
    const sid = idByName.get(s.name);
    if (!sid) continue;
    const total = Math.round((s.esg.labour + s.esg.environment + s.esg.ethics + s.esg.hs + s.esg.mgmt) / 5);
    esgRows.push({
      supplier_id: sid, score_labour: s.esg.labour, score_environment: s.esg.environment, score_ethics: s.esg.ethics,
      score_health_safety: s.esg.hs, score_management: s.esg.mgmt, score_total: total, score_rating: s.esg.rating,
      labour_human_rights_completed: s.esg.submitted, environment_completed: s.esg.submitted, ethics_completed: s.esg.submitted,
      health_safety_completed: s.esg.submitted, management_systems_completed: s.esg.submitted,
      submitted: s.esg.submitted, submitted_at: s.esg.submitted ? '2026-04-15T00:00:00Z' : null, is_verified: s.esg.rating === 'leader',
    });
    engRows.push({
      supplier_id: sid, status: s.engagement.status, invited_date: '2026-01-10',
      accepted_date: s.engagement.status === 'invited' ? null : '2026-01-24',
      data_submitted_date: s.engagement.status === 'data_provided' ? '2026-04-15' : null,
      data_quality_score: s.engagement.quality ?? null,
    });
  }
  if (esgRows.length) await svc.from('supplier_esg_assessments').upsert(esgRows, { onConflict: 'supplier_id' });
  if (engRows.length) await svc.from('supplier_engagements').insert(engRows);

  ctx.report.suppliers = `${SUPPLIERS.length} suppliers + ESG assessments + engagements`;
}

/** Xero connection + spend transactions that auto-link to suppliers and auto-tier by spend. */
async function seedXero(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  await svc.from('xero_connections').delete().eq('organization_id', orgId);
  await svc.from('xero_connections').insert({
    organization_id: orgId, xero_tenant_id: 'drinks-co-demo-tenant', xero_tenant_name: 'alkatera Drinks Co (demo)',
    access_token_encrypted: 'demo:demo:demo', refresh_token_encrypted: 'demo:demo:demo',
    token_expires_at: new Date(Date.now() + 90 * 864e5).toISOString(), scopes: ['offline_access', 'accounting.transactions.read'],
    sync_status: 'idle', last_sync_at: new Date().toISOString(),
  });

  await svc.from('xero_transactions').delete().eq('organization_id', orgId);
  const rows: Record<string, unknown>[] = [];
  let n = 0;
  // a handful of invoices per supplier across the last 8 months, keyed on contact name
  for (const s of SUPPLIERS) {
    const invoices = 3;
    for (let k = 0; k < invoices; k++) {
      const monthsAgo = 1 + k * 2;
      const date = monthEnd(monthsAgo);
      const amount = Math.round((s.spend / invoices) * (0.9 + 0.2 * (k / invoices)));
      const category = s.sector.includes('Logistics') ? 'transportation_distribution' : s.sector.includes('packaging') || s.sector.includes('Glass') || s.sector.includes('cans') || s.sector.includes('Closures') || s.sector.includes('Labels') || s.sector.includes('bottles') ? 'packaging' : 'raw_materials';
      rows.push({
        organization_id: orgId, xero_transaction_id: `drinksco-demo-${n++}`, xero_transaction_type: 'invoice',
        xero_contact_name: s.name, description: `${s.sector} supply`, amount, currency: 'GBP', transaction_date: date,
        emission_category: category, classification_source: 'auto', classification_confidence: 0.9,
        spend_based_emissions_kg: Math.round(amount * 0.35), data_quality_tier: 4, upgrade_status: 'pending',
        reporting_year: Number(date.slice(0, 4)),
      });
    }
  }
  const { error } = await svc.from('xero_transactions').insert(rows);
  if (error) throw new Error(`xero_transactions: ${error.message}`);
  ctx.report.xero = `Xero connection + ${rows.length} spend transactions (auto-linkable to suppliers)`;
}

/** Operational change events + one anomaly so the Pulse "why" explainer has content. */
async function seedAnomalies(ctx: SeedCtx): Promise<void> {
  const { svc, orgId } = ctx;

  await svc.from('operational_change_events').delete().eq('organization_id', orgId);
  await svc.from('operational_change_events').insert([
    { organization_id: orgId, description: 'Switched all owned sites to REGO-backed renewable electricity', event_date: '2025-10-01', scope: 'scope2', impact_direction: 'decrease', category: 'electricity', estimated_impact_kgco2e: -5200 },
    { organization_id: orgId, description: 'Launched the Floral Haze IPA line, increasing purchased malt and cans', event_date: '2026-02-01', scope: 'scope3', impact_direction: 'increase', category: 'purchased_goods', estimated_impact_kgco2e: 3100 },
    { organization_id: orgId, description: 'Began diverting spent grain to anaerobic digestion', event_date: '2026-03-15', scope: 'scope3', impact_direction: 'decrease', category: 'waste', estimated_impact_kgco2e: -1400 },
  ]);

  const detected = `${monthEnd(2)}T09:00:00Z`;
  await svc.from('dashboard_anomalies').upsert(
    { organization_id: orgId, metric_key: 'water_consumption', detected_at: detected, severity: 'medium', observed: 11200, expected: 9000, z_score: 2.3, status: 'open', notes: 'Water intake stepped up after the IPA line launch; CIP cycles under review.' },
    { onConflict: 'organization_id,metric_key,detected_at' },
  );

  ctx.report.anomalies = '3 operational change events + 1 open anomaly';
}

export async function seedSupplyChain(ctx: SeedCtx): Promise<void> {
  await seedSuppliers(ctx);
  await seedXero(ctx);
  await seedAnomalies(ctx);
}
