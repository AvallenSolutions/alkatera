'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { ArrowLeft, ArrowRight, Building2, MapPin, Factory, Users2, Grape } from 'lucide-react'
import { Eyebrow, PillButton } from '@/components/studio'

const PRODUCT_TYPE_LABELS: Record<string, string> = {
  beer: 'Beer',
  spirits: 'Spirits',
  wine: 'Wine',
  cider: 'Cider',
  non_alcoholic: 'Non-Alcoholic Beverages',
  rtd: 'Ready-to-Drink',
  other: 'Other',
}

export function MemberOrgOverview() {
  const { completeStep, previousStep } = useOnboarding()
  const { currentOrganization } = useOrganization()

  const orgName = currentOrganization?.name || 'Your Organisation'
  const productType = currentOrganization?.product_type
  const companySize = currentOrganization?.company_size
  const city = currentOrganization?.city
  const country = currentOrganization?.country
  const industrySector = currentOrganization?.industry_sector

  const location = [city, country].filter(Boolean).join(', ')
  const productLabel = productType ? (PRODUCT_TYPE_LABELS[productType] || productType) : null

  const details = [
    { icon: Building2, label: 'Organisation', value: orgName },
    ...(productLabel ? [{ icon: Grape, label: 'Product Type', value: productLabel }] : []),
    ...(industrySector ? [{ icon: Factory, label: 'Industry', value: industrySector }] : []),
    ...(companySize ? [{ icon: Users2, label: 'Company Size', value: `${companySize} employees` }] : []),
    ...(location ? [{ icon: MapPin, label: 'Location', value: location }] : []),
  ]

  return (
    <div className="flex flex-col items-center min-h-[60vh] px-4 animate-in fade-in duration-300">
      <div className="w-full max-w-md space-y-6">
        <div className="text-center space-y-2">
          <Eyebrow tone="dim" className="justify-center flex">Your organisation</Eyebrow>
          <h3 className="text-xl font-display font-bold tracking-tight text-foreground">
            Your sustainability hub.
          </h3>
          <p className="text-sm text-muted-foreground">
            Here&apos;s a snapshot of your organisation on alkatera
          </p>
        </div>

        {/* Org details card */}
        <div className="bg-studio-cream border border-studio-hairline rounded-[6px] p-6 space-y-4">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-[6px] bg-secondary flex items-center justify-center flex-shrink-0">
                <detail.icon className="w-4 h-4 text-studio-forest" />
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">{detail.label}</p>
                <p className="text-sm font-medium text-foreground">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-studio-dim text-center">
          Your organisation owner manages the core settings. You can explore the dashboard, view products, and contribute to sustainability tracking.
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <PillButton variant="ghost" size="md" onClick={previousStep}>
            <ArrowLeft className="w-4 h-4" />
            Back
          </PillButton>
          <PillButton variant="ink" size="md" onClick={completeStep}>
            Continue
            <ArrowRight className="w-4 h-4" />
          </PillButton>
        </div>
      </div>
    </div>
  )
}
