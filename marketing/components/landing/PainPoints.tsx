'use client';

import { useRef } from 'react';
import { motion, useInView } from 'framer-motion';

const painPoints = [
  {
    label: 'Carbon-only tools miss the point',
    description: 'Carbon is one metric of many. Water stress, land use, biodiversity, waste — your retailers, certifiers, and regulators are already asking for all of it. Most platforms stop at carbon.',
  },
  {
    label: 'Generic calculators don\'t speak drinks',
    description: 'A fermentation vessel is not a factory floor. Brewing, distilling, and winemaking have their own physics, water ratios, and waste profiles. Generic tools give you generic — and often wrong — answers.',
  },
  {
    label: 'Spreadsheets that nobody trusts',
    description: 'Your sustainability data is scattered across shared drives, old emails, and someone\'s personal spreadsheet. Nobody knows what\'s current, and an auditor would pull it apart in minutes.',
  },
  {
    label: 'Greenwashing risk you can\'t see',
    description: 'The UK Green Claims Code and EU Green Claims Directive are in force. A claim that felt fine 18 months ago could now be a legal liability. Most brands are flying blind.',
  },
  {
    label: 'Retailer data requests with no warning',
    description: 'Tesco, Sainsbury\'s, Carrefour — they\'re all required to report their full supply chain emissions under CSRD. That means your environmental data becomes a condition of trade, not a nice-to-have.',
  },
  {
    label: 'Consultants who cost more than the problem',
    description: 'Sustainability consultants charge thousands per day. B Corp prep alone can run to five figures. You shouldn\'t need an agency to know your own footprint.',
  },
];

export const LandingPainPoints = () => {
  const ref = useRef(null);
  const isInView = useInView(ref, { once: true, margin: '-80px' });

  return (
    <section ref={ref} className="py-24 md:py-32 px-6 md:px-20 bg-[#050505] text-white border-t border-white/10">
      <div className="max-w-7xl mx-auto">
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mb-16"
        >
          <h2 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase mb-6">The Reality</h2>
          <p className="font-serif text-4xl md:text-6xl leading-tight max-w-3xl">
            Sound familiar?
          </p>
        </motion.div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-px bg-white/10">
          {painPoints.map((point, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 20 }}
              animate={isInView ? { opacity: 1, y: 0 } : {}}
              transition={{ delay: i * 0.1, duration: 0.6 }}
              className="bg-[#050505] p-8 md:p-10"
            >
              <div className="w-2 h-2 rounded-full bg-[#ccff00] mb-6" />
              <h3 className="font-serif text-xl md:text-2xl mb-4 leading-snug">{point.label}</h3>
              <p className="font-mono text-sm text-gray-400 leading-relaxed">{point.description}</p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={isInView ? { opacity: 1, y: 0 } : {}}
          transition={{ delay: 0.7, duration: 0.6 }}
          className="mt-16 border-l border-[#ccff00] pl-8 max-w-2xl"
        >
          <p className="font-serif text-2xl md:text-3xl italic text-gray-200 leading-snug">
            alkatera is the only platform built specifically for the drinks industry, going far beyond carbon to give you the full picture.
          </p>
        </motion.div>
      </div>
    </section>
  );
};
