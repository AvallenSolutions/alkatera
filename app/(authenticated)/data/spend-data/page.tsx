'use client'

/**
 * The spend (/data/spend-data/), recomposed in the studio grammar.
 *
 * One statement (the transactions awaiting classification standing right),
 * the sync as a quiet mono margin note, one quality meter, then the page
 * IS the queue: the classification panel leads, the AI per-transaction
 * confirm flow folds in beneath it, upgrade opportunities and supplier
 * engagement follow as quiet eyebrow sections, and the audit jobs keep
 * to a mono Advanced fold. The old step pills and numbered circles are
 * gone; all data behaviour is unchanged.
 */

import { useMemo, type ReactNode } from 'react'
import { FeatureGate } from '@/components/subscription/FeatureGate'
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider'
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion'
import { Statement } from '@/components/studio/statement'
import { Eyebrow } from '@/components/studio/eyebrow'
import { BigNumber } from '@/components/studio/big-number'
import { StateChip } from '@/components/studio/state-chip'
import { PillButton } from '@/components/studio/pill-button'
import { SupplierClassificationPanel } from '@/components/xero/SupplierClassificationPanel'
import { ActionCentre } from '@/components/xero/ActionCentre'
import { SupplierEngagementPrompts } from '@/components/xero/SupplierEngagementPrompts'
import { AIClassificationPanel } from '@/components/xero/AIClassificationPanel'
import { SyncHistoryPanel } from '@/components/xero/SyncHistoryPanel'
import { TransactionBrowser } from '@/components/xero/TransactionBrowser'
import { SupplierRulesManager } from '@/components/xero/SupplierRulesManager'
import { SupplierMatchingPanel } from '@/components/xero/SupplierMatchingPanel'
import { DataQualityProgress } from '@/components/xero/DataQualityProgress'
import { SyncDataButton } from '@/components/xero/SyncDataButton'
import { useSpendInboxState } from '@/hooks/useSpendInboxState'

/** A quiet section: mono eyebrow on a hairline, then the work. */
function Section({
  label,
  blurb,
  children,
}: {
  label: string
  blurb: string
  children: ReactNode
}) {
  return (
    <section className="space-y-4">
      <div className="border-b border-studio-hairline pb-2">
        <Eyebrow>{label}</Eyebrow>
        <p className="mt-1 text-xs text-muted-foreground">{blurb}</p>
      </div>
      {children}
    </section>
  )
}

export default function SpendDataPage() {
  const state = useSpendInboxState()

  // Tell Rosa about the spend-data inbox state so questions like
  // "what's the next step?" or "how do I categorise this row?" can
  // reference the actual queue counts and connection status.
  const rosaSlice = useMemo(() => ({
    id: 'spend-data',
    label: 'Spend data importer',
    priority: 8,
    data: {
      page: 'spend-data',
      xero_connected: state.connected,
      unclassified_count: state.unclassifiedCount,
      ai_classification_count: (state as any).aiClassificationCount ?? null,
    },
  }), [state.connected, state.unclassifiedCount, (state as any).aiClassificationCount])
  useRosaPageContext(rosaSlice)

  return (
    <FeatureGate feature="xero_integration_beta">
      <div className="mx-auto max-w-5xl space-y-10">
        <div className="space-y-3">
          <Statement eyebrow="THE WORKBENCH · SPEND" headline="The spend.">
            {state.connected && (
              <div>
                <BigNumber
                  size="display"
                  value={state.loading ? '--' : state.unclassifiedCount.toLocaleString('en-GB')}
                  label="Transactions to classify"
                  tone={!state.loading && state.unclassifiedCount > 0 ? 'attention' : 'ink'}
                />
                <div className="mt-1 h-4">
                  {!state.loading && (
                    <StateChip tone={state.unclassifiedCount > 0 ? 'attention' : 'good'}>
                      {state.unclassifiedCount > 0 ? 'The queue below' : 'All classified'}
                    </StateChip>
                  )}
                </div>
              </div>
            )}
          </Statement>
          {state.connected && (
            <div className="flex justify-end">
              <SyncDataButton onComplete={state.refetch} />
            </div>
          )}
        </div>

        {/* Not connected: one quiet line and the way in. */}
        {!state.loading && !state.connected && (
          <section className="border-t border-studio-hairline pt-6">
            <p className="max-w-xl text-sm text-muted-foreground">
              No accounts connected yet. Link your Xero organisation and every transaction
              becomes an emissions estimate you can refine.
            </p>
            <PillButton variant="outline" size="sm" href="/settings/integrations" className="mt-4">
              Go to Integrations
            </PillButton>
          </section>
        )}

        {state.connected && (
          <>
            {/* The one quality meter. */}
            <DataQualityProgress />

            {/* The page is the queue: classification leads, and the AI
                per-transaction confirm flow folds in beneath it as one
                quiet sub-section (one Suggest with AI story). */}
            <section className="space-y-6">
              <SupplierClassificationPanel onClassified={state.refetch} />
              <div id="ai-classification">
                <AIClassificationPanel />
              </div>
            </section>

            <Section
              label="UPGRADE OPPORTUNITIES"
              blurb="Replace spend-based estimates with activity data (kWh, litres, nights) for Tier 1 and 2 accuracy."
            >
              <ActionCentre />
            </Section>

            <SupplierEngagementPrompts />

            {/* Advanced: the audit jobs, behind a quiet mono fold. */}
            <Accordion type="single" collapsible>
              <AccordionItem value="advanced" className="border-t border-studio-hairline border-b-0">
                <AccordionTrigger className="py-4 hover:no-underline">
                  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
                    ADVANCED · TRANSACTIONS, RULES, RECONCILIATION, SYNC HISTORY
                  </span>
                </AccordionTrigger>
                <AccordionContent className="space-y-8 pb-6">
                  <div>
                    <Eyebrow tone="dim" className="mb-2">TRANSACTIONS</Eyebrow>
                    <TransactionBrowser />
                  </div>
                  <div>
                    <Eyebrow tone="dim" className="mb-2">SUPPLIER RULES</Eyebrow>
                    <SupplierRulesManager />
                  </div>
                  <div>
                    <Eyebrow tone="dim" className="mb-2">RECONCILE XERO SUPPLIERS</Eyebrow>
                    <p className="mb-2 text-xs text-muted-foreground">
                      Match the contacts you pay in Xero to your supplier records, so spend and
                      emissions roll up per supplier.
                    </p>
                    <SupplierMatchingPanel />
                  </div>
                  <div>
                    <Eyebrow tone="dim" className="mb-2">SYNC HISTORY</Eyebrow>
                    <SyncHistoryPanel />
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </>
        )}

        {state.loading && !state.connected && (
          <div className="h-24 animate-pulse rounded-[6px] bg-studio-cream" aria-hidden="true" />
        )}
      </div>
    </FeatureGate>
  )
}
