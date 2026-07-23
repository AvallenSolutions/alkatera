import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { rateLimit } from '@/lib/rate-limit'
import {
  studioLayout,
  studioParagraph,
  studioButton,
  escapeEmailHtml,
  STUDIO,
} from '@/lib/email/studio-layout'

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' })

const allowedOrigin = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com'

const corsHeaders = {
  'Access-Control-Allow-Origin': allowedOrigin,
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
}

export async function OPTIONS() {
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: NextRequest) {
  try {
    // Rate limiting
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
      || request.headers.get('x-real-ip')
      || 'unknown'

    const { success: withinLimit } = await rateLimit(`password-reset:${ip}`, 5, 15 * 60 * 1000)
    if (!withinLimit) {
      return NextResponse.json(
        { success: true }, // Don't reveal rate limiting to prevent enumeration
        { status: 200, headers: corsHeaders }
      )
    }

    const { email } = await request.json()

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400, headers: corsHeaders }
      )
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
    const resendApiKey = process.env.RESEND_API_KEY
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com'

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      console.error('Missing Supabase configuration')
      return NextResponse.json(
        { success: true }, // Don't reveal config issues
        { status: 200, headers: corsHeaders }
      )
    }

    if (!resendApiKey) {
      console.error('Missing RESEND_API_KEY')
      return NextResponse.json(
        { success: true }, // Don't reveal config issues
        { status: 200, headers: corsHeaders }
      )
    }

    // Use admin client to check if user exists and generate reset link
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
      global: { fetch: noStoreFetch },
    })

    // Generate password reset link using admin API
    // generateLink will fail if the email doesn't exist; we handle both cases
    // identically to prevent email enumeration
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${siteUrl}/update-password`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      // User doesn't exist or link generation failed - return success to prevent enumeration
      if (linkError) console.error('Error generating reset link:', linkError.message)
      return NextResponse.json(
        { success: true },
        { status: 200, headers: corsHeaders }
      )
    }

    // The action_link from Supabase contains the token hash
    const tokenHash = linkData.properties.hashed_token
    const resetLink = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/update-password`

    // Get user's first name from the generated link data
    const firstName = linkData.user?.user_metadata?.first_name || 'there'

    // Send branded email via Resend
    const emailHtml = buildPasswordResetEmail(firstName, resetLink, siteUrl)

    const resendResponse = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'alkatera <sayhello@mail.alkatera.com>',
        to: email,
        subject: 'Reset Your Password - alkatera',
        html: emailHtml,
      }),
    })

    if (!resendResponse.ok) {
      const error = await resendResponse.text()
      console.error('Resend API error:', error)
      // Still return success to not reveal issues
    } else {
    }

    return NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    )
  } catch (error: any) {
    console.error('Password reset error:', error)
    // Always return success to prevent information leakage
    return NextResponse.json(
      { success: true },
      { status: 200, headers: corsHeaders }
    )
  }
}

function buildPasswordResetEmail(firstName: string, resetLink: string, siteUrl: string): string {
  return studioLayout({
    eyebrow: 'Password reset',
    content: [
      studioParagraph(`Hi ${escapeEmailHtml(firstName)},`),
      studioParagraph(
        'We received a request to reset the password for your alka<strong>tera</strong> account. Click the button below to choose a new password:',
      ),
      studioButton(resetLink, 'Reset password'),
      studioParagraph('This link will expire in 24 hours for security reasons.'),
      studioParagraph(
        "If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.",
      ),
      `<p style="color:${STUDIO.dim};font-size:12px;line-height:1.6;margin:24px 0 8px 0;">If the button doesn't work, copy and paste this link into your browser:</p>`,
      `<div style="padding:12px 16px;background:${STUDIO.raisedPaper};border:1px solid ${STUDIO.hairline};color:${STUDIO.dim};font-size:12px;line-height:1.6;word-break:break-all;">${resetLink}</div>`,
    ].join(''),
    footerNote: `This email was sent because a password reset was requested for this email address. If you did not make this request, please ignore it. <a href="${siteUrl}" style="color:${STUDIO.forest};text-decoration:none;">www.alkatera.com</a>`,
  })
}
