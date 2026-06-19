'use client'

import { useCallback, useEffect, useState } from 'react'
import type { HospitalityVenue } from '@/lib/hospitality/venue-types'

export interface VenueInput {
  name: string
  venue_type: string
  description?: string | null
}

interface UseHospitalityVenuesResult {
  venues: HospitalityVenue[]
  isLoading: boolean
  error: string | null
  refresh: () => Promise<void>
  createVenue: (input: VenueInput) => Promise<HospitalityVenue>
  updateVenue: (id: string, input: Partial<VenueInput>) => Promise<HospitalityVenue>
  deleteVenue: (id: string) => Promise<void>
}

async function readError(res: Response): Promise<string> {
  try {
    const body = await res.json()
    return body?.error || `Request failed (${res.status})`
  } catch {
    return `Request failed (${res.status})`
  }
}

/**
 * Client data hook for hospitality venues. Cookie-authenticated same-origin
 * fetches against /api/hospitality/venues (mirrors the byproducts pattern).
 */
export function useHospitalityVenues(): UseHospitalityVenuesResult {
  const [venues, setVenues] = useState<HospitalityVenue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/hospitality/venues', { credentials: 'include' })
      if (!res.ok) throw new Error(await readError(res))
      const body = await res.json()
      setVenues(body.venues ?? [])
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load venues')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  const createVenue = useCallback(async (input: VenueInput) => {
    const res = await fetch('/api/hospitality/venues', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await readError(res))
    const body = await res.json()
    setVenues((prev) => [body.venue, ...prev])
    return body.venue as HospitalityVenue
  }, [])

  const updateVenue = useCallback(async (id: string, input: Partial<VenueInput>) => {
    const res = await fetch(`/api/hospitality/venues/${id}`, {
      method: 'PATCH',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!res.ok) throw new Error(await readError(res))
    const body = await res.json()
    setVenues((prev) => prev.map((v) => (v.id === id ? body.venue : v)))
    return body.venue as HospitalityVenue
  }, [])

  const deleteVenue = useCallback(async (id: string) => {
    const res = await fetch(`/api/hospitality/venues/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    })
    if (!res.ok) throw new Error(await readError(res))
    setVenues((prev) => prev.filter((v) => v.id !== id))
  }, [])

  return { venues, isLoading, error, refresh, createVenue, updateVenue, deleteVenue }
}
