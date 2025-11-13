import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
      return NextResponse.json(
        { error: 'Email and password are required' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient()

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    if (error) {
      console.error('[Auth Login] Error:', error)
      return NextResponse.json(
        { error: error.message },
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
  } catch (error) {
    console.error('[Auth Login] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
