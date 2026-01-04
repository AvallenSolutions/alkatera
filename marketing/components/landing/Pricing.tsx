'use client';

import { Flower2, Trees } from 'lucide-react';
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

export const LandingPricing = ({ onOpenContact }: PricingProps) => {
  const tiers = [
    {
      name: "Seed",
      tagline: "For boutique brands establishing their sustainability foundations.",
      icon: SeedIcon,
      capacity: "5 Products | 1 Facility | 1 User",
      features: [
        "Operational Footprinting: Automated tracking for Scope 1, 2, and essential Scope 3 (Carbon & Water).",
        "Supply Chain Visibility: Foundational upstream mapping to identify high-impact hotspots in your value chain.",
        "B Corp Alignment: Data structured specifically to simplify the environmental section of your B Corp Assessment.",
        "Unlimited Reporting: Generate as many standard audit-ready reports as your business needs for retail and investor tenders."
      ],
      buttonText: "Select Plan",
      highlight: false
    },
    {
      name: "Blossom",
      tagline: "For scaling brands ready to turn impact into a strategic advantage.",
      icon: Flower2,
      capacity: "20 Products | 3 Facilities | 5 Users",
      features: [
        "Everything in Seed, plus:",
        "Full Product LCA: Cradle-to-gate impact analysis for every SKU in your portfolio.",
        "Customisable Sustainability Reporting: Design and export bespoke reports tailored to your brand's specific aesthetic and stakeholder needs.",
        "B Corp Performance Hub: Strategic tools to track and improve your score over time, moving from compliance to leadership.",
        "'What-If' Scenario Modelling: Test packaging and recipe changes in a digital sandbox before committing to production.",
        "Anti-Greenwash 'Claim Check': Verify your marketing claims against live data to ensure total regulatory safety."
      ],
      buttonText: "Start Now",
      highlight: true
    },
    {
      name: "Canopy",
      tagline: "Comprehensive ecosystem management for established organisations.",
      icon: Trees,
      capacity: "50 Products | 8 Facilities | 10 Users",
      features: [
        "Everything in Blossom, plus:",
        "Advanced Supply Chain Engagement: Tools to gather primary data directly from growers and suppliers for 100% precision.",
        "Land & Biodiversity Mapping: Measure your impact on soil health and local ecosystems beyond just carbon.",
        "Strategic Goal Setting: Define and track SMART environmental targets across your entire multi-brand portfolio.",
        "Human-in-the-Loop: Priority access to our experts for strategy validation and complex data verification.",
        "System Integration: Full API connectivity to your existing ERP, accounting, and operational software."
      ],
      buttonText: "Contact Sales",
      highlight: false
    }
  ];

  return (
    <section className="py-32 px-6 md:px-20 bg-[#050505] text-white relative overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-[#ccff00]/5 via-black to-black pointer-events-none" />

      <div className="relative z-10 max-w-7xl mx-auto">
        <div className="text-center mb-20">
          <h2 className="font-mono text-[#ccff00] text-sm tracking-[0.2em] uppercase mb-4">Invest in Future</h2>
          <h3 className="font-serif text-4xl md:text-6xl">Choose your impact scale.</h3>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 items-stretch">
          {tiers.map((tier, idx) => (
            <div
              key={idx}
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

              <div className="flex items-center justify-between mb-8">
                <h4 className={cn("font-serif text-3xl", tier.highlight ? "text-[#ccff00]" : "text-white")}>
                  {tier.name}
                </h4>
                <tier.icon className={tier.highlight ? "text-[#ccff00]" : "text-gray-500"} />
              </div>

              <div className="mb-8">
                <p className="text-white font-medium text-sm mb-2">{tier.tagline}</p>
                <p className="font-mono text-[10px] uppercase tracking-wider text-[#ccff00]/80">Capacity: {tier.capacity}</p>
              </div>

              <ul className="space-y-4 mb-12 flex-1">
                {tier.features.map((feat, fIdx) => (
                  <li key={fIdx} className="flex items-start gap-3 text-sm group/item">
                    <div className={cn(
                      "w-1.5 h-1.5 rounded-full mt-1.5 shrink-0 transition-colors",
                      tier.highlight ? "bg-[#ccff00]" : "bg-gray-500 group-hover/item:bg-white"
                    )} />
                    <span className={cn(
                      "leading-relaxed transition-colors",
                      tier.highlight ? "text-white" : "text-gray-400 group-hover/item:text-white",
                      feat.startsWith("Everything") && "font-serif italic text-white/90 border-b border-white/10 pb-1 w-full"
                    )}>
                      {feat}
                    </span>
                  </li>
                ))}
              </ul>

              <button
                onClick={onOpenContact}
                className={cn(
                  "w-full py-5 font-mono uppercase text-xs tracking-widest font-bold transition-all duration-300",
                  tier.highlight
                    ? "bg-[#ccff00] text-black hover:opacity-90 hover:scale-[1.02]"
                    : "border border-white/20 hover:bg-white hover:text-black"
                )}
              >
                {tier.buttonText}
              </button>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
