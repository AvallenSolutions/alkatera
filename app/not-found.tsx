'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, RefreshCw, Leaf, Search, Globe, Wind } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';

const SUSTAINABILITY_FACTS = [
  {
    icon: <Leaf className="text-[#ccff00]" />,
    text: "Distilling one litre of whisky typically produces 15 litres of wastewater, known as pot ale. We turn that burden into biology."
  },
  {
    icon: <Globe className="text-[#ccff00]" />,
    text: "Supply chains account for more than 90% of a consumer company's environmental impact. Clarity starts with data."
  },
  {
    icon: <Wind className="text-[#ccff00]" />,
    text: "By 2030, the drink industry aims to reduce carbon emissions by 50%. AlkaTera provides the operating system to get there."
  },
  {
    icon: <Search className="text-[#ccff00]" />,
    text: "Transparency is the new luxury. 73% of consumers say they would change their consumption habits to reduce environmental impact."
  }
];

export default function NotFound() {
  const [factIndex, setFactIndex] = useState(0);

  const rotateFact = () => {
    setFactIndex((prev) => (prev + 1) % SUSTAINABILITY_FACTS.length);
  };

  return (
    <div className="relative min-h-screen w-full text-white overflow-hidden flex flex-col items-center justify-center p-6" style={{ fontFamily: "'Instrument Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Instrument+Sans:wght@400;500;600&family=Instrument+Serif:ital@0;1&display=swap');

        .glass-404 {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.08);
        }

        .text-glow {
          text-shadow: 0 0 30px rgba(204, 255, 0, 0.3);
        }
      `}</style>

      {/* Full-page background */}
      <Image
        src="/images/404.jpg"
        alt="404 background"
        fill
        className="object-cover"
        priority
        quality={85}
      />
      <div className="absolute inset-0 bg-black/60" />

      <div className="relative z-10 max-w-4xl w-full flex flex-col items-center text-center">

        {/* Logo */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="mb-16"
        >
          <img
            src="https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png"
            alt="AlkaTera"
            className="h-8 w-auto opacity-80"
          />
        </motion.div>

        {/* 404 Visual */}
        <div className="relative mb-12">
          <motion.h1
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 1, ease: "easeOut" }}
            className="text-[180px] md:text-[240px] leading-none text-white/10 tracking-tighter"
            style={{ fontFamily: "'Instrument Serif', serif" }}
          >
            404
          </motion.h1>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="text-center">
              <h2
                className="text-4xl md:text-6xl text-white mb-4 text-glow italic"
                style={{ fontFamily: "'Instrument Serif', serif" }}
              >
                Lost in the ecosystem.
              </h2>
              <p className="text-white/50 text-lg md:text-xl max-w-md mx-auto font-light leading-relaxed">
                The path you&apos;re looking for has been recycled or never existed.
              </p>
            </div>
          </motion.div>
        </div>

        {/* Fact Card */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.8, duration: 0.8 }}
          className="glass-404 rounded-2xl p-8 mb-12 max-w-lg w-full relative overflow-hidden group"
        >
          <div className="flex items-start gap-4 text-left relative z-10">
            <div className="p-3 bg-white/5 rounded-xl group-hover:bg-[#ccff00]/10 transition-colors duration-500">
              {SUSTAINABILITY_FACTS[factIndex].icon}
            </div>
            <div>
              <h3 className="text-[#ccff00] text-xs font-mono uppercase tracking-widest mb-2 opacity-80">
                Knowledge Seed
              </h3>
              <AnimatePresence mode="wait">
                <motion.p
                  key={factIndex}
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="text-white/80 text-sm md:text-base leading-relaxed font-light italic"
                >
                  &ldquo;{SUSTAINABILITY_FACTS[factIndex].text}&rdquo;
                </motion.p>
              </AnimatePresence>
            </div>
          </div>

          <button
            onClick={rotateFact}
            className="absolute bottom-4 right-4 p-2 text-white/20 hover:text-[#ccff00] transition-colors"
            title="Next fact"
          >
            <RefreshCw size={14} className="hover:rotate-180 transition-transform duration-700" />
          </button>

          <div className="absolute top-[-50%] right-[-20%] w-64 h-64 bg-[#ccff00]/5 blur-[80px] rounded-full pointer-events-none" />
        </motion.div>

        {/* Action Buttons */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.2, duration: 0.8 }}
          className="flex flex-wrap items-center justify-center gap-6"
        >
          <Link
            href="/"
            className="group flex items-center gap-2 px-8 py-4 bg-[#ccff00] text-black rounded-full font-semibold transition-all hover:scale-105 active:scale-95"
          >
            <ArrowLeft size={18} className="group-hover:-translate-x-1 transition-transform" />
            Return to Safety
          </Link>

          <Link
            href="/#platform"
            className="flex items-center gap-2 px-8 py-4 bg-white/5 border border-white/10 text-white rounded-full font-medium transition-all hover:bg-white/10 hover:border-white/20"
          >
            Explore the Platform
          </Link>
        </motion.div>

        {/* Bottom decoration */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 0.2 }}
          transition={{ delay: 1.5, duration: 2 }}
          className="mt-20 flex items-center gap-12 opacity-20 grayscale"
        >
          <div className="w-12 h-[1px] bg-white" />
          <span className="text-[10px] font-mono uppercase tracking-[0.5em]">AlkaTera Ecosystem</span>
          <div className="w-12 h-[1px] bg-white" />
        </motion.div>
      </div>

      {/* Photo credit */}
      <div className="absolute bottom-4 text-center text-[10px] text-white/20 z-10">
        Photo by{' '}
        <a
          href="https://unsplash.com/@imkaravisual"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40"
        >
          Imkara Visual
        </a>
        {' '}on{' '}
        <a
          href="https://unsplash.com"
          target="_blank"
          rel="noopener noreferrer"
          className="underline hover:text-white/40"
        >
          Unsplash
        </a>
      </div>
    </div>
  );
}
