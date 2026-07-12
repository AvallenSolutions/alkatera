"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { Statement, Eyebrow } from "@/components/studio";
import { Thread, useRealtimeThread } from "@/components/network";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";

interface ConversationMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  message: string;
  attachments: any[];
  is_read: boolean;
  read_at: string | null;
  created_at: string;
  sender_name?: string;
  sender_email?: string;
  sender_avatar_url?: string;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const { user } = useAuth();
  const { toast } = useToast();

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [conversationSubject, setConversationSubject] = useState("");

  const conversationId = params.id as string;

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    // Mark messages as read when viewing
    if (messages.length > 0 && user) {
      markAsRead();
    }
  }, [messages, user]);

  useRealtimeThread({
    channelName: `advisor-conv-${conversationId}`,
    table: "advisor_messages",
    filterColumn: "conversation_id",
    filterValue: conversationId,
    onInsert: loadMessages,
  });

  async function getSession() {
    const { data: { session } } = await supabase.auth.getSession();
    return session;
  }

  async function loadMessages() {
    setIsLoading(true);
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch(
        `/api/advisor-messages?conversation_id=${conversationId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load messages");
      }

      const data = await response.json();
      setMessages(data.messages || []);

      if (!conversationSubject) {
        fetchConversationDetails();
      }
    } catch (error) {
      console.error("Error loading messages:", error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function fetchConversationDetails() {
    try {
      const { data } = await supabase
        .from("advisor_conversations")
        .select("subject")
        .eq("id", conversationId)
        .single();

      if (data?.subject) {
        setConversationSubject(data.subject);
      }
    } catch {
      // Non-critical, ignore
    }
  }

  async function markAsRead() {
    try {
      const session = await getSession();
      if (!session) return;

      await fetch("/api/advisor-messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "mark_read",
          conversation_id: conversationId,
        }),
      });
    } catch {
      // Non-critical, ignore
    }
  }

  async function sendMessage(text: string) {
    setIsSending(true);
    try {
      const session = await getSession();
      if (!session) throw new Error("No session");

      const response = await fetch("/api/advisor-messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_message",
          conversation_id: conversationId,
          message: text,
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

      await loadMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsSending(false);
    }
  }

  const participant = messages.find((m) => m.sender_id !== user?.id);
  const startedAt = messages.length > 0 ? messages[0].created_at : null;

  if (isLoading) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <div className="flex items-center justify-center py-12">
          <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
            Loading
          </span>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/settings/messages"
        className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to messages
      </Link>

      <Statement
        eyebrow="THE NETWORK · MESSAGE"
        headline={conversationSubject || "The conversation."}
      />
      {(participant || startedAt) && (
        <p className="mt-3 font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          {participant?.sender_name || participant?.sender_email}
          {participant && startedAt ? " · " : ""}
          {startedAt ? `Started ${format(new Date(startedAt), "MMM d")}` : ""}
        </p>
      )}

      <div className="mt-8">
        <Eyebrow tone="dim" className="mb-4">
          Conversation
        </Eyebrow>
        <Thread
          messages={messages}
          currentUserId={user?.id ?? null}
          isOwn={(m) => m.sender_id === user?.id}
          keyFor={(m) => m.id}
          bubblePropsFor={(m) => ({
            senderName:
              m.sender_id === user?.id
                ? "You"
                : m.sender_name || m.sender_email || "Unknown",
            senderAvatarUrl: m.sender_avatar_url,
            body: m.message,
            createdAt: m.created_at,
          })}
          onSend={sendMessage}
          isSending={isSending}
          shortcutSend
        />
      </div>
    </div>
  );
}
