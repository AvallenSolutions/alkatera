import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/utils/escape-html';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface SendEsgSurveyRequest {
  supplierEmail: string;
  supplierName?: string;
  contactPersonName?: string;
  personalMessage?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * POST /api/send-esg-survey
 *
 * Sends the ESG self-assessment ("survey") directly to a supplier and
 * auto-creates the supplier record in the brand's org so it appears in their
 * supplier list immediately. The record is created without a user_id; when the
 * supplier signs up via the invitation link, accept_supplier_invitation adopts
 * this record (see migration 20262703000000_esg_survey_requests.sql).
 */
export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('Authorization');
    if (!authHeader) {
      return NextResponse.json({ error: 'Missing authorization header' }, { status: 401 });
    }

    const token = authHeader.replace('Bearer ', '');
    const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Verify the user
    const { data: { user }, error: authError } = await adminClient.auth.getUser(token);
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized - Invalid or expired token' },
        { status: 401 },
      );
    }

    const body: SendEsgSurveyRequest = await request.json();
    const { supplierEmail, supplierName, contactPersonName, personalMessage } = body;

    if (!supplierEmail) {
      return NextResponse.json({ error: 'Supplier email is required' }, { status: 400 });
    }
    if (!emailRegex.test(supplierEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    const normalisedEmail = supplierEmail.toLowerCase().trim();

    // Resolve the caller's organisation (verified via membership)
    const { data: membership } = await adminClient
      .from('organization_members')
      .select('organization_id')
      .eq('user_id', user.id)
      .limit(1)
      .single();
    const organizationId = membership?.organization_id;

    if (!organizationId) {
      return NextResponse.json(
        { error: 'You must be a member of an organisation to send a survey' },
        { status: 403 },
      );
    }

    // Org + inviter details for the email
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();
    const organizationName = orgData?.name || 'an alkatera customer';

    const { data: inviterProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const inviterName = inviterProfile?.full_name || user.email || 'Your customer';

    // 1. Auto-create (or reuse) the org-scoped supplier record.
    const { data: existingSupplier } = await adminClient
      .from('suppliers')
      .select('id, user_id')
      .eq('organization_id', organizationId)
      .ilike('contact_email', normalisedEmail)
      .limit(1)
      .maybeSingle();

    let supplierId = existingSupplier?.id as string | undefined;

    if (!supplierId) {
      const { data: newSupplier, error: supplierError } = await adminClient
        .from('suppliers')
        .insert({
          organization_id: organizationId,
          name: supplierName || contactPersonName || normalisedEmail,
          contact_email: normalisedEmail,
          contact_name: contactPersonName || null,
        })
        .select('id')
        .single();

      if (supplierError || !newSupplier) {
        console.error('Error creating supplier record:', supplierError);
        return NextResponse.json(
          { error: supplierError?.message || 'Failed to create supplier record' },
          { status: 500 },
        );
      }
      supplierId = newSupplier.id;

      // Mirror the manual "Add supplier" flow: create an 'invited' engagement.
      await adminClient
        .from('supplier_engagements')
        .insert({ supplier_id: supplierId, status: 'invited', created_by: user.id });
    }

    // 1b. Ensure the supplier appears in the brand's list, which reads from
    //     organization_suppliers_view (organization_suppliers JOIN platform_suppliers).
    //     Create/find the platform directory entry and link it to this org.
    const { data: existingPlatform } = await adminClient
      .from('platform_suppliers')
      .select('id')
      .ilike('contact_email', normalisedEmail)
      .limit(1)
      .maybeSingle();

    let platformSupplierId = existingPlatform?.id as string | undefined;

    if (!platformSupplierId) {
      const { data: newPlatform, error: platformError } = await adminClient
        .from('platform_suppliers')
        .insert({
          name: supplierName || contactPersonName || normalisedEmail,
          contact_email: normalisedEmail,
          contact_name: contactPersonName || null,
          is_verified: false,
        })
        .select('id')
        .single();

      if (platformError || !newPlatform) {
        console.error('Error creating platform supplier:', platformError);
        return NextResponse.json(
          { error: platformError?.message || 'Failed to create supplier directory entry' },
          { status: 500 },
        );
      }
      platformSupplierId = newPlatform.id;
    }

    // Link the org to the platform supplier if not already linked.
    const { data: existingLink } = await adminClient
      .from('organization_suppliers')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('platform_supplier_id', platformSupplierId)
      .limit(1)
      .maybeSingle();

    if (!existingLink) {
      await adminClient
        .from('organization_suppliers')
        .insert({
          organization_id: organizationId,
          platform_supplier_id: platformSupplierId,
          engagement_status: 'invited',
        });
    }

    // 2. Expire any previous pending ESG survey invitations for this supplier.
    await adminClient
      .from('supplier_invitations')
      .update({ status: 'expired' })
      .eq('organization_id', organizationId)
      .eq('request_kind', 'esg_assessment')
      .eq('supplier_email', normalisedEmail)
      .eq('status', 'pending');

    // 3. Create the ESG survey invitation, linked to the supplier record.
    const { data: invitation, error: invitationError } = await adminClient
      .from('supplier_invitations')
      .insert({
        organization_id: organizationId,
        supplier_id: supplierId,
        supplier_email: normalisedEmail,
        supplier_name: supplierName || null,
        contact_person_name: contactPersonName || null,
        personal_message: personalMessage || null,
        invited_by: user.id,
        request_kind: 'esg_assessment',
      })
      .select()
      .single();

    if (invitationError || !invitation) {
      console.error('Error creating ESG survey invitation:', invitationError);
      return NextResponse.json(
        { error: invitationError?.message || 'Failed to create survey request' },
        { status: 500 },
      );
    }

    // Build invitation URL
    const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com';
    const invitationUrl = `${siteUrl}/supplier-invite/${invitation.invitation_token}`;

    // 4. Send the survey email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    let emailSent = false;

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';
        const emailSubject = `${organizationName} has invited you to complete a sustainability survey on alkatera`;
        const greetingName = contactPersonName || supplierName;
        const greeting = greetingName ? escapeHtml(greetingName) : null;
        const safeInviterName = escapeHtml(inviterName || '');
        const safeOrgName = escapeHtml(organizationName || '');
        const safePersonalMessage = personalMessage ? escapeHtml(personalMessage) : '';

        // When the inviter has no profile name we fall back to their email
        // address. Email clients (notably Outlook) auto-link bare addresses
        // with default blue underlined styling, which is unreadable on the
        // black background. Wrapping it in an explicit styled anchor keeps
        // control of the colour.
        const inviterDisplayHtml = emailRegex.test(inviterName || '')
          ? `<a href="mailto:${safeInviterName}" style="color: #ccff00; text-decoration: underline;">${safeInviterName}</a>`
          : `<strong style="color: #ffffff;">${safeInviterName}</strong>`;

        // Email is intentionally dark-themed. Some webmail clients (and OS
        // light mode) strip CSS `background` shorthands and tint the canvas
        // white, leaving the design broken. To force a solid black background
        // regardless of the recipient's light/dark setting we: (1) declare
        // color-scheme: dark so clients don't auto-invert, (2) use a table
        // layout with bgcolor HTML attributes (honoured far more reliably than
        // CSS), and (3) add a prefers-color-scheme: light override with
        // !important for clients that still try to re-tint.
        const emailHtml = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="dark" />
<meta name="supported-color-schemes" content="dark" />
<style>
  :root { color-scheme: dark; supported-color-schemes: dark; }
  body, .alk-canvas { margin:0 !important; padding:0; background-color:#000000 !important; }
  a { color:#ccff00 !important; }
  a.alk-btn { color:#000000 !important; }
  @media (prefers-color-scheme: light) {
    body, .alk-canvas { background-color:#000000 !important; }
    .alk-card { background-color:#0a0a0a !important; }
    a { color:#ccff00 !important; }
    a.alk-btn { color:#000000 !important; }
  }
</style>
</head>
<body class="alk-canvas" style="margin:0;padding:0;background-color:#000000;">
  <table role="presentation" class="alk-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#000000" style="width:100%;background-color:#000000;">
    <tr>
      <td align="center" style="padding:24px 12px;background-color:#000000;">
        <table role="presentation" class="alk-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#0a0a0a" style="width:600px;max-width:600px;background-color:#0a0a0a;border:1px solid #222;">
          <tr>
            <td style="padding:40px;font-family:Arial, Helvetica, sans-serif;color:#e8e8e8;background-color:#0a0a0a;">
              <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
                <img src="${logoUrl}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />
                <h1 style="color: #ccff00; font-family: 'Courier New', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Sustainability Survey</h1>
              </div>
              <p style="color: #e8e8e8; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                ${greeting ? `Dear ${greeting},` : 'Hello,'}
              </p>
              <p style="color: #e8e8e8; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                ${inviterDisplayHtml} at <strong style="color: #fff;">${safeOrgName}</strong> has invited you to complete a short sustainability survey (ESG self-assessment) on the alka<strong style="color: #fff;">tera</strong> platform. Your responses help ${safeOrgName} gather the supplier evidence they need, including for B Corp certification.
              </p>
              ${safePersonalMessage ? `<div style="margin: 20px 0; padding: 16px; border-left: 2px solid #ccff00; background-color: #111111;"><p style="color: #aaa; font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">Message from ${inviterDisplayHtml}:</p><p style="color: #e8e8e8; font-size: 15px; line-height: 1.7; margin: 0;">${safePersonalMessage}</p></div>` : ''}
              <div style="margin: 30px 0; text-align: center;">
                <a href="${invitationUrl}" class="alk-btn" style="display: inline-block; background-color: #ccff00; color: #000000; font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none; border-radius: 4px;">Start the survey</a>
              </div>
              <p style="color: #aaa; font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
                Or copy this link into your browser:<br />
                <a href="${invitationUrl}" style="color: #ccff00; text-decoration: underline; word-break: break-all;">${invitationUrl}</a>
              </p>
              <div style="margin: 24px 0; padding: 20px; background-color: #111111; border: 1px solid #222; border-radius: 4px;">
                <p style="color: #ccff00; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">What to expect</p>
                <p style="color: #e8e8e8; font-size: 14px; line-height: 1.7; margin: 0;">
                  The survey covers labour &amp; human rights, environment, ethics, health &amp; safety and management systems. You can upload supporting evidence and save your progress as you go. alka<strong style="color: #fff;">tera</strong> is <strong style="color: #fff;">completely free for suppliers</strong>.
                </p>
              </div>
              <p style="color: #aaa; font-size: 13px; line-height: 1.6;">
                This invitation will expire in 30 days. If you have any questions, please contact <a href="mailto:hello@alkatera.com" style="color: #ccff00; text-decoration: underline;">hello@alkatera.com</a>
              </p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #aaa; font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
                The alka<strong>tera</strong> Team
              </div>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

        // Do not CC the inviter: they're often signed in to the main app, and
        // opening their own copy of the link could disrupt their session. The
        // supplier's replies still reach them via replyTo, and we keep an
        // internal copy on hello@alkatera.com.
        const ccList = ['hello@alkatera.com'];

        await resend.emails.send({
          from: 'alkatera <sayhello@mail.alkatera.com>',
          to: [supplierEmail],
          cc: ccList,
          replyTo: user.email || 'hello@alkatera.com',
          subject: emailSubject,
          html: emailHtml,
        });

        emailSent = true;
      } catch (emailError) {
        console.error('Failed to send survey email:', emailError);
      }
    } else {
      console.warn('RESEND_API_KEY not configured — email not sent');
    }

    return NextResponse.json({
      success: true,
      message: 'Survey sent successfully',
      supplier_id: supplierId,
      invitation: {
        id: invitation.id,
        supplier_email: invitation.supplier_email,
        invitation_url: invitationUrl,
        expires_at: invitation.expires_at,
      },
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('Unexpected error in send-esg-survey:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
