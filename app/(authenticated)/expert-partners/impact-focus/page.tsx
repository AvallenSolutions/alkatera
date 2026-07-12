'use client'

import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'
import { PartnerProfile } from '@/components/partners/PartnerProfile'
import { impactFocusProfile } from '@/lib/partners/profiles'

export default function ImpactFocusPartnerPage() {
  const { creditStatus, creditAmount, monthsSubscribed, isCanopy, isBetaProgramme } =
    usePartnerCredits()

  return (
    <PartnerProfile
      config={impactFocusProfile}
      credit={{
        creditAmount,
        monthsSubscribed,
        status: creditStatus,
        eligibleForLadder: isCanopy && !isBetaProgramme,
      }}
    />
  )
}
