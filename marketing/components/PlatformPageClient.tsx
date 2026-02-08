'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import {
  Check,
  FileText,
  FlaskConical,
  EyeOff,
  Network,
  ClipboardList,
  Compass,
  Footprints,
  Layers,
  ShieldCheck,
  Eye,
  Activity,
  Thermometer,
  Droplets,
  TreePine,
  Recycle,
  Sprout,
  UserPlus,
  Users,
  Heart,
  BookOpen,
  Gift,
  Briefcase,
  Shield,
  Globe,
  BarChart3,
  Building2,
  MessageCircle,
  Package,
  Microscope,
  Calculator,
  Leaf,
} from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { cn } from '@/lib/utils';

/* ═══════════════════════════════════════════
   Hero
   ═══════════════════════════════════════════ */

const Hero = () => (
  <section className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-[#f0f0f0] flex items-center justify-center pt-20">
    <div
      className="absolute inset-0 opacity-[0.06]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    />
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="relative z-10 max-w-[900px] mx-auto px-6 text-center"
    >
      <h1 className="font-serif text-5xl md:text-[96px] leading-[0.95] mb-8">
        The Ecological
        <br />
        <span className="text-[#ccff00] italic">Intelligence</span> Engine
      </h1>
      <p className="text-lg text-gray-400 max-w-[600px] mx-auto leading-relaxed font-light mb-4">
        The single platform that turns environmental complexity into competitive
        clarity. From carbon to water to biodiversity — measure, report, and
        strategise with confidence.
      </p>
      <p className="font-mono text-xs text-[#ccff00] uppercase tracking-[4px] mb-12 opacity-80">
        Purpose-built for the drinks industry
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/getaccess"
          className="bg-[#ccff00] text-black font-mono text-xs font-medium uppercase tracking-widest px-10 py-4 rounded-full hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(204,255,0,0.3)] transition-all"
        >
          Get Access
        </Link>
        <a
          href="#process"
          className="border border-white/10 text-white font-mono text-xs uppercase tracking-widest px-10 py-4 rounded-full hover:border-[#ccff00] hover:text-[#ccff00] transition-all"
        >
          See How It Works
        </a>
      </div>
    </motion.div>
  </section>
);

/* ═══════════════════════════════════════════
   Pain Points
   ═══════════════════════════════════════════ */

const painPoints = [
  {
    title: 'Data Chaos',
    desc: "Your sustainability data is spread across spreadsheets, filing systems, and months-old emails. Nobody knows what's current.",
    icon: FileText,
  },
  {
    title: 'Complexity',
    desc: "LCA methodology needs a PhD to calculate. What is Scope 3 Category 8 anyway? The science shouldn't need a scientist.",
    icon: FlaskConical,
  },
  {
    title: 'Greenwashing Risk',
    desc: "You're green-hushing because you don't want to be accused of greenwashing. Your good work stays invisible.",
    icon: EyeOff,
  },
  {
    title: 'Blind Supply Chain',
    desc: "No idea of the real impact of your suppliers or whether they're aligned with your sustainability mission.",
    icon: Network,
  },
  {
    title: 'Reporting Burden',
    desc: "Writing reports is no fun and takes time away from running the business. CSRD, GRI, CDP — the acronyms never stop.",
    icon: ClipboardList,
  },
  {
    title: 'No Direction',
    desc: 'Lots of data but no idea what to do with it or how it can help shape your strategy and drive growth.',
    icon: Compass,
  },
];

const PainPointsSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06]">
    <div className="max-w-[1200px] mx-auto">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
      >
        The Reality
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-14"
      >
        Sound <span className="italic text-gray-500">familiar?</span>
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {painPoints.map((pain, i) => (
          <motion.div
            key={pain.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="group relative overflow-hidden backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-8 hover:border-red-400/25 transition-all duration-500"
          >
            <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-400/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
            <div className="w-11 h-11 rounded-xl bg-red-400/10 flex items-center justify-center mb-5">
              <pain.icon className="w-5 h-5 text-red-300/80" />
            </div>
            <h4 className="font-serif text-xl mb-2.5 text-red-300/90">
              {pain.title}
            </h4>
            <p className="text-sm text-gray-500 leading-relaxed">{pain.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Solution Overview
   ═══════════════════════════════════════════ */

const solutionBadges = [
  '10+ Impact Categories',
  'ISO 14044 Compliant',
  'CSRD Ready',
  'B Corp Aligned',
  'Full ESG Coverage',
  'Audit-Ready Reports',
];

const SolutionOverview = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06] relative overflow-hidden">
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[radial-gradient(circle,_rgba(204,255,0,0.04),_transparent_70%)] pointer-events-none" />
    <div className="max-w-[1200px] mx-auto relative z-10 text-center">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
      >
        The Answer
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-6"
      >
        One Platform. <span className="text-[#ccff00]">Total Clarity.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-gray-400 max-w-[640px] mx-auto leading-relaxed font-light mb-12"
      >
        Alkatera replaces the spreadsheet chaos, the consultancy invoices, and
        the reporting headaches with a single intelligent platform. We go far
        beyond carbon — measuring water, waste, land use, biodiversity, and
        circularity — so you can build a sustainability programme that&apos;s
        genuinely defensible.
      </motion.p>
      <div className="flex flex-wrap justify-center gap-4">
        {solutionBadges.map((badge, i) => (
          <motion.div
            key={badge}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="font-mono text-[11px] uppercase tracking-widest px-6 py-3 rounded-full backdrop-blur-md bg-white/5 border border-white/10 text-gray-400 hover:border-[#ccff00] hover:text-[#ccff00] transition-all whitespace-nowrap"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#ccff00] mr-2.5" />
            {badge}
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   The Alchemy (Process)
   ═══════════════════════════════════════════ */

const processSteps = [
  {
    id: '01',
    title: 'Analyse',
    subtitle: 'Total visibility, zero guesswork',
    desc: "We take your raw data and turn the lights on. Our engine organises your inputs against global scientific standards to reveal your brand's true footprint — not just carbon, but water, waste, land use, and biodiversity. We spot the high-impact hotspots that stay hidden in basic calculators.",
    icon: Microscope,
  },
  {
    id: '02',
    title: 'Calculate',
    subtitle: "The 'Glass Box' standard",
    desc: 'Quantify your impact across 10+ environmental categories with absolute confidence. Our transparent "Glass Box" approach means every number is traceable and audit-ready. No black-box guesswork — a verified data foundation that satisfies customers, retailers, and investors.',
    icon: Calculator,
  },
  {
    id: '03',
    title: 'Strategise',
    subtitle: 'Your roadmap to growth',
    desc: 'Move beyond just reporting and start leading. We translate your data into a strategic roadmap — helping you set science-based targets, achieve certifications like B Corp, and turn sustainability from a cost centre into a genuine competitive advantage.',
    icon: Compass,
  },
];

const ProcessSection = () => (
  <section id="process" className="py-28 px-6 md:px-10 border-t border-white/[0.06]">
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-20">
        <motion.p
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
        >
          The Alchemy
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="font-serif text-4xl md:text-[56px] leading-[1.1] max-w-3xl"
        >
          From Raw Data to{' '}
          <span className="italic text-gray-500">Real Impact</span>
        </motion.h2>
        <div className="border-l-2 border-[#ccff00] pl-6 mt-6">
          <p className="font-mono text-[13px] text-gray-400 max-w-2xl tracking-wide">
            Clarity, not complexity. Action, not ambiguity. Your path to
            environmental leadership, simplified.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
        <div className="hidden lg:block absolute top-12 left-20 right-20 h-[1px] bg-gradient-to-r from-transparent via-[#ccff00]/30 to-transparent z-0" />
        {processSteps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="relative z-10 group"
          >
            <div className="w-24 h-24 backdrop-blur-md bg-white/5 border border-white/10 rounded-full flex items-center justify-center mb-7 group-hover:border-[#ccff00] transition-colors duration-500 relative">
              <step.icon className="w-8 h-8 text-white group-hover:text-[#ccff00] transition-colors" />
              <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#ccff00] rounded-full flex items-center justify-center text-black font-bold font-mono text-[11px]">
                {step.id}
              </div>
            </div>
            <h4 className="font-serif text-2xl mb-1.5 group-hover:text-[#ccff00] transition-colors">
              {step.title}
            </h4>
            <h5 className="font-mono text-[10px] uppercase tracking-[3px] text-gray-500 mb-6">
              {step.subtitle}
            </h5>
            <p className="text-sm text-gray-400 leading-relaxed border-t border-white/10 pt-6 group-hover:border-[#ccff00]/20 transition-colors">
              {step.desc}
            </p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Six Modules
   ═══════════════════════════════════════════ */

const modules = [
  {
    title: 'Full Operational Clarity',
    label: 'Corporate Footprinting',
    desc: 'One dashboard for your entire business. Automate the tracking of your Scope 1, 2, and 3 emissions alongside water and waste, with a holistic, audit-ready view from the office to the production floor.',
    icon: Footprints,
    features: ['Scope 1, 2 & 3', 'Facilities', 'Fleet', 'Water & Waste', 'Production Data'],
    gradient: 'from-emerald-500/[0.06]',
  },
  {
    title: 'Liquid & Packaging Intelligence',
    label: 'Product Environmental Impact',
    desc: "Map the environmental footprint of every SKU you produce. Run 'what-if' scenarios to instantly see how a glass-weight change or a new recipe affects your total ecological score.",
    icon: Layers,
    features: ['SKU-Level LCA', 'What-If Scenarios', 'Recipe Modelling', 'Packaging Optimisation'],
    gradient: 'from-blue-500/[0.06]',
  },
  {
    title: 'The Regulatory Shield',
    label: 'Compliance & Reporting',
    desc: "Say goodbye to regulatory anxiety. Whether you're facing CSRD, the Green Claims Directive, or B Corp certification, generate the verifiable reports you need to stay safe and prove your resilience.",
    icon: ShieldCheck,
    features: ['CSRD', 'GRI', 'CDP', 'B Corp', 'ISO 14001', 'SBTi'],
    gradient: 'from-yellow-500/[0.06]',
  },
  {
    title: 'Supply Chain Clarity',
    label: 'Upstream Visibility',
    desc: 'See beyond your own walls. Bridge the data gap by gathering real insights from growers on farming practices and water use. Track your ingredients from the field to the bottle with total confidence.',
    icon: Network,
    features: ['Supplier Engagement', 'Farming Practices', 'Traceability', 'Verification'],
    gradient: 'from-purple-500/[0.06]',
  },
  {
    title: 'Greenwash Guardian',
    label: 'Greenwashing Risk Defence',
    desc: 'Scan your website, marketing materials, and social posts against UK and EU green claims legislation before the regulators do. Get a risk score and actionable fixes for every claim you make.',
    icon: Eye,
    features: ['Website Scanning', 'Document Analysis', 'Risk Scoring', 'UK & EU Law'],
    gradient: 'from-red-500/[0.06]',
  },
  {
    title: 'Vitality Score',
    label: 'Performance Benchmarking',
    desc: 'Your sustainability health check at a glance. A four-pillar score across Climate, Water, Circularity, and Nature — benchmarked against your industry so you know exactly where you stand and where to focus.',
    icon: Activity,
    features: ['Climate Score', 'Water Score', 'Circularity', 'Nature & Biodiversity'],
    gradient: 'from-cyan-500/[0.06]',
  },
];

const ModulesSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06]">
    <div className="max-w-[1200px] mx-auto">
      <div className="text-center mb-16">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
        >
          The Architecture of Impact
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-6"
        >
          Six Modules. <span className="text-[#ccff00]">One Platform.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 max-w-[640px] mx-auto font-light"
        >
          Each module works independently or together, giving you the flexibility
          to build your sustainability programme at your own pace. Start where it
          matters most.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {modules.map((mod, i) => (
          <motion.div
            key={mod.title}
            initial={{ opacity: 0, scale: 0.95 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.08 }}
            className="group relative overflow-hidden backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-10 hover:border-[#ccff00]/30 transition-all duration-500 min-h-[340px] flex flex-col"
          >
            <div
              className={cn(
                'absolute inset-0 bg-gradient-to-br to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500',
                mod.gradient
              )}
            />
            <div className="relative z-10 flex flex-col flex-grow">
              <div className="w-12 h-12 rounded-xl bg-white/[0.06] flex items-center justify-center mb-6 group-hover:bg-[#ccff00] transition-colors duration-300">
                <mod.icon className="w-6 h-6 text-white group-hover:text-black transition-colors" />
              </div>
              <h3 className="font-serif text-[22px] mb-1.5 group-hover:translate-x-2 transition-transform duration-300">
                {mod.title}
              </h3>
              <p className="font-mono text-[10px] text-[#ccff00] uppercase tracking-[3px] mb-4">
                {mod.label}
              </p>
              <p className="text-sm text-gray-400 leading-relaxed mb-5 flex-grow">
                {mod.desc}
              </p>
              <div className="flex flex-wrap gap-2">
                {mod.features.map((f) => (
                  <span
                    key={f}
                    className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-white/[0.04] border border-white/[0.08] text-gray-500 group-hover:border-[#ccff00]/15 group-hover:text-gray-400 transition-all tracking-wide"
                  >
                    {f}
                  </span>
                ))}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   We Measure What Matters (E + S + G)
   ═══════════════════════════════════════════ */

const measureColumns = [
  {
    label: 'Environmental',
    headerIcon: Leaf,
    headerBg: 'bg-emerald-400/15',
    headerColor: 'text-emerald-400',
    items: [
      { title: 'Climate Change', sub: 'GHG Emissions', icon: Thermometer },
      { title: 'Water Depletion', sub: 'Blue \u00b7 Green \u00b7 Grey', icon: Droplets },
      { title: 'Land Use & Biodiversity', sub: 'Ecological Impact', icon: TreePine },
      { title: 'Circularity & Waste', sub: 'Diversion & Recovery', icon: Recycle },
      { title: 'Eutrophication & Acidification', sub: 'Marine & Terrestrial', icon: Sprout },
    ],
  },
  {
    label: 'Social',
    headerIcon: Users,
    headerBg: 'bg-blue-400/15',
    headerColor: 'text-blue-400',
    items: [
      { title: 'People & Culture', sub: 'Fair Work & Wellbeing', icon: UserPlus },
      { title: 'Diversity & Inclusion', sub: 'Workforce Equity', icon: Users },
      { title: 'Community Impact', sub: 'Local & Charitable', icon: Heart },
      { title: 'Training & Development', sub: 'Skills & Growth', icon: BookOpen },
      { title: 'Volunteering & Giving', sub: 'Social Value', icon: Gift },
    ],
  },
  {
    label: 'Governance',
    headerIcon: Building2,
    headerBg: 'bg-purple-400/15',
    headerColor: 'text-purple-400',
    items: [
      { title: 'Board Composition', sub: 'Leadership Structure', icon: Briefcase },
      { title: 'Policy Management', sub: 'Standards & Procedures', icon: FileText },
      { title: 'Ethics & Transparency', sub: 'Accountability', icon: Shield },
      { title: 'Stakeholder Engagement', sub: 'Partnerships', icon: Globe },
      { title: 'Governance Scoring', sub: 'Maturity Assessment', icon: BarChart3 },
    ],
  },
];

const MeasureSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06]">
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-16">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
        >
          Beyond Carbon
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-6"
        >
          We Measure What <span className="text-[#ccff00]">Matters</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-gray-400 max-w-[640px] leading-relaxed font-light"
        >
          While others count carbon alone, Alkatera quantifies the full picture
          — environmental, social, and governance — because genuine
          sustainability demands all three.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {measureColumns.map((col) => (
          <div key={col.label}>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-white/10">
              <div
                className={cn(
                  'w-9 h-9 rounded-[10px] flex items-center justify-center',
                  col.headerBg
                )}
              >
                <col.headerIcon className={cn('w-[18px] h-[18px]', col.headerColor)} />
              </div>
              <span className="font-mono text-[11px] uppercase tracking-widest">
                {col.label}
              </span>
            </div>
            <div className="flex flex-col gap-3">
              {col.items.map((item, j) => (
                <motion.div
                  key={item.title}
                  initial={{ opacity: 0, y: 15 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  viewport={{ once: true }}
                  transition={{ delay: j * 0.05 }}
                  className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl px-5 py-4 flex items-center gap-4 hover:border-[#ccff00]/25 transition-all"
                >
                  <div className="w-9 h-9 flex-shrink-0 rounded-[10px] bg-white/[0.06] flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-gray-400" />
                  </div>
                  <div>
                    <h5 className="text-[13px] font-medium leading-tight">
                      {item.title}
                    </h5>
                    <span className="font-mono text-[9px] text-gray-500 uppercase tracking-wider">
                      {item.sub}
                    </span>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="mt-14 text-center font-serif text-xl text-gray-500 italic"
      >
        Every number traceable. Every calculation{' '}
        <span className="text-[#ccff00] not-italic">audit-ready</span>. ISO
        14044 compliant.
      </motion.p>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Embedded Intelligence (no AI language)
   ═══════════════════════════════════════════ */

const intelligenceTools = [
  {
    badge: 'Rosa',
    badgeIcon: MessageCircle,
    title: 'Your Sustainability Guide',
    desc: 'Instant, expert answers on GHG Protocol, SBTi, CSRD, water stewardship, circular economy, and more. Rosa translates complex sustainability science into plain language your whole team can use.',
    features: [
      'Covers 12+ sustainability frameworks and standards',
      'Drinks industry-specific guidance',
      'Data visualisations and actionable recommendations',
      'Always learning, always up to date',
    ],
    highlighted: true,
  },
  {
    badge: 'Greenwash Guardian',
    badgeIcon: Eye,
    title: 'Your Claims Defence System',
    desc: 'Scan your marketing materials, website, and social posts against UK Green Claims Code and EU Green Claims Directive — before the regulators do. Get a risk score and plain-English fixes for every claim.',
    features: [
      'Scans websites, PDFs, social posts, and documents',
      'Checks against UK CMA and EU legislation',
      'Claim-by-claim risk scoring with suggested rewrites',
      'Bulk URL scanning for full site audits',
    ],
    highlighted: false,
  },
];

const IntelligenceSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06]">
    <div className="max-w-[1200px] mx-auto">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
      >
        Embedded Intelligence
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-6"
      >
        Your Sustainability <span className="text-[#ccff00]">Brain Trust</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-gray-400 max-w-[640px] leading-relaxed font-light"
      >
        Two embedded tools that turn complex sustainability questions into clear,
        actionable answers — without the consultancy fees.
      </motion.p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-14">
        {intelligenceTools.map((tool, i) => (
          <motion.div
            key={tool.badge}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.15 }}
            className={cn(
              'backdrop-blur-md rounded-2xl p-12 transition-all duration-500',
              tool.highlighted
                ? 'bg-[#ccff00]/5 border border-[#ccff00]/15 hover:border-[#ccff00]/30'
                : 'bg-white/5 border border-white/10 hover:border-[#ccff00]/30'
            )}
          >
            <div className="inline-flex items-center gap-2 font-mono text-[10px] uppercase tracking-widest px-4 py-2 rounded-full border border-[#ccff00]/20 text-[#ccff00] mb-6">
              <tool.badgeIcon className="w-3.5 h-3.5" />
              {tool.badge}
            </div>
            <h3 className="font-serif text-[28px] mb-3">{tool.title}</h3>
            <p className="text-[15px] text-gray-400 leading-relaxed mb-7">
              {tool.desc}
            </p>
            <ul className="flex flex-col gap-3">
              {tool.features.map((feat) => (
                <li
                  key={feat}
                  className="text-[13px] text-gray-400 flex items-start gap-3 leading-relaxed"
                >
                  <Check className="w-3.5 h-3.5 text-[#ccff00] flex-shrink-0 mt-0.5" />
                  {feat}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Certifications & Frameworks
   ═══════════════════════════════════════════ */

const frameworks = [
  'B Corp Certification',
  'CDP Climate Change',
  'CSRD',
  'GRI Standards',
  'ISO 14001',
  'ISO 50001',
  'ISO 14044',
  'SBTi Targets',
  'Green Claims Directive',
  'TCFD',
];

const FrameworksSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06]">
    <div className="max-w-[1200px] mx-auto text-center">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
      >
        Certifications &amp; Frameworks
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-6"
      >
        Every Framework. <span className="text-[#ccff00]">One Place.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-gray-400 max-w-[640px] mx-auto leading-relaxed font-light mb-14"
      >
        Stop juggling separate tools for each reporting standard. Alkatera maps
        your data to every major framework automatically.
      </motion.p>
      <div className="flex flex-wrap justify-center gap-4">
        {frameworks.map((fw, i) => (
          <motion.div
            key={fw}
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.04 }}
            className="backdrop-blur-md bg-white/5 border border-white/10 rounded-xl px-7 py-4 flex items-center gap-2.5 text-gray-400 hover:border-[#ccff00]/30 hover:text-white hover:-translate-y-0.5 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-[#ccff00] opacity-60" />
            <span className="text-sm font-medium">{fw}</span>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Built for Drinks
   ═══════════════════════════════════════════ */

const drinksFeatures = [
  {
    title: 'Process Modelling',
    desc: 'Specific calculations for brewing, distilling, fermentation, and bottling — not generic manufacturing assumptions.',
    icon: FlaskConical,
  },
  {
    title: 'Ingredient Traceability',
    desc: 'Track every ingredient from its agricultural source through to the final product, with real supplier data.',
    icon: Sprout,
  },
  {
    title: 'Packaging Optimisation',
    desc: 'Model glass weight changes, material alternatives, and format shifts to find the sweet spot between impact and brand prestige.',
    icon: Package,
  },
  {
    title: 'Water Intelligence',
    desc: 'Water-to-product ratios, scarcity-weighted footprints, and source-specific analysis — because water is your primary ingredient.',
    icon: Droplets,
  },
];

const drinksStats = [
  { number: '10+', label: 'Environmental impact categories', sub: 'Beyond carbon alone' },
  { number: '3', label: 'Water footprint types tracked', sub: 'Blue \u00b7 Green \u00b7 Grey' },
  { number: '7+', label: 'Reporting frameworks supported', sub: 'B Corp \u00b7 CSRD \u00b7 GRI \u00b7 CDP & more' },
  { number: '\u221e', label: 'What-if scenarios per product', sub: 'Recipe & packaging modelling' },
];

const DrinksSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-white/[0.06] relative overflow-hidden">
    <div className="max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-mono text-[11px] text-[#ccff00] uppercase tracking-[4px] mb-4"
          >
            Industry-Specific
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-6"
          >
            Built for <span className="text-[#ccff00]">Drinks</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 max-w-[540px] leading-relaxed font-light mb-10"
          >
            This isn&apos;t a generic sustainability calculator. Alkatera is
            engineered from the ground up for the unique science, supply chains,
            and processes of the drinks industry.
          </motion.p>
          <div className="flex flex-col gap-5">
            {drinksFeatures.map((feat, i) => (
              <motion.div
                key={feat.title}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.1 }}
                className="flex gap-4 items-start"
              >
                <div className="w-11 h-11 flex-shrink-0 rounded-xl bg-[#ccff00]/[0.08] flex items-center justify-center">
                  <feat.icon className="w-5 h-5 text-[#ccff00]" />
                </div>
                <div>
                  <h5 className="text-[15px] font-medium mb-1">{feat.title}</h5>
                  <p className="text-[13px] text-gray-500 leading-relaxed">
                    {feat.desc}
                  </p>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-4">
          {drinksStats.map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              className="backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl px-7 py-6 flex items-center gap-5 hover:border-[#ccff00]/25 transition-all"
            >
              <span className="font-serif text-4xl text-[#ccff00] leading-none min-w-[60px]">
                {stat.number}
              </span>
              <div>
                <div className="text-sm text-gray-400 leading-snug">
                  {stat.label}
                </div>
                <span className="font-mono text-[10px] text-gray-500 uppercase tracking-wider">
                  {stat.sub}
                </span>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   CTA
   ═══════════════════════════════════════════ */

const CTASection = () => (
  <section className="py-40 px-6 md:px-20 bg-[#ccff00] text-black text-center relative overflow-hidden">
    <div className="relative z-10">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-serif text-4xl md:text-[56px] leading-[1.1] mb-5"
      >
        Ready to Turn Sustainability
        <br />
        Into Your Competitive Edge?
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-black/60 mb-12 font-light text-base"
      >
        No PhD required. No spreadsheet chaos. Just clarity.
      </motion.p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/getaccess"
          className="bg-black text-white font-mono text-xs font-medium uppercase tracking-widest px-10 py-4 rounded-full hover:scale-105 transition-transform duration-300"
        >
          Get Access
        </Link>
        <Link
          href="/manifesto"
          className="border border-black/30 text-black font-mono text-xs uppercase tracking-widest px-10 py-4 rounded-full hover:border-black hover:bg-black/5 transition-all"
        >
          Read Our Manifesto
        </Link>
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="font-mono text-[11px] text-black/50 mt-6 tracking-wider"
      >
        Start with Seed from &pound;99/month. No long-term contracts.
      </motion.p>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════ */

export function PlatformPageClient() {
  return (
    <div className="bg-[#050505] min-h-screen text-white selection:bg-[#ccff00] selection:text-black relative">
      {/* Fixed background for glassmorphism */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2832&auto=format&fit=crop"
          alt=""
          className="w-full h-full object-cover opacity-20 mix-blend-overlay"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#050505]/60 to-[#050505]" />

        {/* Ambient Gradient Blobs */}
        <div className="absolute inset-0 overflow-hidden">
          <motion.div
            animate={{ x: [0, 100, -50, 0], y: [0, -50, 100, 0], scale: [1, 1.2, 0.8, 1] }}
            transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
            className="absolute top-[20%] left-[10%] w-[500px] h-[500px] bg-[#ccff00] rounded-full opacity-10 blur-[100px]"
          />
          <motion.div
            animate={{ x: [0, -100, 50, 0], y: [0, 100, -50, 0] }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
            className="absolute bottom-[10%] right-[15%] w-[600px] h-[600px] bg-[#00ccff] rounded-full opacity-10 blur-[100px]"
          />
        </div>

        {/* Noise texture overlay */}
        <div className="absolute inset-0 opacity-[0.03]" style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.5'/%3E%3C/svg%3E")`
        }} />
      </div>

      <div className="relative z-10">
        <Navigation />
        <Hero />
        <PainPointsSection />
        <SolutionOverview />
        <ProcessSection />
        <ModulesSection />
        <MeasureSection />
        <IntelligenceSection />
        <FrameworksSection />
        <DrinksSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
