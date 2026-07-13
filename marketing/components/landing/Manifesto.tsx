'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

// Slimmed to the single proof stat. The full manifesto lives at /manifesto — this
// keeps only the commercial "why now" near the top of the funnel.
export const LandingManifesto = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: '-100px' });

  return (
    <section
      ref={containerRef}
      className="py-24 md:py-28 px-6 md:px-20 bg-[#050505] text-[#f0f0f0] border-t border-white/10"
    >
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={isInView ? { opacity: 1, y: 0 } : {}}
        transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
        className="max-w-4xl mx-auto text-center"
      >
        <p className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase mb-8">Why now</p>
        <h2 className="font-serif text-3xl md:text-5xl leading-[1.15]">
          Sustainable products drive{' '}
          <span className="italic underline decoration-[#ccff00] decoration-4 underline-offset-[6px]">
            55% of all growth
          </span>{' '}
          in consumer goods.
        </h2>
        <p className="font-mono text-sm md:text-base text-gray-400 leading-relaxed max-w-2xl mx-auto mt-8">
          For drinks brands, &quot;green&quot; SKUs are now the primary engine for expanding market
          share, not a niche luxury.
        </p>
        <div className="mt-8 flex items-center justify-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-gray-500">
          <span className="w-1 h-1 rounded-full bg-[#ccff00]" />
          NYU Stern Center for Sustainable Business, 2023
        </div>
      </motion.div>
    </section>
  );
};
