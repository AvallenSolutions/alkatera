import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company, subscribe, interest } = body;

    // Validate required fields
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // 1. Send notification email to hello@alkatera.com via Resend
    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const resend = new Resend(resendApiKey);

    try {
      await resend.emails.send({
        from: 'AlkaTera <sayhello@mail.alkatera.com>',
        to: ['hello@alkatera.com'],
        replyTo: email,
        subject: interest
          ? `New ${interest} Plan Inquiry from ${name}`
          : `New Contact Form Submission from ${name}`,
        html: `
          <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
            <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
              <h1 style="color: #ccff00; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">New Contact Inquiry</h1>
            </div>
            <table style="width: 100%; border-collapse: collapse;">
              <tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px; width: 120px;">Name</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;">${name}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Email</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;"><a href="mailto:${email}" style="color: #ccff00; text-decoration: none;">${email}</a></td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Company</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;">${company || 'Not provided'}</td>
              </tr>
              ${interest ? `<tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Interest</td>
                <td style="padding: 10px 0; color: #ccff00; font-size: 14px; font-weight: bold;">${interest} Plan</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; color: #888; font-size: 11px; text-transform: uppercase; letter-spacing: 2px;">Mailing List</td>
                <td style="padding: 10px 0; color: #fff; font-size: 14px;">${subscribe ? 'Yes — opted in' : 'No'}</td>
              </tr>
            </table>
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">
              Sent via AlkaTera Contact Form
            </div>
          </div>
        `,
      });
    } catch (emailError) {
      console.error('Failed to send notification email:', emailError);
      // Don't block form submission if email fails — log and continue
    }

    // 2. Add to Sender mailing list if user consented
    if (subscribe) {
      const senderToken = process.env.SENDER_API_TOKEN;

      if (!senderToken) {
        console.error('SENDER_API_TOKEN is not configured');
        // Don't block — email notification already sent
      } else {
        const nameParts = name.trim().split(' ');
        const firstname = nameParts[0];
        const lastname = nameParts.slice(1).join(' ');

        const senderPayload: Record<string, string> = {
          email,
          firstname,
        };

        if (lastname) {
          senderPayload.lastname = lastname;
        }

        if (company) {
          senderPayload.company = company;
        }
        try {
          const senderResponse = await fetch('https://api.sender.net/v2/subscribers', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${senderToken}`,
              'Content-Type': 'application/json',
              Accept: 'application/json',
            },
            body: JSON.stringify(senderPayload),
          });

          const responseText = await senderResponse.text();
          if (!senderResponse.ok) {
            let errorData;
            try {
              errorData = JSON.parse(responseText);
            } catch {
              errorData = { message: responseText };
            }
            console.error('Sender API error - Status:', senderResponse.status, 'Data:', errorData);
          } else {
            const senderData = JSON.parse(responseText);
          }
        } catch (senderError) {
          console.error('Sender API call failed:', senderError);
        }
      }
    }

    // Return success
    return NextResponse.json({
      success: true,
      message: 'Contact information received successfully',
    });
  } catch (error) {
    console.error('Contact form error:', error);
    return NextResponse.json(
      { error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}
