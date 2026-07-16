'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

// Compact 3-tier teaser for the homepage. The full plan table, feature matrix and
// billing toggle live on /getaccess — this just anchors price and sends detail there,
// so the homepage stops reproducing the whole pricing page inline.
const tiers = [
  {
    name: 'Seed',
    price: 99,
    was: 199,
    tagline: 'For boutique brands laying their sustainability foundations.',
    highlight: false,
  },
  {
    name: 'Blossom',
    price: 249,
    was: 399,
    tagline: 'For scaling brands turning impact into a strategic advantage.',
    highlight: true,
  },
  {
    name: 'Canopy',
    price: 599,
    was: 899,
    tagline: 'Full ecosystem management for established organisations.',
    highlight: false,
  },
];

export const PricingTeaser = () => {
  return (
    <section className="py-24 md:py-32 px-6 md:px-20 bg-[#050505] text-white border-t border-white/10">
      <div className="max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <div className="inline-block font-mono text-[10px] uppercase tracking-[0.2em] text-black bg-[#ccff00] px-4 py-1.5 mb-6">
            Founding partner pricing, while it lasts
          </div>
          <h2 className="font-serif text-4xl md:text-6xl leading-tight">
            Simple plans that <span className="italic text-[#ccff00]">grow</span> with you.
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-px bg-white/10 mb-12">
          {tiers.map((tier) => (
            <div
              key={tier.name}
              className={`p-8 md:p-10 flex flex-col ${
                tier.highlight ? 'bg-[#0e0e0e]' : 'bg-[#050505]'
              }`}
            >
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-2xl">{tier.name}</h3>
                {tier.highlight && (
                  <span className="font-mono text-[10px] uppercase tracking-widest text-[#ccff00] border border-[#ccff00]/40 px-2 py-1">
                    Most popular
                  </span>
                )}
              </div>
              <div className="flex items-baseline gap-2 mb-4">
                <span className="font-serif text-4xl">£{tier.price}</span>
                <span className="font-mono text-sm text-gray-500">/mo</span>
                <span className="font-mono text-xs text-gray-600 line-through">£{tier.was}</span>
              </div>
              <p className="font-mono text-sm text-gray-400 leading-relaxed">{tier.tagline}</p>
            </div>
          ))}
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
          <Link
            href="/getaccess"
            className="inline-flex items-center gap-3 bg-[#ccff00] text-black px-8 py-4 rounded-full font-mono text-sm uppercase tracking-widest hover:scale-105 transition-transform duration-300"
          >
            See full plans &amp; features <ArrowRight size={18} />
          </Link>
          <Link
            href="/getaccess/signup?trial=true"
            className="inline-flex items-center border border-white/30 text-white px-8 py-4 rounded-full font-mono text-sm uppercase tracking-widest hover:border-white/70 transition-colors duration-300"
          >
            Start free trial
          </Link>
        </div>
      </div>
    </section>
  );
};
