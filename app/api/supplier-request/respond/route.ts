import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

function getServiceClient() {
  return createClient(supabaseUrl, supabaseServiceKey)
}

async function authenticateUser() {
  const cookieStore = cookies()
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

  const authClient = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value
      },
      set(name: string, value: string, options: CookieOptions) {
        try { cookieStore.set({ name, value, ...options }) } catch {}
      },
      remove(name: string, options: CookieOptions) {
        try { cookieStore.set({ name, value: '', ...options }) } catch {}
      },
    },
  })

  const { data: { user }, error } = await authClient.auth.getUser()
  if (error || !user) return null
  return user
}

export async function POST(request: NextRequest) {
  try {
    const user = await authenticateUser()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorised' }, { status: 401 })
    }

    const body = await request.json()
    const { invitationId, action, declineReason } = body

    if (!invitationId || !action) {
      return NextResponse.json(
        { error: 'invitationId and action are required' },
        { status: 400 }
      )
    }

    if (!['accepted', 'declined'].includes(action)) {
      return NextResponse.json(
        { error: 'action must be "accepted" or "declined"' },
        { status: 400 }
      )
    }

    const admin = getServiceClient()

    // Verify the invitation belongs to this user's supplier record
    const { data: supplier } = await admin
      .from('suppliers')
      .select('id')
      .eq('user_id', user.id)
      .limit(1)
      .maybeSingle()

    if (!supplier) {
      return NextResponse.json({ error: 'Supplier not found' }, { status: 404 })
    }

    // Fetch the invitation and verify ownership
    const { data: invitation } = await admin
      .from('supplier_invitations')
      .select('id, supplier_id, supplier_email, status, request_status')
      .eq('id', invitationId)
      .single()

    if (!invitation) {
      return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
    }

    // Check ownership: either linked supplier_id or email match
    const isOwner =
      invitation.supplier_id === supplier.id ||
      invitation.supplier_email?.toLowerCase() === user.email?.toLowerCase()

    if (!isOwner) {
      return NextResponse.json({ error: 'Not authorised for this request' }, { status: 403 })
    }

    // Only allow responding to pending requests
    if (invitation.request_status !== 'pending') {
      return NextResponse.json(
        { error: `Request has already been ${invitation.request_status}` },
        { status: 409 }
      )
    }

    // Update the request status
    const updateData: Record<string, any> = {
      request_status: action,
      request_responded_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }

    if (action === 'declined' && declineReason) {
      updateData.request_decline_reason = declineReason.trim().slice(0, 500)
    }

    const { error: updateError } = await admin
      .from('supplier_invitations')
      .update(updateData)
      .eq('id', invitationId)

    if (updateError) {
      console.error('Error updating request status:', updateError)
      return NextResponse.json({ error: 'Failed to update request' }, { status: 500 })
    }

    return NextResponse.json({ success: true, request_status: action })
  } catch (err) {
    console.error('Error in supplier-request/respond:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
