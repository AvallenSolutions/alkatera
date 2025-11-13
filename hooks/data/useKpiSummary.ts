import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface KpiSummary {
  kpi_id: string
  organization_id: string
  name: string
  description: string | null
  current_value: number | null
  target_value: number | null
  unit: string
  category: string | null
  last_recorded_date: string | null
  last_updated: string
}

interface UseKpiSummaryResult {
  data: KpiSummary[] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useKpiSummary(): UseKpiSummaryResult {
  const [data, setData] = useState<KpiSummary[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchKpiSummary = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: kpiData, error: kpiError } = await supabase
        .from('kpi_summary_view')
        .select('*')
        .order('name', { ascending: true })

      if (kpiError) {
        throw new Error(kpiError.message)
      }

      setData(kpiData as KpiSummary[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch KPI summary'
      setError(new Error(errorMessage))
      console.error('Error fetching KPI summary:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchKpiSummary()
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch: fetchKpiSummary,
  }
}
