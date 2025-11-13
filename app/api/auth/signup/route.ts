import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string
    const fullName = formData.get('fullName') as string

    if (!email || !password || !fullName) {
      return NextResponse.json(
        { error: 'All fields are required' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient()
    const isTestAccount = email.toLowerCase() === 'test@test.com'

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
      },
    })

    if (error) {
      console.error('[Auth Signup] Error:', error)
      return NextResponse.json(
        { error: error.message },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (isTestAccount && data.user) {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError) {
        console.error('[Auth Signup] Test account sign-in error:', signInError)
        return NextResponse.json(
          { error: signInError.message },
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' }
          }
        )
      }

      revalidatePath('/', 'layout')
      return NextResponse.json(
        { success: true },
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    if (data.user && !data.session) {
      return NextResponse.json(
        {
          success: true,
          requiresConfirmation: true,
          message: 'Please check your email to confirm your account before signing in.'
        },
        { headers: { 'Content-Type': 'application/json' } }
      )
    }

    revalidatePath('/', 'layout')
    return NextResponse.json(
      { success: true },
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Auth Signup] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
