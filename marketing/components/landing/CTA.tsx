'use client';

import { ArrowRight } from 'lucide-react';

interface CTAProps {
  onOpenContact: () => void;
}

export const LandingCTA = ({ onOpenContact }: CTAProps) => {
  return (
    <section className="py-40 px-6 md:px-20 bg-[#ccff00] text-black text-center">
      <h2 className="font-serif text-5xl md:text-8xl mb-8 max-w-4xl mx-auto leading-[0.9]">
        Ready to change the industry?
      </h2>
      <p className="font-mono text-lg md:text-xl mb-12 max-w-xl mx-auto">
        Join the platform that&apos;s redesigning the future of drinks.
      </p>
      <button
        onClick={onOpenContact}
        className="bg-black text-white px-10 py-5 rounded-full font-mono uppercase tracking-widest hover:scale-105 transition-transform duration-300 flex items-center gap-4 mx-auto"
      >
        Get In Touch <ArrowRight size={18} />
      </button>
    </section>
  );
};
