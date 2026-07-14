'use client'

import { useEffect, useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Brain, Loader2, AlertCircle, ChevronDown, ChevronRight, ArrowRight, FlaskConical } from 'lucide-react'
import { Button } from '@/components/ui/button'
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
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <div className="flex items-center gap-2 justify-center py-20 text-sm text-muted-foreground">
        <AlertCircle className="h-4 w-4" /> Admin access required.
      </div>
    )
  }

  const diffCount = (f: RecentFeedback) =>
    (f.field_diff?.edited ?? 0) + (f.field_diff?.added ?? 0) + (f.field_diff?.removed ?? 0)

  return (
    <div className="space-y-6 p-6">
      <div>
        <h1 className="text-2xl font-semibold flex items-center gap-2">
          <Brain className="h-5 w-5 text-[#8da300] dark:text-[#ccff00]" />
          Smart Upload learning
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          What the classifier extracted vs what users saved. Edit rate falling over time means the
          learning loop is working.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : error ? (
        <div className="flex items-center gap-2 py-16 justify-center text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" /> {error}
        </div>
      ) : (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Accuracy by document type</CardTitle>
              <CardDescription>Confirmed uploads in the last 90 days. &quot;Edited&quot; = the user changed at least one field before saving.</CardDescription>
            </CardHeader>
            <CardContent>
              {perType.length === 0 ? (
                <p className="text-sm text-muted-foreground">No confirmed uploads yet.</p>
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
                          <Badge variant={t.edit_rate > 50 ? 'destructive' : t.edit_rate > 20 ? 'secondary' : 'outline'}>
                            {t.edit_rate}%
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <Badge variant={t.misclassification_rate > 20 ? 'destructive' : 'outline'}>
                            {t.misclassified}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right text-xs text-muted-foreground">{t.dismissed}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <FlaskConical className="h-4 w-4" />
                Misclassifications
              </CardTitle>
              <CardDescription>
                Documents the user reclassified via &quot;Change document type&quot;. Promote a file to
                the eval corpus to make it a permanent regression test for the classifier.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {misclassifications.length === 0 ? (
                <p className="text-sm text-muted-foreground">No type corrections recorded yet.</p>
              ) : (
                <div className="space-y-4">
                  {confusionPairs.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {confusionPairs.map((c) => (
                        <Badge key={`${c.from}-${c.to}`} variant="secondary" className="font-mono text-[11px]">
                          {c.from} <ArrowRight className="h-3 w-3 mx-1" /> {c.to} ×{c.count}
                        </Badge>
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
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(m.created_at), 'd MMM HH:mm')}
                          </TableCell>
                          <TableCell className="text-xs max-w-[220px] truncate">{m.file_name || '—'}</TableCell>
                          <TableCell className="font-mono text-xs">{m.result_type}</TableCell>
                          <TableCell className="font-mono text-xs">{m.corrected_result_type || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{m.organization_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            {promoted.has(m.id) ? (
                              <Badge variant="outline">Added</Badge>
                            ) : (
                              <Button
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs"
                                disabled={!m.job_id || !m.has_stash || promoting === m.id}
                                title={!m.has_stash ? 'The stashed file has been pruned' : undefined}
                                onClick={() => promoteToCorpus(m)}
                              >
                                {promoting === m.id ? (
                                  <Loader2 className="h-3 w-3 animate-spin" />
                                ) : (
                                  'Promote'
                                )}
                              </Button>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Learned document profiles</CardTitle>
              <CardDescription>Supplier memory injected into the classifier prompt, most-seen first.</CardDescription>
            </CardHeader>
            <CardContent>
              {topSuppliers.length === 0 ? (
                <p className="text-sm text-muted-foreground">No profiles learned yet.</p>
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
                            <Badge variant="outline" className="ml-2 text-[10px]">
                              filename pattern
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="font-mono text-xs">{s.result_type}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{s.organization_name || '—'}</TableCell>
                        <TableCell className="text-right">{s.times_seen}</TableCell>
                        <TableCell className="text-xs text-muted-foreground max-w-[280px] truncate">
                          {Object.entries(s.hints || {})
                            .map(([k, v]) => `${k}: ${v}`)
                            .join(' · ') || '—'}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Recent confirmations</CardTitle>
              <CardDescription>Latest 50 saves, with the user&apos;s corrections. Click a row to see the diff.</CardDescription>
            </CardHeader>
            <CardContent>
              {recent.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nothing yet.</p>
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
                          <TableCell className="text-xs whitespace-nowrap">
                            {format(new Date(f.created_at), 'd MMM HH:mm')}
                          </TableCell>
                          <TableCell className="font-mono text-xs">{f.result_type}</TableCell>
                          <TableCell className="text-xs">{f.supplier_key || '—'}</TableCell>
                          <TableCell className="text-xs text-muted-foreground">{f.organization_name || '—'}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={diffCount(f) > 0 ? 'secondary' : 'outline'}>{diffCount(f)}</Badge>
                          </TableCell>
                        </TableRow>
                        {expanded === f.id && (
                          <TableRow key={`${f.id}-diff`}>
                            <TableCell colSpan={6} className="bg-muted/30">
                              <pre className="text-[11px] whitespace-pre-wrap max-h-64 overflow-y-auto p-2">
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
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}
