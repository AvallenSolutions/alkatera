import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'

/**
 * POST /api/knowledge-bank/signed-url
 *
 * Generates a signed download URL for a knowledge bank file.
 * Uses the service role so it works for global items where the
 * file is stored under an org-specific path the user may not
 * have direct storage access to.
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    const token = authHeader?.replace('Bearer ', '')

    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Verify user is authenticated using their token
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

    const userClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    })

    const { data: userData, error: authError } = await userClient.auth.getUser()
    if (authError || !userData?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { file_url, file_name, item_id } = body

    if (!file_url || !item_id) {
      return NextResponse.json({ error: 'file_url and item_id are required' }, { status: 400 })
    }

    // Verify the user can access this item (RLS will enforce this)
    const { data: item, error: itemError } = await userClient
      .from('knowledge_bank_items')
      .select('id')
      .eq('id', item_id)
      .maybeSingle()

    if (itemError || !item) {
      return NextResponse.json({ error: 'Item not found or access denied' }, { status: 403 })
    }

    // Use service role to generate signed URL (bypasses storage path restrictions)
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
    const serviceClient = createClient(supabaseUrl, serviceKey)

    // Extract storage path from file_url
    let storagePath = file_url
    const bucketPrefix = '/storage/v1/object/public/knowledge-bank-files/'
    if (storagePath.includes(bucketPrefix)) {
      storagePath = storagePath.split(bucketPrefix).pop() || storagePath
    }

    const { data, error } = await serviceClient.storage
      .from('knowledge-bank-files')
      .createSignedUrl(storagePath, 3600, {
        download: file_name || true,
      })

    if (error || !data?.signedUrl) {
      console.error('Error generating signed URL:', error)
      return NextResponse.json(
        { error: 'Failed to generate download URL' },
        { status: 500 }
      )
    }

    return NextResponse.json({ signedUrl: data.signedUrl })
  } catch (error: any) {
    console.error('Error in knowledge-bank signed-url:', error)
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    )
  }
}
