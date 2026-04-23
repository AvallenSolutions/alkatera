/**
 * Pulse -- Shadow prices helper.
 *
 * Resolves the most relevant price row for a given org + metric, and formats
 * a monetary overlay for a snapshot value. The resolution order is:
 *
 *   1. Most recent org-specific row with effective_from <= today.
 *   2. Most recent global row (organization_id IS NULL) with the same rule.
 *   3. null -- no overlay is shown.
 *
 * The helper is intentionally synchronous-after-load: load all prices for an
 * org once per render, then monetise each tile against the cached map.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import type { MetricKey } from './metric-keys';

export interface ShadowPrice {
  metric_key: MetricKey;
  currency: string;
  price_per_unit: number;
  /** Display unit the price is quoted in (e.g. "tCO2e", "m3"). */
  unit: string;
  /** Multiplier applied to a metric_snapshots.value to reach `unit`. */
  native_unit_multiplier: number;
  source: string | null;
  effective_from: string;
  /** True when this came from an org-specific row, false for the global default. */
  is_org_override: boolean;
}

/** Load every price row that could apply to an org today, keyed by metric. */
export async function loadShadowPrices(
  supabase: SupabaseClient,
  organizationId: string,
): Promise<Record<string, ShadowPrice>> {
  const today = new Date().toISOString().slice(0, 10);

  // Single round-trip: pull org-specific AND global rows, then reduce in JS.
  // We cap effective_from at today to ignore future-dated prices set for
  // forward-looking scenarios.
  const { data, error } = await supabase
    .from('org_shadow_prices')
    .select(
      'organization_id, metric_key, currency, price_per_unit, unit, native_unit_multiplier, source, effective_from',
    )
    .or(`organization_id.eq.${organizationId},organization_id.is.null`)
    .lte('effective_from', today)
    .order('effective_from', { ascending: false });

  if (error) {
    console.error('[pulse shadow-prices] load failed:', error.message);
    return {};
  }

  const byMetric: Record<string, ShadowPrice> = {};
  for (const row of data ?? []) {
    const key = row.metric_key as string;
    const candidate: ShadowPrice = {
      metric_key: key as MetricKey,
      currency: row.currency,
      price_per_unit: Number(row.price_per_unit),
      unit: row.unit,
      native_unit_multiplier: Number(row.native_unit_multiplier ?? 1),
      source: row.source ?? null,
      effective_from: row.effective_from,
      is_org_override: row.organization_id === organizationId,
    };
    // Rows are sorted by effective_from desc. Keep the first hit per metric,
    // but prefer an org override over a later-dated global row.
    const existing = byMetric[key];
    if (!existing) {
      byMetric[key] = candidate;
    } else if (!existing.is_org_override && candidate.is_org_override) {
      byMetric[key] = candidate;
    }
  }
  return byMetric;
}

export interface MonetisedValue {
  amount: number;
  currency: string;
  /** Human-readable string e.g. "£272,000". */
  formatted: string;
  /** Provenance string for inline display, e.g. "£85/tCO2e -- UK ETS April 2026". */
  rate_label: string;
}

/** Apply a shadow price to a metric value. Returns null when no price applies. */
export function monetise(
  value: number,
  price: ShadowPrice | undefined,
): MonetisedValue | null {
  if (!price || !Number.isFinite(value)) return null;

  const amount = value * price.native_unit_multiplier * price.price_per_unit;
  if (!Number.isFinite(amount)) return null;

  const locale = price.currency === 'GBP' ? 'en-GB' : price.currency === 'EUR' ? 'en-IE' : 'en-US';
  const formatted = amount.toLocaleString(locale, {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: Math.abs(amount) >= 1000 ? 0 : 2,
    notation: Math.abs(amount) >= 100_000 ? 'compact' : 'standard',
  });

  const rateFormatted = price.price_per_unit.toLocaleString(locale, {
    style: 'currency',
    currency: price.currency,
    maximumFractionDigits: 2,
  });
  const rateLabel = price.source
    ? `${rateFormatted}/${price.unit} -- ${price.source}`
    : `${rateFormatted}/${price.unit}`;

  return {
    amount,
    currency: price.currency,
    formatted,
    rate_label: rateLabel,
  };
}
