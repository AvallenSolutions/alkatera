'use client';

import { motion } from 'framer-motion';
import Link from 'next/link';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import {
  ClipboardList,
  Leaf,
  Globe,
  ShieldCheck,
  Check,
} from 'lucide-react';

/* ─── Fade-up animation helper ─────────────────────────── */
const fadeUp = (delay = 0) => ({
  initial: { opacity: 0, y: 28 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true },
  transition: { duration: 0.7, delay, ease: [0.22, 1, 0.36, 1] },
});

/* ─── alkatera brand name: alka + bold neon tera ────────── */
const AT = ({ dark = false }: { dark?: boolean }) => (
  <span className={dark ? 'text-black' : 'text-[#f0f0f0]'}>
    alka<strong className="text-[#ccff00]">tera</strong>
  </span>
);

/* ─── Section label (green mono eyebrow) ───────────────── */
const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <p className="font-mono text-[#ccff00] text-xs tracking-[0.22em] uppercase mb-4">
    {children}
  </p>
);

/* ═══════════════════════════════════════════════════
   HERO
   ═══════════════════════════════════════════════════ */
const Hero = () => (
  <section className="relative min-h-screen w-full overflow-hidden bg-[#050505] text-[#f0f0f0] flex items-center pt-20">
    <div
      className="absolute inset-0 opacity-[0.05]"
      style={{
        backgroundImage:
          'linear-gradient(rgba(255,255,255,0.4) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.4) 1px, transparent 1px)',
        backgroundSize: '40px 40px',
      }}
    />

    <div className="relative z-10 max-w-7xl mx-auto px-6 md:px-20 w-full py-20">
      <motion.div {...fadeUp(0)}>
        <SectionLabel>For Ingredient, Packaging &amp; Service Suppliers</SectionLabel>
      </motion.div>

      <motion.h1
        {...fadeUp(0.1)}
        className="font-serif text-6xl md:text-[100px] leading-[0.92] tracking-tight mb-10 max-w-4xl"
      >
        Your sustainability story,{' '}
        <span className="italic text-[#ccff00]">finally told.</span>
      </motion.h1>

      <motion.p
        {...fadeUp(0.2)}
        className="font-mono text-sm text-gray-400 max-w-2xl leading-relaxed border-l-2 border-[#ccff00] pl-5 mb-14"
      >
        The drinks brands you work with are under mounting pressure to prove the environmental
        credentials of everything they source. <AT /> connects you directly to those brands,
        turning your verified impact data into a commercial advantage that opens doors.
      </motion.p>

      <motion.div
        {...fadeUp(0.3)}
        className="flex flex-wrap gap-px border border-white/10 w-fit mb-14"
      >
        {[
          { value: '55%', label: 'of consumer goods growth driven by sustainable products' },
          { value: '2026', label: 'CSRD Scope 3 reporting mandatory for large EU companies' },
          { value: 'Free', label: 'to register as a verified supplier on the network' },
        ].map((stat) => (
          <div
            key={stat.value}
            className="bg-[#050505] border-r border-white/10 last:border-r-0 px-8 py-6 flex flex-col min-w-[180px]"
          >
            <span className="font-serif text-5xl text-[#ccff00] leading-none mb-3">
              {stat.value}
            </span>
            <span className="font-mono text-xs text-gray-500 leading-relaxed max-w-[170px]">
              {stat.label}
            </span>
          </div>
        ))}
      </motion.div>

      <motion.div {...fadeUp(0.4)} className="flex gap-4 flex-wrap">
        <Link
          href="/getaccess"
          className="bg-[#ccff00] text-black font-mono text-xs font-bold uppercase tracking-widest px-10 py-4 rounded-full hover:-translate-y-0.5 hover:shadow-[0_8px_30px_rgba(204,255,0,0.3)] transition-all"
        >
          Join the Network
        </Link>
        <Link
          href="mailto:hello@alkatera.com"
          className="border border-white/30 text-white font-mono text-xs uppercase tracking-widest px-10 py-4 rounded-full hover:border-[#ccff00] hover:text-[#ccff00] transition-all"
        >
          Speak with Us
        </Link>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   CHALLENGE
   ═══════════════════════════════════════════════════ */
type ChallengeItem = {
  icon: React.ElementType;
  title: string;
  body: React.ReactNode;
};

const challenges: ChallengeItem[] = [
  {
    icon: ClipboardList,
    title: 'Procurement has changed',
    body: "Buyers now score suppliers on environmental credentials alongside price and quality. Without verified impact data, you risk being invisible on the shortlist, even when your practices are exemplary.",
  },
  {
    icon: ShieldCheck,
    title: 'Regulations are accelerating',
    body: "CSRD, GRI, and B Corp requirements oblige your customers to report their full Scope 3 supply chain footprint. They need your verified data to comply, and they need it now.",
  },
  {
    icon: Globe,
    title: "Spreadsheets don't scale",
    body: "Answering sustainability questionnaires from ten different customers via email and PDFs is time-consuming and error-prone. A single, verified source of truth serves everyone faster.",
  },
  {
    icon: Leaf,
    title: 'Your hard work goes unnoticed',
    body: <>Regenerative farming, reduced packaging, cleaner logistics. You&apos;re already doing the difficult work. <AT /> makes sure the right buyers actually see it, with data they can trust.</>,
  },
];

const Challenge = () => (
  <section className="py-20 px-6 md:px-20 bg-[#050505] border-t border-white/10">
    <div className="max-w-7xl mx-auto">
      <motion.div {...fadeUp(0)}>
        <SectionLabel>The Challenge</SectionLabel>
        <h2 className="font-serif text-4xl md:text-6xl leading-tight mb-12 max-w-2xl">
          Brands can&apos;t buy what they{' '}
          <span className="italic text-gray-500">can&apos;t verify.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-white/10 border border-white/10">
        {challenges.map((c, i) => (
          <motion.div
            key={c.title}
            {...fadeUp(i * 0.08)}
            className="bg-[#050505] p-10 group hover:bg-white/[0.03] transition-colors"
          >
            <c.icon className="w-6 h-6 text-[#ccff00] mb-6 opacity-80" />
            <h3 className="font-mono text-xs uppercase tracking-widest text-white mb-4">
              {c.title}
            </h3>
            <p className="font-mono text-sm text-gray-500 leading-relaxed">{c.body}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   BENEFITS
   ═══════════════════════════════════════════════════ */
type Benefit = {
  num: string;
  title: string;
  desc: React.ReactNode;
  tags: string[];
};

const benefits: Benefit[] = [
  {
    num: '01',
    title: 'A verified supplier profile',
    desc: <>Your sustainability credentials, carbon footprint, water use, land impact, waste diversion, certifications, presented in a standardised, trusted format that drinks brands can pull directly into their own reporting. No ambiguity. No spreadsheet ping-pong.</>,
    tags: ['Carbon', 'Water', 'Land', 'Biodiversity'],
  },
  {
    num: '02',
    title: 'Product passports for every SKU',
    desc: "Each ingredient or material you supply gets a traceable product passport. A living digital record that travels through the drinks supply chain. Brands use it for Life Cycle Assessments and Environmental Product Declarations, giving your product a role in the science they need to publish.",
    tags: ['LCA Ready', 'EPD Compatible'],
  },
  {
    num: '03',
    title: 'Enter once, share everywhere',
    desc: <><AT /> registers your data once and every connected brand has instant, up-to-date access. No more answering the same questionnaire from multiple customers. Your data stays current and authoritative.</>,
    tags: ['Single Source of Truth'],
  },
  {
    num: '04',
    title: 'Discovery by the right buyers',
    desc: <>Drinks companies actively searching for ESG-credentialled suppliers use the <AT /> network. Respond to data requests from brands who have already shortlisted you, and surface in searches you&apos;d otherwise never appear in.</>,
    tags: ['Inbound Enquiries', 'Brand Connections'],
  },
  {
    num: '05',
    title: 'No science degree required',
    desc: <>Our guided portal walks you through exactly what data to provide and why. Enter your operational information, production volumes, energy use, transport distances, and <AT /> calculates the impact metrics your customers need, automatically.</>,
    tags: ['Guided Entry', 'Auto-Calculated Metrics'],
  },
];

const Benefits = () => (
  <section className="py-20 px-6 md:px-20 bg-[#050505] border-t border-white/10">
    <div className="max-w-7xl mx-auto">
      <motion.div {...fadeUp(0)}>
        <SectionLabel>Your Benefits</SectionLabel>
        <h2 className="font-serif text-4xl md:text-6xl leading-tight mb-12 max-w-2xl">
          What joining the network{' '}
          <span className="italic text-gray-500">gives you.</span>
        </h2>
      </motion.div>

      <div className="divide-y divide-white/10 border-t border-white/10">
        {benefits.map((b, i) => (
          <motion.div
            key={b.num}
            {...fadeUp(i * 0.06)}
            className="grid grid-cols-[56px_1fr] gap-8 py-8 group"
          >
            <span className="font-serif text-4xl text-[#ccff00] opacity-60 leading-none pt-1">
              {b.num}
            </span>
            <div>
              <h3 className="font-mono text-xs uppercase tracking-widest text-white mb-4">
                {b.title}
              </h3>
              <p className="font-mono text-sm text-gray-500 leading-relaxed mb-5 max-w-2xl">
                {b.desc}
              </p>
              <div className="flex flex-wrap gap-2">
                {b.tags.map((tag) => (
                  <span
                    key={tag}
                    className="font-mono text-[10px] uppercase tracking-widest text-[#ccff00] border border-[#ccff00]/25 bg-[#ccff00]/5 px-3 py-1 rounded-full"
                  >
                    {tag}
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

/* ═══════════════════════════════════════════════════
   REGULATIONS
   ═══════════════════════════════════════════════════ */
const regs = [
  {
    name: 'CSRD',
    desc: 'EU Corporate Sustainability Reporting Directive requires full Scope 3 supply chain disclosure for large companies from 2026.',
  },
  {
    name: 'B Corp',
    desc: 'B Corp certification requires verified supply chain impact data. Brands need your numbers to achieve and maintain certification.',
  },
  {
    name: 'GRI',
    desc: 'Global Reporting Initiative standards require quantified supply chain environmental data as part of public ESG disclosures.',
  },
];

const Regulations = () => (
  <section className="py-20 px-6 md:px-20 bg-[#080808] border-t border-white/10">
    <div className="max-w-7xl mx-auto">
      <motion.div {...fadeUp(0)}>
        <SectionLabel>The Regulatory Landscape</SectionLabel>
        <h2 className="font-serif text-4xl md:text-6xl leading-tight mb-12 max-w-2xl">
          Your customers must report.{' '}
          <span className="italic text-gray-500">You&apos;re part of that picture.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10 mb-10">
        {regs.map((r, i) => (
          <motion.div
            key={r.name}
            {...fadeUp(i * 0.1)}
            className="bg-[#080808] p-10 text-center hover:bg-white/[0.03] transition-colors"
          >
            <h3 className="font-serif text-3xl text-white mb-4">{r.name}</h3>
            <p className="font-mono text-xs text-gray-500 leading-relaxed">{r.desc}</p>
          </motion.div>
        ))}
      </div>

      <motion.p
        {...fadeUp(0.3)}
        className="font-mono text-sm text-gray-500 leading-relaxed border-l-2 border-[#ccff00]/40 pl-5 max-w-3xl"
      >
        Brands who cannot obtain verified data from their suppliers must either estimate it,
        which under-represents your actual sustainability performance, or risk non-compliance.
        Being on <AT /> makes you the easy, defensible choice.
      </motion.p>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   HOW IT WORKS
   ═══════════════════════════════════════════════════ */
type Step = {
  num: string;
  title: string;
  desc: React.ReactNode;
};

const steps: Step[] = [
  {
    num: '1',
    title: 'Create your profile',
    desc: <>Register on the <AT /> Supplier Network and build your company profile. Upload your logo, add certifications, describe your sustainability practices, and set your industry sector and location.</>,
  },
  {
    num: '2',
    title: 'Add your products',
    desc: "Create a profile for each ingredient, material, or service you supply. Our guided portal helps you enter operational data including energy, water, transport and waste, and automatically generates impact metrics per unit.",
  },
  {
    num: '3',
    title: 'Connect with brands',
    desc: "Your verified profile is live. Respond to data requests from brands who have invited you, or be discovered by new buyers searching the network. Your data flows directly into their LCA calculations and sustainability reports.",
  },
];

const HowItWorks = () => (
  <section className="py-20 px-6 md:px-20 bg-[#050505] border-t border-white/10">
    <div className="max-w-7xl mx-auto">
      <motion.div {...fadeUp(0)}>
        <SectionLabel>The Process</SectionLabel>
        <h2 className="font-serif text-4xl md:text-6xl leading-tight mb-12 max-w-2xl">
          Up and running in{' '}
          <span className="italic text-gray-500">three steps.</span>
        </h2>
      </motion.div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 border border-white/10">
        {steps.map((s, i) => (
          <motion.div
            key={s.num}
            {...fadeUp(i * 0.1)}
            className="bg-[#050505] p-10 relative group hover:bg-white/[0.03] transition-colors"
          >
            <span className="font-serif text-[72px] text-[#ccff00] opacity-20 leading-none block mb-6">
              {s.num}
            </span>
            <h3 className="font-mono text-xs uppercase tracking-widest text-white mb-5">
              {s.title}
            </h3>
            <p className="font-mono text-xs text-gray-500 leading-relaxed">{s.desc}</p>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   PROFILE MOCKUP — mirrors the actual platform UI
   ═══════════════════════════════════════════════════ */
const ProfileMockup = () => (
  <section className="py-20 px-6 md:px-20 bg-[#080808] border-t border-white/10">
    <div className="max-w-7xl mx-auto">
      <motion.div {...fadeUp(0)}>
        <SectionLabel>Your Data in Action</SectionLabel>
        <h2 className="font-serif text-4xl md:text-6xl leading-tight mb-12 max-w-2xl">
          What your customers see{' '}
          <span className="italic text-gray-500">when they find you.</span>
        </h2>
      </motion.div>

      {/* Platform UI mockup */}
      <motion.div
        {...fadeUp(0.15)}
        className="rounded-xl border border-white/10 overflow-hidden mb-10 bg-[#0d0d0d]"
      >
        {/* Browser chrome */}
        <div className="bg-[#161616] border-b border-white/10 px-5 py-3 flex items-center gap-3">
          <div className="flex gap-1.5">
            <span className="w-3 h-3 rounded-full bg-white/10" />
            <span className="w-3 h-3 rounded-full bg-white/10" />
            <span className="w-3 h-3 rounded-full bg-white/10" />
          </div>
          <div className="flex-1 bg-white/5 rounded px-3 py-1 text-[10px] font-mono text-gray-600">
            app.alka<strong className="text-gray-500">tera</strong>.com/suppliers/example-barley-co
          </div>
        </div>

        {/* App shell — sidebar + main */}
        <div className="flex min-h-[520px]">
          {/* Sidebar */}
          <div className="w-14 bg-[#0a0a0a] border-r border-white/5 flex flex-col items-center pt-5 gap-4">
            {['▣','◫','⊞','◈'].map((icon, i) => (
              <span key={i} className={`text-sm ${i === 1 ? 'text-[#ccff00]' : 'text-white/20'}`}>{icon}</span>
            ))}
          </div>

          {/* Main content */}
          <div className="flex-1 p-6 overflow-hidden">
            {/* Supplier header */}
            <div className="flex items-center gap-4 mb-5 pb-5 border-b border-white/10">
              <div className="w-14 h-14 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center text-2xl flex-shrink-0">
                🌾
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="text-white font-semibold text-base">Example Barley Co.</h3>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-[#ccff00] border border-[#ccff00]/30 bg-[#ccff00]/5 px-2 py-0.5 rounded-full flex items-center gap-1">
                    <Check className="w-2.5 h-2.5" /> Verified
                  </span>
                  <span className="text-[10px] font-mono uppercase tracking-widest text-blue-400 border border-blue-400/30 bg-blue-400/5 px-2 py-0.5 rounded-full">
                    Data Provided
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">Malted Grain · United Kingdom</p>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex gap-0 mb-5 border-b border-white/10">
              {['Overview', 'Products (3)', 'Evidence', 'Location'].map((tab, i) => (
                <span
                  key={tab}
                  className={`font-mono text-[11px] px-4 py-2 cursor-default ${
                    i === 1
                      ? 'text-white border-b-2 border-[#ccff00] -mb-px'
                      : 'text-gray-600'
                  }`}
                >
                  {tab}
                </span>
              ))}
            </div>

            {/* Product Portfolio header */}
            <div className="flex items-center justify-between mb-4">
              <div>
                <p className="text-sm font-semibold text-white">Product Portfolio</p>
                <p className="text-xs text-gray-500 mt-0.5">Products and materials provided by this supplier</p>
              </div>
            </div>

            {/* Product rows */}
            <div className="space-y-3">
              {[
                {
                  name: 'Pale Malt 2024 Harvest',
                  code: 'PM-2024',
                  desc: 'Premium spring barley, floor malted. UK origin.',
                  category: 'Malted Grain',
                  unit: 'kg',
                  carbon: '0.38',
                },
                {
                  name: 'Roasted Barley',
                  code: 'RB-001',
                  desc: 'Dark roasted to 1200 EBC. Suitable for stouts and porters.',
                  category: 'Malted Grain',
                  unit: 'kg',
                  carbon: '0.51',
                },
                {
                  name: 'Crystal Malt 150',
                  code: 'CM-150',
                  desc: 'Medium caramel malt, adds sweetness and colour.',
                  category: 'Malted Grain',
                  unit: 'kg',
                  carbon: '0.44',
                },
              ].map((p) => (
                <div
                  key={p.name}
                  className="flex items-start gap-4 p-4 border border-white/8 rounded-lg bg-white/[0.02] hover:bg-white/[0.04] transition-colors"
                >
                  {/* Thumbnail */}
                  <div className="w-16 h-16 flex-shrink-0 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                    <span className="text-2xl opacity-60">🌾</span>
                  </div>
                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="text-sm font-medium text-white">{p.name}</span>
                      <span className="text-[10px] font-mono text-gray-500 border border-white/10 px-1.5 py-0.5 rounded">{p.code}</span>
                    </div>
                    <p className="text-xs text-gray-500 mb-2">{p.desc}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-600">
                      <span>Category: {p.category}</span>
                      <span>Unit: {p.unit}</span>
                      <span className="font-semibold text-white">
                        Carbon: {p.carbon} kg CO₂e/{p.unit}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </motion.div>

      <motion.p
        {...fadeUp(0.25)}
        className="font-mono text-sm text-gray-500 leading-relaxed max-w-2xl"
      >
        Every data point is traceable back to its source: utility records, production logs,
        third-party audits. Brands and their regulators can trust what they see. Your
        sustainability work is no longer invisible.
      </motion.p>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   QUOTE
   ═══════════════════════════════════════════════════ */
const Quote = () => (
  <section className="py-20 px-6 md:px-20 bg-[#050505] border-t border-white/10">
    <div className="max-w-7xl mx-auto">
      <motion.div {...fadeUp(0)}>
        <span className="font-serif text-8xl text-[#ccff00] leading-none block mb-8">&ldquo;</span>
        <blockquote className="font-serif text-3xl md:text-5xl italic leading-snug text-white max-w-4xl mb-8">
          When impact is quantified with scientific precision, it becomes a blueprint
          for excellence. Not just for brands, but for every producer in the supply chain.
        </blockquote>
        <p className="font-mono text-xs uppercase tracking-[0.2em] text-gray-500">
          Tim Etherington-Judge &nbsp;·&nbsp; Founder, alka<strong className="text-[#ccff00]">tera</strong>
        </p>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   CTA BANNER
   ═══════════════════════════════════════════════════ */
const CTABanner = () => (
  <section className="bg-[#ccff00] py-20 px-6 md:px-20">
    <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-start md:items-center justify-between gap-10">
      <motion.div {...fadeUp(0)}>
        <p className="font-mono text-xs uppercase tracking-[0.25em] text-black/50 mb-4">
          Get Started Today
        </p>
        <h2 className="font-serif text-5xl md:text-7xl leading-[0.92] text-black max-w-xl">
          Join the network.
          <br />
          <span className="italic">Own your impact story.</span>
        </h2>
        <p className="font-mono text-sm text-black/60 mt-6 leading-relaxed max-w-2xl">
          Registration is free. Your data, your credibility, your commercial advantage in a market where provenance is everything.
        </p>
      </motion.div>

      <motion.div {...fadeUp(0.15)} className="flex flex-col gap-4 min-w-[220px]">
        <Link
          href="/getaccess"
          className="bg-black text-[#ccff00] font-mono text-xs font-bold uppercase tracking-widest px-10 py-5 rounded-full text-center hover:scale-105 hover:shadow-[0_8px_40px_rgba(0,0,0,0.4)] transition-all"
        >
          Join the Network
        </Link>
        <Link
          href="mailto:hello@alkatera.com"
          className="border border-black/30 text-black font-mono text-xs uppercase tracking-widest px-10 py-5 rounded-full text-center hover:border-black hover:bg-black/5 transition-all"
        >
          Speak with Us
        </Link>
        <p className="font-mono text-[10px] text-black/40 text-center uppercase tracking-widest">
          Free to join · No commitment
        </p>
      </motion.div>
    </div>
  </section>
);

/* ═══════════════════════════════════════════════════
   PAGE COMPOSITION
   ═══════════════════════════════════════════════════ */
export const SupplierOnePagerClient = () => {
  return (
    <div className="bg-[#050505] text-[#f0f0f0]">
      <Navigation />
      <Hero />
      <Challenge />
      <Benefits />
      <Regulations />
      <HowItWorks />
      <ProfileMockup />
      <Quote />
      <CTABanner />
      <Footer />
    </div>
  );
};
