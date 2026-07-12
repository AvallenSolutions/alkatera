"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Statement, BigNumber, FactList, type FactRowItem } from "@/components/studio";
import { useOrganization } from "@/lib/organizationContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";

interface AdvisorConversation {
  id: string;
  organization_id: string;
  advisor_user_id: string;
  subject: string;
  status: string;
  created_by: string;
  created_at: string;
  last_message_at: string;
  advisor_name: string;
  advisor_email: string;
  advisor_avatar_url: string | null;
  unread_count: number;
  last_message: string | null;
  last_message_sender_id: string | null;
}

export default function MessagesPage() {
  const { currentOrganization } = useOrganization();
  const { user } = useAuth();
  const { toast } = useToast();
  const [conversations, setConversations] = useState<AdvisorConversation[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (currentOrganization) {
      loadConversations();
    }
  }, [currentOrganization]);

  async function loadConversations() {
    if (!currentOrganization) return;

    setIsLoading(true);
    try {
      const { data: { session } } = await (await import("@/lib/supabaseClient")).supabase.auth.getSession();
      if (!session) return;

      const response = await fetch(
        `/api/advisor-messages?organization_id=${currentOrganization.id}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Failed to load conversations");
      }

      const data = await response.json();
      setConversations(data.conversations || []);
    } catch (error) {
      console.error("Error loading conversations:", error);
      toast({
        title: "Error",
        description: "Failed to load messages",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  const totalUnread = conversations.reduce((sum, c) => sum + c.unread_count, 0);

  const items: FactRowItem[] = conversations.map((conversation) => {
    const isFromMe = conversation.last_message_sender_id === (user?.id ?? null);
    const preview = conversation.last_message
      ? conversation.last_message.length > 100
        ? conversation.last_message.slice(0, 100) + "…"
        : conversation.last_message
      : "No messages yet";
    const hint = [
      conversation.subject || null,
      `${isFromMe ? "You: " : ""}${preview}`,
    ]
      .filter(Boolean)
      .join(" · ");

    return {
      id: conversation.id,
      title: conversation.advisor_name,
      hint,
      href: `/settings/messages/${conversation.id}`,
      meta:
        conversation.unread_count > 0 ? (
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
            {conversation.unread_count} unread
          </span>
        ) : (
          format(
            new Date(conversation.last_message_at || conversation.created_at),
            "MMM d"
          )
        ),
    };
  });

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Statement
        eyebrow="THE NETWORK · MESSAGES"
        headline="Where you talk to your advisors."
      >
        {totalUnread > 0 && (
          <BigNumber value={totalUnread} label="UNREAD" size="display" tone="room" />
        )}
      </Statement>

      <div className="mt-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
              Loading
            </span>
          </div>
        ) : conversations.length === 0 ? (
          <div className="py-12">
            <p className="text-sm text-studio-dim">
              No messages yet. Your conversations with advisors appear here.
            </p>
            <Link
              href="/settings/"
              className="mt-2 inline-block font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent hover:underline"
            >
              Invite an advisor
            </Link>
          </div>
        ) : (
          <FactList items={items} />
        )}
      </div>
    </div>
  );
}
