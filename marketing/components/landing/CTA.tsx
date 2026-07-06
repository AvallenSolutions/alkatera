'use client';

import { ArrowRight } from 'lucide-react';

interface CTAProps {
  onOpenContact: () => void;
  onOpenGuardian: () => void;
}

export const LandingCTA = ({ onOpenContact, onOpenGuardian }: CTAProps) => {
  return (
    <section className="py-40 px-6 md:px-20 bg-[#205E40] text-[#F2F1EA] text-center">
      <h2 className="font-display font-bold tracking-[-0.035em] text-5xl md:text-7xl mb-8 max-w-4xl mx-auto leading-[0.95]">
        Beyond carbon.<br />Built for drinks.
      </h2>
      <p className="font-sans text-lg md:text-xl mb-4 max-w-xl mx-auto">
        The only sustainability platform purpose-built for breweries, distilleries, and wineries.
      </p>
      <p className="font-sans text-base md:text-lg mb-12 max-w-xl mx-auto opacity-70">
        Start from £99/month. No long-term contract. No PhD required.
      </p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
        <a
          href="/getaccess"
          className="bg-[#F2F1EA] text-[#1A1B1D] px-10 py-5 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:opacity-90 transition-opacity duration-200 ease-studio flex items-center gap-4"
        >
          Get Access <ArrowRight size={18} />
        </a>
        <button
          onClick={onOpenContact}
          className="border border-[#F2F1EA]/40 text-[#F2F1EA]/80 px-10 py-5 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:border-[#F2F1EA] hover:text-[#F2F1EA] transition-colors duration-200 ease-studio"
        >
          Talk to Us
        </button>
        <button
          onClick={onOpenGuardian}
          className="text-[#F2F1EA]/60 font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:text-[#F2F1EA] transition-colors duration-200 ease-studio flex items-center gap-2"
        >
          <span className="w-1.5 h-1.5 rounded-full bg-[#F2F1EA]/60" />
          Free greenwash scan
        </button>
      </div>
    </section>
  );
};
