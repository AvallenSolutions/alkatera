import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { PORTAL_AUTH_COOKIE } from '@/lib/supabase/portal-cookie'

export async function middleware(request: NextRequest) {
  const path = request.nextUrl.pathname

  // Demo / procurement-only dev port (e.g. 8890): anything that isn't the
  // procurement portal redirects to it, so the dev server we hand to Foodbuy
  // can't reach the marketing site or main app. Dev-only — gated on the :8890
  // host, so it is inert in production (which uses path-prefix routing).
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

  // Perf: the only edge decisions are bouncing unauthenticated users away from
  // the distributor and procurement portals. For every other route we used to
  // call supabase.auth.getUser() — a network round-trip to Supabase Auth on the
  // critical path of EVERY navigation — and discard the result. The
  // authenticated app is client-rendered and the @supabase/ssr browser client
  // refreshes the session into the same cookies the server reads, so no
  // middleware-side refresh is needed. Skip it for non-portal paths so the rest
  // of the app (Rosa, dashboard, products…) pays zero auth latency at the edge.
  if (!path.startsWith('/distributor') && !path.startsWith('/procurement')) {
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

  // Portal paths (distributor / procurement) read the separate portal auth
  // cookie so the portal session is independent of the main app session.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookieOptions: { name: PORTAL_AUTH_COOKIE },
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

  // Refresh the session and read the user — only needed for the distributor /
  // procurement gates below (the portal layouts still do the robust member
  // lookups; this is just the fast bounce so unauth users never hit a server
  // component first).
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Distributor portal: bounce unauthenticated users to the distributor login.
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
