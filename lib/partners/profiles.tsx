import type { ReactNode } from 'react'

/**
 * Per-partner profile configuration for the shared expert-partner surface.
 *
 * The two partner-profile pages (impact-focus, lucent-energy) are one surface
 * (PartnerProfile) driven by one of the config objects below. Each config
 * carries the partner's copy, service catalogue, contact URLs and, optionally,
 * a credit programme. The template renders the studio sections; live credit
 * state is passed in as a prop (see PartnerCreditView) so the credit hook stays
 * wired only where it is needed (Impact Focus).
 *
 * Contact URLs are load-bearing and preserved byte-for-byte from the original
 * pages, with one deliberate fix: the Impact Focus enquiry address moves from
 * hello@impactfocus.co to hello@impactfocus.co.uk (the .co domain was a bug).
 */

/** One service in the catalogue: a bold title over a quiet description. */
export interface PartnerServiceItem {
  title: string
  description: ReactNode
}

/** A named group of services, rendered under a mono category eyebrow. */
export interface PartnerServiceGroup {
  /** Mono category label, e.g. 'Strategy and Planning'. */
  category: string
  services: PartnerServiceItem[]
}

export interface PartnerProfileConfig {
  slug: string
  name: string
  /** Mono meta beneath the statement, e.g. 'Sustainability consultancy'. */
  category: string
  logoSrc: string
  /** Tailwind classes shaping the logo tile (background, padding). */
  logoClassName: string
  /** The prose paragraphs under WHY WE RECOMMEND THEM. */
  prose: ReactNode[]
  /** The service catalogue, grouped by category. */
  serviceGroups: PartnerServiceGroup[]
  website: { label: string; url: string }
  email: { label: string; mailto: string }
  /**
   * The quiet incentive line shown in GET IN TOUCH when there is no live
   * credit poster (a discount, a free assessment).
   */
  incentive?: ReactNode
  /**
   * True when this partner runs the £600 credit ladder. When set, the template
   * renders the one saturated ochre poster from the live PartnerCreditView.
   */
  creditProgramme?: boolean
}

/** The subset of usePartnerCredits the template needs to draw the poster. */
export interface PartnerCreditView {
  creditAmount: number
  monthsSubscribed: number
  status: 'pending' | 'available' | 'redeemed' | 'expired' | 'not_eligible'
  /** isCanopy and not on the beta programme: the ladder applies at all. */
  eligibleForLadder: boolean
}

export const impactFocusProfile: PartnerProfileConfig = {
  slug: 'impact-focus',
  name: 'Impact Focus',
  category: 'Sustainability consultancy',
  logoSrc: '/images/partners/impact-focus/logo.png',
  logoClassName: 'bg-white p-2 dark:bg-white/90',
  creditProgramme: true,
  prose: [
    <>
      alka<strong>tera</strong> provides the technical infrastructure for measuring, tracking, and
      reporting on sustainability. But we know that data alone is not enough. Many organisations,
      particularly those earlier in their sustainability journey, need expert human guidance to
      interpret the numbers and turn them into meaningful action.
    </>,
    <>
      Impact Focus brings over 25 years of specialist experience in the food and drink sector. Their
      team understands the specific challenges of our industry and can help you navigate everything
      from B Corp certification to carbon reduction planning to credible ESG communications.
    </>,
    <>
      This is not a generic marketplace listing. We have chosen Impact Focus as our exclusive
      consulting partner because we believe in the quality and integrity of their work. When you
      engage Impact Focus, you contract with them directly. alka<strong>tera</strong> does not take a
      margin on consulting work.
    </>,
  ],
  serviceGroups: [
    {
      category: 'Strategy and Planning',
      services: [
        {
          title: 'Sustainability Strategy Development and Implementation',
          description:
            'For organisations ready to set formal sustainability targets but uncertain where to start. Impact Focus builds practical, commercially grounded strategies that create a clear path from ambition to action.',
        },
        {
          title: 'Sustainability Management Strategy',
          description:
            'For businesses that have started their sustainability journey but need a coherent framework to manage, measure, and improve performance over time.',
        },
        {
          title: 'Biodiversity Strategy',
          description:
            'For producers and land managers wanting to understand the ecological impact of their operations and build a credible nature recovery or biodiversity net gain plan.',
        },
        {
          title: 'Carbon Reduction Planning and Net Zero Roadmaps',
          description:
            'For organisations that have completed their carbon footprint and now need a credible, costed reduction plan with realistic milestones and accountability.',
        },
      ],
    },
    {
      category: 'Reporting and Compliance',
      services: [
        {
          title: 'Materiality Assessments and Stakeholder Engagement',
          description:
            'For businesses preparing for investor scrutiny, CSRD obligations, or sustainability reporting who need to identify and prioritise their most significant topics through structured stakeholder dialogue.',
        },
        {
          title: 'ESG Due Diligence and Reporting Advisory',
          description:
            'For brands seeking investment, preparing for acquisition, or responding to lender requirements who need to demonstrate ESG readiness with confidence.',
        },
        {
          title: 'Sustainability and Impact Report Creation',
          description:
            'For businesses ready to publish their first sustainability report but lacking the in-house resource to manage content development, design, and delivery end to end.',
        },
        {
          title: 'Regulatory Compliance Guidance and Reporting Support',
          description:
            'For suppliers and brands facing new CSRD, EUDR, modern slavery, or packaging obligations who need help understanding what applies to them and building a structured response.',
        },
      ],
    },
    {
      category: 'Certification and Standards',
      services: [
        {
          title: 'B Corp Certification Support',
          description:
            'For businesses committed to B Corp but struggling to navigate the B Impact Assessment, gap analysis, improvement planning, and submission process.',
        },
        {
          title: 'EcoVadis Ratings Preparation and Improvement',
          description:
            'For suppliers asked by a major retailer, buyer, or brand owner to achieve or improve an EcoVadis score within a defined timeframe.',
        },
      ],
    },
    {
      category: 'Communications and Capability',
      services: [
        {
          title: 'Sustainability Communications and Storytelling',
          description:
            'For brands with a strong sustainability story but no clear way to communicate it without greenwashing risk. Impact Focus helps translate data and commitments into authentic, compelling narratives.',
        },
        {
          title: 'Training and Capacity-Building Programmes',
          description:
            'For teams that need to build internal sustainability literacy before they can own their own data collection, reporting, or stakeholder communication.',
        },
        {
          title: 'Digital Accessibility Audits, Training and Remediation',
          description:
            'For organisations that need to meet WCAG standards, respond to an accessibility complaint, or embed accessibility as a standard practice across their digital estate.',
        },
      ],
    },
  ],
  website: { label: 'Visit Impact Focus', url: 'https://www.impactfocus.co.uk' },
  email: {
    label: 'Send an enquiry',
    mailto:
      'mailto:hello@impactfocus.co.uk?subject=Enquiry%20from%20alkatera%20user&body=Hi%20Impact%20Focus%2C%0A%0AI%27m%20an%20alkatera%20user%20and%20would%20like%20to%20discuss%20your%20consulting%20services.%0A%0AThanks',
  },
  incentive: (
    <>
      All alka<strong>tera</strong> users receive a discount on Impact Focus services. Mention your
      alka<strong>tera</strong> subscription when you get in touch.
    </>
  ),
}

const LUCENT_EMAIL = 'info@lucentenergy.co.uk'
const LUCENT_MAILTO = `mailto:${LUCENT_EMAIL}?subject=${encodeURIComponent(
  'Solar enquiry from alkatera user',
)}&body=${encodeURIComponent(
  "Hi Lucent Energy,\n\nI'm an alkatera user and would like to discuss a solar electricity system for my site, including a free feasibility assessment.\n\nThanks",
)}`

export const lucentEnergyProfile: PartnerProfileConfig = {
  slug: 'lucent-energy',
  name: 'Lucent Energy',
  category: 'Solar energy partner',
  logoSrc: '/images/partners/lucent-energy/logo.png',
  logoClassName: 'bg-studio-ink object-contain p-1.5',
  prose: [
    <>
      We specialise in the design, supply and installation of commercial solar PV systems, battery
      storage, EV charging infrastructure and energy efficiency solutions. Unlike many sustainability
      initiatives, solar energy delivers tangible results from day one, reducing reliance on grid
      electricity, lowering operating costs and directly offsetting carbon emissions through the
      generation of clean, renewable power on-site.
    </>,
    <>
      For energy-intensive producers, solar is a sustainability investment capable of delivering both
      significant environmental benefits and attractive financial returns. By generating electricity
      where it is consumed, businesses can reduce exposure to rising energy prices, improve energy
      resilience and make genuine progress towards their carbon reduction and net-zero objectives
      without compromising operational performance.
    </>,
    <>
      Our team understands the unique energy demands of breweries, wineries and distilleries and works
      closely with clients to identify commercially viable opportunities that deliver long-term value.
      We believe sustainability should be more than a reporting exercise; it should create measurable
      benefits for both the environment and the bottom line.
    </>,
  ],
  serviceGroups: [
    {
      category: 'Assessment and Design',
      services: [
        {
          title: 'Solar Feasibility Assessment',
          description: (
            <>
              For producers wondering whether on-site solar stacks up. Lucent reviews your site, roof
              or land, and electricity demand profile to model how much of your usage solar could cover
              and what it would save. Free for alka<strong>tera</strong> users.
            </>
          ),
        },
        {
          title: 'Bespoke System Design and Specification',
          description:
            'For sites ready to move forward. Lucent designs a solar PV system sized to your production load and energy patterns, so generation matches the times you actually draw power.',
        },
        {
          title: 'Roof and Structural Survey',
          description:
            'For breweries, distilleries, and wineries with large roof areas or available land. A structural and shading survey confirms what your buildings can carry and where panels will perform best.',
        },
      ],
    },
    {
      category: 'Funding and Installation',
      services: [
        {
          title: 'Flexible Funding and Power Purchase Agreements',
          description:
            'For businesses that want clean electricity without a large capital outlay. Lucent offers outright purchase, leasing, and power purchase agreements where you pay only for the power you use, often below grid rates.',
        },
        {
          title: 'Installation and Grid Connection',
          description:
            'For producers who need a single accountable partner. Lucent manages the full installation, certification, and grid connection process, keeping disruption to production to a minimum.',
        },
      ],
    },
    {
      category: 'Storage, Reporting and Optimisation',
      services: [
        {
          title: 'Battery Storage and Energy Management',
          description:
            'For sites whose demand peaks outside daylight hours. Battery storage captures daytime generation for use during evening or overnight production, increasing how much of your own clean power you actually consume.',
        },
        {
          title: 'EV Charging Infrastructure',
          description:
            'For fleets and visitor sites. Lucent can pair your solar system with EV charging so on-site generation powers your vehicles and reduces transport emissions.',
        },
        {
          title: 'Generation Monitoring and Carbon Reporting',
          description: (
            <>
              For teams tracking their footprint. Real-time monitoring shows generation and
              self-consumption, and the renewable electricity data feeds straight into your alka
              <strong>tera</strong> Scope 2 reporting.
            </>
          ),
        },
      ],
    },
  ],
  website: { label: 'Visit Lucent Energy', url: 'https://www.lucentenergy.co.uk' },
  email: { label: 'Book a free assessment', mailto: LUCENT_MAILTO },
  incentive: (
    <>
      As an alka<strong>tera</strong> user, your initial solar feasibility assessment is free. Find out
      how much of your site&apos;s electricity solar could cover, with no obligation.
    </>
  ),
}
