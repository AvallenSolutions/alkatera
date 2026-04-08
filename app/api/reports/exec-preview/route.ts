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

// 5-minute in-memory cache keyed on org+year+audience+framing
// Kept short so that when emissions data is updated the preview refreshes promptly.
const previewCache = new Map<string, { result: { preview: string; primaryMessage: string }; expiresAt: number }>();
const CACHE_TTL = 5 * 60 * 1000;

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

    const yearStart = `${reportYear}-01-01`;
    const yearEnd = `${reportYear}-12-31`;

    // Fetch org, corporate report (for scope1/scope2 cache), and production logs in parallel.
    // We always calculate scope3 LIVE from production_logs × PCFs — breakdown_json.scope3 can
    // be stale if persistEmissions ran before async product data had finished loading.
    const [orgResult, corpResult, prodLogsResult] = await Promise.all([
      supabase
        .from('organizations')
        .select('name, industry_sector')
        .eq('id', organizationId)
        .single(),
      supabase
        .from('corporate_reports')
        .select('id, total_emissions, breakdown_json')
        .eq('organization_id', organizationId)
        .eq('year', reportYear)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
      supabase
        .from('production_logs')
        .select('product_id, units_produced')
        .eq('organization_id', organizationId)
        .gte('date', yearStart)
        .lte('date', yearEnd),
    ]);

    const orgName = orgResult.data?.name || 'the organisation';
    const sector = orgResult.data?.industry_sector || '';
    const bj = (corpResult.data?.breakdown_json as any) || {};

    // scope1 and scope2 are reliably cached in breakdown_json (utility entries are
    // logged explicitly and don't change after the fact).
    const scope1 = typeof bj.scope1 === 'number' ? bj.scope1 : 0;
    const scope2 = typeof bj.scope2 === 'number' ? bj.scope2 : 0;

    // Scope 3 products: always calculate live from production_logs × completed PCFs.
    // pcf.aggregated_impacts.breakdown.by_scope.scope3 is in kg/unit; × quantity = kg → /1000 = tonnes.
    let scope3Products = 0;
    const prodLogs = prodLogsResult.data || [];
    if (prodLogs.length > 0) {
      const productIds = Array.from(new Set(prodLogs.map((p: any) => p.product_id)));
      const { data: pcfs } = await supabase
        .from('product_carbon_footprints')
        .select('product_id, aggregated_impacts')
        .in('product_id', productIds)
        .eq('status', 'completed');
      if (pcfs && pcfs.length > 0) {
        const pcfMap = new Map(pcfs.map((p: any) => [p.product_id, p]));
        for (const log of prodLogs) {
          const l = log as any;
          const pcf = pcfMap.get(l.product_id) as any;
          if (pcf?.aggregated_impacts?.breakdown?.by_scope?.scope3) {
            scope3Products += pcf.aggregated_impacts.breakdown.by_scope.scope3 * (l.units_produced || 0);
          }
        }
      }
    }
    scope3Products = scope3Products / 1000; // kg → tonnes

    // Secondary scope3 (overheads, fleet, xero baseline): read from cached breakdown_json.
    // These are small, stable values that don't suffer from the race-condition stale issue.
    const bj3 = (typeof bj.scope3 === 'object' && bj.scope3 !== null) ? bj.scope3 : {};
    const scope3Secondary = (bj3.overheads || 0) + (bj3.business_travel_fleet || 0) + (bj3.xero_baseline || 0);

    const scope3Total = scope3Products + scope3Secondary;
    const total = scope1 + scope2 + scope3Total;

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
    const scope3Pct = total > 0 ? (scope3Total / total * 100).toFixed(0) : '0';

    let prompt = `Write a 2-3 sentence executive summary preview for ${orgName}'s ${reportYear} sustainability report.

Audience: ${audience} — they care about ${audienceTone}
Sector: ${sector}
Total emissions: ${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e
Scope 1: ${scope1.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e
Scope 2: ${scope2.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e
Scope 3: ${scope3Total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e (${scope3Pct}% of total)`;

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
        preview: `${orgName} recorded total GHG emissions of ${total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e in ${reportYear}, with Scope 3 representing ${scope3Pct}% of the total footprint (${scope3Total.toLocaleString('en-GB', { maximumFractionDigits: 0 })} tCO2e). The full report covers emissions methodology, targets, and strategic initiatives.`,
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
