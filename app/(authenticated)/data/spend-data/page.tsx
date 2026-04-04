'use client'

import { FeatureGate } from '@/components/subscription/FeatureGate'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { SupplierClassificationPanel } from '@/components/xero/SupplierClassificationPanel'
import { ActionCentre } from '@/components/xero/ActionCentre'
import { SupplierMatchingPanel } from '@/components/xero/SupplierMatchingPanel'
import { SupplierEngagementPrompts } from '@/components/xero/SupplierEngagementPrompts'
import { AIClassificationPanel } from '@/components/xero/AIClassificationPanel'
import { SyncHistoryPanel } from '@/components/xero/SyncHistoryPanel'
import { TransactionBrowser } from '@/components/xero/TransactionBrowser'
import { SupplierRulesManager } from '@/components/xero/SupplierRulesManager'
import { DataQualityProgress } from '@/components/xero/DataQualityProgress'

export default function SpendDataPage() {
  return (
    <FeatureGate feature="xero_integration_beta">
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Spend Data
          </h1>
          <p className="text-sm text-muted-foreground mt-2">
            Classify your suppliers into emission categories. Once mapped, all transactions are categorised automatically.
          </p>
        </div>

        <DataQualityProgress />

        <Tabs defaultValue="suppliers" className="space-y-4">
          <TabsList>
            <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
            <TabsTrigger value="action-centre">Action Centre</TabsTrigger>
            <TabsTrigger value="transactions">Transactions</TabsTrigger>
            <TabsTrigger value="rules">Rules</TabsTrigger>
            <TabsTrigger value="sync-history">Sync History</TabsTrigger>
          </TabsList>

          <TabsContent value="suppliers">
            <SupplierClassificationPanel />
          </TabsContent>

          <TabsContent value="action-centre" className="space-y-6">
            <ActionCentre />
            <SupplierMatchingPanel />
            <SupplierEngagementPrompts />
            <div id="ai-classification">
              <AIClassificationPanel />
            </div>
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
