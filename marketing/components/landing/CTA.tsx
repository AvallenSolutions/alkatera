'use client';

import { ArrowRight } from 'lucide-react';

interface CTAProps {
  onOpenContact: () => void;
  onOpenGuardian: () => void;
}

export const LandingCTA = ({ onOpenContact, onOpenGuardian }: CTAProps) => {
  return (
    <section className="py-40 px-6 md:px-20 bg-[#ccff00] text-black text-center">
      <h2 className="font-serif text-5xl md:text-8xl mb-8 max-w-4xl mx-auto leading-[0.9]">
        Beyond carbon.<br /><span className="italic">Built for drinks.</span>
      </h2>
      <p className="font-mono text-lg md:text-xl mb-4 max-w-xl mx-auto">
        The only sustainability platform purpose-built for breweries, distilleries, and wineries.
      </p>
      <p className="font-mono text-base md:text-lg mb-12 max-w-xl mx-auto opacity-70">
        Start from £99/month. No long-term contract. No PhD required.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a
          href="/getaccess"
          className="bg-black text-white px-10 py-5 rounded-full font-mono uppercase tracking-widest hover:scale-105 transition-transform duration-300 flex items-center gap-4"
        >
          Get Access <ArrowRight size={18} />
        </a>
        <button
          onClick={onOpenContact}
          className="border border-black/30 text-black/70 px-10 py-5 rounded-full font-mono uppercase tracking-widest hover:border-black hover:text-black transition-colors duration-300"
        >
          Talk to Us
        </button>
        <button
          onClick={onOpenGuardian}
          className="text-black/50 font-mono text-sm uppercase tracking-widest hover:text-black transition-colors duration-300 flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-black/40" />
          Free greenwash scan
        </button>
      </div>
    </section>
  );
};
