'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';

export const LandingShowcase = () => {
  const [activeTab, setActiveTab] = useState(0);
  const tabs = [
    {
      id: 0,
      label: "01. ANALYSE",
      content: "We dissect your liquid's journey. Our platform analyses raw ingredients, fermentation data, and packaging specs against global environmental standards to reveal the true composition of your bottle's footprint.",
      image: "https://images.unsplash.com/photo-1584225064785-c62a8b43d148?q=80&w=2000&auto=format&fit=crop" // Brewery/Vats
    },
    {
      id: 1,
      label: "02. CALCULATE",
      content: "Quantify your impact per litre. From carbon equivalents in glass manufacturing to water scarcity indices in your barley fields, our engine performs the complex calculations needed for audit-ready reporting.",
      image: "https://images.unsplash.com/photo-1551288049-bebda4e38f71?q=80&w=2940&auto=format&fit=crop" // Dashboard on Laptop
    },
    {
      id: 2,
      label: "03. STRATEGISE",
      content: "Move beyond reporting. Use your data to build a resilient supply chain, optimise packaging weights, and set science-based targets that drive long-term brand value while regenerating the terroir you depend on.",
      image: "https://images.unsplash.com/photo-1497366216548-37526070297c?q=80&w=2940&auto=format&fit=crop" // Team/Office with Nature View
    },
  ];

  return (
    <section className="py-32 px-6 md:px-20 bg-[#0a0a0a] text-white flex flex-col md:flex-row gap-20">
      <div className="w-full md:w-1/3 space-y-12">
        <h2 className="font-serif text-5xl">The Process</h2>
        <div className="flex flex-col gap-0 border-l border-white/20">
          {tabs.map((tab, idx) => (
            <button
              key={idx}
              onClick={() => setActiveTab(idx)}
              className={cn(
                "text-left pl-8 py-6 font-mono text-lg transition-all duration-300 relative",
                activeTab === idx ? "text-[#ccff00]" : "text-gray-500 hover:text-white"
              )}
            >
              {activeTab === idx && (
                <motion.div
                  layoutId="activeTab"
                  className="absolute left-0 top-0 bottom-0 w-1 bg-[#ccff00]"
                />
              )}
              {tab.label}
            </button>
          ))}
        </div>
        <motion.p
          key={activeTab}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-xl leading-relaxed"
        >
          {tabs[activeTab].content}
        </motion.p>
      </div>

      <div className="w-full md:w-2/3 bg-[#111] rounded-none border border-white/10 relative min-h-[500px] overflow-hidden group">
         {/* Image Container */}
         <AnimatePresence mode="wait">
           <motion.div
             key={activeTab}
             initial={{ opacity: 0, scale: 1.05 }}
             animate={{ opacity: 1, scale: 1 }}
             exit={{ opacity: 0 }}
             transition={{ duration: 0.5 }}
             className="absolute inset-0"
           >
             <img
               src={tabs[activeTab].image}
               alt={tabs[activeTab].label}
               className="w-full h-full object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700"
             />
             <div className="absolute inset-0 bg-[#0a0a0a]/30 mix-blend-multiply" />
             <div className="absolute inset-0 bg-gradient-to-t from-[#0a0a0a] via-transparent to-transparent" />
           </motion.div>
         </AnimatePresence>

         {/* Overlay Elements */}
         <div className="absolute inset-0 p-8 flex flex-col justify-between pointer-events-none">
            <div className="flex justify-between items-start">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 px-4 py-2 rounded-full flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#ccff00] animate-pulse" />
                <span className="font-mono text-[10px] uppercase tracking-widest text-[#ccff00]">Live Data Link</span>
              </div>
            </div>

            <div className="flex justify-end">
              <div className="bg-black/50 backdrop-blur-md border border-white/10 p-6 max-w-xs">
                <div className="font-mono text-[10px] uppercase tracking-widest text-gray-400 mb-2">System Status</div>
                <div className="font-serif text-2xl text-white mb-1">
                  {activeTab === 0 && "Processing..."}
                  {activeTab === 1 && "Optimized."}
                  {activeTab === 2 && "On Target."}
                </div>
                <div className="h-1 w-full bg-white/10 mt-2 overflow-hidden">
                  <motion.div
                    key={activeTab}
                    initial={{ width: 0 }}
                    animate={{ width: "100%" }}
                    transition={{ duration: 1.5, ease: "easeInOut" }}
                    className="h-full bg-[#ccff00]"
                  />
                </div>
              </div>
            </div>
         </div>
      </div>
    </section>
  );
};
