'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

export const LandingCTA = () => {
  return (
    <section className="py-32 md:py-40 px-6 md:px-20 bg-[#ccff00] text-black text-center">
      <h2 className="font-serif text-5xl md:text-8xl mb-8 max-w-4xl mx-auto leading-[0.9]">
        Sustainability that <span className="italic">pays its way.</span>
      </h2>
      <p className="font-mono text-lg md:text-xl mb-4 max-w-xl mx-auto">
        Measure your full impact, defend your claims, and grow your brand.
      </p>
      <p className="font-mono text-base md:text-lg mb-12 max-w-xl mx-auto opacity-70">
        Start from £99/month. No long-term contract.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <Link
          href="/getaccess"
          className="bg-black text-white px-10 py-5 rounded-full font-mono uppercase tracking-widest hover:scale-105 transition-transform duration-300 flex items-center gap-4"
        >
          Get Access <ArrowRight size={18} />
        </Link>
        <Link
          href="/demo"
          className="border border-black/30 text-black/70 px-10 py-5 rounded-full font-mono uppercase tracking-widest hover:border-black hover:text-black transition-colors duration-300"
        >
          Book a demo
        </Link>
      </div>
    </section>
  );
};
