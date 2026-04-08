import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * Executive Summary Preview
 *
 * POST /api/reports/exec-preview
 *
 * Generates a short 2-3 sentence AI preview of what the executive summary
 * will say, based on the current config and live emissions data.
 * Much cheaper than generating the full report — used in the preview panel.
 *
 * Body: { organizationId, reportYear, audience, reportFramingStatement? }
 * Auth: Bearer token header
 *
 * Returns: { preview: string, primaryMessage: string }
 */

export const runtime = 'nodejs';
export const maxDuration = 30;

// 10-minute in-memory cache keyed on org+year+audience+framing
const previewCache = new Map<string, { result: { preview: string; primaryMessage: string }; expiresAt: number }>();
const CACHE_TTL = 10 * 60 * 1000;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const { organizationId, reportYear, audience, reportFramingStatement } = body as {
      organizationId: string;
      reportYear: number;
      audience: string;
      reportFramingStatement?: string;
    };

    if (!organizationId || !reportYear) {
      return NextResponse.json({ error: 'organizationId and reportYear are required' }, { status: 400 });
    }

    // Cache key
    const cacheKey = `${organizationId}-${reportYear}-${audience}-${reportFramingStatement || ''}`;
    const cached = previewCache.get(cacheKey);
    if (cached && Date.now() < cached.expiresAt) {
      return NextResponse.json(cached.result);
    }

    // Fetch org name and live emissions
    const [orgResult, corpResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('name, industry_sector')
        .eq('id', organizationId)
        .single(),
      supabase
        .from('corporate_reports')
        .select('total_emissions, breakdown_json')
        .eq('organization_id', organizationId)
        .eq('report_year', reportYear)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);

    const orgName = orgResult.data?.name || 'the organisation';
    const sector = orgResult.data?.industry_sector || '';
    const total = corpResult.data?.total_emissions || 0;
    const bj = (corpResult.data?.breakdown_json as any) || {};

    // If no emissions data, return a placeholder immediately (no AI call)
    if (total === 0) {
      const placeholder = {
        preview: `Once you have logged your emissions data for ${reportYear}, the executive summary will be generated here automatically.`,
        primaryMessage: 'No emissions data available yet.',
      };
      return NextResponse.json(placeholder);
    }

    // Build a minimal prompt for a fast preview
    const AUDIENCE_TONE: Record<string, string> = {
      investors: 'financial materiality, ESG risk, and progress against targets',
      regulators: 'regulatory compliance and disclosure completeness',
      customers: 'product impact and brand values',
      internal: 'operational performance and actionable insights',
      'supply-chain': 'value chain transparency and shared commitments',
      technical: 'methodology and data quality',
    };

    const audienceTone = AUDIENCE_TONE[audience] || 'sustainability performance';
    const scope3Pct = total > 0 ? ((bj.scope3 || 0) / total * 100).toFixed(0) : '0';

    let prompt = `Write a 2-3 sentence executive summary preview for ${orgName}'s ${reportYear} sustainability report.

Audience: ${audience} — they care about ${audienceTone}
Sector: ${sector}
Total emissions: ${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e
Scope 1: ${(bj.scope1 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e
Scope 2: ${(bj.scope2 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e
Scope 3: ${(bj.scope3 || 0).toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e (${scope3Pct}% of total)`;

    if (reportFramingStatement) {
      prompt += `\n\nEditorial framing: "${reportFramingStatement}"`;
    }

    prompt += `

Return JSON only:
{
  "preview": "<2-3 sentence summary>",
  "primaryMessage": "<one sentence — the most important takeaway>"
}

Rules: British English, no em dashes, factual, audience-specific tone.`;

    let preview = { preview: '', primaryMessage: '' };

    try {
      const AnthropicSDK = (await import('@anthropic-ai/sdk')).default;
      const apiKey = process.env.ANTHROPIC_API_KEY;
      if (!apiKey) throw new Error('ANTHROPIC_API_KEY not set');

      const anthropic = new AnthropicSDK({ apiKey });
      const response = await anthropic.messages.create({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 256,
        messages: [{ role: 'user', content: prompt }],
      });

      const rawText = response.content[0]?.type === 'text' ? response.content[0].text : '{}';
      const cleaned = rawText.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(cleaned);
      preview = {
        preview: parsed.preview || '',
        primaryMessage: parsed.primaryMessage || '',
      };
    } catch (err) {
      console.error('[exec-preview] AI generation failed, using fallback:', err);
      preview = {
        preview: `${orgName} recorded total GHG emissions of ${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e in ${reportYear}, with Scope 3 representing ${scope3Pct}% of the total footprint. The full report covers emissions methodology, targets, and strategic initiatives.`,
        primaryMessage: `${orgName} recorded ${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e in ${reportYear}.`,
      };
    }

    previewCache.set(cacheKey, { result: preview, expiresAt: Date.now() + CACHE_TTL });
    return NextResponse.json(preview);
  } catch (error: any) {
    console.error('[exec-preview] Error:', error);
    return NextResponse.json({ error: 'Failed to generate preview' }, { status: 500 });
  }
}
