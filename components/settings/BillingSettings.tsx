'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Eyebrow, Panel, PillButton, StateChip } from '@/components/studio'
import { useSubscription } from '@/hooks/useSubscription'
import { cn } from '@/lib/utils'
import { toast } from 'sonner'
import { useOrganization } from '@/lib/organizationContext'

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

interface BillingSettingsProps {
  organizationData: any
}

const BUSY_TEXT = (
  <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
    Loading
  </span>
)

function getCardBrandLabel(brand: string) {
  return brand.toUpperCase()
}

export function BillingSettings({ organizationData }: BillingSettingsProps) {
  const { currentOrganization } = useOrganization()
  const { tierName, subscriptionStatus, allTiers } = useSubscription()

  const [invoices, setInvoices] = useState<any[]>([])
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>(null)
  const [loadingPaymentMethod, setLoadingPaymentMethod] = useState(false)
  const [updatingPaymentMethod, setUpdatingPaymentMethod] = useState(false)
  const [subscriptionHistory, setSubscriptionHistory] = useState<SubscriptionHistoryEntry[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const fetchPaymentMethod = useCallback(async () => {
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
  }, [currentOrganization])

  const fetchSubscriptionHistory = useCallback(async () => {
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
  }, [currentOrganization])

  const fetchInvoices = useCallback(async () => {
    if (!currentOrganization) return

    try {
      const response = await fetch(`/api/stripe/invoices?organizationId=${currentOrganization.id}`)
      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices || [])
      }
    } catch (error) {
      console.error('Error fetching invoices:', error)
    }
  }, [currentOrganization])

  useEffect(() => {
    if (currentOrganization) {
      fetchPaymentMethod()
      fetchSubscriptionHistory()
      fetchInvoices()
    }
  }, [currentOrganization, fetchPaymentMethod, fetchSubscriptionHistory, fetchInvoices])

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

  return (
    <div className="space-y-6">
      <div className="grid gap-6 md:grid-cols-2">
        <Panel className="space-y-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">Payment method</Eyebrow>
            <p className="text-sm text-studio-dim">
              Manage your payment details and billing information
            </p>
          </div>
          {loadingPaymentMethod ? (
            <div className="flex items-center justify-center py-6">{BUSY_TEXT}</div>
          ) : paymentMethod ? (
            <>
              <div className="flex items-center gap-3 rounded-[6px] border border-studio-hairline bg-studio-paper p-3">
                <div className="flex h-10 w-16 items-center justify-center rounded-[6px] border border-studio-hairline bg-studio-cream">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-foreground">
                    {getCardBrandLabel(paymentMethod.brand)}
                  </span>
                </div>
                <div className="flex-1">
                  <p className="font-mono text-xs font-bold uppercase tracking-[0.14em]">
                    {getCardBrandLabel(paymentMethod.brand)}
                  </p>
                  <p className="text-sm text-studio-dim">
                    •••• •••• •••• {paymentMethod.last4}
                  </p>
                  <p className="text-xs text-studio-dim">
                    Expires {paymentMethod.expMonth?.toString().padStart(2, '0')}/{paymentMethod.expYear}
                  </p>
                </div>
              </div>
              <PillButton
                variant="outline"
                className="w-full"
                onClick={handleManageSubscription}
                disabled={updatingPaymentMethod}
              >
                {updatingPaymentMethod ? 'Opening Portal...' : 'Update Payment Method'}
              </PillButton>
            </>
          ) : organizationData?.stripe_customer_id ? (
            <>
              <div className="flex items-center gap-3 rounded-[6px] border border-studio-hairline bg-studio-paper p-3">
                <div className="flex h-10 w-16 items-center justify-center rounded-[6px] border border-studio-hairline bg-studio-cream">
                  <span className="font-mono text-[9px] font-bold uppercase tracking-[0.12em] text-foreground">
                    CARD
                  </span>
                </div>
                <div className="flex-1">
                  <p className="text-sm font-medium">Payment method on file</p>
                  <p className="text-xs text-studio-dim">Managed via Stripe</p>
                </div>
              </div>
              <PillButton
                variant="outline"
                className="w-full"
                onClick={handleManageSubscription}
                disabled={updatingPaymentMethod}
              >
                {updatingPaymentMethod ? 'Opening Portal...' : 'Update Payment Method'}
              </PillButton>
            </>
          ) : (
            <div className="py-6 text-center">
              <p className="mb-2 text-sm font-medium">No payment method on file</p>
              <p className="text-xs text-studio-dim">
                Add a payment method by upgrading your plan
              </p>
            </div>
          )}
        </Panel>

        <Panel className="space-y-4">
          <div className="space-y-1">
            <Eyebrow tone="dim">Next billing date</Eyebrow>
            <p className="text-sm text-studio-dim">
              When your next payment is due
            </p>
          </div>
          {subscriptionStatus === 'active' && (organizationData?.current_period_end || organizationData?.subscription_started_at) ? (
            <div className="space-y-3">
              <div className="flex items-baseline gap-2">
                <span className="font-display text-2xl font-bold tracking-[-0.02em]">
                  {organizationData.current_period_end
                    ? new Date(organizationData.current_period_end).toLocaleDateString('en-GB', {
                        day: 'numeric',
                        month: 'long',
                        year: 'numeric'
                      })
                    : 'Syncing with Stripe...'}
                </span>
              </div>
              <div className="border-t border-studio-hairline" />
              <div className="flex items-center justify-between text-sm">
                <span className="text-studio-dim">Estimated amount</span>
                <span className="font-medium">
                  £{allTiers.find(t => t.tier_name === tierName)?.monthly_price_gbp || 0}/month
                </span>
              </div>
            </div>
          ) : (
            <div className="py-6 text-center">
              <p className="text-sm text-studio-dim">
                No active subscription
              </p>
            </div>
          )}
        </Panel>
      </div>

      <Panel className="space-y-4">
        <div className="space-y-1">
          <Eyebrow tone="dim">Billing details</Eyebrow>
          <p className="text-sm text-studio-dim">
            Organisation information for invoices
          </p>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-studio-dim">Organisation Name</label>
            <p className="text-sm mt-1">{organizationData?.billing_name || currentOrganization?.name || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-studio-dim">Billing Email</label>
            <p className="text-sm mt-1">{organizationData?.billing_email || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-studio-dim">Tax/VAT ID</label>
            <p className="text-sm mt-1">{organizationData?.tax_id || 'Not set'}</p>
          </div>
          <div>
            <label className="text-sm font-medium text-studio-dim">Country</label>
            <p className="text-sm mt-1">{organizationData?.billing_address_country || organizationData?.country || 'Not set'}</p>
          </div>
          {organizationData?.billing_address_line1 && (
            <div className="md:col-span-2">
              <label className="text-sm font-medium text-studio-dim">Billing Address</label>
              <p className="text-sm mt-1">
                {[
                  organizationData.billing_address_line1,
                  organizationData.billing_address_city,
                  organizationData.billing_address_postal_code,
                ].filter(Boolean).join(', ')}
              </p>
            </div>
          )}
        </div>
        <div className="border-t border-studio-hairline" />
        <p className="text-xs text-studio-dim">
          Changes made in Organisation settings are automatically synced to your Stripe billing account.
        </p>
        <PillButton variant="outline" href="/company/overview">
          Update Billing Details
        </PillButton>
      </Panel>

      <Panel className="space-y-4">
        <div className="space-y-1">
          <Eyebrow tone="dim">Invoice history</Eyebrow>
          <p className="text-sm text-studio-dim">
            View and download your past invoices
          </p>
        </div>
        {invoices.length > 0 ? (
          <div className="space-y-2">
            {invoices.map((invoice: any) => (
              <div
                key={invoice.id}
                className="flex items-center justify-between rounded-[6px] border border-studio-hairline bg-studio-paper p-3 transition-colors hover:bg-studio-ink/5"
              >
                <div>
                  <p className="text-sm font-medium">
                    {new Date(invoice.created).toLocaleDateString('en-GB', {
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric'
                    })}
                  </p>
                  <p className="text-xs text-studio-dim">
                    Invoice #{invoice.number}
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <StateChip tone={invoice.status === 'paid' ? 'good' : 'attention'}>
                    {invoice.status}
                  </StateChip>
                  <span className="text-sm font-medium">
                    £{(invoice.amount_paid / 100).toFixed(2)}
                  </span>
                  <a
                    href={invoice.invoice_pdf}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground"
                  >
                    Download
                  </a>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="py-8 text-center">
            <p className="mb-1 text-sm font-medium">No invoices yet</p>
            <p className="text-xs text-studio-dim">
              Invoices will appear here after your first payment
            </p>
          </div>
        )}
      </Panel>

      <Panel className="space-y-4">
        <div className="space-y-1">
          <Eyebrow tone="dim">Subscription history</Eyebrow>
          <p className="text-sm text-studio-dim">
            Track all changes to your subscription
          </p>
        </div>
        {loadingHistory ? (
          <div className="flex items-center justify-center py-8">{BUSY_TEXT}</div>
        ) : subscriptionHistory.length > 0 ? (
          <div className="space-y-2">
            {subscriptionHistory.map((entry) => (
              <div
                key={entry.id}
                className="flex items-center justify-between rounded-[6px] border border-studio-hairline bg-studio-paper p-3 transition-colors hover:bg-studio-ink/5"
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    entry.eventType === 'upgrade' && "bg-studio-good",
                    entry.eventType === 'downgrade' && "bg-studio-attention",
                    entry.eventType === 'payment_failed' && "bg-studio-stale",
                    entry.eventType === 'payment_succeeded' && "bg-studio-good",
                    entry.eventType === 'grace_period_started' && "bg-studio-attention",
                    entry.eventType === 'grace_period_auto_deletion' && "bg-studio-stale",
                    !['upgrade', 'downgrade', 'payment_failed', 'payment_succeeded', 'grace_period_started', 'grace_period_auto_deletion'].includes(entry.eventType) && "bg-studio-dim"
                  )} />
                  <div>
                    <p className="text-sm font-medium">{entry.eventTypeLabel}</p>
                    {(entry.previousTier || entry.newTier) && (
                      <p className="text-xs text-studio-dim">
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
                    <span className="text-sm font-medium text-studio-good">
                      +£{entry.amountCredited.toFixed(2)}
                    </span>
                  )}
                  <span className="text-xs text-studio-dim">
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
          <div className="py-8 text-center">
            <p className="mb-1 text-sm font-medium">No subscription changes yet</p>
            <p className="text-xs text-studio-dim">
              Your subscription activity will appear here
            </p>
          </div>
        )}
      </Panel>
    </div>
  )
}
