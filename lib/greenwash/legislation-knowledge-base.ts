/**
 * Greenwash Guardian - Legislation Knowledge Base
 *
 * This file contains structured information about UK and EU anti-greenwashing
 * legislation used to inform the AI analysis.
 */

export const LEGISLATION_KNOWLEDGE_BASE = {
  uk: {
    name: "UK Anti-Greenwashing Framework",
    sources: [
      {
        name: "Green Claims Code",
        authority: "Competition and Markets Authority (CMA)",
        year: 2021,
        principles: [
          {
            id: "GCC-1",
            title: "Claims must be truthful and accurate",
            description: "Environmental claims must not be false, misleading, or create a misleading impression. Claims should be based on robust and credible evidence.",
            violations: [
              "Making claims that cannot be substantiated with evidence",
              "Exaggerating environmental benefits",
              "Using vague or ambiguous language that could mislead",
              "Omitting relevant information that would affect consumer understanding"
            ]
          },
          {
            id: "GCC-2",
            title: "Claims must be clear and unambiguous",
            description: "The meaning of environmental claims must be clear to consumers. Technical or scientific terms should be explained.",
            violations: [
              "Using jargon without explanation",
              "Making claims that could be interpreted in multiple ways",
              "Burying important qualifications in small print",
              "Using imagery that contradicts or exaggerates written claims"
            ]
          },
          {
            id: "GCC-3",
            title: "Claims must not omit or hide important information",
            description: "Environmental claims must include all relevant information that consumers need to make informed decisions.",
            violations: [
              "Highlighting positive aspects while hiding negative environmental impacts",
              "Not disclosing trade-offs or limitations",
              "Cherry-picking data to present a misleading picture",
              "Failing to provide context for comparative claims"
            ]
          },
          {
            id: "GCC-4",
            title: "Comparisons must be fair and meaningful",
            description: "Environmental comparisons must compare like with like and be based on a fair basis.",
            violations: [
              "Comparing against outdated or irrelevant products",
              "Not disclosing the basis of comparison",
              "Making comparisons without clear benchmarks",
              "Using misleading baselines"
            ]
          },
          {
            id: "GCC-5",
            title: "Claims must consider the full life cycle",
            description: "Claims about environmental benefits should consider the total environmental impact of a product or service.",
            violations: [
              "Focusing on one aspect while ignoring others",
              "Not considering manufacturing, use, and disposal impacts",
              "Making claims about one environmental aspect while causing harm in another",
              "Ignoring supply chain impacts"
            ]
          },
          {
            id: "GCC-6",
            title: "Claims must be substantiated",
            description: "Businesses must hold robust evidence to support their environmental claims before making them.",
            violations: [
              "Making claims without supporting evidence",
              "Relying on outdated or unreliable data",
              "Using non-independent or biased research",
              "Not being able to provide evidence when challenged"
            ]
          }
        ]
      },
      {
        name: "Digital Markets, Competition and Consumers Act 2024",
        authority: "UK Parliament",
        year: 2024,
        keyProvisions: [
          {
            section: "Part 4 - Consumer Protection",
            description: "Strengthens enforcement against misleading environmental claims with potential fines up to 10% of global turnover.",
            keyPoints: [
              "Direct enforcement powers for CMA without court proceedings",
              "Significant financial penalties for breaches",
              "Enhanced consumer rights to challenge misleading claims",
              "Applies to all businesses selling to UK consumers"
            ]
          }
        ]
      }
    ]
  },
  eu: {
    name: "EU Anti-Greenwashing Framework",
    sources: [
      {
        name: "Directive on Empowering Consumers for the Green Transition",
        authority: "European Parliament and Council",
        year: 2024,
        directive: "2024/825",
        keyRequirements: [
          {
            id: "ECGT-1",
            title: "Ban on generic environmental claims",
            description: "Generic environmental claims like 'eco-friendly', 'green', 'climate neutral' are banned unless backed by recognized excellence in environmental performance.",
            bannedTerms: [
              "Environmentally friendly",
              "Eco-friendly",
              "Green",
              "Nature's friend",
              "Ecological",
              "Environmentally correct",
              "Climate neutral",
              "Carbon neutral",
              "Climate positive",
              "Climate compensated"
            ],
            exceptions: [
              "Recognized environmental excellence certification (EU Ecolabel, etc.)",
              "Proven environmental performance under verified schemes"
            ]
          },
          {
            id: "ECGT-2",
            title: "Sustainability labels require certification",
            description: "Environmental labels must be based on official certification schemes or established by public authorities.",
            requirements: [
              "Third-party verification required",
              "Transparent certification criteria",
              "Regular auditing and compliance checks",
              "Public accessibility of certification information"
            ]
          },
          {
            id: "ECGT-3",
            title: "Carbon offsetting claims restricted",
            description: "Claims based solely on carbon offsetting schemes are prohibited. Cannot claim 'climate neutral' or 'carbon neutral' based only on offsets.",
            restrictions: [
              "Cannot claim neutrality based only on offsetting",
              "Must clearly separate reduction vs. offsetting efforts",
              "Offsetting schemes must be independently verified",
              "Clear disclosure of what is being offset"
            ]
          },
          {
            id: "ECGT-4",
            title: "Durability and reparability information",
            description: "False or misleading claims about product durability, reparability, and recyclability are prohibited.",
            prohibitions: [
              "Misleading durability claims",
              "False reparability information",
              "Exaggerated recyclability claims",
              "Misleading information about spare parts availability"
            ]
          }
        ]
      },
      {
        name: "Green Claims Directive (Proposed)",
        authority: "European Commission",
        year: 2023,
        status: "Under legislative process",
        keyProposals: [
          {
            id: "GCD-1",
            title: "Substantiation requirements",
            description: "All environmental claims must be substantiated based on widely recognized scientific evidence.",
            requirements: [
              "Life cycle assessment-based evidence",
              "Primary data where possible",
              "Clear methodology disclosure",
              "Independent verification"
            ]
          },
          {
            id: "GCD-2",
            title: "Communication requirements",
            description: "Environmental claims must clearly communicate scope, limitations, and supporting evidence.",
            requirements: [
              "Specify whether claim relates to entire product or parts",
              "Disclose if benefits are available only under certain conditions",
              "Identify main environmental impacts not covered by claim",
              "Provide access to supporting evidence"
            ]
          },
          {
            id: "GCD-3",
            title: "Comparative claims",
            description: "Comparative environmental claims must use equivalent methods and data.",
            requirements: [
              "Use equivalent data and methodology",
              "Cover same life cycle stages",
              "Address same environmental impacts",
              "Be updated when circumstances change"
            ]
          },
          {
            id: "GCD-4",
            title: "Pre-approval for claims",
            description: "Environmental claims may need pre-verification before use in marketing.",
            process: [
              "Submit claim with supporting evidence",
              "Independent verifier assessment",
              "Certificate of conformity before use",
              "Ongoing compliance monitoring"
            ]
          }
        ]
      }
    ]
  },
  commonIssues: [
    {
      type: "vague_claim",
      name: "Vague Environmental Claim",
      description: "Using general environmental terms without specific meaning or evidence",
      examples: [
        "Eco-friendly",
        "Green",
        "Sustainable",
        "Natural",
        "Earth-friendly",
        "Environmentally safe"
      ],
      ukViolation: "GCC-2: Claims must be clear and unambiguous",
      euViolation: "ECGT-1: Ban on generic environmental claims"
    },
    {
      type: "unsubstantiated",
      name: "Unsubstantiated Claim",
      description: "Making environmental claims without adequate evidence to support them",
      examples: [
        "Claiming '50% less emissions' without methodology",
        "Stating 'certified sustainable' without certification",
        "Asserting 'zero waste' without verification"
      ],
      ukViolation: "GCC-6: Claims must be substantiated",
      euViolation: "GCD-1: Substantiation requirements"
    },
    {
      type: "misleading_comparison",
      name: "Misleading Comparison",
      description: "Comparing products unfairly or without clear methodology",
      examples: [
        "Better than competitors without specific data",
        "Improved recipe without baseline disclosure",
        "Lower impact than previous version without context"
      ],
      ukViolation: "GCC-4: Comparisons must be fair and meaningful",
      euViolation: "GCD-3: Comparative claims requirements"
    },
    {
      type: "hidden_tradeoff",
      name: "Hidden Trade-off",
      description: "Highlighting one environmental benefit while hiding other impacts",
      examples: [
        "Recyclable packaging but high carbon production",
        "Lower water use but increased energy consumption",
        "Organic ingredients but high transport emissions"
      ],
      ukViolation: "GCC-3: Must not omit important information; GCC-5: Consider full life cycle",
      euViolation: "GCD-2: Communication requirements"
    },
    {
      type: "false_label",
      name: "False or Misleading Label",
      description: "Using environmental labels without proper certification",
      examples: [
        "Self-declared eco-labels",
        "Fake certification marks",
        "Misleading recycling symbols"
      ],
      ukViolation: "GCC-1: Claims must be truthful and accurate",
      euViolation: "ECGT-2: Sustainability labels require certification"
    },
    {
      type: "carbon_offset_claim",
      name: "Carbon Offset-Based Claim",
      description: "Claiming carbon neutrality based solely on offset purchases",
      examples: [
        "Climate neutral certified (offset only)",
        "Carbon neutral product (via offsets)",
        "Net zero through offsetting"
      ],
      ukViolation: "GCC-3: Must not omit important information",
      euViolation: "ECGT-3: Carbon offsetting claims restricted"
    },
    {
      type: "absolute_claim",
      name: "Absolute/Blanket Claim",
      description: "Making sweeping claims that imply total environmental benefit",
      examples: [
        "100% sustainable",
        "Completely green",
        "Zero environmental impact",
        "Fully circular"
      ],
      ukViolation: "GCC-1: Must be truthful; GCC-5: Consider full life cycle",
      euViolation: "GCD-1: Substantiation requirements"
    },
    {
      type: "future_promise",
      name: "Unverifiable Future Promise",
      description: "Making commitments about future environmental performance without clear plans",
      examples: [
        "Carbon neutral by 2030 (without roadmap)",
        "100% renewable energy soon",
        "Fully recyclable packaging coming"
      ],
      ukViolation: "GCC-6: Claims must be substantiated",
      euViolation: "GCD-1: Substantiation requirements"
    }
  ],
  riskAssessmentCriteria: {
    high: {
      score: 70,
      description: "Claims that are likely to violate legislation and mislead consumers significantly",
      indicators: [
        "Unsubstantiated absolute claims",
        "False certifications or labels",
        "Deliberate omission of significant negative impacts",
        "Claims directly contradicted by evidence",
        "Use of banned terms without qualification"
      ]
    },
    medium: {
      score: 40,
      description: "Claims that could be interpreted as misleading or lack sufficient clarity",
      indicators: [
        "Vague environmental terms without explanation",
        "Incomplete disclosure of methodology",
        "Unclear basis for comparisons",
        "Partial life cycle considerations",
        "Offsetting claims without clear context"
      ]
    },
    low: {
      score: 0,
      description: "Claims that are specific, substantiated, and clearly communicated",
      indicators: [
        "Specific, quantified claims with methodology",
        "Third-party certified credentials",
        "Full life cycle disclosure",
        "Clear scope and limitations stated",
        "Accessible supporting evidence"
      ]
    }
  }
};

export const ANALYSIS_PROMPT_TEMPLATE = `
You are a legal compliance expert specializing in environmental marketing claims and anti-greenwashing legislation. Analyze the following content for potential greenwashing risks.

## LEGISLATION FRAMEWORK

### UK Legislation
- **Green Claims Code (CMA, 2021)**: 6 principles requiring environmental claims to be truthful, clear, complete, fair in comparisons, life-cycle aware, and substantiated.
- **Digital Markets, Competition and Consumers Act 2024**: Enables direct enforcement with penalties up to 10% of global turnover.

### EU Legislation
- **Directive on Empowering Consumers for the Green Transition (2024/825)**: Bans generic environmental claims, requires certified sustainability labels, restricts carbon offset claims.
- **Green Claims Directive (Proposed)**: Requires pre-substantiation, life-cycle assessment basis, clear communication of scope and limitations.

## ANALYSIS REQUIREMENTS

For each environmental claim identified:
1. Extract the exact claim text
2. Identify the type of issue (vague_claim, unsubstantiated, misleading_comparison, hidden_tradeoff, false_label, carbon_offset_claim, absolute_claim, future_promise, etc.)
3. Assess risk level: high (70-100), medium (40-69), low (0-39)
4. Reference specific legislation being violated
5. Provide actionable suggestion to remediate
6. Optionally suggest revised wording

## CONTENT TO ANALYZE

{content}

## RESPONSE FORMAT

Respond in JSON format:
{
  "overall_risk_level": "low" | "medium" | "high",
  "overall_risk_score": 0-100,
  "summary": "Brief summary of findings",
  "recommendations": ["Top-level recommendations"],
  "legislation_applied": [
    {"name": "Legislation name", "jurisdiction": "uk|eu|both", "key_requirement": "Brief description"}
  ],
  "claims": [
    {
      "claim_text": "Exact text of the claim",
      "claim_context": "Surrounding context",
      "risk_level": "low" | "medium" | "high",
      "risk_score": 0-100,
      "issue_type": "Type of issue",
      "issue_description": "Why this is problematic",
      "legislation_name": "Specific legislation",
      "legislation_article": "Article/section if applicable",
      "legislation_jurisdiction": "uk" | "eu" | "both",
      "suggestion": "How to fix this",
      "suggested_revision": "Optional: Revised wording"
    }
  ]
}

Important:
- Be thorough but fair - not every environmental statement is greenwashing
- Focus on claims that could mislead consumers
- Provide constructive, actionable feedback
- Reference specific legislation for each finding
- Consider both UK and EU requirements
`;

export function buildAnalysisPrompt(content: string): string {
  return ANALYSIS_PROMPT_TEMPLATE.replace('{content}', content);
}
