"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Database,
  Search,
  Plus,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Clock,
  XCircle,
  Shield,
  FlaskConical,
  FileText,
  TrendingUp,
  Eye,
  Pencil,
  Loader2,
  BarChart3,
  Package,
  Beaker,
  Leaf,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useIsAlkateraAdmin } from "@/hooks/usePermissions";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

// ============================================================================
// Types
// ============================================================================
interface EmissionFactor {
  id: string;
  name: string;
  category: string;
  co2_factor: number;
  reference_unit: string;
  source: string;
  geographic_scope: string;
  uncertainty_percent: number;
  metadata: any;
  status: string;
  version: number;
  confidence_score: number;
  review_due_date: string | null;
  last_reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

interface FactorRequest {
  id: string;
  search_query: string;
  material_name: string;
  material_type: string | null;
  context: string;
  status: string;
  request_count: number;
  unique_org_count: number;
  priority_score: number;
  source_page: string | null;
  metadata: any;
  created_at: string;
  updated_at: string;
}

interface FactorStats {
  total: number;
  by_category: Record<string, number>;
  by_quality: Record<string, number>;
  by_status: Record<string, number>;
}

interface RequestStats {
  pending: number;
  researching: number;
  resolved: number;
  rejected: number;
  duplicate: number;
}

// ============================================================================
// Component
// ============================================================================
export default function AdminFactorsPage() {
  const { isAlkateraAdmin, isLoading: authLoading } = useIsAlkateraAdmin();
  const [activeTab, setActiveTab] = useState("library");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Library state
  const [factors, setFactors] = useState<EmissionFactor[]>([]);
  const [factorStats, setFactorStats] = useState<FactorStats | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string>("all");
  const [qualityFilter, setQualityFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Requests state
  const [requests, setRequests] = useState<FactorRequest[]>([]);
  const [requestStats, setRequestStats] = useState<RequestStats | null>(null);

  // Detail/edit state
  const [selectedFactor, setSelectedFactor] = useState<EmissionFactor | null>(null);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [editMode, setEditMode] = useState(false);
  const [editValues, setEditValues] = useState<Record<string, any>>({});
  const [saving, setSaving] = useState(false);

  // Create form state
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createForm, setCreateForm] = useState({
    name: "",
    category: "Ingredient",
    co2_factor: "",
    reference_unit: "kg",
    source: "",
    geographic_scope: "GLO",
    uncertainty_percent: "25",
    confidence_score: "70",
    data_quality_grade: "MEDIUM",
    system_boundary: "",
    notes: "",
    drinks_relevance: "",
  });
  const [creating, setCreating] = useState(false);

  // Request detail state
  const [selectedRequest, setSelectedRequest] = useState<FactorRequest | null>(null);
  const [showRequestDialog, setShowRequestDialog] = useState(false);

  // ============================================================================
  // Data fetching
  // ============================================================================
  const fetchFactors = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const params = new URLSearchParams({ global_only: "true", limit: "200" });
      if (searchQuery) params.set("search", searchQuery);
      if (categoryFilter !== "all") params.set("category", categoryFilter);
      if (qualityFilter !== "all") params.set("quality", qualityFilter);
      if (statusFilter !== "all") params.set("status", statusFilter);

      const res = await fetch(`/api/admin/emission-factors?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setFactors(data.factors || []);
      setFactorStats(data.stats || null);
    } catch (err: any) {
      console.error("Error fetching factors:", err);
      toast.error("Failed to load factors");
    }
  }, [searchQuery, categoryFilter, qualityFilter, statusFilter]);

  const fetchRequests = useCallback(async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) return;

      const res = await fetch("/api/data/factor-requests?limit=100", {
        headers: { Authorization: `Bearer ${token}` },
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      setRequests(data.requests || []);
      setRequestStats(data.stats || null);
    } catch (err: any) {
      console.error("Error fetching requests:", err);
    }
  }, []);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    await Promise.all([fetchFactors(), fetchRequests()]);
    setLoading(false);
    setRefreshing(false);
  }, [fetchFactors, fetchRequests]);

  useEffect(() => {
    if (isAlkateraAdmin) {
      fetchAll();
    } else if (!authLoading) {
      setLoading(false);
    }
  }, [isAlkateraAdmin, authLoading, fetchAll]);

  // Debounced search
  useEffect(() => {
    if (!isAlkateraAdmin) return;
    const timeout = setTimeout(() => {
      fetchFactors();
    }, 300);
    return () => clearTimeout(timeout);
  }, [searchQuery, categoryFilter, qualityFilter, statusFilter, isAlkateraAdmin, fetchFactors]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchAll();
  };

  // ============================================================================
  // Factor CRUD
  // ============================================================================
  const handleViewFactor = (factor: EmissionFactor) => {
    setSelectedFactor(factor);
    setEditMode(false);
    setEditValues({});
    setShowDetailDialog(true);
  };

  const handleEditFactor = (factor: EmissionFactor) => {
    setSelectedFactor(factor);
    setEditMode(true);
    setEditValues({
      name: factor.name,
      co2_factor: factor.co2_factor,
      source: factor.source,
      geographic_scope: factor.geographic_scope,
      uncertainty_percent: factor.uncertainty_percent,
      confidence_score: factor.confidence_score,
      status: factor.status || "active",
    });
    setShowDetailDialog(true);
  };

  const handleSaveEdit = async () => {
    if (!selectedFactor) return;
    setSaving(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch(`/api/admin/emission-factors/${selectedFactor.id}`, {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...editValues,
          change_reason: "Updated via admin dashboard",
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success("Factor updated successfully");
      setShowDetailDialog(false);
      fetchFactors();
    } catch (err: any) {
      toast.error(err.message || "Failed to update factor");
    } finally {
      setSaving(false);
    }
  };

  const handleCreateFactor = async () => {
    if (!createForm.name || !createForm.co2_factor) {
      toast.error("Name and CO2 factor are required");
      return;
    }
    setCreating(true);
    try {
      const { data: session } = await supabase.auth.getSession();
      const token = session?.session?.access_token;
      if (!token) throw new Error("No session");

      const res = await fetch("/api/admin/emission-factors", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: createForm.name,
          category: createForm.category,
          co2_factor: createForm.co2_factor,
          reference_unit: createForm.reference_unit,
          source: createForm.source,
          geographic_scope: createForm.geographic_scope,
          uncertainty_percent: createForm.uncertainty_percent,
          confidence_score: createForm.confidence_score,
          metadata: {
            data_quality_grade: createForm.data_quality_grade,
            system_boundary: createForm.system_boundary,
            notes: createForm.notes,
            drinks_relevance: createForm.drinks_relevance,
          },
        }),
      });
      const data = await res.json();
      if (data.error) throw new Error(data.error);

      toast.success("Factor created successfully");
      setShowCreateDialog(false);
      setCreateForm({
        name: "",
        category: "Ingredient",
        co2_factor: "",
        reference_unit: "kg",
        source: "",
        geographic_scope: "GLO",
        uncertainty_percent: "25",
        confidence_score: "70",
        data_quality_grade: "MEDIUM",
        system_boundary: "",
        notes: "",
        drinks_relevance: "",
      });
      fetchFactors();
    } catch (err: any) {
      toast.error(err.message || "Failed to create factor");
    } finally {
      setCreating(false);
    }
  };

  // ============================================================================
  // Request actions
  // ============================================================================
  const handleUpdateRequestStatus = async (requestId: string, newStatus: string) => {
    try {
      const { error } = await supabase
        .from("emission_factor_requests")
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .eq("id", requestId);

      if (error) throw error;
      toast.success(`Request marked as ${newStatus}`);
      setShowRequestDialog(false);
      fetchRequests();
    } catch (err: any) {
      toast.error(err.message || "Failed to update request");
    }
  };

  // ============================================================================
  // Helpers
  // ============================================================================
  const qualityBadge = (grade: string) => {
    switch (grade) {
      case "HIGH":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">{grade}</Badge>;
      case "MEDIUM":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">{grade}</Badge>;
      case "LOW":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30">{grade}</Badge>;
      default:
        return <Badge variant="secondary">{grade || "N/A"}</Badge>;
    }
  };

  const statusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30">Active</Badge>;
      case "deprecated":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Deprecated</Badge>;
      case "under_review":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">Under Review</Badge>;
      case "draft":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">Draft</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const requestStatusBadge = (status: string) => {
    switch (status) {
      case "pending":
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="mr-1 h-3 w-3" />Pending</Badge>;
      case "researching":
        return <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30"><FlaskConical className="mr-1 h-3 w-3" />Researching</Badge>;
      case "resolved":
        return <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30"><CheckCircle className="mr-1 h-3 w-3" />Resolved</Badge>;
      case "rejected":
        return <Badge className="bg-red-500/20 text-red-400 border-red-500/30"><XCircle className="mr-1 h-3 w-3" />Rejected</Badge>;
      case "duplicate":
        return <Badge className="bg-gray-500/20 text-gray-400 border-gray-500/30">Duplicate</Badge>;
      default:
        return <Badge variant="secondary">{status}</Badge>;
    }
  };

  const contextBadge = (context: string) => {
    switch (context) {
      case "search_miss":
        return <Badge variant="outline" className="text-xs">Search Miss</Badge>;
      case "calculation_failure":
        return <Badge variant="outline" className="text-xs text-red-400 border-red-500/30">Calc Failure</Badge>;
      case "user_request":
        return <Badge variant="outline" className="text-xs text-blue-400 border-blue-500/30">User Request</Badge>;
      case "quality_concern":
        return <Badge variant="outline" className="text-xs text-amber-400 border-amber-500/30">Quality Issue</Badge>;
      default:
        return <Badge variant="outline" className="text-xs">{context}</Badge>;
    }
  };

  // ============================================================================
  // Loading / Access
  // ============================================================================
  if (authLoading || loading) {
    return (
      <div className="p-6 space-y-6">
        <div className="flex items-center justify-between">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-10 w-24" />
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
        <Skeleton className="h-96" />
      </div>
    );
  }

  if (!isAlkateraAdmin) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You need Alkatera admin privileges to access the factor management dashboard.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  // ============================================================================
  // Render
  // ============================================================================
  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Emission Factor Library</h1>
          <p className="text-muted-foreground mt-1">
            Manage the Global Drinks Factor Library — {factorStats?.total || 0} factors
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Factor
          </Button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Database className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{factorStats?.total || 0}</p>
                <p className="text-xs text-muted-foreground">Total Factors</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <CheckCircle className="h-5 w-5 text-emerald-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{factorStats?.by_quality?.HIGH || 0}</p>
                <p className="text-xs text-muted-foreground">HIGH Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-amber-500/10">
                <AlertTriangle className="h-5 w-5 text-amber-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{factorStats?.by_quality?.LOW || 0}</p>
                <p className="text-xs text-muted-foreground">LOW Quality</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <Clock className="h-5 w-5 text-blue-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">{requestStats?.pending || 0}</p>
                <p className="text-xs text-muted-foreground">Pending Requests</p>
              </div>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <BarChart3 className="h-5 w-5 text-purple-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {factorStats?.by_category?.Ingredient || 0} / {factorStats?.by_category?.Packaging || 0}
                </p>
                <p className="text-xs text-muted-foreground">Ingredients / Packaging</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Main Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="library">
            <Database className="mr-2 h-4 w-4" />
            Library
          </TabsTrigger>
          <TabsTrigger value="requests">
            <FileText className="mr-2 h-4 w-4" />
            Requests
            {(requestStats?.pending || 0) > 0 && (
              <Badge className="ml-2 bg-amber-500/20 text-amber-400 text-xs">{requestStats?.pending}</Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="analytics">
            <BarChart3 className="mr-2 h-4 w-4" />
            Analytics
          </TabsTrigger>
        </TabsList>

        {/* ================================================================ */}
        {/* Library Tab                                                       */}
        {/* ================================================================ */}
        <TabsContent value="library" className="space-y-4">
          {/* Filters */}
          <div className="flex flex-wrap gap-3">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search factors..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9"
                />
              </div>
            </div>
            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="w-[150px]">
                <SelectValue placeholder="Category" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                <SelectItem value="Ingredient">Ingredient</SelectItem>
                <SelectItem value="Packaging">Packaging</SelectItem>
                <SelectItem value="Process">Process</SelectItem>
              </SelectContent>
            </Select>
            <Select value={qualityFilter} onValueChange={setQualityFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Quality" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Quality</SelectItem>
                <SelectItem value="HIGH">HIGH</SelectItem>
                <SelectItem value="MEDIUM">MEDIUM</SelectItem>
                <SelectItem value="LOW">LOW</SelectItem>
              </SelectContent>
            </Select>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[140px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="under_review">Under Review</SelectItem>
                <SelectItem value="deprecated">Deprecated</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Factors Table */}
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead className="text-right">CO2e (kg/kg)</TableHead>
                    <TableHead>Quality</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Scope</TableHead>
                    <TableHead>Uncertainty</TableHead>
                    <TableHead>Review Due</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {factors.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        {searchQuery || categoryFilter !== "all" || qualityFilter !== "all"
                          ? "No factors match your filters"
                          : "No emission factors found"}
                      </TableCell>
                    </TableRow>
                  ) : (
                    factors.map((factor) => {
                      const isReviewOverdue = factor.review_due_date &&
                        new Date(factor.review_due_date) < new Date();
                      const isReviewSoon = factor.review_due_date &&
                        new Date(factor.review_due_date) < new Date(Date.now() + 30 * 24 * 60 * 60 * 1000) &&
                        !isReviewOverdue;

                      return (
                        <TableRow key={factor.id} className="cursor-pointer hover:bg-muted/50" onClick={() => handleViewFactor(factor)}>
                          <TableCell className="font-medium max-w-[250px] truncate">{factor.name}</TableCell>
                          <TableCell>
                            <Badge variant="outline" className="text-xs">
                              {factor.category === "Ingredient" && <Beaker className="mr-1 h-3 w-3" />}
                              {factor.category === "Packaging" && <Package className="mr-1 h-3 w-3" />}
                              {factor.category === "Process" && <FlaskConical className="mr-1 h-3 w-3" />}
                              {factor.category}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-right font-mono">{factor.co2_factor.toFixed(2)}</TableCell>
                          <TableCell>{qualityBadge(factor.metadata?.data_quality_grade)}</TableCell>
                          <TableCell>{statusBadge(factor.status || "active")}</TableCell>
                          <TableCell className="text-xs">{factor.geographic_scope}</TableCell>
                          <TableCell className="text-xs">±{factor.uncertainty_percent || 0}%</TableCell>
                          <TableCell className="text-xs">
                            {factor.review_due_date ? (
                              <span className={isReviewOverdue ? "text-red-400 font-semibold" : isReviewSoon ? "text-amber-400" : ""}>
                                {format(new Date(factor.review_due_date), "MMM yyyy")}
                                {isReviewOverdue && " ⚠️"}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <Button variant="ghost" size="sm" onClick={(e) => { e.stopPropagation(); handleEditFactor(factor); }}>
                              <Pencil className="h-3.5 w-3.5" />
                            </Button>
                          </TableCell>
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
          <p className="text-xs text-muted-foreground">Showing {factors.length} factors</p>
        </TabsContent>

        {/* ================================================================ */}
        {/* Requests Tab                                                      */}
        {/* ================================================================ */}
        <TabsContent value="requests" className="space-y-4">
          {/* Request summary cards */}
          {requestStats && (
            <div className="grid grid-cols-5 gap-3">
              {Object.entries(requestStats).map(([status, count]) => (
                <Card key={status}>
                  <CardContent className="pt-4 pb-3 px-4 text-center">
                    <p className="text-lg font-bold">{count}</p>
                    <p className="text-xs text-muted-foreground capitalize">{status}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {/* Requests Table */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Factor Requests Queue</CardTitle>
              <CardDescription>
                Sorted by priority score (request count x unique organisations)
              </CardDescription>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Material</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Context</TableHead>
                    <TableHead className="text-right">Requests</TableHead>
                    <TableHead className="text-right">Orgs</TableHead>
                    <TableHead className="text-right">Priority</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>First Seen</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {requests.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="text-center py-8 text-muted-foreground">
                        No factor requests yet. Requests appear when users search for missing ingredients or submit factor requests.
                      </TableCell>
                    </TableRow>
                  ) : (
                    requests.map((req) => (
                      <TableRow
                        key={req.id}
                        className="cursor-pointer hover:bg-muted/50"
                        onClick={() => {
                          setSelectedRequest(req);
                          setShowRequestDialog(true);
                        }}
                      >
                        <TableCell className="font-medium">{req.material_name}</TableCell>
                        <TableCell className="text-xs capitalize">{req.material_type || "—"}</TableCell>
                        <TableCell>{contextBadge(req.context)}</TableCell>
                        <TableCell className="text-right font-mono">{req.request_count}</TableCell>
                        <TableCell className="text-right font-mono">{req.unique_org_count}</TableCell>
                        <TableCell className="text-right font-mono font-bold">{req.priority_score}</TableCell>
                        <TableCell>{requestStatusBadge(req.status)}</TableCell>
                        <TableCell className="text-xs">{formatDistanceToNow(new Date(req.created_at), { addSuffix: true })}</TableCell>
                        <TableCell className="text-right">
                          {req.status === "pending" && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUpdateRequestStatus(req.id, "researching");
                              }}
                            >
                              <FlaskConical className="mr-1 h-3.5 w-3.5" />
                              Research
                            </Button>
                          )}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        {/* ================================================================ */}
        {/* Analytics Tab                                                     */}
        {/* ================================================================ */}
        <TabsContent value="analytics" className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Quality Distribution */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Quality Distribution</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {["HIGH", "MEDIUM", "LOW"].map((grade) => {
                  const count = factorStats?.by_quality?.[grade] || 0;
                  const total = factorStats?.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={grade} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span>{grade}</span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            grade === "HIGH" ? "bg-emerald-500" :
                            grade === "MEDIUM" ? "bg-amber-500" : "bg-red-500"
                          }`}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Category Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Category Breakdown</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {Object.entries(factorStats?.by_category || {}).map(([cat, count]) => {
                  const total = factorStats?.total || 1;
                  const pct = Math.round((count / total) * 100);
                  return (
                    <div key={cat} className="space-y-1">
                      <div className="flex justify-between text-sm">
                        <span className="flex items-center gap-2">
                          {cat === "Ingredient" && <Beaker className="h-4 w-4" />}
                          {cat === "Packaging" && <Package className="h-4 w-4" />}
                          {cat === "Process" && <FlaskConical className="h-4 w-4" />}
                          {cat}
                        </span>
                        <span>{count} ({pct}%)</span>
                      </div>
                      <div className="h-2 bg-muted rounded-full overflow-hidden">
                        <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </CardContent>
            </Card>

            {/* Review Upcoming */}
            <Card className="md:col-span-2">
              <CardHeader>
                <CardTitle className="text-lg">Factors Due for Review (Next 90 Days)</CardTitle>
              </CardHeader>
              <CardContent>
                {(() => {
                  const now = new Date();
                  const ninetyDays = new Date(now.getTime() + 90 * 24 * 60 * 60 * 1000);
                  const dueFactors = factors.filter(
                    (f) => f.review_due_date && new Date(f.review_due_date) <= ninetyDays
                  ).sort((a, b) =>
                    new Date(a.review_due_date!).getTime() - new Date(b.review_due_date!).getTime()
                  );

                  if (dueFactors.length === 0) {
                    return <p className="text-muted-foreground text-sm">No factors due for review in the next 90 days.</p>;
                  }

                  return (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Name</TableHead>
                          <TableHead>Quality</TableHead>
                          <TableHead>Review Due</TableHead>
                          <TableHead>Status</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {dueFactors.map((f) => {
                          const isOverdue = new Date(f.review_due_date!) < now;
                          return (
                            <TableRow key={f.id} className="cursor-pointer" onClick={() => handleViewFactor(f)}>
                              <TableCell className="font-medium">{f.name}</TableCell>
                              <TableCell>{qualityBadge(f.metadata?.data_quality_grade)}</TableCell>
                              <TableCell className={isOverdue ? "text-red-400 font-semibold" : "text-amber-400"}>
                                {format(new Date(f.review_due_date!), "dd MMM yyyy")}
                                {isOverdue && " (overdue)"}
                              </TableCell>
                              <TableCell>{statusBadge(f.status || "active")}</TableCell>
                            </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  );
                })()}
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* ================================================================ */}
      {/* Factor Detail / Edit Dialog                                       */}
      {/* ================================================================ */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {editMode ? (
                <>
                  <Pencil className="h-5 w-5" />
                  Edit Factor
                </>
              ) : (
                <>
                  <Eye className="h-5 w-5" />
                  Factor Details
                </>
              )}
            </DialogTitle>
          </DialogHeader>

          {selectedFactor && (
            <div className="space-y-4">
              {/* Core Info */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Name</Label>
                  {editMode ? (
                    <Input
                      value={editValues.name || ""}
                      onChange={(e) => setEditValues({ ...editValues, name: e.target.value })}
                    />
                  ) : (
                    <p className="font-medium">{selectedFactor.name}</p>
                  )}
                </div>
                <div>
                  <Label>Category</Label>
                  <p>{selectedFactor.category}</p>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>CO2e Factor (kg/kg)</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      step="0.01"
                      value={editValues.co2_factor || ""}
                      onChange={(e) => setEditValues({ ...editValues, co2_factor: parseFloat(e.target.value) })}
                    />
                  ) : (
                    <p className="font-mono text-lg font-bold">{selectedFactor.co2_factor}</p>
                  )}
                </div>
                <div>
                  <Label>Geographic Scope</Label>
                  {editMode ? (
                    <Input
                      value={editValues.geographic_scope || ""}
                      onChange={(e) => setEditValues({ ...editValues, geographic_scope: e.target.value })}
                    />
                  ) : (
                    <p>{selectedFactor.geographic_scope}</p>
                  )}
                </div>
                <div>
                  <Label>Uncertainty</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      value={editValues.uncertainty_percent || ""}
                      onChange={(e) => setEditValues({ ...editValues, uncertainty_percent: parseFloat(e.target.value) })}
                    />
                  ) : (
                    <p>±{selectedFactor.uncertainty_percent}%</p>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Quality</Label>
                  <div className="mt-1">{qualityBadge(selectedFactor.metadata?.data_quality_grade)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  {editMode ? (
                    <Select value={editValues.status || "active"} onValueChange={(v) => setEditValues({ ...editValues, status: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="under_review">Under Review</SelectItem>
                        <SelectItem value="deprecated">Deprecated</SelectItem>
                        <SelectItem value="draft">Draft</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <div className="mt-1">{statusBadge(selectedFactor.status || "active")}</div>
                  )}
                </div>
                <div>
                  <Label>Confidence</Label>
                  {editMode ? (
                    <Input
                      type="number"
                      min={0}
                      max={100}
                      value={editValues.confidence_score || ""}
                      onChange={(e) => setEditValues({ ...editValues, confidence_score: parseFloat(e.target.value) })}
                    />
                  ) : (
                    <p>{selectedFactor.confidence_score || "—"}/100</p>
                  )}
                </div>
              </div>

              {/* Source */}
              <div>
                <Label>Source Citation</Label>
                {editMode ? (
                  <Textarea
                    value={editValues.source || ""}
                    onChange={(e) => setEditValues({ ...editValues, source: e.target.value })}
                    rows={2}
                  />
                ) : (
                  <p className="text-sm text-muted-foreground">{selectedFactor.source}</p>
                )}
              </div>

              {/* Metadata */}
              {!editMode && selectedFactor.metadata && (
                <>
                  {selectedFactor.metadata.system_boundary && (
                    <div>
                      <Label>System Boundary</Label>
                      <p className="text-sm">{selectedFactor.metadata.system_boundary}</p>
                    </div>
                  )}
                  {selectedFactor.metadata.notes && (
                    <div>
                      <Label>Notes</Label>
                      <p className="text-sm">{selectedFactor.metadata.notes}</p>
                    </div>
                  )}
                  {selectedFactor.metadata.drinks_relevance && (
                    <div>
                      <Label>Drinks Relevance</Label>
                      <p className="text-sm">{selectedFactor.metadata.drinks_relevance}</p>
                    </div>
                  )}
                  {(selectedFactor.metadata.value_range_low || selectedFactor.metadata.value_range_high) && (
                    <div>
                      <Label>Value Range</Label>
                      <p className="text-sm font-mono">
                        {selectedFactor.metadata.value_range_low} — {selectedFactor.metadata.value_range_high} kg CO2e/kg
                      </p>
                    </div>
                  )}
                  {selectedFactor.metadata.corroborating_sources?.length > 0 && (
                    <div>
                      <Label>Corroborating Sources ({selectedFactor.metadata.corroborating_sources.length})</Label>
                      <div className="space-y-1 mt-1">
                        {selectedFactor.metadata.corroborating_sources.map((s: any, i: number) => (
                          <p key={i} className="text-xs text-muted-foreground">
                            • {s.title} ({s.authors}, {s.year}) — {s.value}
                          </p>
                        ))}
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* Versioning info */}
              <div className="grid grid-cols-3 gap-4 pt-2 border-t text-xs text-muted-foreground">
                <div>
                  <Label className="text-xs">Version</Label>
                  <p>v{selectedFactor.version || 1}</p>
                </div>
                <div>
                  <Label className="text-xs">Review Due</Label>
                  <p>{selectedFactor.review_due_date ? format(new Date(selectedFactor.review_due_date), "dd MMM yyyy") : "—"}</p>
                </div>
                <div>
                  <Label className="text-xs">Last Reviewed</Label>
                  <p>{selectedFactor.last_reviewed_at ? formatDistanceToNow(new Date(selectedFactor.last_reviewed_at), { addSuffix: true }) : "Never"}</p>
                </div>
              </div>
            </div>
          )}

          <DialogFooter>
            {editMode ? (
              <>
                <Button variant="outline" onClick={() => { setEditMode(false); setEditValues({}); }}>
                  Cancel
                </Button>
                <Button onClick={handleSaveEdit} disabled={saving}>
                  {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                  Save Changes
                </Button>
              </>
            ) : (
              <>
                <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
                  Close
                </Button>
                <Button onClick={() => {
                  if (selectedFactor) handleEditFactor(selectedFactor);
                }}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Request Detail Dialog                                             */}
      {/* ================================================================ */}
      <Dialog open={showRequestDialog} onOpenChange={setShowRequestDialog}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Factor Request Details</DialogTitle>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Material Name</Label>
                  <p className="font-medium">{selectedRequest.material_name}</p>
                </div>
                <div>
                  <Label>Type</Label>
                  <p className="capitalize">{selectedRequest.material_type || "Unknown"}</p>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-4">
                <div>
                  <Label>Context</Label>
                  <div className="mt-1">{contextBadge(selectedRequest.context)}</div>
                </div>
                <div>
                  <Label>Status</Label>
                  <div className="mt-1">{requestStatusBadge(selectedRequest.status)}</div>
                </div>
                <div>
                  <Label>Priority Score</Label>
                  <p className="text-lg font-bold">{selectedRequest.priority_score}</p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Request Count</Label>
                  <p>{selectedRequest.request_count}</p>
                </div>
                <div>
                  <Label>Unique Organisations</Label>
                  <p>{selectedRequest.unique_org_count}</p>
                </div>
              </div>
              {selectedRequest.source_page && (
                <div>
                  <Label>Source Page</Label>
                  <p className="text-sm text-muted-foreground">{selectedRequest.source_page}</p>
                </div>
              )}
              {selectedRequest.metadata?.notes && (
                <div>
                  <Label>Notes</Label>
                  <p className="text-sm">{selectedRequest.metadata.notes}</p>
                </div>
              )}
              <div>
                <Label>First Seen</Label>
                <p className="text-sm">{format(new Date(selectedRequest.created_at), "dd MMM yyyy HH:mm")}</p>
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            {selectedRequest?.status === "pending" && (
              <>
                <Button
                  variant="outline"
                  onClick={() => handleUpdateRequestStatus(selectedRequest.id, "researching")}
                >
                  <FlaskConical className="mr-2 h-4 w-4" />
                  Mark Researching
                </Button>
                <Button
                  variant="outline"
                  className="text-red-400"
                  onClick={() => handleUpdateRequestStatus(selectedRequest.id, "rejected")}
                >
                  <XCircle className="mr-2 h-4 w-4" />
                  Reject
                </Button>
              </>
            )}
            {selectedRequest?.status === "researching" && (
              <>
                <Button onClick={() => handleUpdateRequestStatus(selectedRequest.id, "resolved")}>
                  <CheckCircle className="mr-2 h-4 w-4" />
                  Mark Resolved
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowRequestDialog(false);
                    setCreateForm({
                      ...createForm,
                      name: selectedRequest.material_name,
                      category: selectedRequest.material_type === "packaging" ? "Packaging" : "Ingredient",
                    });
                    setShowCreateDialog(true);
                  }}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Factor
                </Button>
              </>
            )}
            <Button variant="ghost" onClick={() => setShowRequestDialog(false)}>
              Close
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ================================================================ */}
      {/* Create Factor Dialog                                              */}
      {/* ================================================================ */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="h-5 w-5" />
              Create New Emission Factor
            </DialogTitle>
            <DialogDescription>
              Add a new factor to the Global Drinks Factor Library. All fields with * are required.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Name *</Label>
                <Input
                  placeholder="e.g. Citric Acid (E330)"
                  value={createForm.name}
                  onChange={(e) => setCreateForm({ ...createForm, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Category *</Label>
                <Select value={createForm.category} onValueChange={(v) => setCreateForm({ ...createForm, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Ingredient">Ingredient</SelectItem>
                    <SelectItem value="Packaging">Packaging</SelectItem>
                    <SelectItem value="Process">Process</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>CO2e Factor (kg/kg) *</Label>
                <Input
                  type="number"
                  step="0.01"
                  placeholder="e.g. 7.50"
                  value={createForm.co2_factor}
                  onChange={(e) => setCreateForm({ ...createForm, co2_factor: e.target.value })}
                />
              </div>
              <div>
                <Label>Reference Unit</Label>
                <Input
                  value={createForm.reference_unit}
                  onChange={(e) => setCreateForm({ ...createForm, reference_unit: e.target.value })}
                />
              </div>
              <div>
                <Label>Geographic Scope</Label>
                <Input
                  placeholder="GLO, EU, US, etc."
                  value={createForm.geographic_scope}
                  onChange={(e) => setCreateForm({ ...createForm, geographic_scope: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <Label>Data Quality</Label>
                <Select value={createForm.data_quality_grade} onValueChange={(v) => setCreateForm({ ...createForm, data_quality_grade: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="HIGH">HIGH — Multiple peer-reviewed sources</SelectItem>
                    <SelectItem value="MEDIUM">MEDIUM — Single authoritative source</SelectItem>
                    <SelectItem value="LOW">LOW — Proxy/estimate</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Uncertainty (%)</Label>
                <Input
                  type="number"
                  value={createForm.uncertainty_percent}
                  onChange={(e) => setCreateForm({ ...createForm, uncertainty_percent: e.target.value })}
                />
              </div>
              <div>
                <Label>Confidence Score (0-100)</Label>
                <Input
                  type="number"
                  min={0}
                  max={100}
                  value={createForm.confidence_score}
                  onChange={(e) => setCreateForm({ ...createForm, confidence_score: e.target.value })}
                />
              </div>
            </div>

            <div>
              <Label>Source Citation *</Label>
              <Textarea
                placeholder="e.g. CarbonCloud (2024); Sauer et al. (2015) J Cleaner Production doi:..."
                value={createForm.source}
                onChange={(e) => setCreateForm({ ...createForm, source: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label>System Boundary</Label>
              <Input
                placeholder="e.g. Cradle-to-gate: cultivation, processing, refining"
                value={createForm.system_boundary}
                onChange={(e) => setCreateForm({ ...createForm, system_boundary: e.target.value })}
              />
            </div>

            <div>
              <Label>Notes</Label>
              <Textarea
                placeholder="Any additional notes about this factor..."
                value={createForm.notes}
                onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })}
                rows={2}
              />
            </div>

            <div>
              <Label>Drinks Relevance</Label>
              <Input
                placeholder="e.g. Soft drinks, ciders, fruit beverages — primary acidulant"
                value={createForm.drinks_relevance}
                onChange={(e) => setCreateForm({ ...createForm, drinks_relevance: e.target.value })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCreateDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleCreateFactor} disabled={creating || !createForm.name || !createForm.co2_factor}>
              {creating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Create Factor
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
