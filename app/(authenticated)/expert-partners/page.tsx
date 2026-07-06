'use client'

import Link from 'next/link'
import { Card, CardContent } from '@/components/ui/card'
import { ArrowRight, Sparkles } from 'lucide-react'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'
import { cn } from '@/lib/utils'
import { Statement } from '@/components/studio'

interface PartnerSummary {
  slug: string
  name: string
  category: string
  summary: string
  logoSrc: string
  logoClassName: string
  /** Tailwind classes for the card's hover border accent */
  hoverBorder: string
}

const PARTNERS: PartnerSummary[] = [
  {
    slug: 'impact-focus',
    name: 'Impact Focus',
    category: 'Sustainability consultancy',
    summary:
      'Specialist sustainability consultancy with deep roots in the food and drink industry, from B Corp certification and carbon reduction planning to credible ESG communications.',
    logoSrc: '/images/partners/impact-focus/logo.png',
    logoClassName: 'bg-white p-2 dark:bg-white/90',
    hoverBorder: 'hover:border-studio-ochre-ink',
  },
  {
    slug: 'lucent-energy',
    name: 'Lucent Energy',
    category: 'Solar energy partner',
    summary:
      'Renewable energy specialists helping breweries, wineries and distilleries reduce energy costs and cut their carbon footprint through commercial solar PV, battery storage and EV charging.',
    logoSrc: '/images/partners/lucent-energy/logo.png',
    logoClassName: 'bg-slate-900 object-contain p-1.5',
    hoverBorder: 'hover:border-studio-ochre-ink',
  },
]

export default function ExpertPartnersPage() {
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme } = usePartnerCredits()
  const showImpactFocusCredit =
    isCanopy && !isBetaProgramme && (creditStatus === 'available' || creditStatus === 'pending')

  const highlightFor = (slug: string) => {
    if (slug === 'impact-focus') {
      if (showImpactFocusCredit) {
        return creditStatus === 'available'
          ? `£${creditAmount} consulting credit available`
          : 'Consulting credit building'
      }
      return 'alkatera user discount available'
    }
    if (slug === 'lucent-energy') {
      return 'Free feasibility assessment for alkatera users'
    }
    return null
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-3">
        <Statement eyebrow="THE POST · EXPERTS" headline="The experts." />
        <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-ochre-ink">
          Recommended
        </span>
        <p className="text-sm text-studio-dim max-w-2xl">
          A small, hand-picked network of specialists who work alongside alka<strong>tera</strong> to provide the human
          expertise that goes beyond what a platform can deliver, from sustainability strategy to on-site renewable energy.
        </p>
      </div>

      {/* Partner cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {PARTNERS.map((partner) => {
          const highlight = highlightFor(partner.slug)
          return (
            <Link key={partner.slug} href={`/expert-partners/${partner.slug}/`} className="group block">
              <Card
                className={cn(
                  'h-full rounded-[6px] border border-border transition-colors duration-200',
                  partner.hoverBorder,
                )}
              >
                <CardContent className="p-6 flex flex-col gap-4 h-full">
                  <div className="flex items-start gap-4">
                    <img
                      src={partner.logoSrc}
                      alt={partner.name}
                      className={cn('h-14 w-14 shrink-0 rounded-md object-contain', partner.logoClassName)}
                    />
                    <div className="space-y-1.5 min-w-0">
                      <h2 className="text-lg font-semibold text-foreground">{partner.name}</h2>
                      <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">{partner.category}</p>
                    </div>
                  </div>

                  <p className="text-sm text-muted-foreground leading-relaxed flex-1">{partner.summary}</p>

                  {highlight && (
                    <p className="flex items-center gap-1.5 text-xs font-medium text-studio-ochre-ink">
                      <Sparkles className="h-3.5 w-3.5 shrink-0" />
                      {highlight}
                    </p>
                  )}

                  <span className="inline-flex items-center gap-1 text-sm font-medium text-foreground">
                    View {partner.name}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
                  </span>
                </CardContent>
              </Card>
            </Link>
          )
        })}
      </div>
    </div>
  )
}
