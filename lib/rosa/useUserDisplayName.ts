'use client'

import { useEffect, useState } from 'react'
import { useAuth } from '@/components/providers/AuthProvider'
import { supabase } from '@/lib/supabaseClient'

interface UserDisplayName {
  /** Full display name, e.g. "Tim Etherington-Judge". */
  fullName: string | null
  /** First name only, suitable for greetings. */
  firstName: string | null
  /** True while the profile lookup is in flight. */
  loading: boolean
}

/**
 * Resolves the authenticated user's display name with three fallbacks:
 *   1. profiles.full_name from the database
 *   2. user_metadata.full_name from Supabase auth
 *   3. The local-part of the email (e.g. "tim" from "tim@avallenspirits.com")
 *
 * Used for greetings on Rosa's hub page so the user sees "Hello, Tim"
 * rather than "Hello, alkatera Demo" (which is the org name).
 */
export function useUserDisplayName(): UserDisplayName {
  const { user } = useAuth()
  const [profileName, setProfileName] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user?.id) {
      setProfileName(null)
      setLoading(false)
      return
    }
    let cancelled = false
    const load = async () => {
      const { data } = await supabase
        .from('profiles')
        .select('full_name')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      const name = (data as any)?.full_name as string | null | undefined
      setProfileName(name && name.trim().length > 0 ? name.trim() : null)
      setLoading(false)
    }
    load().catch(() => {
      if (!cancelled) setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [user?.id])

  const metadataName = (user?.user_metadata?.full_name as string | undefined) || null
  const emailName = user?.email ? user.email.split('@')[0] : null
  const fullName = profileName || metadataName || (emailName ? capitaliseFirstLetter(emailName) : null)
  const firstName = fullName ? fullName.split(/\s+/)[0] || fullName : null

  return { fullName, firstName, loading }
}

function capitaliseFirstLetter(s: string): string {
  if (!s) return s
  return s.charAt(0).toUpperCase() + s.slice(1)
}
