/**
 * Sender.net — Alkatera customers group backfill
 *
 * Iterates every Supabase auth user and adds them to the "alkatera customers"
 * group in Sender. Safe to re-run — the helper handles "already exists" by
 * attaching the existing subscriber to the group instead.
 *
 * Usage:
 *   pnpm tsx scripts/backfill-sender-subscribers.ts
 *   pnpm tsx scripts/backfill-sender-subscribers.ts --dry-run
 *   pnpm tsx scripts/backfill-sender-subscribers.ts --email someone@example.com
 *
 * Requires in .env.local:
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *   SENDER_API_TOKEN
 *   SENDER_ALKATERA_CUSTOMERS_GROUP_ID
 */

import * as fs from 'fs';
import * as path from 'path';
import { createClient } from '@supabase/supabase-js';
import { syncAlkateraCustomer } from '../lib/sender';

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
  dryRun: boolean;
  emailFilter?: string;
}

function parseArgs(): Args {
  const args: Args = { dryRun: false };
  const argv = process.argv.slice(2);
  for (let i = 0; i < argv.length; i++) {
    const flag = argv[i];
    if (flag === '--dry-run') {
      args.dryRun = true;
    } else if (flag === '--email' && argv[i + 1]) {
      args.emailFilter = argv[i + 1].toLowerCase();
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

  if (!process.env.SENDER_API_TOKEN) {
    console.error('Missing SENDER_API_TOKEN');
    process.exit(1);
  }
  if (!process.env.SENDER_ALKATERA_CUSTOMERS_GROUP_ID) {
    console.error('Missing SENDER_ALKATERA_CUSTOMERS_GROUP_ID');
    process.exit(1);
  }

  const supabase = createClient(supabaseUrl, supabaseKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  console.log(`Sender backfill — ${args.dryRun ? 'DRY RUN' : 'LIVE'}`);
  console.log(`Group ID: ${process.env.SENDER_ALKATERA_CUSTOMERS_GROUP_ID}`);
  if (args.emailFilter) console.log(`Filter: ${args.emailFilter}`);
  console.log('');

  const tally = { total: 0, ok: 0, alreadyExisted: 0, skipped: 0, error: 0 };
  const perPage = 1000;
  let page = 1;

  while (true) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage });
    if (error) {
      console.error(`Failed to list users on page ${page}:`, error);
      process.exit(1);
    }
    if (!data.users || data.users.length === 0) break;

    for (const user of data.users) {
      tally.total++;
      const email = user.email;
      if (!email) {
        tally.skipped++;
        console.log(`[SKIP]  ${user.id} — no email`);
        continue;
      }
      if (args.emailFilter && email.toLowerCase() !== args.emailFilter) {
        tally.skipped++;
        continue;
      }

      const fullName = typeof user.user_metadata?.full_name === 'string'
        ? user.user_metadata.full_name
        : null;

      if (args.dryRun) {
        console.log(`[DRY]   ${email}  ${fullName ?? ''}`);
        continue;
      }

      const result = await syncAlkateraCustomer({ email, fullName });
      if (result.ok && result.alreadyExisted) {
        tally.alreadyExisted++;
        console.log(`[EXIST] ${email} — attached to group`);
      } else if (result.ok) {
        tally.ok++;
        console.log(`[OK]    ${email}`);
      } else {
        tally.error++;
        console.log(`[ERR]   ${email} — ${result.error ?? 'unknown error'}`);
      }
    }

    if (data.users.length < perPage) break;
    page++;
  }

  console.log('');
  console.log('Summary');
  console.log(`  Total users seen:     ${tally.total}`);
  console.log(`  Added:                ${tally.ok}`);
  console.log(`  Already in Sender:    ${tally.alreadyExisted}`);
  console.log(`  Skipped:              ${tally.skipped}`);
  console.log(`  Errors:               ${tally.error}`);
}

main().catch((err) => {
  console.error('Backfill failed:', err);
  process.exit(1);
});
