import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient()

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/update-password`,
    })

    if (error) {
      console.error('[Auth Password Reset] Error:', error)
      return NextResponse.json(
        { error: error.message },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Password reset instructions have been sent to your email.'
      },
      { headers: { 'Content-Type': 'application/json' } }
    )
  } catch (error) {
    console.error('[Auth Password Reset] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
