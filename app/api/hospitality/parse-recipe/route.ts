/**
 * AI recipe parsing — paste a recipe / ingredient list, get structured
 * ingredients to pre-fill the recipe builder.
 *
 * POST /api/hospitality/parse-recipe  body: { text: string }
 *   → { ingredients: [{ material_name, quantity, unit }] }
 *
 * Uses Gemini Flash via the shared helper. Returns 503 (not 500) when
 * GEMINI_API_KEY isn't configured, so the UI can degrade gracefully.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAPIClient } from '@/lib/supabase/api-client'
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access'
import { runJsonPrompt } from '@/lib/ai/gemini'

export const runtime = 'nodejs'

const ALLOWED_UNITS = new Set(['g', 'kg', 'ml', 'l', 'unit'])

export async function POST(request: NextRequest) {
  const { client, user, error: authError } = await getSupabaseAPIClient()
  if (authError || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const organizationId = await resolveAccessibleOrg(client as any, user)
  if (!organizationId) return NextResponse.json({ error: 'No organisation' }, { status: 403 })

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'AI parsing is not configured (GEMINI_API_KEY).' }, { status: 503 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const text = String(body?.text ?? '').trim()
  if (!text) return NextResponse.json({ error: 'text is required' }, { status: 400 })
  if (text.length > 8000) return NextResponse.json({ error: 'text is too long' }, { status: 400 })

  const prompt = [
    'Extract the food/drink ingredients from the recipe text below.',
    'Return ONLY JSON of the form {"ingredients":[{"material_name":string,"quantity":number,"unit":string}]}.',
    'Rules:',
    '- material_name: the plain ingredient name (e.g. "Beef mince", "Olive oil", "Onion"). No quantities in the name.',
    '- quantity: a positive number.',
    '- unit: one of g, kg, ml, l, unit. Convert common cooking measures (1 tbsp ≈ 15 ml, 1 tsp ≈ 5 ml, 1 cup ≈ 240 ml). Use "unit" for countable items like eggs.',
    '- Ignore steps, headings and seasoning "to taste".',
    '',
    'Recipe text:',
    text,
  ].join('\n')

  const parsed = await runJsonPrompt<{ ingredients?: Array<{ material_name?: unknown; quantity?: unknown; unit?: unknown }> }>(
    { apiKey, prompt, op: 'hospitality-recipe-parse' },
  )

  const ingredients = (parsed?.ingredients ?? [])
    .map((r) => {
      const material_name = String(r?.material_name ?? '').trim()
      const quantity = Number(r?.quantity)
      let unit = String(r?.unit ?? '').trim().toLowerCase()
      if (!ALLOWED_UNITS.has(unit)) unit = 'g'
      return { material_name, quantity, unit }
    })
    .filter((r) => r.material_name.length > 0 && Number.isFinite(r.quantity) && r.quantity > 0)

  return NextResponse.json({ ingredients })
}
