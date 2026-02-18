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
  Clock,
  Send,
  Loader2,
  MessageSquare,
  Users,
} from "lucide-react";
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

interface ConversationDetail {
  id: string;
  organization_id: string;
  advisor_user_id: string;
  subject: string;
  status: string;
  created_by: string;
  created_at: string;
}

export default function ConversationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { user } = useAuth();
  const { toast } = useToast();
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const [messages, setMessages] = useState<ConversationMessage[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [newMessage, setNewMessage] = useState("");
  const [isSending, setIsSending] = useState(false);
  const [conversationSubject, setConversationSubject] = useState("");

  const conversationId = params.id as string;

  useEffect(() => {
    loadMessages();
  }, [conversationId]);

  useEffect(() => {
    // Scroll to bottom when new messages arrive
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  useEffect(() => {
    // Mark messages as read when viewing
    if (messages.length > 0 && user) {
      markAsRead();
    }
  }, [messages, user]);

  useEffect(() => {
    // Set up realtime subscription for new messages
    const channel = supabase
      .channel(`advisor-conv-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "advisor_messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        () => {
          loadMessages();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [conversationId]);

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

      // Extract subject from conversation if available
      // The first load might not have conversation info in the messages endpoint,
      // so we fetch it separately
      if (!conversationSubject) {
        fetchConversationDetails(session.access_token);
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

  async function fetchConversationDetails(token: string) {
    try {
      // Fetch conversation info from DB directly using supabase client
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

  async function handleSendMessage(e: React.FormEvent) {
    e.preventDefault();

    if (!newMessage.trim()) return;

    setIsSending(true);
    try {
      const session = await getSession();
      if (!session) return;

      const response = await fetch("/api/advisor-messages", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "send_message",
          conversation_id: conversationId,
          message: newMessage.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Failed to send message");
      }

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

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="mb-6">
        <Link href="/settings/messages">
          <Button variant="ghost" size="sm" className="mb-4">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Messages
          </Button>
        </Link>

        {conversationSubject && (
          <Card className="mb-6">
            <CardHeader className="py-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                  <Users className="h-5 w-5 text-muted-foreground" />
                </div>
                <div>
                  <CardTitle className="text-lg">{conversationSubject}</CardTitle>
                  <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                    <Clock className="h-3 w-3" />
                    Started{" "}
                    {messages.length > 0
                      ? format(new Date(messages[0].created_at), "MMM d, yyyy")
                      : ""}
                  </p>
                </div>
              </div>
            </CardHeader>
          </Card>
        )}
      </div>

      {/* Messages */}
      <div className="space-y-4 mb-6">
        <h3 className="text-lg font-semibold">Conversation</h3>

        {messages.length === 0 ? (
          <Card>
            <CardContent className="py-8 text-center text-muted-foreground">
              <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
              <p>No messages yet. Start the conversation below.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <MessageBubble
                key={message.id}
                message={message}
                isOwnMessage={message.sender_id === user?.id}
              />
            ))}
            <div ref={messagesEndRef} />
          </div>
        )}
      </div>

      {/* Reply Form */}
      <Card>
        <CardContent className="p-4">
          <form onSubmit={handleSendMessage} className="space-y-3">
            <Textarea
              placeholder="Type your message..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              rows={3}
              onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                  handleSendMessage(e);
                }
              }}
            />
            <div className="flex items-center justify-between">
              <p className="text-xs text-muted-foreground">
                Press ⌘+Enter to send
              </p>
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
    </div>
  );
}

function MessageBubble({
  message,
  isOwnMessage,
}: {
  message: ConversationMessage;
  isOwnMessage: boolean;
}) {
  return (
    <div className={`flex ${isOwnMessage ? "justify-end" : "justify-start"}`}>
      <div
        className={`flex gap-3 max-w-[80%] ${
          isOwnMessage ? "flex-row-reverse" : "flex-row"
        }`}
      >
        <Avatar className="h-8 w-8 flex-shrink-0">
          <AvatarImage src={message.sender_avatar_url} />
          <AvatarFallback>
            {message.sender_name?.charAt(0) || "?"}
          </AvatarFallback>
        </Avatar>
        <div>
          <div
            className={`px-4 py-2 rounded-lg ${
              isOwnMessage ? "bg-muted" : "bg-primary/10 border border-primary/20"
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <span className="text-sm font-medium">
                {isOwnMessage ? "You" : message.sender_name || message.sender_email || "Unknown"}
              </span>
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
