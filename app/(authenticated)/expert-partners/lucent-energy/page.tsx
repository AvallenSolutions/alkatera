import Link from 'next/link'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  ExternalLink,
  Mail,
  Sparkles,
  ArrowLeft,
  SunMedium,
  PencilRuler,
  Building2,
  PoundSterling,
  Wrench,
  BatteryCharging,
  CarFront,
  Activity,
} from 'lucide-react'
import { PartnerServices } from '@/components/partners/PartnerServices'
import type { PartnerServiceCategory } from '@/lib/partners/service-styles'

const LUCENT_WEBSITE = 'https://www.lucentenergy.co.uk'
const LUCENT_EMAIL = 'info@lucentenergy.co.uk'
const LUCENT_MAILTO = `mailto:${LUCENT_EMAIL}?subject=${encodeURIComponent(
  'Solar enquiry from alkatera user',
)}&body=${encodeURIComponent(
  "Hi Lucent Energy,\n\nI'm an alkatera user and would like to discuss a solar electricity system for my site, including a free feasibility assessment.\n\nThanks",
)}`

const SERVICE_CATEGORIES: PartnerServiceCategory[] = [
  {
    label: 'Assessment and Design',
    tagline: 'Understanding your site and designing the right system for it',
    accent: 'orange',
    services: [
      {
        icon: SunMedium,
        title: 'Solar Feasibility Assessment',
        description: 'For producers wondering whether on-site solar stacks up. Lucent reviews your site, roof or land, and electricity demand profile to model how much of your usage solar could cover and what it would save. Free for alkatera users.',
      },
      {
        icon: PencilRuler,
        title: 'Bespoke System Design and Specification',
        description: 'For sites ready to move forward. Lucent designs a solar PV system sized to your production load and energy patterns, so generation matches the times you actually draw power.',
      },
      {
        icon: Building2,
        title: 'Roof and Structural Survey',
        description: 'For breweries, distilleries, and wineries with large roof areas or available land. A structural and shading survey confirms what your buildings can carry and where panels will perform best.',
      },
    ],
  },
  {
    label: 'Funding and Installation',
    tagline: 'Removing the upfront barriers and delivering the project end to end',
    accent: 'amber',
    services: [
      {
        icon: PoundSterling,
        title: 'Flexible Funding and Power Purchase Agreements',
        description: 'For businesses that want clean electricity without a large capital outlay. Lucent offers outright purchase, leasing, and power purchase agreements where you pay only for the power you use, often below grid rates.',
      },
      {
        icon: Wrench,
        title: 'Installation and Grid Connection',
        description: 'For producers who need a single accountable partner. Lucent manages the full installation, certification, and grid connection process, keeping disruption to production to a minimum.',
      },
    ],
  },
  {
    label: 'Storage, Reporting and Optimisation',
    tagline: 'Getting the most from every unit you generate and proving the impact',
    accent: 'yellow',
    services: [
      {
        icon: BatteryCharging,
        title: 'Battery Storage and Energy Management',
        description: 'For sites whose demand peaks outside daylight hours. Battery storage captures daytime generation for use during evening or overnight production, increasing how much of your own clean power you actually consume.',
      },
      {
        icon: CarFront,
        title: 'EV Charging Infrastructure',
        description: 'For fleets and visitor sites. Lucent can pair your solar system with EV charging so on-site generation powers your vehicles and reduces transport emissions.',
      },
      {
        icon: Activity,
        title: 'Generation Monitoring and Carbon Reporting',
        description: 'For teams tracking their footprint. Real-time monitoring shows generation and self-consumption, and the renewable electricity data feeds straight into your alkatera Scope 2 reporting.',
      },
    ],
  },
]

export default function LucentEnergyPartnerPage() {
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

      {/* Lucent Energy Hero Card */}
      <Card className="border-2 border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-amber-950/20">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-start gap-4 min-w-0">
              <img
                src="/images/partners/lucent-energy/logo.png"
                alt="Lucent Energy"
                className="h-16 w-16 shrink-0 rounded-md bg-slate-900 object-contain p-1.5"
              />
              <div className="space-y-2">
                <div className="flex items-center gap-2 flex-wrap">
                  <CardTitle className="text-2xl">Lucent Energy</CardTitle>
                  <Badge variant="secondary" className="text-xs">Solar energy partner</Badge>
                </div>
                <CardDescription className="text-base max-w-xl">
                  Lucent Energy helps breweries, wineries, distilleries and other manufacturing businesses
                  reduce energy costs and make meaningful, measurable reductions to their carbon footprint
                  through renewable energy solutions.
                </CardDescription>
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2 p-3 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
            <Sparkles className="h-4 w-4 text-amber-600 shrink-0" />
            <p className="text-sm text-amber-800 dark:text-amber-200">
              As an alka<strong>tera</strong> user, your <strong>initial solar feasibility assessment is free</strong>.
              Find out how much of your site&apos;s electricity solar could cover, with no obligation.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              <a href={LUCENT_WEBSITE} target="_blank" rel="noopener noreferrer">
                Visit Lucent Energy
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={LUCENT_MAILTO}>
                <Mail className="mr-2 h-4 w-4" />
                Book a free assessment
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* About Lucent Energy */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">About Lucent Energy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-muted-foreground">
          <p>
            We specialise in the design, supply and installation of commercial solar PV systems, battery storage,
            EV charging infrastructure and energy efficiency solutions. Unlike many sustainability initiatives,
            solar energy delivers tangible results from day one, reducing reliance on grid electricity, lowering
            operating costs and directly offsetting carbon emissions through the generation of clean, renewable
            power on-site.
          </p>
          <p>
            For energy-intensive producers, solar is a sustainability investment capable of delivering both
            significant environmental benefits and attractive financial returns. By generating electricity where
            it is consumed, businesses can reduce exposure to rising energy prices, improve energy resilience and
            make genuine progress towards their carbon reduction and net-zero objectives without compromising
            operational performance.
          </p>
          <p>
            Our team understands the unique energy demands of breweries, wineries and distilleries and works
            closely with clients to identify commercially viable opportunities that deliver long-term value. We
            believe sustainability should be more than a reporting exercise; it should create measurable benefits
            for both the environment and the bottom line.
          </p>
        </CardContent>
      </Card>

      {/* Service Categories */}
      <PartnerServices heading="What Lucent Energy can help with" categories={SERVICE_CATEGORIES} />

      {/* Closing CTA */}
      <Card className="border-2 border-amber-200 dark:border-amber-800/50 bg-gradient-to-br from-white to-amber-50/30 dark:from-slate-900 dark:to-amber-950/20">
        <CardContent className="p-6 space-y-4">
          <div className="space-y-1.5">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-slate-100">
              Interested in exploring renewable energy for your site?
            </h2>
            <p className="text-sm text-muted-foreground max-w-2xl">
              Get in touch with Lucent Energy to discuss how solar and renewable technologies can reduce costs,
              lower emissions and support your sustainability goals.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Button asChild className="bg-amber-500 hover:bg-amber-600 text-slate-900">
              <a href={LUCENT_WEBSITE} target="_blank" rel="noopener noreferrer">
                Visit Lucent Energy
                <ExternalLink className="ml-2 h-4 w-4" />
              </a>
            </Button>
            <Button variant="outline" asChild>
              <a href={LUCENT_MAILTO}>
                <Mail className="mr-2 h-4 w-4" />
                Book a free assessment
              </a>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
