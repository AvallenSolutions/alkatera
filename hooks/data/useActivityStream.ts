import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabaseClient'

export interface ActivityEvent {
  event_id: string
  organization_id: string
  event_type: string
  event_timestamp: string
  actor_name: string
  actor_email: string | null
  details: Record<string, any>
}

interface UseActivityStreamResult {
  data: ActivityEvent[] | null
  isLoading: boolean
  error: Error | null
  refetch: () => Promise<void>
}

export function useActivityStream(limit: number = 10): UseActivityStreamResult {
  const [data, setData] = useState<ActivityEvent[] | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<Error | null>(null)

  const fetchActivityStream = async () => {
    try {
      setIsLoading(true)
      setError(null)

      const { data: activityData, error: activityError } = await supabase
        .from('activity_stream_view')
        .select('*')
        .order('event_timestamp', { ascending: false })
        .limit(limit)

      if (activityError) {
        throw new Error(activityError.message)
      }

      setData(activityData as ActivityEvent[])
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch activity stream'
      setError(new Error(errorMessage))
      console.error('Error fetching activity stream:', err)
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    fetchActivityStream()
  }, [limit])

  return {
    data,
    isLoading,
    error,
    refetch: fetchActivityStream,
  }
}
