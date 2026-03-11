'use client'

import { useState, useCallback, useEffect } from 'react'

const STORAGE_KEY = 'alkatera_reporting_year'

/**
 * Hook that persists the selected reporting year to localStorage.
 * When a user picks a year on any page, all other pages will default
 * to that same year on next load instead of resetting to the current year.
 *
 * Falls back to `new Date().getFullYear()` when nothing is stored yet.
 */
export function usePersistedYear(availableYears?: number[]) {
  const currentYear = new Date().getFullYear()

  const [selectedYear, setSelectedYearState] = useState<number>(() => {
    if (typeof window === 'undefined') return currentYear
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = parseInt(stored, 10)
        // Validate: must be a sensible year and, if we have a list, must be in it
        if (!isNaN(parsed) && parsed >= 2020 && parsed <= currentYear + 1) {
          if (availableYears && availableYears.length > 0 && !availableYears.includes(parsed)) {
            // Stored year isn't in the available list — use the nearest available
            return availableYears[0] ?? currentYear
          }
          return parsed
        }
      }
    } catch {
      // localStorage not available (SSR, private browsing, etc.)
    }
    return currentYear
  })

  const setSelectedYear = useCallback((year: number) => {
    setSelectedYearState(year)
    try {
      localStorage.setItem(STORAGE_KEY, String(year))
    } catch {
      // Silently ignore storage errors
    }
  }, [])

  // If availableYears changes and current selection isn't valid, correct it
  useEffect(() => {
    if (availableYears && availableYears.length > 0 && !availableYears.includes(selectedYear)) {
      const corrected = availableYears[0] ?? currentYear
      setSelectedYearState(corrected)
    }
  }, [availableYears, selectedYear, currentYear])

  return { selectedYear, setSelectedYear }
}
