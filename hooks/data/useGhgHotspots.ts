import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface GhgHotspot {
  organization_id: string
  reporting_period: string
  scope: number
  category_name: string
  total_emissions: number
  percentage_of_total: number
  emission_count: number
}

interface UseGhgHotspotsResult {
  data: GhgHotspot[] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useGhgHotspots(): UseGhgHotspotsResult {
  const [data, setData] = useState<GhgHotspot[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchGhgHotspots = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: hotspotsData, error: hotspotsError } = await supabase
        .from('ghg_hotspots_view')
        .select('*')
        .order('total_emissions', { ascending: false })

      if (hotspotsError) {
        throw new Error(hotspotsError.message)
      }

      setData(hotspotsData as GhgHotspot[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch GHG hotspots'
      setError(new Error(errorMessage))
      console.error('Error fetching GHG hotspots:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchGhgHotspots()
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch: fetchGhgHotspots,
  }
}
