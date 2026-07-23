import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';
import { escapeHtml } from '@/lib/utils/escape-html';
import { resolveAccessibleOrg } from '@/lib/supabase/verify-org-access';
import { denyReadOnlyAdvisor } from '@/lib/auth/advisor-access';

// Next.js patches global fetch and, on this route pattern (no next/headers
// call to auto-trigger dynamic mode), would otherwise cache these outbound
// Supabase requests across invocations — a GET with an identical URL every
// time would keep returning the first response it ever saw. no-store on
// every call is what makes this route actually live.
const noStoreFetch: typeof fetch = (input, init) => fetch(input, { ...init, cache: 'no-store' });

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
      global: { fetch: noStoreFetch },
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

    // Resolve the caller's organisation, honouring advisor access. The
    // service-role client bypasses RLS, so this gate is the only org scoping.
    const organizationId = await resolveAccessibleOrg(adminClient as any, user);

    if (!organizationId) {
      return NextResponse.json(
        { error: 'You must be a member of an organisation to send a survey' },
        { status: 403 },
      );
    }

    // Read-only advisors may view but not mutate this organisation's data.
    const denied = await denyReadOnlyAdvisor(adminClient as any, user, organizationId);
    if (denied) return denied;

    // Respect a previous one-click unsubscribe. Tell the brand rather than
    // failing quietly: they need to know to chase this supplier another way,
    // and re-mailing someone who opted out is what damages sending reputation
    // in the first place.
    const { data: optedOut } = await adminClient
      .from('supplier_invitations')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('supplier_email', normalisedEmail)
      .eq('email_status', 'unsubscribed')
      .limit(1)
      .maybeSingle();

    if (optedOut) {
      return NextResponse.json(
        {
          error:
            'This contact has unsubscribed from survey emails. Copy the invitation link and send it to them directly instead.',
          unsubscribed: true,
        },
        { status: 409 },
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
    let emailError: string | null = null;
    let emailProviderId: string | null = null;

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        // Serve the logo from our own domain. Loading it from a raw
        // *.supabase.co storage hostname is a spam signal: the asset domain
        // has no relationship to the sending domain or to any brand named in
        // the message.
        const logoUrl = `${siteUrl}/logo.png`;
        const unsubscribeUrl = `${siteUrl}/api/email/unsubscribe?token=${invitation.invitation_token}`;
        const emailSubject = `${organizationName} has invited you to complete a sustainability survey on alkatera`;
        const greetingName = contactPersonName || supplierName;
        const greeting = greetingName ? escapeHtml(greetingName) : null;
        const safeInviterName = escapeHtml(inviterName || '');
        const safeOrgName = escapeHtml(organizationName || '');
        const safePersonalMessage = personalMessage ? escapeHtml(personalMessage) : '';

        // When the inviter has no profile name we fall back to their email
        // address. Email clients (notably Outlook) auto-link bare addresses
        // with default blue underlined styling, which clashes with the card
        // background. Wrapping it in an explicit styled anchor keeps
        // control of the colour.
        const inviterDisplayHtml = emailRegex.test(inviterName || '')
          ? `<a href="mailto:${safeInviterName}" style="color: #205E40; text-decoration: underline;">${safeInviterName}</a>`
          : `<strong style="color: #1A1B1D;">${safeInviterName}</strong>`;

        // Email uses the studio palette: a paper canvas with a cream card.
        // Some webmail clients (and OS dark mode) strip CSS `background`
        // shorthands and re-tint the canvas, leaving the design broken. To
        // keep the light background regardless of the recipient's light/dark
        // setting we: (1) declare color-scheme: light so clients don't
        // auto-invert, (2) use a table layout with bgcolor HTML attributes
        // (honoured far more reliably than CSS), and (3) add a
        // prefers-color-scheme: dark override with !important for clients
        // that still try to re-tint.
        const emailHtml = `<!DOCTYPE html>
<html lang="en" style="margin:0;padding:0;">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<meta name="color-scheme" content="light" />
<meta name="supported-color-schemes" content="light" />
<style>
  :root { color-scheme: light; supported-color-schemes: light; }
  body, .alk-canvas { margin:0 !important; padding:0; background-color:#ECEAE3 !important; }
  a { color:#205E40 !important; }
  a.alk-btn { color:#F2F1EA !important; }
  @media (prefers-color-scheme: dark) {
    body, .alk-canvas { background-color:#ECEAE3 !important; }
    .alk-card { background-color:#F2F1EA !important; }
    a { color:#205E40 !important; }
    a.alk-btn { color:#F2F1EA !important; }
  }
</style>
</head>
<body class="alk-canvas" style="margin:0;padding:0;background-color:#ECEAE3;">
  <table role="presentation" class="alk-canvas" width="100%" cellpadding="0" cellspacing="0" border="0" bgcolor="#ECEAE3" style="width:100%;background-color:#ECEAE3;">
    <tr>
      <td align="center" style="padding:24px 12px;background-color:#ECEAE3;">
        <table role="presentation" class="alk-card" width="600" cellpadding="0" cellspacing="0" border="0" bgcolor="#F2F1EA" style="width:600px;max-width:600px;background-color:#F2F1EA;border:1px solid #D9D6CB;">
          <tr>
            <td style="padding:40px;font-family:Arial, Helvetica, sans-serif;color:#1A1B1D;background-color:#F2F1EA;">
              <div style="border-bottom: 1px solid #D9D6CB; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
                <img src="${logoUrl}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />
                <h1 style="color: #205E40; font-family: 'Courier New', monospace; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Sustainability Survey</h1>
              </div>
              <p style="color: #1A1B1D; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                ${greeting ? `Dear ${greeting},` : 'Hello,'}
              </p>
              <p style="color: #1A1B1D; font-size: 15px; line-height: 1.7; margin: 0 0 16px 0;">
                ${inviterDisplayHtml} at <strong style="color: #1A1B1D;">${safeOrgName}</strong> has invited you to complete a short sustainability survey (ESG self-assessment) on the alka<strong style="color: #1A1B1D;">tera</strong> platform. Your responses help ${safeOrgName} gather the supplier evidence they need, including for B Corp certification.
              </p>
              ${safePersonalMessage ? `<div style="margin: 20px 0; padding: 16px; border-left: 2px solid #205E40; background-color: #ffffff;"><p style="color: #6F6F68; font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">Message from ${inviterDisplayHtml}:</p><p style="color: #1A1B1D; font-size: 15px; line-height: 1.7; margin: 0;">${safePersonalMessage}</p></div>` : ''}
              <div style="margin: 30px 0; text-align: center;">
                <a href="${invitationUrl}" class="alk-btn" style="display: inline-block; background-color: #1A1B1D; color: #F2F1EA; font-family: 'Courier New', monospace; font-size: 13px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none; border-radius: 4px;">Start the survey</a>
              </div>
              <p style="color: #6F6F68; font-size: 13px; line-height: 1.6; text-align: center; margin: 0 0 24px 0;">
                Or copy this link into your browser:<br />
                <a href="${invitationUrl}" style="color: #205E40; text-decoration: underline; word-break: break-all;">${invitationUrl}</a>
              </p>
              <div style="margin: 24px 0; padding: 20px; background-color: #ffffff; border: 1px solid #D9D6CB; border-radius: 4px;">
                <p style="color: #205E40; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">What to expect</p>
                <p style="color: #1A1B1D; font-size: 14px; line-height: 1.7; margin: 0;">
                  The survey covers labour &amp; human rights, environment, ethics, health &amp; safety and management systems. You can upload supporting evidence and save your progress as you go. alka<strong style="color: #1A1B1D;">tera</strong> is <strong style="color: #1A1B1D;">completely free for suppliers</strong>.
                </p>
              </div>
              <p style="color: #6F6F68; font-size: 13px; line-height: 1.6;">
                This invitation will expire in 30 days. If you have any questions, please contact <a href="mailto:hello@alkatera.com" style="color: #205E40; text-decoration: underline;">hello@alkatera.com</a>
              </p>
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #D9D6CB; color: #6F6F68; font-family: 'Courier New', monospace; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">
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

        // Show the brand the supplier actually recognises while keeping the
        // From address on our DMARC-aligned sending domain. Three different
        // identities in one message (our From, the inviter's Reply-To, a third
        // company throughout the body) is the exact shape of a phishing
        // attempt and filters score it that way. "X via alkatera" is the same
        // pattern Google Groups uses. The display name is quoted, so strip the
        // characters that could terminate the quoted string or inject a header.
        const fromDisplayName = `${organizationName} via alkatera`
          .replace(/[\\"]/g, '')
          .replace(/[\r\n]+/g, ' ')
          .trim();

        // No CC to hello@alkatera.com any more: it exposed an internal address
        // to every one of the customer's suppliers, and a third-party CC on a
        // one-to-one message is one more oddity for a filter to weigh. The
        // send is recorded on the invitation row instead.
        const { data: sendResult, error: sendError } = await resend.emails.send({
          from: `"${fromDisplayName}" <sayhello@mail.alkatera.com>`,
          to: [normalisedEmail],
          replyTo: user.email || 'hello@alkatera.com',
          subject: emailSubject,
          html: emailHtml,
          headers: {
            // RFC 8058 one-click unsubscribe. Gmail and Yahoo have expected
            // this on bulk-shaped mail since February 2024 and treat its
            // absence as a negative reputation signal.
            'List-Unsubscribe': `<${unsubscribeUrl}>, <mailto:unsubscribe@alkatera.com?subject=Unsubscribe>`,
            'List-Unsubscribe-Post': 'List-Unsubscribe=One-Click',
          },
        });

        // The Resend SDK resolves with { data, error } and does NOT throw on
        // an API error. The previous version awaited this call and discarded
        // the result, so every provider-side failure was reported to the user
        // as a success.
        if (sendError) {
          console.error('Resend rejected survey email:', sendError);
          emailError = sendError.message || 'The email provider rejected the message';
        } else {
          emailSent = true;
          emailProviderId = sendResult?.id ?? null;
        }
      } catch (err: any) {
        console.error('Failed to send survey email:', err);
        emailError = err?.message || 'Could not reach the email provider';
      }
    } else {
      console.warn('RESEND_API_KEY not configured, email not sent');
      emailError = 'Email sending is not configured on this environment';
    }

    // Record the attempt on the invitation. email_provider_id is what
    // /api/webhooks/resend later matches a bounce against, so without it a
    // delivery failure could never be attributed back to this invitation.
    await adminClient
      .from('supplier_invitations')
      .update({
        email_provider_id: emailProviderId,
        email_status: emailSent ? 'sent' : 'failed',
        email_status_at: new Date().toISOString(),
        email_error: emailError,
      })
      .eq('id', invitation.id);

    return NextResponse.json({
      success: true,
      message: emailSent
        ? 'Survey sent successfully'
        : 'Survey created, but the email could not be sent',
      supplier_id: supplierId,
      invitation: {
        id: invitation.id,
        supplier_email: invitation.supplier_email,
        invitation_url: invitationUrl,
        expires_at: invitation.expires_at,
      },
      email_sent: emailSent,
      email_error: emailError,
    });
  } catch (error) {
    console.error('Unexpected error in send-esg-survey:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
