"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  Clock,
  Loader2,
  CheckCircle,
  AlertCircle,
  Circle,
  Mail,
  Building2,
  ExternalLink,
  ChevronLeft,
  ChevronRight,
  Flame,
  AlertOctagon,
} from "lucide-react";
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

  return (
    <div className="container mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-2">Feedback Dashboard</h1>
        <p className="text-muted-foreground">
          Manage user feedback, bug reports, and feature requests
        </p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4 mb-8">
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.total}</div>
            <div className="text-xs text-muted-foreground">Total</div>
          </CardContent>
        </Card>
        <Card className="border-blue-500/30 bg-blue-500/5">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-blue-500">{stats.open}</div>
            <div className="text-xs text-muted-foreground">Open</div>
          </CardContent>
        </Card>
        <Card className="border-amber-500/30 bg-amber-500/5">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-amber-500">{stats.inProgress}</div>
            <div className="text-xs text-muted-foreground">In Progress</div>
          </CardContent>
        </Card>
        <Card className="border-green-500/30 bg-green-500/5">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-green-500">{stats.resolved}</div>
            <div className="text-xs text-muted-foreground">Resolved</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.bugs}</div>
            <div className="text-xs text-muted-foreground">Bugs</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold">{stats.features}</div>
            <div className="text-xs text-muted-foreground">Features</div>
          </CardContent>
        </Card>
        <Card className="border-red-500/30 bg-red-500/5">
          <CardContent className="p-4 text-center">
            <div className="text-2xl font-bold text-red-500">{stats.unreadMessages}</div>
            <div className="text-xs text-muted-foreground">Unread</div>
          </CardContent>
        </Card>
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
              <Badge variant="destructive" className="ml-2">
                {stats.unreadMessages}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value={activeTab}>
          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : filteredTickets.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <MessageSquare className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <h3 className="text-lg font-medium mb-2">No tickets found</h3>
                <p className="text-muted-foreground">
                  {searchQuery || categoryFilter !== "all"
                    ? "Try adjusting your filters."
                    : "No feedback tickets in this category."}
                </p>
              </CardContent>
            </Card>
          ) : (
            <Card>
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
                                <Badge variant="outline" className="text-xs">
                                  {categoryLabels[ticket.category]}
                                </Badge>
                                {ticket.unread_user_messages > 0 && (
                                  <Badge variant="destructive" className="text-xs">
                                    {ticket.unread_user_messages} new
                                  </Badge>
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
                          <StatusBadge status={ticket.status} />
                        </TableCell>
                        <TableCell>
                          <PriorityBadge priority={ticket.priority} />
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
                              if (daysOpen >= 21) {
                                return (
                                  <Badge className="bg-red-500/20 text-red-400 border-red-500/30 text-xs">
                                    <Flame className="h-3 w-3 mr-1" />
                                    {daysOpen}d
                                  </Badge>
                                );
                              } else if (daysOpen >= 14) {
                                return (
                                  <Badge className="bg-orange-500/20 text-orange-400 border-orange-500/30 text-xs">
                                    <AlertOctagon className="h-3 w-3 mr-1" />
                                    {daysOpen}d
                                  </Badge>
                                );
                              } else if (daysOpen >= 7) {
                                return (
                                  <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-xs">
                                    <Clock className="h-3 w-3 mr-1" />
                                    {daysOpen}d
                                  </Badge>
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
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
