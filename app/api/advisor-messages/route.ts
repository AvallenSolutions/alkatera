import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

/**
 * GET /api/advisor-messages?conversation_id=...
 * Fetch messages for a specific conversation.
 *
 * GET /api/advisor-messages?organization_id=...
 * Fetch all conversations for an organization (with last message preview).
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  // Verify the user
  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const conversationId = searchParams.get('conversation_id');
  const organizationId = searchParams.get('organization_id');

  if (conversationId) {
    // Fetch messages for a conversation
    const { data: messages, error } = await supabase
      .from('advisor_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich with sender profiles
    const senderIds = Array.from(new Set((messages || []).map((m: any) => m.sender_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', senderIds);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched = (messages || []).map((msg: any) => {
      const profile = profileMap.get(msg.sender_id);
      return {
        ...msg,
        sender_name: profile?.full_name,
        sender_email: profile?.email,
        sender_avatar_url: profile?.avatar_url,
      };
    });

    return NextResponse.json({ messages: enriched });
  }

  if (organizationId) {
    // Fetch all conversations for the organization
    const { data: conversations, error } = await supabase
      .from('advisor_conversations')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('status', 'active')
      .order('last_message_at', { ascending: false });

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Enrich conversations with advisor profile and unread count
    const advisorIds = Array.from(new Set((conversations || []).map((c: any) => c.advisor_user_id)));
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, full_name, email, avatar_url')
      .in('id', advisorIds.length > 0 ? advisorIds : ['00000000-0000-0000-0000-000000000000']);

    const profileMap = new Map((profiles || []).map((p: any) => [p.id, p]));

    const enriched = await Promise.all(
      (conversations || []).map(async (conv: any) => {
        const advisorProfile = profileMap.get(conv.advisor_user_id);

        // Get unread count for this user
        const { count } = await supabase
          .from('advisor_messages')
          .select('id', { count: 'exact', head: true })
          .eq('conversation_id', conv.id)
          .neq('sender_id', user.id)
          .eq('is_read', false);

        // Get last message preview
        const { data: lastMsg } = await supabase
          .from('advisor_messages')
          .select('message, sender_id, created_at')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        return {
          ...conv,
          advisor_name: advisorProfile?.full_name || advisorProfile?.email || 'Advisor',
          advisor_email: advisorProfile?.email,
          advisor_avatar_url: advisorProfile?.avatar_url,
          unread_count: count || 0,
          last_message: lastMsg?.message,
          last_message_sender_id: lastMsg?.sender_id,
          last_message_at: lastMsg?.created_at || conv.created_at,
        };
      })
    );

    return NextResponse.json({ conversations: enriched });
  }

  return NextResponse.json({ error: 'conversation_id or organization_id is required' }, { status: 400 });
}

/**
 * POST /api/advisor-messages
 * Create a new conversation or send a message.
 *
 * Body for new conversation:
 *   { action: 'create_conversation', organization_id, advisor_user_id, subject, message }
 *
 * Body for new message:
 *   { action: 'send_message', conversation_id, message }
 *
 * Body for marking messages as read:
 *   { action: 'mark_read', conversation_id }
 */
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization');
  if (!authHeader) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const token = authHeader.replace('Bearer ', '');
  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const { data: { user }, error: userError } = await supabase.auth.getUser(token);
  if (userError || !user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json();
  const { action } = body;

  if (action === 'create_conversation') {
    const { organization_id, advisor_user_id, subject, message } = body;

    if (!organization_id || !advisor_user_id) {
      return NextResponse.json({ error: 'organization_id and advisor_user_id are required' }, { status: 400 });
    }

    // Create conversation
    const { data: conv, error: convError } = await supabase
      .from('advisor_conversations')
      .insert({
        organization_id,
        advisor_user_id,
        subject: subject || '',
        created_by: user.id,
      })
      .select()
      .single();

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    // Send initial message if provided
    if (message) {
      const { error: msgError } = await supabase
        .from('advisor_messages')
        .insert({
          conversation_id: conv.id,
          sender_id: user.id,
          message,
        });

      if (msgError) {
        console.error('Error sending initial message:', msgError);
      }
    }

    return NextResponse.json({ conversation: conv });
  }

  if (action === 'send_message') {
    const { conversation_id, message } = body;

    if (!conversation_id || !message) {
      return NextResponse.json({ error: 'conversation_id and message are required' }, { status: 400 });
    }

    const { data: msg, error: msgError } = await supabase
      .from('advisor_messages')
      .insert({
        conversation_id,
        sender_id: user.id,
        message,
      })
      .select()
      .single();

    if (msgError) {
      return NextResponse.json({ error: msgError.message }, { status: 500 });
    }

    // Fire-and-forget: send email notification
    sendAdvisorMessageEmail(supabase, conversation_id, msg.id, user.id).catch((err) => {
      console.error('[Advisor Messages] Email notification failed:', err);
    });

    return NextResponse.json({ message: msg });
  }

  if (action === 'mark_read') {
    const { conversation_id } = body;

    if (!conversation_id) {
      return NextResponse.json({ error: 'conversation_id is required' }, { status: 400 });
    }

    const { error } = await supabase
      .from('advisor_messages')
      .update({ is_read: true, read_at: new Date().toISOString() })
      .eq('conversation_id', conversation_id)
      .neq('sender_id', user.id)
      .eq('is_read', false);

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
}

// ============================================================================
// Phase 3c: Email notification for advisor messages
// ============================================================================

async function sendAdvisorMessageEmail(
  supabase: any,
  conversationId: string,
  messageId: string,
  senderId: string
) {
  const resendApiKey = process.env.RESEND_API_KEY;
  if (!resendApiKey) return;

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL || 'https://alkatera.com';

  // Fetch conversation details
  const { data: conv } = await supabase
    .from('advisor_conversations')
    .select('*, organizations(name)')
    .eq('id', conversationId)
    .single();

  if (!conv) return;

  // Fetch the message
  const { data: msg } = await supabase
    .from('advisor_messages')
    .select('message')
    .eq('id', messageId)
    .single();

  if (!msg) return;

  // Get sender profile
  const { data: senderProfile } = await supabase
    .from('profiles')
    .select('full_name, email')
    .eq('id', senderId)
    .single();

  const senderName = senderProfile?.full_name || senderProfile?.email || 'Someone';

  // Determine recipient(s)
  let recipientEmails: string[] = [];

  if (senderId === conv.advisor_user_id) {
    // Advisor sent → notify org members
    const { data: members } = await supabase
      .from('organization_members')
      .select('user_id')
      .eq('organization_id', conv.organization_id);

    if (members) {
      const memberIds = members.map((m: any) => m.user_id).filter((id: string) => id !== senderId);
      if (memberIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('email')
          .in('id', memberIds);
        recipientEmails = (profiles || []).map((p: any) => p.email).filter(Boolean);
      }
    }
  } else {
    // Org member sent → notify advisor
    const { data: advisorProfile } = await supabase
      .from('profiles')
      .select('email')
      .eq('id', conv.advisor_user_id)
      .single();

    if (advisorProfile?.email) {
      recipientEmails = [advisorProfile.email];
    }
  }

  if (recipientEmails.length === 0) return;

  const orgName = conv.organizations?.name || 'your organization';
  const subject = `New message from ${senderName}`;
  const messagePreview = msg.message.length > 200 ? msg.message.slice(0, 200) + '...' : msg.message;
  const messagesUrl = `${siteUrl}/settings/messages/${conversationId}`;

  const html = `
    <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #1a1a2e, #0a0a0a); padding: 24px; border-radius: 12px 12px 0 0; text-align: center;">
        <h2 style="color: #ccff00; margin: 0; font-size: 18px;">New Message</h2>
      </div>
      <div style="background: #f9fafb; padding: 24px; border: 1px solid #e5e7eb; border-top: none; border-radius: 0 0 12px 12px;">
        <p style="color: #374151; margin: 0 0 8px;"><strong>${senderName}</strong> sent a message${conv.subject ? ' regarding "' + conv.subject + '"' : ''}:</p>
        <blockquote style="border-left: 4px solid #ccff00; padding-left: 16px; margin: 16px 0; color: #4b5563;">${messagePreview}</blockquote>
        <a href="${messagesUrl}" style="display: inline-block; background: #ccff00; color: #000; padding: 12px 24px; border-radius: 6px; text-decoration: none; font-weight: 600; margin-top: 8px;">View Conversation</a>
      </div>
      <div style="text-align: center; color: #9ca3af; font-size: 12px; margin-top: 16px;">
        <p>alka<strong>tera</strong> - Sustainability Platform</p>
      </div>
    </div>
  `;

  // Send to each recipient
  for (const to of recipientEmails) {
    try {
      await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: 'alkatera <sayhello@mail.alkatera.com>',
          to,
          subject,
          html,
        }),
      });
    } catch (err) {
      console.error(`[Advisor Messages] Failed to send email to ${to}:`, err);
    }
  }
}
