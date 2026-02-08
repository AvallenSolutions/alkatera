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

/* ═══════════════════════════════════════════
   Hero Section
   ═══════════════════════════════════════════ */

const Hero = () => (
  <section className="relative pt-40 pb-32 px-6 md:px-10 overflow-hidden">
    <div className="max-w-5xl mx-auto text-center">
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.8 }}
      >
        <p className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.3em] mb-6">
          Beyond Carbon
        </p>
        <h1 className="font-serif text-5xl md:text-8xl leading-[0.95] mb-8 tracking-tight">
          Impact,{' '}
          <span className="italic text-[#ccff00]">Measured</span>
        </h1>
        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-12">
          The drinks industry accounts for a significant share of global water use, agricultural emissions, and packaging waste. Alkatera gives you the tools to measure, understand, and reduce your true environmental footprint.
        </p>
        <Link
          href="/getaccess"
          className="inline-flex items-center gap-3 bg-[#ccff00] text-black font-mono text-xs font-medium uppercase tracking-widest px-10 py-4 rounded-full hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(204,255,0,0.3)] transition-all"
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
    color: 'text-[#ccff00]',
  },
  {
    icon: Droplets,
    stat: '70%',
    label: 'Of global freshwater used by agriculture',
    color: 'text-[#00ccff]',
  },
  {
    icon: Recycle,
    stat: '36%',
    label: 'Of packaging waste comes from food & beverage',
    color: 'text-white',
  },
];

const ChallengeSection = () => (
  <section className="py-32 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16"
      >
        <p className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.3em] mb-4">The Challenge</p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] max-w-3xl">
          An industry with a{' '}
          <span className="text-[#ccff00] italic">hidden footprint</span>
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
            className="group relative overflow-hidden backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-[#ccff00]/25 transition-all duration-500"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-[#ccff00]/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <item.icon className={`w-8 h-8 mb-6 ${item.color} opacity-70`} />
            <div className={`text-4xl font-bold mb-3 tracking-tight ${item.color}`}>{item.stat}</div>
            <p className="text-gray-400 text-sm leading-relaxed">{item.label}</p>
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
    description: 'Full Scope 1, 2, and 3 greenhouse gas accounting across your entire value chain — from raw materials to end-of-life.',
    color: 'hover:border-[#ccff00]/25',
    accent: 'via-[#ccff00]/40',
  },
  {
    icon: Droplets,
    title: 'Water Footprint',
    description: 'Blue, green, and grey water consumption tracking across agriculture, production, and packaging processes.',
    color: 'hover:border-[#00ccff]/25',
    accent: 'via-[#00ccff]/40',
  },
  {
    icon: TreePine,
    title: 'Land Use & Biodiversity',
    description: 'Measure the land footprint of your ingredients and the biodiversity impact of your agricultural supply chain.',
    color: 'hover:border-emerald-400/25',
    accent: 'via-emerald-400/40',
  },
  {
    icon: Recycle,
    title: 'Waste & Circularity',
    description: 'Track packaging recyclability, spent grain diversion, wastewater treatment, and circular economy metrics.',
    color: 'hover:border-amber-400/25',
    accent: 'via-amber-400/40',
  },
  {
    icon: Users,
    title: 'Social Impact',
    description: 'Community engagement, fair trade sourcing, living wages, and social governance indicators for responsible business.',
    color: 'hover:border-pink-400/25',
    accent: 'via-pink-400/40',
  },
  {
    icon: ShieldCheck,
    title: 'Governance & Compliance',
    description: 'Track alignment with ESG frameworks, regulatory requirements, and industry best practices across your organisation.',
    color: 'hover:border-purple-400/25',
    accent: 'via-purple-400/40',
  },
];

const MeasureSection = () => (
  <section className="py-32 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <p className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.3em] mb-4">What We Measure</p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-6">
          Six dimensions of{' '}
          <span className="text-[#ccff00] italic">true impact</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Most platforms stop at carbon. Alkatera measures the full spectrum of environmental, social, and governance impact — because sustainability is about more than emissions.
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
            className={`group relative overflow-hidden backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8 ${item.color} transition-all duration-500`}
          >
            <div className={`absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent ${item.accent} to-transparent opacity-0 group-hover:opacity-100 transition-opacity`} />
            <item.icon className="w-7 h-7 mb-5 text-white/60 group-hover:text-white transition-colors" />
            <h3 className="font-serif text-xl mb-3">{item.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{item.description}</p>
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
  <section className="py-32 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16"
      >
        <p className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.3em] mb-4">How It Works</p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] max-w-3xl">
          From data to{' '}
          <span className="text-[#ccff00] italic">action</span>
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
            <div className="font-mono text-[#ccff00]/20 text-7xl font-bold mb-4">{step.number}</div>
            <step.icon className="w-6 h-6 text-[#ccff00] mb-4" />
            <h3 className="font-serif text-2xl mb-3">{step.title}</h3>
            <p className="text-gray-400 text-sm leading-relaxed">{step.description}</p>
            {i < steps.length - 1 && (
              <ArrowRight className="hidden md:block absolute top-8 -right-4 w-6 h-6 text-white/10" />
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
  <section className="py-32 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <p className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.3em] mb-4">Beyond Carbon</p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-6">
          Carbon is just the{' '}
          <span className="text-[#ccff00] italic">beginning</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          The Green Claims Directive demands evidence-based sustainability communication. Alkatera ensures every claim you make is defensible, verified, and backed by recognised standards.
        </p>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="group relative overflow-hidden rounded-2xl"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop"
              alt="Data visualisation"
              className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h3 className="font-serif text-2xl mb-2">From Spreadsheet to Story</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Transform complex environmental data into visual narratives your customers, retailers, and investors can understand. Data you can finally share with confidence.
            </p>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.15 }}
          className="group relative overflow-hidden rounded-2xl"
        >
          <div className="relative aspect-[16/10] overflow-hidden">
            <img
              src="https://images.unsplash.com/photo-1460925895917-afdab827c52f?q=80&w=2426&auto=format&fit=crop"
              alt="Verified data"
              className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 group-hover:scale-105"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#050505] via-[#050505]/40 to-transparent" />
          </div>
          <div className="absolute bottom-0 left-0 right-0 p-8">
            <h3 className="font-serif text-2xl mb-2">The Glass Box Guarantee</h3>
            <p className="text-gray-400 text-sm leading-relaxed">
              Every metric is backed by verified industry datasets and global standards. When you show an impact number via alkatera, it&apos;s a defensible fact — not a guess.
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
  <section className="py-32 px-6 md:px-10 relative">
    <div className="max-w-6xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="mb-16 text-center"
      >
        <p className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.3em] mb-4">Standards &amp; Frameworks</p>
        <h2 className="font-serif text-4xl md:text-6xl leading-[1.05] mb-6">
          Built on{' '}
          <span className="text-[#ccff00] italic">recognised standards</span>
        </h2>
        <p className="text-gray-400 max-w-2xl mx-auto">
          Every calculation in alkatera is grounded in internationally recognised methodologies and reporting frameworks.
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
            className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl px-6 py-5 hover:border-[#ccff00]/25 transition-all duration-300"
          >
            <div className="font-mono text-sm text-white mb-1">{fw.name}</div>
            <div className="text-gray-500 text-xs leading-relaxed">{fw.desc}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   CTA Section (Neon Yellow)
   ═══════════════════════════════════════════ */

const CTASection = () => (
  <section className="py-40 px-6 md:px-20 bg-[#ccff00] text-black text-center relative overflow-hidden">
    <div className="relative z-10">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
      >
        <Sprout className="w-12 h-12 text-black/70 mx-auto mb-8" />
        <h2 className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-5">
          Start Measuring
          <br />
          What Matters
        </h2>
        <p className="text-black/60 mb-12 font-light text-base max-w-xl mx-auto">
          Join the movement of drinks brands building a regenerative future with data they can trust.
        </p>
        <Link
          href="/getaccess"
          className="inline-flex items-center gap-3 bg-black text-white font-mono text-xs font-medium uppercase tracking-widest px-10 py-5 rounded-full hover:scale-105 transition-transform duration-300"
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
    <div className="relative min-h-screen w-full bg-[#050505] text-white overflow-x-hidden selection:bg-[#ccff00] selection:text-black">
      <Navigation />

      {/* Fixed Background Layer */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0">
          <img
            src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2574&auto=format&fit=crop"
            alt=""
            className="absolute inset-0 w-full h-full object-cover opacity-15 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-[#050505]/80" />
          <div className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
              backgroundSize: '80px 80px'
            }}
          />
        </div>

        {/* Ambient Gradient Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{
              x: [0, 100, -50, 0],
              y: [0, -50, 100, 0],
              scale: [1, 1.2, 0.8, 1],
            }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-[#ccff00] rounded-full opacity-10 blur-[100px]"
          />
          <motion.div
            animate={{
              x: [0, -100, 50, 0],
              y: [0, 100, -50, 0],
            }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] bg-[#00ccff] rounded-full opacity-10 blur-[100px]"
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
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
