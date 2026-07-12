'use client'

import { useState } from 'react'
import { Check, Leaf, Flower2, TreeDeciduous } from 'lucide-react'
import { Eyebrow, Panel, PillButton, StateChip } from '@/components/studio'
import { useSubscription, TierName } from '@/hooks/useSubscription'
import { TierBadge } from '@/components/subscription/TierBadge'
import { UsageMeter } from '@/components/subscription/UsageMeter'
import { DowngradeConfirmationModal } from '@/components/subscription/DowngradeConfirmationModal'
import { CancelSubscriptionModal } from '@/components/subscription/CancelSubscriptionModal'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'

type BillingInterval = 'monthly' | 'annual'

interface SubscriptionSettingsProps {
  organizationData: any
  /** Called after a cancellation so the page can refresh org-level data. */
  onSubscriptionChanged: () => void
}

const BUSY_TEXT = (
  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
    Loading
  </span>
)

export function SubscriptionSettings({ organizationData, onSubscriptionChanged }: SubscriptionSettingsProps) {
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
  const [downgradeModalOpen, setDowngradeModalOpen] = useState(false)
  const [selectedDowngradeTier, setSelectedDowngradeTier] = useState<string | null>(null)
  const [cancelModalOpen, setCancelModalOpen] = useState(false)

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

      {/* Cancel Subscription Modal */}
      {currentOrganization && (
        <CancelSubscriptionModal
          isOpen={cancelModalOpen}
          onClose={() => setCancelModalOpen(false)}
          onCancelled={() => {
            setCancelModalOpen(false)
            onSubscriptionChanged()
          }}
          onDowngradeInstead={() => {
            // Find the next lower tier to suggest
            const tierLevels: Record<string, number> = { seed: 1, blossom: 2, canopy: 3 }
            const currentLevel = tierLevels[tierName] || 1
            const lowerTier = currentLevel === 3 ? 'blossom' : currentLevel === 2 ? 'seed' : null
            if (lowerTier) {
              handleDowngrade(lowerTier)
            }
          }}
          organizationId={currentOrganization.id}
          currentTierDisplayName={tierDisplayName}
          canDowngrade={tierName !== 'seed'}
        />
      )}

      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="space-y-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">{subscriptionStatus === 'trial' ? 'Free trial' : 'Current plan'}</Eyebrow>
            <p className="text-sm text-studio-dim">
              {subscriptionStatus === 'trial'
                ? 'Explore the platform, then choose a plan to continue'
                : 'Your subscription details and status'}
            </p>
          </div>
          {isLoading ? (
            <div className="py-4">{BUSY_TEXT}</div>
          ) : subscriptionStatus === 'trial' ? (
            <>
              <StateChip tone="hold">Free Trial</StateChip>
              <p className="text-sm text-studio-dim">
                You&apos;re on a 30-day free trial with full Seed features.
                {organizationData?.subscription_expires_at
                  ? ` Your trial ends on ${new Date(organizationData.subscription_expires_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}.`
                  : ''}
                {' '}Choose a plan below to keep your access when your trial ends. Your card is
                already on file, so it&apos;s a single click.
              </p>
            </>
          ) : (
            <>
              <div className="flex items-center gap-3">
                <TierBadge tier={tierName} size="lg" />
                <StateChip
                  tone={
                    subscriptionStatus === 'active' ? 'good'
                      : subscriptionStatus === 'trial' ? 'hold'
                      : subscriptionStatus === 'suspended' ? 'attention'
                      : subscriptionStatus === 'cancelled' ? 'stale'
                      : 'quiet'
                  }
                >
                  {subscriptionStatus.charAt(0).toUpperCase() + subscriptionStatus.slice(1)}
                </StateChip>
              </div>
              <p className="text-sm text-studio-dim">
                {allTiers.find(t => t.tier_name === tierName)?.description || 'Manage your sustainability tracking'}
              </p>
            </>
          )}
        </Panel>

        <Panel className="space-y-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">Usage this month</Eyebrow>
            <p className="text-sm text-studio-dim">
              Track your resource consumption against plan limits
            </p>
          </div>
          {isLoading || !usage ? (
            <div className="py-4">{BUSY_TEXT}</div>
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
        </Panel>
      </div>

      <Panel className="space-y-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <Eyebrow tone="dim">Available plans</Eyebrow>
              <StateChip tone="quiet">Founding Partner Pricing</StateChip>
            </div>
            <p className="text-sm text-studio-dim">
              Lock in exclusive founding partner rates, honoured for the lifetime of your subscription.
            </p>
          </div>
          <div className="flex items-center gap-1 rounded-full border border-studio-hairline p-1">
            <PillButton
              size="sm"
              variant={billingInterval === 'monthly' ? 'ink' : 'ghost'}
              onClick={() => setBillingInterval('monthly')}
            >
              Monthly
            </PillButton>
            <PillButton
              size="sm"
              variant={billingInterval === 'annual' ? 'ink' : 'ghost'}
              onClick={() => setBillingInterval('annual')}
            >
              Annual
              <span className="font-mono text-[10px] uppercase tracking-[0.18em]">Save 17%</span>
            </PillButton>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-3">
          {allTiers.map((tier) => {
            // On a free trial the org carries tier 'seed' for feature visibility, but
            // isn't actually subscribed to any paid plan, so nothing is the "current"
            // plan and every tier is selectable as a subscription.
            const onTrial = subscriptionStatus === 'trial'
            const isCurrent = !onTrial && tier.tier_name === tierName
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
            const annualPrice = tier.annual_price_gbp || monthlyPrice * 10
            const displayPrice = billingInterval === 'monthly' ? monthlyPrice : Math.round(annualPrice / 12)
            const annualSavings = monthlyPrice * 12 - annualPrice

            return (
              <div
                key={tier.tier_name}
                className={cn(
                  'relative flex flex-col rounded-[6px] border bg-studio-paper p-6 transition-colors',
                  isCurrent ? 'border-studio-ink' : 'border-studio-hairline'
                )}
              >
                <div className="mb-4 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <Icon className="h-5 w-5 text-foreground" />
                    <span className="font-semibold">{tier.display_name}</span>
                  </div>
                  {isCurrent ? (
                    <StateChip tone="good">Current plan</StateChip>
                  ) : tier.tier_name === 'blossom' ? (
                    <StateChip tone="quiet">Popular</StateChip>
                  ) : null}
                </div>

                {monthlyPrice > 0 ? (
                  <div className="mb-4">
                    <div className="flex items-baseline gap-1">
                      <span className="font-display text-3xl font-bold tracking-[-0.02em]">£{displayPrice}</span>
                      <span className="text-sm text-studio-dim">/month</span>
                    </div>
                    {billingInterval === 'annual' && annualSavings > 0 && (
                      <p className="text-xs text-studio-good mt-1">
                        £{annualPrice} billed annually (save £{annualSavings})
                      </p>
                    )}
                  </div>
                ) : (
                  <div className="mb-4 flex h-[52px] items-center">
                    <span className="font-display text-xl font-semibold text-studio-dim">Contact Us</span>
                  </div>
                )}

                <p className="text-sm text-studio-dim mb-4 min-h-[40px]">
                  {tier.description}
                </p>

                <div className="space-y-4 mb-6 flex-1">
                  <div>
                    <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                      Plan Limits
                    </p>
                    <ul className="space-y-2">
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-studio-dim flex-shrink-0" />
                        <span>
                          {tier.max_products ? `${tier.max_products} Products` : 'Unlimited Products'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-studio-dim flex-shrink-0" />
                        <span>
                          {tier.max_lcas ? `${tier.max_lcas} LCAs` : 'Unlimited LCAs'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-studio-dim flex-shrink-0" />
                        <span>
                          {tier.max_team_members ? `${tier.max_team_members} Team Members` : 'Unlimited Team Members'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-studio-dim flex-shrink-0" />
                        <span>
                          {tier.max_facilities ? `${tier.max_facilities} Facilities` : 'Unlimited Facilities'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-studio-dim flex-shrink-0" />
                        <span>
                          {tier.max_suppliers ? `${tier.max_suppliers} Suppliers` : 'Unlimited Suppliers'}
                        </span>
                      </li>
                      <li className="flex items-center gap-2 text-sm">
                        <Check className="h-4 w-4 text-studio-dim flex-shrink-0" />
                        <span>
                          {tier.max_reports_per_month ? `${tier.max_reports_per_month} Reports/month` : 'Unlimited Reports'}
                        </span>
                      </li>
                    </ul>
                  </div>

                  {tier.features_enabled && tier.features_enabled.length > 0 && (
                    <div>
                      <p className="mb-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                        Features Included
                      </p>
                      <ul className="space-y-1">
                        {tier.features_enabled.slice(0, 6).map((feature) => (
                          <li key={feature} className="flex items-center gap-2 text-xs">
                            <Check className="h-3 w-3 text-studio-dim flex-shrink-0" />
                            <span className="capitalize">{feature.replace(/_/g, ' ')}</span>
                          </li>
                        ))}
                        {tier.features_enabled.length > 6 && (
                          <li className="text-xs text-studio-dim ml-5">
                            +{tier.features_enabled.length - 6} more features
                          </li>
                        )}
                      </ul>
                    </div>
                  )}
                </div>

                {isCurrent ? (
                  <PillButton variant="outline" className="mt-auto w-full" disabled>
                    Current Plan
                  </PillButton>
                ) : onTrial ? (
                  <PillButton
                    variant={tier.tier_name === 'blossom' ? 'ink' : 'outline'}
                    className="mt-auto w-full"
                    onClick={() => handleUpgrade(tier.tier_name)}
                    disabled={processingCheckout}
                  >
                    {processingCheckout ? 'Processing...' : `Subscribe to ${tier.display_name}`}
                  </PillButton>
                ) : (
                  <PillButton
                    variant={isUpgrade ? 'ink' : 'outline'}
                    className="mt-auto w-full"
                    onClick={() => isDowngrade ? handleDowngrade(tier.tier_name) : handleUpgrade(tier.tier_name)}
                    disabled={processingCheckout}
                  >
                    {processingCheckout ? 'Processing...' : isUpgrade ? 'Upgrade' : 'Downgrade'}
                  </PillButton>
                )}
              </div>
            )
          })}
        </div>
      </Panel>

      {/* Cancel Subscription */}
      {tierName !== 'seed' && subscriptionStatus === 'active' && (
        <Panel>
          <div className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">Cancel Subscription</p>
              <p className="text-xs text-studio-dim mt-1">
                Cancel your plan and revert to the free Seed tier at the end of your billing period.
              </p>
            </div>
            <PillButton
              variant="ghost"
              className="text-studio-stale hover:text-studio-stale"
              onClick={() => setCancelModalOpen(true)}
            >
              Cancel Plan
            </PillButton>
          </div>
        </Panel>
      )}
    </div>
  )
}
