import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    })

    // Check if user exists (don't reveal this to the client)
    const { data: userData, error: userError } = await adminClient.auth.admin.listUsers()

    const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())

    if (!user) {
      // User doesn't exist, but we return success to prevent email enumeration
      return NextResponse.json(
        { success: true },
        { status: 200, headers: corsHeaders }
      )
    }

    // Generate password reset link using admin API
    const { data: linkData, error: linkError } = await adminClient.auth.admin.generateLink({
      type: 'recovery',
      email: email,
      options: {
        redirectTo: `${siteUrl}/update-password`,
      },
    })

    if (linkError || !linkData?.properties?.action_link) {
      console.error('Error generating reset link:', linkError)
      return NextResponse.json(
        { success: true }, // Don't reveal errors
        { status: 200, headers: corsHeaders }
      )
    }

    // The action_link from Supabase contains the token hash
    // Format: https://xxx.supabase.co/auth/v1/verify?token=xxx&type=recovery&redirect_to=xxx
    // We need to extract the token and build a link to our callback
    const actionLink = new URL(linkData.properties.action_link)
    const token = actionLink.searchParams.get('token')
    const tokenHash = linkData.properties.hashed_token

    // Build reset link that goes through our auth callback
    // Use the token_hash for PKCE flow
    const resetLink = `${siteUrl}/auth/confirm?token_hash=${tokenHash}&type=recovery&next=/update-password`

    // Get user's first name if available
    const firstName = user.user_metadata?.first_name || 'there'

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
  const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png'

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Reset Your Password</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #333; background-color: #f5f5f5;">
      <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f5f5f5; padding: 40px 20px;">
        <tr>
          <td align="center">
            <table width="600" cellpadding="0" cellspacing="0" style="max-width: 600px; width: 100%;">
              <!-- Header -->
              <tr>
                <td style="background: linear-gradient(135deg, #0a0a0a 0%, #1a1a1a 100%); padding: 30px 40px; border-radius: 12px 12px 0 0; text-align: center;">
                  <img src="${logoUrl}" alt="alkatera" width="180" height="auto" style="display: block; margin: 0 auto 12px auto;" />
                  <p style="margin: 0; color: #888; font-size: 12px; text-transform: uppercase; letter-spacing: 2px;">Sustainability, Distilled</p>
                </td>
              </tr>

              <!-- Content -->
              <tr>
                <td style="background-color: #ffffff; padding: 40px; border-left: 1px solid #e5e5e5; border-right: 1px solid #e5e5e5;">
                  <h2 style="margin: 0 0 20px 0; color: #1a1a1a; font-size: 24px; font-weight: 600;">Reset Your Password</h2>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">Hi ${escapeHtml(firstName)},</p>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">We received a request to reset the password for your alka<strong>tera</strong> account. Click the button below to choose a new password:</p>

                  <!-- Button -->
                  <table width="100%" cellpadding="0" cellspacing="0" style="margin: 30px 0;">
                    <tr>
                      <td align="center">
                        <a href="${resetLink}" style="display: inline-block; background-color: #ccff00; color: #0a0a0a; padding: 14px 32px; font-size: 16px; font-weight: 600; text-decoration: none; border-radius: 8px; text-transform: uppercase; letter-spacing: 0.5px;">Reset Password</a>
                      </td>
                    </tr>
                  </table>

                  <p style="margin: 0 0 20px 0; color: #4a4a4a; font-size: 16px;">This link will expire in 24 hours for security reasons.</p>

                  <p style="margin: 0 0 10px 0; color: #4a4a4a; font-size: 16px;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>

                  <!-- Divider -->
                  <hr style="border: none; border-top: 1px solid #e5e5e5; margin: 30px 0;">

                  <p style="margin: 0; color: #888; font-size: 14px;">If the button doesn't work, copy and paste this link into your browser:</p>
                  <p style="margin: 10px 0 0 0; color: #666; font-size: 12px; word-break: break-all; background-color: #f5f5f5; padding: 12px; border-radius: 6px;">${resetLink}</p>
                </td>
              </tr>

              <!-- Footer -->
              <tr>
                <td style="background-color: #1a1a1a; padding: 30px 40px; border-radius: 0 0 12px 12px; text-align: center;">
                  <p style="margin: 0 0 10px 0; color: #888; font-size: 14px;">alka<strong style="color: #888;">tera</strong> - Sustainability Platform</p>
                  <p style="margin: 0; color: #666; font-size: 12px;">
                    <a href="${siteUrl}" style="color: #ccff00; text-decoration: none;">www.alkatera.com</a>
                  </p>
                  <p style="margin: 15px 0 0 0; color: #555; font-size: 11px;">
                    This email was sent because a password reset was requested for this email address.<br>
                    If you did not make this request, please ignore this email.
                  </p>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    </body>
    </html>
  `
}

function escapeHtml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;')
}
