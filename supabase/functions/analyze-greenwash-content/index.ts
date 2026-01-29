import { createClient } from 'npm:@supabase/supabase-js@2.58.0';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Client-Info, Apikey',
};

const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');

interface AnalysisRequest {
  assessment_id: string;
  content: string;
  input_type: 'url' | 'document' | 'text' | 'social_media';
  input_source?: string;
}

interface ClaimAnalysis {
  claim_text: string;
  claim_context?: string;
  risk_level: 'low' | 'medium' | 'high';
  risk_score: number;
  issue_type: string;
  issue_description: string;
  legislation_name: string;
  legislation_article?: string;
  legislation_jurisdiction: 'uk' | 'eu' | 'both';
  suggestion: string;
  suggested_revision?: string;
}

interface AnalysisResult {
  overall_risk_level: 'low' | 'medium' | 'high';
  overall_risk_score: number;
  summary: string;
  recommendations: string[];
  legislation_applied: Array<{
    name: string;
    jurisdiction: 'uk' | 'eu' | 'both';
    key_requirement: string;
  }>;
  claims: ClaimAnalysis[];
}

const ANALYSIS_PROMPT = `You are a legal compliance expert specializing in environmental marketing claims and anti-greenwashing legislation. Analyze the following content for potential greenwashing risks.

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
- Bans generic environmental claims ('eco-friendly', 'green', 'climate neutral') unless backed by recognized certification
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

## CONTENT TO ANALYZE

{CONTENT}

## RESPONSE REQUIREMENTS

Analyze the content thoroughly and respond with ONLY a valid JSON object (no markdown, no explanation outside JSON):

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

  let assessmentId: string | null = null;

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body: AnalysisRequest = await req.json();
    assessmentId = body.assessment_id;

    console.log(`Starting greenwash analysis for assessment: ${assessmentId}`);

    if (!assessmentId || !body.content) {
      throw new Error('assessment_id and content are required');
    }

    if (!GEMINI_API_KEY || GEMINI_API_KEY.length < 10) {
      console.error('GEMINI_API_KEY not configured properly');

      await supabase
        .from('greenwash_assessments')
        .update({
          status: 'failed',
          error_message: 'AI analysis not configured - contact support',
        })
        .eq('id', assessmentId);

      return new Response(
        JSON.stringify({
          error: 'AI analysis is not configured. Please contact support.',
          needsSetup: true
        }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Update status to processing
    await supabase
      .from('greenwash_assessments')
      .update({
        status: 'processing',
        input_content: body.content.substring(0, 50000), // Store first 50k chars
      })
      .eq('id', assessmentId);

    // Build the prompt with content
    const prompt = ANALYSIS_PROMPT.replace('{CONTENT}', body.content.substring(0, 30000));

    console.log(`Calling Gemini API for analysis (content length: ${body.content.length})...`);

    // Call Gemini API
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout for complex analysis

    let response: Response;

    try {
      response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          signal: controller.signal,
          body: JSON.stringify({
            contents: [
              {
                parts: [
                  {
                    text: prompt,
                  },
                ],
              },
            ],
            generationConfig: {
              temperature: 0.2, // Low temperature for consistent analysis
              topK: 20,
              topP: 0.9,
              maxOutputTokens: 8192,
              responseMimeType: 'application/json',
            },
          }),
        }
      );
    } catch (fetchError: any) {
      clearTimeout(timeoutId);
      if (fetchError.name === 'AbortError') {
        console.error('Gemini API call timed out after 60 seconds');
        throw new Error('Analysis timed out - content may be too complex');
      }
      throw fetchError;
    }

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`Gemini API error ${response.status}:`, errorText);
      throw new Error(`AI analysis error: ${response.status}`);
    }

    console.log('Gemini API call successful, parsing response...');

    const data = await response.json();

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      console.error('Unexpected Gemini response structure');
      throw new Error('Unexpected AI response format');
    }

    const content = data.candidates[0].content.parts[0].text;
    let analysisResult: AnalysisResult;

    try {
      analysisResult = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse Gemini response:', content?.substring(0, 500));
      throw new Error('Failed to parse AI analysis results');
    }

    console.log(`Analysis complete: ${analysisResult.overall_risk_level} risk, ${analysisResult.claims.length} claims identified`);

    // Update the assessment with results
    const { error: updateError } = await supabase
      .from('greenwash_assessments')
      .update({
        status: 'completed',
        overall_risk_level: analysisResult.overall_risk_level,
        overall_risk_score: analysisResult.overall_risk_score,
        summary: analysisResult.summary,
        recommendations: analysisResult.recommendations,
        legislation_applied: analysisResult.legislation_applied,
        completed_at: new Date().toISOString(),
      })
      .eq('id', assessmentId);

    if (updateError) {
      console.error('Error updating assessment:', updateError);
      throw updateError;
    }

    // Deduplicate claims by claim_text to prevent duplicates from AI output
    const seenClaimTexts = new Set<string>();
    const uniqueClaims = analysisResult.claims.filter((claim) => {
      const normalized = claim.claim_text.trim().toLowerCase();
      if (seenClaimTexts.has(normalized)) return false;
      seenClaimTexts.add(normalized);
      return true;
    });

    if (uniqueClaims.length < analysisResult.claims.length) {
      console.log(`Deduplicated claims: ${analysisResult.claims.length} -> ${uniqueClaims.length}`);
    }

    // Insert claims
    if (uniqueClaims.length > 0) {
      const claimsToInsert = uniqueClaims.map((claim, index) => ({
        assessment_id: assessmentId,
        claim_text: claim.claim_text,
        claim_context: claim.claim_context || null,
        risk_level: claim.risk_level,
        risk_score: claim.risk_score,
        issue_type: claim.issue_type,
        issue_description: claim.issue_description,
        legislation_name: claim.legislation_name,
        legislation_article: claim.legislation_article || null,
        legislation_jurisdiction: claim.legislation_jurisdiction,
        suggestion: claim.suggestion,
        suggested_revision: claim.suggested_revision || null,
        display_order: index,
      }));

      const { error: claimsError } = await supabase
        .from('greenwash_assessment_claims')
        .insert(claimsToInsert);

      if (claimsError) {
        console.error('Error inserting claims:', claimsError);
        // Don't throw - assessment is still valid
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        assessment_id: assessmentId,
        overall_risk_level: analysisResult.overall_risk_level,
        claims_count: uniqueClaims.length,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error: any) {
    console.error('Error analyzing greenwash content:', error);

    const errorMessage = error instanceof Error ? error.message : String(error);

    if (assessmentId) {
      try {
        const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
        const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        await supabase
          .from('greenwash_assessments')
          .update({
            status: 'failed',
            error_message: errorMessage,
          })
          .eq('id', assessmentId);
      } catch (cleanupError) {
        console.error('Failed to update assessment status:', cleanupError);
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        needsSetup: !GEMINI_API_KEY
      }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
