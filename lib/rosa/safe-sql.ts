/**
 * Rosa -- Safe SQL executor.
 *
 * Runs a single SELECT against a whitelist of org-scoped tables. The guardrails
 * are layered so any one failing still blocks a cross-org leak:
 *
 *   1. Lexical validation  -- single statement, SELECT only, no DDL/DML keywords,
 *      no semicolons mid-statement, no comments, length cap.
 *   2. Table whitelist     -- every `FROM` / `JOIN` target must be on the list.
 *   3. Org-scope check     -- the query must reference `organization_id` in the
 *      WHERE clause. (Belt-and-braces: the Postgres RPC also wraps the query
 *      in a read-only transaction bound to the calling org.)
 *   4. Row cap             -- the RPC refuses to return more than 500 rows.
 *
 * The RPC `rosa_run_safe_sql(org_id uuid, q text)` lives in migration
 * 20260417000000_rosa_safe_sql.sql. It is SECURITY DEFINER but runs the query
 * inside a `SET LOCAL transaction_read_only = on` block so write attempts
 * from inside the query fail at the database level regardless of what the
 * lexer missed.
 */
import type { SupabaseClient } from '@supabase/supabase-js';

export const SAFE_SQL_ALLOWED_TABLES = [
  'metric_snapshots',
  'dashboard_anomalies',
  'dashboard_insights',
  'sustainability_targets',
  'facilities',
  'facility_activity_entries',
  'utility_data_entries',
  'products',
  'product_carbon_footprints',
  'product_carbon_footprint_results',
  'product_carbon_footprint_materials',
  'supplier_assessments',
  'suppliers',
  'supplier_products',
  'supplier_invitations',
  'production_runs',
  'production_logs',
  'calculated_emissions',
  'grid_carbon_readings',
  'gaia_knowledge_base',
  'generated_reports',
  'contract_manufacturer_allocations',
  'facility_archetypes',
  'rosa_memory',
] as const;

const FORBIDDEN_KEYWORDS = [
  'INSERT', 'UPDATE', 'DELETE', 'DROP', 'CREATE', 'ALTER', 'TRUNCATE',
  'GRANT', 'REVOKE', 'COPY', 'VACUUM', 'ANALYZE', 'EXECUTE', 'CALL',
  'DO', 'MERGE', 'REINDEX', 'CLUSTER', 'LOCK', 'LISTEN', 'NOTIFY',
  'SET', 'RESET', 'SAVEPOINT', 'ROLLBACK', 'COMMIT', 'BEGIN',
  'PREPARE', 'DISCARD',
];

const MAX_SQL_LENGTH = 4000;

export interface SafeSqlOk {
  ok: true;
  rows: Record<string, unknown>[];
}
export interface SafeSqlErr {
  ok: false;
  error: string;
}
export type SafeSqlResult = SafeSqlOk | SafeSqlErr;

/** Validate then dispatch. Returns a structured result; never throws. */
export async function runSafeSql(
  supabase: SupabaseClient,
  organizationId: string,
  rawSql: string,
): Promise<SafeSqlResult> {
  const validation = validateSql(rawSql);
  if (!validation.ok) return validation;

  const { data, error } = await supabase.rpc('rosa_run_safe_sql', {
    org_id: organizationId,
    q: validation.cleaned,
  });

  if (error) return { ok: false, error: error.message };

  // The RPC returns jsonb (an array of row-objects) or an error JSON object.
  if (data && typeof data === 'object' && 'error' in data) {
    return { ok: false, error: String((data as any).error) };
  }
  if (!Array.isArray(data)) {
    return { ok: false, error: 'Unexpected RPC response shape' };
  }
  return { ok: true, rows: data as Record<string, unknown>[] };
}

interface ValidatorOk { ok: true; cleaned: string; }
type ValidatorResult = ValidatorOk | SafeSqlErr;

export function validateSql(rawSql: string): ValidatorResult {
  if (!rawSql || typeof rawSql !== 'string') {
    return { ok: false, error: 'SQL is empty' };
  }
  if (rawSql.length > MAX_SQL_LENGTH) {
    return { ok: false, error: `SQL exceeds ${MAX_SQL_LENGTH} chars` };
  }

  // Strip trailing semicolons + whitespace; reject mid-statement ones.
  let trimmed = rawSql.trim();
  while (trimmed.endsWith(';')) trimmed = trimmed.slice(0, -1).trim();
  if (trimmed.includes(';')) {
    return { ok: false, error: 'Multiple statements not allowed' };
  }

  // Reject SQL comments. Comments can smuggle keywords past the scanner.
  if (/--|\/\*|\*\//.test(trimmed)) {
    return { ok: false, error: 'Comments not allowed' };
  }

  const upper = trimmed.toUpperCase();
  if (!upper.startsWith('SELECT') && !upper.startsWith('WITH')) {
    return { ok: false, error: 'Only SELECT (or WITH…SELECT) queries allowed' };
  }

  // Word-boundary match so "created_at" doesn't trip on "CREATE".
  for (const kw of FORBIDDEN_KEYWORDS) {
    const re = new RegExp(`\\b${kw}\\b`, 'i');
    if (re.test(trimmed)) {
      return { ok: false, error: `Forbidden keyword: ${kw}` };
    }
  }

  // Every FROM/JOIN target must be on the whitelist.
  const tableRefs = extractTableRefs(trimmed);
  const allowed = new Set<string>(SAFE_SQL_ALLOWED_TABLES);
  for (const t of tableRefs) {
    if (!allowed.has(t)) {
      return {
        ok: false,
        error: `Table "${t}" is not in the safe-SQL whitelist. Allowed: ${SAFE_SQL_ALLOWED_TABLES.join(', ')}`,
      };
    }
  }

  // Must reference organization_id somewhere in the query. The RPC cross-checks
  // but we want to fail early with a clear message for the model.
  if (!/\borganization_id\b/i.test(trimmed)) {
    return {
      ok: false,
      error: 'Query must filter on organization_id',
    };
  }

  return { ok: true, cleaned: trimmed };
}

/**
 * Pull table identifiers out of `FROM <t>` and `JOIN <t>` clauses, ignoring
 * schema qualifiers and aliases. Best-effort regex, not a full parser -- the
 * whitelist still decides what's allowed.
 */
function extractTableRefs(sql: string): string[] {
  const refs = new Set<string>();
  const re = /\b(?:FROM|JOIN)\s+(?:"?public"?\.)?"?([a-zA-Z_][a-zA-Z0-9_]*)"?/gi;
  let match: RegExpExecArray | null;
  while ((match = re.exec(sql)) !== null) {
    refs.add(match[1].toLowerCase());
  }
  return Array.from(refs);
}
