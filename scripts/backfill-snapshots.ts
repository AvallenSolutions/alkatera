/**
 * Pulse — Snapshot backfill
 *
 * Walks back N days for every organisation and writes one snapshot per day.
 * Run once after the metric_snapshots table is created so the dashboard has
 * meaningful sparklines on day one.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-snapshots.ts                 # default 365 days
 *   pnpm tsx scripts/backfill-snapshots.ts --days 90       # last 90 days
 *   pnpm tsx scripts/backfill-snapshots.ts --org <uuid>    # one org only
 *   pnpm tsx scripts/backfill-snapshots.ts --step 7        # weekly samples
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in env.
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { computeOrgSnapshots, writeSnapshots } from '../lib/pulse/snapshots';

// Load .env.local manually so we don't depend on dotenv being installed.
// Mirrors how Next.js loads it for the dev server.
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
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

loadEnvFile(path.resolve(process.cwd(), '.env.local'));
loadEnvFile(path.resolve(process.cwd(), '.env'));

interface Args {
  days: number;
  step: number;
  orgId?: string;
}

function parseArgs(): Args {
  const args: Args = { days: 365, step: 1 };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    const next = argv[i + 1];
    if (flag === '--days' && next) {
      args.days = parseInt(next, 10);
      i++;
    } else if (flag === '--step' && next) {
      args.step = parseInt(next, 10);
      i++;
    } else if (flag === '--org' && next) {
      args.orgId = next;
      i++;
    }
  }
  return args;
}

async function main() {
  const args = parseArgs();
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey =
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const orgQuery = supabase.from('organizations').select('id, name');
  const { data: orgs, error: orgError } = args.orgId
    ? await orgQuery.eq('id', args.orgId)
    : await orgQuery;

  if (orgError) {
    console.error('Failed to list organisations:', orgError);
    process.exit(1);
  }
  if (!orgs || orgs.length === 0) {
    console.log('No organisations found. Nothing to backfill.');
    return;
  }

  console.log(
    `Backfilling ${args.days} days (step ${args.step}) for ${orgs.length} organisation(s)...`,
  );

  const today = new Date();
  let totalWritten = 0;
  let totalFailures = 0;

  for (const org of orgs) {
    let orgWritten = 0;
    for (let dayOffset = 0; dayOffset <= args.days; dayOffset += args.step) {
      const asOf = new Date(today);
      asOf.setUTCDate(asOf.getUTCDate() - dayOffset);

      try {
        const rows = await computeOrgSnapshots(supabase, org.id, asOf);
        const { written, error } = await writeSnapshots(supabase, rows);
        if (error) {
          console.error(`  [${org.name}] ${asOf.toISOString().slice(0, 10)} write error:`, error);
          totalFailures += 1;
        } else {
          orgWritten += written;
        }
      } catch (err: any) {
        console.error(`  [${org.name}] ${asOf.toISOString().slice(0, 10)} compute error:`, err?.message);
        totalFailures += 1;
      }
    }
    totalWritten += orgWritten;
    console.log(`  [${org.name}] wrote ${orgWritten} snapshot rows`);
  }

  console.log(
    `\nDone. ${totalWritten} rows written across ${orgs.length} organisation(s). ${totalFailures} failures.`,
  );
}

main().catch(err => {
  console.error('Backfill crashed:', err);
  process.exit(1);
});
