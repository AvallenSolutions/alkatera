import { NextRequest, NextResponse } from 'next/server';
import { getSupabaseAPIClient } from '@/lib/supabase/api-client';

/**
 * POST /api/chemical-library
 *
 * Adds a user-submitted chemical to the consolidated library.
 * Sets is_verified = false and records the submitting user.
 * Returns 409 if a chemical with the same name already exists.
 */
export async function POST(request: NextRequest) {
  try {
    const { client: supabase, user, error: authError } = await getSupabaseAPIClient();

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 });
    }

    const body = await request.json();
    const {
      chemical_name,
      chemical_type,
      n_content_percent,
      fertiliser_subtype,
      active_ingredient,
      applicable_to,
    } = body as {
      chemical_name: string;
      chemical_type: string;
      n_content_percent: number;
      fertiliser_subtype: string | null;
      active_ingredient: string | null;
      applicable_to: string[];
    };

    if (!chemical_name?.trim()) {
      return NextResponse.json({ error: 'chemical_name is required' }, { status: 400 });
    }

    // Check for duplicates by name (case-insensitive)
    const { data: existing } = await supabase
      .from('chemical_library')
      .select('id, chemical_name')
      .ilike('chemical_name', chemical_name.trim())
      .limit(1)
      .maybeSingle();

    if (existing) {
      return NextResponse.json(
        { error: 'Already in library', existing },
        { status: 409 }
      );
    }

    const { data, error } = await supabase
      .from('chemical_library')
      .insert({
        chemical_name: chemical_name.trim(),
        name_variants: [],
        chemical_type: chemical_type || 'other',
        n_content_percent: n_content_percent ?? 0,
        fertiliser_subtype: fertiliser_subtype || null,
        active_ingredient: active_ingredient || null,
        is_verified: false,
        submitted_by: user.id,
        applicable_to: applicable_to || ['vineyard', 'arable', 'orchard'],
      })
      .select()
      .single();

    if (error) {
      console.error('[ChemicalLibrary POST] Insert error:', error);
      return NextResponse.json({ error: 'Failed to add chemical' }, { status: 500 });
    }

    return NextResponse.json({ success: true, data }, { status: 201 });
  } catch (err: any) {
    console.error('[ChemicalLibrary POST] Error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
