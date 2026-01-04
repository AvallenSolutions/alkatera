import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, name, company, subscribe } = body;

    // Validate required fields
    if (!email || !name) {
      return NextResponse.json(
        { error: 'Email and name are required' },
        { status: 400 }
      );
    }

    // Only add to Sender if user consented to mailing list
    if (subscribe) {
      const senderToken = process.env.SENDER_API_TOKEN;

      if (!senderToken) {
        console.error('SENDER_API_TOKEN is not configured');
        return NextResponse.json(
          { error: 'Email service not configured' },
          { status: 500 }
        );
      }

      // Split name into firstname and lastname
      const nameParts = name.trim().split(' ');
      const firstname = nameParts[0];
      const lastname = nameParts.slice(1).join(' ');

      // Prepare payload for Sender API
      const senderPayload: {
        email: string;
        firstname: string;
        lastname?: string;
        fields?: {
          company?: string;
        };
        trigger_automation?: boolean;
      } = {
        email,
        firstname,
        trigger_automation: true, // Enable automation workflows
      };

      // Add lastname if available
      if (lastname) {
        senderPayload.lastname = lastname;
      }

      // Add company as custom field if provided
      if (company) {
        senderPayload.fields = {
          company,
        };
      }

      // Call Sender API
      const senderResponse = await fetch('https://api.sender.net/v2/subscribers', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${senderToken}`,
          'Content-Type': 'application/json',
          'Accept': 'application/json',
        },
        body: JSON.stringify(senderPayload),
      });

      if (!senderResponse.ok) {
        const errorData = await senderResponse.json().catch(() => ({}));
        console.error('Sender API error:', errorData);

        // Don't expose Sender API errors to client, but log them
        return NextResponse.json(
          { error: 'Failed to subscribe to mailing list' },
          { status: 500 }
        );
      }

      const senderData = await senderResponse.json();
      console.log('Successfully added subscriber to Sender:', senderData);
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
