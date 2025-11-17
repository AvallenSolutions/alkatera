import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createMiddlewareSupabaseClient } from '@/lib/supabase/middleware-client'

const publicRoutes = ['/login', '/signup', '/password-reset', '/update-password']
const onboardingRoutes = ['/create-organization']

export async function middleware(request: NextRequest) {
  const response = NextResponse.next()

  console.log('🔍 Middleware: Processing request:', request.nextUrl.pathname)

  const supabase = createMiddlewareSupabaseClient(request, response)

  let session = null

  try {
    const {
      data: { session: currentSession },
      error,
    } = await supabase.auth.getSession()

    if (error) {
      console.error('❌ Middleware: Error getting session:', error.message)
    } else if (currentSession) {
      session = currentSession
      console.log('✅ Middleware: Session found for user:', currentSession.user.id)
    } else {
      console.log('🔒 Middleware: No session found')
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
    console.log('🚫 Middleware: No session, redirecting to login from:', request.nextUrl.pathname)
    const redirectUrl = new URL('/login', request.url)
    redirectUrl.searchParams.set('redirectedFrom', request.nextUrl.pathname)
    return NextResponse.redirect(redirectUrl)
  }

  if (session && isPublicRoute) {
    console.log('🔄 Middleware: Authenticated user on public route, redirecting to dashboard')
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  if (session && !isPublicRoute && !isOnboardingRoute) {
    try {
      console.log('🔎 Middleware: Checking organization membership for user:', session.user.id)

      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('id, organization_id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (error) {
        console.error('❌ Middleware: Error checking memberships:', error.message, error)
      } else if (!memberships || memberships.length === 0) {
        console.log('⚠️ Middleware: No organization membership found, redirecting to create organization')
        if (request.nextUrl.pathname !== '/create-organization') {
          return NextResponse.redirect(new URL('/create-organization', request.url))
        }
      } else {
        console.log('✅ Middleware: User has organization membership:', memberships[0].organization_id)
      }
    } catch (error) {
      console.error('❌ Middleware: Fatal error checking memberships:', error)
    }
  }

  if (session && isOnboardingRoute) {
    try {
      console.log('🎓 Middleware: User on onboarding route, checking if already has organization')

      const { data: memberships, error } = await supabase
        .from('organization_members')
        .select('id')
        .eq('user_id', session.user.id)
        .limit(1)

      if (error) {
        console.error('❌ Middleware: Error checking memberships:', error.message)
      } else if (memberships && memberships.length > 0) {
        console.log('✅ Middleware: User already has organization, redirecting to dashboard')
        return NextResponse.redirect(new URL('/dashboard', request.url))
      } else {
        console.log('🏭 Middleware: User needs to create organization')
      }
    } catch (error) {
      console.error('❌ Middleware: Fatal error checking memberships:', error)
    }
  }

  console.log('✅ Middleware: Allowing request to proceed to:', request.nextUrl.pathname)
  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
