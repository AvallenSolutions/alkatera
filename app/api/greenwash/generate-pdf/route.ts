import { NextRequest, NextResponse } from 'next/server';
import { renderGreenwashHtml } from '@/lib/pdf/render-greenwash-html';
import { convertHtmlToPdf } from '@/lib/pdf/pdfshift-client';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const result = await request.json();

    // Basic validation
    if (!result?.url || !result?.claims || !Array.isArray(result.claims)) {
      return NextResponse.json({ error: 'Invalid analysis result' }, { status: 400 });
    }

    const html = renderGreenwashHtml(result);

    const { buffer } = await convertHtmlToPdf(html, {
      format: 'A4',
      // Margins handled by CSS @page rules
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      removeBlank: true,
    });

    const hostname = (() => {
      try { return new URL(result.url).hostname; }
      catch { return 'website'; }
    })();

    return new NextResponse(buffer, {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="greenwash-assessment-${hostname}.pdf"`,
      },
    });
  } catch (error) {
    console.error('Greenwash PDF generation error:', error);
    const message = error instanceof Error ? error.message : 'Failed to generate PDF';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
