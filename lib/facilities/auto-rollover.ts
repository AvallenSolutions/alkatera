/**
 * Automatic utility rollover: the "estimate-first defaults" half of Pillar 2
 * (tasks/data-revolution-plan.md) applied to facility utilities. The
 * existing `UtilityRolloverDialog` (components/facilities/UtilityRolloverDialog.tsx)
 * is a manual, per-entry copy-and-edit flow the user has to open; this
 * module is the same idea run automatically for whatever the facility is
 * missing, so the utilities list is never empty for a facility with history.
 *
 * Policy, deliberately conservative:
 *   - Only facilities with at least one entry in the prior reporting year
 *     are eligible — a genuinely new facility has nothing to roll forward,
 *     and inventing a number with no prior evidence at all is a guess, not
 *     an estimate.
 *   - A candidate is only created for a (utility_type, period) pair that has
 *     NO entry yet in the current reporting year — smart-meter ingestion
 *     and manual entries both write to `utility_data_entries`
 *     (lib/energy/ingest-readings.ts), so this same "does a row already
 *     exist" check is what prevents double-counting against real data; no
 *     separate smart-meter conflict pre-flight is needed here (contrast
 *     with the manual dialog, which warns before overwriting).
 *   - Every created row is stamped `data_quality: 'estimated'`
 *     (provenance: `lib/provenance`'s `provenanceFromDataQuality('estimated')`
 *     → `'estimated'`) and a note naming the source entry, so it reads
 *     identically to a manual rollover everywhere the platform shows
 *     provenance.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getYearRangeForOrg, getLabelYearForDate } from '@/lib/log-data/period-utils';
import { UTILITY_TYPES } from '@/lib/constants/utility-types';

export interface RolloverCandidate {
  sourceEntryId: string;
  utilityType: string;
  quantity: number;
  unit: string;
  reportingPeriodStart: string;
  reportingPeriodEnd: string;
  activityDate: string | null;
}

interface UtilityRow {
  id: string;
  utility_type: string;
  quantity: number;
  unit: string;
  reporting_period_start: string;
  reporting_period_end: string;
  activity_date: string | null;
  notes: string | null;
}

function shiftDateByYears(date: string, years: number): string {
  const d = new Date(date);
  d.setFullYear(d.getFullYear() + years);
  return d.toISOString().split('T')[0];
}

/**
 * Pure matcher: does `current` already cover the same utility_type and the
 * same shifted period as `priorEntry`? Matched on utility_type + shifted
 * start date, which is exact for the common monthly/quarterly/annual
 * cadences this platform uses (UtilityRolloverDialog shifts the same way).
 */
function isAlreadyCovered(priorEntry: UtilityRow, shiftYears: number, current: UtilityRow[]): boolean {
  const shiftedStart = shiftDateByYears(priorEntry.reporting_period_start, shiftYears);
  return current.some((c) => c.utility_type === priorEntry.utility_type && c.reporting_period_start === shiftedStart);
}

/**
 * Compute what would roll forward, without writing anything. `fyStartMonth`
 * defaults to calendar year (1); pass the organisation's actual
 * `report_defaults.reporting_period.fiscal_year_start_month` when known.
 */
export function computeRolloverCandidates(
  priorYearEntries: UtilityRow[],
  currentYearEntries: UtilityRow[],
  shiftYears: number,
): RolloverCandidate[] {
  const candidates: RolloverCandidate[] = [];
  for (const entry of priorYearEntries) {
    if (isAlreadyCovered(entry, shiftYears, currentYearEntries)) continue;
    candidates.push({
      sourceEntryId: entry.id,
      utilityType: entry.utility_type,
      quantity: entry.quantity,
      unit: entry.unit,
      reportingPeriodStart: shiftDateByYears(entry.reporting_period_start, shiftYears),
      reportingPeriodEnd: shiftDateByYears(entry.reporting_period_end, shiftYears),
      activityDate: entry.activity_date ? shiftDateByYears(entry.activity_date, shiftYears) : null,
    });
  }
  return candidates;
}

/**
 * Fetch the prior and current reporting-year entries for a facility and
 * compute candidates. Read-only.
 */
export async function detectRolloverCandidates(
  db: SupabaseClient,
  facilityId: string,
  fyStartMonth: number = 1,
): Promise<RolloverCandidate[]> {
  const currentLabelYear = getLabelYearForDate(new Date(), fyStartMonth);
  const priorLabelYear = currentLabelYear - 1;
  const { yearStart: priorStart, yearEnd: priorEnd } = getYearRangeForOrg(priorLabelYear, fyStartMonth);
  const { yearStart: currentStart, yearEnd: currentEnd } = getYearRangeForOrg(currentLabelYear, fyStartMonth);

  const [{ data: priorEntries }, { data: currentEntries }] = await Promise.all([
    db
      .from('utility_data_entries')
      .select('id, utility_type, quantity, unit, reporting_period_start, reporting_period_end, activity_date, notes')
      .eq('facility_id', facilityId)
      .gte('reporting_period_start', priorStart)
      .lte('reporting_period_end', priorEnd),
    db
      .from('utility_data_entries')
      .select('id, utility_type, quantity, unit, reporting_period_start, reporting_period_end, activity_date, notes')
      .eq('facility_id', facilityId)
      .gte('reporting_period_start', currentStart)
      .lte('reporting_period_end', currentEnd),
  ]);

  if (!priorEntries || priorEntries.length === 0) return []; // no history — nothing to roll forward

  return computeRolloverCandidates(
    priorEntries as UtilityRow[],
    (currentEntries as UtilityRow[]) || [],
    currentLabelYear - priorLabelYear,
  );
}

/**
 * Write the candidates: one `utility_data_entries` row each (data_quality
 * 'estimated'), plus the same `activity_data` dual-write the manual dialog
 * does for legacy readers. Returns how many were written.
 */
export async function applyRolloverCandidates(
  db: SupabaseClient,
  facilityId: string,
  organizationId: string,
  userId: string,
  candidates: RolloverCandidate[],
): Promise<number> {
  let written = 0;
  for (const candidate of candidates) {
    const utilityInfo = UTILITY_TYPES.find((u) => u.value === candidate.utilityType);
    const { error } = await db.from('utility_data_entries').insert({
      facility_id: facilityId,
      utility_type: candidate.utilityType,
      quantity: candidate.quantity,
      unit: candidate.unit,
      reporting_period_start: candidate.reportingPeriodStart,
      reporting_period_end: candidate.reportingPeriodEnd,
      activity_date: candidate.activityDate,
      data_quality: 'estimated',
      calculated_scope: '',
      notes: `Auto-filled: rolled over from the same period last year, pending confirmation.`,
      created_by: userId,
    });
    if (error) continue; // best-effort — one bad row shouldn't block the rest

    const category = utilityInfo?.scope === '1' ? 'Scope 1' : 'Scope 2';
    await db.from('activity_data').insert({
      organization_id: organizationId,
      facility_id: facilityId,
      user_id: userId,
      name: `${utilityInfo?.label || candidate.utilityType} - ${candidate.reportingPeriodStart} to ${candidate.reportingPeriodEnd}`,
      category,
      quantity: candidate.quantity,
      unit: candidate.unit,
      fuel_type: utilityInfo?.fuelType || candidate.utilityType,
      activity_date: candidate.reportingPeriodEnd,
      reporting_period_start: candidate.reportingPeriodStart,
      reporting_period_end: candidate.reportingPeriodEnd,
    });
    written += 1;
  }
  return written;
}
