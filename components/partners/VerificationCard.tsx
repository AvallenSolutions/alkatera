'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { FileCheck, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'

interface VerificationCardProps {
  variant: 'lca' | 'report'
}

export function VerificationCard({ variant }: VerificationCardProps) {
  const { tierName } = useSubscription()
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme } = usePartnerCredits()
  const showCredit = isCanopy && !isBetaProgramme && (creditStatus === 'available' || creditStatus === 'pending')

  const heading = variant === 'lca'
    ? 'Get your LCA independently verified'
    : 'Get your report independently verified'

  const description = variant === 'lca'
    ? 'Independent verification from a specialist adds credibility to your LCA data, strengthening your position with buyers, investors, and certification bodies.'
    : 'Third-party verification adds weight to your sustainability claims, giving stakeholders confidence in the data behind your reports.'

  return (
    <Card className="border-emerald-200/50 dark:border-emerald-800/30 bg-gradient-to-r from-emerald-50/50 to-white dark:from-emerald-950/10 dark:to-slate-900">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
            <FileCheck className="h-5 w-5 text-emerald-600" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{heading}</h3>
              {showCredit && (
                <Badge variant="neon-lime" className="text-xs">
                  {creditStatus === 'available' ? `£${creditAmount} credit` : 'Credit pending'}
                </Badge>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link href="/expert-partners/">
                  Learn more
                  <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
              {!showCredit && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  alka<strong>tera</strong> user discount available
                </span>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
