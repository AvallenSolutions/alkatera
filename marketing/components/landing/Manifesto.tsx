'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export const LandingManifesto = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section ref={containerRef} className="py-32 px-6 md:px-20 bg-[#050505] text-[#f0f0f0] relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <div>
          <h2 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase mb-8">Manifesto</h2>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          >
            <h3 className="font-serif text-4xl md:text-6xl mb-12 leading-tight">
              The drinks industry is <span className="italic">defined</span> by its relationship with nature.
            </h3>
            <p className="font-mono text-lg text-gray-400 leading-relaxed mb-12">
              For too long, sustainability has been a burden of spreadsheets and guesswork. We believe that when impact is quantified with scientific precision, it becomes a blueprint for excellence.
            </p>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 1 }}
              className="font-serif text-3xl italic text-[#ccff00]"
            >
              Sustainability, simplified.
            </motion.h3>
          </motion.div>
        </div>

        <div className="relative h-[600px] w-full group">
           <motion.div
             initial={{ scale: 0.9, opacity: 0 }}
             animate={isInView ? { scale: 1, opacity: 1 } : {}}
             transition={{ delay: 0.4, duration: 1 }}
             className="absolute inset-0 overflow-hidden rounded-none"
           >
             <img
               src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2787&auto=format&fit=crop"
               alt="Water Ripples"
               className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 ease-out"
             />
             <div className="absolute inset-0 bg-[#ccff00]/10 mix-blend-multiply" />
           </motion.div>

           {/* Floating Data Card */}
           <motion.div
             initial={{ x: 50, opacity: 0 }}
             animate={isInView ? { x: 0, opacity: 1 } : {}}
             transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
             className="absolute -bottom-16 -left-16 bg-white text-black p-10 max-w-sm hidden md:block shadow-[40px_40px_80px_rgba(0,0,0,0.5)] border-t-4 border-[#ccff00]"
           >
              <div className="relative">
                <div className="absolute -top-16 -left-16 text-[120px] font-serif italic text-black/5 pointer-events-none select-none">
                  55%
                </div>
                <div className="text-2xl md:text-3xl font-medium font-serif leading-[1.1] mb-6 relative z-10">
                  Sustainable products drive <span className="italic underline decoration-[#ccff00] decoration-4 underline-offset-4">55% of all growth</span> in consumer goods.
                </div>
                <div className="space-y-4 relative z-10">
                  <div className="h-px w-12 bg-black/10" />
                  <p className="text-sm text-gray-500 font-mono leading-relaxed uppercase tracking-tight">
                    For drinks brands, &quot;green&quot; SKUs are now the primary engine for expanding market share rather than a niche luxury.
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.2em] text-gray-400">
                  <div className="w-1 h-1 rounded-full bg-[#ccff00]" />
                  Verified Industry Insight
                </div>
              </div>
           </motion.div>
        </div>
      </div>
    </section>
  );
};
