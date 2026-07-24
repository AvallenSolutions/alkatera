/**
 * What a product is made from and packed in, as plain facts.
 *
 * The composition model says a product is one liquid, at a fill volume, in one
 * pack format. `CompositionStrip` knows all of this already, but it knows it in
 * order to let someone change it: pickers, confirm dialogs, switch calls. The
 * hub only wants to say what is true and how far it reaches, so this is the
 * read on its own, shared so the two surfaces cannot drift apart.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { COMPOSABLE_PRODUCT_KIND } from './composable-kind'

export interface CompositionFact {
  id: string
  name: string
  /** How many rows the shared record carries (ingredients, or pack components). */
  rowCount: number
  /** Other products on the same record. Excludes the product asked about. */
  sharedWith: { id: number; name: string }[]
}

export interface CompositionFacts {
  liquid: CompositionFact | null
  pack: CompositionFact | null
}

const KINDS = {
  liquid: { table: 'liquids', linkColumn: 'liquid_id', materialType: 'ingredient' },
  pack: { table: 'pack_formats', linkColumn: 'pack_format_id', materialType: 'packaging' },
} as const

async function factFor(
  supabase: SupabaseClient<any, any, any>,
  kind: keyof typeof KINDS,
  recordId: string | null,
  productId: string | number,
): Promise<CompositionFact | null> {
  if (!recordId) return null
  const K = KINDS[kind]

  const [{ data: record }, { data: siblings }, { count: rowCount }] = await Promise.all([
    supabase.from(K.table).select('id, name').eq('id', recordId).maybeSingle(),
    supabase
      .from('products')
      .select('id, name')
      .eq(K.linkColumn, recordId)
      .eq('product_kind', COMPOSABLE_PRODUCT_KIND)
      .is('archived_at', null),
    supabase
      .from('product_materials')
      .select('id', { count: 'exact', head: true })
      .eq('product_id', productId)
      .eq('material_type', K.materialType),
  ])

  if (!record) return null

  return {
    id: String(record.id),
    name: record.name,
    rowCount: rowCount ?? 0,
    sharedWith: ((siblings as any[]) ?? []).filter((s) => String(s.id) !== String(productId)),
  }
}

/** Both halves of a product's composition, or nulls where it has none yet. */
export async function getCompositionFacts(
  supabase: SupabaseClient<any, any, any>,
  productId: string | number,
  liquidId: string | null,
  packFormatId: string | null,
): Promise<CompositionFacts> {
  const [liquid, pack] = await Promise.all([
    factFor(supabase, 'liquid', liquidId, productId),
    factFor(supabase, 'pack', packFormatId, productId),
  ])
  return { liquid, pack }
}
