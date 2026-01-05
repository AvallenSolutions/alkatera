'use client';

import { motion } from 'framer-motion';

export const LandingTrustedBy = () => {
  const brands = [
    { name: "Avallen Calvados", url: "https://avallenspirits.com" },
    { name: "Everleaf", url: "https://www.everleafdrinks.com" },
    { name: "Three Spirit", url: "https://threespiritdrinks.com" },
    { name: "Takamaka Rum", url: "https://www.takamakarum.com" },
    { name: "Black Lines", url: "https://blacklinesdrinks.com" },
    { name: "FABRIC", url: "https://drinkfabric.com" }
  ];

  return (
    <section className="py-32 bg-[#050505] border-y border-white/10 overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 mb-12 flex items-end justify-between">
        <h3 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase">
          Trusted by Industry Pioneers
        </h3>
        <div className="hidden md:block h-px w-32 bg-[#ccff00]" />
      </div>

      <div className="relative w-full py-8">
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-60 bg-gradient-to-r from-[#050505] to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-60 bg-gradient-to-l from-[#050505] to-transparent z-10" />

        <motion.div
          animate={{ x: ["0%", "-50%"] }}
          transition={{ repeat: Infinity, duration: 40, ease: "linear" }}
          className="flex items-center w-max"
        >
          {[...brands, ...brands, ...brands, ...brands].map((brand, i) => (
            <div key={i} className="flex items-center group">
              <a
                href={brand.url}
                target="_blank"
                rel="noopener noreferrer"
                className="font-serif text-3xl md:text-5xl text-white/20 hover:text-[#ccff00] transition-colors duration-500 px-6 md:px-12 whitespace-nowrap italic"
              >
                {brand.name}
              </a>
              <span className="text-white/10 text-xl md:text-3xl">✦</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
