/**
 * AI-proposed ingredient quantities for an imported recipe.
 *
 * POST /api/hospitality/recipes/propose-quantities  body: { recipe_id: number }
 *   → { ingredients: [{ material_name, quantity, unit }] }
 *
 * Given a recipe's name, cover count and ingredient names (which the menu import
 * captured but without amounts), suggest a typical quantity per ingredient for
 * the whole recipe. These are estimates the user reviews and confirms in the
 * bulk quantity grid — nothing is written here. Returns 503 when GEMINI_API_KEY
 * is unset so the UI degrades gracefully.
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
  const db = client as any

  const apiKey = process.env.GEMINI_API_KEY?.trim()
  if (!apiKey) {
    return NextResponse.json({ error: 'AI suggestions are not configured (GEMINI_API_KEY).' }, { status: 503 })
  }

  let body: any
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const productId = Number(body?.recipe_id)
  if (!Number.isFinite(productId)) return NextResponse.json({ error: 'recipe_id is required' }, { status: 400 })

  // Load the recipe (org-scoped) and its ingredient names.
  const { data: product } = await db
    .from('products')
    .select('id, name, product_kind')
    .eq('id', productId)
    .eq('organization_id', organizationId)
    .maybeSingle()
  if (!product) return NextResponse.json({ error: 'Recipe not found' }, { status: 404 })

  const { data: meta } = await db
    .from('hospitality_meal_meta')
    .select('covers')
    .eq('product_id', productId)
    .maybeSingle()
  const covers = Number(meta?.covers ?? 1) || 1

  const { data: mats } = await db
    .from('product_materials')
    .select('material_name')
    .eq('product_id', productId)
    .eq('material_type', 'ingredient')
    .order('id', { ascending: true })
  const names = (mats ?? []).map((m: any) => String(m.material_name ?? '').trim()).filter(Boolean)
  if (names.length === 0) return NextResponse.json({ ingredients: [] })

  const isDrink = product.product_kind === 'hospitality_drink'
  const portionWord = isDrink ? 'serves' : 'covers'
  const prompt = [
    `Estimate a typical quantity of each ingredient for the recipe "${product.name}", which makes ${covers} ${portionWord} in total (not per portion).`,
    'Return ONLY JSON of the form {"ingredients":[{"material_name":string,"quantity":number,"unit":string}]}.',
    'Rules:',
    '- Use exactly the ingredient names given below, unchanged, one entry each.',
    '- quantity: a realistic positive number for the WHOLE recipe at the stated number of ' + portionWord + '.',
    '- unit: one of g, kg, ml, l, unit. Use ml/l for liquids, g/kg for solids, "unit" for countable items like eggs.',
    '- These are rough estimates for a chef to review; be sensible, not precise.',
    '',
    'Ingredients:',
    ...names.map((n: string) => `- ${n}`),
  ].join('\n')

  const parsed = await runJsonPrompt<{ ingredients?: Array<{ material_name?: unknown; quantity?: unknown; unit?: unknown }> }>(
    { apiKey, prompt, op: 'hospitality-propose-quantities' },
  )

  const ingredients = (parsed?.ingredients ?? [])
    .map((r) => {
      const material_name = String(r?.material_name ?? '').trim()
      const quantity = Number(r?.quantity)
      let unit = String(r?.unit ?? '').trim().toLowerCase()
      if (!ALLOWED_UNITS.has(unit)) unit = isDrink ? 'ml' : 'g'
      return { material_name, quantity, unit }
    })
    .filter((r) => r.material_name.length > 0 && Number.isFinite(r.quantity) && r.quantity > 0)

  return NextResponse.json({ ingredients })
}
