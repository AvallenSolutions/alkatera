"use client";

import { useState, useEffect, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  ArrowLeft,
  Bug,
  Lightbulb,
  TrendingUp,
  MessageSquare,
  Clock,
  Send,
  Loader2,
  CheckCircle,
  AlertCircle,
  Circle,
  Paperclip,
  Image as ImageIcon,
  ExternalLink,
} from "lucide-react";
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

const categoryIcons: Record<FeedbackCategory, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
  improvement: TrendingUp,
  other: MessageSquare,
};

const categoryLabels: Record<FeedbackCategory, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  improvement: "Improvement",
  other: "Other",
};

const statusIcons: Record<FeedbackStatus, React.ElementType> = {
  open: Circle,
  in_progress: AlertCircle,
  resolved: CheckCircle,
  closed: CheckCircle,
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const config = FEEDBACK_STATUSES[status];
  const Icon = statusIcons[status];

  const colorClasses: Record<string, string> = {
    blue: "bg-blue-500/20 text-blue-400 border-blue-500/30",
    amber: "bg-amber-500/20 text-amber-400 border-amber-500/30",
    green: "bg-green-500/20 text-green-400 border-green-500/30",
    slate: "bg-slate-500/20 text-slate-400 border-slate-500/30",
  };

  return (
    <Badge className={colorClasses[config.color]}>
      <Icon className="h-3 w-3 mr-1" />
      {config.label}
    </Badge>
  );
}

export default function TicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [ticket, setTicket] = useState<FeedbackTicket | null>(null);
  const [messages, setMessages] = useState<FeedbackMessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
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

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Set up realtime subscription for new messages
    const channel = supabase
      .channel(`ticket-${ticketId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback_messages",
          filter: `ticket_id=eq.${ticketId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [ticketId]);

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

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      await createMessage({
        ticket_id: ticketId,
        message: newMessage.trim(),
        is_admin_reply: false,
      });
      setNewMessage("");
      await loadMessages();
    } catch (error) {
      console.error("Error sending message:", error);
      toast({
        title: "Error",
        description: "Failed to send message",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
    }
  }

  if (isLoading) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto py-8 px-4 max-w-4xl">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Ticket not found</h3>
            <Link href="/settings/feedback">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Feedback
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = categoryIcons[ticket.category];
  const isResolved = ticket.status === "resolved" || ticket.status === "closed";

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/settings/feedback">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Feedback
          </Button>
        </Link>

        <Card>
          <CardHeader>
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                <Icon className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2">
                  <CardTitle className="text-xl">{ticket.title}</CardTitle>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <Badge variant="outline">{categoryLabels[ticket.category]}</Badge>
                  <StatusBadge status={ticket.status} />
                  <span className="text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </span>
                </div>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground whitespace-pre-wrap">{ticket.description}</p>

            {/* Attachments */}
            {ticket.attachments && ticket.attachments.length > 0 && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Paperclip className="h-4 w-4" />
                  Attachments
                </h4>
                <div className="flex flex-wrap gap-2">
                  {ticket.attachments.map((attachment, index) => (
                    <AttachmentPreview key={index} attachment={attachment} />
                  ))}
                </div>
              </div>
            )}

            {/* Resolution Notes */}
            {ticket.resolution_notes && (
              <div className="mt-4 pt-4 border-t">
                <h4 className="text-sm font-medium mb-2 flex items-center gap-2 text-green-600">
                  <CheckCircle className="h-4 w-4" />
                  Resolution
                </h4>
                <p className="text-sm text-muted-foreground">{ticket.resolution_notes}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold">Conversation</h3>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start a conversation below.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.sender_id === currentUserId}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Form */}
      {!isResolved && (
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSendMessage} className="space-y-3">
              <Textarea
                placeholder="Type your message..."
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                rows={3}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={isSending || !newMessage.trim()}>
                  {isSending ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4 mr-2" />
                  )}
                  Send Message
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {isResolved && (
        <Card>
          <CardContent className="py-6 text-center text-muted-foreground">
            <CheckCircle className="h-8 w-8 mx-auto mb-2 text-green-500" />
            <p>This ticket has been resolved.</p>
            <p className="text-sm mt-1">
              Need more help?{" "}
              <Link href="/settings/feedback" className="text-primary hover:underline">
                Submit a new ticket
              </Link>
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function MessageBubble({
  message,
  isOwnMessage,
}: {
  message: FeedbackMessageWithSender;
  isOwnMessage: boolean;
}) {
  const isAdmin = message.is_admin_reply;

  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex gap-3 max-w-[80%] ${isOwnMessage ? "flex-row-reverse" : "flex-row"}`}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender_avatar_url} />
          <AvatarFallback>
            {isAdmin ? "A" : message.sender_name?.charAt(0) || "U"}
          </AvatarFallback>
        </Avatar>
        <div>
          <div
            className={`px-4 py-2 rounded-lg ${
              isAdmin
                ? "bg-primary/10 border border-primary/20"
                : isOwnMessage
                ? "bg-muted"
                : "bg-muted"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">
                {isAdmin ? "Alkatera Support" : message.sender_name || "You"}
              </span>
              {isAdmin && (
                <Badge variant="secondary" className="text-xs">
                  Staff
                </Badge>
              )}
            </div>
            <p className="text-sm whitespace-pre-wrap">{message.message}</p>
          </div>
          <p className="text-xs text-muted-foreground mt-1 px-1">
            {format(new Date(message.created_at), "MMM d 'at' h:mm a")}
          </p>
        </div>
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
      <div className="w-20 h-20 rounded-lg bg-muted flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin" />
      </div>
    );
  }

  if (isImage) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className="block">
        <img
          src={url}
          alt={attachment.name}
          className="w-20 h-20 object-cover rounded-lg border hover:opacity-80 transition-opacity"
        />
      </a>
    );
  }

  return (
    <a
      href={url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 px-3 py-2 rounded-lg border hover:bg-muted transition-colors"
    >
      <Paperclip className="h-4 w-4" />
      <span className="text-sm truncate max-w-[150px]">{attachment.name}</span>
      <ExternalLink className="h-3 w-3" />
    </a>
  );
}
