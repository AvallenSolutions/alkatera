'use client'

import { useOnboarding } from '@/lib/onboarding'
import { useOrganization } from '@/lib/organizationContext'
import { Button } from '@/components/ui/button'
import { ArrowLeft, ArrowRight, Building2, MapPin, Factory, Users2, Grape } from 'lucide-react'

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
          <div className="text-3xl">&#127963;&#65039;</div>
          <h3 className="text-xl font-serif font-bold text-white">
            Your Sustainability Hub
          </h3>
          <p className="text-sm text-white/50">
            Here&apos;s a snapshot of your organisation on Alkatera
          </p>
        </div>

        {/* Org details card */}
        <div className="bg-white/5 backdrop-blur-md border border-white/10 rounded-2xl p-6 space-y-4">
          {details.map((detail) => (
            <div key={detail.label} className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-[#ccff00]/10 flex items-center justify-center flex-shrink-0">
                <detail.icon className="w-4 h-4 text-[#ccff00]" />
              </div>
              <div>
                <p className="text-xs text-white/40">{detail.label}</p>
                <p className="text-sm font-medium text-white">{detail.value}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="text-xs text-white/30 text-center">
          Your organisation owner manages the core settings. You can explore the dashboard, view products, and contribute to sustainability tracking.
        </p>

        {/* Navigation */}
        <div className="flex items-center justify-between pt-4">
          <Button variant="ghost" onClick={previousStep} className="text-white/40 hover:text-white hover:bg-white/10">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back
          </Button>
          <Button
            onClick={completeStep}
            className="bg-[#ccff00] text-black hover:bg-[#ccff00]/90 font-medium rounded-xl"
          >
            Continue
            <ArrowRight className="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>
  )
}
