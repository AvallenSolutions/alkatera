import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * POST /api/onboarding/utility-bill/queue
 *
 * Stash a utility-bill file (already uploaded to the ingest-staging bucket
 * by the client) into ingest_jobs so the existing background extractor
 * picks it up. The onboarding upload dialog calls this after a successful
 * storage upload — keeps the user in the wizard while the bill is queued.
 */
export async function POST(request: NextRequest) {
  try {
    const cookieStore = cookies()
    const auth = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) { return cookieStore.get(name)?.value },
          set(name: string, value: string, options: CookieOptions) {
            try { cookieStore.set({ name, value, ...options }) } catch {}
          },
          remove(name: string, options: CookieOptions) {
            try { cookieStore.set({ name, value: '', ...options }) } catch {}
          },
        },
      },
    )
    const { data: { user }, error: authErr } = await auth.auth.getUser()
    if (authErr || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const { organizationId, stashPath, fileName, fileMime } = body as {
      organizationId?: string
      stashPath?: string
      fileName?: string
      fileMime?: string
    }
    if (!organizationId || !stashPath || !fileName) {
      return NextResponse.json({ error: 'organizationId, stashPath and fileName required' }, { status: 400 })
    }

    const service = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    )

    // Verify the user is a member of the org before queueing.
    const { data: membership } = await service
      .from('organization_members')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', user.id)
      .maybeSingle()
    if (!membership) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const { data: job, error: insErr } = await service
      .from('ingest_jobs')
      .insert({
        user_id: user.id,
        organization_id: organizationId,
        status: 'pending',
        phase_message: 'Queued from onboarding',
        stash_path: stashPath,
        file_name: fileName,
        file_mime: fileMime || null,
      })
      .select('id')
      .single()
    if (insErr || !job) {
      console.error('[onboarding/utility-bill/queue] insert failed:', insErr)
      return NextResponse.json({ error: insErr?.message || 'Queue failed' }, { status: 500 })
    }

    return NextResponse.json({ jobId: job.id }, { status: 202 })
  } catch (err) {
    console.error('[onboarding/utility-bill/queue] error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
