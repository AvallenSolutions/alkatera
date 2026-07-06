'use client';

import { motion } from 'framer-motion';
import Image from 'next/image';

export const LandingTrustedBy = () => {
  const brands = [
    { name: "Avallen Calvados", url: "https://avallenspirits.com", logo: "/logos/avallen.svg" },
    { name: "Everleaf", url: "https://www.everleafdrinks.com", logo: "/logos/everleaf.svg" },
    { name: "Three Spirit", url: "https://threespiritdrinks.com", logo: "/logos/three-spirit.svg" },
    { name: "Takamaka Rum", url: "https://www.takamakarum.com", logo: "/logos/takamaka.svg" },
    { name: "Black Lines", url: "https://blacklinesdrinks.com", logo: "/logos/black-lines.svg" },
    { name: "FABRIC", url: "https://drinkfabric.com", logo: "/logos/fabric.svg" },
    { name: "Veto", url: "https://www.weareveto.com/", logo: "/logos/veto.svg", invert: true }
  ];

  return (
    <section className="py-16 bg-background border-y border-border overflow-hidden relative">
      <div className="max-w-7xl mx-auto px-6 mb-12 flex items-end justify-between">
        <h3 className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-foreground">
          Trusted by Industry Pioneers
        </h3>
        <div className="hidden md:block h-px w-32 bg-border" />
      </div>

      <div className="relative w-full py-8">
        <div className="absolute left-0 top-0 bottom-0 w-20 md:w-60 bg-gradient-to-r from-background to-transparent z-10" />
        <div className="absolute right-0 top-0 bottom-0 w-20 md:w-60 bg-gradient-to-l from-background to-transparent z-10" />

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
                className="flex items-center px-6 md:px-12 opacity-35 hover:opacity-80 transition-opacity duration-200 ease-studio"
              >
                {brand.logo ? (
                  <Image
                    src={brand.logo}
                    alt={brand.name}
                    width={360}
                    height={120}
                    className="h-[72px] md:h-[120px] w-auto max-w-[270px] md:max-w-[360px] object-contain brightness-0"
                    unoptimized
                  />
                ) : (
                  <span className="font-display font-bold tracking-[-0.02em] text-3xl md:text-5xl text-foreground whitespace-nowrap">
                    {brand.name}
                  </span>
                )}
              </a>
              <span className="text-foreground/10 text-xl md:text-3xl">·</span>
            </div>
          ))}
        </motion.div>
      </div>
    </section>
  );
};
