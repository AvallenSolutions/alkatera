import { NextRequest, NextResponse } from 'next/server';
import { Resend } from 'resend';
import { getSupabaseServerClient } from '@/lib/supabase/server-client';

const resend = new Resend(process.env.RESEND_API_KEY);

export async function POST(request: NextRequest) {
  try {
    const supabase = getSupabaseServerClient();

    // Check if user is authenticated and is Alkatera admin
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    // Check if user is Alkatera admin
    const { data: isAdmin, error: adminError } = await supabase.rpc('is_alkatera_admin');

    if (adminError || !isAdmin) {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      );
    }

    const body = await request.json();
    const { postId, postTitle, postExcerpt, postSlug } = body;

    if (!postId || !postTitle) {
      return NextResponse.json(
        { error: 'Post ID and title are required' },
        { status: 400 }
      );
    }

    const postUrl = `https://alkatera.com/blog/${postSlug}`;

    if (!process.env.RESEND_API_KEY) {
      console.error('RESEND_API_KEY is not configured');
      return NextResponse.json(
        { error: 'Email service not configured' },
        { status: 500 }
      );
    }

    const { data, error: emailError } = await resend.emails.send({
      from: 'AlkaTera <sayhello@mail.alkatera.com>',
      to: ['hello@alkatera.com'],
      subject: `New Blog Post Published: ${postTitle}`,
      html: `
        <div style="font-family: 'Courier New', monospace; max-width: 600px; margin: 0 auto; background: #0a0a0a; color: #e0e0e0; padding: 40px; border: 1px solid #222;">
          <div style="border-bottom: 1px solid #333; padding-bottom: 20px; margin-bottom: 30px;">
            <h1 style="color: #ccff00; font-size: 14px; text-transform: uppercase; letter-spacing: 3px; margin: 0;">New Blog Post Published</h1>
          </div>
          <h2 style="color: #fff; font-size: 22px; font-family: Georgia, serif; margin: 0 0 16px 0;">${postTitle}</h2>
          ${postExcerpt ? `<p style="color: #999; font-size: 14px; line-height: 1.8; margin: 0 0 24px 0;">${postExcerpt}</p>` : ''}
          <div style="margin: 30px 0; text-align: center;">
            <a href="${postUrl}" style="display: inline-block; background: #ccff00; color: #000; font-family: 'Courier New', monospace; font-size: 12px; font-weight: bold; text-transform: uppercase; letter-spacing: 3px; padding: 16px 32px; text-decoration: none;">Read Post</a>
          </div>
          <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #333; color: #555; font-size: 10px; text-transform: uppercase; letter-spacing: 2px;">
            Sent via AlkaTera Blog
          </div>
        </div>
      `,
    });

    if (emailError) {
      console.error('Failed to send blog notification email:', emailError);
      return NextResponse.json(
        { error: 'Failed to send email notification' },
        { status: 500 }
      );
    }

    console.log('Blog notification email sent:', data?.id);

    return NextResponse.json({
      success: true,
      message: 'Email notification sent successfully',
      emailId: data?.id,
    });

  } catch (error) {
    console.error('Email notification error:', error);
    return NextResponse.json(
      { error: 'Failed to send email notifications' },
      { status: 500 }
    );
  }
}
