'use client'

import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { StateChip } from '@/components/studio/state-chip'
import { FileCheck, FileText, ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useSubscription } from '@/hooks/useSubscription'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'

interface VerificationCardProps {
  variant: 'lca' | 'report' | 'report-creation'
}

const VARIANT_CONFIG = {
  lca: {
    icon: FileCheck,
    heading: 'Get your LCA independently verified',
    description: 'Independent verification from a specialist adds credibility to your LCA data, strengthening your position with buyers, investors, and certification bodies.',
  },
  report: {
    icon: FileCheck,
    heading: 'Get your report independently verified',
    description: 'Third-party verification adds weight to your sustainability claims, giving stakeholders confidence in the data behind your reports.',
  },
  'report-creation': {
    icon: FileText,
    heading: 'Take your impact reporting further with Impact Focus',
    description: 'alkatera creates the data foundations for professional, accurate sustainability reporting. Impact Focus can build on top of that, turning your metrics into rich impact narratives, designed reports, and stakeholder communications.',
  },
}

export function VerificationCard({ variant }: VerificationCardProps) {
  const { tierName } = useSubscription()
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme } = usePartnerCredits()
  const showCredit = isCanopy && !isBetaProgramme && (creditStatus === 'available' || creditStatus === 'pending')

  const { icon: Icon, heading, description } = VARIANT_CONFIG[variant]

  return (
    <Card className="rounded-[6px] border-border bg-card">
      <CardContent className="pt-6">
        <div className="flex items-start gap-4">
          <div className="h-10 w-10 rounded-[6px] bg-secondary flex items-center justify-center shrink-0">
            <Icon className="h-5 w-5 text-studio-brick" />
          </div>
          <div className="flex-1 space-y-2">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-sm">{heading}</h3>
              {showCredit && (
                <StateChip tone="good">
                  {creditStatus === 'available' ? `£${creditAmount} credit` : 'Credit pending'}
                </StateChip>
              )}
            </div>
            <p className="text-sm text-muted-foreground">{description}</p>
            <div className="flex items-center gap-3 pt-1">
              <Button variant="outline" size="sm" asChild>
                <Link href="/expert-partners/impact-focus/">
                  Learn about this service
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
