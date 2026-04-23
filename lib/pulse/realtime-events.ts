/**
 * Pulse — Realtime event types + humanisation.
 *
 * Each Supabase Realtime event from one of the watched tables gets
 * normalised into a PulseEvent. The humaniser produces the short,
 * human-readable line shown in <LiveActivityFeed />.
 */

import type { MetricKey } from './metric-keys';

export type PulseEventKind =
  | 'emissions_entry'
  | 'lca_progress'
  | 'supplier_update'
  | 'production_log'
  | 'metric_snapshot';

export interface PulseEvent {
  /** Stable id used for React keys + de-dupe. */
  id: string;
  kind: PulseEventKind;
  table: string;
  occurredAt: Date;
  /** Raw row from Supabase. */
  record: Record<string, any>;
  /** Which dashboard metrics this event likely affects. Used to flash MetricCards. */
  affectsMetrics: MetricKey[];
  /** Short human-readable description for the activity feed. */
  description: string;
}

interface RawPayload {
  table: string;
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, any> | null;
  old: Record<string, any> | null;
  commit_timestamp?: string;
}

/**
 * Convert a Supabase Realtime payload into a normalised PulseEvent.
 * Returns null for events we don't surface (e.g. DELETE, irrelevant tables).
 */
export function normalisePayload(payload: RawPayload): PulseEvent | null {
  // We don't surface deletes in the live feed.
  if (payload.eventType === 'DELETE') return null;
  const row = payload.new;
  if (!row) return null;

  const occurredAt = payload.commit_timestamp
    ? new Date(payload.commit_timestamp)
    : new Date();
  const id = `${payload.table}:${row.id ?? crypto.randomUUID()}:${occurredAt.getTime()}`;

  switch (payload.table) {
    case 'facility_activity_entries':
      return {
        id,
        kind: 'emissions_entry',
        table: payload.table,
        occurredAt,
        record: row,
        affectsMetrics: ['total_co2e', 'water_consumption'],
        description: describeFacilityEntry(row, payload.eventType),
      };

    case 'product_carbon_footprints': {
      // Only surface meaningful status transitions, not draft auto-saves.
      if (payload.eventType === 'UPDATE' && row.status !== 'completed') {
        return null;
      }
      return {
        id,
        kind: 'lca_progress',
        table: payload.table,
        occurredAt,
        record: row,
        affectsMetrics: ['products_assessed', 'lca_completeness_pct'],
        description: describeLcaProgress(row, payload.eventType),
      };
    }

    case 'supplier_products':
      return {
        id,
        kind: 'supplier_update',
        table: payload.table,
        occurredAt,
        record: row,
        affectsMetrics: [],
        description: describeSupplierUpdate(row, payload.eventType),
      };

    case 'production_logs':
      return {
        id,
        kind: 'production_log',
        table: payload.table,
        occurredAt,
        record: row,
        affectsMetrics: ['total_co2e'],
        description: describeProductionLog(row),
      };

    case 'metric_snapshots':
      return {
        id,
        kind: 'metric_snapshot',
        table: payload.table,
        occurredAt,
        record: row,
        affectsMetrics: row.metric_key ? [row.metric_key as MetricKey] : [],
        description: `Snapshot refreshed: ${row.metric_key}`,
      };

    default:
      return null;
  }
}

function describeFacilityEntry(row: any, event: 'INSERT' | 'UPDATE'): string {
  const verb = event === 'INSERT' ? 'logged' : 'updated';
  const category = row.activity_category ?? 'activity';
  const facilityHint = row.facility_id ? `at facility ${shortId(row.facility_id)}` : '';
  return `Facility ${category} ${verb} ${facilityHint}`.trim();
}

function describeLcaProgress(row: any, event: 'INSERT' | 'UPDATE'): string {
  if (event === 'UPDATE' && row.status === 'completed') {
    return `LCA completed for ${row.product_name ?? 'a product'}`;
  }
  return `New LCA started: ${row.product_name ?? 'unnamed product'}`;
}

function describeSupplierUpdate(row: any, event: 'INSERT' | 'UPDATE'): string {
  const verb = event === 'INSERT' ? 'added' : 'updated';
  return `Supplier link ${verb}`;
}

function describeProductionLog(row: any): string {
  const units = row.units_produced ?? row.volume ?? '?';
  const unit = row.unit ?? 'units';
  return `Production logged: ${formatQuantity(units)} ${unit}`;
}

function shortId(id: string): string {
  return id.slice(0, 6);
}

function formatQuantity(value: any): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return String(value);
  return n.toLocaleString('en-GB', { maximumFractionDigits: 1 });
}

/** Cap the in-memory event ring buffer so long-running tabs don't leak memory. */
export const MAX_EVENT_BUFFER = 100;
