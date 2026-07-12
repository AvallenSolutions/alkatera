'use client'

import { Statement } from '@/components/studio/statement'
import { OrganisationSettings } from '@/components/settings/OrganisationSettings'

/**
 * /company/overview: the organisation's details on their own page.
 * A thin wrapper over the shared OrganisationSettings panels (also the
 * Organisation tab in /settings); the statement replaces the component's
 * internal back-to-settings header.
 */
export default function CompanyOverviewPage() {
  return (
    <div className="space-y-8">
      <Statement eyebrow="THE WORKBENCH · OVERVIEW" headline="The organisation on file." />
      <OrganisationSettings showHeader={false} />
    </div>
  )
}
