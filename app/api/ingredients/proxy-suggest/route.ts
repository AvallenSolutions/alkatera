/**
 * Proxy Suggestion API
 *
 * POST /api/ingredients/proxy-suggest
 *
 * Uses Claude to suggest appropriate proxy emission factors for ingredients
 * that cannot be directly matched to ecoinvent or Agribalyse databases.
 *
 * Returns ranked proxy suggestions with reasoning and confidence levels.
 */

import { NextRequest, NextResponse } from 'next/server';
import { suggestProxy, type ProxyAdvisorInput } from '@/lib/claude/proxy-advisor';

export const dynamic = 'force-dynamic';

// Rate limiting — simple in-memory store (for production, use Redis)
const rateLimitStore = new Map<string, { count: number; resetTime: number }>();
const RATE_LIMIT = 30; // proxy suggestions per session
const RATE_LIMIT_WINDOW = 60 * 60 * 1000; // 1 hour

function checkRateLimit(userId: string): { allowed: boolean; remaining: number } {
  const now = Date.now();
  const record = rateLimitStore.get(userId);

  if (!record || now > record.resetTime) {
    rateLimitStore.set(userId, { count: 1, resetTime: now + RATE_LIMIT_WINDOW });
    return { allowed: true, remaining: RATE_LIMIT - 1 };
  }

  if (record.count >= RATE_LIMIT) {
    return { allowed: false, remaining: 0 };
  }

  record.count++;
  return { allowed: true, remaining: RATE_LIMIT - record.count };
}

export async function POST(request: NextRequest) {
  try {
    // Auth check via Bearer token (same pattern as /api/ingredients/search)
    const authHeader = request.headers.get('authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
      return NextResponse.json(
        { error: 'Unauthorized — No token provided' },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const { createClient } = await import('@supabase/supabase-js');
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    });

    const { data: user, error: userError } = await supabase.auth.getUser();
    if (userError || !user?.user) {
      return NextResponse.json(
        { error: 'Unauthorized — Invalid token' },
        { status: 401 }
      );
    }

    // Rate limit check
    const rateLimit = checkRateLimit(user.user.id);
    if (!rateLimit.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Please try again later.', remaining: 0 },
        { status: 429 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { ingredient_name, ingredient_type, product_context } = body as {
      ingredient_name?: string;
      ingredient_type?: 'ingredient' | 'packaging';
      product_context?: string;
    };

    if (!ingredient_name || ingredient_name.trim().length === 0) {
      return NextResponse.json(
        { error: 'Missing required field: ingredient_name' },
        { status: 400 }
      );
    }

    const input: ProxyAdvisorInput = {
      ingredient_name: ingredient_name.trim(),
      ingredient_type: ingredient_type || 'ingredient',
      product_context,
    };

    // Generate proxy suggestions
    const result = await suggestProxy(input);

    // Validate each suggestion by checking if its search_query returns actual
    // database results. This prevents Claude from hallucinating ingredient names
    // that don't exist in our emission factor databases (e.g. "Maple syrup"
    // with "high" confidence when no such entry exists).
    const organization_id = (body as any).organization_id as string | undefined;
    const searchBaseUrl = new URL('/api/ingredients/search', request.url);

    const validatedSuggestions = await Promise.all(
      result.suggestions.map(async (suggestion) => {
        try {
          const searchUrl = new URL(searchBaseUrl);
          searchUrl.searchParams.set('q', suggestion.search_query);
          if (organization_id) {
            searchUrl.searchParams.set('organization_id', organization_id);
          }

          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);

          const searchResponse = await fetch(searchUrl.toString(), {
            headers: { Authorization: authHeader! },
            signal: controller.signal,
          });
          clearTimeout(timeout);

          if (searchResponse.ok) {
            const searchData = await searchResponse.json();
            if (searchData.results && searchData.results.length > 0) {
              return {
                ...suggestion,
                validated: true,
                result_count: searchData.results.length,
                top_match_name: searchData.results[0].name,
              };
            }
          }
          // No results found — mark as unvalidated
          return { ...suggestion, validated: false };
        } catch {
          // Timeout or error — include anyway but mark as unvalidated
          return { ...suggestion, validated: false };
        }
      })
    );

    // Prefer validated suggestions, but fall back to all if none validated
    const verified = validatedSuggestions.filter(s => s.validated !== false);
    const finalSuggestions = verified.length > 0
      ? verified
      : validatedSuggestions;

    return NextResponse.json({
      success: true,
      suggestions: finalSuggestions,
      cached: result.cached,
      from_fallback: result.from_fallback,
      remaining: rateLimit.remaining,
    });
  } catch (error) {
    console.error('[Proxy Suggest API] Unexpected error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
