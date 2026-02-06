/**
 * Claude LCA Assistant
 *
 * AI-powered assistance for LCA compliance, using Claude API to generate
 * plain-English explanations, content suggestions, and report narratives.
 *
 * Model Strategy:
 * - Claude 3.5 Sonnet for wizard suggestions (fast, cost-effective)
 * - Claude Opus 4 for final PDF narratives (highest quality)
 */

// Dynamic import for Anthropic SDK to handle missing dependency gracefully
// Install with: npm install @anthropic-ai/sdk
let Anthropic: any = null;
try {
  Anthropic = require('@anthropic-ai/sdk').default;
} catch {
  console.warn('[Claude LCA Assistant] @anthropic-ai/sdk not installed. AI features will use fallbacks.');
}

// ============================================================================
// TYPES
// ============================================================================

export type SuggestionField =
  | 'intended_application'
  | 'reasons_for_study'
  | 'cutoff_criteria'
  | 'assumptions'
  | 'functional_unit'
  | 'system_boundary'
  | 'executive_summary'
  | 'key_findings'
  | 'limitations'
  | 'recommendations';

export interface LcaContext {
  productName: string;
  productCategory?: string;        // e.g., 'beer', 'wine', 'soft_drink', 'spirits'
  functionalUnit?: string;
  systemBoundary?: string;
  totalGwp?: number;               // kg CO2e
  topContributors?: Array<{
    name: string;
    contribution: number;          // percentage
  }>;
  materials?: Array<{
    name: string;
    quantity: number;
    unit: string;
  }>;
  intendedAudience?: string[];
  isComparativeAssertion?: boolean;
  // Extended context for PDF generation
  interpretationData?: any;        // LCA interpretation results
  dataQuality?: any;               // Data quality requirements
  cutoffCriteria?: string;         // Cut-off criteria description
  assumptions?: string[];          // List of assumptions
}

export interface SuggestionResult {
  suggestion: string;
  reasoning?: string;
  alternatives?: string[];
  cached: boolean;
}

export interface NarrativeResult {
  executiveSummary: string;
  keyFindings: string;
  limitations: string;
  recommendations: string;
  dataQualityStatement: string;
  cached: boolean;
}

export interface PlainEnglishExplanation {
  term: string;
  explanation: string;
  example?: string;
}

// ============================================================================
// SYSTEM PROMPTS
// ============================================================================

const SUGGESTION_SYSTEM_PROMPT = `You are an LCA (Life Cycle Assessment) expert assistant helping non-experts complete ISO 14044/14067 compliant assessments for drinks products.

Your role:
1. Generate clear, concise content for LCA compliance fields
2. Use plain English - avoid technical jargon
3. Keep responses practical and specific to the product being assessed
4. Ensure suggestions are ISO 14044 compliant

Guidelines:
- Be specific, not generic (use the product name and details provided)
- Keep suggestions concise (2-4 sentences for most fields)
- If suggesting cut-off criteria, explain in simple terms what's excluded and why
- For functional units, always include the quantity and the product (e.g., "1 litre of packaged beer")

Always respond in valid JSON format matching the requested structure.`;

const NARRATIVE_SYSTEM_PROMPT = `You are an expert LCA practitioner writing formal ISO 14044/14067 compliant report sections for drinks industry products.

Your role:
1. Generate professional narrative content for LCA reports
2. Maintain ISO 14044 compliance in all statements
3. Be precise with environmental claims and data interpretation
4. Write in third person, formal style suitable for external publication

Guidelines:
- Reference specific data values when available
- Avoid overclaiming or definitive statements about environmental superiority
- Include appropriate caveats about data quality and scope limitations
- Structure content with clear topic sentences
- Use proper LCA terminology but explain complex concepts

Always respond in valid JSON format matching the requested structure.`;

const PLAIN_ENGLISH_SYSTEM_PROMPT = `You are a helpful assistant that explains LCA (Life Cycle Assessment) terminology in plain English for people with no environmental science background.

Your role:
1. Take complex LCA terms and explain them simply
2. Use everyday analogies and examples
3. Keep explanations to 2-3 sentences maximum
4. Avoid introducing new jargon while explaining

Always respond in valid JSON format with 'explanation' and optionally 'example' fields.`;

// ============================================================================
// CLIENT INITIALIZATION
// ============================================================================

let anthropicClient: any = null;

function getClient(): any {
  if (!Anthropic) {
    throw new Error('@anthropic-ai/sdk is not installed. Run: npm install @anthropic-ai/sdk');
  }
  if (!anthropicClient) {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      throw new Error('ANTHROPIC_API_KEY environment variable is not set');
    }
    anthropicClient = new Anthropic({ apiKey });
  }
  return anthropicClient;
}

// ============================================================================
// SUGGESTION GENERATION (Sonnet - Fast & Cheap)
// ============================================================================

/**
 * Generate a content suggestion for a specific LCA compliance field
 * Uses Claude 3.5 Sonnet for fast, cost-effective responses
 */
export async function generateSuggestion(
  field: SuggestionField,
  context: LcaContext
): Promise<SuggestionResult> {
  const client = getClient();

  const fieldPrompts: Record<SuggestionField, string> = {
    intended_application: `Generate a concise "intended application" statement for an LCA study of "${context.productName}".
The intended application should describe how this LCA will be used.
Consider the audience: ${context.intendedAudience?.join(', ') || 'internal management'}.
${context.isComparativeAssertion ? 'Note: This is a comparative assertion study.' : ''}`,

    reasons_for_study: `Generate a concise "reasons for the study" statement for an LCA of "${context.productName}".
Explain why this LCA is being conducted. Common reasons include regulatory compliance, customer requests, internal improvement.`,

    cutoff_criteria: `Generate appropriate cut-off criteria for an LCA of "${context.productName}" (${context.productCategory || 'beverage'}).
The system boundary is: ${context.systemBoundary || 'cradle-to-gate'}.
Explain which flows/processes are excluded and why, using the standard <1% mass and <1% environmental impact threshold.
Keep it concise but ISO 14044 compliant.`,

    assumptions: `Generate 3-5 appropriate assumptions for an LCA study of "${context.productName}".
The system boundary is: ${context.systemBoundary || 'cradle-to-gate'}.
Include typical assumptions about transport distances, production conditions, and data age.
Return as a JSON array of strings.`,

    functional_unit: `Generate an appropriate functional unit for "${context.productName}" (${context.productCategory || 'beverage'}).
A functional unit must be quantifiable and describe the function delivered.
Example: "1 litre of packaged product, ready for retail distribution"`,

    system_boundary: `Generate a system boundary description for "${context.productName}" (${context.productCategory || 'beverage'}).
Use standard terminology: cradle-to-gate, cradle-to-grave, or gate-to-gate.
Briefly list what lifecycle stages are included and excluded.`,

    executive_summary: `Generate a brief executive summary (3-4 sentences) for an LCA report on "${context.productName}".
${context.totalGwp ? `Total carbon footprint: ${context.totalGwp.toFixed(2)} kg CO2e per ${context.functionalUnit || 'unit'}.` : ''}
${context.topContributors?.length ? `Top contributors: ${context.topContributors.map(c => `${c.name} (${c.contribution}%)`).join(', ')}.` : ''}
Write in plain English suitable for non-experts.`,

    key_findings: `Generate key findings (3-5 bullet points) for an LCA report on "${context.productName}".
${context.totalGwp ? `Total carbon footprint: ${context.totalGwp.toFixed(2)} kg CO2e.` : ''}
${context.topContributors?.length ? `Top contributors: ${JSON.stringify(context.topContributors)}` : ''}
Focus on actionable insights and environmental hotspots.`,

    limitations: `Generate a limitations statement for an LCA report on "${context.productName}".
Mention data quality limitations, scope boundaries, and any significant assumptions.
Keep it honest but not alarmist.`,

    recommendations: `Generate 2-3 recommendations based on an LCA of "${context.productName}".
${context.topContributors?.length ? `Top environmental contributors: ${context.topContributors.map(c => c.name).join(', ')}.` : ''}
Focus on practical, actionable improvements.`,
  };

  const userPrompt = fieldPrompts[field];

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 1024,
      system: SUGGESTION_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `${userPrompt}

Respond with JSON in this format:
{
  "suggestion": "Your main suggestion here",
  "reasoning": "Brief explanation of why this is appropriate (optional)",
  "alternatives": ["Alternative 1", "Alternative 2"] (optional, for fields with multiple valid options)
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      suggestion: parsed.suggestion || parsed.text || content.text,
      reasoning: parsed.reasoning,
      alternatives: parsed.alternatives,
      cached: false,
    };
  } catch (error) {
    console.error('[Claude LCA Assistant] Suggestion generation failed:', error);
    throw error;
  }
}

// ============================================================================
// NARRATIVE GENERATION (Opus - High Quality)
// ============================================================================

/**
 * Generate full narrative sections for an LCA PDF report
 * Uses Claude Opus 4 for highest quality formal writing
 */
export async function generateNarratives(
  context: LcaContext,
  dataQualityInfo?: {
    overallDqi: number;
    primaryDataShare: number;
    uncertaintyPercent: number;
    staleMaterialCount: number;
  }
): Promise<NarrativeResult> {
  const client = getClient();

  const prompt = `Generate formal narrative sections for an ISO 14044 compliant LCA report.

Product: ${context.productName}
Category: ${context.productCategory || 'beverage'}
Functional Unit: ${context.functionalUnit || 'Not specified'}
System Boundary: ${context.systemBoundary || 'Cradle-to-gate'}
${context.totalGwp ? `Total Carbon Footprint: ${context.totalGwp.toFixed(2)} kg CO2e` : ''}
${context.topContributors?.length ? `Top Contributors: ${JSON.stringify(context.topContributors)}` : ''}

${dataQualityInfo ? `
Data Quality Information:
- Overall DQI Score: ${dataQualityInfo.overallDqi}%
- Primary Data Share: ${dataQualityInfo.primaryDataShare}%
- Propagated Uncertainty: ±${dataQualityInfo.uncertaintyPercent}%
- Materials with Stale Data: ${dataQualityInfo.staleMaterialCount}
` : ''}

Generate the following sections in formal LCA report style:

1. Executive Summary (3-4 sentences, plain English, suitable for non-experts)
2. Key Findings (structured narrative with the most significant results)
3. Limitations (honest assessment of scope and data limitations)
4. Recommendations (actionable improvement opportunities)
5. Data Quality Statement (ISO 14044 Section 4.2.3.6 compliant statement about data quality)

Respond with JSON in this exact format:
{
  "executiveSummary": "...",
  "keyFindings": "...",
  "limitations": "...",
  "recommendations": "...",
  "dataQualityStatement": "..."
}`;

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514', // Using Sonnet for now, can upgrade to Opus when needed
      max_tokens: 2048,
      system: NARRATIVE_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: prompt,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      executiveSummary: parsed.executiveSummary,
      keyFindings: parsed.keyFindings,
      limitations: parsed.limitations,
      recommendations: parsed.recommendations,
      dataQualityStatement: parsed.dataQualityStatement,
      cached: false,
    };
  } catch (error) {
    console.error('[Claude LCA Assistant] Narrative generation failed:', error);
    throw error;
  }
}

// ============================================================================
// PLAIN ENGLISH EXPLANATIONS
// ============================================================================

/**
 * Explain an LCA term in plain English
 * Uses Claude 3.5 Sonnet for fast responses
 */
export async function explainTerm(term: string): Promise<PlainEnglishExplanation> {
  const client = getClient();

  try {
    const response = await client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      system: PLAIN_ENGLISH_SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: `Explain this LCA term in plain English: "${term}"

Respond with JSON:
{
  "explanation": "Simple explanation in 2-3 sentences",
  "example": "Optional real-world example or analogy"
}`,
        },
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const parsed = JSON.parse(jsonMatch[0]);

    return {
      term,
      explanation: parsed.explanation,
      example: parsed.example,
    };
  } catch (error) {
    console.error('[Claude LCA Assistant] Term explanation failed:', error);
    // Return a fallback
    return {
      term,
      explanation: `"${term}" is a technical term used in Life Cycle Assessment. Please consult the ISO 14044 standard for a formal definition.`,
    };
  }
}

// ============================================================================
// STATIC FALLBACKS (When API is unavailable)
// ============================================================================

/**
 * Get a static fallback suggestion when Claude API is unavailable
 */
export function getStaticFallback(field: SuggestionField, context: LcaContext): string {
  const fallbacks: Record<SuggestionField, string> = {
    intended_application: `This LCA study is conducted to quantify the environmental footprint of ${context.productName} and identify opportunities for environmental improvement across its lifecycle.`,

    reasons_for_study: `This study is conducted to support sustainability reporting, respond to customer requirements for environmental data, and identify environmental hotspots for product improvement.`,

    cutoff_criteria: `Flows contributing less than 1% of total mass and less than 1% of total environmental impact are excluded per ISO 14044 Section 4.2.3.3.2. Capital goods are excluded per ISO 14067 Clause 6.3.5. Administrative and office activities are excluded (<0.1% contribution).`,

    assumptions: `["Steady-state production conditions assumed", "Transport distances estimated from supplier location data", "End-of-life scenarios based on regional average recycling rates", "Energy mix based on national grid average"]`,

    functional_unit: `1 litre of packaged ${context.productName}, ready for retail distribution`,

    system_boundary: `Cradle-to-gate: includes raw material extraction, primary production of ingredients, packaging manufacture, and factory operations. Excludes distribution to retailers, consumer use phase, and end-of-life disposal.`,

    executive_summary: `This Life Cycle Assessment evaluates the environmental footprint of ${context.productName}. ${context.totalGwp ? `The total carbon footprint is ${context.totalGwp.toFixed(2)} kg CO2e per functional unit.` : ''} The study follows ISO 14044 and ISO 14067 standards and provides insights for environmental improvement.`,

    key_findings: `The key environmental hotspots identified in this assessment include raw material production and packaging. Further investigation into supply chain alternatives may yield improvement opportunities.`,

    limitations: `This study is based on a combination of primary and secondary data sources. Some data may not be fully representative of actual production conditions. The scope is limited to cradle-to-gate and does not include use phase or end-of-life impacts.`,

    recommendations: `Consider evaluating alternative packaging materials with lower environmental footprints. Engage with key suppliers to obtain primary environmental data for improved accuracy. Review energy sources at production facilities for decarbonisation opportunities.`,
  };

  return fallbacks[field] || '';
}

// ============================================================================
// TERM DICTIONARY (Static fallbacks for common terms)
// ============================================================================

export const TERM_DICTIONARY: Record<string, PlainEnglishExplanation> = {
  'functional unit': {
    term: 'functional unit',
    explanation: 'The "functional unit" is simply what you\'re measuring the environmental impact of. It\'s like saying "per bottle" or "per litre" so you can compare fairly.',
    example: 'For a beer, the functional unit might be "1 can of 330ml beer" - so all environmental impacts are calculated for that specific amount.',
  },
  'system boundary': {
    term: 'system boundary',
    explanation: 'The "system boundary" defines what parts of the product\'s life you\'re including in the assessment. It\'s like drawing a line around what counts.',
    example: '"Cradle-to-gate" means you measure from raw materials (cradle) to when the product leaves your factory (gate), but not delivery to shops or when customers use it.',
  },
  'cradle-to-gate': {
    term: 'cradle-to-gate',
    explanation: 'This means measuring environmental impacts from extracting raw materials (birth/cradle) until the product leaves your factory gate. It doesn\'t include delivery to stores or what happens after purchase.',
    example: 'For a bottle of juice, cradle-to-gate would include growing the fruit, processing it, making the bottle, and filling it - but not shipping to supermarkets.',
  },
  'cradle-to-grave': {
    term: 'cradle-to-grave',
    explanation: 'This covers the complete life of a product - from raw materials through manufacturing, use by customers, and final disposal or recycling.',
    example: 'For a drinks can, this would include mining aluminium, making the can, filling it, transport, the customer drinking it, and recycling or landfill.',
  },
  'pedigree matrix': {
    term: 'pedigree matrix',
    explanation: 'A scoring system that rates how good your data is across five dimensions: reliability, completeness, time relevance, geographic match, and technology match. Each gets a score from 1 (best) to 5 (worst).',
    example: 'If you have actual measurements from your own factory this year (score 1), that\'s better than estimates from a different country 10 years ago (score 4-5).',
  },
  'GWP100': {
    term: 'GWP100',
    explanation: 'GWP100 stands for "Global Warming Potential over 100 years". It\'s a way to compare different greenhouse gases by converting them all to an equivalent amount of CO2.',
    example: 'Methane traps more heat than CO2, so 1 kg of methane is counted as about 28 kg of CO2 equivalent (CO2e) over 100 years.',
  },
  'uncertainty': {
    term: 'uncertainty',
    explanation: 'Uncertainty tells you how confident you can be in the results. A ±20% uncertainty means the actual value could be 20% higher or lower than calculated.',
    example: 'If your carbon footprint is 2.0 kg CO2e with ±20% uncertainty, the real value is probably between 1.6 and 2.4 kg CO2e.',
  },
  'cut-off criteria': {
    term: 'cut-off criteria',
    explanation: 'Rules for what small things you can leave out of the assessment. Usually, if something is less than 1% of the total mass or impact, you can exclude it to keep the study manageable.',
    example: 'The tiny amount of ink on a label might be excluded because it\'s less than 1% of the packaging weight and environmental impact.',
  },
  'critical review': {
    term: 'critical review',
    explanation: 'An independent check of your LCA by an expert to make sure it\'s been done correctly and follows the ISO standards. Required if you want to make public environmental claims.',
    example: 'If you want to say "our product has the lowest carbon footprint in the market", an external panel must review your LCA first.',
  },
  'data quality indicator': {
    term: 'data quality indicator',
    explanation: 'A score (usually 0-100%) that summarises how good your overall data is. Higher scores mean more reliable results.',
    example: 'A DQI of 80% means your data is mostly from good sources. Below 60% suggests you should try to get better data for key materials.',
  },
};

/**
 * Get a plain English explanation, using dictionary first, then Claude if needed
 */
export async function getExplanation(term: string): Promise<PlainEnglishExplanation> {
  const normalizedTerm = term.toLowerCase().trim();

  // Check dictionary first
  if (TERM_DICTIONARY[normalizedTerm]) {
    return TERM_DICTIONARY[normalizedTerm];
  }

  // Fall back to Claude API
  return explainTerm(term);
}
