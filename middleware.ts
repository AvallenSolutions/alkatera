import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // The ONLY decision this middleware makes is bouncing unauthenticated users
  // away from the distributor portal. For every other route we previously called
  // supabase.auth.getUser() — a network round-trip to Supabase Auth on the
  // critical path of EVERY navigation — and then discarded the result. The
  // authenticated app is fully client-rendered and the @supabase/ssr browser
  // client refreshes the session into the same cookies the server reads, so no
  // middleware-side token refresh is needed. Skip all of it for non-distributor
  // paths so the rest of the app (Rosa, dashboard, products…) pays zero auth
  // latency at the edge.
  if (!path.startsWith('/distributor')) {
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    })
  }

  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return request.cookies.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value,
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value,
            ...options,
          })
        },
        remove(name: string, options: CookieOptions) {
          request.cookies.set({
            name,
            value: '',
            ...options,
          })
          response = NextResponse.next({
            request: {
              headers: request.headers,
            },
          })
          response.cookies.set({
            name,
            value: '',
            ...options,
          })
        },
      },
    }
  )

  // Refresh the session and read the user — only needed for the distributor
  // gate below (the (distributor)/layout.tsx still does the robust check
  // including a distributor_members lookup; this is just the fast bounce).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const isDistributorAuthPage = /^\/distributor\/(login|signup|password-reset|update-password)(\/|$)/.test(path)
  if (!isDistributorAuthPage && !user) {
    const redirectUrl = new URL('/distributor/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public files (public folder)
     * - api/stripe/webhooks (Stripe webhook endpoint)
     */
    // API routes are excluded (api/) because they use their own auth via Bearer tokens
    // and getSupabaseAPIClient(), not cookie-based session middleware.
    '/((?!_next/static|_next/image|favicon.ico|api/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|txt)$).*)',
  ],
}
