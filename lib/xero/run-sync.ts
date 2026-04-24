import { supabase } from '@/lib/supabaseClient'

export interface SyncProgress {
  stage: string
  message: string
}

export interface SyncResult {
  totalFetched: number
  totalClassified: number
  unclassifiedCount: number
}

export async function runXeroSync(
  organizationId: string,
  onProgress?: (p: SyncProgress) => void
): Promise<SyncResult> {
  const { data: { session } } = await supabase.auth.getSession()
  const headers = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${session?.access_token}`,
  }

  let stage = 'accounts'
  let cursor: unknown = undefined
  let totalFetched = 0
  let totalClassified = 0

  try {
    while (stage) {
      onProgress?.({ stage, message: `${stage.replace('_', ' ')}...` })

      const res = await fetch('/api/xero/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ organizationId, stage, cursor }),
      })

      let data: {
        done?: boolean
        nextStage?: string
        cursor?: unknown
        progress?: string
        error?: string
        stats?: { transactionsFetched?: number; transactionsClassified?: number }
      }
      try {
        data = await res.json()
      } catch {
        console.error(`Sync stage '${stage}' returned non-JSON response (status ${res.status})`)
        // Classification stages are optional — skip to complete on server crash
        if (stage === 'ai_classify' || stage === 'classify') {
          console.warn(`Skipping '${stage}' stage due to server error`)
          stage = 'complete'
          cursor = undefined
          continue
        }
        throw new Error(`Sync failed at stage '${stage}' (server error)`)
      }
      if (!res.ok) throw new Error(data.error || `Sync failed at stage '${stage}'`)

      onProgress?.({ stage, message: data.progress || stage })

      if (data.stats?.transactionsFetched) totalFetched += data.stats.transactionsFetched
      if (data.stats?.transactionsClassified) totalClassified += data.stats.transactionsClassified

      if (data.done) break
      stage = data.nextStage || ''
      cursor = data.cursor
    }

    const { count } = await supabase
      .from('xero_transactions')
      .select('id', { count: 'exact', head: true })
      .eq('organization_id', organizationId)
      .is('emission_category', null)
      .eq('upgrade_status', 'not_applicable')

    return {
      totalFetched,
      totalClassified,
      unclassifiedCount: count ?? 0,
    }
  } catch (err) {
    // Best-effort reset of server-side sync status so stepper doesn't stay stuck.
    try {
      await fetch('/api/xero/sync', {
        method: 'POST',
        headers,
        body: JSON.stringify({ organizationId, stage: 'complete' }),
      })
    } catch {
      // Stale-sync detection handles it if this also fails
    }
    throw err
  }
}
