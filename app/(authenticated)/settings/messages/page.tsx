"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  MessageSquare,
  Plus,
  Loader2,
  Clock,
  ChevronRight,
  Users,
  Inbox,
} from "lucide-react";
import { useOrganization } from "@/lib/organizationContext";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { format } from "date-fns";
import { cn } from "@/lib/utils";

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

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Users className="h-6 w-6" />
            Advisor Messages
            {totalUnread > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                {totalUnread} unread
              </Badge>
            )}
          </h1>
          <p className="text-muted-foreground">
            Communicate with your sustainability advisors
          </p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : conversations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Inbox className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No messages yet</h3>
            <p className="text-muted-foreground mb-2">
              Messages with your advisors will appear here.
            </p>
            <p className="text-sm text-muted-foreground">
              Invite an advisor from{" "}
              <Link
                href="/settings/"
                className="text-primary hover:underline"
              >
                Settings → Team
              </Link>{" "}
              to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {conversations.map((conversation) => (
            <ConversationCard
              key={conversation.id}
              conversation={conversation}
              currentUserId={user?.id || null}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ConversationCard({
  conversation,
  currentUserId,
}: {
  conversation: AdvisorConversation;
  currentUserId: string | null;
}) {
  const isLastMessageFromMe =
    conversation.last_message_sender_id === currentUserId;

  const messagePreview = conversation.last_message
    ? conversation.last_message.length > 100
      ? conversation.last_message.slice(0, 100) + "..."
      : conversation.last_message
    : "No messages yet";

  return (
    <Link href={`/settings/messages/${conversation.id}`}>
      <Card
        className={cn(
          "hover:bg-muted/50 transition-colors cursor-pointer",
          conversation.unread_count > 0 && "ring-1 ring-lime-500/30 bg-lime-500/5"
        )}
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="relative">
              <Avatar className="h-10 w-10">
                <AvatarImage src={conversation.advisor_avatar_url || undefined} />
                <AvatarFallback>
                  {conversation.advisor_name?.charAt(0) || "A"}
                </AvatarFallback>
              </Avatar>
              {conversation.unread_count > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {conversation.unread_count}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">
                  {conversation.advisor_name}
                </h3>
                {conversation.unread_count > 0 && (
                  <Badge className="bg-lime-500 text-black text-[10px] px-1.5 py-0">
                    New
                  </Badge>
                )}
              </div>
              {conversation.subject && (
                <p className="text-sm font-medium text-muted-foreground truncate mb-0.5">
                  {conversation.subject}
                </p>
              )}
              <p className="text-sm text-muted-foreground line-clamp-1">
                {isLastMessageFromMe ? "You: " : ""}
                {messagePreview}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-2">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(
                    new Date(conversation.last_message_at || conversation.created_at),
                    "MMM d, yyyy"
                  )}
                </span>
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0 mt-2" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
