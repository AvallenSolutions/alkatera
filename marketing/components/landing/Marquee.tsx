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
        <span className="mx-8">Carbon Footprint •</span>
        <span className="mx-8">Water Stewardship •</span>
        <span className="mx-8">Land Use & Biodiversity •</span>
        <span className="mx-8">Waste & Circularity •</span>
        <span className="mx-8">Greenwash Defence •</span>
        <span className="mx-8">Supply Chain Mapping •</span>
        <span className="mx-8">B Corp Tracking •</span>
        <span className="mx-8">CSRD Reporting •</span>
        <span className="mx-8">Life Cycle Assessment •</span>
        <span className="mx-8">Built for Drinks •</span>
        <span className="mx-8">Carbon Footprint •</span>
        <span className="mx-8">Water Stewardship •</span>
        <span className="mx-8">Land Use & Biodiversity •</span>
        <span className="mx-8">Waste & Circularity •</span>
        <span className="mx-8">Greenwash Defence •</span>
        <span className="mx-8">Supply Chain Mapping •</span>
        <span className="mx-8">B Corp Tracking •</span>
        <span className="mx-8">CSRD Reporting •</span>
        <span className="mx-8">Life Cycle Assessment •</span>
        <span className="mx-8">Built for Drinks •</span>
      </motion.div>
    </div>
  );
};
