'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

export const LandingManifesto = () => {
  const containerRef = useRef(null);
  const isInView = useInView(containerRef, { once: true, margin: "-100px" });

  return (
    <section ref={containerRef} className="py-32 px-6 md:px-20 bg-background text-foreground relative overflow-hidden">
      <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-2 gap-20 items-center">
        <div>
          <h2 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#205E40] mb-8">Manifesto</h2>
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <h3 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl mb-12 leading-[0.95]">
              The drinks industry is defined by its relationship with nature.
            </h3>
            <p className="font-sans text-lg text-muted-foreground leading-relaxed mb-12">
              For too long, sustainability has been a burden of spreadsheets and guesswork. We believe that when impact is quantified with scientific precision, it becomes a blueprint for excellence.
            </p>
            <motion.h3
              initial={{ opacity: 0 }}
              animate={isInView ? { opacity: 1 } : {}}
              transition={{ delay: 0.5, duration: 1 }}
              className="font-display font-bold tracking-[-0.02em] text-3xl text-[#205E40]"
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
             className="absolute inset-0 overflow-hidden rounded-[6px]"
           >
             <img
               src="https://images.unsplash.com/photo-1518173946687-a4c8892bbd9f?q=80&w=2787&auto=format&fit=crop"
               alt="Water Ripples"
               className="object-cover w-full h-full grayscale group-hover:grayscale-0 transition-all duration-700 ease-studio"
             />
           </motion.div>

           {/* Floating Data Card */}
           <motion.div
             initial={{ x: 50, opacity: 0 }}
             animate={isInView ? { x: 0, opacity: 1 } : {}}
             transition={{ delay: 0.6, duration: 1, ease: [0.2, 0.8, 0.2, 1] }}
             className="absolute -bottom-16 -left-16 bg-card text-card-foreground p-10 max-w-sm hidden md:block shadow-[0_20px_60px_rgba(26,27,29,0.15)] border border-border border-t-4 border-t-[#205E40] rounded-[6px]"
           >
              <div className="relative">
                <div className="absolute -top-16 -left-16 text-[120px] font-display font-bold tracking-[-0.035em] text-foreground/5 pointer-events-none select-none">
                  55%
                </div>
                <div className="text-2xl md:text-3xl font-display font-bold tracking-[-0.02em] leading-[1.1] mb-6 relative z-10">
                  Sustainable products drive <span className="underline decoration-[#205E40] decoration-4 underline-offset-4">55% of all growth</span> in consumer goods.
                </div>
                <div className="space-y-4 relative z-10">
                  <div className="h-px w-12 bg-border" />
                  <p className="text-sm text-muted-foreground font-sans leading-relaxed">
                    For drinks brands, &quot;green&quot; SKUs are now the primary engine for expanding market share rather than a niche luxury.
                  </p>
                </div>
                <div className="mt-8 flex items-center gap-2 text-[10px] font-mono uppercase tracking-[0.22em] text-muted-foreground">
                  <div className="w-1 h-1 rounded-full bg-[#205E40]" />
                  NYU Stern Center for Sustainable Business, 2023
                </div>
              </div>
           </motion.div>
        </div>
      </div>
    </section>
  );
};
