/**
 * Deleting a product, safely, from anywhere.
 *
 * There were two deletes: the hub's, which checks multipack membership and
 * clears materials and footprints first, and the list's, which called
 * `.delete()` on `products` straight off. The second is the dangerous one.
 * `multipack_components.component_product_id` is ON DELETE CASCADE, so
 * deleting a component product silently removes it from every multipack that
 * contains it and leaves those multipacks quietly wrong; and deleting the
 * product row without its materials and footprints leaves them orphaned.
 *
 * One helper now, used by both, so the guard cannot be forgotten again.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

/** Thrown when a product cannot be deleted because a multipack still uses it. */
export class ProductInUseError extends Error {
  readonly multipackNames: string[]

  constructor(multipackNames: string[]) {
    const count = multipackNames.length
    const list = multipackNames.length > 0 ? `: ${multipackNames.join(', ')}` : ''
    super(
      `This product is part of ${count} multipack${count === 1 ? '' : 's'}${list}. Remove it from ${
        count === 1 ? 'that multipack' : 'those multipacks'
      } before deleting it.`,
    )
    this.name = 'ProductInUseError'
    this.multipackNames = multipackNames
  }
}

/**
 * Deletes a product and the rows that belong to it.
 *
 * Throws `ProductInUseError` when a multipack still contains the product, so
 * the caller can show the message as-is. Any other failure throws the
 * underlying Supabase error.
 */
export async function deleteProduct(
  supabase: SupabaseClient<any, any, any>,
  productId: string | number,
): Promise<void> {
  const { data: memberships, error: membershipError } = await supabase
    .from('multipack_components')
    .select('multipack:products!multipack_product_id(name)')
    .eq('component_product_id', productId)

  if (membershipError) throw membershipError

  if (memberships && memberships.length > 0) {
    const names = (memberships as any[])
      .map((m) => m.multipack?.name)
      .filter((n): n is string => Boolean(n))
    throw new ProductInUseError(names)
  }

  await supabase.from('product_materials').delete().eq('product_id', productId)
  await supabase.from('product_carbon_footprints').delete().eq('product_id', productId)

  const { error } = await supabase.from('products').delete().eq('id', productId)
  if (error) throw error
}
