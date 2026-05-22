'use client'

import { useEffect, useState } from 'react'
import { Dog, Mail, Sparkles, Activity, Copy, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useOrganization } from '@/lib/organizationContext'
import { supabase } from '@/lib/supabaseClient'
import { ExceptionQueue } from './ExceptionQueue'
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone'
import { toast } from 'sonner'

interface RosaSummary {
  managedEnabled: boolean
  inboxAddress: string | null
  openExceptions: number
  approvedLast30Days: number
  ingestJobsLast30Days: number
}

/**
 * Queue + inbox surface for the unified Rosa hub. Rendered inside the
 * "Queue" tab of /rosa/. Shows the email-in address, a few headline stats,
 * and the exception queue itself. Chat lives on the sibling tab.
 */
export function RosaQueue() {
  const { currentOrganization } = useOrganization()
  const orgId = currentOrganization?.id
  const [summary, setSummary] = useState<RosaSummary | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!orgId) return
    const load = async () => {
      const [orgRes, openRes, approvedRes, jobsRes] = await Promise.all([
        supabase
          .from('organizations')
          .select('managed_footprint_enabled, agent_inbox_address')
          .eq('id', orgId)
          .maybeSingle(),
        supabase
          .from('agent_exceptions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'open'),
        supabase
          .from('agent_exceptions')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .eq('status', 'approved')
          .gte('reviewed_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
        supabase
          .from('ingest_jobs')
          .select('id', { count: 'exact', head: true })
          .eq('organization_id', orgId)
          .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()),
      ])
      setSummary({
        managedEnabled: !!orgRes.data?.managed_footprint_enabled,
        inboxAddress: orgRes.data?.agent_inbox_address || null,
        openExceptions: openRes.count || 0,
        approvedLast30Days: approvedRes.count || 0,
        ingestJobsLast30Days: jobsRes.count || 0,
      })
    }
    load().catch(console.error)
  }, [orgId])

  const copyInbox = () => {
    if (!summary?.inboxAddress) return
    navigator.clipboard.writeText(summary.inboxAddress)
    setCopied(true)
    toast.success('Inbox address copied')
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-semibold">
            <Dog className="h-6 w-6 text-[#ccff00]" />
            Rosa
          </h1>
          <p className="mt-1 text-sm text-muted-foreground max-w-2xl">
            Drop or email Rosa your documents. She classifies them, runs your
            existing emission factors and proxies, and lifts anything she
            isn&apos;t fully sure about into the queue below for your sign-off.
            Forms still work as a fallback.
          </p>
        </div>
        <UniversalDropzone
          trigger={
            <Button className="bg-[#ccff00] text-black hover:bg-[#b8e600]">
              <Sparkles className="mr-2 h-4 w-4" />
              Drop a document
            </Button>
          }
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <StatCard
          icon={<Activity className="h-4 w-4" />}
          label="Open in queue"
          value={summary?.openExceptions ?? '...'}
          tone="primary"
        />
        <StatCard
          icon={<Check className="h-4 w-4" />}
          label="Approved in last 30 days"
          value={summary?.approvedLast30Days ?? '...'}
        />
        <StatCard
          icon={<Sparkles className="h-4 w-4" />}
          label="Documents ingested 30 days"
          value={summary?.ingestJobsLast30Days ?? '...'}
        />
      </div>

      {summary?.managedEnabled === false && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Rosa not yet enabled for this org</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            <p>
              Rosa&apos;s queue mode is in pilot. Ask Tim to flip
              {' '}
              <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                managed_footprint_enabled
              </code>{' '}
              on this organisation, then reload this page.
            </p>
          </CardContent>
        </Card>
      )}

      {summary?.managedEnabled && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Mail className="h-4 w-4" /> Forward documents to Rosa
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {summary.inboxAddress ? (
              <div className="flex items-center gap-2">
                <code className="flex-1 rounded bg-muted px-3 py-2 font-mono text-sm">
                  {summary.inboxAddress}
                </code>
                <Button variant="outline" size="sm" onClick={copyInbox}>
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                </Button>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                No inbox address provisioned yet. Ask Tim to set
                {' '}
                <code className="rounded bg-muted px-1.5 py-0.5 text-xs">
                  agent_inbox_address
                </code>{' '}
                on this organisation.
              </p>
            )}
            <p className="text-xs text-muted-foreground">
              Forward utility bills, supplier replies, lab reports, or any
              sustainability-relevant document to this address. Rosa classifies
              each attachment automatically and queues anything needing your
              sign-off.
            </p>
          </CardContent>
        </Card>
      )}

      <ExceptionQueue />
    </div>
  )
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode
  label: string
  value: number | string
  tone?: 'primary'
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <div className="flex items-center justify-between">
          <span className="text-xs uppercase tracking-wide text-muted-foreground">{label}</span>
          <span className="text-muted-foreground">{icon}</span>
        </div>
        <div className={`mt-2 text-2xl font-semibold ${tone === 'primary' ? 'text-[#ccff00]' : ''}`}>
          {value}
        </div>
      </CardContent>
    </Card>
  )
}
