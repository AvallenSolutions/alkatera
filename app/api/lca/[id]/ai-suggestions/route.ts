/**
 * AI Suggestions API for LCA Compliance Wizard
 *
 * POST /api/lca/[id]/ai-suggestions
 *
 * Generates AI-powered suggestions for LCA compliance fields using Claude.
 * Falls back to static defaults if the API is unavailable.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createServerClient, type CookieOptions } from '@supabase/ssr';
import { cookies } from 'next/headers';
import {
  generateSuggestion,
  getStaticFallback,
  getExplanation,
  type SuggestionField,
  type LcaContext,
} from '@/lib/claude/lca-assistant';

// Rate limiting - simple in-memory store (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 10; // suggestions per session
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(sessionId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(sessionId);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(sessionId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: pcfId } = await params;

    // Authenticate via Bearer token OR cookies
    const authHeader = request.headers.get('Authorization');
    let supabase;
    let user;

    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          global: { headers: { Authorization: `Bearer ${token}` } },
        }
      );
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = data.user;
    } else {
      // Fall back to cookie-based auth
      const cookieStore = cookies();
      supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            get(name: string) { return cookieStore.get(name)?.value },
            set(name: string, value: string, options: CookieOptions) {
              try { cookieStore.set({ name, value, ...options }) } catch {}
            },
            remove(name: string, options: CookieOptions) {
              try { cookieStore.set({ name, value: '', ...options }) } catch {}
            },
          },
        }
      );
      const { data, error: authError } = await supabase.auth.getUser();
      if (authError || !data.user) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
      }
      user = data.user;
    }

    // Parse request body
    const body = await request.json();
    const { field, context, action } = body as {
      field?: SuggestionField;
      context?: Partial<LcaContext>;
      action?: 'suggest' | 'explain';
      term?: string;
    };

    // Handle term explanation
    if (action === 'explain' && body.term) {
      try {
        const explanation = await getExplanation(body.term);
        return NextResponse.json({
          success: true,
          explanation,
        });
      } catch {
        return NextResponse.json({
          success: true,
          explanation: {
            term: body.term,
            explanation: `"${body.term}" is a technical term used in Life Cycle Assessment.`,
          },
        });
      }
    }

    // Validate field for suggestions
    if (!field) {
      return NextResponse.json(
        { error: 'Missing required field parameter' },
        { status: 400 }
      );
    }

    const validFields: SuggestionField[] = [
      'intended_application',
      'reasons_for_study',
      'cutoff_criteria',
      'assumptions',
      'functional_unit',
      'system_boundary',
      'executive_summary',
      'key_findings',
      'limitations',
      'recommendations',
    ];

    if (!validFields.includes(field)) {
      return NextResponse.json(
        { error: `Invalid field: ${field}. Valid fields: ${validFields.join(', ')}` },
        { status: 400 }
      );
    }

    // Check rate limit
    const sessionId = `${user.id}-${pcfId}`;
    const rateLimit = checkRateLimit(sessionId);
    if (!rateLimit.allowed) {
      // Fall back to static suggestions
      const fallback = getStaticFallback(field, context as LcaContext);
      return NextResponse.json({
        success: true,
        suggestion: fallback,
        reasoning: 'Rate limit reached. Using static suggestion.',
        rateLimited: true,
        remaining: 0,
      });
    }

    // Fetch PCF data to enrich context
    const { data: pcf } = await supabase
      .from('product_carbon_footprints')
      .select(`
        *,
        products!inner(name, category)
      `)
      .eq('id', pcfId)
      .single();

    if (!pcf) {
      return NextResponse.json({ error: 'PCF not found' }, { status: 404 });
    }

    // Fetch materials for context
    const { data: materials } = await supabase
      .from('product_carbon_footprint_materials')
      .select('material_name, quantity, unit, impact_climate')
      .eq('pcf_id', pcfId)
      .order('impact_climate', { ascending: false })
      .limit(5);

    // Build full context
    const fullContext: LcaContext = {
      productName: pcf.products?.name || 'Product',
      productCategory: pcf.products?.category || context?.productCategory,
      functionalUnit: pcf.functional_unit || context?.functionalUnit,
      systemBoundary: pcf.system_boundary || context?.systemBoundary,
      totalGwp: pcf.aggregated_impacts?.climate_change_gwp100,
      intendedAudience: pcf.intended_audience,
      isComparativeAssertion: pcf.is_comparative_assertion,
      topContributors: materials?.map((m: any) => ({
        name: m.material_name,
        contribution: pcf.aggregated_impacts?.climate_change_gwp100
          ? Math.round((m.impact_climate / pcf.aggregated_impacts.climate_change_gwp100) * 100)
          : 0,
      })),
      materials: materials?.map((m: any) => ({
        name: m.material_name,
        quantity: m.quantity,
        unit: m.unit,
      })),
      ...context,
    };

    // Check if Claude API is configured
    if (!process.env.ANTHROPIC_API_KEY) {
      // Fall back to static suggestions
      const fallback = getStaticFallback(field, fullContext);
      return NextResponse.json({
        success: true,
        suggestion: fallback,
        reasoning: 'AI suggestions not configured. Using static suggestion.',
        fallback: true,
        remaining: rateLimit.remaining,
      });
    }

    // Generate AI suggestion
    try {
      const result = await generateSuggestion(field, fullContext);

      return NextResponse.json({
        success: true,
        suggestion: result.suggestion,
        reasoning: result.reasoning,
        alternatives: result.alternatives,
        cached: result.cached,
        remaining: rateLimit.remaining,
      });
    } catch (aiError) {
      console.error('[AI Suggestions] Claude API error:', aiError);

      // Fall back to static suggestions
      const fallback = getStaticFallback(field, fullContext);
      return NextResponse.json({
        success: true,
        suggestion: fallback,
        reasoning: 'AI service temporarily unavailable. Using static suggestion.',
        fallback: true,
        remaining: rateLimit.remaining,
      });
    }
  } catch (error) {
    console.error('[AI Suggestions] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}

/**
 * GET /api/lca/[id]/ai-suggestions
 *
 * Returns rate limit status and available suggestion fields
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: pcfId } = await params;

  // Authenticate via Bearer token OR cookies
  const authHeader = request.headers.get('Authorization');
  let user;

  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      { global: { headers: { Authorization: `Bearer ${token}` } } }
    );
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    user = data.user;
  } else {
    const cookieStore = cookies();
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }) } catch {}
          },
        },
      }
    );
    const { data, error: authError } = await supabase.auth.getUser();
    if (authError || !data.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    user = data.user;
  }

  // Check rate limit status
  const sessionId = `${user.id}-${pcfId}`;
  const record = rateLimitStore.get(sessionId);
  const now = Date.now();

  let remaining = RATE_LIMIT;
  if (record && now < record.resetTime) {
    remaining = Math.max(0, RATE_LIMIT - record.count);
  }

  return NextResponse.json({
    available: !!process.env.ANTHROPIC_API_KEY,
    rateLimit: RATE_LIMIT,
    remaining,
    resetIn: record && now < record.resetTime
      ? Math.ceil((record.resetTime - now) / 1000 / 60) // minutes
      : 0,
    fields: [
      'intended_application',
      'reasons_for_study',
      'cutoff_criteria',
      'assumptions',
      'functional_unit',
      'system_boundary',
      'executive_summary',
      'key_findings',
      'limitations',
      'recommendations',
    ],
  });
}
