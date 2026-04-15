import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';
import { parseSprayDiary } from '@/lib/viticulture/spray-diary-parser';
import type { SprayChemicalDraft, VineyardChemicalLibraryRow } from '@/lib/types/viticulture';

/**
 * POST /api/vineyards/[id]/spray-import
 *
 * Accepts a multipart/form-data upload of an xlsx spray diary.
 * 1. Parses it using the Claude API (format-agnostic classification + aggregation)
 * 2. Enriches each chemical from vineyard_chemical_library (type override + N content)
 * 3. Returns structured chemical data for preview — does NOT save to the database
 *
 * Body (FormData):
 *   file: File — the xlsx spreadsheet
 */

function normalise(s: string): string {
  return s.toLowerCase().trim().replace(/\s+/g, ' ');
}

function findLibraryMatch(
  chemName: string,
  library: VineyardChemicalLibraryRow[]
): VineyardChemicalLibraryRow | undefined {
  const needle = normalise(chemName);

  // Pass 1: exact canonical name
  let match = library.find((row) => normalise(row.chemical_name) === needle);
  if (match) return match;

  // Pass 2: exact variant match
  match = library.find((row) =>
    row.name_variants.some((v) => normalise(v) === needle)
  );
  if (match) return match;

  // Pass 3: substring match (only if needle >= 4 chars to avoid false positives)
  if (needle.length >= 4) {
    match = library.find(
      (row) =>
        needle.includes(normalise(row.chemical_name)) ||
        normalise(row.chemical_name).includes(needle) ||
        row.name_variants.some(
          (v) => normalise(v).length >= 4 && (needle.includes(normalise(v)) || normalise(v).includes(needle))
        )
    );
  }
  return match;
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    const allowedTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
    ];
    if (!allowedTypes.includes(file.type) && !file.name.match(/\.xlsx?$/i)) {
      return NextResponse.json(
        { error: 'Only Excel files (.xlsx, .xls) are supported' },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await file.arrayBuffer());

    // Parse xlsx with Claude API
    const chemicals = await parseSprayDiary(buffer);

    // Load chemical library once (single query, ~100 rows)
    const { data: libraryData, error: libError } = await supabase
      .from('chemical_library')
      .select('id, chemical_name, name_variants, chemical_type, n_content_percent, fertiliser_subtype, active_ingredient, is_verified');

    if (libError) {
      console.warn('[SprayImport] Library fetch failed — proceeding without enrichment:', libError.message);
    }

    const library: VineyardChemicalLibraryRow[] = (libraryData ?? []).map((row: any) => ({
      ...row,
      n_content_percent: Number(row.n_content_percent) || 0,
    }));

    // Enrich each chemical from the library
    const enriched: SprayChemicalDraft[] = chemicals.map((chem) => {
      const match = findLibraryMatch(chem.chemical_name, library);
      if (match) {
        return {
          ...chem,
          chemical_type: match.chemical_type,       // library overrides Claude's classification
          n_content_percent: match.n_content_percent,
          fertiliser_subtype: match.fertiliser_subtype ?? null,
          library_matched: true,
        };
      }
      // No library match — use Claude's own N% estimate (already populated by the parser)
      return {
        ...chem,
        n_content_percent: chem.n_content_percent ?? 0,
        fertiliser_subtype: chem.fertiliser_subtype ?? null,
        library_matched: false,
      };
    });

    return NextResponse.json({ chemicals: enriched });
  } catch (err: any) {
    console.error('[SprayImport POST] Error:', err);
    return NextResponse.json(
      { error: err.message || 'Failed to parse spray diary' },
      { status: 500 }
    );
  }
}
