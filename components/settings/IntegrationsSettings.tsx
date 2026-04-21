'use client'

import { IntegrationsDirectory } from './IntegrationsDirectory'

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
            Connect the tools you already use so alka<strong>tera</strong> picks up data automatically — no re-typing.
          </p>
        </div>
      )}
      <IntegrationsDirectory />
    </div>
  )
}
