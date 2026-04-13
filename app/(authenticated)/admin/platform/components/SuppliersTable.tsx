"use client";

import { useState, useMemo } from "react";
import { Badge } from "@/components/ui/badge";
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
  Globe,
  Mail,
  User,
  Calendar,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow, format } from "date-fns";
import Link from "next/link";
import type { PlatformSupplier } from "../types";

interface SuppliersTableProps {
  suppliers: PlatformSupplier[];
  loading: boolean;
}

type SortField = "name" | "industry_sector" | "country" | "created_at" | "is_verified";
type SortDirection = "asc" | "desc";

export function SuppliersTable({ suppliers, loading }: SuppliersTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sortField, setSortField] = useState<SortField>("created_at");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");
  const [filterVerified, setFilterVerified] = useState("all");
  const [expandedSuppliers, setExpandedSuppliers] = useState<Set<string>>(new Set());

  const toggleExpand = (supplierId: string) => {
    setExpandedSuppliers((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(supplierId)) {
        newSet.delete(supplierId);
      } else {
        newSet.add(supplierId);
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
    let result = [...suppliers];

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      result = result.filter(
        (s) =>
          s.name.toLowerCase().includes(query) ||
          (s.industry_sector && s.industry_sector.toLowerCase().includes(query)) ||
          (s.country && s.country.toLowerCase().includes(query))
      );
    }

    if (filterVerified !== "all") {
      const isVerified = filterVerified === "verified";
      result = result.filter((s) => s.is_verified === isVerified);
    }

    result.sort((a, b) => {
      let aVal: string | number | boolean = "";
      let bVal: string | number | boolean = "";

      switch (sortField) {
        case "name":
          aVal = a.name.toLowerCase();
          bVal = b.name.toLowerCase();
          break;
        case "industry_sector":
          aVal = (a.industry_sector || "").toLowerCase();
          bVal = (b.industry_sector || "").toLowerCase();
          break;
        case "country":
          aVal = (a.country || "").toLowerCase();
          bVal = (b.country || "").toLowerCase();
          break;
        case "created_at":
          aVal = a.created_at;
          bVal = b.created_at;
          break;
        case "is_verified":
          aVal = a.is_verified ? 1 : 0;
          bVal = b.is_verified ? 1 : 0;
          break;
      }

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return result;
  }, [suppliers, searchQuery, filterVerified, sortField, sortDirection]);

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredAndSorted.length} of {suppliers.length} suppliers
          {searchQuery || filterVerified !== "all" ? " (filtered)" : ""}
        </p>
        <Link
          href="/admin/suppliers"
          className="text-sm text-[#ccff00] hover:underline flex items-center gap-1"
        >
          Manage Suppliers
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Search and filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by name, sector, or country..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterVerified} onValueChange={setFilterVerified}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Verification" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All Statuses</SelectItem>
            <SelectItem value="verified">Verified</SelectItem>
            <SelectItem value="pending">Pending</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-8" />
            <SortableHeader field="name">Supplier</SortableHeader>
            <SortableHeader field="industry_sector">Sector</SortableHeader>
            <SortableHeader field="country">Country</SortableHeader>
            <TableHead>Contact</TableHead>
            <SortableHeader field="is_verified">Verified</SortableHeader>
            <SortableHeader field="created_at">Registered</SortableHeader>
          </TableRow>
        </TableHeader>
        <TableBody>
          {filteredAndSorted.length === 0 ? (
            <TableRow>
              <TableCell colSpan={7} className="text-center text-gray-500 py-8">
                {searchQuery || filterVerified !== "all"
                  ? "No suppliers match your filters"
                  : "No suppliers registered yet"}
              </TableCell>
            </TableRow>
          ) : (
            filteredAndSorted.map((supplier) => (
              <>
                <TableRow
                  key={supplier.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => toggleExpand(supplier.id)}
                >
                  <TableCell className="w-8 pr-0">
                    {expandedSuppliers.has(supplier.id) ? (
                      <ChevronDown className="h-4 w-4 text-gray-400" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-gray-400" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{supplier.name}</TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {supplier.industry_sector || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {supplier.country || "—"}
                  </TableCell>
                  <TableCell className="text-sm text-gray-500">
                    {supplier.contact_email || "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={supplier.is_verified ? "default" : "outline"}
                      className={supplier.is_verified ? "bg-green-600" : ""}
                    >
                      {supplier.is_verified ? "Verified" : "Pending"}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right text-gray-500 text-sm">
                    {formatDistanceToNow(new Date(supplier.created_at), { addSuffix: true })}
                  </TableCell>
                </TableRow>

                {/* Expanded detail row */}
                {expandedSuppliers.has(supplier.id) && (
                  <TableRow key={`${supplier.id}-detail`} className="bg-muted/30 hover:bg-muted/30">
                    <TableCell colSpan={7} className="py-4">
                      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 px-4">
                        {supplier.website && (
                          <div className="flex items-start gap-2">
                            <Globe className="h-4 w-4 text-blue-500 mt-0.5 shrink-0" />
                            <div>
                              <a
                                href={supplier.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-sm font-medium text-blue-500 hover:underline"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {supplier.website.replace(/^https?:\/\//, "")}
                              </a>
                              <p className="text-xs text-gray-500">Website</p>
                            </div>
                          </div>
                        )}
                        <div className="flex items-start gap-2">
                          <User className="h-4 w-4 text-purple-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">
                              {supplier.contact_name || "—"}
                            </p>
                            <p className="text-xs text-gray-500">Contact Name</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Mail className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">
                              {supplier.contact_email || "—"}
                            </p>
                            <p className="text-xs text-gray-500">Email</p>
                          </div>
                        </div>
                        <div className="flex items-start gap-2">
                          <Calendar className="h-4 w-4 text-green-500 mt-0.5 shrink-0" />
                          <div>
                            <p className="text-sm font-medium">
                              {supplier.verification_date
                                ? format(new Date(supplier.verification_date), "MMM d, yyyy")
                                : "Not yet verified"}
                            </p>
                            <p className="text-xs text-gray-500">Verification Date</p>
                          </div>
                        </div>
                        {supplier.description && (
                          <div className="col-span-full flex items-start gap-2">
                            <div>
                              <p className="text-sm text-gray-400">{supplier.description}</p>
                            </div>
                          </div>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </>
            ))
          )}
        </TableBody>
      </Table>
    </div>
  );
}
