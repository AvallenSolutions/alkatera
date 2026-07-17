import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { safeCompare } from '@/lib/utils/safe-compare';
import { runInsightsSweep } from '@/lib/pulse/cron-jobs';

/**
 * Cron: Pulse — generate daily AI insights
 *
 * POST /api/cron/generate-insights
 *
 * Manual/admin trigger. In production this sweep runs on the
 * `pulseGenerateInsights` Inngest native cron
 * (lib/inngest/functions/pulse-jobs.ts, daily ~06:00 UTC) — this route
 * calls the same `runInsightsSweep` for on-demand use.
 *
 * Falls back gracefully if GEMINI_API_KEY is missing — logs and skips.
 */

export const runtime = 'nodejs';
export const maxDuration = 300;

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret || !authHeader || !safeCompare(authHeader, `Bearer ${cronSecret}`)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey =
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }

    const supabase = createClient(supabaseUrl, supabaseKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Distinguish "API key not configured" from "Gemini call failed for org X".
    // Claude Code injects an empty GEMINI_API_KEY into child processes for
    // security, so runInsightsSweep trims and treats empty as missing too —
    // it returns null in that case.
    const result = await runInsightsSweep(supabase);
    if (result === null) {
      return NextResponse.json(
        {
          error: 'GEMINI_API_KEY missing or empty',
          hint:
            'Set GEMINI_API_KEY in your environment. For local dev, ensure your ' +
            'shell does not export an empty GEMINI_API_KEY (Claude Code does this ' +
            'by default — start the dev server in a terminal where the var is unset).',
        },
        { status: 503 },
      );
    }

    return NextResponse.json(result);
  } catch (err: any) {
    console.error('[generate-insights cron]', err);
    return NextResponse.json({ error: err?.message ?? 'Internal server error' }, { status: 500 });
  }
}
