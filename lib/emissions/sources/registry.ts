/**
 * Spend-source registry.
 *
 * The single place where accounting integrations are plumbed into the emissions
 * pipeline. When QuickBooks or Sage ship, add their adapter to this array —
 * nothing else needs to change. The resolver, hook, trace route and priority
 * rules iterate over this list.
 *
 * Ordering here does NOT determine suppression priority (that is in
 * `source-priority.ts`). It only controls the order candidate rows are loaded.
 */

import type { SpendSource } from './types'
import { XeroSpendSource } from './xero'

export const ALL_SPEND_SOURCES: SpendSource[] = [
  XeroSpendSource,
  // Future adapters plug in here, e.g.
  //   QuickBooksSpendSource,
  //   SageSpendSource,
]

export function getSpendSource(key: string): SpendSource | undefined {
  return ALL_SPEND_SOURCES.find((s) => s.sourceKey === key)
}

export type { SpendSource, SpendRow } from './types'
