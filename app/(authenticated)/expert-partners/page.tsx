'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Handshake,
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
  type LucideIcon,
} from 'lucide-react'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'
import { cn } from '@/lib/utils'

interface Service {
  icon: LucideIcon
  title: string
  description: string
}

interface ServiceCategory {
  label: string
  tagline: string
  accent: 'emerald' | 'blue' | 'amber' | 'violet'
  services: Service[]
}

const SERVICE_CATEGORIES: ServiceCategory[] = [
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

const ACCENT_STYLES = {
  emerald: {
    section: 'border-l-emerald-500',
    iconBg: 'bg-emerald-100 dark:bg-emerald-900/40',
    iconColor: 'text-emerald-600 dark:text-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    cardBorder: 'hover:border-emerald-300 dark:hover:border-emerald-700',
  },
  blue: {
    section: 'border-l-blue-500',
    iconBg: 'bg-blue-100 dark:bg-blue-900/40',
    iconColor: 'text-blue-600 dark:text-blue-400',
    badge: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    cardBorder: 'hover:border-blue-300 dark:hover:border-blue-700',
  },
  amber: {
    section: 'border-l-amber-500',
    iconBg: 'bg-amber-100 dark:bg-amber-900/40',
    iconColor: 'text-amber-600 dark:text-amber-400',
    badge: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
    cardBorder: 'hover:border-amber-300 dark:hover:border-amber-700',
  },
  violet: {
    section: 'border-l-violet-500',
    iconBg: 'bg-violet-100 dark:bg-violet-900/40',
    iconColor: 'text-violet-600 dark:text-violet-400',
    badge: 'bg-violet-100 text-violet-700 dark:bg-violet-900/40 dark:text-violet-300',
    cardBorder: 'hover:border-violet-300 dark:hover:border-violet-700',
  },
}

export default function ExpertPartnersPage() {
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme, monthsSubscribed, billingInterval } = usePartnerCredits()
  const isCanopyWithCredit = isCanopy && !isBetaProgramme

  return (
    <div className="space-y-10">
      {/* Header */}
      <div className="space-y-2">
        <div className="flex items-center gap-3">
          <h1 className="text-3xl lg:text-4xl font-bold tracking-tight text-slate-900 dark:text-slate-100">
            Expert Partners
          </h1>
          <Badge variant="neon-emerald" className="text-xs">Recommended</Badge>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Expert sustainability consulting to help you turn data into action. Our recommended partner works
          alongside alka<strong>tera</strong> to provide the human guidance that goes beyond what a platform can deliver.
        </p>
      </div>

      {/* Impact Focus Hero Card */}
      <Card className="border-2 border-emerald-200 dark:border-emerald-800/50 bg-gradient-to-br from-white to-emerald-50/30 dark:from-slate-900 dark:to-emerald-950/20">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <CardTitle className="text-2xl flex items-center gap-2">
                <Handshake className="h-6 w-6 text-emerald-600" />
                Impact Focus
              </CardTitle>
              <CardDescription className="text-base max-w-xl">
                Specialist sustainability consultancy with deep roots in the food and drink industry.
                Combining genuine strategic expertise with best-in-class sustainability communications.
              </CardDescription>
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
              <a href="mailto:hello@impactfocus.co.uk?subject=Enquiry%20from%20alkatera%20user&body=Hi%20Impact%20Focus%2C%0A%0AI%27m%20an%20alkatera%20user%20and%20would%20like%20to%20discuss%20your%20consulting%20services.%0A%0AThanks">
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
      <div className="space-y-10">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">What Impact Focus can help with</h2>

        {SERVICE_CATEGORIES.map((category) => {
          const styles = ACCENT_STYLES[category.accent]
          return (
            <div key={category.label} className="space-y-4">
              {/* Category header */}
              <div className={cn('pl-4 border-l-4', styles.section)}>
                <div className="flex items-center gap-2">
                  <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
                    {category.label}
                  </h3>
                  <span className={cn('text-xs font-medium px-2 py-0.5 rounded-full', styles.badge)}>
                    {category.services.length} {category.services.length === 1 ? 'service' : 'services'}
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-0.5">{category.tagline}</p>
              </div>

              {/* Service cards */}
              <div className="grid gap-3 md:grid-cols-2">
                {category.services.map((service) => {
                  const Icon = service.icon
                  return (
                    <Card
                      key={service.title}
                      className={cn(
                        'transition-all duration-200 hover:shadow-md border',
                        styles.cardBorder
                      )}
                    >
                      <CardContent className="p-5">
                        <div className="flex gap-4">
                          <div className={cn('rounded-lg p-2.5 shrink-0 h-fit', styles.iconBg)}>
                            <Icon className={cn('h-5 w-5', styles.iconColor)} />
                          </div>
                          <div className="space-y-1.5">
                            <p className="font-semibold text-sm leading-snug text-slate-900 dark:text-slate-100">
                              {service.title}
                            </p>
                            <p className="text-sm text-muted-foreground leading-relaxed">
                              {service.description}
                            </p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )
                })}
              </div>
            </div>
          )
        })}
      </div>

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
