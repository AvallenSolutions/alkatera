'use client'

import { useState, useCallback, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'

const STORAGE_KEY = 'alkatera_reporting_year'

/**
 * Detect the most recent year that has any data (facility entries or LCA results).
 * Returns null while loading, then the year or undefined if no data exists.
 */
export function useLatestDataYear(organizationId: string | undefined): number | null | undefined {
  const [latestYear, setLatestYear] = useState<number | null | undefined>(null) // null = loading

  useEffect(() => {
    if (!organizationId) {
      setLatestYear(undefined)
      return
    }

    let cancelled = false
    const supabase = getSupabaseBrowserClient()

    async function detect() {
      // Run two lightweight queries in parallel
      const [facilityResult, lcaResult] = await Promise.all([
        supabase
          .from('facility_activity_entries')
          .select('reporting_period_start')
          .eq('organization_id', organizationId)
          .order('reporting_period_start', { ascending: false })
          .limit(1),
        supabase
          .from('product_carbon_footprints')
          .select('reference_year')
          .eq('organization_id', organizationId)
          .order('reference_year', { ascending: false })
          .limit(1),
      ])

      if (cancelled) return

      const facilityYear = facilityResult.data?.[0]?.reporting_period_start
        ? new Date(facilityResult.data[0].reporting_period_start).getFullYear()
        : null
      const lcaYear = facilityResult.error ? null : (lcaResult.data?.[0]?.reference_year ?? null)

      const years = [facilityYear, lcaYear].filter((y): y is number => y !== null)
      setLatestYear(years.length > 0 ? Math.max(...years) : undefined)
    }

    detect().catch(() => {
      if (!cancelled) setLatestYear(undefined)
    })

    return () => { cancelled = true }
  }, [organizationId])

  return latestYear
}

/**
 * Hook that persists the selected reporting year to localStorage.
 * When a user picks a year on any page, all other pages will default
 * to that same year on next load instead of resetting to the current year.
 *
 * @param availableYears - List of years to show in the selector
 * @param defaultYear - Override the fallback year (e.g. from useLatestDataYear).
 *   When provided, this is used instead of the current calendar year if nothing
 *   is stored in localStorage yet.
 */
export function usePersistedYear(availableYears?: number[], defaultYear?: number | null) {
  const currentYear = new Date().getFullYear()
  // Use defaultYear if it's a valid number, otherwise fall back to current year
  const fallbackYear = (typeof defaultYear === 'number' && defaultYear >= 2020) ? defaultYear : currentYear

  const [selectedYear, setSelectedYearState] = useState<number>(() => {
    if (typeof window === 'undefined') return fallbackYear
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        // Validate: must be a sensible year and, if we have a list, must be in it
        if (!isNaN(parsed) && parsed >= 2020 && parsed <= currentYear + 1) {
          if (availableYears && availableYears.length > 0 && !availableYears.includes(parsed)) {
            // Stored year isn't in the available list — use the nearest available
            return availableYears[0] ?? fallbackYear
          }
          return parsed
        }
      }
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
    }
    return fallbackYear
  })

  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year)
    try {
      localStorage.setItem(STORAGE_KEY, String(year))
    } catch {
      // Silently ignore storage errors
    }
  }, [])

  // When defaultYear resolves (async) and no explicit selection has been persisted,
  // update the selected year to match.
  useEffect(() => {
    if (typeof defaultYear !== 'number' || defaultYear < 2020) return
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (!stored) {
        // No explicit user choice yet — adopt the detected year
        setSelectedYearState(defaultYear)
      }
    } catch {
      // SSR or private browsing
    }
  }, [defaultYear])

  // If availableYears changes and current selection isn't valid, correct it
  useEffect(() => {
    if (availableYears && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      const corrected = availableYears[0] ?? fallbackYear
      setSelectedYearState(corrected)
    }
  }, [availableYears, selectedYear, fallbackYear])

  return { selectedYear, setSelectedYear }
}
