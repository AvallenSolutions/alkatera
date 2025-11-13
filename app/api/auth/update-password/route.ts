import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const formData = await request.formData()
  const password = formData.get('password') as string

  if (!password) {
    return NextResponse.json(
      { error: 'Password is required' },
      { status: 400 }
    )
  }

  const supabase = createClient()

  const { error } = await supabase.auth.updateUser({
    password,
  })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 })
  }

  revalidatePath('/', 'layout')
  return NextResponse.json({ success: true })
}
