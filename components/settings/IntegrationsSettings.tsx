'use client'

import { XeroConnectionCard } from './XeroConnectionCard'
import { XeroSetupStepper } from './XeroSetupStepper'
import { XeroAccountMapping } from './XeroAccountMapping'

interface IntegrationsSettingsProps {
  showHeader?: boolean
}

export function IntegrationsSettings({ showHeader = true }: IntegrationsSettingsProps) {
  return (
    <div className="space-y-6">
      {showHeader && (
        <div>
          <h2 className="text-2xl font-bold tracking-tight">Integrations</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Connect external services to automatically import data for sustainability calculations.
          </p>
        </div>
      )}

      <XeroConnectionCard />
      <XeroSetupStepper />
      <XeroAccountMapping />

      {/* Placeholder for future integrations */}
      <div className="text-sm text-muted-foreground pt-2">
        More integrations coming soon: QuickBooks, Sage
      </div>
    </div>
  )
}
