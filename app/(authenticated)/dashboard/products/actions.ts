'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'

export async function createDraftLca(productId: string) {
  const supabase = getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('User not authenticated')
  }

  const { data: product, error: productError } = await supabase
    .from('products')
    .select('name, organization_id')
    .eq('id', productId)
    .maybeSingle()

  if (productError) {
    throw new Error(`Failed to fetch product: ${productError.message}`)
  }

  if (!product) {
    throw new Error('Product not found')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', product.organization_id)
    .maybeSingle()

  if (!membership) {
    throw new Error('Not authorized to create LCA for this product')
  }

  const { data: lca, error: lcaError } = await supabase
    .from('product_lcas')
    .insert({
      organization_id: product.organization_id,
      product_id: productId,
      product_name: product.name,
      functional_unit: '1 unit',
      system_boundary: 'Cradle to gate',
      status: 'draft',
    })
    .select('id')
    .single()

  if (lcaError) {
    throw new Error(`Failed to create LCA: ${lcaError.message}`)
  }

  revalidatePath('/dashboard/products')
  redirect(`/dashboard/lcas/${lca.id}/create/sourcing`)
}
