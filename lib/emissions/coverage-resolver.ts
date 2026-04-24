/**
 * Coverage resolver — decides which emission rows contribute and which are
 * suppressed, based on the priority rules in source-priority.ts.
 *
 * Pure function. Takes a flat list of candidate rows (already computed by the
 * trace endpoint or the corporate-emissions aggregator) and returns the same
 * rows with `suppressed` / `suppressedBy` set for losing sources.
 *
 * Slices with no rule in SOURCE_PRIORITY pass through unchanged.
 */

import { SOURCE_PRIORITY } from './source-priority'
import type { EmissionSource, ResolvedEmissionRow, ScopeSlice, SourceAttribution } from './types'

export function resolveSuppressions(rows: ResolvedEmissionRow[]): ResolvedEmissionRow[] {
  const bySlice = new Map<ScopeSlice, ResolvedEmissionRow[]>()
  for (const row of rows) {
    const list = bySlice.get(row.scopeSlice) ?? []
    list.push(row)
    bySlice.set(row.scopeSlice, list)
  }

  const output: ResolvedEmissionRow[] = []
  for (const [slice, sliceRows] of Array.from(bySlice.entries())) {
    const rule = SOURCE_PRIORITY[slice as ScopeSlice]
    if (!rule) {
      output.push(...sliceRows)
      continue
    }

    const byPeriod = new Map<string, ResolvedEmissionRow[]>()
    for (const row of sliceRows) {
      const list = byPeriod.get(row.period) ?? []
      list.push(row)
      byPeriod.set(row.period, list)
    }

    for (const periodRows of Array.from(byPeriod.values())) {
      const presentSources = new Set(periodRows.map((r: ResolvedEmissionRow) => r.source))
      let winning: EmissionSource | null = null
      for (const candidate of rule.sources) {
        if (presentSources.has(candidate)) {
          winning = candidate
          break
        }
      }

      if (!winning) {
        // No priority-listed source is present — pass through unchanged.
        output.push(...periodRows)
        continue
      }

      for (const row of periodRows) {
        // Keep the winning source's rows, and any source the rule doesn't
        // mention (neutral — e.g. an unrelated source the rule doesn't govern).
        const governed = rule.sources.includes(row.source)
        if (!governed || row.source === winning) {
          output.push(row)
        } else if (row.suppressed) {
          // Preserve pre-existing suppression (e.g. Xero upgrade_status='upgraded').
          output.push(row)
        } else {
          output.push({ ...row, suppressed: true, suppressedBy: winning })
        }
      }
    }
  }

  return output
}

/**
 * Build per-slice-per-period attribution records from resolved rows.
 * Used by the trace endpoint and (Phase 1b) the aggregator provenance UI.
 */
export function computeAttributions(rows: ResolvedEmissionRow[]): SourceAttribution[] {
  const map = new Map<string, SourceAttribution>()
  for (const row of rows) {
    const key = `${row.scopeSlice}|${row.period}`
    let att = map.get(key)
    if (!att) {
      att = {
        scopeSlice: row.scopeSlice,
        period: row.period,
        winningSource: null,
        kgCO2e: 0,
        suppressedSources: [],
      }
      map.set(key, att)
    }
    if (row.suppressed) {
      const existing = att.suppressedSources.find((s) => s.source === row.source)
      if (existing) {
        existing.rowCount += 1
        existing.kgCO2e += row.kgCO2e
      } else {
        att.suppressedSources.push({ source: row.source, rowCount: 1, kgCO2e: row.kgCO2e })
      }
    } else {
      att.kgCO2e += row.kgCO2e
      att.winningSource = att.winningSource ?? row.source
    }
  }
  return Array.from(map.values()).sort((a, b) =>
    a.scopeSlice === b.scopeSlice ? a.period.localeCompare(b.period) : a.scopeSlice.localeCompare(b.scopeSlice),
  )
}
