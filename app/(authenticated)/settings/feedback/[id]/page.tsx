"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Paperclip, ExternalLink } from "lucide-react";
import { Statement, Eyebrow, StateChip } from "@/components/studio";
import { Thread, useRealtimeThread } from "@/components/network";
import {
  fetchTicket,
  fetchMessages,
  createMessage,
  markMessagesAsRead,
  getAttachmentUrl,
} from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import type {
  FeedbackTicket,
  FeedbackMessageWithSender,
  FeedbackCategory,
  FeedbackStatus,
} from "@/lib/types/feedback";
import { FEEDBACK_STATUSES } from "@/lib/types/feedback";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";

const categoryLabels: Record<FeedbackCategory, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  improvement: "Improvement",
  other: "Other",
};

const statusTones: Record<FeedbackStatus, "attention" | "hold" | "good" | "quiet"> = {
  open: "attention",
  in_progress: "hold",
  resolved: "good",
  closed: "quiet",
};

export default function TicketDetailPage() {
  const params = useParams();
  const { toast } = useToast();

  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [messages, setMessages] = useState<FeedbackMessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isSending, setIsSending] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const ticketId = params.id as string;

  useEffect(() => {
    loadData();
    getCurrentUser();
  }, [ticketId]);

  useEffect(() => {
    // Mark admin messages as read when viewing
    if (ticket && messages.length > 0) {
      markMessagesAsRead(ticketId, false);
    }
  }, [messages]);

  useRealtimeThread({
    channelName: `ticket-${ticketId}`,
    table: "feedback_messages",
    filterColumn: "ticket_id",
    filterValue: ticketId,
    onInsert: loadMessages,
  });

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [ticketData, messagesData] = await Promise.all([
        fetchTicket(ticketId),
        fetchMessages(ticketId),
      ]);
      setTicket(ticketData);
      setMessages(messagesData);
    } catch (error) {
      console.error("Error loading ticket:", error);
      toast({
        title: "Error",
        description: "Failed to load ticket details",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }

  async function loadMessages() {
    try {
      const messagesData = await fetchMessages(ticketId);
      setMessages(messagesData);
    } catch (error) {
      console.error("Error loading messages:", error);
    }
  }

  async function sendMessage(text: string) {
    setIsSending(true);
    try {
      await createMessage({
        ticket_id: ticketId,
        message: text,
        is_admin_reply: false,
      });
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

  if (!ticket) {
    return (
      <div className="container mx-auto max-w-4xl px-4 py-8">
        <p className="text-sm text-studio-dim">Ticket not found.</p>
        <Link
          href="/settings/feedback"
          className="mt-2 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent hover:underline"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to support
        </Link>
      </div>
    );
  }

  const isResolved = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="container mx-auto max-w-4xl px-4 py-8">
      <Link
        href="/settings/feedback"
        className="mb-6 inline-flex items-center gap-2 font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors hover:text-foreground"
      >
        <ArrowLeft className="h-3.5 w-3.5" />
        Back to support
      </Link>

      <Statement eyebrow="THE NETWORK · SUPPORT" headline={ticket.title} />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <StateChip tone="quiet">{categoryLabels[ticket.category]}</StateChip>
        <StateChip tone={statusTones[ticket.status]}>
          {FEEDBACK_STATUSES[ticket.status].label}
        </StateChip>
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-studio-dim">
          {format(new Date(ticket.created_at), "MMM d 'at' h:mm a")}
        </span>
      </div>

      <p className="mt-6 whitespace-pre-wrap text-sm text-foreground">
        {ticket.description}
      </p>

      {ticket.attachments && ticket.attachments.length > 0 && (
        <div className="mt-8">
          <Eyebrow tone="dim" className="mb-3">
            Attachments
          </Eyebrow>
          <div className="flex flex-wrap gap-2">
            {ticket.attachments.map((attachment, index) => (
              <AttachmentPreview key={index} attachment={attachment} />
            ))}
          </div>
        </div>
      )}

      {ticket.resolution_notes && (
        <div className="mt-8">
          <Eyebrow tone="dim" className="mb-3">
            Resolution
          </Eyebrow>
          <p className="text-sm text-studio-good">{ticket.resolution_notes}</p>
        </div>
      )}

      <div className="mt-10">
        <Eyebrow tone="dim" className="mb-4">
          Conversation
        </Eyebrow>
        <Thread
          messages={messages}
          currentUserId={currentUserId}
          isOwn={(m) => m.sender_id === currentUserId}
          keyFor={(m) => m.id}
          bubblePropsFor={(m) => ({
            senderName: m.is_admin_reply
              ? "alkatera Support"
              : m.sender_name || "You",
            senderAvatarUrl: m.sender_avatar_url,
            body: m.message,
            createdAt: m.created_at,
            badge: m.is_admin_reply ? (
              <StateChip tone="quiet">Staff</StateChip>
            ) : undefined,
          })}
          onSend={sendMessage}
          isSending={isSending}
          resolved={isResolved}
        />

        {isResolved && (
          <p className="mt-4 text-sm text-studio-good">
            This ticket has been resolved. Need more help?{" "}
            <Link
              href="/settings/feedback"
              className="text-room-accent hover:underline"
            >
              Submit a new ticket
            </Link>
            .
          </p>
        )}
      </div>
    </div>
  );
}

function AttachmentPreview({ attachment }: { attachment: any }) {
  const [url, setUrl] = useState<string | null>(null);

  useEffect(() => {
    async function loadUrl() {
      if (attachment.path) {
        const signedUrl = await getAttachmentUrl(attachment.path);
        setUrl(signedUrl);
      } else if (attachment.url) {
        setUrl(attachment.url);
      }
    }
    loadUrl();
  }, [attachment]);

  const isImage = attachment.type?.startsWith("image/");

  if (!url) {
    return (
      <div className="flex h-20 w-20 items-center justify-center rounded-[6px] border border-studio-hairline bg-studio-cream">
        <span className="font-mono text-[9px] uppercase tracking-[0.18em] text-studio-dim">
          ...
        </span>
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.name}
          className="h-20 w-20 rounded-[6px] border border-studio-hairline object-cover transition-opacity hover:opacity-80"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-[6px] border border-studio-hairline px-3 py-2 transition-colors hover:bg-studio-cream"
    >
      <Paperclip className="h-4 w-4 text-studio-dim" />
      <span className="max-w-[150px] truncate text-sm text-foreground">
        {attachment.name}
      </span>
      <ExternalLink className="h-3 w-3 text-studio-dim" />
    </a>
  );
}
