import { NextRequest, NextResponse } from 'next/server';
import * as XLSX from 'xlsx';
import Anthropic from '@anthropic-ai/sdk';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { suggestHeaderMapping } from '@/lib/shared/header-suggest';
import { CLAUDE_DEFAULT_MODEL } from '@/lib/claude/models';

/**
 * Generalised "paste a spreadsheet" column mapper
 * (tasks/data-revolution-plan.md Pillar 2, CSV anything).
 *
 * Two jobs:
 *  1. When a binary spreadsheet (.xlsx/.xls) is dropped, parse it server-side
 *     with the same `xlsx` package the rest of the import stack uses
 *     (lib/bulk-import/xlsx-parser.ts) — pasted/CSV text is parsed client-side
 *     instead (lib/studio/parse-delimited.ts) and never reaches this route.
 *  2. Suggest a column mapping: the deterministic alias pass first (the same
 *     approach as the distributor/admin upload wizards,
 *     lib/shared/header-suggest.ts), then — only for fields still unmapped —
 *     a small Claude call to read the headers and a few sample rows and
 *     guess the rest, mirroring lib/claude/evidence-suggester.ts.
 */

interface FieldSpec {
  key: string;
  label: string;
  required: boolean;
  aliases?: string[];
}

export async function POST(request: NextRequest) {
  try {
    const { user, error: authError } = await getSupabaseAPIClient();
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const body = await request.json();
    const fields: FieldSpec[] = Array.isArray(body.fields) ? body.fields : [];
    const aliasesByKey: Record<string, string[]> = body.aliases || {};

    let headers: string[];
    let rows: Record<string, string>[] | undefined;

    if (body.fileBase64) {
      const buf = Buffer.from(body.fileBase64, 'base64');
      const wb = XLSX.read(buf, { type: 'buffer' });
      const sheetName = wb.SheetNames[0];
      const ws = sheetName ? wb.Sheets[sheetName] : null;
      if (!ws) {
        return NextResponse.json({ error: 'No readable sheet found in that file' }, { status: 400 });
      }
      const json = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: '' });
      headers = json.length ? Object.keys(json[0]) : [];
      rows = json.map((r) =>
        Object.fromEntries(Object.entries(r).map(([k, v]) => [k, v == null ? '' : String(v)])),
      );
    } else {
      headers = Array.isArray(body.headers) ? body.headers : [];
      rows = Array.isArray(body.sampleRows) ? body.sampleRows : undefined;
    }

    // Deterministic alias pass — same lib the distributor/admin upload
    // wizards already use, given each field's own alias list.
    const aliasMap = Object.fromEntries(
      fields.map((f) => [f.key, aliasesByKey[f.key]?.length ? aliasesByKey[f.key] : [f.label.toLowerCase()]]),
    );
    const suggestions = suggestHeaderMapping(headers, aliasMap);

    // AI fallback, only for required fields the alias pass missed.
    const stillMissing = fields.filter((f) => f.required && !suggestions[f.key]);
    if (stillMissing.length > 0 && headers.length > 0 && process.env.ANTHROPIC_API_KEY) {
      try {
        const aiMapping = await suggestMappingWithAI(headers, rows?.slice(0, 5) ?? [], stillMissing);
        Object.assign(suggestions, aiMapping);
      } catch (err) {
        console.error('[csv-column-mapping] AI fallback failed:', err);
      }
    }

    return NextResponse.json({
      headers,
      rows,
      suggestions,
    });
  } catch (error) {
    console.error('Error in POST /api/studio/csv-column-mapping:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

async function suggestMappingWithAI(
  headers: string[],
  sampleRows: Record<string, string>[],
  missing: FieldSpec[],
): Promise<Record<string, string>> {
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const sampleLines = sampleRows
    .slice(0, 5)
    .map((r) => headers.map((h) => r[h] ?? '').join(' | '))
    .join('\n');

  const response = await anthropic.messages.create({
    model: CLAUDE_DEFAULT_MODEL,
    max_tokens: 512,
    system:
      'You map spreadsheet column headers to known data-import fields. Only match a header to a ' +
      'field when the header text and sample values make you confident it holds that data. Omit a ' +
      'field entirely rather than guess.',
    tools: [
      {
        name: 'map_columns',
        description: 'Return the header (verbatim, from the provided list) that best matches each requested field.',
        input_schema: {
          type: 'object' as const,
          properties: {
            mapping: {
              type: 'object',
              description: 'field key -> exact header string from the headers list',
              additionalProperties: { type: 'string' },
            },
          },
          required: ['mapping'],
        },
      },
    ],
    tool_choice: { type: 'tool', name: 'map_columns' },
    messages: [
      {
        role: 'user',
        content:
          `Headers (pipe-separated, in column order): ${headers.join(' | ')}\n\n` +
          `First rows, same column order:\n${sampleLines}\n\n` +
          `Fields needing a column match:\n${missing.map((f) => `- ${f.key}: ${f.label}`).join('\n')}\n\n` +
          'Call map_columns with your best mapping.',
      },
    ],
  });

  const toolUse = response.content.find((c) => c.type === 'tool_use');
  if (!toolUse || toolUse.type !== 'tool_use') return {};
  const input = toolUse.input as { mapping?: Record<string, string> };
  const raw = input?.mapping || {};

  const headerSet = new Set(headers);
  const out: Record<string, string> = {};
  for (const f of missing) {
    const h = raw[f.key];
    if (h && headerSet.has(h)) out[f.key] = h;
  }
  return out;
}
