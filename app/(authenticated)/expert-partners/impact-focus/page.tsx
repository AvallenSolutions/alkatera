'use client'

import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  Mail,
  Leaf,
  Award,
  BarChart3,
  Sparkles,
  Target,
  TrendingDown,
  FileText,
  Scale,
  GraduationCap,
  Megaphone,
  Star,
  Monitor,
  ClipboardList,
  Search,
  ArrowLeft,
} from 'lucide-react'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'
import { cn } from '@/lib/utils'
import { PartnerServices } from '@/components/partners/PartnerServices'
import type { PartnerServiceCategory } from '@/lib/partners/service-styles'

const SERVICE_CATEGORIES: PartnerServiceCategory[] = [
  {
    label: 'Strategy and Planning',
    tagline: 'Building the foundations for long-term sustainability performance',
    accent: 'emerald',
    services: [
      {
        icon: Target,
        title: 'Sustainability Strategy Development and Implementation',
        description: 'For organisations ready to set formal sustainability targets but uncertain where to start. Impact Focus builds practical, commercially grounded strategies that create a clear path from ambition to action.',
      },
      {
        icon: BarChart3,
        title: 'Sustainability Management Strategy',
        description: 'For businesses that have started their sustainability journey but need a coherent framework to manage, measure, and improve performance over time.',
      },
      {
        icon: Leaf,
        title: 'Biodiversity Strategy',
        description: 'For producers and land managers wanting to understand the ecological impact of their operations and build a credible nature recovery or biodiversity net gain plan.',
      },
      {
        icon: TrendingDown,
        title: 'Carbon Reduction Planning and Net Zero Roadmaps',
        description: 'For organisations that have completed their carbon footprint and now need a credible, costed reduction plan with realistic milestones and accountability.',
      },
    ],
  },
  {
    label: 'Reporting and Compliance',
    tagline: 'Meeting the expectations of regulators, investors, and buyers',
    accent: 'blue',
    services: [
      {
        icon: ClipboardList,
        title: 'Materiality Assessments and Stakeholder Engagement',
        description: 'For businesses preparing for investor scrutiny, CSRD obligations, or sustainability reporting who need to identify and prioritise their most significant topics through structured stakeholder dialogue.',
      },
      {
        icon: Search,
        title: 'ESG Due Diligence and Reporting Advisory',
        description: 'For brands seeking investment, preparing for acquisition, or responding to lender requirements who need to demonstrate ESG readiness with confidence.',
      },
      {
        icon: FileText,
        title: 'Sustainability and Impact Report Creation',
        description: 'For businesses ready to publish their first sustainability report but lacking the in-house resource to manage content development, design, and delivery end to end.',
      },
      {
        icon: Scale,
        title: 'Regulatory Compliance Guidance and Reporting Support',
        description: 'For suppliers and brands facing new CSRD, EUDR, modern slavery, or packaging obligations who need help understanding what applies to them and building a structured response.',
      },
    ],
  },
  {
    label: 'Certification and Standards',
    tagline: 'Achieving the credentials that open doors and build trust',
    accent: 'amber',
    services: [
      {
        icon: Award,
        title: 'B Corp Certification Support',
        description: 'For businesses committed to B Corp but struggling to navigate the B Impact Assessment, gap analysis, improvement planning, and submission process.',
      },
      {
        icon: Star,
        title: 'EcoVadis Ratings Preparation and Improvement',
        description: 'For suppliers asked by a major retailer, buyer, or brand owner to achieve or improve an EcoVadis score within a defined timeframe.',
      },
    ],
  },
  {
    label: 'Communications and Capability',
    tagline: 'Telling your story clearly and building the team behind it',
    accent: 'violet',
    services: [
      {
        icon: Megaphone,
        title: 'Sustainability Communications and Storytelling',
        description: 'For brands with a strong sustainability story but no clear way to communicate it without greenwashing risk. Impact Focus helps translate data and commitments into authentic, compelling narratives.',
      },
      {
        icon: GraduationCap,
        title: 'Training and Capacity-Building Programmes',
        description: 'For teams that need to build internal sustainability literacy before they can own their own data collection, reporting, or stakeholder communication.',
      },
      {
        icon: Monitor,
        title: 'Digital Accessibility Audits, Training and Remediation',
        description: 'For organisations that need to meet WCAG standards, respond to an accessibility complaint, or embed accessibility as a standard practice across their digital estate.',
      },
    ],
  },
]

export default function ImpactFocusPartnerPage() {
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme, monthsSubscribed, billingInterval } = usePartnerCredits()
  const isCanopyWithCredit = isCanopy && !isBetaProgramme

  return (
    <div className="space-y-10">
      {/* Back link */}
      <Link
        href="/expert-partners/"
        className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ArrowLeft className="h-4 w-4" />
        All expert partners
      </Link>

      {/* Impact Focus Hero Card */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <img
                src="/images/partners/impact-focus/logo.png"
                alt="Impact Focus"
                className="h-16 w-auto shrink-0 rounded-md bg-white p-2 dark:bg-white/90"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-2xl">Impact Focus</CardTitle>
                  <Badge variant="secondary" className="text-xs">Sustainability consultancy</Badge>
                </div>
                <CardDescription className="text-base max-w-xl">
                  Specialist sustainability consultancy with deep roots in the food and drink industry.
                  Combining genuine strategic expertise with best-in-class sustainability communications.
                </CardDescription>
              </div>
            </div>
            {isCanopyWithCredit && (creditStatus === 'available' || creditStatus === 'pending') && (
              <Badge variant="neon-lime" className="text-sm px-3 py-1 shrink-0">
                {creditStatus === 'available' ? `£${creditAmount} credit available` : 'Credit pending'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              {isCanopyWithCredit && creditStatus === 'available' ? (
                <>You have <strong>£{creditAmount} in consulting credits</strong> to use with Impact Focus. Contact them to redeem.</>
              ) : isCanopyWithCredit && creditStatus === 'pending' ? (
                <span className="flex items-center gap-3 w-full">
                  <span className="flex-1">
                    Your <strong>£{creditAmount} consulting credit</strong> is building.{' '}
                    <span className="text-emerald-700 dark:text-emerald-300">{monthsSubscribed} of 6 months complete.</span>
                  </span>
                  <span className="flex gap-1 shrink-0">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <span
                        key={i}
                        className={cn(
                          'h-2 w-4 rounded-full',
                          i < monthsSubscribed
                            ? 'bg-emerald-500'
                            : 'bg-emerald-200 dark:bg-emerald-900'
                        )}
                      />
                    ))}
                  </span>
                </span>
              ) : isCanopyWithCredit && creditStatus === 'redeemed' ? (
                <>Your consulting credit has been redeemed. You still receive a discount on all Impact Focus services as an alka<strong>tera</strong> user.</>
              ) : (
                <>All alka<strong>tera</strong> users receive a <strong>discount on Impact Focus services</strong>. Mention your alka<strong>tera</strong> subscription when you get in touch.</>
              )}
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-emerald-600 hover:bg-emerald-700">
              <a href="https://www.impactfocus.co.uk" target="_blank" rel="noopener noreferrer">
                Visit Impact Focus
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href="mailto:hello@impactfocus.co?subject=Enquiry%20from%20alkatera%20user&body=Hi%20Impact%20Focus%2C%0A%0AI%27m%20an%20alkatera%20user%20and%20would%20like%20to%20discuss%20your%20consulting%20services.%0A%0AThanks">
                <Mail className="mr-2 h-4 w-4" />
                Send an Enquiry
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Why We Recommend Them */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Why we recommend Impact Focus</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            alka<strong>tera</strong> provides the technical infrastructure for measuring, tracking, and reporting
            on sustainability. But we know that data alone is not enough. Many organisations, particularly
            those earlier in their sustainability journey, need expert human guidance to interpret the
            numbers and turn them into meaningful action.
          </p>
          <p>
            Impact Focus brings over 25 years of specialist experience in the food and drink sector.
            Their team understands the specific challenges of our industry and can help you navigate
            everything from B Corp certification to carbon reduction planning to credible ESG communications.
          </p>
          <p>
            This is not a generic marketplace listing. We have chosen Impact Focus as our exclusive
            consulting partner because we believe in the quality and integrity of their work. When you
            engage Impact Focus, you contract with them directly. alka<strong>tera</strong> does not take a
            margin on consulting work.
          </p>
        </CardContent>
      </Card>

      {/* Service Categories */}
      <PartnerServices heading="What Impact Focus can help with" categories={SERVICE_CATEGORIES} />

      {/* Canopy Credit Progress */}
      {isCanopyWithCredit && creditStatus === 'pending' && billingInterval === 'monthly' && (
        <Card className="border-amber-200 dark:border-amber-800/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Your Consulting Credit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            <p className="text-sm text-muted-foreground">
              As a Canopy subscriber, you unlock <strong>£{creditAmount} in Impact Focus consulting credits</strong> after
              6 continuous months. Each month you stay subscribed, you earn another bar.
            </p>

            {/* 6-bar tracker */}
            <div className="space-y-2">
              <div className="flex gap-2">
                {Array.from({ length: 6 }).map((_, i) => {
                  const complete = i < monthsSubscribed
                  const current = i === monthsSubscribed
                  return (
                    <div key={i} className="flex-1 space-y-1.5">
                      <div
                        className={cn(
                          'h-10 rounded-lg transition-all duration-500 flex items-center justify-center',
                          complete
                            ? 'bg-emerald-500 dark:bg-emerald-500'
                            : current
                              ? 'bg-emerald-100 dark:bg-emerald-900/50 border-2 border-emerald-400 border-dashed'
                              : 'bg-muted border border-border'
                        )}
                      >
                        {complete && (
                          <svg className="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                        {current && (
                          <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Now</span>
                        )}
                      </div>
                      <p className="text-center text-xs text-muted-foreground">Mo {i + 1}</p>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Summary line */}
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">
                {monthsSubscribed} of 6 months complete
              </span>
              <span className="font-medium text-emerald-600 dark:text-emerald-400">
                {6 - monthsSubscribed} {6 - monthsSubscribed === 1 ? 'month' : 'months'} to go
              </span>
            </div>

            <Button variant="outline" size="sm" asChild>
              <a href="/settings/">View Subscription</a>
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
