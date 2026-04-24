'use client'

import Link from 'next/link'
import { FeatureGate } from '@/components/subscription/FeatureGate'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { SupplierClassificationPanel } from '@/components/xero/SupplierClassificationPanel'
import { ActionCentre } from '@/components/xero/ActionCentre'
import { SupplierEngagementPrompts } from '@/components/xero/SupplierEngagementPrompts'
import { AIClassificationPanel } from '@/components/xero/AIClassificationPanel'
import { SyncHistoryPanel } from '@/components/xero/SyncHistoryPanel'
import { TransactionBrowser } from '@/components/xero/TransactionBrowser'
import { SupplierRulesManager } from '@/components/xero/SupplierRulesManager'
import { DataQualityProgress } from '@/components/xero/DataQualityProgress'
import { useSpendInboxState } from '@/hooks/useSpendInboxState'
import { CheckCircle2, Circle, Loader2, Plug, Tag, ArrowUpCircle, Settings2 } from 'lucide-react'

interface StepHeaderProps {
  index: number
  title: string
  description: string
  count?: number
  countLabel?: string
  complete?: boolean
}

function StepHeader({ index, title, description, count, countLabel, complete }: StepHeaderProps) {
  return (
    <div className="flex items-start gap-3">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
        complete
          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-300'
      }`}>
        {complete ? <CheckCircle2 className="h-5 w-5" /> : <span className="text-sm font-semibold">{index}</span>}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <h2 className="text-lg font-semibold">{title}</h2>
          {typeof count === 'number' && countLabel && (
            <Badge variant="outline" className="font-normal">
              {count} {countLabel}
            </Badge>
          )}
          {complete && (
            <Badge variant="outline" className="border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 font-normal">
              Complete
            </Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">{description}</p>
      </div>
    </div>
  )
}

export default function SpendDataPage() {
  const state = useSpendInboxState()

  return (
    <FeatureGate feature="xero_integration_beta">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Spend Data
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Turn your Xero transactions into activity-based emissions data, step by step.
          </p>
        </div>

        <DataQualityProgress />

        {/* Progress breadcrumb */}
        <Card>
          <CardContent className="py-4">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <StepPill icon={Plug} label="Connect" done={state.connected} active={!state.connected} />
              <Separator />
              <StepPill icon={Tag} label="Classify" done={state.unclassifiedCount === 0 && state.connected} active={state.connected && state.unclassifiedCount > 0} count={state.unclassifiedCount} />
              <Separator />
              <StepPill icon={ArrowUpCircle} label="Upgrade" done={state.pendingUpgradeCount === 0 && state.upgradedCount > 0} active={state.pendingUpgradeCount > 0} count={state.pendingUpgradeCount} />
            </div>
          </CardContent>
        </Card>

        {/* Step 1 — Connect */}
        {!state.loading && !state.connected && (
          <section className="space-y-3">
            <StepHeader
              index={1}
              title="Connect Xero"
              description="Link your Xero account to start syncing transactions."
            />
            <Card>
              <CardContent className="py-6 flex items-center justify-between gap-4">
                <p className="text-sm text-muted-foreground">
                  You haven&apos;t connected a Xero organisation yet.
                </p>
                <Button asChild>
                  <Link href="/settings/integrations">
                    <Plug className="h-4 w-4 mr-2" />
                    Go to Integrations
                  </Link>
                </Button>
              </CardContent>
            </Card>
          </section>
        )}

        {/* Step 2 — Classify suppliers */}
        {state.connected && (
          <section className="space-y-3">
            <StepHeader
              index={2}
              title="Classify suppliers"
              description="Assign each supplier to an emission category. We learn from each choice and reclassify matching transactions."
              count={state.unclassifiedCount}
              countLabel="unclassified"
              complete={!state.loading && state.unclassifiedCount === 0}
            />
            <SupplierClassificationPanel onClassified={state.refetch} />
          </section>
        )}

        {/* Step 3 — Upgrade transactions */}
        {state.connected && (
          <section className="space-y-3">
            <StepHeader
              index={3}
              title="Upgrade transactions"
              description="Replace spend-based estimates with activity data (kWh, litres, nights) for Tier 1 and 2 accuracy."
              count={state.pendingUpgradeCount}
              countLabel="to upgrade"
              complete={!state.loading && state.pendingUpgradeCount === 0 && state.upgradedCount > 0}
            />
            <ActionCentre />
            <SupplierEngagementPrompts />
            <div id="ai-classification">
              <AIClassificationPanel />
            </div>
          </section>
        )}

        {/* Advanced / Monitor */}
        {state.connected && (
          <Accordion type="single" collapsible className="border rounded-lg">
            <AccordionItem value="advanced" className="border-0">
              <AccordionTrigger className="px-4">
                <div className="flex items-center gap-2">
                  <Settings2 className="h-4 w-4" />
                  <span className="font-semibold">Advanced</span>
                  <span className="text-xs text-muted-foreground font-normal">
                    Transactions browser, rules, sync history
                  </span>
                </div>
              </AccordionTrigger>
              <AccordionContent className="px-4 pb-4 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold mb-2">Transactions</h3>
                  <TransactionBrowser />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Supplier rules</h3>
                  <SupplierRulesManager />
                </div>
                <div>
                  <h3 className="text-sm font-semibold mb-2">Sync history</h3>
                  <SyncHistoryPanel />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
        )}

        {state.loading && !state.connected && (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </FeatureGate>
  )
}

function Separator() {
  return <div className="flex-1 h-px bg-slate-200 dark:bg-slate-800 min-w-4" />
}

interface StepPillProps {
  icon: typeof Plug
  label: string
  done: boolean
  active: boolean
  count?: number
}

function StepPill({ icon: Icon, label, done, active, count }: StepPillProps) {
  const color = done
    ? 'text-emerald-600 dark:text-emerald-400'
    : active
    ? 'text-slate-900 dark:text-slate-100'
    : 'text-muted-foreground'
  return (
    <div className={`flex items-center gap-2 ${color}`}>
      {done ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
      <span className="text-sm font-medium">{label}</span>
      {typeof count === 'number' && count > 0 && !done && (
        <Badge variant="outline" className="text-xs font-normal">{count}</Badge>
      )}
      {!done && !active && !count && <Circle className="h-1.5 w-1.5 fill-current opacity-40" />}
    </div>
  )
}

