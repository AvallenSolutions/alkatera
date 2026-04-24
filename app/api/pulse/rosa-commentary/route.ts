/**
 * Pulse -- Rosa commentary for an expanded view.
 *
 * POST /api/pulse/rosa-commentary
 *   body: {
 *     widget_id: 'top-cost-drivers' | 'supplier-hotspots' | ...
 *     context: Record<string, unknown>   // widget-specific summary
 *   }
 *
 * Generates a short commentary block (2-4 bullets) explaining what the data
 * shows and what to do about it. Uses the reusable Rosa tool-loop so Rosa
 * can query Pulse snapshots or run SQL if the caller's context isn't enough.
 *
 * Not cached -- runs on demand. Deliberately light on tokens (1500 max) so
 * this can be called from multiple drill views without blowing the budget.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';
import { runToolLoop } from '@/lib/rosa/run-tool-loop';

export const runtime = 'nodejs';
export const maxDuration = 45;

const WIDGET_PROMPTS: Record<string, { system: string; userPrefix: string }> = {
  'top-cost-drivers': {
    system: `You are Rosa, alkatera's sustainability AI. You are commenting on a CFO-facing "top cost drivers" panel.

Voice: British English, plain, candid, short sentences. Never use em dashes -- use " -- " instead. Three to four short bullets maximum.

Rules:
- Start with one sentence naming the biggest mover or the biggest line item.
- Flag any risks ("concentrated in one site", "growing faster than baseline").
- Offer ONE specific action the user could take next. Reference a concrete tool or data area where possible.
- If the data is thin, say so honestly. Do not invent figures.
- Prefer tool calls over guessing if you need extra context.`,
    userPrefix:
      'Please review this org\'s top cost drivers over the last 12 months and write the commentary. Context follows.',
  },
  'supplier-hotspots': {
    system: `You are Rosa, alkatera's sustainability AI. You are commenting on a Scope 3 "supplier hotspots" panel.

Voice: British English, plain, candid, short sentences. Never use em dashes -- use " -- " instead. Three to four short bullets maximum.

Rules:
- Start with one sentence on concentration risk (top-5 share, diversity).
- Call out any supplier that sits materially above the rest.
- Suggest ONE engagement move (supplier-specific decarbonisation ask, diversification, swap) with a reason.
- If the data is thin (few suppliers, low attribution coverage), say so.
- Prefer tool calls over guessing.`,
    userPrefix:
      'Please review this org\'s supplier hotspot data and write the commentary. Context follows.',
  },
};

export async function POST(request: NextRequest) {
  try {
    const apiKey = process.env.ANTHROPIC_API_KEY?.trim();
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY missing' },
        { status: 503 },
      );
    }

    const userSupabase = getSupabaseServerClient();
    const {
      data: { user },
    } = await userSupabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthenticated' }, { status: 401 });
    }

    // Resolve org.
    const { data: m } = await userSupabase
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle();
    const organizationId = m?.organization_id;
    if (!organizationId) {
      return NextResponse.json({ error: 'No organisation' }, { status: 403 });
    }

    let body: { widget_id?: string; context?: unknown };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
    }

    const widgetId = body?.widget_id ?? '';
    const spec = WIDGET_PROMPTS[widgetId];
    if (!spec) {
      return NextResponse.json(
        { error: `No commentary template for widget "${widgetId}"` },
        { status: 400 },
      );
    }

    const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY!;
    const svc = createClient(url, key, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const userMessage = `${spec.userPrefix}\n\n<context>\n${JSON.stringify(body.context ?? {}, null, 2)}\n</context>\n\nReply with three to four short bullets, nothing else.`;

    const result = await runToolLoop({
      apiKey,
      systemPrompt: spec.system,
      userMessage,
      toolContext: { supabase: svc, organizationId, userId: user.id },
      maxRounds: 3,
      maxTokens: 800,
    });

    return NextResponse.json({
      ok: true,
      text: result.text,
      rounds: result.rounds,
      tools_used: result.tools.map(t => t.name),
    });
  } catch (err: any) {
    console.error('[pulse rosa-commentary]', err);
    return NextResponse.json(
      { error: err?.message ?? 'Internal error' },
      { status: 500 },
    );
  }
}
