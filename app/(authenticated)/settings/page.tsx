'use client'

import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { User, Users, Building2, Truck, Plus, CreditCard, Check, Sparkles, Leaf, Flower2, TreeDeciduous, Infinity, AlertCircle, FileText, Calendar, DollarSign, MessageSquare, History, Loader2 } from 'lucide-react'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Badge } from '@/components/ui/badge'
import { Separator } from '@/components/ui/separator'
import Link from 'next/link'
import { useSubscription, TierName } from '@/hooks/useSubscription'
import { TierBadge } from '@/components/subscription/TierBadge'
import { UsageMeter } from '@/components/subscription/UsageMeter'
import { GracePeriodBanner } from '@/components/subscription/GracePeriodBanner'
import { DowngradeConfirmationModal } from '@/components/subscription/DowngradeConfirmationModal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { supabase } from '@/lib/supabaseClient'
import { useOrganization } from '@/lib/organizationContext'

type BillingInterval = 'monthly' | 'annual'

interface PaymentMethod {
  id: string;
  brand: string;
  last4: string;
  expMonth: number;
  expYear: number;
  type: string;
}

interface SubscriptionHistoryEntry {
  id: string;
  eventType: string;
  previousTier: string | null;
  newTier: string | null;
  amountCharged: number | null;
  amountCredited: number | null;
  currency: string;
  createdAt: string;
  eventTypeLabel: string;
}

export default function SettingsPage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { currentOrganization } = useOrganization()
  const {
    usage,
    tierName,
    tierDisplayName,
    subscriptionStatus,
    allTiers,
    isLoading,
  } = useSubscription()

  const [billingInterval, setBillingInterval] = useState<BillingInterval>('monthly')
  const [processingCheckout, setProcessingCheckout] = useState(false)
  const [organizationData, setOrganizationData] = useState<any>(null)
  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(false)
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false)
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false)
  const [selectedDowngradeTier, setSelectedDowngradeTier] = useState<string | null>(null)

  useEffect(() => {
    if (searchParams.get('success') === 'true') {
      toast.success('Subscription activated successfully!')
      router.replace('/settings')
    }
    if (searchParams.get('canceled') === 'true') {
      toast.info('Checkout cancelled')
      router.replace('/settings')
    }
  }, [searchParams, router])

  useEffect(() => {
    if (currentOrganization) {
      fetchOrganizationData()
      fetchPaymentMethod()
      fetchSubscriptionHistory()
    }
  }, [currentOrganization])

  async function fetchOrganizationData() {
    if (!currentOrganization) return

    try {
      const { data: org, error } = await supabase
        .from('organizations')
        .select('*')
        .eq('id', currentOrganization.id)
        .single()

      if (error) throw error
      setOrganizationData(org)
    } catch (error) {
      console.error('Error fetching organization data:', error)
    }
  }

  async function fetchPaymentMethod() {
    if (!currentOrganization) return

    setLoadingPaymentMethod(true)
    try {
      const response = await fetch(`/api/stripe/payment-method?organizationId=${currentOrganization.id}`)
      if (response.ok) {
        const data = await response.json()
        setPaymentMethod(data.paymentMethod)
      }
    } catch (error) {
      console.error('Error fetching payment method:', error)
    } finally {
      setLoadingPaymentMethod(false)
    }
  }

  async function fetchSubscriptionHistory() {
    if (!currentOrganization) return

    setLoadingHistory(true)
    try {
      const response = await fetch(`/api/stripe/subscription-history?organizationId=${currentOrganization.id}&limit=10`)
      if (response.ok) {
        const data = await response.json()
        setSubscriptionHistory(data.history || [])
      }
    } catch (error) {
      console.error('Error fetching subscription history:', error)
    } finally {
      setLoadingHistory(false)
    }
  }

  async function handleUpgrade(tierName: string) {
    if (!currentOrganization) {
      toast.error('No organization selected')
      return
    }

    setProcessingCheckout(true)

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
    }
  }

  async function handleManageSubscription() {
    if (!organizationData?.stripe_customer_id) {
      toast.error('No active subscription to manage')
      return
    }

    setUpdatingPaymentMethod(true)
    try {
      const response = await fetch('/api/stripe/create-portal-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          organizationId: currentOrganization?.id,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to open billing portal')
      }

      if (data.url) {
        window.location.href = data.url
      }
    } catch (error: any) {
      console.error('Error opening portal:', error)
      toast.error(error.message || 'Failed to open billing portal')
    } finally {
      setUpdatingPaymentMethod(false)
    }
  }

  function handleDowngrade(tierName: string) {
    setSelectedDowngradeTier(tierName)
    setDowngradeModalOpen(true)
  }

  async function handleConfirmDowngrade() {
    if (!selectedDowngradeTier || !currentOrganization) return

    setProcessingCheckout(true)
    try {
      const response = await fetch('/api/stripe/create-checkout-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tierName: selectedDowngradeTier,
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
      setDowngradeModalOpen(false)
    }
  }

  function getCardBrandIcon(brand: string) {
    const brandLower = brand.toLowerCase()
    if (brandLower === 'visa') return '💳 Visa'
    if (brandLower === 'mastercard') return '💳 Mastercard'
    if (brandLower === 'amex') return '💳 Amex'
    return `💳 ${brand.charAt(0).toUpperCase() + brand.slice(1)}`
  }

  function getPriceIdForTier(tierName: string) {
    const tier = allTiers.find(t => t.tier_name === tierName)
    if (!tier) return ''
    const monthlyPrice = tier.monthly_price_gbp || 0
    // This is a simplified version - in production, you'd map to actual Stripe price IDs
    // For now, we'll use the tier name and interval to construct the checkout session
    return `${tierName}_${billingInterval}`
  }

  return (
    <div className="space-y-6">
      {/* Grace Period Banner */}
      {organizationData?.grace_period_end && (
        <GracePeriodBanner
          gracePeriodEnd={organizationData.grace_period_end}
          resourceType={organizationData.grace_period_resource_type || 'items'}
          currentUsage={usage?.usage?.[organizationData.grace_period_resource_type as keyof typeof usage.usage]?.current || 0}
          limit={usage?.usage?.[organizationData.grace_period_resource_type as keyof typeof usage.usage]?.max || 0}
        />
      )}

      {/* Downgrade Confirmation Modal */}
      {selectedDowngradeTier && currentOrganization && (
        <DowngradeConfirmationModal
          isOpen={downgradeModalOpen}
          onClose={() => {
            setDowngradeModalOpen(false)
            setSelectedDowngradeTier(null)
          }}
          onConfirm={handleConfirmDowngrade}
          currentTier={tierName}
          newTier={selectedDowngradeTier}
          currentTierDisplayName={tierDisplayName}
          newTierDisplayName={allTiers.find(t => t.tier_name === selectedDowngradeTier)?.display_name || selectedDowngradeTier}
          organizationId={currentOrganization.id}
          priceId={getPriceIdForTier(selectedDowngradeTier)}
          isProcessing={processingCheckout}
        />
      )}

      <div>
        <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
          Settings
        </h1>
        <p className="text-sm text-muted-foreground mt-2">
          Manage your account, team, and organisation settings
        </p>
      </div>

      <Tabs defaultValue="subscription" className="space-y-4">
        <TabsList>
          <TabsTrigger value="subscription">Subscription</TabsTrigger>
          <TabsTrigger value="billing">Billing</TabsTrigger>
          <TabsTrigger value="profile">Profile</TabsTrigger>
          <TabsTrigger value="team">Team</TabsTrigger>
          <TabsTrigger value="suppliers">Suppliers</TabsTrigger>
          <TabsTrigger value="organisation">Organisation</TabsTrigger>
          <TabsTrigger value="support">Support</TabsTrigger>
        </TabsList>

        <TabsContent value="subscription" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Sparkles className="h-5 w-5" />
                  Current Plan
                </CardTitle>
                <CardDescription>
                  Your subscription details and status
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading ? (
                  <div className="animate-pulse space-y-3">
                    <div className="h-8 w-32 bg-muted rounded" />
                    <div className="h-4 w-48 bg-muted rounded" />
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-3">
                      <TierBadge tier={tierName} size="lg" />
                      <span className={cn(
                        "text-xs px-2 py-1 rounded-full",
                        subscriptionStatus === 'active' && "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300",
                        subscriptionStatus === 'trial' && "bg-blue-100 text-blue-700 dark:bg-blue-900 dark:text-blue-300",
                        subscriptionStatus === 'suspended' && "bg-amber-100 text-amber-700 dark:bg-amber-900 dark:text-amber-300",
                        subscriptionStatus === 'cancelled' && "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                      )}>
                        {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                      </span>
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {allTiers.find(t => t.tier_name === tierName)?.description || 'Manage your sustainability tracking'}
                    </p>
                  </>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Usage This Month</CardTitle>
                <CardDescription>
                  Track your resource consumption against plan limits
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {isLoading || !usage ? (
                  <div className="animate-pulse space-y-4">
                    {[1, 2, 3].map(i => (
                      <div key={i} className="space-y-2">
                        <div className="h-4 w-24 bg-muted rounded" />
                        <div className="h-2 w-full bg-muted rounded" />
                      </div>
                    ))}
                  </div>
                ) : (
                  <>
                    <UsageMeter
                      label="Products"
                      current={usage.usage.products.current}
                      max={usage.usage.products.max}
                      isUnlimited={usage.usage.products.is_unlimited}
                    />
                    <UsageMeter
                      label="Facilities"
                      current={usage.usage.facilities.current}
                      max={usage.usage.facilities.max}
                      isUnlimited={usage.usage.facilities.is_unlimited}
                    />
                    <UsageMeter
                      label="Users"
                      current={usage.usage.team_members.current}
                      max={usage.usage.team_members.max}
                      isUnlimited={usage.usage.team_members.is_unlimited}
                    />
                    <UsageMeter
                      label="Reports (Monthly)"
                      current={usage.usage.reports_monthly.current}
                      max={usage.usage.reports_monthly.max}
                      isUnlimited={usage.usage.reports_monthly.is_unlimited}
                    />
                  </>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Available Plans</CardTitle>
                  <CardDescription>
                    Choose the plan that fits your organisation
                  </CardDescription>
                </div>
                <div className="flex items-center gap-2 rounded-lg border p-1">
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
                    <Badge variant="secondary" className="ml-1 text-xs">Save 17%</Badge>
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid gap-6 md:grid-cols-3">
                {allTiers.map((tier) => {
                  const isCurrent = tier.tier_name === tierName
                  const currentTierLevel = allTiers.find(t => t.tier_name === tierName)?.tier_level || 1
                  const isUpgrade = tier.tier_level > currentTierLevel
                  const isDowngrade = tier.tier_level < currentTierLevel

                  const tierIcons: Record<TierName, React.ComponentType<{ className?: string }>> = {
                    seed: Leaf,
                    blossom: Flower2,
                    canopy: TreeDeciduous,
                  }
                  const Icon = tierIcons[tier.tier_name]

                  const monthlyPrice = tier.monthly_price_gbp || 0
                  const annualPrice = monthlyPrice * 10
                  const displayPrice = billingInterval === 'monthly' ? monthlyPrice : Math.round(annualPrice / 12)
                  const annualSavings = monthlyPrice * 12 - annualPrice

                  return (
                    <div
                      key={tier.tier_name}
                      className={cn(
                        "relative rounded-lg border p-6 transition-all hover:shadow-md flex flex-col",
                        isCurrent && "border-neon-lime bg-neon-lime/5",
                        tier.tier_name === 'blossom' && !isCurrent && "border-pink-200 dark:border-pink-900"
                      )}
                    >
                      {isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="rounded-full bg-neon-lime px-3 py-1 text-xs font-medium text-black">
                            Current Plan
                          </span>
                        </div>
                      )}
                      {tier.tier_name === 'blossom' && !isCurrent && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <span className="rounded-full bg-pink-500 px-3 py-1 text-xs font-medium text-white">
                            Popular
                          </span>
                        </div>
                      )}

                      <div className="mb-4 flex items-center gap-2 pt-2">
                        <Icon className={cn(
                          "h-5 w-5",
                          tier.tier_name === 'seed' && "text-emerald-500",
                          tier.tier_name === 'blossom' && "text-pink-500",
                          tier.tier_name === 'canopy' && "text-teal-500"
                        )} />
                        <span className="font-semibold">{tier.display_name}</span>
                      </div>

                      {monthlyPrice > 0 ? (
                        <div className="mb-4">
                          <div className="flex items-baseline gap-1">
                            <span className="text-3xl font-bold">£{displayPrice}</span>
                            <span className="text-sm text-muted-foreground">/month</span>
                          </div>
                          {billingInterval === 'annual' && annualSavings > 0 && (
                            <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                              £{annualPrice} billed annually (save £{annualSavings})
                            </p>
                          )}
                        </div>
                      ) : (
                        <div className="mb-4 h-[52px] flex items-center">
                          <span className="text-xl font-semibold text-muted-foreground">Contact Us</span>
                        </div>
                      )}

                      <p className="text-sm text-muted-foreground mb-4 min-h-[40px]">
                        {tier.description}
                      </p>

                      <div className="space-y-4 mb-6 flex-1">
                        <div>
                          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                            Plan Limits
                          </p>
                          <ul className="space-y-2">
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                              <span>
                                {tier.max_products ? `${tier.max_products} Products` : 'Unlimited Products'}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                              <span>
                                {tier.max_lcas ? `${tier.max_lcas} LCAs` : 'Unlimited LCAs'}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                              <span>
                                {tier.max_team_members ? `${tier.max_team_members} Team Members` : 'Unlimited Team Members'}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                              <span>
                                {tier.max_facilities ? `${tier.max_facilities} Facilities` : 'Unlimited Facilities'}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                              <span>
                                {tier.max_suppliers ? `${tier.max_suppliers} Suppliers` : 'Unlimited Suppliers'}
                              </span>
                            </li>
                            <li className="flex items-center gap-2 text-sm">
                              <Check className="h-4 w-4 text-neon-lime flex-shrink-0" />
                              <span>
                                {tier.max_reports_per_month ? `${tier.max_reports_per_month} Reports/month` : 'Unlimited Reports'}
                              </span>
                            </li>
                          </ul>
                        </div>

                        {tier.features_enabled && tier.features_enabled.length > 0 && (
                          <div>
                            <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                              Features Included
                            </p>
                            <ul className="space-y-1">
                              {tier.features_enabled.slice(0, 6).map((feature) => (
                                <li key={feature} className="flex items-center gap-2 text-xs">
                                  <Check className="h-3 w-3 text-neon-lime flex-shrink-0" />
                                  <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                                </li>
                              ))}
                              {tier.features_enabled.length > 6 && (
                                <li className="text-xs text-muted-foreground ml-5">
                                  +{tier.features_enabled.length - 6} more features
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>

                      {isCurrent ? (
                        <Button variant="outline" className="w-full mt-auto" disabled>
                          Current Plan
                        </Button>
                      ) : (
                        <Button
                          variant={isUpgrade ? 'default' : 'outline'}
                          className="w-full mt-auto"
                          onClick={() => isDowngrade ? handleDowngrade(tier.tier_name) : handleUpgrade(tier.tier_name)}
                          disabled={processingCheckout}
                        >
                          {processingCheckout ? 'Processing...' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                        </Button>
                      )}
                    </div>
                  )
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="billing" className="space-y-4">
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <CreditCard className="h-5 w-5" />
                  Payment Method
                </CardTitle>
                <CardDescription>
                  Manage your payment details and billing information
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {loadingPaymentMethod ? (
                  <div className="flex items-center justify-center py-6">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : paymentMethod ? (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="h-10 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">{getCardBrandIcon(paymentMethod.brand)}</p>
                        <p className="text-sm text-muted-foreground">
                          •••• •••• •••• {paymentMethod.last4}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          Expires {paymentMethod.expMonth?.toString().padStart(2, '0')}/{paymentMethod.expYear}
                        </p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManageSubscription}
                      disabled={updatingPaymentMethod}
                    >
                      {updatingPaymentMethod ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening Portal...
                        </>
                      ) : (
                        'Update Payment Method'
                      )}
                    </Button>
                  </>
                ) : organizationData?.stripe_customer_id ? (
                  <>
                    <div className="flex items-center gap-3 p-3 rounded-lg border">
                      <div className="h-10 w-16 bg-gradient-to-r from-blue-500 to-purple-600 rounded flex items-center justify-center">
                        <CreditCard className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-medium">Payment method on file</p>
                        <p className="text-xs text-muted-foreground">Managed via Stripe</p>
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={handleManageSubscription}
                      disabled={updatingPaymentMethod}
                    >
                      {updatingPaymentMethod ? (
                        <>
                          <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                          Opening Portal...
                        </>
                      ) : (
                        'Update Payment Method'
                      )}
                    </Button>
                  </>
                ) : (
                  <div className="text-center py-6">
                    <CreditCard className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground mb-4">
                      No payment method on file
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Add a payment method by upgrading your plan
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Calendar className="h-5 w-5" />
                  Next Billing Date
                </CardTitle>
                <CardDescription>
                  When your next payment is due
                </CardDescription>
              </CardHeader>
              <CardContent>
                {organizationData?.subscription_started_at && subscriptionStatus === 'active' ? (
                  <div className="space-y-3">
                    <div className="flex items-baseline gap-2">
                      <span className="text-2xl font-bold">
                        {new Date(
                          new Date(organizationData.subscription_started_at).setMonth(
                            new Date(organizationData.subscription_started_at).getMonth() + 1
                          )
                        ).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric'
                        })}
                      </span>
                    </div>
                    <Separator />
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Estimated amount</span>
                      <span className="font-medium">
                        £{allTiers.find(t => t.tier_name === tierName)?.monthly_price_gbp || 0}/month
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-6">
                    <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                    <p className="text-sm text-muted-foreground">
                      No active subscription
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Billing Details
              </CardTitle>
              <CardDescription>
                Organisation information for invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Organisation Name</label>
                    <p className="text-sm mt-1">{currentOrganization?.name || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Billing Email</label>
                    <p className="text-sm mt-1">{organizationData?.billing_email || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Tax/VAT ID</label>
                    <p className="text-sm mt-1">{organizationData?.tax_id || 'Not set'}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">Country</label>
                    <p className="text-sm mt-1">{organizationData?.country || 'Not set'}</p>
                  </div>
                </div>
                <Separator />
                <Button variant="outline" asChild>
                  <Link href="/company/overview">Update Billing Details</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-5 w-5" />
                Invoice History
              </CardTitle>
              <CardDescription>
                View and download your past invoices
              </CardDescription>
            </CardHeader>
            <CardContent>
              {invoices.length > 0 ? (
                <div className="space-y-2">
                  {invoices.map((invoice: any) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <FileText className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="text-sm font-medium">
                            {new Date(invoice.created).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'long',
                              year: 'numeric'
                            })}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Invoice #{invoice.number}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant={invoice.status === 'paid' ? 'default' : 'secondary'}>
                          {invoice.status}
                        </Badge>
                        <span className="text-sm font-medium">
                          £{(invoice.amount_paid / 100).toFixed(2)}
                        </span>
                        <Button size="sm" variant="ghost" asChild>
                          <a href={invoice.invoice_pdf} target="_blank" rel="noopener noreferrer">
                            Download
                          </a>
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No invoices yet</p>
                  <p className="text-xs text-muted-foreground">
                    Invoices will appear here after your first payment
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Subscription History
              </CardTitle>
              <CardDescription>
                Track all changes to your subscription
              </CardDescription>
            </CardHeader>
            <CardContent>
              {loadingHistory ? (
                <div className="flex items-center justify-center py-8">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : subscriptionHistory.length > 0 ? (
                <div className="space-y-2">
                  {subscriptionHistory.map((entry) => (
                    <div
                      key={entry.id}
                      className="flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn(
                          "h-2 w-2 rounded-full",
                          entry.eventType === 'upgrade' && "bg-green-500",
                          entry.eventType === 'downgrade' && "bg-amber-500",
                          entry.eventType === 'payment_failed' && "bg-red-500",
                          entry.eventType === 'payment_succeeded' && "bg-green-500",
                          entry.eventType === 'grace_period_started' && "bg-amber-500",
                          entry.eventType === 'grace_period_auto_deletion' && "bg-red-500",
                          !['upgrade', 'downgrade', 'payment_failed', 'payment_succeeded', 'grace_period_started', 'grace_period_auto_deletion'].includes(entry.eventType) && "bg-blue-500"
                        )} />
                        <div>
                          <p className="text-sm font-medium">{entry.eventTypeLabel}</p>
                          {(entry.previousTier || entry.newTier) && (
                            <p className="text-xs text-muted-foreground">
                              {entry.previousTier && entry.newTier ? (
                                <>
                                  {entry.previousTier.charAt(0).toUpperCase() + entry.previousTier.slice(1)} → {entry.newTier.charAt(0).toUpperCase() + entry.newTier.slice(1)}
                                </>
                              ) : entry.newTier ? (
                                `New plan: ${entry.newTier.charAt(0).toUpperCase() + entry.newTier.slice(1)}`
                              ) : null}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        {entry.amountCharged && entry.amountCharged > 0 && (
                          <span className="text-sm font-medium">
                            £{entry.amountCharged.toFixed(2)}
                          </span>
                        )}
                        {entry.amountCredited && entry.amountCredited > 0 && (
                          <span className="text-sm font-medium text-green-600">
                            +£{entry.amountCredited.toFixed(2)}
                          </span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {new Date(entry.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric'
                          })}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <History className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm font-medium mb-1">No subscription changes yet</p>
                  <p className="text-xs text-muted-foreground">
                    Your subscription activity will appear here
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="profile" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <User className="h-5 w-5" />
                Profile Settings
              </CardTitle>
              <CardDescription>
                Manage your personal account information and preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/settings/profile">Edit Profile</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="team" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                Team Management
              </CardTitle>
              <CardDescription>
                Invite members, manage roles and permissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/dashboard/settings/team">Manage Team</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="suppliers" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5" />
                Supplier Management
              </CardTitle>
              <CardDescription>
                Add and manage your suppliers for supply chain tracking
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <Truck className="h-12 w-12 text-slate-300 dark:text-slate-700 mb-4" />
                <h3 className="text-lg font-semibold mb-2">No Suppliers Added</h3>
                <p className="text-sm text-muted-foreground mb-4">
                  Start tracking your supply chain by adding your suppliers
                </p>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Add Supplier
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="organisation" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5" />
                Organisation Details
              </CardTitle>
              <CardDescription>
                View and update your organisation information
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Button asChild>
                <Link href="/company/overview">View Organisation</Link>
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="support" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Feedback & Support
              </CardTitle>
              <CardDescription>
                Report bugs, suggest features, and view your support tickets
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Have a bug to report or a feature suggestion? We&apos;d love to hear from you.
                Your feedback helps us improve the platform.
              </p>
              <div className="flex gap-3">
                <Button asChild>
                  <Link href="/settings/feedback">View My Tickets</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}
