"use client";

import { useState, useEffect, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import {
  Statement,
  BigNumber,
  Eyebrow,
  StateChip,
  FactList,
  type FactRowItem,
} from "@/components/studio";
import { fetchUserTickets } from "@/lib/feedback";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import type { FeedbackTicket, FeedbackCategory } from "@/lib/types/feedback";
import { FEEDBACK_PRIORITIES } from "@/lib/types/feedback";
import type { WorkingTone } from "@/components/studio";
import { format } from "date-fns";
import { supabase } from "@/lib/supabaseClient";

const categoryLabels: Record<FeedbackCategory, string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  improvement: "Improvement",
  other: "Other",
};

const COLOUR_TONES: Record<string, WorkingTone> = {
  blue: "hold",
  amber: "attention",
  green: "good",
  red: "stale",
  slate: "quiet",
};

function priorityChip(priority: string | null | undefined): ReactNode {
  if (!priority || priority === "medium") return null;
  const config = FEEDBACK_PRIORITIES[priority as keyof typeof FEEDBACK_PRIORITIES];
  if (!config) return null;
  return <StateChip tone={COLOUR_TONES[config.color] ?? "quiet"}>{config.label}</StateChip>;
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
          .from("feedback_messages")
          .select("ticket_id")
          .in("ticket_id", ticketIds)
          .eq("is_admin_reply", true)
          .eq("is_read", false);

        const counts: Record<string, number> = {};
        let total = 0;
        for (const msg of unreadMessages || []) {
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

  function toItems(list: FeedbackTicket[]): FactRowItem[] {
    return list.map((ticket) => {
      const unread = unreadByTicket[ticket.id] || 0;
      return {
        id: ticket.id,
        href: `/settings/feedback/${ticket.id}`,
        title: (
          <span className="inline-flex items-center gap-3">
            <span className="truncate">{ticket.title}</span>
            <StateChip tone="quiet">{categoryLabels[ticket.category]}</StateChip>
            {priorityChip(ticket.priority)}
          </span>
        ),
        hint: ticket.description,
        meta:
          unread > 0 ? (
            <span className="font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-room-accent">
              {unread} unread
            </span>
          ) : (
            format(new Date(ticket.created_at), "MMM d")
          ),
      };
    });
  }

  const newFeedbackButton = (
    <FeedbackDialog
      trigger={
        <Button>
          <Plus className="mr-2 h-4 w-4" />
          New Feedback
        </Button>
      }
    />
  );

  return (
    <div className={showHeader ? "container mx-auto max-w-4xl px-4 py-8" : ""}>
      {showHeader ? (
        <div className="mb-8 flex items-end justify-between gap-6">
          <Statement eyebrow="THE NETWORK · SUPPORT" headline="The support desk.">
            {totalUnread > 0 && (
              <BigNumber value={totalUnread} label="UNREAD" size="display" tone="room" />
            )}
          </Statement>
          {newFeedbackButton}
        </div>
      ) : (
        <div className="mb-6 flex items-center justify-between">
          <div>
            {totalUnread > 0 && (
              <StateChip tone="quiet">
                <span className="text-room-accent">{totalUnread} unread</span>
              </StateChip>
            )}
          </div>
          {newFeedbackButton}
        </div>
      )}

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <span className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-dim">
            Loading
          </span>
        </div>
      ) : tickets.length === 0 ? (
        <div className="py-12">
          <p className="text-sm text-studio-dim">
            No feedback yet. Report a bug or suggest a feature and it lands here.
          </p>
          <div className="mt-4">{newFeedbackButton}</div>
        </div>
      ) : (
        <div className="space-y-10">
          {openTickets.length > 0 && (
            <div>
              <Eyebrow tone="dim" className="mb-3">
                Active · {openTickets.length}
              </Eyebrow>
              <FactList items={toItems(openTickets)} />
            </div>
          )}

          {resolvedTickets.length > 0 && (
            <div>
              <Eyebrow tone="dim" className="mb-3">
                Resolved · {resolvedTickets.length}
              </Eyebrow>
              <FactList items={toItems(resolvedTickets)} />
            </div>
          )}
        </div>
      )}
    </div>
  );
}
