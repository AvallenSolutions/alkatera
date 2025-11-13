import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createServerClient, type CookieOptions } from '@supabase/ssr'

const publicRoutes = ['/login', '/signup', '/password-reset', '/update-password']
const onboardingRoutes = ['/create-organization']

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

  const {
    data: { session },
  } = await supabase.auth.getSession()

  const isPublicRoute = publicRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  const isOnboardingRoute = onboardingRoutes.some((route) =>
    request.nextUrl.pathname.startsWith(route)
  )

  if (!session && !isPublicRoute && request.nextUrl.pathname !== '/') {
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isPublicRoute) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (session && !isPublicRoute && !isOnboardingRoute) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)

    if (!memberships || memberships.length === 0) {
      if (request.nextUrl.pathname !== '/create-organization') {
        return NextResponse.redirect(new URL('/create-organization', request.url))
      }
    }
  }

  if (session && isOnboardingRoute) {
    const { data: memberships } = await supabase
      .from('organization_members')
      .select('id')
      .eq('user_id', session.user.id)
      .limit(1)

    if (memberships && memberships.length > 0) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
