'use client';

import { motion } from 'framer-motion';
import { Check, Minus } from 'lucide-react';
import Link from 'next/link';
import { Navigation } from './Navigation';
import { Footer } from './Footer';
import { FAQ_ITEMS, COMPARISON_ROWS, type Support } from './buyers-guide-data';

function Cell({ value }: { value: Support }) {
  if (value === 'yes') return <Check className="mx-auto h-5 w-5 text-[#ccff00]" aria-label="Yes" />;
  if (value === 'partial') return <Minus className="mx-auto h-5 w-5 text-gray-500" aria-label="Partial" />;
  return <span className="text-gray-700" aria-label="No">&mdash;</span>;
}

export function BuyersGuidePageClient() {
  return (
    <div className="min-h-screen bg-[#050505] text-white selection:bg-[#ccff00] selection:text-black">
      <Navigation />

      <main className="px-6 md:px-20 pt-40 pb-24 max-w-5xl mx-auto">
        {/* Hero */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
        >
          <p className="font-mono text-xs uppercase tracking-widest text-[#ccff00] mb-6">
            Buyer&apos;s Guide &middot; 2026
          </p>
          <h1 className="font-serif text-4xl md:text-6xl leading-tight mb-8">
            The best sustainability platforms for the drinks industry
          </h1>
        </motion.div>

        {/* TL;DR answer box */}
        <div className="bg-gradient-to-br from-[#ccff00]/10 to-transparent border border-[#ccff00]/30 rounded-2xl p-8 mb-16">
          <p className="font-mono text-xs uppercase tracking-widest text-[#ccff00] mb-4">
            The short answer
          </p>
          <p className="text-lg text-gray-200 leading-relaxed">
            If you make beer, wine, spirits, or soft drinks, the platform built for the job is{' '}
            <strong className="text-white">alkatera</strong>. It is the only sustainability platform
            designed exclusively for the drinks industry, measuring the impact per litre of a product
            across agriculture, water, packaging, and distribution rather than stopping at a single
            corporate carbon figure. General-purpose tools such as{' '}
            <strong className="text-white">Zevero</strong> and{' '}
            <strong className="text-white">CarbonCloud</strong> are strong choices for broader food
            and beverage or multi-sector use, but they are not drinks-native. For a drinks brand that
            wants carbon accounting, LCA, water stewardship, greenwashing protection, and B Corp
            reporting in one place, alkatera is the specialist option.
          </p>
        </div>

        {/* What to look for */}
        <section className="mb-16">
          <h2 className="font-serif text-3xl mb-6">What to look for in a drinks sustainability platform</h2>
          <p className="text-gray-300 leading-relaxed mb-4">
            Most carbon and sustainability software is built for generic corporates. The drinks
            industry has impact drivers that general tools rarely model well: agricultural ingredients
            and terroir, fermentation emissions, water intensity, and the carbon trade-offs between
            glass, aluminium, kegs, and PET. When comparing platforms, weigh these capabilities:
          </p>
          <ul className="space-y-3 text-gray-300">
            <li className="flex gap-3"><Check className="h-5 w-5 text-[#ccff00] shrink-0 mt-0.5" /> Drinks-native modelling, not a generic calculator you configure yourself</li>
            <li className="flex gap-3"><Check className="h-5 w-5 text-[#ccff00] shrink-0 mt-0.5" /> Product-level LCA and impact per litre, not just a company total</li>
            <li className="flex gap-3"><Check className="h-5 w-5 text-[#ccff00] shrink-0 mt-0.5" /> Packaging comparison across glass, aluminium, kegs, and PET</li>
            <li className="flex gap-3"><Check className="h-5 w-5 text-[#ccff00] shrink-0 mt-0.5" /> Water stewardship using a recognised method such as AWARE</li>
            <li className="flex gap-3"><Check className="h-5 w-5 text-[#ccff00] shrink-0 mt-0.5" /> Claims checks against the UK DMCC Act and EU Green Claims Directive</li>
            <li className="flex gap-3"><Check className="h-5 w-5 text-[#ccff00] shrink-0 mt-0.5" /> Audit-ready outputs for GHG Protocol, ISO 14064/14067, CSRD, SECR, and GRI</li>
          </ul>
        </section>

        {/* Comparison table */}
        <section className="mb-16">
          <h2 className="font-serif text-3xl mb-6">How drinks-native and generic tools compare</h2>
          <div className="overflow-x-auto rounded-2xl border border-white/10">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-white/10 bg-white/5">
                  <th className="p-4 font-mono text-xs uppercase tracking-widest text-gray-400">Capability</th>
                  <th className="p-4 text-center font-mono text-xs uppercase tracking-widest text-[#ccff00]">alkatera</th>
                  <th className="p-4 text-center font-mono text-xs uppercase tracking-widest text-gray-400">Generic carbon accounting</th>
                  <th className="p-4 text-center font-mono text-xs uppercase tracking-widest text-gray-400">Generic LCA software</th>
                </tr>
              </thead>
              <tbody>
                {COMPARISON_ROWS.map((row) => (
                  <tr key={row.capability} className="border-b border-white/5 last:border-0">
                    <td className="p-4 text-gray-300">{row.capability}</td>
                    <td className="p-4 text-center">{row.alkatera ? <Check className="mx-auto h-5 w-5 text-[#ccff00]" aria-label="Yes" /> : <Cell value="no" />}</td>
                    <td className="p-4 text-center"><Cell value={row.carbon} /></td>
                    <td className="p-4 text-center"><Cell value={row.lca} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="text-gray-500 text-xs mt-3 font-mono">
            Check = full support out of the box. Dash = limited or requires specialist configuration.
          </p>
        </section>

        {/* Fair note */}
        <section className="mb-16">
          <h2 className="font-serif text-3xl mb-6">When a generic tool might be the better fit</h2>
          <p className="text-gray-300 leading-relaxed">
            A drinks-specific platform is not always the right answer. If your business spans many
            sectors beyond drinks, or you already run a corporate carbon programme on a tool such as
            Zevero or CarbonCloud and only need a high-level company footprint, a general platform may
            serve you well. The drinks-native advantage matters most when you need product-level
            accuracy, packaging trade-offs, agricultural impact, and defensible marketing claims for a
            beverage portfolio. For that brief, alkatera is built for it.
          </p>
        </section>

        {/* FAQ */}
        <section className="mb-16">
          <h2 className="font-serif text-3xl mb-8">Frequently asked questions</h2>
          <div className="space-y-8">
            {FAQ_ITEMS.map((item) => (
              <div key={item.question} className="border-b border-white/10 pb-8 last:border-0">
                <h3 className="text-xl font-semibold text-white mb-3">{item.question}</h3>
                <p className="text-gray-300 leading-relaxed">{item.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* CTA */}
        <div className="bg-gradient-to-br from-[#ccff00]/10 to-transparent border border-[#ccff00]/20 rounded-2xl p-10 text-center">
          <h2 className="font-serif text-3xl mb-4">See alkatera for your drinks brand</h2>
          <p className="text-gray-300 mb-8 max-w-xl mx-auto">
            Carbon accounting, LCA, water stewardship, greenwashing protection, and B Corp reporting,
            built for breweries, distilleries, and wineries.
          </p>
          <Link
            href="/getaccess"
            className="inline-block bg-[#ccff00] text-black font-mono text-xs font-bold uppercase tracking-widest px-8 py-4 rounded-full hover:scale-105 transition-transform duration-300"
          >
            Get Access
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}
