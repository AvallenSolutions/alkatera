'use client'

import { FeatureGate } from '@/components/subscription/FeatureGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { ActionCentre } from '@/components/xero/ActionCentre'
import { SupplierMatchingPanel } from '@/components/xero/SupplierMatchingPanel'
import { SupplierEngagementPrompts } from '@/components/xero/SupplierEngagementPrompts'
import { AIClassificationPanel } from '@/components/xero/AIClassificationPanel'
import { SyncHistoryPanel } from '@/components/xero/SyncHistoryPanel'
import { TransactionBrowser } from '@/components/xero/TransactionBrowser'
import { SupplierRulesManager } from '@/components/xero/SupplierRulesManager'
import { DataQualityProgress } from '@/components/xero/DataQualityProgress'

export default function XeroUpgradesPage() {
  return (
    <FeatureGate feature="xero_integration_beta">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Data Quality Upgrades
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Upgrade your spend-based estimates with actual consumption data for more accurate emissions calculations.
          </p>
        </div>

        <DataQualityProgress />

        <Tabs defaultValue="action-centre" className="space-y-4">
          <TabsList>
            <TabsTrigger value="action-centre">Action Centre</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="rules">Classification Rules</TabsTrigger>
            <TabsTrigger value="sync-history">Sync History</TabsTrigger>
          </TabsList>

          <TabsContent value="action-centre" className="space-y-6">
            <ActionCentre />
            <SupplierMatchingPanel />
            <SupplierEngagementPrompts />
            <AIClassificationPanel />
          </TabsContent>

          <TabsContent value="transactions">
            <TransactionBrowser />
          </TabsContent>

          <TabsContent value="rules">
            <SupplierRulesManager />
          </TabsContent>

          <TabsContent value="sync-history">
            <SyncHistoryPanel />
          </TabsContent>
        </Tabs>
      </div>
    </FeatureGate>
  )
}
