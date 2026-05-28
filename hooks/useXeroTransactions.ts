'use client'

/**
 * Hook to fetch un-upgraded Xero transactions for the Company Emissions page.
 *
 * Thin wrapper around `getXeroResolvedEmissions` in `lib/xero/resolved-emissions.ts`,
 * which is also called server-side from `calculateCorporateEmissions` so the
 * Emissions page, Vitality page, and Rosa snapshot all see the same numbers.
 */

import { useState, useEffect, useCallback } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'
import {
  getXeroResolvedEmissions,
  type XeroResolvedEmissions,
} from '@/lib/xero/resolved-emissions'
import type { XeroEntry } from '@/lib/xero/scope-card-mapping'

export type { XeroEntry }

interface UseXeroTransactionsResult extends XeroResolvedEmissions {
  isLoading: boolean
}

const INITIAL: UseXeroTransactionsResult = {
  xeroByCategory: new Map(),
  scope1Entries: [],
  scope2Entries: [],
  totalScope1Kg: 0,
  totalScope2Kg: 0,
  totalScope3Kg: 0,
  suppressedCount: 0,
  suppressedKg: 0,
  suppressedByLcaCount: 0,
  suppressedByInventoryCount: 0,
  inventoryLedgerKg: 0,
  isLoading: true,
  hasConnection: false,
}

export function useXeroTransactions(
  organizationId: string | undefined,
  yearStart: string,
  yearEnd: string
): UseXeroTransactionsResult {
  const [result, setResult] = useState<UseXeroTransactionsResult>(INITIAL)

  const loadData = useCallback(async () => {
    if (!organizationId) {
      setResult((prev) => ({ ...prev, isLoading: false }))
      return
    }

    try {
      const supabase = getSupabaseBrowserClient()
      const resolved = await getXeroResolvedEmissions(
        supabase,
        organizationId,
        yearStart,
        yearEnd,
      )
      setResult({ ...resolved, isLoading: false })
    } catch (err) {
      console.error('Error loading Xero transactions:', err)
      setResult((prev) => ({ ...prev, isLoading: false }))
    }
  }, [organizationId, yearStart, yearEnd])

  useEffect(() => {
    loadData()
  }, [loadData])

  return result
}
