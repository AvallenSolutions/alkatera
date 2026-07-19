'use client'

import { useCallback, useEffect, useState } from 'react'
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
import { Dog, Loader2, AlertCircle, TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { format } from 'date-fns'

/**
 * Rosa learning loop, admin view.
 *
 * The Smart Upload equivalent is /admin/ingest-learning. Three signals feed
 * this and nothing read any of them before now: explicit thumbs and correction
 * text, implicit tile behaviour, and the per-org corrections Rosa carries into
 * later conversations.
 *
 * Expect thin data at first. Feedback was only collectable from /admin/rosa
 * until the drawer rating controls shipped on 2026-07-19, so anything earlier
 * is admin testing rather than real usage.
 */

interface Analytics {
  periodStart: string
  periodEnd: string
  totalFeedback: number
  positiveCount: number
  negativeCount: number
  positiveRate: number
  categoryBreakdown: { category: string; positiveRate: number; totalCount: number }[]
  improvementSuggestions: {
    priority: number
    suggestion: string
    expectedImpact: string
    relatedPatterns: string[]
  }[]
  knowledgeGaps: {
    topic: string
    questionCount: number
    avgRating: number
    suggestedContent: string
  }[]
  topNegativePatterns: {
    pattern: string
    category: string
    negativeCount: number
    successRate: number
  }[]
}

interface Payload {
  period_days: number
  analytics: Analytics
  stats: { totalFeedback: number; positiveRate: number; trend: 'improving' | 'declining' | 'stable' }
  telemetry: { event: string; count: number }[]
  tile_engagement: {
    shown: number
    clicked: number
    snoozed: number
    click_rate: number | null
    snooze_rate: number | null
  }
  corrections: Array<{
    organization_id: string
    key: string
    value: string
    updated_at: string
    organizations: { name: string } | null
  }>
  recent_feedback: Array<{
    id: string
    rating: string
    created_at: string
    organizations: { name: string } | null
  }>
}

export default function RosaLearningPage() {
  const { isAlkateraAdmin: isAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [days, setDays] = useState(30)
  const [data, setData] = useState<Payload | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/admin/rosa-learning?days=${days}`, { credentials: 'include' })
      const body = await res.json()
      if (!res.ok) throw new Error(body?.error || `Request failed (${res.status})`)
      setData(body)
    } catch (err: any) {
      setError(err?.message ?? 'Could not load the learning data')
    } finally {
      setLoading(false)
    }
  }, [days])

  useEffect(() => {
    if (isAdmin) void load()
  }, [isAdmin, load])

  if (adminLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAdmin) {
    return (
      <Card>
        <CardContent className="flex items-center gap-2 py-8 text-sm text-muted-foreground">
          <AlertCircle className="h-4 w-4" />
          This page is for alkatera platform admins.
        </CardContent>
      </Card>
    )
  }

  const a = data?.analytics
  const trend = data?.stats.trend

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold flex items-center gap-2">
            <Dog className="h-6 w-6 text-[#ccff00]" />
            Rosa learning
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            What users tell Rosa she got wrong, what they actually click, and the corrections
            she now carries per organisation.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {[7, 30, 90].map(d => (
            <Button
              key={d}
              size="sm"
              variant={days === d ? 'default' : 'outline'}
              onClick={() => setDays(d)}
            >
              {d}d
            </Button>
          ))}
        </div>
      </div>

      {error && (
        <Card className="border-red-500/40">
          <CardContent className="flex items-center gap-2 py-4 text-sm text-red-300">
            <AlertCircle className="h-4 w-4" />
            {error}
          </CardContent>
        </Card>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
        </div>
      )}

      {!loading && data && (
        <>
          {/* Headline */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat
              label="Answers rated"
              value={a?.totalFeedback ?? 0}
              hint={a?.totalFeedback ? undefined : 'Nobody has rated an answer yet'}
            />
            <Stat
              label="Rated useful"
              value={a?.totalFeedback ? `${a.positiveRate}%` : '—'}
              hint={
                a?.totalFeedback
                  ? `${a.positiveCount} up, ${a.negativeCount} down`
                  : 'No ratings in this window'
              }
            />
            <Stat
              label="Trend"
              value={
                trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable'
              }
              icon={
                trend === 'improving' ? (
                  <TrendingUp className="h-4 w-4 text-[#ccff00]" />
                ) : trend === 'declining' ? (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                ) : (
                  <Minus className="h-4 w-4 text-muted-foreground" />
                )
              }
              hint="Versus the previous period of the same length"
            />
            <Stat
              label="Tile click rate"
              value={
                data.tile_engagement.click_rate === null
                  ? '—'
                  : `${data.tile_engagement.click_rate}%`
              }
              hint={
                data.tile_engagement.shown
                  ? `${data.tile_engagement.clicked} clicked, ${data.tile_engagement.snoozed} snoozed of ${data.tile_engagement.shown} shown`
                  : 'No tiles shown in this window'
              }
            />
          </div>

          {/* Where she is weak */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Where Rosa is weakest</CardTitle>
              <CardDescription>
                Questions grouped by topic. A low useful rate here is the signal to improve the
                persona or add a knowledge entry.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {a && a.categoryBreakdown.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Topic</TableHead>
                      <TableHead className="text-right">Rated</TableHead>
                      <TableHead className="text-right">Useful</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {a.categoryBreakdown
                      .slice()
                      .sort((x, y) => x.positiveRate - y.positiveRate)
                      .map(c => (
                        <TableRow key={c.category}>
                          <TableCell className="font-medium">{c.category}</TableCell>
                          <TableCell className="text-right">{c.totalCount}</TableCell>
                          <TableCell className="text-right">
                            <Badge variant={c.positiveRate >= 70 ? 'default' : 'destructive'}>
                              {Math.round(c.positiveRate)}%
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty>Nothing rated yet in this window.</Empty>
              )}
            </CardContent>
          </Card>

          {/* What to do about it */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Suggested improvements</CardTitle>
              <CardDescription>
                Derived from the negative ratings. These are prompts for you, not changes Rosa
                makes to herself: persona and knowledge edits stay human-authored.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {a && a.improvementSuggestions.length > 0 ? (
                a.improvementSuggestions
                  .slice()
                  .sort((x, y) => x.priority - y.priority)
                  .map((s, i) => (
                  <div key={i} className="rounded-lg border border-border bg-card/60 p-3">
                    <div className="flex items-start gap-2">
                      {/* priority is a fixed rank per suggestion TYPE, not a
                          position in this list, so rendering it as "P2" reads
                          as though a P1 is missing when the category-level
                          suggestion simply did not meet its threshold. */}
                      <Badge variant={s.priority === 1 ? 'destructive' : 'outline'}>
                        {s.priority === 1 ? 'High' : s.priority === 2 ? 'Medium' : 'Low'}
                      </Badge>
                      <div className="min-w-0">
                        <p className="text-sm">{s.suggestion}</p>
                        <p className="text-xs text-muted-foreground mt-1">{s.expectedImpact}</p>
                      </div>
                    </div>
                  </div>
                ))
              ) : (
                <Empty>
                  No suggestions yet. These appear once there are enough negative ratings to see a
                  pattern.
                </Empty>
              )}
            </CardContent>
          </Card>

          {/* Per-org corrections */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Corrections Rosa is carrying</CardTitle>
              <CardDescription>
                Facts a user asked Rosa to remember after a bad answer. Scoped to that
                organisation and injected into its later conversations, never another&apos;s.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.corrections.length > 0 ? (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Organisation</TableHead>
                      <TableHead>Correction</TableHead>
                      <TableHead className="text-right">Saved</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.corrections.map(c => (
                      <TableRow key={`${c.organization_id}-${c.key}`}>
                        <TableCell className="font-medium">
                          {c.organizations?.name ?? c.organization_id.slice(0, 8)}
                        </TableCell>
                        <TableCell className="max-w-md">{c.value}</TableCell>
                        <TableCell className="text-right text-muted-foreground text-xs">
                          {format(new Date(c.updated_at), 'd MMM yyyy')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <Empty>
                  No corrections saved yet. They appear when a user ticks &quot;remember this for
                  my organisation&quot; on a thumbs-down.
                </Empty>
              )}
            </CardContent>
          </Card>

          {/* Raw telemetry */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Behaviour signals</CardTitle>
              <CardDescription>
                Everything rosa_telemetry recorded in this window. Clicked versus snoozed is the
                honest read on whether Rosa surfaced something worth doing.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {data.telemetry.length > 0 ? (
                <div className="flex flex-wrap gap-2">
                  {data.telemetry.map(t => (
                    <Badge key={t.event} variant="outline" className="font-mono text-xs">
                      {t.event} · {t.count}
                    </Badge>
                  ))}
                </div>
              ) : (
                <Empty>No telemetry recorded in this window.</Empty>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  icon,
}: {
  label: string
  value: string | number
  hint?: string
  icon?: React.ReactNode
}) {
  return (
    <Card>
      <CardContent className="pt-5">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className="text-2xl font-semibold mt-1 flex items-center gap-2">
          {icon}
          {value}
        </p>
        {hint && <p className="text-xs text-muted-foreground mt-1">{hint}</p>}
      </CardContent>
    </Card>
  )
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted-foreground py-2">{children}</p>
}
