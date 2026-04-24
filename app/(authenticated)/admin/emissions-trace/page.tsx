'use client'

import { useState, useEffect, useCallback } from 'react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { AlertTriangle, Loader2, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { EmissionsTrace } from '@/lib/emissions/types'

interface Organization {
  id: string
  name: string
  slug: string
}

export default function EmissionsTracePage() {
  const { isAlkateraAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()

  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [trace, setTrace] = useState<EmissionsTrace | null>(null)
  const [loading, setLoading] = useState(false)

  const loadOrgs = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin/beta-access', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return
    const { organizations } = (await res.json()) as { organizations: Organization[] }
    setOrgs(organizations.sort((a, b) => a.name.localeCompare(b.name)))
  }, [])

  useEffect(() => {
    if (isAlkateraAdmin) loadOrgs()
  }, [isAlkateraAdmin, loadOrgs])

  async function runTrace() {
    if (!orgId) return
    setLoading(true)
    setTrace(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch(
        `/api/emissions/trace?organizationId=${orgId}&year=${year}`,
        { headers: { Authorization: `Bearer ${session?.access_token}` } },
      )
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Trace failed')
      setTrace(data as EmissionsTrace)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Trace failed')
    } finally {
      setLoading(false)
    }
  }

  if (adminLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!isAlkateraAdmin) {
    return (
      <Card className="max-w-xl mx-auto mt-12">
        <CardContent className="py-6 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h2 className="font-semibold">Admin access required</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This diagnostic tool is only available to alka**tera** platform administrators.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  const totalKg = trace?.attributions.reduce((sum, a) => sum + a.kgCO2e, 0) || 0
  const suppressedKg = trace?.rows.filter((r) => r.suppressed).reduce((s, r) => s + r.kgCO2e, 0) || 0

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Emissions Trace</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Phase 0 instrumentation. Enumerates every row currently contributing to an
          organisation&apos;s corporate footprint and flags source overlaps that indicate
          silent double-counting.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Select an organisation &amp; year</CardTitle>
          <CardDescription>Read-only. Does not modify any data.</CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_120px_auto] items-end">
          <div className="space-y-1.5">
            <Label>Organisation</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger>
                <SelectValue placeholder="Choose an organisation" />
              </SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>
                    {o.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
              min={2020}
              max={2100}
            />
          </div>
          <Button onClick={runTrace} disabled={!orgId || loading}>
            {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : null}
            Run trace
          </Button>
        </CardContent>
      </Card>

      {trace && (
        <>
          <div className="grid gap-4 md:grid-cols-3">
            <StatCard label="Rows enumerated" value={trace.rows.length.toLocaleString()} />
            <StatCard label="Total kgCO2e" value={totalKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} />
            <StatCard
              label="Overlap warnings"
              value={trace.warnings.length.toLocaleString()}
              tone={trace.warnings.length > 0 ? 'warn' : 'ok'}
            />
          </div>

          {suppressedKg > 0 && (
            <Card>
              <CardContent className="py-3 text-sm text-muted-foreground">
                {suppressedKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO2e
                in rows currently excluded from totals (upgrade_status = upgraded or dismissed).
              </CardContent>
            </Card>
          )}

          {trace.warnings.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-500" />
                  Overlap warnings
                </CardTitle>
                <CardDescription>
                  Two or more sources contribute to the same scope slice + month. Each of these
                  is a likely double-count that Phase 1 suppression rules will resolve.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Scope slice</TableHead>
                      <TableHead>Period</TableHead>
                      <TableHead>Sources</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {trace.warnings.map((w, i) => (
                      <TableRow key={i}>
                        <TableCell className="font-mono text-xs">{w.scopeSlice}</TableCell>
                        <TableCell>{w.period}</TableCell>
                        <TableCell className="flex gap-1 flex-wrap">
                          {w.sources.map((s) => (
                            <Badge key={s} variant="outline" className="text-xs">
                              {s}
                            </Badge>
                          ))}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Per-slice attribution</CardTitle>
              <CardDescription>
                What currently counts toward each scope slice, per month, with suppressed sources
                listed for context.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Scope slice</TableHead>
                    <TableHead>Period</TableHead>
                    <TableHead>Winning source</TableHead>
                    <TableHead className="text-right">kgCO2e</TableHead>
                    <TableHead>Suppressed</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {trace.attributions.map((a, i) => (
                    <TableRow key={i}>
                      <TableCell className="font-mono text-xs">{a.scopeSlice}</TableCell>
                      <TableCell>{a.period}</TableCell>
                      <TableCell className="text-xs">{a.winningSource || '—'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {a.kgCO2e.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.suppressedSources.length === 0
                          ? '—'
                          : a.suppressedSources
                              .map((s) => `${s.source} (${s.rowCount})`)
                              .join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warn' | 'ok' }) {
  const toneClass =
    tone === 'warn'
      ? 'text-amber-600 dark:text-amber-400'
      : tone === 'ok'
      ? 'text-emerald-600 dark:text-emerald-400'
      : 'text-foreground'
  return (
    <Card>
      <CardContent className="py-4">
        <div className="text-xs uppercase text-muted-foreground tracking-wide">{label}</div>
        <div className={`text-2xl font-semibold mt-1 ${toneClass}`}>{value}</div>
      </CardContent>
    </Card>
  )
}
