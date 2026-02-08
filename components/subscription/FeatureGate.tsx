"use client";

import React from "react";
import Link from "next/link";
import {
  Lock,
  Sparkles,
  ArrowRight,
  Check,
  Leaf,
  Users,
  BarChart3,
  Shield,
  Award,
  Dog,
  FileText,
  Heart,
  Scale,
  Gift,
} from "lucide-react";
import { useFeatureGate, FeatureCode, TierName } from "@/hooks/useSubscription";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { TIER_PRICING } from "@/lib/stripe-config";

interface FeatureGateProps {
  feature: FeatureCode;
  children: React.ReactNode;
  fallback?: React.ReactNode;
  showLockIcon?: boolean;
  showUpgradePrompt?: boolean;
  className?: string;
}

export function FeatureGate({
  feature,
  children,
  fallback,
  showLockIcon = true,
  showUpgradePrompt = true,
  className,
}: FeatureGateProps) {
  const { isEnabled, isLoading, currentTier, requiredTierForFeature } =
    useFeatureGate(feature);

  if (isLoading) {
    return <div className={cn("animate-pulse bg-muted rounded", className)} />;
  }

  if (isEnabled) {
    return <>{children}</>;
  }

  if (fallback) {
    return <>{fallback}</>;
  }

  if (!showUpgradePrompt) {
    return null;
  }

  return (
    <LockedFeaturePage
      feature={feature}
      currentTier={currentTier}
      requiredTier={requiredTierForFeature}
      className={className}
    />
  );
}

// ============================================================================
// Feature metadata for the locked page
// ============================================================================

interface FeatureInfo {
  name: string;
  description: string;
  benefits: string[];
  icon: React.ElementType;
  category: string;
}

const featureInfo: Partial<Record<FeatureCode, FeatureInfo>> = {
  // ESG Modules - People & Culture
  people_fair_work: {
    name: "Fair Work",
    description:
      "Track and improve fair work practices across your organisation, including living wages, working hours, and employee rights compliance.",
    benefits: [
      "Monitor fair wage compliance across your workforce",
      "Track working hours and overtime patterns",
      "Document employee rights and grievance procedures",
      "Generate fair work reports for stakeholders",
    ],
    icon: Users,
    category: "People & Culture",
  },
  people_diversity_inclusion: {
    name: "Diversity & Inclusion",
    description:
      "Measure and advance diversity, equity, and inclusion across your organisation with comprehensive tracking and reporting.",
    benefits: [
      "Track workforce diversity demographics",
      "Monitor pay equity across groups",
      "Set and measure inclusion targets",
      "Generate D&I reports for ESG disclosures",
    ],
    icon: Users,
    category: "People & Culture",
  },
  people_wellbeing: {
    name: "Wellbeing",
    description:
      "Monitor employee wellbeing initiatives and their impact on your team's health, satisfaction, and productivity.",
    benefits: [
      "Track wellbeing programme participation",
      "Monitor employee satisfaction metrics",
      "Document mental health support initiatives",
      "Measure the impact of wellbeing investments",
    ],
    icon: Heart,
    category: "People & Culture",
  },
  people_training: {
    name: "Training & Development",
    description:
      "Manage sustainability training programmes and track employee development across your organisation.",
    benefits: [
      "Track training hours per employee",
      "Monitor sustainability literacy across teams",
      "Document professional development programmes",
      "Generate training compliance reports",
    ],
    icon: Users,
    category: "People & Culture",
  },
  // ESG Modules - Governance
  governance_ethics: {
    name: "Governance & Ethics",
    description:
      "Establish and monitor governance frameworks, ethical policies, and transparency practices for your organisation.",
    benefits: [
      "Document governance policies and board composition",
      "Track stakeholder engagement activities",
      "Monitor anti-corruption and ethics compliance",
      "Generate governance reports for ESG frameworks",
    ],
    icon: Scale,
    category: "Governance",
  },
  // ESG Modules - Community Impact
  community_charitable_giving: {
    name: "Charitable Giving",
    description:
      "Track your organisation's charitable contributions and measure the social impact of your giving programmes.",
    benefits: [
      "Record and categorise all charitable donations",
      "Track giving as a percentage of revenue",
      "Measure social impact of contributions",
      "Generate giving reports for stakeholders",
    ],
    icon: Gift,
    category: "Community Impact",
  },
  community_volunteering: {
    name: "Volunteering",
    description:
      "Manage and track employee volunteering programmes, hours, and their community impact.",
    benefits: [
      "Track volunteering hours per employee",
      "Document community partnerships",
      "Measure the impact of volunteering initiatives",
      "Boost employee engagement through social impact",
    ],
    icon: Heart,
    category: "Community Impact",
  },
  community_local_impact: {
    name: "Local Impact",
    description:
      "Measure and report on your organisation's positive impact on local communities and economies.",
    benefits: [
      "Track local hiring and procurement",
      "Document community investment programmes",
      "Monitor local environmental impact",
      "Generate local impact reports for stakeholders",
    ],
    icon: Leaf,
    category: "Community Impact",
  },
  community_impact_stories: {
    name: "Impact Stories",
    description:
      "Capture and share compelling narratives about your organisation's sustainability achievements and community impact.",
    benefits: [
      "Create rich impact case studies",
      "Showcase sustainability achievements",
      "Share stories across reports and marketing",
      "Build authentic stakeholder engagement",
    ],
    icon: FileText,
    category: "Community Impact",
  },
  // Certifications
  bcorp_tracking: {
    name: "B Corp Certification Tracking",
    description:
      "Track your progress towards B Corp certification with guided assessments, gap analysis, and improvement recommendations.",
    benefits: [
      "Track B Impact Assessment scores across all pillars",
      "Identify gaps and areas for improvement",
      "Monitor progress over time towards certification",
      "Access best practice guidance for each assessment area",
    ],
    icon: Award,
    category: "Certifications",
  },
  cdp_tracking: {
    name: "CDP Climate Change Disclosure",
    description:
      "Prepare and manage your CDP climate change disclosure with structured data collection and reporting workflows.",
    benefits: [
      "Structured CDP questionnaire guidance",
      "Automated data collection for key metrics",
      "Track disclosure scores and improvements",
      "Align climate data with CDP requirements",
    ],
    icon: BarChart3,
    category: "Certifications",
  },
  csrd_compliance: {
    name: "CSRD Compliance",
    description:
      "Prepare for the EU Corporate Sustainability Reporting Directive with comprehensive ESRS-aligned reporting tools.",
    benefits: [
      "Map your data to ESRS reporting standards",
      "Identify double materiality topics",
      "Generate CSRD-compliant sustainability statements",
      "Track readiness across all disclosure requirements",
    ],
    icon: Shield,
    category: "Certifications",
  },
  gri_standards: {
    name: "GRI Standards",
    description:
      "Report in accordance with Global Reporting Initiative Standards, the world's most widely used sustainability reporting framework.",
    benefits: [
      "Map disclosures to GRI Universal and Topic Standards",
      "Track material topics and stakeholder engagement",
      "Generate GRI content index automatically",
      "Align reporting with international best practice",
    ],
    icon: FileText,
    category: "Certifications",
  },
  iso_14001: {
    name: "ISO 14001",
    description:
      "Manage your environmental management system in alignment with ISO 14001 requirements for continuous improvement.",
    benefits: [
      "Track environmental aspects and impacts",
      "Monitor compliance obligations",
      "Document corrective actions and audits",
      "Prepare for ISO 14001 certification audits",
    ],
    icon: Shield,
    category: "Certifications",
  },
  iso_50001: {
    name: "ISO 50001",
    description:
      "Implement and manage your energy management system aligned with ISO 50001 for improved energy performance.",
    benefits: [
      "Track energy consumption and efficiency",
      "Set and monitor energy performance targets",
      "Document energy reviews and baselines",
      "Prepare for ISO 50001 certification audits",
    ],
    icon: Shield,
    category: "Certifications",
  },
  sbti_targets: {
    name: "SBTi Targets",
    description:
      "Set and track Science Based Targets aligned with the Paris Agreement for credible climate action.",
    benefits: [
      "Set near-term and net-zero targets",
      "Track emissions reductions against SBTi pathways",
      "Monitor Scope 1, 2 and 3 progress",
      "Prepare SBTi target validation submissions",
    ],
    icon: BarChart3,
    category: "Certifications",
  },
  // AI Tools
  rosa_ai_100: {
    name: "Rosa AI Assistant (100/mo)",
    description:
      "Get 100 monthly Rosa AI queries to help with sustainability analysis, reporting guidance, and data interpretation.",
    benefits: [
      "Ask Rosa complex sustainability questions",
      "Get guidance on reporting frameworks",
      "Analyse environmental data and trends",
      "Generate insights from your sustainability data",
    ],
    icon: Dog,
    category: "AI Tools",
  },
  rosa_ai_unlimited: {
    name: "Unlimited Rosa AI",
    description:
      "Unlimited access to Rosa AI for comprehensive sustainability intelligence across your entire organisation.",
    benefits: [
      "No limits on AI-powered sustainability analysis",
      "Priority response times",
      "Advanced multi-document analysis",
      "Custom AI insights for your industry",
    ],
    icon: Dog,
    category: "AI Tools",
  },
  greenwash_documents: {
    name: "Greenwash Guardian (Documents)",
    description:
      "Scan your sustainability documents, reports, and marketing materials for potential greenwashing risks.",
    benefits: [
      "Upload and scan PDFs, reports, and marketing materials",
      "Identify vague or misleading environmental claims",
      "Get specific recommendations to improve accuracy",
      "Protect your brand from greenwashing accusations",
    ],
    icon: Shield,
    category: "AI Tools",
  },
  greenwash_unlimited: {
    name: "Unlimited Greenwash Guardian",
    description:
      "Unlimited document and website scanning to ensure all your communications are free from greenwashing risks.",
    benefits: [
      "Unlimited website and document scans",
      "Continuous monitoring of published content",
      "Batch scanning for large document libraries",
      "Enterprise-grade compliance assurance",
    ],
    icon: Shield,
    category: "AI Tools",
  },
  // Advanced features
  supply_chain_mapping: {
    name: "Supply Chain Network Mapping",
    description:
      "Visualise and analyse your complete supply chain network to identify sustainability risks and opportunities.",
    benefits: [
      "Map multi-tier supplier relationships",
      "Identify supply chain sustainability hotspots",
      "Track supplier environmental performance",
      "Generate supply chain risk assessments",
    ],
    icon: BarChart3,
    category: "Core Platform",
  },
  full_scope_3: {
    name: "Full Scope 3 Categories",
    description:
      "Track emissions across all 15 Scope 3 categories for comprehensive value chain carbon accounting.",
    benefits: [
      "Calculate emissions across all Scope 3 categories",
      "Identify highest-impact emission sources",
      "Set data-driven reduction targets",
      "Meet investor and regulatory disclosure requirements",
    ],
    icon: Leaf,
    category: "Core Platform",
  },
  year_over_year: {
    name: "Year-over-Year Comparisons",
    description:
      "Compare your sustainability performance across years to track progress and identify trends.",
    benefits: [
      "Visualise multi-year performance trends",
      "Benchmark against previous baselines",
      "Demonstrate improvement to stakeholders",
      "Identify areas needing more attention",
    ],
    icon: BarChart3,
    category: "Products & LCA",
  },
  advanced_data_quality: {
    name: "Advanced Data Quality Scoring",
    description:
      "Get detailed data quality assessments using the EF 3.1 methodology for more reliable sustainability reporting.",
    benefits: [
      "Score data quality across all inputs",
      "Identify data gaps requiring improvement",
      "Meet audit-grade data quality requirements",
      "Improve confidence in reported metrics",
    ],
    icon: Shield,
    category: "Products & LCA",
  },
  knowledge_bank_manage: {
    name: "Knowledge Bank (Upload & Manage)",
    description:
      "Upload and manage your organisation's sustainability documents, policies, and resources in a centralised knowledge bank.",
    benefits: [
      "Centralise all sustainability documents",
      "Organise policies, reports, and evidence",
      "Share knowledge across your team",
      "Quick access to supporting evidence for audits",
    ],
    icon: FileText,
    category: "Resources",
  },
};

// Fallback feature names for features without full info
const featureNames: Record<FeatureCode, string> = {
  recipe_2016: "ReCiPe 2016 Methodology",
  ef_31: "EF 3.1 Methodology",
  ef_31_single_score: "EF 3.1 Single Score",
  custom_weighting: "Custom Weighting Sets",
  pef_reports: "PEF Compliance Reports",
  api_access: "API Access",
  product_comparison: "Product Comparison",
  white_label: "White-label Reports",
  ghg_emissions: "GHG Emissions Module",
  water_footprint: "Water Footprint",
  waste_circularity: "Circularity & Waste",
  biodiversity_tracking: "Biodiversity Module",
  b_corp_assessment: "B Corp Assessment",
  live_passport: "Live Passport Analytics",
  monthly_analytics: "Monthly Analytics",
  sandbox_analytics: "Sandbox Environment",
  email_support: "Email Support",
  priority_chat: "Priority Chat Support",
  automated_verification: "Automated Verification",
  verified_data: "Verified Data",
  vehicle_registry: "Vehicle Registry",
  fleet_reporting: "Fleet Reporting",
  dashboard_vitality: "Dashboard & Vitality Score",
  facilities_management: "Facilities Management",
  fleet_overview: "Fleet Overview",
  supplier_directory: "Supplier Directory",
  company_emissions_current: "Company Emissions",
  supply_chain_mapping: "Supply Chain Network Mapping",
  full_scope_3: "Full Scope 3 Categories",
  product_management: "Product Management",
  product_passport: "Product Passport",
  carbon_footprint_ghg: "Carbon Footprint (GHG)",
  pdf_report_export: "PDF Report Export",
  land_use_impact: "Land Use Impact",
  resource_use_tracking: "Resource Use Tracking",
  year_over_year: "Year-over-Year Comparisons",
  advanced_data_quality: "Advanced Data Quality Scoring",
  rosa_ai_25: "Rosa AI Assistant (25/mo)",
  rosa_ai_100: "Rosa AI Assistant (100/mo)",
  rosa_ai_unlimited: "Unlimited Rosa AI",
  greenwash_website: "Greenwash Guardian (Website)",
  greenwash_documents: "Greenwash Guardian (Documents)",
  greenwash_unlimited: "Unlimited Greenwash Guardian",
  people_fair_work: "Fair Work",
  people_diversity_inclusion: "Diversity & Inclusion",
  people_wellbeing: "Wellbeing",
  people_training: "Training & Development",
  governance_ethics: "Governance & Ethics",
  community_charitable_giving: "Charitable Giving",
  community_volunteering: "Volunteering",
  community_local_impact: "Local Impact",
  community_impact_stories: "Impact Stories",
  bcorp_tracking: "B Corp Certification Tracking",
  cdp_tracking: "CDP Climate Change Disclosure",
  csrd_compliance: "CSRD Compliance",
  gri_standards: "GRI Standards",
  iso_14001: "ISO 14001",
  iso_50001: "ISO 50001",
  sbti_targets: "SBTi Targets",
  gap_analysis: "Gap Analysis",
  audit_packages: "Audit Packages",
  third_party_verification: "Third-Party Verification Support",
  knowledge_bank_read: "Knowledge Bank (Read)",
  knowledge_bank_manage: "Knowledge Bank (Upload & Manage)",
};

const tierDisplayNames: Record<TierName, string> = {
  seed: "Seed",
  blossom: "Blossom",
  canopy: "Canopy",
};

const tierPrices: Record<TierName, number> = {
  seed: 99,
  blossom: 249,
  canopy: 599,
};

// What extra features each tier unlocks beyond the previous
const tierHighlights: Record<TierName, string[]> = {
  seed: [],
  blossom: [
    "Water, Circularity, Land Use & Resource impacts",
    "Full Scope 3 Categories",
    "Vehicle Registry & Supply Chain Mapping",
    "People & Culture and Community Impact ESG modules",
    "B Corp & CDP certification tracking",
    "Rosa AI (100/mo) & Greenwash Guardian (5 docs/mo)",
    "Knowledge Bank (Upload & Manage)",
    "Up to 20 products, 5 team members, 3 facilities",
  ],
  canopy: [
    "Year-over-Year Comparisons",
    "Advanced Data Quality Scoring & EF 3.1",
    "Governance & Ethics module",
    "All certifications: CSRD, GRI, ISO, SBTi",
    "Gap Analysis, Audit Packages & Verification Support",
    "Unlimited Rosa AI & Greenwash Guardian",
    "Up to 50 products, 10 team members, 8 facilities",
  ],
};

// ============================================================================
// Locked Feature Page — full page upgrade experience
// ============================================================================

interface LockedFeaturePageProps {
  feature: FeatureCode;
  currentTier: TierName;
  requiredTier: TierName;
  className?: string;
}

function LockedFeaturePage({
  feature,
  currentTier,
  requiredTier,
  className,
}: LockedFeaturePageProps) {
  const info = featureInfo[feature];
  const name = info?.name || featureNames[feature];
  const description =
    info?.description ||
    `This feature is available on the ${tierDisplayNames[requiredTier]} plan and above.`;
  const benefits = info?.benefits || [];
  const IconComponent = info?.icon || Lock;
  const category = info?.category || "";
  const highlights = tierHighlights[requiredTier] || [];

  return (
    <div className={cn("flex h-full flex-col items-center justify-center px-6 py-8 max-w-4xl mx-auto", className)}>
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted/60 border border-border">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <div>
          {category && (
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              {category}
            </span>
          )}
          <h2 className="text-xl font-semibold leading-tight">{name}</h2>
        </div>
      </div>

      <p className="mb-6 text-sm text-muted-foreground text-center max-w-lg leading-relaxed">
        {description}
      </p>

      {/* Two cards side by side */}
      <div className="w-full grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Benefits card */}
        {benefits.length > 0 && (
          <div className="rounded-lg border border-border bg-card p-5 flex flex-col">
            <h3 className="mb-3 text-sm font-semibold flex items-center gap-2">
              <IconComponent className="h-4 w-4 text-neon-lime" />
              What you get with {name}
            </h3>
            <ul className="space-y-2.5 flex-1">
              {benefits.map((benefit, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-neon-lime" />
                  <span className="text-muted-foreground">{benefit}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Upgrade card */}
        <div className="rounded-lg border border-neon-lime/30 bg-neon-lime/5 p-5 flex flex-col">
          <div className="mb-3 flex items-center justify-between">
            <div>
              <h3 className="text-base font-semibold">
                Upgrade to {tierDisplayNames[requiredTier]}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                From &pound;{tierPrices[requiredTier]}/month
              </p>
            </div>
            <Sparkles className="h-5 w-5 text-neon-lime" />
          </div>

          {/* What else you unlock */}
          {highlights.length > 0 && (
            <div className="mb-4 flex-1">
              <p className="text-xs font-medium text-muted-foreground mb-2.5 uppercase tracking-wider">
                Everything you unlock
              </p>
              <ul className="space-y-1.5">
                {highlights.map((highlight, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <Check className="h-3.5 w-3.5 mt-0.5 flex-shrink-0 text-neon-lime" />
                    <span className="text-foreground/80">{highlight}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          <Link href="/settings/">
            <Button className="w-full gap-2" size="default">
              <Sparkles className="h-4 w-4" />
              Upgrade to {tierDisplayNames[requiredTier]}
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>

          <p className="mt-2.5 text-center text-xs text-muted-foreground">
            You&apos;re currently on the{" "}
            <span className="font-medium text-foreground">
              {tierDisplayNames[currentTier]}
            </span>{" "}
            plan
          </p>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// Inline and icon variants (unchanged)
// ============================================================================

interface FeatureGateInlineProps {
  feature: FeatureCode;
  children: React.ReactNode;
  lockedContent?: React.ReactNode;
}

export function FeatureGateInline({
  feature,
  children,
  lockedContent,
}: FeatureGateInlineProps) {
  const { isEnabled, isLoading, requiredTierForFeature } =
    useFeatureGate(feature);

  if (isLoading) {
    return <span className="animate-pulse bg-muted rounded px-2">...</span>;
  }

  if (isEnabled) {
    return <>{children}</>;
  }

  if (lockedContent) {
    return <>{lockedContent}</>;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span className="inline-flex cursor-not-allowed items-center gap-1 text-muted-foreground">
            <Lock className="h-3 w-3" />
            <span className="line-through opacity-50">{children}</span>
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>
            Upgrade to {tierDisplayNames[requiredTierForFeature]} to unlock this
            feature
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

interface FeatureLockIconProps {
  feature: FeatureCode;
  className?: string;
}

export function FeatureLockIcon({ feature, className }: FeatureLockIconProps) {
  const { isEnabled, requiredTierForFeature } = useFeatureGate(feature);

  if (isEnabled) {
    return null;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Lock className={cn("h-3 w-3 text-muted-foreground", className)} />
        </TooltipTrigger>
        <TooltipContent>
          <p>Requires {tierDisplayNames[requiredTierForFeature]} plan</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
