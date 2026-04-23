/**
 * Pulse — full smoke test
 *
 * 1. Loads .env.local
 * 2. Hits each Pulse cron endpoint against the local dev server
 * 3. Reports row counts in each Pulse table
 *
 * Run: npx tsx scripts/test-pulse.ts
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';

function loadEnvFile(filePath: string): void {
  if (!fs.existsSync(filePath)) return;
  const content = fs.readFileSync(filePath, 'utf-8');
  for (const rawLine of content.split('\n')) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;
    const eq = line.indexOf('=');
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnvFile(path.resolve(process.cwd(), '.env.local'));

const BASE = process.env.PULSE_TEST_BASE_URL ?? 'http://localhost:8888';
const CRON = process.env.CRON_SECRET;
if (!CRON) { console.error('CRON_SECRET missing'); process.exit(1); }

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_SERVICE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

interface CronResult { name: string; status: number; ms: number; body: unknown; error?: string }

async function hitCron(name: string, path: string): Promise<CronResult> {
  const t0 = Date.now();
  try {
    const res = await fetch(`${BASE}${path}`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${CRON}`, 'Content-Type': 'application/json' },
    });
    const body = await res.json().catch(() => ({}));
    return { name, status: res.status, ms: Date.now() - t0, body };
  } catch (err: any) {
    return { name, status: 0, ms: Date.now() - t0, body: null, error: err?.message ?? 'network' };
  }
}

async function tableCount(table: string, filter?: { col: string; eq: any }): Promise<number | string> {
  let q = supabase.from(table).select('*', { count: 'exact', head: true });
  if (filter) q = q.eq(filter.col, filter.eq);
  const { count, error } = await q;
  if (error) return `ERR: ${error.message}`;
  return count ?? 0;
}

async function sample(table: string, fields: string, limit = 2): Promise<any[]> {
  const { data, error } = await supabase.from(table).select(fields).order('created_at', { ascending: false }).limit(limit);
  if (error) return [{ error: error.message }];
  return data ?? [];
}

async function main() {
  console.log('\n===== PULSE FULL SMOKE TEST =====\n');
  console.log(`Base URL: ${BASE}`);
  console.log(`CRON_SECRET: ${(CRON ?? '').slice(0, 6)}…`);

  // ── Cron endpoints ────────────────────────────────────────────────────
  console.log('\n--- Cron endpoints ---');
  const crons: { name: string; path: string }[] = [
    { name: 'snapshots',   path: '/api/cron/generate-snapshots' },
    { name: 'grid-carbon', path: '/api/cron/refresh-grid-carbon' },
    { name: 'anomalies',   path: '/api/cron/detect-anomalies' },
    // insights deliberately last — uses Anthropic credits.
    { name: 'insights',    path: '/api/cron/generate-insights' },
    { name: 'shadow-prices', path: '/api/cron/refresh-shadow-prices' },
  ];
  for (const c of crons) {
    const res = await hitCron(c.name, c.path);
    const tag = res.status === 200 ? '✓' : '✗';
    console.log(`${tag} ${c.name.padEnd(12)} ${String(res.status).padStart(3)} ${String(res.ms).padStart(5)}ms`);
    console.log('   ', JSON.stringify(res.body).slice(0, 300));
    if (res.error) console.log('    error:', res.error);
  }

  // ── Auth gate ─────────────────────────────────────────────────────────
  console.log('\n--- Auth gate (expect 401 on cron endpoints w/o bearer) ---');
  const noAuth = await fetch(`${BASE}/api/cron/generate-snapshots`, { method: 'POST' });
  console.log(noAuth.status === 401 ? '✓ snapshots cron rejects unauth' : `✗ unexpected ${noAuth.status}`);

  // ── DB row counts ────────────────────────────────────────────────────
  console.log('\n--- DB row counts ---');
  const tables = [
    { table: 'metric_snapshots',     fields: 'organization_id, metric_key, snapshot_date, value, unit' },
    { table: 'dashboard_insights',   fields: 'organization_id, headline, model, generated_at' },
    { table: 'sustainability_targets', fields: 'organization_id, metric_key, target_value, target_date' },
    { table: 'dashboard_anomalies',  fields: 'organization_id, metric_key, severity, z_score, status' },
    { table: 'grid_carbon_readings', fields: 'region_code, recorded_at, intensity_g_per_kwh' },
    { table: 'dashboard_layouts',    fields: 'user_id, organization_id, updated_at' },
  ];
  for (const t of tables) {
    const count = await tableCount(t.table);
    console.log(`  ${t.table.padEnd(28)} ${String(count).padStart(6)} rows`);
  }

  // ── Sample rows ──────────────────────────────────────────────────────
  console.log('\n--- Sample rows ---');
  for (const t of tables) {
    const rows = await sample(t.table, t.fields, 1);
    console.log(`  ${t.table}:`);
    if (rows.length === 0) {
      console.log('    (empty)');
    } else {
      console.log('   ', JSON.stringify(rows[0]));
    }
  }

  // ── Peer benchmark view ─────────────────────────────────────────────
  console.log('\n--- Peer benchmark view ---');
  const { data: peer, error: peerErr } = await supabase
    .from('peer_benchmark_view').select('*').limit(10);
  if (peerErr) console.log('  ✗', peerErr.message);
  else console.log(`  ${peer?.length ?? 0} metrics passing k≥5: ${peer?.map((p: any) => p.metric_key).join(', ') || '(none)'}`);

  console.log('\n===== END =====\n');
}

main().catch(e => { console.error('CRASH:', e); process.exit(1); });
