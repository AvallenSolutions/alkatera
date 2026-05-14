import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
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

  // Refresh session if expired - required for Server Components
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Distributor portal: bounce unauthenticated users to the distributor
  // login page. The (distributor)/layout.tsx still does a robust check
  // including a distributor_members lookup — this middleware bounce is just
  // the fast path so unauth users never hit a server component first.
  const path = request.nextUrl.pathname
  const isDistributorAuthPage = /^\/distributor\/(login|signup|password-reset|update-password)(\/|$)/.test(path)
  if (path.startsWith('/distributor') && !isDistributorAuthPage && !user) {
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
