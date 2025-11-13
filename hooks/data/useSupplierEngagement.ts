import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface SupplierEngagement {
  organization_id: string
  status: string
  supplier_count: number
  percentage: number
  total_suppliers: number
}

interface UseSupplierEngagementResult {
  data: SupplierEngagement[] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useSupplierEngagement(): UseSupplierEngagementResult {
  const [data, setData] = useState<SupplierEngagement[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchSupplierEngagement = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: engagementData, error: engagementError } = await supabase
        .from('supplier_engagement_view')
        .select('*')

      if (engagementError) {
        throw new Error(engagementError.message)
      }

      setData(engagementData as SupplierEngagement[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch supplier engagement'
      setError(new Error(errorMessage))
      console.error('Error fetching supplier engagement:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchSupplierEngagement()
  }, [])

  return {
    data,
    isLoading,
    error,
    refetch: fetchSupplierEngagement,
  }
}
