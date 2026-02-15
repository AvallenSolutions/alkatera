"use client";

import { motion, useScroll, useTransform } from 'framer-motion';
import { ArrowDown } from 'lucide-react';
import Image from 'next/image';
import { AlkaTeraLogoHorizontal } from '@/components/lca-report/Logo';
import type { LCADataMeta } from '@/lib/types/passport';

interface CoverSectionProps {
  meta: LCADataMeta;
}

export default function CoverSection({ meta }: CoverSectionProps) {
  const { scrollY } = useScroll();
  const heroOpacity = useTransform(scrollY, [0, 500], [1, 0]);
  const heroScale = useTransform(scrollY, [0, 500], [1, 1.1]);

  return (
    <section className="relative h-screen w-full overflow-hidden flex flex-col justify-between p-6 md:p-12">
      <motion.div
        style={{ opacity: heroOpacity, scale: heroScale }}
        className="absolute inset-0 z-0"
      >
        {meta.heroImage ? (
          <Image
            src={meta.heroImage}
            alt={meta.productName}
            fill
            className="object-cover"
            priority
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-stone-200 via-lime-100 to-stone-300" />
        )}
        <div className="absolute inset-0 bg-black/10" />
      </motion.div>

      <div className="relative z-10 flex justify-between items-start text-white mix-blend-difference">
        <div className="flex flex-col">
          <AlkaTeraLogoHorizontal
            iconSize="h-6 w-6"
            textSize="text-lg"
            className="mb-1"
          />
          <span className="font-serif text-sm italic ml-10 opacity-70">Product Passport</span>
        </div>
        <div className="text-right font-mono text-xs hidden md:block">
          <p>REF: {meta.version}</p>
          <p>{meta.date}</p>
        </div>
      </div>

      <div className="relative z-10 mt-auto">
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ duration: 0.8, delay: 0.2 }}
        >
          <div className="inline-block bg-brand-accent px-4 py-1 mb-6">
            <span className="font-mono text-xs font-bold text-black uppercase tracking-widest">
              Product Footprint Analysis
            </span>
          </div>
          <h1 className="font-serif text-5xl md:text-7xl lg:text-8xl text-white mix-blend-difference leading-[0.9] mb-8">
            {meta.productName}
          </h1>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1 }}
          className="flex items-center gap-4 text-white mix-blend-difference"
        >
          <ArrowDown className="animate-bounce w-6 h-6" />
          <span className="font-mono text-xs uppercase tracking-widest">
            Scroll for Analysis
          </span>
        </motion.div>
      </div>
    </section>
  );
}
