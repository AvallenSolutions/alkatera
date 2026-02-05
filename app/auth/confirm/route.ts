import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'

export async function GET(request: NextRequest) {
  const requestUrl = new URL(request.url)
  const token_hash = requestUrl.searchParams.get('token_hash')
  const type = requestUrl.searchParams.get('type') as 'recovery' | 'email' | 'signup' | null
  const next = requestUrl.searchParams.get('next') || '/dashboard'

  if (token_hash && type) {
    const cookieStore = cookies()

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options: CookieOptions) {
            cookieStore.set({ name, value, ...options })
          },
          remove(name: string, options: CookieOptions) {
            cookieStore.delete({ name, ...options })
          },
        },
      }
    )

    // Verify the OTP token
    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    })

    if (!error) {
      // Successfully verified, redirect to the next page
      // For password recovery, this should be /update-password
      return NextResponse.redirect(new URL(next, requestUrl.origin))
    } else {
      console.error('OTP verification error:', error)
    }
  }

  // Return to login on error
  return NextResponse.redirect(new URL('/login?error=invalid_token', requestUrl.origin))
}
