'use client';

import { motion } from 'framer-motion';

export const LandingMarquee = () => {
  return (
    <div className="py-12 bg-[#ccff00] overflow-hidden whitespace-nowrap">
      <motion.div
        animate={{ x: ["0%", "-50%"] }}
        transition={{ repeat: Infinity, duration: 20, ease: "linear" }}
        className="inline-block text-black font-mono text-lg md:text-2xl font-bold uppercase tracking-tight"
      >
        <span className="mx-8">Launching Feb 2026 - Sign up to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up to get early access •</span>
        <span className="mx-8">Launching Feb 2026 - Sign up to get early access •</span>
      </motion.div>
    </div>
  );
};
