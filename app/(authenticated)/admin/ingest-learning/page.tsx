'use client'

import { useEffect, useState } from 'react'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertCircle, ChevronDown, ChevronRight, ArrowRight, FlaskConical, Loader2 } from 'lucide-react'
import { Statement } from '@/components/studio/statement'
import { Panel } from '@/components/studio/panel'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import { toast } from 'sonner'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { format } from 'date-fns'

interface PerTypeStat {
  result_type: string
  total: number
  edited: number
  edit_rate: number
  misclassified: number
  misclassification_rate: number
  dismissed: number
}

interface TopSupplier {
  supplier_key: string
  result_type: string
  times_seen: number
  hints: Record<string, unknown>
  last_seen_at: string
  match_kind: string
  organization_name: string | null
}

interface ConfusionPair {
  from: string
  to: string
  count: number
}

interface Misclassification {
  id: string
  created_at: string
  job_id: string | null
  result_type: string
  corrected_result_type: string | null
  file_name: string | null
  has_stash: boolean
  organization_name: string | null
}

interface RecentFeedback {
  id: string
  created_at: string
  result_type: string
  supplier_key: string | null
  field_diff: { edited?: number; added?: number; removed?: number; fields?: unknown[] }
  context: Record<string, unknown>
  organization_name: string | null
}

export default function IngestLearningPage() {
  const { isAlkateraAdmin: isAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [perType, setPerType] = useState<PerTypeStat[]>([])
  const [topSuppliers, setTopSuppliers] = useState<TopSupplier[]>([])
  const [recent, setRecent] = useState<RecentFeedback[]>([])
  const [confusionPairs, setConfusionPairs] = useState<ConfusionPair[]>([])
  const [misclassifications, setMisclassifications] = useState<Misclassification[]>([])
  const [expanded, setExpanded] = useState<string | null>(null)
  const [promoting, setPromoting] = useState<string | null>(null)
  const [promoted, setPromoted] = useState<Set<string>>(new Set())

  const promoteToCorpus = async (m: Misclassification) => {
    if (!m.job_id || promoting) return
    setPromoting(m.id)
    try {
      const res = await fetch('/api/admin/ingest-learning/promote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ jobId: m.job_id }),
      })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body?.error || 'Promote failed')
      setPromoted((prev) => new Set(prev).add(m.id))
      toast.success(`Added to the eval corpus as ${body.expectedType}`)
    } catch (err: any) {
      toast.error(err.message || 'Could not promote this file')
    } finally {
      setPromoting(null)
    }
  }

  useEffect(() => {
    if (adminLoading || !isAdmin) return
    let cancelled = false
    fetch('/api/admin/ingest-learning')
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error(`${r.status}`))))
      .then((body) => {
        if (cancelled) return
        setPerType(body.perType || [])
        setTopSuppliers(body.topSuppliers || [])
        setRecent(body.recent || [])
        setConfusionPairs(body.confusionPairs || [])
        setMisclassifications(body.misclassifications || [])
      })
      .catch(() => {
        if (!cancelled) setError('Could not load learning stats.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [adminLoading, isAdmin])

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-studio-dim">
        <AlertCircle className="h-4 w-4" /> Admin access required.
      </div>
    )
  }

  const diffCount = (f: RecentFeedback) =>
    (f.field_diff?.edited ?? 0) + (f.field_diff?.added ?? 0) + (f.field_diff?.removed ?? 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Smart Upload learning." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          What the classifier extracted vs what users saved. Edit rate falling over time means the
          learning loop is working.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
        </div>
      ) : error ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-studio-dim">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : (
        <>
          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">Accuracy by document type</h2>
              <p className="text-sm text-studio-dim">Confirmed uploads in the last 90 days. &quot;Edited&quot; = the user changed at least one field before saving.</p>
            </div>
            <div>
              {perType.length === 0 ? (
                <p className="text-sm text-studio-dim">No confirmed uploads yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Type</TableHead>
                      <TableHead className="text-right">Confirmed</TableHead>
                      <TableHead className="text-right">Edited</TableHead>
                      <TableHead className="text-right">Edit rate</TableHead>
                      <TableHead className="text-right">Wrong type</TableHead>
                      <TableHead className="text-right">Dismissed</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {perType.map((t) => (
                      <TableRow key={t.result_type}>
                        <TableCell className="font-mono text-xs">{t.result_type}</TableCell>
                        <TableCell className="text-right">{t.total}</TableCell>
                        <TableCell className="text-right">{t.edited}</TableCell>
                        <TableCell className="text-right">
                          <StateChip tone={t.edit_rate > 50 ? 'stale' : t.edit_rate > 20 ? 'attention' : 'good'}>
                            {t.edit_rate}%
                          </StateChip>
                        </TableCell>
                        <TableCell className="text-right">
                          <StateChip tone={t.misclassification_rate > 20 ? 'stale' : 'quiet'}>
                            {t.misclassified}
                          </StateChip>
                        </TableCell>
                        <TableCell className="text-right text-xs text-studio-dim">{t.dismissed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="flex items-center gap-2 font-display text-base font-semibold text-foreground">
                <FlaskConical className="h-4 w-4" />
                Misclassifications
              </h2>
              <p className="text-sm text-studio-dim">
                Documents the user reclassified via &quot;Change document type&quot;. Promote a file to
                the eval corpus to make it a permanent regression test for the classifier.
              </p>
            </div>
            <div>
              {misclassifications.length === 0 ? (
                <p className="text-sm text-studio-dim">No type corrections recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {confusionPairs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {confusionPairs.map((c) => (
                        <StateChip key={`${c.from}-${c.to}`} tone="attention" className="font-mono text-[11px] normal-case tracking-normal">
                          {c.from} <ArrowRight className="mx-1 inline h-3 w-3" /> {c.to} ×{c.count}
                        </StateChip>
                      ))}
                    </div>
                  )}
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>When</TableHead>
                        <TableHead>File</TableHead>
                        <TableHead>Read as</TableHead>
                        <TableHead>Corrected to</TableHead>
                        <TableHead>Organisation</TableHead>
                        <TableHead className="text-right">Eval corpus</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {misclassifications.map((m) => (
                        <TableRow key={m.id}>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(m.created_at), 'd MMM HH:mm')}
                          </TableCell>
                          <TableCell className="max-w-[220px] truncate text-xs">{m.file_name || '·'}</TableCell>
                          <TableCell className="font-mono text-xs">{m.result_type}</TableCell>
                          <TableCell className="font-mono text-xs">{m.corrected_result_type || '·'}</TableCell>
                          <TableCell className="text-xs text-studio-dim">{m.organization_name || '·'}</TableCell>
                          <TableCell className="text-right">
                            {promoted.has(m.id) ? (
                              <StateChip tone="good">Added</StateChip>
                            ) : (
                              <PillButton
                                variant="outline"
                                size="sm"
                                disabled={!m.job_id || !m.has_stash || promoting === m.id}
                                title={!m.has_stash ? 'The stashed file has been pruned' : undefined}
                                onClick={() => promoteToCorpus(m)}
                              >
                                {promoting === m.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  'Promote'
                                )}
                              </PillButton>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">Learned document profiles</h2>
              <p className="text-sm text-studio-dim">Supplier memory injected into the classifier prompt, most-seen first.</p>
            </div>
            <div>
              {topSuppliers.length === 0 ? (
                <p className="text-sm text-studio-dim">No profiles learned yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Organisation</TableHead>
                      <TableHead className="text-right">Seen</TableHead>
                      <TableHead>Hints</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {topSuppliers.map((s, i) => (
                      <TableRow key={`${s.supplier_key}-${s.result_type}-${i}`}>
                        <TableCell className="font-medium">
                          {s.supplier_key}
                          {s.match_kind === 'filename' && (
                            <StateChip tone="quiet" className="ml-2 text-[9px]">
                              filename pattern
                            </StateChip>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.result_type}</TableCell>
                        <TableCell className="text-xs text-studio-dim">{s.organization_name || '·'}</TableCell>
                        <TableCell className="text-right">{s.times_seen}</TableCell>
                        <TableCell className="max-w-[280px] truncate text-xs text-studio-dim">
                          {Object.entries(s.hints || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ') || '·'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Panel>

          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">Recent confirmations</h2>
              <p className="text-sm text-studio-dim">Latest 50 saves, with the user&apos;s corrections. Click a row to see the diff.</p>
            </div>
            <div>
              {recent.length === 0 ? (
                <p className="text-sm text-studio-dim">Nothing yet.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-8" />
                      <TableHead>When</TableHead>
                      <TableHead>Type</TableHead>
                      <TableHead>Supplier</TableHead>
                      <TableHead>Organisation</TableHead>
                      <TableHead className="text-right">Corrections</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {recent.map((f) => (
                      <>
                        <TableRow
                          key={f.id}
                          className="cursor-pointer"
                          onClick={() => setExpanded(expanded === f.id ? null : f.id)}
                        >
                          <TableCell>
                            {expanded === f.id ? (
                              <ChevronDown className="h-3.5 w-3.5" />
                            ) : (
                              <ChevronRight className="h-3.5 w-3.5" />
                            )}
                          </TableCell>
                          <TableCell className="whitespace-nowrap text-xs">
                            {format(new Date(f.created_at), 'd MMM HH:mm')}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{f.result_type}</TableCell>
                          <TableCell className="text-xs">{f.supplier_key || '·'}</TableCell>
                          <TableCell className="text-xs text-studio-dim">{f.organization_name || '·'}</TableCell>
                          <TableCell className="text-right">
                            <StateChip tone={diffCount(f) > 0 ? 'attention' : 'quiet'}>{diffCount(f)}</StateChip>
                          </TableCell>
                        </TableRow>
                        {expanded === f.id && (
                          <TableRow key={`${f.id}-diff`}>
                            <TableCell colSpan={6} className="bg-studio-paper/60">
                              <pre className="max-h-64 overflow-y-auto whitespace-pre-wrap p-2 text-[11px]">
                                {JSON.stringify({ field_diff: f.field_diff, context: f.context }, null, 2)}
                              </pre>
                            </TableCell>
                          </TableRow>
                        )}
                      </>
                    ))}
                  </TableBody>
                </Table>
              )}
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}
