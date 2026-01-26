"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
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
  Loader2,
  CheckCircle,
  AlertCircle,
  Circle,
} from "lucide-react";
import { fetchUserTickets } from "@/lib/feedback";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import type { FeedbackTicket, FeedbackCategory, FeedbackStatus } from "@/lib/types/feedback";
import { FEEDBACK_STATUSES, FEEDBACK_PRIORITIES } from "@/lib/types/feedback";
import { format } from "date-fns";

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

function PriorityBadge({ priority }: { priority: string }) {
  const config = FEEDBACK_PRIORITIES[priority as keyof typeof FEEDBACK_PRIORITIES];
  if (!config) return null;

  const colorClasses: Record<string, string> = {
    slate: "bg-slate-500/10 text-slate-400 border-slate-500/20",
    blue: "bg-blue-500/10 text-blue-400 border-blue-500/20",
    amber: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    red: "bg-red-500/10 text-red-400 border-red-500/20",
  };

  return (
    <Badge variant="outline" className={colorClasses[config.color]}>
      {config.label}
    </Badge>
  );
}

export default function FeedbackPage() {
  const [tickets, setTickets] = useState<FeedbackTicket[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadTickets();
  }, []);

  async function loadTickets() {
    setIsLoading(true);
    try {
      const data = await fetchUserTickets();
      setTickets(data);
    } catch (error) {
      console.error("Error loading tickets:", error);
    } finally {
      setIsLoading(false);
    }
  }

  const openTickets = tickets.filter((t) => t.status === "open" || t.status === "in_progress");
  const resolvedTickets = tickets.filter((t) => t.status === "resolved" || t.status === "closed");

  return (
    <div className="container mx-auto py-8 px-4 max-w-4xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold">Feedback & Support</h1>
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

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
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
                  <TicketCard key={ticket.id} ticket={ticket} />
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
                  <TicketCard key={ticket.id} ticket={ticket} />
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function TicketCard({ ticket }: { ticket: FeedbackTicket }) {
  const Icon = categoryIcons[ticket.category];

  return (
    <Link href={`/settings/feedback/${ticket.id}`}>
      <Card className="hover:bg-muted/50 transition-colors cursor-pointer">
        <CardContent className="p-4">
          <div className="flex items-start gap-4">
            <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
              <Icon className="h-5 w-5 text-muted-foreground" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <h3 className="font-medium truncate">{ticket.title}</h3>
                <Badge variant="outline" className="text-xs">
                  {categoryLabels[ticket.category]}
                </Badge>
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
