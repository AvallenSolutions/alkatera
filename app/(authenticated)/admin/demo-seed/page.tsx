'use client'

import { useState, useEffect, useCallback } from 'react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabaseClient'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ShieldAlert, Sprout, Wine, RotateCcw } from 'lucide-react'
import { Eyebrow } from '@/components/studio/eyebrow'
import { toast } from 'sonner'

interface Organization { id: string; name: string }

interface SeedResult {
  ok: boolean
  xeroTransactionsInserted: number
  nextSteps: string[]
}

interface DrinksCoResult {
  ok: boolean
  report: Record<string, string>
  warnings: string[]
  nextSteps: string[]
}

export default function DemoSeedPage() {
  const { isAlkateraAdmin, isLoading: adminLoading } = useIsAlkateraAdmin()
  const [orgs, setOrgs] = useState<Organization[]>([])
  const [orgId, setOrgId] = useState<string>('')
  const [seeding, setSeeding] = useState(false)
  const [result, setResult] = useState<SeedResult | null>(null)
  const [drinksAction, setDrinksAction] = useState<'seed' | 'reset' | null>(null)
  const [drinksResult, setDrinksResult] = useState<DrinksCoResult | null>(null)

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

  useEffect(() => { if (isAlkateraAdmin) loadOrgs() }, [isAlkateraAdmin, loadOrgs])

  async function seed() {
    if (!orgId) {
      toast.error('Pick an organisation')
      return
    }
    setSeeding(true)
    setResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/seed-inventory-demo', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify({ organizationId: orgId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Seed failed')
      toast.success(`Seeded: ${data.xeroTransactionsInserted} new Xero rows`)
      setResult(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Seed failed')
    } finally {
      setSeeding(false)
    }
  }

  async function runDrinksCo(action: 'seed' | 'reset') {
    if (action === 'reset' && !window.confirm('Remove the Drinks Co demo dataset (operational data, targets, B Corp, suppliers, etc.)? The org, facilities and keeper products stay.')) {
      return
    }
    setDrinksAction(action)
    setDrinksResult(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      const res = await fetch('/api/admin/seed-drinks-co-demo', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session?.access_token}` },
        body: JSON.stringify({ action }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed')
      setDrinksResult(data)
      toast.success(action === 'seed' ? 'alkatera Drinks Co demo seeded' : 'Drinks Co demo dataset reset')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Failed')
    } finally {
      setDrinksAction(null)
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
    <div className="space-y-6 max-w-3xl">
      <div>
        <Eyebrow tone="dim" className="mb-3">THE WIRING · ADMIN</Eyebrow>
        <h1 className="font-display text-3xl font-bold tracking-[-0.035em] text-foreground">
          Demo seed: inventory and Xero.
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          One-click seed so you can test the full double-counting pipeline: two products
          (one with a completed LCA, one without), three ingredients, a demo facility, and
          five unlinked Xero raw_materials invoices spread across the last six months.
          Idempotent, safe to click multiple times.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Target organisation</CardTitle>
          <CardDescription>
            Pick the alka<strong>tera</strong> Demo org (or any test org) to seed.
          </CardDescription>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-[1fr_auto] items-end">
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
          <Button onClick={seed} disabled={seeding || !orgId}>
            {!seeding && <Sprout className="h-4 w-4 mr-2" />}
            {seeding ? 'Seeding…' : 'Seed demo data'}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <Wine className="h-4 w-4" />
            alka<strong>tera</strong> Drinks Co: full showcase demo
          </CardTitle>
          <CardDescription>
            Builds the complete dataset for the <strong>alkatera Drinks Co</strong> org: curated
            products (wine with viticulture, Calvados with an orchard, whisky maturation, a
            multipack), ~24 months of facility energy/water/waste + production, reconciled Pulse
            trends, targets + action plan, B Corp progress, social data and a full supplier + Xero
            set. Idempotent. After seeding, run <strong>Recalculate LCAs</strong> with this org
            active to compute the real footprints.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex flex-wrap items-center gap-3">
          <Button onClick={() => runDrinksCo('seed')} loading={drinksAction === 'seed'} disabled={drinksAction !== null}>
            {drinksAction !== 'seed' && <Wine className="h-4 w-4 mr-2" />}
            Seed Drinks Co demo
          </Button>
          <Button variant="outline" onClick={() => runDrinksCo('reset')} loading={drinksAction === 'reset'} disabled={drinksAction !== null}>
            {drinksAction !== 'reset' && <RotateCcw className="h-4 w-4 mr-2" />}
            Reset dataset
          </Button>
        </CardContent>
      </Card>

      {drinksResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Drinks Co seed result</CardTitle>
            <CardDescription>What was written. Existing rows the seed owns were replaced, not duplicated.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <ul className="space-y-1">
              {Object.entries(drinksResult.report).map(([k, v]) => (
                <li key={k}><span className="font-medium">{k}:</span> <span className="text-muted-foreground">{v}</span></li>
              ))}
            </ul>
            {drinksResult.warnings.length > 0 && (
              <div className="text-studio-attention">
                <p className="font-medium">Warnings:</p>
                <ul className="list-disc pl-5">{drinksResult.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <ol className="list-decimal pl-5 text-muted-foreground space-y-1">
              {drinksResult.nextSteps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </CardContent>
        </Card>
      )}

      {result && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">What to try next</CardTitle>
            <CardDescription>
              Inserted {result.xeroTransactionsInserted} new Xero rows. Existing rows were
              left untouched.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ol className="text-sm space-y-2 list-decimal pl-5 text-muted-foreground">
              {result.nextSteps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
