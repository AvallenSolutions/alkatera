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
import { Brand } from '@/components/shared/Brand';
import { PLATFORM_FAQ_ITEMS } from '@/marketing/components/platform-faq-data';

/* ═══════════════════════════════════════════
   Hero
   ═══════════════════════════════════════════ */

const Hero = () => (
  <section className="relative min-h-screen w-full overflow-hidden bg-[#ECEAE3] text-[#1A1B1D] flex items-center justify-center pt-20">
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(26,27,29,0.3) 1px, transparent 1px), linear-gradient(90deg, rgba(26,27,29,0.3) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    />
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8 }}
      className="relative z-10 max-w-[900px] mx-auto px-6 text-center"
    >
      <h1 className="font-display font-bold tracking-[-0.035em] text-5xl md:text-[96px] leading-[0.95] mb-8">
        The ecological
        <br />
        <span className="text-[#2B46C0]">intelligence</span> engine.
      </h1>
      <p className="text-lg text-[#6F6F68] max-w-[600px] mx-auto leading-relaxed mb-4">
        The single platform that turns environmental complexity into competitive
        clarity. From carbon to water to biodiversity, measure, report, and
        strategise with confidence.
      </p>
      <p className="font-mono font-bold text-xs text-[#2B46C0] uppercase tracking-[0.22em] mb-12">
        Purpose-built for the drinks industry
      </p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/getaccess"
          className="bg-[#1A1B1D] text-[#F2F1EA] font-mono text-xs font-bold uppercase tracking-[0.22em] px-10 py-4 rounded-full hover:bg-[#2B46C0] transition-colors"
        >
          Get Access
        </Link>
        <a
          href="#process"
          className="border border-[#1A1B1D]/30 text-[#1A1B1D] font-mono text-xs uppercase tracking-[0.22em] px-10 py-4 rounded-full hover:border-[#2B46C0] hover:text-[#2B46C0] transition-all"
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
    desc: "Writing reports is no fun and takes time away from running the business. CSRD, GRI, CDP, the acronyms never stop.",
    icon: ClipboardList,
  },
  {
    title: 'No Direction',
    desc: 'Lots of data but no idea what to do with it or how it can help shape your strategy and drive growth.',
    icon: Compass,
  },
];

const PainPointsSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-[1200px] mx-auto">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
      >
        The Reality
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-14"
      >
        Sound <span className="text-[#BF4B2A]">familiar?</span>
      </motion.h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {painPoints.map((pain, i) => (
          <motion.div
            key={pain.title}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.06 }}
            className="group relative overflow-hidden bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-8 hover:border-[#BF4B2A] transition-all duration-500"
          >
            <div className="w-11 h-11 rounded-[6px] bg-[#BF4B2A]/10 flex items-center justify-center mb-5">
              <pain.icon className="w-5 h-5 text-[#BF4B2A]" />
            </div>
            <h4 className="font-display font-semibold tracking-[-0.02em] text-xl mb-2.5 text-[#BF4B2A]">
              {pain.title}
            </h4>
            <p className="text-sm text-[#6F6F68] leading-relaxed">{pain.desc}</p>
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
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB] relative overflow-hidden">
    <div className="max-w-[1200px] mx-auto relative z-10 text-center">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
      >
        The Answer
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-6"
      >
        One platform. <span className="text-[#2B46C0]">Total clarity.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-[#6F6F68] max-w-[640px] mx-auto leading-relaxed mb-12"
      >
        <Brand /> replaces the spreadsheet chaos, the consultancy invoices, and
        the reporting headaches with a single intelligent platform. We go far
        beyond carbon, measuring water, waste, land use, biodiversity, and
        circularity, so you can build a sustainability programme that&apos;s
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
            className="font-mono text-[11px] uppercase tracking-[0.22em] px-6 py-3 rounded-full bg-[#F2F1EA] border border-[#D9D6CB] text-[#6F6F68] hover:border-[#2B46C0] hover:text-[#2B46C0] transition-all whitespace-nowrap"
          >
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#2B46C0] mr-2.5" />
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
    desc: "We take your raw data and turn the lights on. Our engine organises your inputs against global scientific standards to reveal your brand's true footprint, not just carbon, but water, waste, land use, and biodiversity. We spot the high-impact hotspots that stay hidden in basic calculators.",
    icon: Microscope,
  },
  {
    id: '02',
    title: 'Calculate',
    subtitle: "The 'Glass Box' standard",
    desc: 'Quantify your impact across 10+ environmental categories with absolute confidence. Our transparent "Glass Box" approach means every number is traceable and audit-ready. No black-box guesswork. A verified data foundation that satisfies customers, retailers, and investors.',
    icon: Calculator,
  },
  {
    id: '03',
    title: 'Strategise',
    subtitle: 'Your roadmap to growth',
    desc: 'Move beyond just reporting and start leading. We translate your data into a strategic roadmap, helping you set science-based targets, achieve certifications like B Corp, and turn sustainability from a cost centre into a genuine competitive advantage.',
    icon: Compass,
  },
];

const ProcessSection = () => (
  <section id="process" className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-20">
        <motion.p
          initial={{ opacity: 0, x: -50 }}
          whileInView={{ opacity: 1, x: 0 }}
          viewport={{ once: true }}
          className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
        >
          The Alchemy
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.2 }}
          className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] max-w-3xl"
        >
          From raw data to{' '}
          <span className="text-[#2B46C0]">real impact.</span>
        </motion.h2>
        <div className="border-l-2 border-[#2B46C0] pl-6 mt-6">
          <p className="text-[13px] text-[#6F6F68] max-w-2xl">
            Clarity, not complexity. Action, not ambiguity. Your path to
            environmental leadership, simplified.
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-12 relative">
        <div className="hidden lg:block absolute top-12 left-20 right-20 h-[1px] bg-[#D9D6CB] z-0" />
        {processSteps.map((step, i) => (
          <motion.div
            key={step.id}
            initial={{ opacity: 0, y: 50 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: i * 0.2 }}
            className="relative z-10 group"
          >
            <div className="w-24 h-24 bg-[#F2F1EA] border border-[#D9D6CB] rounded-full flex items-center justify-center mb-7 group-hover:border-[#2B46C0] transition-colors duration-500 relative">
              <step.icon className="w-8 h-8 text-[#1A1B1D] group-hover:text-[#2B46C0] transition-colors" />
              <div className="absolute -top-2 -right-2 w-7 h-7 bg-[#2B46C0] rounded-full flex items-center justify-center text-[#F2F1EA] font-bold font-mono text-[11px]">
                {step.id}
              </div>
            </div>
            <h4 className="font-display font-semibold tracking-[-0.02em] text-2xl mb-1.5 group-hover:text-[#2B46C0] transition-colors">
              {step.title}
            </h4>
            <h5 className="font-mono font-bold text-[10px] uppercase tracking-[0.22em] text-[#6F6F68] mb-6">
              {step.subtitle}
            </h5>
            <p className="text-sm text-[#6F6F68] leading-relaxed border-t border-[#D9D6CB] pt-6 group-hover:border-[#2B46C0]/30 transition-colors">
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
  },
  {
    title: 'Liquid & Packaging Intelligence',
    label: 'Product Environmental Impact',
    desc: "Map the environmental footprint of every SKU you produce. Run 'what-if' scenarios to instantly see how a glass-weight change or a new recipe affects your total ecological score.",
    icon: Layers,
    features: ['SKU-Level LCA', 'What-If Scenarios', 'Recipe Modelling', 'Packaging Optimisation'],
  },
  {
    title: 'The Regulatory Shield',
    label: 'Compliance & Reporting',
    desc: "Say goodbye to regulatory anxiety. Whether you're facing CSRD, the Green Claims Directive, or B Corp certification, generate the verifiable reports you need to stay safe and prove your resilience.",
    icon: ShieldCheck,
    features: ['CSRD', 'GRI', 'CDP', 'B Corp', 'ISO 14001', 'SBTi'],
  },
  {
    title: 'Supply Chain Clarity',
    label: 'Upstream Visibility',
    desc: 'See beyond your own walls. Bridge the data gap by gathering real insights from growers on farming practices and water use. Track your ingredients from the field to the bottle with total confidence.',
    icon: Network,
    features: ['Supplier Engagement', 'Farming Practices', 'Traceability', 'Verification'],
  },
  {
    title: 'Greenwash Guardian',
    label: 'Greenwashing Risk Defence',
    desc: 'Scan your website, marketing materials, and social posts against UK and EU green claims legislation before the regulators do. Get a risk score and actionable fixes for every claim you make.',
    icon: Eye,
    features: ['Website Scanning', 'Document Analysis', 'Risk Scoring', 'UK & EU Law'],
  },
  {
    title: 'Vitality Score',
    label: 'Performance Benchmarking',
    desc: 'Your sustainability health check at a glance. A four-pillar score across Climate, Water, Circularity, and Nature, benchmarked against your industry so you know exactly where you stand and where to focus.',
    icon: Activity,
    features: ['Climate Score', 'Water Score', 'Circularity', 'Nature & Biodiversity'],
  },
];

const ModulesSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-[1200px] mx-auto">
      <div className="text-center mb-16">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
        >
          The Architecture of Impact
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-6"
        >
          Six modules. <span className="text-[#2B46C0]">One platform.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-[#6F6F68] max-w-[640px] mx-auto"
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
            className="group relative overflow-hidden bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] p-10 hover:border-[#2B46C0] transition-all duration-500 min-h-[340px] flex flex-col"
          >
            <div className="relative z-10 flex flex-col flex-grow">
              <div className="w-12 h-12 rounded-[6px] bg-[#1A1B1D]/[0.06] flex items-center justify-center mb-6 group-hover:bg-[#2B46C0] transition-colors duration-300">
                <mod.icon className="w-6 h-6 text-[#1A1B1D] group-hover:text-[#F2F1EA] transition-colors" />
              </div>
              <h3 className="font-display font-semibold tracking-[-0.02em] text-[22px] mb-1.5 group-hover:translate-x-2 transition-transform duration-300">
                {mod.title}
              </h3>
              <p className="font-mono font-bold text-[10px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4">
                {mod.label}
              </p>
              <p className="text-sm text-[#6F6F68] leading-relaxed mb-5 flex-grow">
                {mod.desc}
              </p>
              <div className="flex flex-wrap gap-2">
                {mod.features.map((f) => (
                  <span
                    key={f}
                    className="font-mono text-[10px] px-3 py-1.5 rounded-full bg-transparent border border-[#D9D6CB] text-[#6F6F68] group-hover:border-[#2B46C0]/30 transition-all tracking-wide"
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
    headerBg: 'bg-[#205E40]/10',
    headerColor: 'text-[#205E40]',
    items: [
      { title: 'Climate Change', sub: 'GHG Emissions', icon: Thermometer },
      { title: 'Water Depletion', sub: 'Blue · Green · Grey', icon: Droplets },
      { title: 'Land Use & Biodiversity', sub: 'Ecological Impact', icon: TreePine },
      { title: 'Circularity & Waste', sub: 'Diversion & Recovery', icon: Recycle },
      { title: 'Eutrophication & Acidification', sub: 'Marine & Terrestrial', icon: Sprout },
    ],
  },
  {
    label: 'Social',
    headerIcon: Users,
    headerBg: 'bg-[#2B46C0]/10',
    headerColor: 'text-[#2B46C0]',
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
    headerBg: 'bg-[#DFA32B]/15',
    headerColor: 'text-[#A97C14]',
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
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-[1200px] mx-auto">
      <div className="mb-16">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
        >
          Beyond Carbon
        </motion.p>
        <motion.h2
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-6"
        >
          We measure what <span className="text-[#2B46C0]">matters.</span>
        </motion.h2>
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ delay: 0.1 }}
          className="text-[#6F6F68] max-w-[640px] leading-relaxed"
        >
          While others count carbon alone, <Brand /> quantifies the full picture
          (environmental, social, and governance) because genuine
          sustainability demands all three.
        </motion.p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {measureColumns.map((col) => (
          <div key={col.label}>
            <div className="flex items-center gap-3 mb-6 pb-4 border-b border-[#D9D6CB]">
              <div
                className={cn(
                  'w-9 h-9 rounded-[6px] flex items-center justify-center',
                  col.headerBg
                )}
              >
                <col.headerIcon className={cn('w-[18px] h-[18px]', col.headerColor)} />
              </div>
              <span className="font-mono font-bold text-[11px] uppercase tracking-[0.22em]">
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
                  className="bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] px-5 py-4 flex items-center gap-4 hover:border-[#2B46C0] transition-all"
                >
                  <div className="w-9 h-9 flex-shrink-0 rounded-[6px] bg-[#1A1B1D]/[0.06] flex items-center justify-center">
                    <item.icon className="w-4 h-4 text-[#6F6F68]" />
                  </div>
                  <div>
                    <h5 className="text-[13px] font-medium leading-tight">
                      {item.title}
                    </h5>
                    <span className="font-mono text-[9px] text-[#6F6F68] uppercase tracking-wider">
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
        className="mt-14 text-center font-display font-semibold tracking-[-0.02em] text-xl text-[#6F6F68]"
      >
        Every number traceable. Every calculation{' '}
        <span className="text-[#2B46C0]">audit-ready</span>. ISO
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
    desc: 'Scan your marketing materials, website, and social posts against UK Green Claims Code and EU Green Claims Directive, before the regulators do. Get a risk score and plain-English fixes for every claim.',
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
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-[1200px] mx-auto">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
      >
        Embedded Intelligence
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-6"
      >
        Your sustainability <span className="text-[#2B46C0]">brain trust.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-[#6F6F68] max-w-[640px] leading-relaxed"
      >
        Two embedded tools that turn complex sustainability questions into clear,
        actionable answers, without the consultancy fees.
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
              'rounded-[6px] p-12 transition-all duration-500',
              tool.highlighted
                ? 'bg-[#2B46C0] text-[#F2F1EA]'
                : 'bg-[#F2F1EA] border border-[#D9D6CB] hover:border-[#2B46C0]'
            )}
          >
            <div
              className={cn(
                'inline-flex items-center gap-2 font-mono font-bold text-[10px] uppercase tracking-[0.22em] px-4 py-2 rounded-full border mb-6',
                tool.highlighted
                  ? 'border-[#F2F1EA]/40 text-[#F2F1EA]'
                  : 'border-[#2B46C0]/40 text-[#2B46C0]'
              )}
            >
              <tool.badgeIcon className="w-3.5 h-3.5" />
              {tool.badge}
            </div>
            <h3 className="font-display font-semibold tracking-[-0.02em] text-[28px] mb-3">{tool.title}</h3>
            <p className={cn('text-[15px] leading-relaxed mb-7', tool.highlighted ? 'text-[#F2F1EA]/80' : 'text-[#6F6F68]')}>
              {tool.desc}
            </p>
            <ul className="flex flex-col gap-3">
              {tool.features.map((feat) => (
                <li
                  key={feat}
                  className={cn(
                    'text-[13px] flex items-start gap-3 leading-relaxed',
                    tool.highlighted ? 'text-[#F2F1EA]/80' : 'text-[#6F6F68]'
                  )}
                >
                  <Check className={cn('w-3.5 h-3.5 flex-shrink-0 mt-0.5', tool.highlighted ? 'text-[#F2F1EA]' : 'text-[#2B46C0]')} />
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
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-[1200px] mx-auto text-center">
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
      >
        Certifications &amp; Frameworks
      </motion.p>
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-6"
      >
        Every framework. <span className="text-[#2B46C0]">One place.</span>
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-[#6F6F68] max-w-[640px] mx-auto leading-relaxed mb-14"
      >
        Stop juggling separate tools for each reporting standard. <Brand /> maps
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
            className="bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] px-7 py-4 flex items-center gap-2.5 text-[#6F6F68] hover:border-[#2B46C0] hover:text-[#1A1B1D] hover:-translate-y-0.5 transition-all"
          >
            <span className="w-2 h-2 rounded-full bg-[#2B46C0] opacity-60" />
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
    desc: 'Specific calculations for brewing, distilling, fermentation, and bottling, not generic manufacturing assumptions.',
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
    desc: 'Water-to-product ratios, scarcity-weighted footprints, and source-specific analysis, because water is your primary ingredient.',
    icon: Droplets,
  },
];

const drinksStats = [
  { number: '10+', label: 'Environmental impact categories', sub: 'Beyond carbon alone' },
  { number: '3', label: 'Water footprint types tracked', sub: 'Blue · Green · Grey' },
  { number: '7+', label: 'Reporting frameworks supported', sub: 'B Corp · CSRD · GRI · CDP & more' },
  { number: '∞', label: 'What-if scenarios per product', sub: 'Recipe & packaging modelling' },
];

const DrinksSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB] relative overflow-hidden">
    <div className="max-w-[1200px] mx-auto">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
        <div>
          <motion.p
            initial={{ opacity: 0 }}
            whileInView={{ opacity: 1 }}
            viewport={{ once: true }}
            className="font-mono font-bold text-[11px] text-[#2B46C0] uppercase tracking-[0.22em] mb-4"
          >
            Industry-Specific
          </motion.p>
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-6"
          >
            Built for <span className="text-[#2B46C0]">drinks.</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ delay: 0.1 }}
            className="text-[#6F6F68] max-w-[540px] leading-relaxed mb-10"
          >
            This isn&apos;t a generic sustainability calculator. <Brand /> is
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
                <div className="w-11 h-11 flex-shrink-0 rounded-[6px] bg-[#2B46C0]/[0.08] flex items-center justify-center">
                  <feat.icon className="w-5 h-5 text-[#2B46C0]" />
                </div>
                <div>
                  <h5 className="text-[15px] font-medium mb-1">{feat.title}</h5>
                  <p className="text-[13px] text-[#6F6F68] leading-relaxed">
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
              className="bg-[#F2F1EA] border border-[#D9D6CB] rounded-[6px] px-7 py-6 flex items-center gap-5 hover:border-[#2B46C0] transition-all"
            >
              <span className="font-display font-bold tabular-nums text-4xl text-[#2B46C0] leading-none min-w-[60px]">
                {stat.number}
              </span>
              <div>
                <div className="text-sm text-[#1A1B1D]/80 leading-snug">
                  {stat.label}
                </div>
                <span className="font-mono text-[10px] text-[#6F6F68] uppercase tracking-wider">
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
  <section className="py-40 px-6 md:px-20 bg-[#1A1B1D] text-[#F2F1EA] text-center relative overflow-hidden">
    <div className="relative z-10">
      <motion.h2
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        className="font-display font-bold tracking-[-0.035em] text-4xl md:text-[56px] leading-[0.95] mb-5"
      >
        Ready to turn sustainability
        <br />
        into your competitive edge?
      </motion.h2>
      <motion.p
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ delay: 0.1 }}
        className="text-[#F2F1EA]/60 mb-12 text-base"
      >
        No PhD required. No spreadsheet chaos. Just clarity.
      </motion.p>
      <div className="flex gap-4 justify-center flex-wrap">
        <Link
          href="/getaccess"
          className="bg-[#F2F1EA] text-[#1A1B1D] font-mono text-xs font-bold uppercase tracking-[0.22em] px-10 py-4 rounded-full hover:bg-white transition-colors duration-300"
        >
          Get Access
        </Link>
        <Link
          href="/manifesto"
          className="border border-[#F2F1EA]/30 text-[#F2F1EA] font-mono text-xs uppercase tracking-[0.22em] px-10 py-4 rounded-full hover:border-[#F2F1EA] hover:bg-[#F2F1EA]/5 transition-all"
        >
          Read Our Manifesto
        </Link>
      </div>
      <motion.p
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ delay: 0.3 }}
        className="font-mono text-[11px] text-[#F2F1EA]/50 mt-6 tracking-wider"
      >
        Start with Seed from &pound;99/month. No long-term contracts.
      </motion.p>
    </div>
  </section>
);

/* ═══════════════════════════════════════════
   Main Page Component
   ═══════════════════════════════════════════ */

/* ═══════════════════════════════════════════
   FAQ — visible text mirrors the FAQPage JSON-LD in app/platform/page.tsx
   (shared via platform-faq-data.ts) so structured data never drifts from copy.
   ═══════════════════════════════════════════ */

const FaqSection = () => (
  <section className="py-28 px-6 md:px-10 border-t border-[#D9D6CB]">
    <div className="max-w-3xl mx-auto">
      <h2 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-5xl mb-12">Frequently asked questions.</h2>
      <div className="space-y-8">
        {PLATFORM_FAQ_ITEMS.map((item) => (
          <div key={item.question} className="border-b border-[#D9D6CB] pb-8 last:border-0">
            <h3 className="font-display text-xl font-semibold text-[#1A1B1D] mb-3">{item.question}</h3>
            <p className="text-[#1A1B1D]/80 leading-relaxed">{item.answer}</p>
          </div>
        ))}
      </div>
    </div>
  </section>
);

export function PlatformPageClient() {
  return (
    <div className="bg-[#ECEAE3] min-h-screen text-[#1A1B1D] selection:bg-[#1A1B1D] selection:text-[#F2F1EA] relative">
      {/* Fixed background texture */}
      <div className="fixed inset-0 z-0 pointer-events-none">
        <img
          src="https://images.unsplash.com/photo-1511497584788-876760111969?q=80&w=2832&auto=format&fit=crop"
          alt=""
          className="w-full h-full object-cover opacity-10 mix-blend-multiply grayscale"
        />

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
        <FaqSection />
        <CTASection />
        <Footer />
      </div>
    </div>
  );
}
