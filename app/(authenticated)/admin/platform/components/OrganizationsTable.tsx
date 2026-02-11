"use client";

import { useState, useMemo } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
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
  Search,
  ArrowUpDown,
  ChevronDown,
  ChevronRight,
  CheckCircle,
  Clock,
  Package,
  Truck,
  Beaker,
  Calendar,
  Activity,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import type { OrganizationInfo } from "../types";

interface OrganizationsTableProps {
  organizations: OrganizationInfo[];
  loading: boolean;
}

type SortField = "name" | "created_at" | "member_count" | "product_count" | "facility_count" | "subscription_tier";
type SortDirection = "asc" | "desc";

function getTierBadgeClass(tier: string | null): string {
  switch (tier) {
    case "canopy":
      return "border-teal-500 text-teal-500";
    case "blossom":
      return "border-pink-500 text-pink-500";
    case "seed":
      return "border-emerald-500 text-emerald-500";
    default:
      return "text-xs text-gray-400";
  }
}

function getStatusVariant(status: string | null): "default" | "secondary" | "outline" | "destructive" {
  switch (status) {
    case "active":
      return "default";
    case "trial":
      return "secondary";
    case "pending":
      return "outline";
    default:
      return "destructive";
  }
}

export function OrganizationsTable({ organizations, loading }: OrganizationsTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterTier, setFilterTier] = useState("all");
  const [filterStatus, setFilterStatus] = useState("all");
  const [expandedOrgs, setExpandedOrgs] = useState<Set<string>>(new Set());

  const toggleExpand = (orgId: string) => {
    setExpandedOrgs((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(orgId)) {
        newSet.delete(orgId);
      } else {
        newSet.add(orgId);
      }
      return newSet;
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortDirection("desc");
    }
  };

  const filteredAndSorted = useMemo(() => {
    let result = [...organizations];

    // Search
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (org) =>
          org.name.toLowerCase().includes(query) ||
          org.slug.toLowerCase().includes(query)
      );
    }

    // Filter by tier
    if (filterTier !== "all") {
      if (filterTier === "none") {
        result = result.filter((org) => !org.subscription_tier);
      } else {
        result = result.filter((org) => org.subscription_tier === filterTier);
      }
    }

    // Filter by status
    if (filterStatus !== "all") {
      if (filterStatus === "none") {
        result = result.filter((org) => !org.subscription_status);
      } else {
        result = result.filter((org) => org.subscription_status === filterStatus);
      }
    }

    // Sort
    result.sort((a, b) => {
      let aVal: string | number = 0;
      let bVal: string | number = 0;

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "created_at":
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        case "member_count":
          aVal = a.member_count;
          bVal = b.member_count;
          break;
        case "product_count":
          aVal = a.product_count;
          bVal = b.product_count;
          break;
        case "facility_count":
          aVal = a.facility_count;
          bVal = b.facility_count;
          break;
        case "subscription_tier":
          aVal = a.subscription_tier || "";
          bVal = b.subscription_tier || "";
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [organizations, searchQuery, filterTier, filterStatus, sortField, sortDirection]);

  if (loading) {
    return <Skeleton className="h-96" />;
  }

  const SortableHeader = ({ field, children }: { field: SortField; children: React.ReactNode }) => (
    <TableHead>
      <button
        onClick={() => handleSort(field)}
        className="flex items-center gap-1 hover:text-foreground transition-colors"
      >
        {children}
        <ArrowUpDown className="h-3 w-3 opacity-50" />
      </button>
    </TableHead>
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Organisations</CardTitle>
        <CardDescription>
          {filteredAndSorted.length} of {organizations.length} organisations
          {searchQuery || filterTier !== "all" || filterStatus !== "all" ? " (filtered)" : ""}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Search and filters */}
        <div className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search by name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select value={filterTier} onValueChange={setFilterTier}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder="Tier" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Tiers</SelectItem>
              <SelectItem value="seed">Seed</SelectItem>
              <SelectItem value="blossom">Blossom</SelectItem>
              <SelectItem value="canopy">Canopy</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
          <Select value={filterStatus} onValueChange={setFilterStatus}>
            <SelectTrigger className="w-[150px]">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Statuses</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="trial">Trial</SelectItem>
              <SelectItem value="pending">Pending</SelectItem>
              <SelectItem value="suspended">Suspended</SelectItem>
              <SelectItem value="cancelled">Cancelled</SelectItem>
              <SelectItem value="none">None</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Table */}
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8" />
              <SortableHeader field="name">Organisation</SortableHeader>
              <SortableHeader field="subscription_tier">Tier</SortableHeader>
              <TableHead>Status</TableHead>
              <SortableHeader field="member_count">
                <span className="text-right w-full">Members</span>
              </SortableHeader>
              <SortableHeader field="product_count">
                <span className="text-right w-full">Products</span>
              </SortableHeader>
              <SortableHeader field="facility_count">
                <span className="text-right w-full">Facilities</span>
              </SortableHeader>
              <SortableHeader field="created_at">Joined</SortableHeader>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredAndSorted.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-gray-500 py-8">
                  {searchQuery || filterTier !== "all" || filterStatus !== "all"
                    ? "No organisations match your filters"
                    : "No organisations found"}
                </TableCell>
              </TableRow>
            ) : (
              filteredAndSorted.map((org) => (
                <>
                  <TableRow
                    key={org.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => toggleExpand(org.id)}
                  >
                    <TableCell className="w-8 pr-0">
                      {expandedOrgs.has(org.id) ? (
                        <ChevronDown className="h-4 w-4 text-gray-400" />
                      ) : (
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium">{org.name}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className={getTierBadgeClass(org.subscription_tier)}>
                        {org.subscription_tier
                          ? org.subscription_tier.charAt(0).toUpperCase() + org.subscription_tier.slice(1)
                          : "None"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant={getStatusVariant(org.subscription_status)}
                        className={org.subscription_status === "active" ? "bg-green-600" : ""}
                      >
                        {org.subscription_status || "None"}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">{org.member_count}</TableCell>
                    <TableCell className="text-right">{org.product_count}</TableCell>
                    <TableCell className="text-right">{org.facility_count}</TableCell>
                    <TableCell className="text-right text-gray-500 text-sm">
                      {formatDistanceToNow(new Date(org.created_at), { addSuffix: true })}
                    </TableCell>
                  </TableRow>

                  {/* Expanded detail row */}
                  {expandedOrgs.has(org.id) && (
                    <TableRow key={`${org.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                      <TableCell colSpan={8} className="py-4">
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 px-4">
                          <div className="flex items-start gap-2">
                            <Beaker className="h-4 w-4 text-cyan-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{org.lca_count}</p>
                              <p className="text-xs text-gray-500">LCAs</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Truck className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">{org.supplier_count}</p>
                              <p className="text-xs text-gray-500">Suppliers</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            {org.onboarding_completed ? (
                              <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                            ) : (
                              <Clock className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            )}
                            <div>
                              <p className="text-sm font-medium">
                                {org.onboarding_completed
                                  ? "Complete"
                                  : org.onboarding_current_step || "Not started"}
                              </p>
                              <p className="text-xs text-gray-500">Onboarding</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Activity className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">
                                {org.last_activity_at
                                  ? formatDistanceToNow(new Date(org.last_activity_at), { addSuffix: true })
                                  : "No activity"}
                              </p>
                              <p className="text-xs text-gray-500">Last Active</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">
                                {org.subscription_started_at
                                  ? format(new Date(org.subscription_started_at), "MMM d, yyyy")
                                  : "—"}
                              </p>
                              <p className="text-xs text-gray-500">Sub. Started</p>
                            </div>
                          </div>
                          <div className="flex items-start gap-2">
                            <Calendar className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                            <div>
                              <p className="text-sm font-medium">
                                {org.subscription_expires_at
                                  ? format(new Date(org.subscription_expires_at), "MMM d, yyyy")
                                  : "—"}
                              </p>
                              <p className="text-xs text-gray-500">Expires</p>
                            </div>
                          </div>
                        </div>
                      </TableCell>
                    </TableRow>
                  )}
                </>
              ))
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
