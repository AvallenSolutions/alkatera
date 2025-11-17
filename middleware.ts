import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middleware-client'

const publicRoutes = ['/login', '/signup', '/password-reset', '/update-password']
const onboardingRoutes = ['/create-organization']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  const supabase = createMiddlewareSupabaseClient(request, response)

  let session = null

  try {
    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Middleware: Error getting session:', error.message)
    } else {
      session = currentSession
    }
  } catch (error) {
    console.error('❌ Middleware: Fatal error getting session:', error)
  }

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
    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (error) {
        console.error('❌ Middleware: Error checking memberships:', error.message)
      } else if (!memberships || memberships.length === 0) {
        if (request.nextUrl.pathname !== '/create-organization') {
          return NextResponse.redirect(new URL('/create-organization', request.url))
        }
      }
    } catch (error) {
      console.error('❌ Middleware: Fatal error checking memberships:', error)
    }
  }

  if (session && isOnboardingRoute) {
    try {
      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (error) {
        console.error('❌ Middleware: Error checking memberships:', error.message)
      } else if (memberships && memberships.length > 0) {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }
    } catch (error) {
      console.error('❌ Middleware: Fatal error checking memberships:', error)
    }
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
