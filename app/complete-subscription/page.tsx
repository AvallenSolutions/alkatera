'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Check, Leaf, Flower2, TreeDeciduous, Sparkles, ArrowRight, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'
import { TierName } from '@/hooks/useSubscription'

type BillingInterval = 'monthly' | 'annual'

interface Tier {
  tier_name: TierName
  display_name: string
  description: string
  monthly_price_gbp: number
  annual_price_gbp: number
  max_products: number | null
  max_lcas: number | null
  max_team_members: number | null
  max_facilities: number | null
  max_suppliers: number | null
  max_reports_per_month: number | null
  features_enabled: string[]
  tier_level: number
}

const defaultTiers: Tier[] = [
  {
    tier_name: 'seed',
    display_name: 'Seed',
    description: 'Perfect for startups and small businesses beginning their sustainability journey',
    monthly_price_gbp: 99,
    annual_price_gbp: 990,
    max_products: 5,
    max_lcas: 5,
    max_team_members: 1,
    max_facilities: 1,
    max_suppliers: 5,
    max_reports_per_month: 10,
    features_enabled: ['ghg_emissions', 'live_passport', 'automated_verification'],
    tier_level: 1,
  },
  {
    tier_name: 'blossom',
    display_name: 'Blossom',
    description: 'For growing businesses ready to expand their environmental impact tracking',
    monthly_price_gbp: 249,
    annual_price_gbp: 2490,
    max_products: 20,
    max_lcas: 20,
    max_team_members: 5,
    max_facilities: 3,
    max_suppliers: 25,
    max_reports_per_month: 50,
    features_enabled: ['recipe_2016', 'ef31', 'ghg_emissions', 'water_footprint', 'waste_circularity', 'monthly_analytics'],
    tier_level: 2,
  },
  {
    tier_name: 'canopy',
    display_name: 'Canopy',
    description: 'Comprehensive sustainability management for established organisations',
    monthly_price_gbp: 599,
    annual_price_gbp: 5990,
    max_products: 50,
    max_lcas: 50,
    max_team_members: 10,
    max_facilities: 8,
    max_suppliers: 100,
    max_reports_per_month: 200,
    features_enabled: ['recipe_2016', 'ef31', 'ef31_single_score', 'ghg_emissions', 'water_footprint', 'waste_circularity', 'nature_biodiversity', 'supply_chain_tracking', 'api_access', 'dedicated_support'],
    tier_level: 3,
  },
]

export default function CompleteSubscriptionPage() {
  const router = useRouter()
  const { currentOrganization } = useOrganization()
  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [processingTier, setProcessingTier] = useState<string | null>(null)

  useEffect(() => {
    // Show welcome toast on mount
    toast.success('Organisation created successfully!', {
      description: 'Now choose a plan to get started with Alkatera.',
    })
  }, [])

  async function handleSelectPlan(tierName: string) {
    if (!currentOrganization) {
      toast.error('No organisation found. Please try again.')
      router.push('/create-organization')
      return
    }

    if (tierName === 'canopy') {
      router.push('/contact?tier=Canopy')
      return
    }

    setProcessingCheckout(true)
    setProcessingTier(tierName)

    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierName,
          billingInterval,
          organizationId: currentOrganization.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create checkout session')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error: any) {
      console.error('Error creating checkout session:', error)
      toast.error(error.message || 'Failed to start checkout')
    } finally {
      setProcessingCheckout(false)
      setProcessingTier(null)
    }
  }

  const tierIcons: Record<TierName, React.ComponentType<{ className?: string }>> = {
    seed: Leaf,
    blossom: Flower2,
    canopy: TreeDeciduous,
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white dark:from-slate-950 dark:to-slate-900">
      <div className="container mx-auto px-4 py-12 max-w-6xl">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-neon-lime/20 mb-6">
            <Sparkles className="h-8 w-8 text-neon-lime" />
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100 mb-4">
            Welcome to Alkatera!
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            Your organisation <strong className="text-slate-900 dark:text-slate-100">{currentOrganization?.name}</strong> has been created.
            Choose a plan below to start your sustainability journey.
          </p>
        </div>

        {/* Billing Toggle */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center gap-2 rounded-lg border bg-white dark:bg-slate-900 p-1 shadow-sm">
            <Button
              size="sm"
              variant={billingInterval === 'monthly' ? 'default' : 'ghost'}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </Button>
            <Button
              size="sm"
              variant={billingInterval === 'annual' ? 'default' : 'ghost'}
              onClick={() => setBillingInterval('annual')}
              className="gap-1"
            >
              Annual
              <Badge variant="secondary" className="ml-1 text-xs bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300">
                Save 17%
              </Badge>
            </Button>
          </div>
        </div>

        {/* Founding Partner Badge */}
        <div className="flex justify-center mb-8">
          <Badge variant="outline" className="border-neon-lime/50 bg-neon-lime/10 text-neon-lime px-4 py-2 text-sm">
            🌱 Founding Partner Pricing — Lock in these rates for life
          </Badge>
        </div>

        {/* Plans Grid */}
        <div className="grid gap-6 md:grid-cols-3 mb-12">
          {defaultTiers.map((tier) => {
            const Icon = tierIcons[tier.tier_name]
            const monthlyPrice = tier.monthly_price_gbp
            const annualPrice = tier.annual_price_gbp
            const displayPrice = billingInterval === 'monthly' ? monthlyPrice : Math.round(annualPrice / 12)
            const annualSavings = monthlyPrice * 12 - annualPrice
            const isProcessing = processingTier === tier.tier_name

            return (
              <Card
                key={tier.tier_name}
                className={cn(
                  "relative transition-all hover:shadow-lg flex flex-col",
                  tier.tier_name === 'blossom' && "border-pink-200 dark:border-pink-900 shadow-md"
                )}
              >
                {tier.tier_name === 'blossom' && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                    <span className="rounded-full bg-pink-500 px-4 py-1 text-xs font-medium text-white">
                      Most Popular
                    </span>
                  </div>
                )}

                <CardHeader className="pt-8">
                  <div className="flex items-center gap-2 mb-2">
                    <Icon className={cn(
                      "h-6 w-6",
                      tier.tier_name === 'seed' && "text-emerald-500",
                      tier.tier_name === 'blossom' && "text-pink-500",
                      tier.tier_name === 'canopy' && "text-teal-500"
                    )} />
                    <CardTitle>{tier.display_name}</CardTitle>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-4xl font-bold">£{displayPrice}</span>
                    <span className="text-muted-foreground">/month</span>
                  </div>
                  {billingInterval === 'annual' && annualSavings > 0 && (
                    <p className="text-sm text-green-600 dark:text-green-400">
                      £{annualPrice} billed annually (save £{annualSavings})
                    </p>
                  )}
                  <CardDescription className="mt-2">
                    {tier.description}
                  </CardDescription>
                </CardHeader>

                <CardContent className="flex-1 flex flex-col">
                  <div className="space-y-4 mb-6 flex-1">
                    <div>
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                        What&apos;s included
                      </p>
                      <ul className="space-y-2">
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_products} Products</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_lcas} LCAs</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_team_members} Team {tier.max_team_members === 1 ? 'Member' : 'Members'}</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_facilities} {tier.max_facilities === 1 ? 'Facility' : 'Facilities'}</span>
                        </li>
                        <li className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                          <span>{tier.max_reports_per_month} Reports/month</span>
                        </li>
                      </ul>
                    </div>

                    {tier.features_enabled && tier.features_enabled.length > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                          Key Features
                        </p>
                        <ul className="space-y-1">
                          {tier.features_enabled.slice(0, 4).map((feature) => (
                            <li key={feature} className="flex items-center gap-2 text-xs text-muted-foreground">
                              <Check className="h-3 w-3 text-neon-lime flex-shrink-0" />
                              <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                            </li>
                          ))}
                          {tier.features_enabled.length > 4 && (
                            <li className="text-xs text-muted-foreground ml-5">
                              +{tier.features_enabled.length - 4} more
                            </li>
                          )}
                        </ul>
                      </div>
                    )}
                  </div>

                  {tier.tier_name === 'canopy' ? (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => handleSelectPlan(tier.tier_name)}
                    >
                      Contact Sales
                      <ArrowRight className="ml-2 h-4 w-4" />
                    </Button>
                  ) : (
                    <Button
                      variant={tier.tier_name === 'blossom' ? 'default' : 'outline'}
                      className={cn(
                        "w-full",
                        tier.tier_name === 'blossom' && "bg-pink-500 hover:bg-pink-600"
                      )}
                      onClick={() => handleSelectPlan(tier.tier_name)}
                      disabled={processingCheckout}
                    >
                      {isProcessing ? (
                        'Processing...'
                      ) : (
                        <>
                          Get Started
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            )
          })}
        </div>

        {/* Footer Note */}
        <div className="text-center text-sm text-muted-foreground">
          <p>All plans include a 14-day money-back guarantee. Cancel anytime.</p>
          <p className="mt-2">
            Questions? <a href="/contact" className="text-neon-lime hover:underline">Contact our team</a>
          </p>
        </div>
      </div>
    </div>
  )
}
