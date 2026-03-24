'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Handshake, Sparkles, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'

function CreditsSkeleton() {
  return (
    <div className="space-y-3">
      <Skeleton className="h-5 w-32" />
      <Skeleton className="h-4 w-48" />
      <Skeleton className="h-8 w-24" />
    </div>
  )
}

export function CanopyCreditsWidget() {
  const {
    creditStatus,
    creditAmount,
    monthsSubscribed,
    isCanopy,
    isBetaProgramme,
    isLoading,
    billingInterval,
  } = usePartnerCredits()

  // Don't render for non-Canopy, Beta Programme orgs, or ineligible users
  if (!isCanopy || isBetaProgramme) return null
  if (!isLoading && creditStatus === 'not_eligible') return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
              <Handshake className="h-3.5 w-3.5 text-emerald-600" />
            </div>
            Expert Consulting
          </CardTitle>
        </CardHeader>
        <CardContent>
          <CreditsSkeleton />
        </CardContent>
      </Card>
    )
  }

  // Available state
  if (creditStatus === 'available') {
    return (
      <Card className="border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-slate-900">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Expert Consulting
            </CardTitle>
            <Badge variant="neon-lime" className="text-xs">Active</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
            You have £{creditAmount} to use with Impact Focus
          </p>
          <p className="text-xs text-muted-foreground">
            Use your consulting credit for strategy, verification, or B Corp guidance.
          </p>
          <Button variant="outline" size="sm" asChild>
            <Link href="/expert-partners/">Get started</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Redeemed state
  if (creditStatus === 'redeemed') {
    return (
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="h-7 w-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center">
                <CheckCircle className="h-3.5 w-3.5 text-emerald-600" />
              </div>
              Expert Consulting
            </CardTitle>
            <Badge variant="secondary" className="text-xs">Redeemed</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-xs text-muted-foreground">
            Your £{creditAmount} consulting credit has been applied. You still receive a discount on all Impact Focus services.
          </p>
          <Button variant="ghost" size="sm" className="mt-2 px-0" asChild>
            <Link href="/expert-partners/">View Impact Focus</Link>
          </Button>
        </CardContent>
      </Card>
    )
  }

  // Pending state (monthly, <6 months)
  const monthsRemaining = Math.max(0, 6 - monthsSubscribed)
  const progressPercent = Math.min(100, (monthsSubscribed / 6) * 100)

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2 text-base">
            <div className="h-7 w-7 rounded-lg bg-amber-100 dark:bg-amber-900/30 flex items-center justify-center">
              <Handshake className="h-3.5 w-3.5 text-amber-600" />
            </div>
            Expert Consulting
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {billingInterval === 'annual' ? 'Processing' : `${monthsSubscribed} of 6 months`}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground">
          {monthsRemaining > 0
            ? `${monthsRemaining} month${monthsRemaining === 1 ? '' : 's'} until your £${creditAmount} consulting credit unlocks.`
            : `Your £${creditAmount} consulting credit is being activated.`}
        </p>
        {/* Progress bar */}
        <div className="w-full h-1.5 rounded-full bg-slate-100 dark:bg-slate-800">
          <div
            className="h-full rounded-full bg-amber-500 transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <p className="text-xs text-muted-foreground">
          Switch to an annual plan to unlock your credit immediately.
        </p>
      </CardContent>
    </Card>
  )
}
