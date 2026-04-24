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
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table'
import { Loader2, ShieldAlert, Mail, Camera } from 'lucide-react'
import { toast } from 'sonner'

interface Organization { id: string; name: string }

interface Snapshot {
  id: string
  organization_id: string
  organization_name: string | null
  year: number
  previous_total_kg: number | null
  new_total_kg: number
  delta_kg: number | null
  delta_pct: number | null
  reason: string | null
  captured_at: string
  notified_at: string | null
  notified_to: string | null
}

export default function ReconciliationPage() {
  const { isAlkateraAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()

  const [orgs, setOrgs] = useState<Organization[]>([])
  const [snapshots, setSnapshots] = useState<Snapshot[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [year, setYear] = useState<number>(new Date().getFullYear())
  const [reason, setReason] = useState<string>('')
  const [capturing, setCapturing] = useState(false)
  const [notifyingId, setNotifyingId] = useState<string | null>(null)

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

  const loadSnapshots = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) return
    const res = await fetch('/api/admin/reconciliation', {
      headers: { Authorization: `Bearer ${session.access_token}` },
    })
    if (!res.ok) return
    const { snapshots: rows } = (await res.json()) as { snapshots: Snapshot[] }
    setSnapshots(rows)
  }, [])

  useEffect(() => {
    if (isAlkateraAdmin) {
      loadOrgs()
      loadSnapshots()
    }
  }, [isAlkateraAdmin, loadOrgs, loadSnapshots])

  async function captureSnapshot() {
    if (!orgId) {
      toast.error('Pick an organisation')
      return
    }
    setCapturing(true)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/reconciliation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organizationId: orgId, year, reason: reason || undefined }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Snapshot failed')
      toast.success('Snapshot captured')
      setReason('')
      loadSnapshots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Snapshot failed')
    } finally {
      setCapturing(false)
    }
  }

  async function notify(snapshotId: string) {
    setNotifyingId(snapshotId)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/reconciliation/notify', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ snapshotId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Notify failed')
      toast.success(`Emailed ${data.recipient}`)
      loadSnapshots()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Notify failed')
    } finally {
      setNotifyingId(null)
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
              This tool is only available to platform administrators.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <div className="space-y-6 max-w-6xl">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Emissions reconciliation</h1>
        <p className="text-sm text-muted-foreground mt-2">
          Capture the current corporate footprint for an organisation and year, and notify the
          customer when a methodology change moves their total by more than 5&#37;. Each snapshot
          becomes part of the GHG Protocol audit trail.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Capture new snapshot</CardTitle>
          <CardDescription>
            Recomputes the org&apos;s footprint via the current resolver and logs it alongside the
            prior snapshot for diffing.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_120px_1fr_auto] items-end">
          <div className="space-y-1.5">
            <Label>Organisation</Label>
            <Select value={orgId} onValueChange={setOrgId}>
              <SelectTrigger><SelectValue placeholder="Pick one..." /></SelectTrigger>
              <SelectContent>
                {orgs.map((o) => (
                  <SelectItem key={o.id} value={o.id}>{o.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Year</Label>
            <Input
              type="number"
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
            />
          </div>
          <div className="space-y-1.5">
            <Label>Reason (optional)</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g. Phase 2 inventory ledger rollout"
            />
          </div>
          <Button onClick={captureSnapshot} disabled={capturing || !orgId}>
            {capturing ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Camera className="h-4 w-4 mr-2" />}
            Capture
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent snapshots</CardTitle>
          <CardDescription>
            Snapshots flagged in amber moved the total by more than 5&#37; — notify the customer.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {snapshots.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4 text-center">
              No snapshots yet.
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Captured</TableHead>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Year</TableHead>
                  <TableHead className="text-right">Previous</TableHead>
                  <TableHead className="text-right">New</TableHead>
                  <TableHead className="text-right">Δ</TableHead>
                  <TableHead>Reason</TableHead>
                  <TableHead>Notify</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {snapshots.map((s) => {
                  const material = s.delta_pct !== null && Math.abs(s.delta_pct) > 5
                  return (
                    <TableRow key={s.id} className={material ? 'bg-amber-50/40 dark:bg-amber-950/20' : undefined}>
                      <TableCell className="text-xs">
                        {new Date(s.captured_at).toLocaleString('en-GB')}
                      </TableCell>
                      <TableCell className="text-sm">{s.organization_name || s.organization_id.slice(0, 8)}</TableCell>
                      <TableCell className="font-mono text-xs">{s.year}</TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.previous_total_kg !== null ? (s.previous_total_kg / 1000).toFixed(2) : '—'}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {(s.new_total_kg / 1000).toFixed(2)}
                      </TableCell>
                      <TableCell className="text-right font-mono text-xs">
                        {s.delta_pct !== null ? (
                          <Badge variant="outline" className={material ? 'text-amber-700 border-amber-300' : ''}>
                            {s.delta_pct > 0 ? '+' : ''}{s.delta_pct.toFixed(1)}&#37;
                          </Badge>
                        ) : '—'}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate">
                        {s.reason || '—'}
                      </TableCell>
                      <TableCell>
                        {s.notified_at ? (
                          <span className="text-xs text-muted-foreground">
                            Sent {new Date(s.notified_at).toLocaleDateString('en-GB')}
                          </span>
                        ) : (
                          <Button
                            size="sm"
                            variant={material ? 'default' : 'outline'}
                            disabled={notifyingId === s.id}
                            onClick={() => notify(s.id)}
                          >
                            {notifyingId === s.id
                              ? <Loader2 className="h-3 w-3 mr-1.5 animate-spin" />
                              : <Mail className="h-3 w-3 mr-1.5" />}
                            Email
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  )
                })}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
