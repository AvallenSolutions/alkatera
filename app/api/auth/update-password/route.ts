import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  try {
    const formData = await request.formData()
    const password = formData.get('password') as string

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required' },
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const supabase = createClient()

    const { error } = await supabase.auth.updateUser({
      password,
    })

    if (error) {
      console.error('[Auth Update Password] Error:', error)
      return NextResponse.json(
        { error: error.message },
        {
          status: 400,
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
    console.error('[Auth Update Password] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
