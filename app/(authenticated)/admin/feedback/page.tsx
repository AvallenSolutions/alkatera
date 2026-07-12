"use client";

import { useState, useEffect } from "react";
import { Panel } from "@/components/studio/panel";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  MessageSquare,
  Bug,
  Lightbulb,
  TrendingUp,
  Search,
  Building2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
} from "lucide-react";
import { Eyebrow } from "@/components/studio/eyebrow";
import { BigNumber } from "@/components/studio/big-number";
import { StateChip } from "@/components/studio/state-chip";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { fetchAllTickets, getTicketStats } from "@/lib/feedback";
import type {
  FeedbackTicketWithUser,
  FeedbackCategory,
  FeedbackStatus,
} from "@/lib/types/feedback";
import { FEEDBACK_STATUSES, FEEDBACK_PRIORITIES } from "@/lib/types/feedback";
import { format } from "date-fns";
import Link from "next/link";
import { supabase } from "@/lib/supabaseClient";

const categoryIcons: Record<FeedbackCategory, React.ElementType> = {
  bug: Bug,
  feature: Lightbulb,
  improvement: TrendingUp,
  other: MessageSquare,
};

const categoryLabels: Record<FeedbackCategory, string> = {
  bug: "Bug",
  feature: "Feature",
  improvement: "Improvement",
  other: "Other",
};

const statusTones: Record<FeedbackStatus, "good" | "attention" | "stale" | "hold" | "quiet"> = {
  open: "attention",
  in_progress: "hold",
  resolved: "good",
  closed: "quiet",
};

function StatusChip({ status }: { status: FeedbackStatus }) {
  const config = FEEDBACK_STATUSES[status];

  return <StateChip tone={statusTones[status]}>{config.label}</StateChip>;
}

function PriorityChip({ priority }: { priority: string }) {
  const config = FEEDBACK_PRIORITIES[priority as keyof typeof FEEDBACK_PRIORITIES];
  if (!config) return null;

  const toneByColor: Record<string, "good" | "attention" | "stale" | "hold" | "quiet"> = {
    slate: "quiet",
    blue: "quiet",
    amber: "attention",
    red: "stale",
  };

  return <StateChip tone={toneByColor[config.color]}>{config.label}</StateChip>;
}

const ITEMS_PER_PAGE = 20;

export default function AdminFeedbackPage() {
  const { isAlkateraAdmin, isLoading: isAdminLoading } = useIsAlkateraAdmin();
  const [tickets, setTickets] = useState<FeedbackTicketWithUser[]>([]);
  const [filteredTickets, setFilteredTickets] = useState<FeedbackTicketWithUser[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [stats, setStats] = useState({
    total: 0,
    open: 0,
    inProgress: 0,
    resolved: 0,
    bugs: 0,
    features: 0,
    unreadMessages: 0,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  // Calculate pagination
  const totalPages = Math.ceil(filteredTickets.length / ITEMS_PER_PAGE);
  const paginatedTickets = filteredTickets.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    if (isAlkateraAdmin) {
      loadData();
      const cleanup = setupRealtimeSubscription();
      return cleanup;
    }
  }, [isAlkateraAdmin]);

  useEffect(() => {
    filterTickets();
    setCurrentPage(1); // Reset to page 1 when filters change
  }, [tickets, activeTab, searchQuery, categoryFilter]);

  function setupRealtimeSubscription() {
    const channel = supabase
      .channel("admin-feedback")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feedback_tickets",
        },
        () => {
          loadData();
        }
      )
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "feedback_messages",
        },
        () => {
          loadData();
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }

  async function loadData() {
    setIsLoading(true);
    try {
      const [ticketsData, statsData] = await Promise.all([
        fetchAllTickets(),
        getTicketStats(),
      ]);
      setTickets(ticketsData);
      setStats(statsData);
    } catch (error) {
      console.error("Error loading feedback data:", error);
    } finally {
      setIsLoading(false);
    }
  }

  function filterTickets() {
    let filtered = [...tickets];

    // Tab filter
    if (activeTab === "open") {
      filtered = filtered.filter((t) => t.status === "open");
    } else if (activeTab === "in_progress") {
      filtered = filtered.filter((t) => t.status === "in_progress");
    } else if (activeTab === "resolved") {
      filtered = filtered.filter((t) => t.status === "resolved" || t.status === "closed");
    } else if (activeTab === "unread") {
      filtered = filtered.filter((t) => t.unread_user_messages > 0);
    }

    // Category filter
    if (categoryFilter !== "all") {
      filtered = filtered.filter((t) => t.category === categoryFilter);
    }

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (t) =>
          t.title.toLowerCase().includes(query) ||
          t.description.toLowerCase().includes(query) ||
          t.creator_name?.toLowerCase().includes(query) ||
          t.creator_email?.toLowerCase().includes(query) ||
          t.organization_name?.toLowerCase().includes(query)
      );
    }

    setFilteredTickets(filtered);
  }

  if (isAdminLoading) {
    return (
      <div className="container mx-auto py-8 px-4">
        <div className="flex items-center justify-center py-12">
          <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Loading.</p>
        </div>
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="container mx-auto py-8 px-4">
        <Panel>
          <div className="py-12 text-center">
            <h3 className="text-lg font-medium mb-2">Access Denied</h3>
            <p className="text-muted-foreground">
              You do not have permission to access this page.
            </p>
          </div>
        </Panel>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <header className="mb-8">
        <Eyebrow className="mb-3">THE WIRING · ADMIN</Eyebrow>
        <h1 className="font-display text-4xl font-bold leading-[0.95] tracking-[-0.035em] text-foreground">
          The feedback.
        </h1>
        <p className="text-muted-foreground mt-2 text-sm">
          Manage user feedback, bug reports, and feature requests
        </p>
      </header>

      {/* Stats */}
      <div className="rounded-[6px] border border-border bg-card p-6 mb-8">
        <div className="flex flex-wrap gap-x-12 gap-y-6">
          <BigNumber value={stats.total} label="TOTAL" />
          <BigNumber value={stats.open} label="OPEN" tone="attention" />
          <BigNumber value={stats.inProgress} label="IN PROGRESS" tone="hold" />
          <BigNumber value={stats.resolved} label="RESOLVED" tone="good" />
          <BigNumber value={stats.bugs} label="BUGS" />
          <BigNumber value={stats.features} label="FEATURES" />
          <BigNumber value={stats.unreadMessages} label="UNREAD" tone={stats.unreadMessages > 0 ? "stale" : "ink"} />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search tickets, users, organizations..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-full sm:w-48">
            <SelectValue placeholder="Category" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Categories</SelectItem>
            <SelectItem value="bug">Bug Reports</SelectItem>
            <SelectItem value="feature">Feature Requests</SelectItem>
            <SelectItem value="improvement">Improvements</SelectItem>
            <SelectItem value="other">Other</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="mb-4">
          <TabsTrigger value="all">All ({tickets.length})</TabsTrigger>
          <TabsTrigger value="open">Open ({stats.open})</TabsTrigger>
          <TabsTrigger value="in_progress">In Progress ({stats.inProgress})</TabsTrigger>
          <TabsTrigger value="resolved">Resolved ({stats.resolved})</TabsTrigger>
          <TabsTrigger value="unread">
            Unread
            {stats.unreadMessages > 0 && (
              <StateChip tone="stale" className="ml-2">
                {stats.unreadMessages}
              </StateChip>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <p className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground">Loading.</p>
            </div>
          ) : filteredTickets.length === 0 ? (
            <Panel>
              <div className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No tickets found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || categoryFilter !== "all"
                    ? "Try adjusting your filters."
                    : "No feedback tickets in this category."}
                </p>
              </div>
            </Panel>
          ) : (
            <Panel flush>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Ticket</TableHead>
                    <TableHead>User</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Priority</TableHead>
                    <TableHead>Created</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedTickets.map((ticket) => {
                    const Icon = categoryIcons[ticket.category];
                    return (
                      <TableRow key={ticket.id}>
                        <TableCell>
                          <div className="flex items-start gap-3">
                            <div className="h-8 w-8 rounded bg-muted flex items-center justify-center flex-shrink-0">
                              <Icon className="h-4 w-4 text-muted-foreground" />
                            </div>
                            <div className="min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="font-medium truncate max-w-[200px]">
                                  {ticket.title}
                                </span>
                                <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                  {categoryLabels[ticket.category]}
                                </span>
                                {ticket.unread_user_messages > 0 && (
                                  <StateChip tone="stale">
                                    {ticket.unread_user_messages} new
                                  </StateChip>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground truncate max-w-[300px]">
                                {ticket.description}
                              </p>
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-sm">
                            <div className="font-medium">
                              {ticket.creator_name || "Unknown"}
                            </div>
                            <div className="text-xs text-muted-foreground flex items-center gap-1">
                              <Building2 className="h-3 w-3" />
                              {ticket.organization_name || "No org"}
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          <StatusChip status={ticket.status} />
                        </TableCell>
                        <TableCell>
                          <PriorityChip priority={ticket.priority} />
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div>
                              <div className="text-sm text-muted-foreground">
                                {format(new Date(ticket.created_at), "MMM d")}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {format(new Date(ticket.created_at), "h:mm a")}
                              </div>
                            </div>
                            {/* Days open indicator for old tickets */}
                            {ticket.status !== "resolved" && ticket.status !== "closed" && (() => {
                              const daysOpen = Math.floor(
                                (Date.now() - new Date(ticket.created_at).getTime()) / (1000 * 60 * 60 * 24)
                              );
                              if (daysOpen >= 14) {
                                return (
                                  <StateChip tone="stale">{daysOpen}d</StateChip>
                                );
                              } else if (daysOpen >= 7) {
                                return (
                                  <StateChip tone="attention">{daysOpen}d</StateChip>
                                );
                              }
                              return null;
                            })()}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Link href={`/admin/feedback/${ticket.id}`}>
                            <Button variant="ghost" size="sm">
                              View
                              <ExternalLink className="h-3 w-3 ml-1" />
                            </Button>
                          </Link>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>

              {/* Pagination Controls */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-4 py-3 border-t">
                  <div className="text-sm text-muted-foreground">
                    Showing {(currentPage - 1) * ITEMS_PER_PAGE + 1} to{" "}
                    {Math.min(currentPage * ITEMS_PER_PAGE, filteredTickets.length)} of{" "}
                    {filteredTickets.length} tickets
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let pageNum: number;
                        if (totalPages <= 5) {
                          pageNum = i + 1;
                        } else if (currentPage <= 3) {
                          pageNum = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          pageNum = totalPages - 4 + i;
                        } else {
                          pageNum = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={pageNum}
                            variant={currentPage === pageNum ? "default" : "outline"}
                            size="sm"
                            className="w-8 h-8 p-0"
                            onClick={() => setCurrentPage(pageNum)}
                          >
                            {pageNum}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}
            </Panel>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
