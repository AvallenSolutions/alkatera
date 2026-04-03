'use client'

import { useState } from 'react'
import { XeroConnectionCard } from './XeroConnectionCard'
import { XeroSetupStepper } from './XeroSetupStepper'
import { XeroAccountMapping } from './XeroAccountMapping'
import { ChevronDown } from 'lucide-react'

interface IntegrationsSettingsProps {
  showHeader?: boolean
}

export function IntegrationsSettings({ showHeader = true }: IntegrationsSettingsProps) {
  const [showAdvanced, setShowAdvanced] = useState(false)

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

      {/* Advanced: Account-level mapping (demoted in favour of supplier classification) */}
      <div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          <ChevronDown className={`h-3.5 w-3.5 transition-transform ${showAdvanced ? '' : '-rotate-90'}`} />
          Advanced: Account-level mapping
        </button>
        {showAdvanced && (
          <div className="mt-3">
            <XeroAccountMapping />
          </div>
        )}
      </div>

      {/* Placeholder for future integrations */}
      <div className="text-sm text-muted-foreground pt-2">
        More integrations coming soon: QuickBooks, Sage
      </div>
    </div>
  )
}
