import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { Resend } from 'resend';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

interface InviteSupplierRequest {
  productId?: number;
  materialId?: string;
  materialName?: string;
  materialType?: 'ingredient' | 'packaging';
  supplierEmail: string;
  contactPersonName?: string;
  supplierName?: string;
  personalMessage?: string;
}

const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

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

    const body: InviteSupplierRequest = await request.json();
    const {
      productId,
      materialId,
      materialName,
      materialType,
      supplierEmail,
      contactPersonName,
      supplierName,
      personalMessage,
    } = body;

    // Validate required fields
    if (!supplierEmail) {
      return NextResponse.json({ error: 'Supplier email is required' }, { status: 400 });
    }

    if (!emailRegex.test(supplierEmail)) {
      return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
    }

    if (materialType && !['ingredient', 'packaging'].includes(materialType)) {
      return NextResponse.json(
        { error: "Material type must be either 'ingredient' or 'packaging'" },
        { status: 400 },
      );
    }

    // Get the user's current organisation
    let organizationId = user.user_metadata?.current_organization_id;

    if (!organizationId) {
      // Fallback: look up membership
      const { data: membership } = await adminClient
        .from('organization_members')
        .select('organization_id')
        .eq('user_id', user.id)
        .limit(1)
        .single();
      organizationId = membership?.organization_id;
    }

    if (!organizationId) {
      return NextResponse.json(
        { error: 'You must be a member of an organisation to invite suppliers' },
        { status: 403 },
      );
    }

    // Fetch org name for the email template
    const { data: orgData } = await adminClient
      .from('organizations')
      .select('name')
      .eq('id', organizationId)
      .single();
    const organizationName = orgData?.name || 'an alkatera customer';

    // Fetch inviter's name for the email template
    const { data: inviterProfile } = await adminClient
      .from('profiles')
      .select('full_name')
      .eq('id', user.id)
      .single();
    const inviterName = inviterProfile?.full_name || user.email || 'Your customer';

    // Validate product if provided (material-specific invite from Supply Chain Map)
    let product: { id: number; name: string } | null = null;
    if (productId) {
      const { data: productData, error: productError } = await adminClient
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .eq('organization_id', organizationId)
        .single();

      if (productError || !productData) {
        return NextResponse.json(
          { error: 'Product not found or access denied' },
          { status: 404 },
        );
      }
      product = productData;
    }

    // Check for duplicate pending invitations
    if (materialId) {
      const { data: existingInvitation } = await adminClient
        .from('supplier_invitations')
        .select('id, status')
        .eq('material_id', materialId)
        .eq('supplier_email', supplierEmail.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        return NextResponse.json(
          { error: 'An invitation to this supplier for this material is already pending' },
          { status: 409 },
        );
      }
    } else {
      const { data: existingInvitation } = await adminClient
        .from('supplier_invitations')
        .select('id, status')
        .eq('organization_id', organizationId)
        .is('material_id', null)
        .eq('supplier_email', supplierEmail.toLowerCase())
        .eq('status', 'pending')
        .single();

      if (existingInvitation) {
        return NextResponse.json(
          { error: 'A general invitation to this supplier is already pending' },
          { status: 409 },
        );
      }
    }

    const { data: invitation, error: invitationError } = await adminClient
      .from('supplier_invitations')
      .insert({
        organization_id: organizationId,
        product_id: productId || null,
        material_id: materialId || null,
        material_name: materialName || null,
        material_type: materialType || null,
        supplier_email: supplierEmail.toLowerCase(),
        contact_person_name: contactPersonName || null,
        supplier_name: supplierName || null,
        invited_by: user.id,
        personal_message: personalMessage || null,
      })
      .select()
      .single();

    if (invitationError) {
      console.error('Error creating invitation:', invitationError);
      return NextResponse.json(
        { error: invitationError.message || 'Failed to create invitation' },
        { status: 500 },
      );
    }

    // Build invitation URL
    const siteUrl = process.env.SITE_URL || process.env.NEXT_PUBLIC_SITE_URL || 'https://www.alkatera.com';
    const invitationUrl = `${siteUrl}/supplier-invite/${invitation.invitation_token}`;

    // Send invitation email via Resend
    const resendApiKey = process.env.RESEND_API_KEY;
    let emailSent = false;

    if (resendApiKey) {
      try {
        const resend = new Resend(resendApiKey);
        const logoUrl = 'https://vgbujcuwptvheqijyjbe.supabase.co/storage/v1/object/public/hmac-uploads/uploads/5aedb0b2-3178-4623-b6e3-fc614d5f20ec/1767511420198-2822f942/alkatera_logo-transparent.png';
        const emailSubject = `${organizationName} has invited you to share sustainability data on alkatera`;
        const greeting = contactPersonName || supplierName || 'there';

        const emailHtml = `
          <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
            <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px; text-align: center;">
              <img src="${logoUrl}" alt="alkatera" width="160" height="auto" style="display: block; margin: 0 auto 16px auto;" />
              <h1 style="color: #ccff00; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">Supplier Invitation</h1>
            </div>
            <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
              Dear ${greeting},
            </p>
            <p style="color: #ccc; font-size: 14px; line-height: 1.8;">
              <strong style="color: #fff;">${inviterName}</strong> at <strong style="color: #fff;">${organizationName}</strong> has invited you to join the alka<strong style="color: #fff;">tera</strong> platform to ${materialName ? `provide verified sustainability data for <strong style="color: #fff;">${materialName}</strong>` : 'share your sustainability data'}.
            </p>
            ${personalMessage ? `<div style="margin: 20px 0; padding: 16px; border-left: 2px solid #ccff00; background: #111;"><p style="color: #999; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 8px 0;">Message from ${inviterName}:</p><p style="color: #ccc; font-size: 14px; line-height: 1.8; margin: 0;">${personalMessage}</p></div>` : ''}
            <table style="width: 100%; border-collapse: collapse; margin: 20px 0;">
              <tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; width: 120px;">From</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;">${inviterName}, ${organizationName}</td>
              </tr>
              ${product ? `<tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Product</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;">${product.name}</td>
              </tr>` : ''}
              ${materialName ? `<tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Material</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;">${materialName} (${materialType})</td>
              </tr>` : ''}
            </table>
            <div style="margin: 30px 0; text-align: center;">
              <a href="${invitationUrl}" style="display: inline-block; background: #ccff00; color: #000; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none;">Accept Invitation</a>
            </div>
            <div style="margin: 24px 0; padding: 20px; background: #111; border: 1px solid #222; border-radius: 4px;">
              <p style="color: #ccff00; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 2px; margin: 0 0 12px 0;">Why join alkatera?</p>
              <p style="color: #ccc; font-size: 13px; line-height: 1.8; margin: 0;">
                alkatera is <strong style="color: #fff;">completely free for suppliers</strong>. Your account gives you a streamlined portal to manage your sustainability data and share verified product information with your customers. No hidden costs, no commitment &mdash; just a simpler way to share your environmental credentials.
              </p>
            </div>
            <p style="color: #666; font-size: 12px; line-height: 1.6;">
              This invitation will expire in 30 days. If you have any questions, please contact <a href="mailto:hello@alkatera.com" style="color: #ccff00; text-decoration: none;">hello@alkatera.com</a>
            </p>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">
              The alka<strong>tera</strong> Team
            </div>
          </div>
        `;

        const ccList = [user.email, 'sayhello@mail.alkatera.com'].filter(Boolean) as string[];

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
        console.error('Failed to send invitation email:', emailError);
      }
    } else {
      console.warn('RESEND_API_KEY not configured — email not sent');
    }

    return NextResponse.json({
      success: true,
      message: 'Invitation created successfully',
      invitation: {
        id: invitation.id,
        supplier_email: invitation.supplier_email,
        invitation_url: invitationUrl,
        expires_at: invitation.expires_at,
      },
      email_sent: emailSent,
    });
  } catch (error) {
    console.error('Unexpected error in invite-supplier:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 },
    );
  }
}
