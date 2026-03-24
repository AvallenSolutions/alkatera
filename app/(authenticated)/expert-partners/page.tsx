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
  FileCheck,
  MessageSquare,
  Users,
  Shield,
  Sparkles,
} from 'lucide-react'
import { useSubscription } from '@/hooks/useSubscription'
import { usePartnerCredits } from '@/hooks/data/usePartnerCredits'

const SERVICE_AREAS = [
  {
    icon: Leaf,
    title: 'Sustainability Strategy',
    description: 'Develop a clear roadmap that aligns environmental goals with commercial reality.',
  },
  {
    icon: Award,
    title: 'B Corp Certification',
    description: 'Expert guidance through the B Impact Assessment, gap analysis, and submission process.',
  },
  {
    icon: BarChart3,
    title: 'Carbon Management',
    description: 'From baselining to reduction planning, with practical steps tailored to your operations.',
  },
  {
    icon: FileCheck,
    title: 'Third-Party Verification',
    description: 'Independent review of your LCA reports and sustainability claims for added credibility.',
  },
  {
    icon: MessageSquare,
    title: 'ESG Communications',
    description: 'Articulate your sustainability story with confidence, avoiding greenwashing risk.',
  },
  {
    icon: Shield,
    title: 'Impact Reporting',
    description: 'Produce reports that satisfy buyers, investors, and certification bodies.',
  },
  {
    icon: Users,
    title: 'Stakeholder Engagement',
    description: 'Build meaningful dialogue with suppliers, customers, and communities on sustainability.',
  },
]

const TEAM_MEMBERS = [
  {
    name: 'Rosie Davenport',
    role: 'Founder & Lead Strategist',
    bio: 'Over 25 years in sustainability strategy and communications for the food and drink industry. Former journalist turned strategist.',
  },
  {
    name: 'Fleur',
    role: 'Senior Consultant',
    bio: 'Specialist in B Corp certification and ESG strategy for consumer brands.',
  },
  {
    name: 'Chipo',
    role: 'Carbon & Climate Consultant',
    bio: 'Expert in carbon management, emissions reduction strategies, and climate action planning.',
  },
  {
    name: 'Kate',
    role: 'Communications Consultant',
    bio: 'Sustainability communications specialist helping brands tell authentic impact stories.',
  },
  {
    name: 'Lucy',
    role: 'Impact Analyst',
    bio: 'Data-driven sustainability reporting and impact measurement across ESG frameworks.',
  },
]

export default function ExpertPartnersPage() {
  const { tierName } = useSubscription()
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme } = usePartnerCredits()
  const isCanopyWithCredit = isCanopy && !isBetaProgramme

  return (
    <div className="space-y-8">
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
                {creditStatus === 'available'
                  ? `£${creditAmount} credit available`
                  : 'Credit pending'}
              </Badge>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Discount banner for all tiers */}
          <div className="flex items-center gap-2 p-3 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
            <Sparkles className="h-4 w-4 text-emerald-600 shrink-0" />
            <p className="text-sm text-emerald-800 dark:text-emerald-200">
              {isCanopyWithCredit && creditStatus === 'available' ? (
                <>You have <strong>£{creditAmount} in consulting credits</strong> to use with Impact Focus. Contact them to redeem.</>
              ) : isCanopyWithCredit && creditStatus === 'pending' ? (
                <>Your <strong>£{creditAmount} consulting credit</strong> is building. Keep your Canopy subscription active to unlock it.</>
              ) : isCanopyWithCredit && creditStatus === 'redeemed' ? (
                <>Your consulting credit has been redeemed. You still receive a discount on all Impact Focus services as an alka<strong>tera</strong> user.</>
              ) : (
                <>All alka<strong>tera</strong> users receive a <strong>discount on Impact Focus services</strong>. Mention your alka<strong>tera</strong> subscription when you get in touch.</>
              )}
            </p>
          </div>

          {/* CTAs */}
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

      {/* Service Areas */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Service Areas</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {SERVICE_AREAS.map((service) => (
            <Card key={service.title} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-2">
                <CardTitle className="text-base flex items-center gap-2">
                  <service.icon className="h-4 w-4 text-emerald-600" />
                  {service.title}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">{service.description}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Meet the Team */}
      <div className="space-y-4">
        <h2 className="text-xl font-semibold text-slate-900 dark:text-slate-100">Meet the Team</h2>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {TEAM_MEMBERS.map((member) => (
            <Card key={member.name}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-3">
                  <div className="h-10 w-10 rounded-full bg-emerald-100 dark:bg-emerald-900/30 flex items-center justify-center shrink-0">
                    <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      {member.name.split(' ').map(n => n[0]).join('')}
                    </span>
                  </div>
                  <div className="space-y-1">
                    <p className="font-medium text-sm">{member.name}</p>
                    <p className="text-xs text-emerald-600 dark:text-emerald-400">{member.role}</p>
                    <p className="text-xs text-muted-foreground mt-1">{member.bio}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Canopy Credit Status (detailed) */}
      {isCanopyWithCredit && creditStatus === 'pending' && (
        <Card className="border-amber-200 dark:border-amber-800/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-amber-500" />
              Your Consulting Credit
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-muted-foreground">
              As a Canopy subscriber, you will receive <strong>£{creditAmount} in Impact Focus consulting credits</strong> after
              6 continuous months of subscription (or immediately with an annual plan).
            </p>
            <div className="flex items-center gap-2">
              <Button variant="outline" size="sm" asChild>
                <a href="/settings/">View Subscription</a>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
