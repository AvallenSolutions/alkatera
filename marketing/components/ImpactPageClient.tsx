'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Wind,
  Droplets,
  Recycle,
  Sprout,
  TreePine,
  Users,
  Activity,
  BarChart3,
  Layers,
  Target,
  ShieldCheck,
  Globe,
  FileText,
  Footprints,
  ArrowRight,
  Search,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { Brand } from '@/components/shared/Brand';

/* ═══════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════ */

const Hero = () => (
  <section className="relative pt-32 pb-20 px-6 md:px-10 overflow-hidden">
    <div className="max-w-5xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-6">
          Beyond Carbon
        </p>
        <h1 className="font-display font-bold tracking-[-0.035em] text-5xl md:text-8xl leading-[0.95] mb-8">
          Impact,{' '}
          <span className="text-[#205E40]">measured.</span>
        </h1>
        <p className="text-[#6F6F68] text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-12">
          The drinks industry accounts for a significant share of global water use, agricultural emissions, and packaging waste. <Brand /> gives you the tools to measure, understand, and reduce your true environmental footprint.
        </p>
        <Link
          href="/getaccess"
          className="inline-flex items-center gap-3 bg-[#1A1B1D] text-[#F2F1EA] font-mono text-xs font-bold uppercase tracking-[0.22em] px-10 py-4 rounded-full hover:bg-[#205E40] transition-colors"
        >
          Start Measuring <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   The Challenge Section
   ═══════════════════════════════════════════ */

const challengeStats = [
  {
    icon: Wind,
    stat: '~1.5 billion',
    label: 'Tonnes of CO₂ from global food & drink annually',
    color: 'text-[#205E40]',
  },
  {
    icon: Droplets,
    stat: '70%',
    label: 'Of global freshwater used by agriculture',
    color: 'text-[#2B46C0]',
  },
  {
    icon: Recycle,
    stat: '36%',
    label: 'Of packaging waste comes from food & beverage',
    color: 'text-[#1A1B1D]',
  },
];

const ChallengeSection = () => (
  <section className="py-20 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-4">The Challenge</p>
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl leading-[0.95] max-w-3xl">
          An industry with a{' '}
          <span className="text-[#205E40]">hidden footprint.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {challengeStats.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.1 }}
            className="group relative overflow-hidden bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-8 hover:border-[#205E40] transition-all duration-500"
          >
            <item.icon className={`w-8 h-8 mb-6 ${item.color} opacity-70`} />
            <div className={`font-display text-4xl font-bold mb-3 tracking-[-0.02em] tabular-nums ${item.color}`}>{item.stat}</div>
            <p className="text-[#6F6F68] text-sm leading-relaxed font-mono uppercase tracking-[0.1em] text-[11px]">{item.label}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   What We Measure Section
   ═══════════════════════════════════════════ */

const measureCategories = [
  {
    icon: Wind,
    title: 'Carbon Emissions',
    description: 'Full Scope 1, 2, and 3 greenhouse gas accounting across your entire value chain, from raw materials to end-of-life.',
  },
  {
    icon: Droplets,
    title: 'Water Footprint',
    description: 'Blue, green, and grey water consumption tracking across agriculture, production, and packaging processes.',
  },
  {
    icon: TreePine,
    title: 'Land Use & Biodiversity',
    description: 'Measure the land footprint of your ingredients and the biodiversity impact of your agricultural supply chain.',
  },
  {
    icon: Recycle,
    title: 'Waste & Circularity',
    description: 'Track packaging recyclability, spent grain diversion, wastewater treatment, and circular economy metrics.',
  },
  {
    icon: Users,
    title: 'Social Impact',
    description: 'Community engagement, fair trade sourcing, living wages, and social governance indicators for responsible business.',
  },
  {
    icon: ShieldCheck,
    title: 'Governance & Compliance',
    description: 'Track alignment with ESG frameworks, regulatory requirements, and industry best practices across your organisation.',
  },
];

const MeasureSection = () => (
  <section className="py-20 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 text-center"
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-4">What We Measure</p>
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl leading-[0.95] mb-6">
          Six dimensions of{' '}
          <span className="text-[#205E40]">true impact.</span>
        </h2>
        <p className="text-[#6F6F68] max-w-2xl mx-auto">
          Most platforms stop at carbon. <Brand /> measures the full spectrum of environmental, social, and governance impact, because sustainability is about more than emissions.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {measureCategories.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="group relative overflow-hidden bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-8 hover:border-[#205E40] transition-all duration-500"
          >
            <item.icon className="w-7 h-7 mb-5 text-[#1A1B1D]/50 group-hover:text-[#205E40] transition-colors" />
            <h3 className="font-display font-semibold tracking-[-0.02em] text-xl mb-3">{item.title}</h3>
            <p className="text-[#6F6F68] text-sm leading-relaxed">{item.description}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   How It Works Section
   ═══════════════════════════════════════════ */

const steps = [
  {
    number: '01',
    icon: Search,
    title: 'Measure',
    description: 'Input your products, ingredients, processes, and supply chain data. Our LCA engine calculates your impact across all six dimensions automatically.',
  },
  {
    number: '02',
    icon: Lightbulb,
    title: 'Analyse',
    description: 'Understand where your biggest impacts lie. Identify hotspots, benchmark against industry peers, and discover reduction opportunities.',
  },
  {
    number: '03',
    icon: TrendingUp,
    title: 'Act',
    description: 'Set science-based targets, track progress over time, generate compliant reports, and communicate your impact story with confidence.',
  },
];

const HowItWorksSection = () => (
  <section className="py-20 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12"
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-4">How It Works</p>
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl leading-[0.95] max-w-3xl">
          From data to{' '}
          <span className="text-[#205E40]">action.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className="relative"
          >
            <div className="font-display text-[#205E40]/20 text-7xl font-bold tabular-nums mb-4">{step.number}</div>
            <step.icon className="w-6 h-6 text-[#205E40] mb-4" />
            <h3 className="font-display font-semibold tracking-[-0.02em] text-2xl mb-3">{step.title}</h3>
            <p className="text-[#6F6F68] text-sm leading-relaxed">{step.description}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden md:block absolute top-8 -right-4 w-6 h-6 text-[#1A1B1D]/10" />
            )}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Beyond Carbon Section
   ═══════════════════════════════════════════ */

const BeyondCarbonSection = () => (
  <section className="py-20 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 text-center"
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-4">Beyond Carbon</p>
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl leading-[0.95] mb-6">
          Carbon is just the{' '}
          <span className="text-[#205E40]">beginning.</span>
        </h2>
        <p className="text-[#6F6F68] max-w-2xl mx-auto">
          The Green Claims Directive demands evidence-based sustainability communication. <Brand /> ensures every claim you make is defensible, verified, and backed by recognised standards.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="group relative overflow-hidden rounded-[6px]"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop"
              alt="Data visualisation"
              className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-[#1A1B1D]/55" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h3 className="font-display font-semibold tracking-[-0.02em] text-2xl mb-2 text-[#F2F1EA]">From Spreadsheet to Story</h3>
            <p className="text-[#F2F1EA]/70 text-sm leading-relaxed">
              Transform complex environmental data into visual narratives your customers, retailers, and investors can understand. Data you can finally share with confidence.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="group relative overflow-hidden rounded-[6px]"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop"
              alt="Verified data"
              className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-[#1A1B1D]/55" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h3 className="font-display font-semibold tracking-[-0.02em] text-2xl mb-2 text-[#F2F1EA]">The Glass Box Guarantee</h3>
            <p className="text-[#F2F1EA]/70 text-sm leading-relaxed">
              Every metric is backed by verified industry datasets and global standards. When you show an impact number via alka<strong>tera</strong>, it&apos;s a defensible fact, not a guess.
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Frameworks & Standards Section
   ═══════════════════════════════════════════ */

const frameworks = [
  { name: 'GHG Protocol', desc: 'Scope 1, 2 & 3 corporate and product-level accounting' },
  { name: 'ISO 14040/44', desc: 'Life Cycle Assessment methodology standards' },
  { name: 'Science Based Targets', desc: 'SBTi-aligned emissions reduction pathways' },
  { name: 'GRI Standards', desc: 'Global Reporting Initiative sustainability disclosure' },
  { name: 'B Corp', desc: 'B Impact Assessment alignment and certification readiness' },
  { name: 'CSRD / ESRS', desc: 'EU Corporate Sustainability Reporting Directive compliance' },
];

const FrameworksSection = () => (
  <section className="py-20 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 text-center"
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-4">Standards &amp; Frameworks</p>
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl leading-[0.95] mb-6">
          Built on{' '}
          <span className="text-[#205E40]">recognised standards.</span>
        </h2>
        <p className="text-[#6F6F68] max-w-2xl mx-auto">
          Every calculation in alka<strong>tera</strong> is grounded in internationally recognised methodologies and reporting frameworks.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {frameworks.map((fw, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] px-6 py-5 hover:border-[#205E40] transition-all duration-300"
          >
            <div className="font-mono font-bold text-sm text-[#1A1B1D] mb-1">{fw.name}</div>
            <div className="text-[#6F6F68] text-xs leading-relaxed">{fw.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Partnership Section (Impact Focus)
   ═══════════════════════════════════════════ */

const PartnershipSection = () => (
  <section className="py-20 px-6 md:px-10 relative">
    <div className="max-w-5xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-12 text-center"
      >
        <p className="font-mono font-bold text-[#205E40] text-xs uppercase tracking-[0.22em] mb-4">Beyond the Data</p>
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl leading-[0.95] mb-6">
          When data needs a{' '}
          <span className="text-[#205E40]">human partner.</span>
        </h2>
        <p className="text-[#6F6F68] max-w-2xl mx-auto leading-relaxed">
          Numbers tell you what is happening. Strategy tells you what to do about it. We have partnered exclusively with Impact Focus, who bring 25 years of specialist food and drink sustainability experience, to help alka<strong>tera</strong> users translate data into commercially grounded action.
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="group relative overflow-hidden bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-8 md:p-12 hover:border-[#205E40] transition-all duration-500"
      >
        <div className="grid grid-cols-1 md:grid-cols-[auto,1fr] gap-8 md:gap-10 items-center">
          <div className="bg-white rounded-[6px] border border-[#D9D6CB] px-8 py-6 flex items-center justify-center w-full md:w-56 h-28">
            <img
              src="/images/partners/impact-focus/logo.png"
              alt="Impact Focus"
              className="object-contain max-h-16 w-auto"
            />
          </div>

          <div className="text-center md:text-left">
            <p className="font-mono font-bold text-[#6F6F68] text-xs uppercase tracking-[0.22em] mb-3">
              Exclusive Strategic Partner
            </p>
            <p className="text-[#1A1B1D]/80 text-base md:text-lg leading-relaxed mb-6">
              Strategic sustainability consulting, exclusively for alka<strong>tera</strong> customers. Canopy subscribers unlock consulting credits.
            </p>
            <a
              href="https://www.impactfocus.co.uk"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-3 bg-[#1A1B1D] text-[#F2F1EA] font-mono text-xs font-bold uppercase tracking-[0.22em] px-8 py-4 rounded-full hover:bg-[#205E40] transition-colors"
            >
              Visit Impact Focus <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </div>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   CTA Section (Forest)
   ═══════════════════════════════════════════ */

const CTASection = () => (
  <section className="py-28 px-6 md:px-20 bg-[#205E40] text-[#F2F1EA] text-center relative overflow-hidden">
    <div className="relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <Sprout className="w-12 h-12 text-[#F2F1EA]/70 mx-auto mb-8" />
        <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-5">
          Start measuring
          <br />
          what matters.
        </h2>
        <p className="text-[#F2F1EA]/70 mb-12 text-base max-w-xl mx-auto">
          Join the movement of drinks brands building a regenerative future with data they can trust.
        </p>
        <Link
          href="/getaccess"
          className="inline-flex items-center gap-3 bg-[#F2F1EA] text-[#1A1B1D] font-mono text-xs font-bold uppercase tracking-[0.22em] px-10 py-5 rounded-full hover:bg-white transition-colors duration-300"
        >
          Get Access <ArrowRight className="w-4 h-4" />
        </Link>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════ */

export function ImpactPageClient() {
  return (
    <div className="relative min-h-screen w-full bg-[#ECEAE3] text-[#1A1B1D] overflow-x-hidden selection:bg-[#1A1B1D] selection:text-[#F2F1EA]">
      <Navigation />

      {/* Fixed Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2574&auto=format&fit=crop"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-10 mix-blend-multiply grayscale"
          />
        </div>
      </div>

      {/* Scrollable Foreground Content */}
      <div className="relative z-10">
        <Hero />
        <ChallengeSection />
        <MeasureSection />
        <HowItWorksSection />
        <BeyondCarbonSection />
        <FrameworksSection />
        <PartnershipSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
