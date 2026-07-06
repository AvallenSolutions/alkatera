'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

interface HeroProps {
  onOpenGuardian: () => void;
}

export const LandingHero = ({ onOpenGuardian }: HeroProps) => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#1A1B1D] text-[#F2F1EA]">
      {/* Background Video/Image Placeholder */}
      <div className="absolute inset-0">
        <img
          src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2874&auto=format&fit=crop"
          alt="Abstract Nature"
          className="object-cover w-full h-full scale-110"
        />
        <div className="absolute inset-0 bg-[#1A1B1D]/50" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-20 max-w-[1800px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          style={{ y: y1, opacity }}
          className="max-w-5xl"
        >
          <h1 className="font-display font-bold tracking-[-0.035em] text-6xl md:text-8xl leading-[0.95] mb-8">
            Sustainability, <br />
            distilled.
          </h1>
          <p className="font-sans text-sm md:text-lg max-w-xl text-[#F2F1EA]/85 leading-relaxed border-l border-[#F2F1EA]/50 pl-6 mb-10">
            Sustainability is your next competitive advantage. alka<strong>tera</strong> is the sustainability operating system built for the drinks industry, measuring environmental, social and governance impact, then turning it into audit-ready reports, retailer-ready claims, and the strategy that grows your brand. More than reporting. A strategy engine.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 pl-6">
            <a
              href="/getaccess"
              className="inline-flex items-center justify-center bg-[#F2F1EA] text-[#1A1B1D] px-8 py-4 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:opacity-90 transition-opacity duration-200 ease-studio"
            >
              Get Access from £99/mo
            </a>
            <a
              href="/platform"
              className="inline-flex items-center justify-center border border-[#F2F1EA]/40 text-[#F2F1EA] px-8 py-4 rounded-full font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:border-[#F2F1EA] transition-colors duration-200 ease-studio"
            >
              See the Platform
            </a>
            <button
              onClick={onOpenGuardian}
              className="inline-flex items-center justify-center text-[#F2F1EA]/60 font-mono text-[11px] font-bold uppercase tracking-[0.22em] hover:text-[#F2F1EA] transition-colors duration-200 ease-studio gap-2"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-[#F2F1EA]" />
              Free: Scan for greenwashing risk
            </button>
          </div>
        </motion.div>
      </div>

      <motion.div
        style={{ opacity }}
        className="absolute bottom-12 left-0 right-0 flex justify-center"
      >
        <ChevronDown className="w-8 h-8 text-[#F2F1EA]/70" />
      </motion.div>
    </section>
  );
};
