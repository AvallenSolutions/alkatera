'use client'

import { useState, useEffect, useCallback } from 'react'
import { useIsAlkateraAdmin } from '@/hooks/usePermissions'
import { supabase } from '@/lib/supabaseClient'
import { Label } from '@/components/ui/label'
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from '@/components/ui/select'
import { ShieldAlert } from 'lucide-react'
import { Statement } from '@/components/studio/statement'
import { Panel } from '@/components/studio/panel'
import { PillButton } from '@/components/studio/pill-button'
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
        <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">Loading…</p>
      </div>
    )
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="flex items-center justify-center gap-2 py-20 text-sm text-studio-dim">
        <ShieldAlert className="h-4 w-4" />
        Admin access required.
      </div>
    )
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div>
        <Statement eyebrow="THE WIRING · ADMIN" headline="Demo seed: inventory and Xero." />
        <p className="mt-2 max-w-2xl text-sm text-studio-dim">
          One-click seed so you can test the full double-counting pipeline: two products
          (one with a completed LCA, one without), three ingredients, a demo facility, and
          five unlinked Xero raw_materials invoices spread across the last six months.
          Idempotent, safe to click multiple times.
        </p>
      </div>

      <Panel>
        <div className="mb-4 space-y-1">
          <h2 className="font-display text-base font-semibold text-foreground">Target organisation</h2>
          <p className="text-sm text-studio-dim">
            Pick the alka<strong>tera</strong> Demo org (or any test org) to seed.
          </p>
        </div>
        <div className="grid items-end gap-4 md:grid-cols-[1fr_auto]">
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
          <PillButton onClick={seed} disabled={seeding || !orgId}>
            {seeding ? 'Seeding…' : 'Seed demo data'}
          </PillButton>
        </div>
      </Panel>

      <Panel>
        <div className="mb-4 space-y-1">
          <h2 className="font-display text-base font-semibold text-foreground">
            alka<strong>tera</strong> Drinks Co: full showcase demo
          </h2>
          <p className="text-sm text-studio-dim">
            Builds the complete dataset for the <strong>alkatera Drinks Co</strong> org: curated
            products (wine with viticulture, Calvados with an orchard, whisky maturation, a
            multipack), ~24 months of facility energy/water/waste + production, reconciled Pulse
            trends, targets + action plan, B Corp progress, social data and a full supplier + Xero
            set. Idempotent. Completed LCAs are seeded directly, so every product shows a
            footprint straight away. Do <strong>not</strong> run Recalculate LCAs afterwards: the
            seeded footprints are the demo numbers, and a recalc would skip every product anyway
            because the seed owns the PCFs.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <PillButton onClick={() => runDrinksCo('seed')} disabled={drinksAction !== null}>
            {drinksAction === 'seed' ? 'Seeding…' : 'Seed Drinks Co demo'}
          </PillButton>
          <PillButton variant="outline" onClick={() => runDrinksCo('reset')} disabled={drinksAction !== null}>
            {drinksAction === 'reset' ? 'Resetting…' : 'Reset dataset'}
          </PillButton>
        </div>
      </Panel>

      {drinksResult && (
        <Panel>
          <div className="mb-4 space-y-1">
            <h2 className="font-display text-base font-semibold text-foreground">Drinks Co seed result</h2>
            <p className="text-sm text-studio-dim">What was written. Existing rows the seed owns were replaced, not duplicated.</p>
          </div>
          <div className="space-y-3 text-sm">
            <ul className="space-y-1">
              {Object.entries(drinksResult.report).map(([k, v]) => (
                <li key={k}><span className="font-medium">{k}:</span> <span className="text-studio-dim">{v}</span></li>
              ))}
            </ul>
            {drinksResult.warnings.length > 0 && (
              <div className="text-studio-attention">
                <p className="font-medium">Warnings:</p>
                <ul className="list-disc pl-5">{drinksResult.warnings.map((w) => <li key={w}>{w}</li>)}</ul>
              </div>
            )}
            <ol className="list-decimal space-y-1 pl-5 text-studio-dim">
              {drinksResult.nextSteps.map((s) => <li key={s}>{s}</li>)}
            </ol>
          </div>
        </Panel>
      )}

      {result && (
        <Panel>
          <div className="mb-4 space-y-1">
            <h2 className="font-display text-base font-semibold text-foreground">What to try next</h2>
            <p className="text-sm text-studio-dim">
              Inserted {result.xeroTransactionsInserted} new Xero rows. Existing rows were
              left untouched.
            </p>
          </div>
          <ol className="list-decimal space-y-2 pl-5 text-sm text-studio-dim">
            {result.nextSteps.map((s) => <li key={s}>{s}</li>)}
          </ol>
        </Panel>
      )}
    </div>
  )
}
