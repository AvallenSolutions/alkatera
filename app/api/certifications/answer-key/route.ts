import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { buildAnswerKey } from '@/lib/certifications/answer-key';
import {
  answerKeyToAoa,
  answerKeyToCsv,
  ANSWER_KEY_COL_WIDTHS,
} from '@/lib/certifications/answer-key-format';
import { enforceExportAllowed } from '@/middleware/subscription-check';

export const runtime = 'nodejs';
export const maxDuration = 60;

/**
 * GET /api/certifications/answer-key?format=xlsx|csv
 *
 * The "answer key": a spreadsheet of every applicable B Corp requirement with a
 * paste-ready answer synthesised from the org's alkatera data, so a user can
 * work down it while filling B Lab's own questionnaire.
 */
export async function GET(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } =
      await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const organizationId = await resolveAccessibleOrg(supabase, user);
    if (!organizationId) {
      return NextResponse.json(
        { error: 'No organisation found' },
        { status: 403 },
      );
    }

    const exportBlocked = await enforceExportAllowed(organizationId);
    if (exportBlocked) return exportBlocked;

    const data = await buildAnswerKey(supabase, organizationId);
    if (data.rows.length === 0) {
      return NextResponse.json(
        { error: 'No B Corp certification started yet — nothing to export.' },
        { status: 400 },
      );
    }

    const format = request.nextUrl.searchParams.get('format') === 'csv'
      ? 'csv'
      : 'xlsx';

    if (format === 'csv') {
      const csv = answerKeyToCsv(data);
      return new NextResponse(csv, {
        status: 200,
        headers: {
          'Content-Type': 'text/csv; charset=utf-8',
          'Content-Disposition':
            'attachment; filename="bcorp-answer-key.csv"',
          'Cache-Control': 'private, no-cache',
        },
      });
    }

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.aoa_to_sheet(answerKeyToAoa(data));
    ws['!cols'] = ANSWER_KEY_COL_WIDTHS.map((wch) => ({ wch }));
    XLSX.utils.book_append_sheet(wb, ws, 'B Corp answer key');
    const buffer = XLSX.write(wb, {
      type: 'buffer',
      bookType: 'xlsx',
    }) as Buffer;

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type':
          'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition':
          'attachment; filename="bcorp-answer-key.xlsx"',
        'Content-Length': String(buffer.length),
        'Cache-Control': 'private, no-cache',
      },
    });
  } catch (error) {
    console.error('Error in GET /api/certifications/answer-key:', error);
    return NextResponse.json(
      { error: 'Failed to generate the answer key' },
      { status: 500 },
    );
  }
}
