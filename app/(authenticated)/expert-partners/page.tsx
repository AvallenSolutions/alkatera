'use client'

import type { ReactNode } from 'react'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'
import { Statement } from '@/components/studio/statement'
import { Panel } from '@/components/studio/panel'
import { FactList } from '@/components/studio/fact-list'

interface PartnerSummary {
  slug: string
  name: string
  category: string
  summary: string
  logoSrc: string
  logoClassName: string
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
  },
  {
    slug: 'lucent-energy',
    name: 'Lucent Energy',
    category: 'Solar energy partner',
    summary:
      'Renewable energy specialists helping breweries, wineries and distilleries reduce energy costs and cut their carbon footprint through commercial solar PV, battery storage and EV charging.',
    logoSrc: '/images/partners/lucent-energy/logo.png',
    logoClassName: 'bg-studio-ink object-contain p-1.5',
  },
]

export default function ExpertPartnersPage() {
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme } = usePartnerCredits()
  const showImpactFocusCredit =
    isCanopy && !isBetaProgramme && (creditStatus === 'available' || creditStatus === 'pending')

  const highlightFor = (slug: string): ReactNode => {
    if (slug === 'impact-focus') {
      if (showImpactFocusCredit) {
        return creditStatus === 'available'
          ? `£${creditAmount} consulting credit available`
          : 'Consulting credit building'
      }
      return (
        <>
          alka<strong>tera</strong> user discount available
        </>
      )
    }
    if (slug === 'lucent-energy') {
      return (
        <>
          Free feasibility assessment for alka<strong>tera</strong> users
        </>
      )
    }
    return null
  }

  return (
    <div className="mx-auto max-w-4xl space-y-10">
      <div className="space-y-4">
        <Statement eyebrow="THE NETWORK · EXPERTS" headline="The experts." />
        <p className="max-w-2xl text-sm leading-relaxed text-studio-dim">
          A small, hand-picked network of specialists who work alongside alka<strong>tera</strong> to
          provide the human expertise that goes beyond what a platform can deliver, from
          sustainability strategy to on-site renewable energy.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {PARTNERS.map((partner) => {
          const highlight = highlightFor(partner.slug)
          return (
            <Panel key={partner.slug} className="flex flex-col gap-4">
              <div className="flex items-start gap-4">
                <img
                  src={partner.logoSrc}
                  alt={partner.name}
                  className={`h-14 w-14 shrink-0 rounded-md object-contain ${partner.logoClassName}`}
                />
                <div className="min-w-0 space-y-1.5">
                  <h2 className="font-display text-lg font-semibold text-foreground">
                    {partner.name}
                  </h2>
                  <p className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim">
                    {partner.category}
                  </p>
                </div>
              </div>

              <p className="flex-1 text-sm leading-relaxed text-muted-foreground">
                {partner.summary}
              </p>

              {highlight ? (
                <p className="text-xs font-medium text-room-accent">{highlight}</p>
              ) : null}

              <FactList
                items={[
                  {
                    id: partner.slug,
                    title: `View ${partner.name}`,
                    href: `/expert-partners/${partner.slug}/`,
                  },
                ]}
              />
            </Panel>
          )
        })}
      </div>
    </div>
  )
}
