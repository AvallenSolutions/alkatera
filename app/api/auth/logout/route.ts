import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST() {
  try {
    const supabase = createClient()
    const { error } = await supabase.auth.signOut()

    if (error) {
      console.error('[Auth Logout] Error:', error)
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
    console.error('[Auth Logout] Unexpected error:', error)
    return NextResponse.json(
      { error: 'An internal error occurred. Please try again.' },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
