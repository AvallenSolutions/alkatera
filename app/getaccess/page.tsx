'use client';

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Flower2, Trees, Check, Minus } from 'lucide-react';
import { Navigation } from '@/marketing/components/Navigation';
import { Footer } from '@/marketing/components/Footer';
import { cn } from '@/lib/utils';

// --- Seed Icon ---
const SeedIcon = ({ className, size = 24 }: { className?: string; size?: number }) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
  >
    <path d="M12 22s-8-4.5-8-11.8A8 8 0 0 1 12 3a8 8 0 0 1 8 7.2c0 7.3-8 11.8-8 11.8z" />
    <path d="M12 13a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" />
  </svg>
);

// --- Types ---
type FeatureValue = boolean | string;

interface FeatureRow {
  name: string;
  seed: FeatureValue;
  blossom: FeatureValue;
  canopy: FeatureValue;
}

interface FeatureSection {
  title: string;
  rows: FeatureRow[];
}

// --- Feature Matrix Data ---
const featureSections: FeatureSection[] = [
  {
    title: "Core Platform",
    rows: [
      { name: "Dashboard & Vitality Score", seed: true, blossom: true, canopy: true },
      { name: "Facilities Management", seed: true, blossom: true, canopy: true },
      { name: "Fleet Overview & Activity Log", seed: true, blossom: true, canopy: true },
      { name: "Supplier Directory", seed: true, blossom: true, canopy: true },
      { name: "Vehicle Registry", seed: false, blossom: true, canopy: true },
      { name: "Supply Chain Network Mapping", seed: false, blossom: true, canopy: true },
      { name: "Company Emissions (Current Year)", seed: true, blossom: true, canopy: true },
      { name: "Full Scope 3 Categories", seed: false, blossom: true, canopy: true },
    ],
  },
  {
    title: "Products & LCA",
    rows: [
      { name: "Product Management", seed: true, blossom: true, canopy: true },
      { name: "Product Passport", seed: true, blossom: true, canopy: true },
      { name: "Carbon Footprint (GHG)", seed: true, blossom: true, canopy: true },
      { name: "PDF Report Export", seed: true, blossom: true, canopy: true },
      { name: "Water Footprint", seed: false, blossom: true, canopy: true },
      { name: "Circularity & Waste", seed: false, blossom: true, canopy: true },
      { name: "Land Use Impact", seed: false, blossom: true, canopy: true },
      { name: "Resource Use Tracking", seed: false, blossom: true, canopy: true },
      { name: "Year-over-Year Comparisons", seed: false, blossom: false, canopy: true },
      { name: "Advanced Data Quality Scoring", seed: false, blossom: false, canopy: true },
      { name: "EF 3.1 Single Score", seed: false, blossom: false, canopy: true },
    ],
  },
  {
    title: "AI-Powered Tools",
    rows: [
      { name: "Rosa AI Assistant", seed: "25/mo", blossom: "100/mo", canopy: "Unlimited" },
      { name: "Greenwash Guardian", seed: "Website only", blossom: "Website + 5 docs", canopy: "Unlimited" },
    ],
  },
  {
    title: "ESG Modules",
    rows: [
      { name: "People & Culture: Fair Work", seed: false, blossom: true, canopy: true },
      { name: "People & Culture: Diversity & Inclusion", seed: false, blossom: true, canopy: true },
      { name: "People & Culture: Wellbeing", seed: false, blossom: false, canopy: true },
      { name: "People & Culture: Training & Development", seed: false, blossom: false, canopy: true },
      { name: "Governance & Ethics", seed: false, blossom: false, canopy: true },
      { name: "Community Impact: Charitable Giving", seed: false, blossom: true, canopy: true },
      { name: "Community Impact: Volunteering", seed: false, blossom: true, canopy: true },
      { name: "Community Impact: Local Impact", seed: false, blossom: false, canopy: true },
      { name: "Community Impact: Impact Stories", seed: false, blossom: false, canopy: true },
    ],
  },
  {
    title: "Certifications & Compliance",
    rows: [
      { name: "B Corp Certification Tracking", seed: false, blossom: true, canopy: true },
      { name: "CDP Climate Change Disclosure", seed: false, blossom: true, canopy: true },
      { name: "CSRD Compliance", seed: false, blossom: false, canopy: true },
      { name: "GRI Standards", seed: false, blossom: false, canopy: true },
      { name: "ISO 14001", seed: false, blossom: false, canopy: true },
      { name: "ISO 50001", seed: false, blossom: false, canopy: true },
      { name: "SBTi Targets", seed: false, blossom: false, canopy: true },
      { name: "Gap Analysis", seed: false, blossom: false, canopy: true },
      { name: "Audit Packages", seed: false, blossom: false, canopy: true },
      { name: "Third-Party Verification Support", seed: false, blossom: false, canopy: true },
    ],
  },
  {
    title: "Resources",
    rows: [
      { name: "Knowledge Bank (Read)", seed: true, blossom: true, canopy: true },
      { name: "Knowledge Bank (Upload & Manage)", seed: false, blossom: true, canopy: true },
    ],
  },
];

const FeatureCell = ({ value }: { value: FeatureValue }) => {
  if (typeof value === 'string') {
    return <span className="text-xs text-white/70 font-mono">{value}</span>;
  }
  if (value) {
    return <Check size={16} className="text-[#ccff00]" />;
  }
  return <Minus size={14} className="text-white/15" />;
};

// --- Tier Data ---
const tiers = [
  {
    name: "Seed",
    price: "£99",
    tagline: "For boutique brands establishing their sustainability foundations.",
    icon: SeedIcon,
    limits: ["5 Products", "5 LCA Calculations", "1 Team Member", "1 Facility", "5 Suppliers", "10 Reports/mo"],
    features: [
      "Dashboard & Vitality Score",
      "Carbon Footprint (GHG) per product",
      "Product Passport",
      "Company Emissions (Current Year)",
      "Rosa AI Assistant (25/mo)",
      "Greenwash Guardian (Website only)",
      "Knowledge Bank (Read)",
    ],
    buttonText: "Select Plan",
    highlight: false,
  },
  {
    name: "Blossom",
    price: "£249",
    tagline: "For scaling brands ready to turn impact into a strategic advantage.",
    icon: Flower2,
    limits: ["20 Products", "20 LCA Calculations", "5 Team Members", "3 Facilities", "25 Suppliers", "50 Reports/mo"],
    features: [
      "Everything in Seed, plus:",
      "Water, Circularity, Land Use & Resource impacts",
      "Full Scope 3 Categories",
      "Vehicle Registry & Supply Chain Mapping",
      "People & Culture, Community Impact modules",
      "B Corp & CDP tracking",
      "Rosa AI (100/mo) & Greenwash Guardian (5 docs/mo)",
      "Knowledge Bank (Upload & Manage)",
    ],
    buttonText: "Start Now",
    highlight: true,
  },
  {
    name: "Canopy",
    price: "£599",
    tagline: "Comprehensive ecosystem management for established organisations.",
    icon: Trees,
    limits: ["50 Products", "50 LCA Calculations", "10 Team Members", "8 Facilities", "100 Suppliers", "200 Reports/mo"],
    features: [
      "Everything in Blossom, plus:",
      "Year-over-Year Comparisons",
      "Advanced Data Quality Scoring & EF 3.1",
      "All ESG modules including Governance & Ethics",
      "All certifications: CSRD, GRI, ISO, SBTi",
      "Gap Analysis, Audit Packages & Verification Support",
      "Unlimited Rosa AI & Greenwash Guardian",
    ],
    buttonText: "Contact Sales",
    highlight: false,
  },
];

export default function GetAccessPage() {
  const [showMatrix, setShowMatrix] = useState(false);

  return (
    <div className="min-h-screen bg-[#050505] text-white">
      <Navigation />

      {/* Hero Section */}
      <section className="relative min-h-[60vh] w-full overflow-hidden flex items-center justify-center pt-32 pb-16">
        {/* Background Image */}
        <div className="absolute inset-0 z-0">
          <img
            src="https://images.unsplash.com/photo-1615634260167-c8cdede054de?q=80&w=2574&auto=format&fit=crop"
            alt=""
            className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-b from-[#050505] via-[#050505]/80 to-[#050505]" />
        </div>

        {/* Grid Overlay */}
        <div
          className="absolute inset-0 opacity-20 z-0"
          style={{
            backgroundImage:
              'linear-gradient(#333 1px, transparent 1px), linear-gradient(90deg, #333 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />

        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          className="relative z-10 text-center px-6"
        >
          <div className="inline-block mb-6 px-5 py-2 border border-[#ccff00]/30 bg-[#ccff00]/5 rounded-full">
            <span className="font-mono text-[#ccff00] text-xs tracking-widest uppercase">
              Founding Partner Pricing — Limited Availability
            </span>
          </div>
          <h1 className="font-serif text-4xl md:text-6xl lg:text-7xl mb-4">
            Choose your impact scale.
          </h1>
          <p className="text-white/50 text-lg max-w-2xl mx-auto leading-relaxed">
            Lock in exclusive founding partner rates. These prices are available for a limited time
            only and will be honoured for the lifetime of your subscription.
          </p>
        </motion.div>
      </section>

      {/* Pricing Cards */}
      <section className="relative px-6 md:px-20 pb-20 overflow-hidden">
        {/* Radial glow */}
        <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ccff00]/5 via-transparent to-transparent pointer-events-none" />

        <div className="relative z-10 max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
            {tiers.map((tier, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className={cn(
                  "border p-8 flex flex-col transition-all duration-500 group relative",
                  tier.highlight
                    ? "border-[#ccff00] bg-[#ccff00]/5 md:-translate-y-4 shadow-[0_20px_50px_rgba(204,255,0,0.1)]"
                    : "border-white/10 bg-white/5 hover:border-white/30"
                )}
              >
                {tier.highlight && (
                  <div className="absolute top-0 right-0 bg-[#ccff00] text-black text-[10px] font-bold uppercase px-3 py-1 tracking-widest">
                    Recommended
                  </div>
                )}

                <div className="flex items-center justify-between mb-4">
                  <h4
                    className={cn(
                      "font-serif text-3xl",
                      tier.highlight ? "text-[#ccff00]" : "text-white"
                    )}
                  >
                    {tier.name}
                  </h4>
                  <tier.icon className={tier.highlight ? "text-[#ccff00]" : "text-gray-500"} />
                </div>

                <div className="mb-6">
                  <div className="flex items-baseline gap-1 mb-2">
                    <span
                      className={cn(
                        "font-serif text-4xl",
                        tier.highlight ? "text-[#ccff00]" : "text-white"
                      )}
                    >
                      {tier.price}
                    </span>
                    <span className="text-white/40 text-sm">/month</span>
                  </div>
                  <p className="text-white/60 text-sm leading-relaxed">{tier.tagline}</p>
                </div>

                {/* Limits */}
                <div className="grid grid-cols-2 gap-2 mb-8 p-4 bg-white/5 rounded">
                  {tier.limits.map((limit, lIdx) => (
                    <div
                      key={lIdx}
                      className="font-mono text-[10px] uppercase tracking-wider text-white/50"
                    >
                      {limit}
                    </div>
                  ))}
                </div>

                <ul className="space-y-3 mb-12 flex-1">
                  {tier.features.map((feat, fIdx) => (
                    <li key={fIdx} className="flex items-start gap-3 text-sm group/item">
                      <div
                        className={cn(
                          "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors",
                          tier.highlight
                            ? "bg-[#ccff00]"
                            : "bg-gray-500 group-hover/item:bg-white"
                        )}
                      />
                      <span
                        className={cn(
                          "leading-relaxed transition-colors",
                          tier.highlight
                            ? "text-white"
                            : "text-gray-400 group-hover/item:text-white",
                          feat.startsWith("Everything") &&
                            "font-serif italic text-white/90 border-b border-white/10 pb-1 w-full"
                        )}
                      >
                        {feat}
                      </span>
                    </li>
                  ))}
                </ul>

                <a
                  href={tier.name === 'Canopy' ? `/contact?tier=${tier.name}` : `/login?tier=${tier.name}`}
                  className={cn(
                    "w-full py-5 font-mono uppercase text-xs tracking-widest font-bold transition-all duration-300 text-center block",
                    tier.highlight
                      ? "bg-[#ccff00] text-black hover:opacity-90 hover:scale-[1.02]"
                      : "border border-white/20 hover:bg-white hover:text-black"
                  )}
                >
                  {tier.buttonText}
                </a>
              </motion.div>
            ))}
          </div>

          {/* Feature Matrix Toggle */}
          <div className="mt-16 text-center">
            <button
              onClick={() => setShowMatrix(!showMatrix)}
              className="font-mono text-xs uppercase tracking-widest text-white/40 hover:text-[#ccff00] transition-colors border border-white/10 hover:border-[#ccff00]/30 px-8 py-3"
            >
              {showMatrix ? 'Hide' : 'View'} Full Feature Comparison
            </button>
          </div>

          {/* Full Feature Matrix */}
          {showMatrix && (
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="mt-12 overflow-x-auto"
            >
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10">
                    <th className="text-left py-4 pr-4 text-white/40 font-mono text-xs uppercase tracking-wider w-1/2">
                      Feature
                    </th>
                    <th className="text-center py-4 px-4 text-white/40 font-mono text-xs uppercase tracking-wider">
                      Seed
                    </th>
                    <th className="text-center py-4 px-4 text-[#ccff00]/60 font-mono text-xs uppercase tracking-wider">
                      Blossom
                    </th>
                    <th className="text-center py-4 px-4 text-white/40 font-mono text-xs uppercase tracking-wider">
                      Canopy
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {featureSections.map((section, sIdx) => (
                    <React.Fragment key={sIdx}>
                      <tr>
                        <td colSpan={4} className="pt-8 pb-3">
                          <span className="font-mono text-[#ccff00] text-xs uppercase tracking-[0.2em]">
                            {section.title}
                          </span>
                        </td>
                      </tr>
                      {section.rows.map((row, rIdx) => (
                        <tr
                          key={rIdx}
                          className="border-b border-white/5 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="py-3 pr-4 text-white/70">{row.name}</td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center">
                              <FeatureCell value={row.seed} />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center bg-[#ccff00]/[0.02]">
                            <div className="flex justify-center">
                              <FeatureCell value={row.blossom} />
                            </div>
                          </td>
                          <td className="py-3 px-4 text-center">
                            <div className="flex justify-center">
                              <FeatureCell value={row.canopy} />
                            </div>
                          </td>
                        </tr>
                      ))}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </div>
      </section>

      <Footer />
    </div>
  );
}
