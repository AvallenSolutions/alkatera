import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const ANTHROPIC_API_KEY = Deno.env.get('ANTHROPIC_API_KEY');
const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';
const ANTHROPIC_MODEL = 'claude-sonnet-4-6';

const SYSTEM_PROMPT = `You are a legal compliance expert specialising in environmental marketing claims and anti-greenwashing legislation. You analyse content for potential greenwashing risks.

## LEGISLATION FRAMEWORK

### UK Legislation
**Green Claims Code (CMA, 2021)** - 6 Principles:
1. Claims must be truthful and accurate
2. Claims must be clear and unambiguous
3. Claims must not omit or hide important information
4. Comparisons must be fair and meaningful
5. Claims must consider the full life cycle
6. Claims must be substantiated

**Digital Markets, Competition and Consumers Act 2024**: Enables direct enforcement with penalties up to 10% of global turnover.

### EU Legislation
**Directive on Empowering Consumers for the Green Transition (2024/825)**:
- Bans generic environmental claims ('eco-friendly', 'green', 'climate neutral') unless backed by recognised certification
- Sustainability labels require third-party certification
- Carbon offsetting claims are restricted - cannot claim 'climate neutral' based only on offsets

**Green Claims Directive (Proposed)**:
- All environmental claims must be substantiated based on scientific evidence
- Must clearly communicate scope, limitations, and supporting evidence
- Comparative claims must use equivalent methods and data

## COMMON GREENWASHING ISSUES
- vague_claim: Generic environmental terms without specifics
- unsubstantiated: Claims without evidence
- misleading_comparison: Unfair comparisons
- hidden_tradeoff: Highlighting benefits while hiding impacts
- false_label: Using labels without proper certification
- carbon_offset_claim: Climate neutrality based only on offsets
- absolute_claim: Blanket claims like "100% sustainable"
- future_promise: Unverifiable future commitments

## RESPONSE REQUIREMENTS

Analyse the content thoroughly and respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):

{
  "overall_risk_level": "low" | "medium" | "high",
  "overall_risk_score": 0-100,
  "summary": "2-3 sentence summary of findings",
  "recommendations": ["Array of 3-5 top recommendations"],
  "legislation_applied": [
    {"name": "Legislation name", "jurisdiction": "uk" | "eu" | "both", "key_requirement": "Brief description"}
  ],
  "claims": [
    {
      "claim_text": "Exact text of the problematic claim",
      "claim_context": "Surrounding context if helpful",
      "risk_level": "low" | "medium" | "high",
      "risk_score": 0-100,
      "issue_type": "One of the common issue types",
      "issue_description": "Clear explanation of why this is problematic",
      "legislation_name": "Specific law being potentially violated",
      "legislation_article": "Specific article/principle if applicable",
      "legislation_jurisdiction": "uk" | "eu" | "both",
      "suggestion": "Actionable advice to fix this issue",
      "suggested_revision": "Optional: How to reword the claim"
    }
  ]
}

IMPORTANT:
- Be thorough but fair - not every environmental statement is greenwashing
- Focus on claims that could genuinely mislead consumers
- Provide constructive, actionable feedback
- If content has no environmental claims, return overall_risk_level "low" with empty claims array
- Risk scores: high (70-100), medium (40-69), low (0-39)
- Return ONLY the JSON object, no other text`;

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  let scanId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = await req.json();
    scanId = body.scan_id;

    if (!scanId) {
      throw new Error('scan_id is required');
    }

    // Fetch the scan row to get the content
    const { data: scan, error: fetchError } = await supabase
      .from('public_greenwash_scans')
      .select('input_content, status')
      .eq('id', scanId)
      .single();

    if (fetchError || !scan) {
      throw new Error('Scan not found');
    }

    if (scan.status !== 'processing') {
      return new Response(
        JSON.stringify({ error: 'Scan is not in processing state' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!scan.input_content) {
      throw new Error('No content to analyse');
    }

    if (!ANTHROPIC_API_KEY || ANTHROPIC_API_KEY.length < 10) {
      console.error('ANTHROPIC_API_KEY not configured properly');
      await supabase
        .from('public_greenwash_scans')
        .update({ status: 'failed', error_message: 'Analysis service is temporarily unavailable.' })
        .eq('id', scanId);
      return new Response(
        JSON.stringify({ error: 'AI analysis is not configured.' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Call Anthropic API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 120000);

    let response: Response;
    try {
      response = await fetch(ANTHROPIC_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': ANTHROPIC_API_KEY,
          'anthropic-version': ANTHROPIC_VERSION,
        },
        signal: controller.signal,
        body: JSON.stringify({
          model: ANTHROPIC_MODEL,
          max_tokens: 8192,
          temperature: 0.2,
          system: SYSTEM_PROMPT,
          messages: [
            {
              role: 'user',
              content: `Analyse the following content for greenwashing risks:\n\n${scan.input_content.substring(0, 30000)}`,
            },
          ],
        }),
      });
    } catch (fetchError: unknown) {
      clearTimeout(timeoutId);
      const errName = fetchError instanceof Error ? fetchError.name : '';
      if (errName === 'AbortError') {
        throw new Error('Analysis timed out. The page content may be too large.');
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Anthropic API error ${response.status}:`, errorText);
      throw new Error(`AI analysis error: ${response.status}`);
    }

    const data = await response.json();

    if (!data.content?.[0]?.text) {
      throw new Error('Unexpected AI response format');
    }

    const responseText = data.content[0].text;
    const jsonMatch = responseText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Failed to parse analysis results');
    }

    const result = JSON.parse(jsonMatch[0]);

    // Update the scan row with results
    const { error: updateError } = await supabase
      .from('public_greenwash_scans')
      .update({
        status: 'completed',
        overall_risk_level: result.overall_risk_level,
        overall_risk_score: result.overall_risk_score,
        summary: result.summary,
        recommendations: result.recommendations || [],
        legislation_applied: result.legislation_applied || [],
        claims: result.claims || [],
        input_content: null, // Clear content after analysis to save space
      })
      .eq('id', scanId);

    if (updateError) {
      console.error('Error updating scan:', updateError);
      throw updateError;
    }

    return new Response(
      JSON.stringify({ success: true, scan_id: scanId }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  } catch (error: unknown) {
    console.error('Error analysing public greenwash scan:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (scanId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('public_greenwash_scans')
          .update({ status: 'failed', error_message: errorMessage })
          .eq('id', scanId);
      } catch (cleanupError) {
        console.error('Failed to update scan status:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({ error: errorMessage }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
