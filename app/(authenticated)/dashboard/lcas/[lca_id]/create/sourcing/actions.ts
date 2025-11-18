'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { getSupabaseServerClient } from '@/lib/supabase/server-client'

export async function updateSourcingMethodology(lcaId: string, formData: FormData) {
  const supabase = getSupabaseServerClient()

  const { data: { user }, error: authError } = await supabase.auth.getUser()

  if (authError || !user) {
    throw new Error('User not authenticated')
  }

  const methodology = formData.get('methodology') as string

  if (!methodology || (methodology !== 'grown' && methodology !== 'purchased')) {
    throw new Error('Invalid sourcing methodology')
  }

  const { data: lca, error: lcaFetchError } = await supabase
    .from('product_lcas')
    .select('organization_id')
    .eq('id', lcaId)
    .maybeSingle()

  if (lcaFetchError) {
    throw new Error(`Failed to fetch LCA: ${lcaFetchError.message}`)
  }

  if (!lca) {
    throw new Error('LCA not found')
  }

  const { data: membership } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('user_id', user.id)
    .eq('organization_id', lca.organization_id)
    .maybeSingle()

  if (!membership) {
    throw new Error('Not authorized to modify this LCA')
  }

  const methodologyValue = methodology.toUpperCase()

  const { error: updateError } = await supabase
    .from('product_lcas')
    .update({ sourcing_methodology: methodologyValue })
    .eq('id', lcaId)

  if (updateError) {
    throw new Error(`Failed to update sourcing methodology: ${updateError.message}`)
  }

  revalidatePath(`/dashboard/lcas/${lcaId}/create/sourcing`)
  redirect(`/dashboard/lcas/${lcaId}/ingredients`)
}
