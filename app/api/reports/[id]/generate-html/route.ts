import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildScreenReportHtml } from '@/lib/reports/build-screen-report';

/**
 * Generate Sustainability Report HTML (screen mode)
 *
 * POST /api/reports/[id]/generate-html
 *
 * Returns a self-contained HTML document optimised for browser viewing.
 * Uses the same data pipeline as generate-pdf but skips PDFShift conversion
 * and enables screen-mode CSS (responsive, no page breaks, sticky nav).
 * The assembly + render live in lib/reports/build-screen-report so the
 * share-link flow serves the identical document.
 *
 * Authentication: Bearer token (Supabase session)
 */

export const runtime = 'nodejs';
export const maxDuration = 120;

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reportId } = await params;

    const authHeader = request.headers.get('authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }
    const token = authHeader.replace('Bearer ', '');

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    // no-store: PostgREST selects are GETs, and Next's patched fetch would
    // otherwise cache them across invocations on this no-next/headers route.
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: { Authorization: `Bearer ${token}` },
        fetch: (input, init) => fetch(input, { ...init, cache: 'no-store' }),
      },
    });

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const { data: report, error: reportError } = await supabase
      .from('generated_reports')
      .select('*')
      .eq('id', reportId)
      .single();

    if (reportError || !report) {
      return NextResponse.json({ error: 'Report not found' }, { status: 404 });
    }

    // In-flight signal. Also releases the Phase C draft lock (draft-only
    // narrative writes carry .eq('status','draft')) the moment shipping
    // starts, and stops HTML reports sitting on 'pending' while building.
    await supabase
      .from('generated_reports')
      .update({ status: 'generating_document', updated_at: new Date().toISOString() })
      .eq('id', reportId);

    const html = await buildScreenReportHtml(supabase, report);

    await supabase
      .from('generated_reports')
      .update({
        status: 'completed',
        generated_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    });
  } catch (error: any) {
    console.error('Error generating sustainability report HTML:', error);
    return NextResponse.json({ error: 'Failed to generate HTML report' }, { status: 500 });
  }
}
