'use client'

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import Image from 'next/image'
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
import { useOrganization } from '@/lib/organizationContext'
import { redirect } from 'next/navigation'

// Temporarily restrict to alkatera Demo org until Impact Focus contract is signed
const EXPERT_PARTNERS_ALLOWED_ORGS = ['2d86de84-e24e-458b-84b9-fd4057998bda'];

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
    role: 'Founder and Lead Consultant',
    photo: '/images/partners/impact-focus/rosie.webp',
    bio: 'Over 25 years in sustainability, communications, and journalism. Cambridge Institute for Sustainability Leadership graduate, accredited GRI Sustainability Professional, and trained B Leader. Former Group Editor of Harpers Wine and Spirit and Drinks Editor at The Grocer.',
  },
  {
    name: 'Fleur Record-Smith',
    role: 'Sustainability and B Corp Consultant',
    photo: '/images/partners/impact-focus/fleur.webp',
    bio: 'Over 15 years hands-on sustainability experience in hospitality. Founded an award-winning, B Corp-certified hospitality venue. MSc in Sustainability and trained B Leader, with expertise in carbon management, environmental impact assessments, and net-zero goal-setting.',
  },
  {
    name: 'Chipo Mbawu',
    role: 'Social Impact and Ethical Business Consultant',
    photo: '/images/partners/impact-focus/chipo.webp',
    bio: 'Specialises in human rights, environmental due diligence, stakeholder engagement, and social ESG dimensions. Three years as Project Manager at The Shift. Experience spans North-South partnerships, gender empowerment, and corporate sustainability strategy.',
  },
  {
    name: 'Kate Sweet',
    role: 'PR and Communications Consultant',
    photo: '/images/partners/impact-focus/kate-sweet.webp',
    bio: '30 years wine industry experience. Developed communications strategies for organic, biodynamic, and regenerative viticulture brands. Eight years as PR and Events Manager at Brown-Forman Wines. Clients include Familia Torres and International Wineries for Climate Action.',
  },
  {
    name: 'Kate Hempsall',
    role: 'PR and Communications Consultant',
    photo: '/images/partners/impact-focus/kate-hempsall.webp',
    bio: 'Communications strategist with a strong track record in brewing and hospitality. Twelve years as Head of Communications at Charles Wells, three years at Carlsberg. Member of the British Guild of Beer Writers and Chartered Institute of Public Relations.',
  },
  {
    name: 'Lucy Savage-Mountain',
    role: 'Creative and Reporting Design Lead',
    photo: '/images/partners/impact-focus/lucy.webp',
    bio: 'Over 24 years design and branding experience, beginning at William Reed Publishing. Expertise in making sustainability data compelling through infographics. Founded Brighton-based design agency Add Tonic in 2011.',
  },
  {
    name: 'Caz Brunnen',
    role: 'Digital Accessibility Consultant',
    photo: '/images/partners/impact-focus/caz.webp',
    bio: 'Over eight years web development with five years digital accessibility specialisation. Delivered accessibility programmes for McDonald\'s, Commonwealth Bank of Australia, and Rugby Australia. Advocates for embedding accessibility into organisational operations.',
  },
  {
    name: 'Kim Jurriaans',
    role: 'Editor and Content Consultant',
    photo: '/images/partners/impact-focus/kim.webp',
    bio: 'Writer and multimedia producer with 20 years international journalism and non-profit communication experience, including six years with the UN Food and Agriculture Organization. Passionate about helping sustainability-forward organisations tell evidence-backed stories.',
  },
]

export default function ExpertPartnersPage() {
  const { tierName } = useSubscription()
  const { creditStatus, creditAmount, isCanopy, isBetaProgramme } = usePartnerCredits()
  const { currentOrganization } = useOrganization()
  const isCanopyWithCredit = isCanopy && !isBetaProgramme

  // Restrict access until Impact Focus contract is signed
  if (currentOrganization?.id && !EXPERT_PARTNERS_ALLOWED_ORGS.includes(currentOrganization.id)) {
    redirect('/')
  }

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
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {TEAM_MEMBERS.map((member) => (
            <Card key={member.name} className="overflow-hidden">
              <div className="aspect-[4/3] relative">
                <Image
                  src={member.photo}
                  alt={member.name}
                  fill
                  className="object-cover object-top"
                  sizes="(max-width: 768px) 50vw, (max-width: 1024px) 25vw, 25vw"
                />
              </div>
              <CardContent className="pt-4 pb-5">
                <p className="font-semibold text-sm">{member.name}</p>
                <p className="text-xs text-emerald-600 dark:text-emerald-400 mt-0.5">{member.role}</p>
                <p className="text-xs text-muted-foreground mt-2 leading-relaxed">{member.bio}</p>
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
