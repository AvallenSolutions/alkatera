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

  const path = request.nextUrl.pathname

  // Demo / procurement-only dev port (e.g. 8890): anything that isn't
  // the procurement portal redirects to it. This stops the marketing
  // site, main app /login, dashboard etc. from being reachable on the
  // dev server we hand to Foodbuy. Production uses path-prefix routing
  // on the main domain; this guard is dev-only.
  const host = request.headers.get('host') || ''
  const procurementOnlyHost = host.endsWith(':8890') || host.includes('procurement.localhost')
  if (
    procurementOnlyHost &&
    !path.startsWith('/procurement') &&
    !path.startsWith('/foodbuy/') &&
    !path.startsWith('/api/procurement') &&
    !path.startsWith('/_next') &&
    !path.startsWith('/favicon') &&
    !path.startsWith('/icon')
  ) {
    return NextResponse.redirect(new URL('/procurement/foodbuy/login', request.url))
  }

  // Distributor portal: bounce unauthenticated users to the distributor
  // login page. The (distributor)/layout.tsx still does a robust check
  // including a distributor_members lookup — this middleware bounce is just
  // the fast path so unauth users never hit a server component first.
  const isDistributorAuthPage = /^\/distributor\/(login|signup|password-reset|update-password)(\/|$)/.test(path)
  if (path.startsWith('/distributor') && !isDistributorAuthPage && !user) {
    const redirectUrl = new URL('/distributor/login', request.url)
    return NextResponse.redirect(redirectUrl)
  }

  // Procurement portal: same fast-path bounce, slug-scoped login.
  // The (portal)/layout.tsx does the procurement_members lookup. The
  // x-procurement-slug header lets server components read the slug
  // without re-parsing the path on every request.
  const procurementMatch = path.match(/^\/procurement\/([^\/]+)(\/|$)/)
  if (procurementMatch) {
    const slug = procurementMatch[1]
    const isProcurementAuthPage = /^\/procurement\/[^\/]+\/(login|password-reset|update-password|accept-invite)(\/|$)/.test(path)
    if (!isProcurementAuthPage && !user) {
      const redirectUrl = new URL(`/procurement/${slug}/login`, request.url)
      return NextResponse.redirect(redirectUrl)
    }
    response.headers.set('x-procurement-slug', slug)
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
