/**
 * PDF Narrative Generation API
 *
 * POST /api/lca/[id]/generate-pdf-narrative
 *
 * Generates AI-powered narrative content for LCA PDF reports using Claude Opus.
 * Returns executive summary, key findings, limitations, and recommendations.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateNarratives, type LcaContext } from '@/lib/claude/lca-assistant';

// ============================================================================
// TYPES
// ============================================================================

interface NarrativeRequest {
  includeExecutiveSummary?: boolean;
  includeKeyFindings?: boolean;
  includeLimitations?: boolean;
  includeRecommendations?: boolean;
}

interface NarrativeResponse {
  success: boolean;
  narratives: {
    executiveSummary?: string;
    keyFindings?: string;
    limitations?: string;
    recommendations?: string;
    dataQualityStatement?: string;
  };
  cachedAt?: string;
}

// ============================================================================
// CACHE
// ============================================================================

// Simple in-memory cache for narrative results (in production, use Redis)
const narrativeCache = new Map<
  string,
  { narratives: NarrativeResponse['narratives']; timestamp: number }
>();
const CACHE_TTL = 30 * 60 * 1000; // 30 minutes

// ============================================================================
// POST HANDLER
// ============================================================================

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pcfId } = await params;

    // Get auth token
    const authHeader = request.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const token = authHeader.split(' ')[1];

    // Initialize Supabase client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: { headers: { Authorization: `Bearer ${token}` } },
      }
    );

    // Verify user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body: NarrativeRequest = await request.json().catch(() => ({}));
    const options = {
      includeExecutiveSummary: body.includeExecutiveSummary ?? true,
      includeKeyFindings: body.includeKeyFindings ?? true,
      includeLimitations: body.includeLimitations ?? true,
      includeRecommendations: body.includeRecommendations ?? true,
    };

    // Check cache
    const cacheKey = `${pcfId}-${JSON.stringify(options)}`;
    const cached = narrativeCache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json({
        success: true,
        narratives: cached.narratives,
        cachedAt: new Date(cached.timestamp).toISOString(),
      });
    }

    // Fetch PCF data
    const { data: pcf, error: pcfError } = await supabase
      .from('product_carbon_footprints')
      .select(
        `
        *,
        products!inner(name, category),
        lca_interpretation_results(
          contribution_analysis,
          sensitivity_results,
          completeness_score,
          consistency_issues,
          methodology_consistent,
          key_findings
        )
      `
      )
      .eq('id', pcfId)
      .single();

    if (pcfError || !pcf) {
      return NextResponse.json({ error: 'PCF not found' }, { status: 404 });
    }

    // Fetch materials for context
    const { data: materials } = await supabase
      .from('product_carbon_footprint_materials')
      .select('material_name, quantity, unit, impact_climate, data_source')
      .eq('product_carbon_footprint_id', pcfId)
      .order('impact_climate', { ascending: false })
      .limit(10);

    // Build context for Claude
    const context: LcaContext = {
      productName: pcf.products?.name || 'Product',
      productCategory: pcf.products?.category,
      functionalUnit: pcf.functional_unit,
      systemBoundary: pcf.system_boundary,
      totalGwp: pcf.aggregated_impacts?.climate_change_gwp100,
      intendedAudience: pcf.intended_audience,
      isComparativeAssertion: pcf.is_comparative_assertion,
      topContributors: materials?.map((m: any) => ({
        name: m.material_name,
        contribution: pcf.aggregated_impacts?.climate_change_gwp100
          ? Math.round(
              (m.impact_climate / pcf.aggregated_impacts.climate_change_gwp100) *
                100
            )
          : 0,
      })),
      materials: materials?.map((m: any) => ({
        name: m.material_name,
        quantity: m.quantity,
        unit: m.unit,
      })),
      interpretationData: pcf.lca_interpretation_results?.[0],
      dataQuality: pcf.data_quality_requirements,
      cutoffCriteria: pcf.cutoff_criteria,
      assumptions: pcf.assumptions_limitations,
    };

    // Check if Claude API is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      // Return static fallback narratives
      const fallbackNarratives = generateFallbackNarratives(context);
      return NextResponse.json({
        success: true,
        narratives: fallbackNarratives,
        fallback: true,
      });
    }

    // Generate narratives using Claude Opus
    try {
      const narratives = await generateNarratives(context);

      // Cache the results
      narrativeCache.set(cacheKey, {
        narratives,
        timestamp: Date.now(),
      });

      return NextResponse.json({
        success: true,
        narratives,
      });
    } catch (aiError) {
      console.error('[PDF Narratives] Claude API error:', aiError);

      // Fall back to static narratives
      const fallbackNarratives = generateFallbackNarratives(context);
      return NextResponse.json({
        success: true,
        narratives: fallbackNarratives,
        fallback: true,
      });
    }
  } catch (error) {
    console.error('[PDF Narratives] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

// ============================================================================
// FALLBACK NARRATIVES
// ============================================================================

function generateFallbackNarratives(context: LcaContext) {
  const productName = context.productName || 'This product';
  const totalGwp = context.totalGwp?.toFixed(2) || 'N/A';
  const topContributor = context.topContributors?.[0];

  return {
    executiveSummary: `This Life Cycle Assessment (LCA) evaluates the environmental impacts of ${productName} in accordance with ISO 14044:2006 and ISO 14067:2018 standards. The assessment covers a ${context.systemBoundary || 'cradle-to-gate'} boundary with a functional unit of ${context.functionalUnit || '1 unit of product'}. The total carbon footprint is ${totalGwp} kg CO₂e.`,

    keyFindings: `Total carbon footprint: ${totalGwp} kg CO₂e per functional unit. ${
      topContributor
        ? `${topContributor.name} is the largest contributor at ${topContributor.contribution}% of total impact.`
        : 'Impact contribution analysis is available in the detailed report.'
    } Assessment boundary: ${context.systemBoundary || 'Cradle-to-gate'}. Data quality meets ISO 14044 requirements for screening-level LCA.`,

    limitations: `This assessment is subject to the following limitations: ${
      context.assumptions?.length
        ? context.assumptions.join('; ')
        : 'Standard industry assumptions apply for data gaps; temporal scope limited to reference year; geographic scope limited to regions with available data'
    }. ${context.cutoffCriteria || 'Cut-off criteria of <1% mass/energy contribution applied.'}`,

    recommendations: 'Focus improvement efforts on high-impact materials and processes. Consider supplier-specific data collection to improve data quality. Explore alternative materials for components with highest environmental impact. Update assessment annually to track improvement progress.',
  };
}

// ============================================================================
// GET HANDLER (check cache status)
// ============================================================================

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;

  // Check if narratives are cached
  const cacheKeys = Array.from(narrativeCache.keys()).filter((key) =>
    key.startsWith(pcfId)
  );

  const cachedEntry = cacheKeys.length > 0 ? narrativeCache.get(cacheKeys[0]) : null;

  return NextResponse.json({
    available: !!process.env.ANTHROPIC_API_KEY,
    cached: !!cachedEntry,
    cachedAt: cachedEntry ? new Date(cachedEntry.timestamp).toISOString() : null,
    cacheExpiry: cachedEntry
      ? new Date(cachedEntry.timestamp + CACHE_TTL).toISOString()
      : null,
  });
}
