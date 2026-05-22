'use client'

import { useCallback, useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { COMPLIANCE_DEADLINES, expandDeadlines } from '@/lib/pulse/regulatory-deadlines'
import { useRealtimeRefresh } from './useRealtimeRefresh'

/**
 * A single nudge Rosa wants the user to know about. Surfaced two ways:
 *   - As a count badge on the floating trigger button
 *   - As clickable rows in the drawer's empty state ("What's new")
 */
export interface RosaNudge {
  id: string
  /** What kind of thing this is. Drives the icon and tone. */
  kind: 'queue' | 'anomaly' | 'deadline'
  /** Short label shown in the rail. */
  label: string
  /** Optional one-line context. */
  hint?: string
  /** Tone shapes the colour. 'high' = critical, 'medium' = warn, 'low' = info. */
  severity: 'high' | 'medium' | 'low'
  /** Where clicking the nudge should take the user (or open the drawer). */
  href?: string
  /** A prompt to seed Rosa with if the user clicks "Ask Rosa about this". */
  prompt?: string
}

interface UseRosaNudgesResult {
  nudges: RosaNudge[]
  /** Total count for the badge on the trigger. */
  count: number
  loading: boolean
  /** Force a refresh; called from the drawer when it opens. */
  refresh: () => void
}

const POLL_MS = 5 * 60 * 1000 // 5 min

/**
 * Polls a few sources every ~5 minutes and returns whatever's worth
 * surfacing right now. Read-only; never writes to the user's data.
 *
 *   - Open agent_exceptions older than 48h → "X items waiting your sign-off"
 *   - High-severity dashboard_anomalies → "X anomalies flagged"
 *   - Regulatory deadlines due in <= 7 days → "Y due in N days"
 *
 * Sorted by severity (high → low) and capped at 5 to keep the rail tight.
 */
export function useRosaNudges(): UseRosaNudgesResult {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [nudges, setNudges] = useState<RosaNudge[]>([])
  const [loading, setLoading] = useState(true)
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (!orgId) {
      setLoading(false)
      return
    }
    let cancelled = false

    const load = async () => {
      const since48h = new Date(Date.now() - 48 * 60 * 60 * 1000).toISOString()

      const [oldExceptionsRes, anomaliesRes] = await Promise.all([
        supabase
          .from('agent_exceptions')
          .select('id, kind, title, created_at')
          .eq('organization_id', orgId)
          .eq('status', 'open')
          .lt('created_at', since48h)
          .order('created_at', { ascending: true })
          .limit(5),
        supabase
          .from('dashboard_anomalies')
          .select('id, metric_key, severity, observed, expected, detected_at')
          .eq('organization_id', orgId)
          .neq('status', 'resolved')
          .neq('status', 'dismissed')
          .gte('severity', 'high')
          .order('detected_at', { ascending: false })
          .limit(5),
      ])

      const out: RosaNudge[] = []

      const oldEx = (oldExceptionsRes.data as any[]) || []
      if (oldEx.length > 0) {
        out.push({
          id: 'queue',
          kind: 'queue',
          label: `${oldEx.length} ${oldEx.length === 1 ? 'item' : 'items'} waiting your sign-off`,
          hint: oldEx[0].title
            ? `Oldest: ${oldEx[0].title}`
            : 'In your queue for more than two days',
          severity: 'medium',
          prompt:
            'Walk me through the items in my queue that have been waiting more than two days. Help me clear them.',
        })
      }

      const anomalies = (anomaliesRes.data as any[]) || []
      for (const a of anomalies.slice(0, 2)) {
        out.push({
          id: `anomaly-${a.id}`,
          kind: 'anomaly',
          label: `${prettyMetric(a.metric_key)} flagged`,
          hint: `Detected ${fmtDate(a.detected_at)}`,
          severity: 'high',
          href: '/pulse/',
          prompt: `Explain the ${prettyMetric(a.metric_key)} anomaly you flagged on ${fmtDate(a.detected_at)}.`,
        })
      }

      const upcoming = expandDeadlines(COMPLIANCE_DEADLINES, 12, new Date())
        .filter(d => d.days_away >= 0 && d.days_away <= 7)
        .sort((a, b) => a.days_away - b.days_away)
        .slice(0, 2)
      for (const d of upcoming) {
        out.push({
          id: `deadline-${d.title}-${d.due_date}`,
          kind: 'deadline',
          label: `${d.title} in ${d.days_away} ${d.days_away === 1 ? 'day' : 'days'}`,
          hint: d.regime_label,
          severity: d.days_away <= 2 ? 'high' : 'medium',
          href: d.action_href,
          prompt: `What do I need to have ready for ${d.title}? Walk me through the gaps.`,
        })
      }

      if (cancelled) return
      out.sort((a, b) => severityRank(b.severity) - severityRank(a.severity))
      setNudges(out.slice(0, 5))
      setLoading(false)
    }

    setLoading(true)
    load().catch(() => setLoading(false))
    const id = setInterval(load, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(id)
    }
  }, [orgId, tick])

  const bumpTick = useCallback(() => setTick(t => t + 1), [])
  // Live: any approval or new exception/anomaly should re-evaluate the
  // nudge count without waiting for the 5-minute poll.
  useRealtimeRefresh(['agent_exceptions', 'dashboard_anomalies'], bumpTick)

  return {
    nudges,
    count: nudges.length,
    loading,
    refresh: bumpTick,
  }
}

function severityRank(s: RosaNudge['severity']): number {
  return s === 'high' ? 3 : s === 'medium' ? 2 : 1
}

function prettyMetric(key: string): string {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())
}

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}
