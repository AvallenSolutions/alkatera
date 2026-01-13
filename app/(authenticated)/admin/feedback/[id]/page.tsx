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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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
  ExternalLink,
  Building2,
  Mail,
  Globe,
  Monitor,
} from "lucide-react";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import {
  fetchTicketWithUser,
  fetchMessages,
  createMessage,
  updateTicket,
  markMessagesAsRead,
  getAttachmentUrl,
} from "@/lib/feedback";
import { useToast } from "@/hooks/use-toast";
import type {
  FeedbackTicketWithUser,
  FeedbackMessageWithSender,
  FeedbackCategory,
  FeedbackStatus,
} from "@/lib/types/feedback";
import { FEEDBACK_STATUSES, FEEDBACK_PRIORITIES } from "@/lib/types/feedback";
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

export default function AdminTicketDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { isAlkateraAdmin, isLoading: isAdminLoading } = useIsAlkateraAdmin();

  const [ticket, setTicket] = useState<FeedbackTicketWithUser | null>(null);
  const [messages, setMessages] = useState<FeedbackMessageWithSender[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  const ticketId = params.id as string;

  useEffect(() => {
    if (isAlkateraAdmin) {
      loadData();
      getCurrentUser();
    }
  }, [ticketId, isAlkateraAdmin]);

  useEffect(() => {
    // Mark user messages as read when admin views
    if (ticket && messages.length > 0) {
      markMessagesAsRead(ticketId, true);
    }
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    if (!isAlkateraAdmin) return;

    const channel = supabase
      .channel(`admin-ticket-${ticketId}`)
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
  }, [ticketId, isAlkateraAdmin]);

  async function getCurrentUser() {
    const { data } = await supabase.auth.getUser();
    setCurrentUserId(data.user?.id || null);
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [ticketData, messagesData] = await Promise.all([
        fetchTicketWithUser(ticketId),
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
        is_admin_reply: true,
      });
      setNewMessage("");
      await loadMessages();
      toast({
        title: "Message sent",
        description: "Your reply has been sent to the user.",
      });
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

  async function handleStatusChange(newStatus: FeedbackStatus) {
    setIsUpdating(true);
    try {
      await updateTicket(ticketId, { status: newStatus });
      setTicket((prev) => (prev ? { ...prev, status: newStatus } : prev));
      toast({
        title: "Status updated",
        description: `Ticket status changed to ${FEEDBACK_STATUSES[newStatus].label}`,
      });
    } catch (error) {
      console.error("Error updating status:", error);
      toast({
        title: "Error",
        description: "Failed to update status",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  async function handlePriorityChange(newPriority: string) {
    setIsUpdating(true);
    try {
      await updateTicket(ticketId, { priority: newPriority as any });
      setTicket((prev) => (prev ? { ...prev, priority: newPriority as any } : prev));
      toast({
        title: "Priority updated",
      });
    } catch (error) {
      console.error("Error updating priority:", error);
      toast({
        title: "Error",
        description: "Failed to update priority",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  }

  if (isAdminLoading || isLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You do not have permission to access this page.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!ticket) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Card>
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Ticket not found</h3>
            <Link href="/admin/feedback">
              <Button variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  const Icon = categoryIcons[ticket.category];
  const StatusIcon = statusIcons[ticket.status];

  return (
    <div className="container mx-auto py-8 px-4 max-w-6xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/admin/feedback">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Dashboard
          </Button>
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Ticket Info */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-start gap-4">
                <div className="h-12 w-12 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                  <Icon className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <CardTitle className="text-xl">{ticket.title}</CardTitle>
                    <Badge variant="outline">{categoryLabels[ticket.category]}</Badge>
                  </div>
                  <p className="text-sm text-muted-foreground flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {format(new Date(ticket.created_at), "MMM d, yyyy 'at' h:mm a")}
                  </p>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="text-sm font-medium mb-2">Description</h4>
                <p className="text-muted-foreground whitespace-pre-wrap">
                  {ticket.description}
                </p>
              </div>

              {/* Attachments */}
              {ticket.attachments && ticket.attachments.length > 0 && (
                <div>
                  <h4 className="text-sm font-medium mb-2 flex items-center gap-2">
                    <Paperclip className="h-4 w-4" />
                    Attachments
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {ticket.attachments.map((attachment: any, index: number) => (
                      <AttachmentPreview key={index} attachment={attachment} />
                    ))}
                  </div>
                </div>
              )}

              {/* Technical Info (for bugs) */}
              {ticket.category === "bug" && (ticket.page_url || ticket.browser_info) && (
                <div className="pt-4 border-t">
                  <h4 className="text-sm font-medium mb-3">Technical Details</h4>
                  <div className="space-y-2 text-sm">
                    {ticket.page_url && (
                      <div className="flex items-center gap-2 text-muted-foreground">
                        <Globe className="h-4 w-4" />
                        <span>Page: {ticket.page_url}</span>
                      </div>
                    )}
                    {ticket.browser_info && (
                      <div className="flex items-start gap-2 text-muted-foreground">
                        <Monitor className="h-4 w-4 mt-0.5" />
                        <pre className="text-xs bg-muted p-2 rounded overflow-x-auto max-w-full">
                          {ticket.browser_info}
                        </pre>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Sidebar */}
          <div className="space-y-4">
            {/* User Info */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Submitted By</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-3">
                  <Avatar>
                    <AvatarFallback>
                      {ticket.creator_name?.charAt(0) || "U"}
                    </AvatarFallback>
                  </Avatar>
                  <div>
                    <div className="font-medium">{ticket.creator_name || "Unknown"}</div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1">
                      <Mail className="h-3 w-3" />
                      {ticket.creator_email || "No email"}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Building2 className="h-4 w-4" />
                  {ticket.organization_name || "No organization"}
                </div>
              </CardContent>
            </Card>

            {/* Status & Priority */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">Ticket Management</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Status</label>
                  <Select
                    value={ticket.status}
                    onValueChange={handleStatusChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="open">
                        <div className="flex items-center gap-2">
                          <Circle className="h-3 w-3 text-blue-500" />
                          Open
                        </div>
                      </SelectItem>
                      <SelectItem value="in_progress">
                        <div className="flex items-center gap-2">
                          <AlertCircle className="h-3 w-3 text-amber-500" />
                          In Progress
                        </div>
                      </SelectItem>
                      <SelectItem value="resolved">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-green-500" />
                          Resolved
                        </div>
                      </SelectItem>
                      <SelectItem value="closed">
                        <div className="flex items-center gap-2">
                          <CheckCircle className="h-3 w-3 text-slate-500" />
                          Closed
                        </div>
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-sm text-muted-foreground mb-2 block">Priority</label>
                  <Select
                    value={ticket.priority}
                    onValueChange={handlePriorityChange}
                    disabled={isUpdating}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="low">Low</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="critical">Critical</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold">Conversation</h3>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Send a reply below.</p>
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

        {/* Reply Form */}
        <Card>
          <CardContent className="p-4">
            <form onSubmit={handleSendMessage} className="space-y-3">
              <Textarea
                placeholder="Type your reply to the user..."
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
                  Send Reply
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
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
    <div className={`flex ${isAdmin ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex gap-3 max-w-[80%] ${isAdmin ? "flex-row-reverse" : "flex-row"}`}
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
                : "bg-muted"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">
                {isAdmin ? "You (Support)" : message.sender_name || "User"}
              </span>
              {!isAdmin && !message.is_read && (
                <Badge variant="secondary" className="text-xs">
                  New
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
