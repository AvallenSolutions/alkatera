'use client'

import { useState, useEffect, useCallback } from 'react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabaseClient'
import { Panel } from '@/components/studio/panel'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import { AlertTriangle, ShieldAlert } from 'lucide-react'
import { toast } from 'sonner'
import type { EmissionsTrace } from '@/lib/emissions/types'
import { Brand } from '@/components/shared/Brand'
import { Eyebrow } from '@/components/studio/eyebrow'
import { BigNumber } from '@/components/studio/big-number'

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
        <p className="text-sm text-muted-foreground">Loading…</p>
      </div>
    )
  }

  if (!isAlkateraAdmin) {
    return (
      <Panel className="max-w-xl mx-auto mt-12">
        <div className="flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 text-muted-foreground mt-0.5" />
          <div>
            <h2 className="font-semibold">Admin access required</h2>
            <p className="text-sm text-muted-foreground mt-1">
              This diagnostic tool is only available to <Brand /> platform administrators.
            </p>
          </div>
        </div>
      </Panel>
    )
  }

  const totalKg = trace?.attributions.reduce((sum, a) => sum + a.kgCO2e, 0) || 0
  const suppressedKg = trace?.rows.filter((r) => r.suppressed).reduce((s, r) => s + r.kgCO2e, 0) || 0

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <Eyebrow tone="dim" className="mb-3">THE WIRING · ADMIN</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-foreground">
          Emissions trace.
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Phase 0 instrumentation. Enumerates every row currently contributing to an
          organisation&apos;s corporate footprint and flags source overlaps that indicate
          silent double-counting.
        </p>
      </div>

      <Panel>
        <div className="mb-4 space-y-1">
          <h2 className="font-display text-base font-semibold text-foreground">Select an organisation &amp; year</h2>
          <p className="text-sm text-studio-dim">Read-only. Does not modify any data.</p>
        </div>
        <div className="grid gap-4 md:grid-cols-[1fr_120px_auto] items-end">
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
            {loading ? 'Running…' : 'Run trace'}
          </Button>
        </div>
      </Panel>

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
            <Panel>
              <div className="text-sm text-muted-foreground">
                {suppressedKg.toLocaleString(undefined, { maximumFractionDigits: 0 })} kgCO2e
                in rows currently excluded from totals (upgrade_status = upgraded or dismissed).
              </div>
            </Panel>
          )}

          {trace.warnings.length > 0 && (
            <Panel>
              <div className="mb-4 space-y-1">
                <h2 className="font-display text-base font-semibold text-foreground flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-studio-attention" />
                  Overlap warnings
                </h2>
                <p className="text-sm text-studio-dim">
                  Two or more sources contribute to the same scope slice + month. Each of these
                  is a likely double-count that Phase 1 suppression rules will resolve.
                </p>
              </div>
              <div>
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
                        <TableCell className="font-mono text-xs">
                          {w.sources.join(' · ')}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </Panel>
          )}

          <Panel>
            <div className="mb-4 space-y-1">
              <h2 className="font-display text-base font-semibold text-foreground">Per-slice attribution</h2>
              <p className="text-sm text-studio-dim">
                What currently counts toward each scope slice, per month, with suppressed sources
                listed for context.
              </p>
            </div>
            <div>
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
                      <TableCell className="text-xs">{a.winningSource || '·'}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {a.kgCO2e.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        {a.suppressedSources.length === 0
                          ? '·'
                          : a.suppressedSources
                              .map((s) => `${s.source} (${s.rowCount})`)
                              .join(', ')}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </Panel>
        </>
      )}
    </div>
  )
}

function StatCard({ label, value, tone = 'neutral' }: { label: string; value: string; tone?: 'neutral' | 'warn' | 'ok' }) {
  return (
    <Panel>
      <div>
        <BigNumber
          value={value}
          label={label}
          tone={tone === 'warn' ? 'attention' : tone === 'ok' ? 'good' : 'ink'}
        />
      </div>
    </Panel>
  )
}
