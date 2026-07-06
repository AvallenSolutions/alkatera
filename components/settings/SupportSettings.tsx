"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  Plus,
  Clock,
  ChevronRight,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import { StateChip } from "@/components/studio/state-chip";
import { fetchUserTickets } from "@/lib/feedback";
import { cn } from "@/lib/utils";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import type { FeedbackTicket, FeedbackCategory, FeedbackStatus } from "@/lib/types/feedback";
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

const STATUS_TONES: Record<string, "good" | "attention" | "stale" | "hold" | "quiet"> = {
  blue: "hold",
  amber: "attention",
  green: "good",
  slate: "quiet",
};

function StatusBadge({ status }: { status: FeedbackStatus }) {
  const config = FEEDBACK_STATUSES[status];

  return <StateChip tone={STATUS_TONES[config.color] ?? "quiet"}>{config.label}</StateChip>;
}

function PriorityBadge({ priority }: { priority: string }) {
  const config = FEEDBACK_PRIORITIES[priority as keyof typeof FEEDBACK_PRIORITIES];
  if (!config) return null;

  const priorityTones: Record<string, "good" | "attention" | "stale" | "hold" | "quiet"> = {
    slate: "quiet",
    blue: "hold",
    amber: "attention",
    red: "stale",
  };

  return <StateChip tone={priorityTones[config.color] ?? "quiet"}>{config.label}</StateChip>;
}

interface SupportSettingsProps {
  showHeader?: boolean;
}

export function SupportSettings({ showHeader = true }: SupportSettingsProps) {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [unreadByTicket, setUnreadByTicket] = useState<Record<string, number>>({});
  const [totalUnread, setTotalUnread] = useState(0);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    setIsLoading(true);
    try {
      const data = await fetchUserTickets();
      setTickets(data);

      // Load unread admin reply counts per ticket
      if (data.length > 0) {
        const ticketIds = data.map((t) => t.id);
        const { data: unreadMessages } = await supabase
          .from('feedback_messages')
          .select('ticket_id')
          .in('ticket_id', ticketIds)
          .eq('is_admin_reply', true)
          .eq('is_read', false);

        const counts: Record<string, number> = {};
        let total = 0;
        for (const msg of (unreadMessages || [])) {
          counts[msg.ticket_id] = (counts[msg.ticket_id] || 0) + 1;
          total++;
        }
        setUnreadByTicket(counts);
        setTotalUnread(total);
      }
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");

  return (
    <div className={showHeader ? "container mx-auto py-8 px-4 max-w-4xl" : ""}>
      {/* Header */}
      {showHeader ? (
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              Feedback & Support
              {totalUnread > 0 && (
                <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                  {totalUnread} new {totalUnread === 1 ? 'reply' : 'replies'}
                </Badge>
              )}
            </h1>
            <p className="text-muted-foreground">
              View your submitted feedback and bug reports
            </p>
          </div>
          <FeedbackDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Feedback
              </Button>
            }
          />
        </div>
      ) : (
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            {totalUnread > 0 && (
              <Badge className="bg-red-500 text-white text-xs px-1.5 py-0">
                {totalUnread} new {totalUnread === 1 ? 'reply' : 'replies'}
              </Badge>
            )}
          </div>
          <FeedbackDialog
            trigger={
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                New Feedback
              </Button>
            }
          />
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">
            Loading
          </span>
        </div>
      ) : tickets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No feedback yet</h3>
            <p className="text-muted-foreground mb-6">
              Have a bug to report or a feature to suggest? We&apos;d love to hear from you!
            </p>
            <FeedbackDialog
              trigger={
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Submit Feedback
                </Button>
              }
            />
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-8">
          {/* Open Tickets */}
          {openTickets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <AlertCircle className="h-5 w-5 text-amber-500" />
                Active ({openTickets.length})
              </h2>
              <div className="space-y-3">
                {openTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} unreadCount={unreadByTicket[ticket.id] || 0} />
                ))}
              </div>
            </div>
          )}

          {/* Resolved Tickets */}
          {resolvedTickets.length > 0 && (
            <div>
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-500" />
                Resolved ({resolvedTickets.length})
              </h2>
              <div className="space-y-3">
                {resolvedTickets.map((ticket) => (
                  <TicketCard key={ticket.id} ticket={ticket} unreadCount={unreadByTicket[ticket.id] || 0} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket, unreadCount = 0 }: { ticket: FeedbackTicket; unreadCount?: number }) {
  const Icon = categoryIcons[ticket.category];

  return (
    <Link href={`/settings/feedback/${ticket.id}`}>
      <Card className={cn(
        "hover:bg-muted/50 transition-colors cursor-pointer",
        unreadCount > 0 && "ring-1 ring-lime-500/30 bg-lime-500/5"
      )}>
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0 relative">
              <Icon className="h-5 w-5 text-muted-foreground" />
              {unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[9px] font-bold text-white">
                  {unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{ticket.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[ticket.category]}
                </Badge>
                {unreadCount > 0 && (
                  <Badge className="bg-lime-500 text-black text-[10px] px-1.5 py-0">
                    New reply
                  </Badge>
                )}
              </div>
              <p className="text-sm text-muted-foreground line-clamp-1 mb-2">
                {ticket.description}
              </p>
              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <Clock className="h-3 w-3" />
                  {format(new Date(ticket.created_at), "MMM d, yyyy")}
                </span>
                <StatusBadge status={ticket.status} />
                {ticket.priority && ticket.priority !== "medium" && (
                  <PriorityBadge priority={ticket.priority} />
                )}
              </div>
            </div>
            <ChevronRight className="h-5 w-5 text-muted-foreground flex-shrink-0" />
          </div>
        </CardContent>
      </Card>
    </Link>
  );
}
