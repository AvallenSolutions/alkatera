'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'

export interface FlagTarget {
  id: string
  organization_id: string
  target_type: 'absolute' | 'intensity'
  scope: 'flag' | 'non_flag' | 'combined'
  base_year: number
  base_year_emissions_co2e: number | null
  target_year: number
  reduction_percentage: number
  meets_sbti_minimum: boolean
  sbti_pathway: string | null
  commodity_coverage: string[] | null
  methodology_notes: string | null
  status: 'draft' | 'submitted' | 'validated' | 'expired'
  submitted_at: string | null
  validated_at: string | null
  created_at: string
  updated_at: string
}

interface UseFlagTargetsResult {
  targets: FlagTarget[]
  loading: boolean
  error: string | null
  createTarget: (data: Partial<FlagTarget>) => Promise<FlagTarget | null>
  updateTarget: (id: string, data: Partial<FlagTarget>) => Promise<FlagTarget | null>
  deleteTarget: (id: string) => Promise<boolean>
  refetch: () => void
}

/**
 * Hook for CRUD operations on FLAG targets via the API route.
 */
export function useFlagTargets(): UseFlagTargetsResult {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id

  const [targets, setTargets] = useState<FlagTarget[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const refetch = useCallback(() => {
    setRefreshKey((k) => k + 1)
  }, [])

  useEffect(() => {
    if (!orgId) {
      setTargets([])
      setLoading(false)
      return
    }

    let cancelled = false
    setLoading(true)
    setError(null)

    fetch('/api/certifications/flag-targets')
      .then(async (res) => {
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || `Request failed with status ${res.status}`)
        }
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        setTargets(data.targets ?? [])
        setLoading(false)
      })
      .catch((err) => {
        if (cancelled) return
        console.error('[useFlagTargets] Fetch error:', err)
        setError(err.message || 'Failed to load FLAG targets')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [orgId, refreshKey])

  const createTarget = useCallback(
    async (data: Partial<FlagTarget>): Promise<FlagTarget | null> => {
      try {
        setError(null)
        const res = await fetch('/api/certifications/flag-targets', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to create target')
        }

        const { target } = await res.json()
        refetch()
        return target
      } catch (err: any) {
        console.error('[useFlagTargets] Create error:', err)
        setError(err.message || 'Failed to create target')
        return null
      }
    },
    [refetch]
  )

  const updateTarget = useCallback(
    async (id: string, data: Partial<FlagTarget>): Promise<FlagTarget | null> => {
      try {
        setError(null)
        const res = await fetch('/api/certifications/flag-targets', {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id, ...data }),
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to update target')
        }

        const { target } = await res.json()
        refetch()
        return target
      } catch (err: any) {
        console.error('[useFlagTargets] Update error:', err)
        setError(err.message || 'Failed to update target')
        return null
      }
    },
    [refetch]
  )

  const deleteTarget = useCallback(
    async (id: string): Promise<boolean> => {
      try {
        setError(null)
        const res = await fetch(`/api/certifications/flag-targets?id=${encodeURIComponent(id)}`, {
          method: 'DELETE',
        })

        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          throw new Error(body.error || 'Failed to delete target')
        }

        refetch()
        return true
      } catch (err: any) {
        console.error('[useFlagTargets] Delete error:', err)
        setError(err.message || 'Failed to delete target')
        return false
      }
    },
    [refetch]
  )

  return { targets, loading, error, createTarget, updateTarget, deleteTarget, refetch }
}
