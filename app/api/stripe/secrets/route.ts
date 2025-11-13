import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: Request) {
  try {
    const supabase = createClient()

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError) {
      console.error('[Stripe API] Authentication error:', authError)
      return NextResponse.json(
        { error: 'Authentication failed' },
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    const stripeSecretKey = process.env.STRIPE_SECRET_KEY

    if (!stripeSecretKey) {
      console.error('[Stripe API] Missing STRIPE_SECRET_KEY environment variable')
      return NextResponse.json(
        { error: 'Stripe is not configured. Please contact support.' },
        {
          status: 503,
          headers: { 'Content-Type': 'application/json' }
        }
      )
    }

    return NextResponse.json(
      {
        message: 'Stripe API endpoint is ready',
        configured: true
      },
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  } catch (error) {
    console.error('[Stripe API] Unexpected error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Unknown error'

    return NextResponse.json(
      {
        error: 'An internal error occurred',
        message: 'Please try again later or contact support if the problem persists.'
      },
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }
}
