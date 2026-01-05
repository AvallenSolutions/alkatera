'use client';

import { motion, useScroll, useTransform } from 'framer-motion';
import { ChevronDown } from 'lucide-react';

export const LandingHero = () => {
  const { scrollY } = useScroll();
  const y1 = useTransform(scrollY, [0, 500], [0, 200]);
  const opacity = useTransform(scrollY, [0, 300], [1, 0]);

  return (
    <section className="relative h-screen w-full overflow-hidden bg-[#050505] text-[#f0f0f0]">
      {/* Background Video/Image Placeholder */}
      <div className="absolute inset-0 opacity-60">
        <img
          src="https://images.unsplash.com/photo-1470071459604-3b5ec3a7fe05?q=80&w=2874&auto=format&fit=crop"
          alt="Abstract Nature"
          className="object-cover w-full h-full scale-110"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-transparent to-[#050505]" />
      </div>

      <div className="relative z-10 h-full flex flex-col justify-center px-6 md:px-20 max-w-[1800px] mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 100 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          style={{ y: y1, opacity }}
          className="max-w-5xl"
        >
          <h1 className="font-serif text-6xl md:text-9xl leading-[0.9] mb-8 tracking-tight">
            Sustainability, <br />
            <span className="italic text-[#ccff00]">Distilled.</span>
          </h1>
          <p className="font-mono text-sm md:text-lg max-w-xl text-gray-300 leading-relaxed border-l border-[#ccff00] pl-6">
            Make sustainability your competitive edge, not your paperwork. Alkatera is the operating system for the drinks industry, automating the complex science of impact to turn your environmental data into a powerful engine for brand growth.
          </p>
        </motion.div>
      </div>

      <motion.div
        style={{ opacity }}
        className="absolute bottom-12 left-0 right-0 flex justify-center animate-bounce"
      >
        <ChevronDown className="w-8 h-8 text-[#ccff00]" />
      </motion.div>
    </section>
  );
};
