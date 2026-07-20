import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * Shared context, helpers and constants for the alkatera Drinks Co demo seed.
 *
 * The seed is service-role and idempotent: re-running it converges on the same
 * dataset rather than duplicating rows.
 *
 * The calculator is browser-only, so a service-role seeder cannot invoke it.
 * lca.ts therefore writes COMPLETED PCFs directly with hand-modelled impacts,
 * and every product shows a footprint immediately. Do not run the recalc tool
 * afterwards: it would find no draft allocations to work from and skip every
 * product. This comment used to say the opposite.
 */

export const DRINKS_CO_ORG_ID = 'b0a00000-0000-4000-8000-000000000001';

/**
 * The org owner on PRODUCTION (hello@alkatera.com). Only foundation.ts should
 * read this constant: it checks whether this auth user exists and falls back to
 * a local admin/first user otherwise. Everything else must use ctx.ownerUserId.
 */
export const OWNER_USER_ID = '27ea31a3-949c-4107-bcd1-e1b1eff818d1';

/** The six real facilities (stable seeded UUIDs). */
export const FACILITIES = {
  winery: 'b0a10001-0000-4000-8000-000000000001',
  distillery: 'b0a10001-0000-4000-8000-000000000002',
  bottling: 'b0a10001-0000-4000-8000-000000000003', // third-party
  brewery: 'b0a10001-0000-4000-8000-000000000004',
  headOffice: 'b0a10001-0000-4000-8000-000000000005',
  botanical: 'b0a10001-0000-4000-8000-000000000006', // third-party
} as const;

/** Junk facilities created by earlier imports — removed during curation. */
export const JUNK_FACILITY_IDS = [
  '241cf877-1aa6-401a-bf3d-ae00b98e9b06', // "Brewery"
  'f77a74b0-38b1-468a-b8bd-0265d41740a4', // "alkatera Drinks Co Facility"
];

/** Owned facilities that record Scope 1 & 2 operational activity. */
export const OWNED_ACTIVITY_FACILITIES = [
  FACILITIES.winery,
  FACILITIES.distillery,
  FACILITIES.brewery,
  FACILITIES.headOffice,
] as const;

export const VINEYARD_ID = 'b0a20001-0000-4000-8000-000000000001';

/** Stable orchard UUID we create for the Calvados apples. */
export const ORCHARD_ID = 'b0a30001-0000-4000-8000-000000000001';

/**
 * Showcase products to keep + finalise, keyed by their existing product id.
 * Everything else on the org is removed during curation.
 */
export const KEEP_PRODUCT_IDS = [130, 131, 132, 133, 134, 228, 229, 235, 236];

/** Draft/duplicate products removed during curation. */
export const DELETE_PRODUCT_IDS = [230, 231, 232, 233, 234, 237, 238, 239, 240, 241, 242, 243, 244];

export const PRODUCTS = {
  bacchus: 130, // Wine — viticulture
  highlandMalt: 131, // Spirits — maturation
  sessionAle: 132, // Beer & Cider
  botanicaZero: 133, // Non-Alcoholic — third-party proxy
  bathGin: 134, // Spirits
  calvadosGlass: 228, // Spirits — orchard
  calvadosPaper: 229, // Spirits — packaging comparison
  ipaCase: 235, // Beer & Cider — multipack
  ipaCan: 236, // Beer & Cider — multipack component
} as const;

/** How many months of operational history to seed. */
export const HISTORY_MONTHS = 24;

/** The reference year used for LCAs + the latest full activity year. */
export const REFERENCE_YEAR = 2025;

export interface SeedCtx {
  svc: SupabaseClient;
  orgId: string;
  /**
   * The auth user every created_by/uploaded_by/user_id row is attributed to.
   * Resolved at runtime by foundation.ts (prod's owner when it exists, else a
   * local admin/first user), so the seed works on environments where the prod
   * owner account does not exist.
   */
  ownerUserId: string;
  /** Section -> human-readable count summary, surfaced in the API response. */
  report: Record<string, string>;
  /** Non-fatal warnings (e.g. a junk facility that couldn't be removed). */
  warnings: string[];
}

export function makeCtx(svc: SupabaseClient): SeedCtx {
  return { svc, orgId: DRINKS_CO_ORG_ID, ownerUserId: OWNER_USER_ID, report: {}, warnings: [] };
}

/** ISO date (YYYY-MM-DD) for the first of the month, n months before now. */
export function monthStart(monthsAgo: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo, 1));
  return d.toISOString().slice(0, 10);
}

/** ISO date for the last day of the month, n months before now. */
export function monthEnd(monthsAgo: number, now = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - monthsAgo + 1, 0));
  return d.toISOString().slice(0, 10);
}

/**
 * A smooth downward (improving) multiplier across the history window: index 0
 * is the oldest month (highest), the latest month sits at `floor`. Used to make
 * emissions/consumption trend down over time. `seasonal` adds a gentle sine wave.
 */
export function trendFactor(
  monthIndex: number,
  totalMonths: number,
  floor = 0.78,
  seasonalAmp = 0.06,
): number {
  const progress = totalMonths <= 1 ? 1 : monthIndex / (totalMonths - 1); // 0 oldest -> 1 newest
  const decline = 1 - (1 - floor) * progress;
  const seasonal = 1 + seasonalAmp * Math.sin((monthIndex / 12) * 2 * Math.PI);
  return decline * seasonal;
}

/** Insert rows, ignoring duplicate-key conflicts so the seed stays idempotent. */
export async function upsert(
  ctx: SeedCtx,
  table: string,
  rows: Record<string, unknown>[],
  onConflict?: string,
): Promise<number> {
  if (rows.length === 0) return 0;
  const q = ctx.svc.from(table).upsert(rows, onConflict ? { onConflict, ignoreDuplicates: false } : { ignoreDuplicates: true });
  const { error } = await q;
  if (error) throw new Error(`${table}: ${error.message}`);
  return rows.length;
}

/**
 * Delete-then-insert for tables with no natural unique key, scoped by a match
 * object so re-running the seed replaces exactly the rows it owns.
 */
export async function replaceRows(
  ctx: SeedCtx,
  table: string,
  match: Record<string, unknown>,
  rows: Record<string, unknown>[],
): Promise<number> {
  const del = ctx.svc.from(table).delete();
  let builder = del;
  for (const [k, v] of Object.entries(match)) builder = builder.eq(k, v as never);
  const { error: delErr } = await builder;
  if (delErr) throw new Error(`${table} (clear): ${delErr.message}`);
  if (rows.length === 0) return 0;
  const { error } = await ctx.svc.from(table).insert(rows);
  if (error) throw new Error(`${table} (insert): ${error.message}`);
  return rows.length;
}
