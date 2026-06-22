/**
 * Generates the `subscription_tier_limits` seed/sync migration from code, the
 * single source of truth:
 *   - feature lists  → lib/subscription/feature-catalog.ts
 *   - limits/prices  → lib/stripe-config.ts (TIER_PRICING)
 *
 * Usage:
 *   npx tsx scripts/gen-tier-features-sql.ts > supabase/migrations/<ts>_tier_features_single_source.sql
 *
 * Each tier is emitted as an idempotent INSERT ... ON CONFLICT so a fresh/local
 * database gets correct rows and an existing one (prod) is kept in sync. The
 * migration also fixes the `check_feature_access` RPC (was querying a
 * non-existent `tier` column and using `= ANY()` against a JSONB value); that
 * repair lives in `scripts/sql/check_feature_access.sql` and is appended.
 *
 * `max_api_calls_per_month` and `max_storage_mb` are intentionally NOT managed
 * here (no representation in code) — they keep their existing DB values.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { featuresForTier, TIER_NAMES, TIER_LEVELS } from '../lib/subscription/feature-catalog';
import { TIER_PRICING } from '../lib/stripe-config';

const sq = (s: string) => `'${s.replace(/'/g, "''")}'`; // single-quote + escape for SQL

const lines: string[] = [];
lines.push('-- GENERATED FILE — do not edit by hand.');
lines.push('-- Source of truth: lib/subscription/feature-catalog.ts (features) + lib/stripe-config.ts (limits/prices)');
lines.push('-- Regenerate: npx tsx scripts/gen-tier-features-sql.ts > supabase/migrations/<ts>_tier_features_single_source.sql');
lines.push('--');
lines.push('-- Upserts each tier row (idempotent) so fresh/local DBs are seeded and prod stays');
lines.push('-- in sync, then repairs the check_feature_access RPC to match the client gate.');
lines.push('');

for (const tier of TIER_NAMES) {
  const p = TIER_PRICING[tier];
  const features = featuresForTier(tier);
  lines.push(`-- ${tier}: ${features.length} features`);
  lines.push('INSERT INTO public.subscription_tier_limits');
  lines.push('  (tier_name, tier_level, display_name, description,');
  lines.push('   max_products, max_lcas, max_team_members, max_facilities, max_suppliers, max_reports_per_month,');
  lines.push('   monthly_price_gbp, annual_price_gbp, features_enabled, is_active, updated_at)');
  lines.push('VALUES');
  lines.push(
    `  (${sq(tier)}, ${TIER_LEVELS[tier]}, ${sq(p.displayName)}, ${sq(p.description)},`
  );
  lines.push(
    `   ${p.limits.products}, ${p.limits.lcas}, ${p.limits.teamMembers}, ${p.limits.facilities}, ${p.limits.suppliers}, ${p.limits.reportsPerMonth},`
  );
  lines.push(
    `   ${p.monthlyPrice}, ${p.annualPrice}, '${JSON.stringify(features)}'::jsonb, true, now())`
  );
  lines.push('ON CONFLICT (tier_name) DO UPDATE SET');
  lines.push('  tier_level = EXCLUDED.tier_level,');
  lines.push('  display_name = EXCLUDED.display_name,');
  lines.push('  description = EXCLUDED.description,');
  lines.push('  max_products = EXCLUDED.max_products,');
  lines.push('  max_lcas = EXCLUDED.max_lcas,');
  lines.push('  max_team_members = EXCLUDED.max_team_members,');
  lines.push('  max_facilities = EXCLUDED.max_facilities,');
  lines.push('  max_suppliers = EXCLUDED.max_suppliers,');
  lines.push('  max_reports_per_month = EXCLUDED.max_reports_per_month,');
  lines.push('  monthly_price_gbp = EXCLUDED.monthly_price_gbp,');
  lines.push('  annual_price_gbp = EXCLUDED.annual_price_gbp,');
  lines.push('  features_enabled = EXCLUDED.features_enabled,');
  lines.push('  is_active = true,');
  lines.push('  updated_at = now();');
  lines.push('');
}

// Static RPC repair, read from a sibling .sql file (kept out of this script so
// the PL/pgSQL `$$` dollar-quoting doesn't confuse the TS parser).
const rpcSqlPath = fileURLToPath(new URL('./sql/check_feature_access.sql', import.meta.url));
lines.push(readFileSync(rpcSqlPath, 'utf8').trimEnd());
lines.push('');

process.stdout.write(lines.join('\n'));
