'use client';

import React, { useState } from 'react';
import { Flower2, Trees, Check, Minus } from 'lucide-react';
import { cn } from '@/lib/utils';

const SeedIcon = ({ className, size = 24 }: { className?: string, size?: number }) => (
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

interface PricingProps {
  onOpenContact: () => void;
}

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
    ]
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
      { name: "LCA: Cradle-to-Gate", seed: true, blossom: true, canopy: true },
      { name: "LCA: Cradle-to-Shelf (Distribution)", seed: false, blossom: true, canopy: true },
      { name: "LCA: Cradle-to-Consumer (Use Phase)", seed: false, blossom: false, canopy: true },
      { name: "LCA: Cradle-to-Grave (End of Life)", seed: false, blossom: false, canopy: true },
    ]
  },
  {
    title: "AI-Powered Tools",
    rows: [
      { name: "Rosa AI Assistant", seed: "25/mo", blossom: "100/mo", canopy: "Unlimited" },
      { name: "Greenwash Guardian", seed: "Website only", blossom: "Website + 5 docs", canopy: "Unlimited" },
    ]
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
    ]
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
    ]
  },
  {
    title: "Resources",
    rows: [
      { name: "Knowledge Bank (Read)", seed: true, blossom: true, canopy: true },
      { name: "Knowledge Bank (Upload & Manage)", seed: false, blossom: true, canopy: true },
    ]
  },
];

const FeatureCell = ({ value }: { value: FeatureValue }) => {
  if (typeof value === 'string') {
    return <span className="text-xs text-muted-foreground font-mono">{value}</span>;
  }
  if (value) {
    return <Check size={16} className="text-[#047857]" />;
  }
  return <Minus size={14} className="text-foreground/15" />;
};

const tiers = [
  {
    name: "Seed",
    monthly: { original: 199, founder: 99, saving: 100 },
    annual: { original: 1990, founder: 990, saving: 1000 },
    tagline: "For boutique brands establishing their sustainability foundations.",
    icon: SeedIcon,
    limits: ["10 Products", "10 LCA Calculations", "2 Team Members", "2 Facilities", "10 Suppliers", "10 Reports/mo"],
    features: [
      "Carbon Footprint (GHG) per product",
      "LCA: Cradle-to-Gate",
      "Product Passport",
      "Rosa AI Assistant (25/mo)",
      "Company Emissions (Current Year)",
      "Dashboard & Vitality Score",
      "Greenwash Guardian (Website only)",
      "Knowledge Bank (Read)",
    ],
    buttonText: "Select Plan",
    highlight: false,
  },
  {
    name: "Blossom",
    monthly: { original: 399, founder: 249, saving: 150 },
    annual: { original: 3990, founder: 2490, saving: 1500 },
    tagline: "For scaling brands ready to turn impact into a strategic advantage.",
    icon: Flower2,
    limits: ["30 Products", "30 LCA Calculations", "5 Team Members", "3 Facilities", "50 Suppliers", "50 Reports/mo"],
    features: [
      "Everything in Seed, plus:",
      "Full Scope 3 Categories",
      "LCA: Cradle-to-Shelf (Distribution)",
      "Water, Circularity, Land Use & Resource impacts",
      "People & Culture, Community Impact modules",
      "Vehicle Registry & Supply Chain Mapping",
      "B Corp & CDP tracking",
      "Rosa AI (100/mo) & Greenwash Guardian (5 docs/mo)",
      "Knowledge Bank (Upload & Manage)",
    ],
    buttonText: "Start Now",
    highlight: true,
  },
  {
    name: "Canopy",
    monthly: { original: 899, founder: 599, saving: 300 },
    annual: { original: 8990, founder: 5990, saving: 3000 },
    tagline: "Comprehensive ecosystem management for established organisations.",
    icon: Trees,
    limits: ["100 Products", "100 LCA Calculations", "10 Team Members", "10 Facilities", "200 Suppliers", "200 Reports/mo"],
    features: [
      "Everything in Blossom, plus:",
      "Impact Valuation: Monetise Your Sustainability Impact",
      "Full Lifecycle LCA (Cradle-to-Grave)",
      "Gap Analysis, Audit Packages & Verification Support",
      "All ESG modules including Governance & Ethics",
      "Year-over-Year Comparisons",
      "Advanced Data Quality Scoring & EF 3.1",
      "Unlimited Rosa AI & Greenwash Guardian",
    ],
    buttonText: "Contact Sales",
    highlight: false,
  },
];

/* The three tiers take the studio inks: Seed forest, Blossom cobalt
   (the one saturated poster block in this section), Canopy brick. */
const tierAccentText = ['text-[#205E40]', 'text-[#2B46C0]', 'text-[#BF4B2A]'];
const tierAccentDot = ['bg-[#205E40]', 'bg-[#F2F1EA]', 'bg-[#BF4B2A]'];

export const LandingPricing = ({ onOpenContact }: PricingProps) => {
  const [showMatrix, setShowMatrix] = useState(false);
  const [billingInterval, setBillingInterval] = useState<'monthly' | 'annual'>('monthly');

  return (
    <section className="relative py-24 px-6 md:px-20 bg-background text-foreground overflow-hidden">
      <div className="relative z-10 max-w-7xl mx-auto">
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-block mb-6">
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-[#A97C14]">Founding Partner Pricing: Limited Availability</span>
          </div>
          <h3 className="font-display font-bold tracking-[-0.035em] text-4xl md:text-6xl mb-4 leading-[0.95]">Choose your impact scale.</h3>
          <p className="text-muted-foreground text-lg max-w-2xl mx-auto leading-relaxed">
            Lock in exclusive founding partner rates. These prices are available for a limited time only.
          </p>

          {/* Billing Toggle */}
          <div className="mt-8 flex items-center justify-center gap-3">
            <button
              onClick={() => setBillingInterval('monthly')}
              className={cn(
                "font-mono text-[10px] font-bold uppercase tracking-[0.22em] px-5 py-2.5 rounded-full transition-colors duration-200 ease-studio",
                billingInterval === 'monthly'
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              Monthly
            </button>
            <button
              onClick={() => setBillingInterval('annual')}
              className={cn(
                "font-mono text-[10px] font-bold uppercase tracking-[0.22em] px-5 py-2.5 rounded-full transition-colors duration-200 ease-studio",
                billingInterval === 'annual'
                  ? "bg-primary text-primary-foreground"
                  : "border border-border text-muted-foreground hover:text-foreground hover:border-foreground/40"
              )}
            >
              Annual
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
              className={cn(
                "border p-8 flex flex-col transition-colors duration-200 ease-studio group relative rounded-[6px]",
                tier.highlight
                  ? "border-[#2B46C0] bg-[#2B46C0] text-[#F2F1EA] md:-translate-y-4"
                  : "border-border bg-card text-card-foreground"
              )}
            >
              {tier.highlight && (
                <div className="absolute top-0 right-0 bg-[#F2F1EA] text-[#1A1B1D] text-[10px] font-mono font-bold uppercase px-3 py-1 tracking-[0.22em] rounded-tr-[6px] rounded-bl-[6px]">
                  Recommended
                </div>
              )}

              <div className="flex items-center justify-between mb-4">
                <h4 className={cn("font-display font-bold tracking-[-0.02em] text-3xl", tier.highlight ? "text-[#F2F1EA]" : "text-foreground")}>
                  {tier.name}
                </h4>
                <tier.icon className={tier.highlight ? "text-[#F2F1EA]/80" : tierAccentText[idx]} />
              </div>

              <div className="mb-6">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={cn("text-lg line-through font-display tabular-nums", tier.highlight ? "text-[#F2F1EA]/50" : "text-muted-foreground")}>
                    £{billingInterval === 'monthly' ? tier.monthly.original : tier.annual.original.toLocaleString()}
                  </span>
                  <span className={cn("font-display font-bold tracking-[-0.02em] tabular-nums text-4xl", tier.highlight ? "text-[#F2F1EA]" : "text-foreground")}>
                    £{billingInterval === 'monthly' ? tier.monthly.founder : tier.annual.founder.toLocaleString()}
                  </span>
                  <span className={cn("text-sm", tier.highlight ? "text-[#F2F1EA]/60" : "text-muted-foreground")}>/{billingInterval === 'monthly' ? 'mo' : 'yr'}</span>
                </div>
                <div className="mb-3">
                  <span className={cn("font-mono text-[10px] tracking-[0.22em] uppercase font-bold", tier.highlight ? "text-[#F2F1EA]/90" : "text-[#A97C14]")}>
                    Save £{billingInterval === 'monthly'
                      ? tier.monthly.saving
                      : tier.annual.saving.toLocaleString()}{billingInterval === 'monthly' ? '/mo' : '/yr'}
                  </span>
                </div>
                <p className={cn("text-sm leading-relaxed", tier.highlight ? "text-[#F2F1EA]/80" : "text-muted-foreground")}>{tier.tagline}</p>
              </div>

              {/* Limits */}
              <div className={cn("grid grid-cols-2 gap-2 mb-8 p-4 rounded-[6px]", tier.highlight ? "bg-[#F2F1EA]/10" : "bg-secondary")}>
                {tier.limits.map((limit, lIdx) => (
                  <div key={lIdx} className={cn("font-mono text-[10px] uppercase tracking-[0.22em]", tier.highlight ? "text-[#F2F1EA]/70" : "text-muted-foreground")}>
                    {limit}
                  </div>
                ))}
              </div>

              <ul className="space-y-3 mb-12 flex-1">
                {tier.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3 text-sm group/item">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0",
                      tierAccentDot[idx]
                    )} />
                    <span className={cn(
                      "leading-relaxed",
                      tier.highlight ? "text-[#F2F1EA]" : "text-foreground/80",
                      feat.startsWith("Everything") && cn("font-medium pb-1 w-full border-b", tier.highlight ? "border-[#F2F1EA]/20" : "border-border")
                    )}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <a
                href={tier.name === 'Canopy' ? `/contact?tier=${tier.name}` : `/getaccess/signup?tier=${tier.name}`}
                className={cn(
                  "w-full py-5 font-mono uppercase text-[11px] tracking-[0.22em] font-bold transition-opacity duration-200 ease-studio text-center block rounded-full hover:opacity-90",
                  tier.highlight
                    ? "bg-[#F2F1EA] text-[#1A1B1D]"
                    : "bg-primary text-primary-foreground"
                )}
              >
                {tier.buttonText}
              </a>
            </div>
          ))}
        </div>

        {/* Free Trial CTA band */}
        <div className="mt-12 max-w-3xl mx-auto text-center border border-border bg-card rounded-[6px] p-8">
          <h3 className="font-display font-bold tracking-[-0.02em] text-2xl md:text-3xl text-foreground mb-2">
            Prefer to try before you buy?
          </h3>
          <p className="text-muted-foreground text-sm max-w-xl mx-auto mb-6">
            Start a 30-day free trial. Add a facility, build a product LCA and explore the
            platform. We never charge automatically when your trial ends, you choose if and
            when to continue.
          </p>
          <a
            href="/getaccess/signup?trial=true"
            className="inline-block px-10 py-4 bg-primary text-primary-foreground font-mono uppercase text-[11px] tracking-[0.22em] font-bold rounded-full hover:opacity-90 transition-opacity duration-200 ease-studio"
          >
            Start free trial
          </a>
        </div>

        {/* Feature Matrix Toggle */}
        <div className="mt-16 text-center">
          <button
            onClick={() => setShowMatrix(!showMatrix)}
            className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground hover:text-foreground transition-colors duration-200 ease-studio border border-border hover:border-foreground/40 px-8 py-3 rounded-full"
          >
            {showMatrix ? "Hide" : "View"} Full Feature Comparison
          </button>
        </div>

        {/* Full Feature Matrix */}
        {showMatrix && (
          <div className="mt-12 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-4 pr-4 text-muted-foreground font-mono text-[10px] font-bold uppercase tracking-[0.22em] w-1/2">Feature</th>
                  <th className="text-center py-4 px-4 text-muted-foreground font-mono text-[10px] font-bold uppercase tracking-[0.22em]">Seed</th>
                  <th className="text-center py-4 px-4 text-[#2B46C0] font-mono text-[10px] font-bold uppercase tracking-[0.22em]">Blossom</th>
                  <th className="text-center py-4 px-4 text-muted-foreground font-mono text-[10px] font-bold uppercase tracking-[0.22em]">Canopy</th>
                </tr>
              </thead>
              <tbody>
                {featureSections.map((section, sIdx) => (
                  <React.Fragment key={sIdx}>
                    <tr>
                      <td colSpan={4} className="pt-8 pb-3">
                        <span className="font-mono text-[#2B46C0] text-[10px] font-bold uppercase tracking-[0.22em]">{section.title}</span>
                      </td>
                    </tr>
                    {section.rows.map((row, rIdx) => (
                      <tr key={rIdx} className="border-b border-border/60 hover:bg-card transition-colors duration-200 ease-studio">
                        <td className="py-3 pr-4 text-foreground/80">{row.name}</td>
                        <td className="py-3 px-4 text-center"><div className="flex justify-center"><FeatureCell value={row.seed} /></div></td>
                        <td className="py-3 px-4 text-center bg-[#2B46C0]/[0.04]"><div className="flex justify-center"><FeatureCell value={row.blossom} /></div></td>
                        <td className="py-3 px-4 text-center"><div className="flex justify-center"><FeatureCell value={row.canopy} /></div></td>
                      </tr>
                    ))}
                  </React.Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
};
