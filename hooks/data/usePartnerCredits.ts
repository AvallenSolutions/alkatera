'use client'

import { useState, useEffect, useMemo } from 'react'
import { useOrganization } from '@/lib/organizationContext'
import { useSubscription } from '@/hooks/useSubscription'
import { getSupabaseBrowserClient } from '@/lib/supabase/browser-client'

export type CreditStatus = 'pending' | 'available' | 'redeemed' | 'expired' | 'not_eligible'

interface PartnerCredit {
  id: string
  status: 'pending' | 'available' | 'redeemed' | 'expired'
  credit_amount: number
  currency: string
  available_at: string | null
  redeemed_at: string | null
}

interface OrgBillingInfo {
  billing_interval: 'monthly' | 'annual' | null
  subscription_started_at: string | null
  feature_flags: Record<string, any> | null
}

export interface UsePartnerCreditsResult {
  creditStatus: CreditStatus
  creditAmount: number
  currency: string
  monthsSubscribed: number
  isEligible: boolean
  isBetaProgramme: boolean
  isCanopy: boolean
  isLoading: boolean
  credit: PartnerCredit | null
  billingInterval: 'monthly' | 'annual' | null
}

export function usePartnerCredits(): UsePartnerCreditsResult {
  const { currentOrganization } = useOrganization()
  const { tierName, isLoading: subLoading } = useSubscription()
  const [credit, setCredit] = useState<PartnerCredit | null>(null)
  const [billingInfo, setBillingInfo] = useState<OrgBillingInfo | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const isCanopy = tierName === 'canopy'

  useEffect(() => {
    if (!currentOrganization?.id || subLoading) return

    async function fetchData() {
      setIsLoading(true)
      const supabase = getSupabaseBrowserClient()

      // Fetch billing info and partner credits in parallel
      const [billingResult, creditResult] = await Promise.all([
        supabase
          .from('organizations')
          .select('billing_interval, subscription_started_at, feature_flags')
          .eq('id', currentOrganization!.id)
          .single(),
        supabase
          .from('partner_credits')
          .select('id, status, credit_amount, currency, available_at, redeemed_at')
          .eq('organization_id', currentOrganization!.id)
          .eq('partner_name', 'impact_focus')
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      if (billingResult.data) {
        setBillingInfo(billingResult.data as OrgBillingInfo)
      }
      if (creditResult.data) {
        setCredit(creditResult.data as PartnerCredit)
      } else {
        setCredit(null)
      }

      setIsLoading(false)
    }

    fetchData()
  }, [currentOrganization?.id, subLoading])

  const isBetaProgramme = useMemo(() => {
    return billingInfo?.feature_flags?.beta_programme === true
  }, [billingInfo])

  const monthsSubscribed = useMemo(() => {
    if (!billingInfo?.subscription_started_at) return 0
    const start = new Date(billingInfo.subscription_started_at)
    const now = new Date()
    const months = (now.getFullYear() - start.getFullYear()) * 12
      + (now.getMonth() - start.getMonth())
    return Math.max(0, months)
  }, [billingInfo])

  const isEligible = useMemo(() => {
    if (!isCanopy || isBetaProgramme) return false
    if (billingInfo?.billing_interval === 'annual') return true
    return monthsSubscribed >= 6
  }, [isCanopy, isBetaProgramme, billingInfo, monthsSubscribed])

  const creditStatus: CreditStatus = useMemo(() => {
    if (!isCanopy || isBetaProgramme) return 'not_eligible'
    if (credit) return credit.status
    if (isEligible) return 'available'
    return 'pending'
  }, [isCanopy, isBetaProgramme, credit, isEligible])

  return {
    creditStatus,
    creditAmount: credit?.credit_amount ?? 600,
    currency: credit?.currency ?? 'GBP',
    monthsSubscribed,
    isEligible,
    isBetaProgramme,
    isCanopy,
    isLoading: isLoading || subLoading,
    credit,
    billingInterval: billingInfo?.billing_interval ?? null,
  }
}
