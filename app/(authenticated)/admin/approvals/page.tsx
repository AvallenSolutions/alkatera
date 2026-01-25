"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  CheckCircle,
  XCircle,
  Clock,
  Shield,
  RefreshCw,
  Eye,
  Activity,
  Factory,
  Package,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissions } from "@/hooks/usePermissions";
import { useOrganization } from "@/lib/organizationContext";
import { toast } from "sonner";
import { formatDistanceToNow, format } from "date-fns";

type DataType = "activity_data" | "facilities" | "products" | "suppliers";

interface PendingItem {
  id: string;
  name: string;
  category?: string;
  submitted_by: string;
  submitted_at: string;
  approval_status: string;
  submitter_name?: string;
  submitter_email?: string;
}

interface PendingActivityData extends PendingItem {
  quantity: number;
  unit: string;
  activity_date: string;
}

interface PendingFacility extends PendingItem {
  location: string;
  facility_type: string;
  city: string;
  country: string;
}

interface PendingProduct extends PendingItem {
  product_description: string;
  sku: string;
}

interface PendingSupplier extends PendingItem {
  contact_email: string;
  contact_name: string;
  city: string;
  country: string;
}

export default function ApprovalsPage() {
  const { canApproveData, isLoading: permissionsLoading } = usePermissions();
  const { currentOrganization } = useOrganization();
  const [activeTab, setActiveTab] = useState<DataType>("activity_data");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [counts, setCounts] = useState({
    activity_data: 0,
    facilities: 0,
    products: 0,
    suppliers: 0,
  });
  const [items, setItems] = useState<PendingItem[]>([]);
  const [selectedItem, setSelectedItem] = useState<PendingItem | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [processing, setProcessing] = useState(false);

  const fetchCounts = useCallback(async () => {
    if (!currentOrganization?.id) return;

    try {
      const [activityRes, facilitiesRes, productsRes, suppliersRes] = await Promise.all([
        supabase
          .from("pending_activity_data")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("approval_status", "pending"),
        supabase
          .from("pending_facilities")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("approval_status", "pending"),
        supabase
          .from("pending_products")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("approval_status", "pending"),
        supabase
          .from("pending_suppliers")
          .select("id", { count: "exact", head: true })
          .eq("organization_id", currentOrganization.id)
          .eq("approval_status", "pending"),
      ]);

      setCounts({
        activity_data: activityRes.count || 0,
        facilities: facilitiesRes.count || 0,
        products: productsRes.count || 0,
        suppliers: suppliersRes.count || 0,
      });
    } catch (err) {
      console.error("Error fetching counts:", err);
    }
  }, [currentOrganization?.id]);

  const fetchItems = useCallback(async () => {
    if (!currentOrganization?.id) return;

    setLoading(true);
    try {
      const tableName = `pending_${activeTab}`;
      const { data, error } = await supabase
        .from(tableName)
        .select("*")
        .eq("organization_id", currentOrganization.id)
        .eq("approval_status", "pending")
        .order("submitted_at", { ascending: false });

      if (error) throw error;
      setItems(data || []);
    } catch (err) {
      console.error("Error fetching items:", err);
      toast.error("Failed to load pending items");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [currentOrganization?.id, activeTab]);

  useEffect(() => {
    if (canApproveData && currentOrganization?.id) {
      fetchCounts();
    }
  }, [canApproveData, currentOrganization?.id, fetchCounts]);

  useEffect(() => {
    if (canApproveData && currentOrganization?.id) {
      fetchItems();
    }
  }, [canApproveData, currentOrganization?.id, activeTab, fetchItems]);

  const handleRefresh = () => {
    setRefreshing(true);
    fetchCounts();
    fetchItems();
  };

  const handleApprove = async (item: PendingItem) => {
    setProcessing(true);
    try {
      const functionName = `approve_pending_${activeTab.replace("_data", "")}${activeTab === "activity_data" ? "_data" : ""}`;
      const { error } = await (supabase.rpc as any)(
        activeTab === "activity_data"
          ? "approve_pending_activity_data"
          : activeTab === "facilities"
          ? "approve_pending_facility"
          : activeTab === "products"
          ? "approve_pending_product"
          : "approve_pending_supplier",
        { p_pending_id: item.id }
      );

      if (error) throw error;

      toast.success(`${item.name} has been approved`);
      fetchCounts();
      fetchItems();
    } catch (err: any) {
      console.error("Error approving item:", err);
      toast.error(err.message || "Failed to approve item");
    } finally {
      setProcessing(false);
    }
  };

  const handleReject = async () => {
    if (!selectedItem || !rejectReason.trim()) {
      toast.error("Please provide a reason for rejection");
      return;
    }

    setProcessing(true);
    try {
      const { error } = await (supabase.rpc as any)("reject_pending_submission", {
        p_table_name: `pending_${activeTab}`,
        p_pending_id: selectedItem.id,
        p_reason: rejectReason.trim(),
      });

      if (error) throw error;

      toast.success(`${selectedItem.name} has been rejected`);
      setShowRejectDialog(false);
      setRejectReason("");
      setSelectedItem(null);
      fetchCounts();
      fetchItems();
    } catch (err: any) {
      console.error("Error rejecting item:", err);
      toast.error(err.message || "Failed to reject item");
    } finally {
      setProcessing(false);
    }
  };

  const openRejectDialog = (item: PendingItem) => {
    setSelectedItem(item);
    setRejectReason("");
    setShowRejectDialog(true);
  };

  const openDetailDialog = (item: PendingItem) => {
    setSelectedItem(item);
    setShowDetailDialog(true);
  };

  if (permissionsLoading) {
    return (
      <div className="p-6 space-y-6">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-24" />
          ))}
        </div>
      </div>
    );
  }

  if (!canApproveData) {
    return (
      <div className="p-6">
        <Alert variant="destructive">
          <Shield className="h-4 w-4" />
          <AlertTitle>Access Denied</AlertTitle>
          <AlertDescription>
            You do not have permission to approve data submissions. Only organisation
            administrators can access this page.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  const totalPending = counts.activity_data + counts.facilities + counts.products + counts.suppliers;

  const getIcon = (type: DataType) => {
    switch (type) {
      case "activity_data":
        return <Activity className="h-4 w-4" />;
      case "facilities":
        return <Factory className="h-4 w-4" />;
      case "products":
        return <Package className="h-4 w-4" />;
      case "suppliers":
        return <Users className="h-4 w-4" />;
    }
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900 dark:text-white">
            Approval Queue
          </h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Review and approve data submissions from team members
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefresh}
          disabled={refreshing}
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? "animate-spin" : ""}`} />
          Refresh
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "activity_data" ? "ring-2 ring-blue-500" : ""
          }`}
          onClick={() => setActiveTab("activity_data")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Activity className="h-4 w-4 text-blue-600" />
              Activity Data
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.activity_data}</div>
            <p className="text-xs text-gray-500">pending</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "facilities" ? "ring-2 ring-green-500" : ""
          }`}
          onClick={() => setActiveTab("facilities")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Factory className="h-4 w-4 text-green-600" />
              Facilities
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.facilities}</div>
            <p className="text-xs text-gray-500">pending</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "products" ? "ring-2 ring-amber-500" : ""
          }`}
          onClick={() => setActiveTab("products")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Package className="h-4 w-4 text-amber-600" />
              Products
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.products}</div>
            <p className="text-xs text-gray-500">pending</p>
          </CardContent>
        </Card>

        <Card
          className={`cursor-pointer transition-colors ${
            activeTab === "suppliers" ? "ring-2 ring-cyan-500" : ""
          }`}
          onClick={() => setActiveTab("suppliers")}
        >
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <Users className="h-4 w-4 text-cyan-600" />
              Suppliers
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{counts.suppliers}</div>
            <p className="text-xs text-gray-500">pending</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {getIcon(activeTab)}
            {activeTab === "activity_data"
              ? "Activity Data"
              : activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}{" "}
            Submissions
          </CardTitle>
          <CardDescription>
            {items.length} pending submission{items.length !== 1 ? "s" : ""} to review
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-12 w-full" />
              ))}
            </div>
          ) : items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-500">
              <CheckCircle className="h-12 w-12 text-green-500 mb-4" />
              <p className="text-lg font-medium">All caught up!</p>
              <p className="text-sm">No pending submissions to review</p>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  {activeTab === "activity_data" && (
                    <>
                      <TableHead>Category</TableHead>
                      <TableHead className="text-right">Quantity</TableHead>
                    </>
                  )}
                  {activeTab === "facilities" && (
                    <>
                      <TableHead>Type</TableHead>
                      <TableHead>Location</TableHead>
                    </>
                  )}
                  {activeTab === "products" && <TableHead>SKU</TableHead>}
                  {activeTab === "suppliers" && (
                    <>
                      <TableHead>Contact</TableHead>
                      <TableHead>Location</TableHead>
                    </>
                  )}
                  <TableHead>Submitted</TableHead>
                  <TableHead className="text-right">Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.name}</TableCell>
                    {activeTab === "activity_data" && (
                      <>
                        <TableCell>{(item as PendingActivityData).category}</TableCell>
                        <TableCell className="text-right">
                          {(item as PendingActivityData).quantity}{" "}
                          {(item as PendingActivityData).unit}
                        </TableCell>
                      </>
                    )}
                    {activeTab === "facilities" && (
                      <>
                        <TableCell>{(item as PendingFacility).facility_type || "-"}</TableCell>
                        <TableCell>
                          {(item as PendingFacility).city}, {(item as PendingFacility).country}
                        </TableCell>
                      </>
                    )}
                    {activeTab === "products" && (
                      <TableCell>{(item as PendingProduct).sku || "-"}</TableCell>
                    )}
                    {activeTab === "suppliers" && (
                      <>
                        <TableCell>{(item as PendingSupplier).contact_name || "-"}</TableCell>
                        <TableCell>
                          {(item as PendingSupplier).city}, {(item as PendingSupplier).country}
                        </TableCell>
                      </>
                    )}
                    <TableCell className="text-gray-500 text-sm">
                      {formatDistanceToNow(new Date(item.submitted_at), { addSuffix: true })}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openDetailDialog(item)}
                        >
                          <Eye className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-green-600 hover:text-green-700 hover:bg-green-50"
                          onClick={() => handleApprove(item)}
                          disabled={processing}
                        >
                          <CheckCircle className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          onClick={() => openRejectDialog(item)}
                          disabled={processing}
                        >
                          <XCircle className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Submission</DialogTitle>
            <DialogDescription>
              Please provide a reason for rejecting &ldquo;{selectedItem?.name}&rdquo;. The submitter
              will be notified with this reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="reason">Rejection Reason</Label>
              <Textarea
                id="reason"
                placeholder="Please explain why this submission is being rejected..."
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRejectDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleReject}
              disabled={processing || !rejectReason.trim()}
            >
              {processing ? "Rejecting..." : "Reject Submission"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Submission Details</DialogTitle>
            <DialogDescription>
              Review the full details of this submission
            </DialogDescription>
          </DialogHeader>
          {selectedItem && (
            <div className="space-y-4 py-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-gray-500">Name</Label>
                  <p className="font-medium">{selectedItem.name}</p>
                </div>
                <div>
                  <Label className="text-gray-500">Submitted</Label>
                  <p className="font-medium">
                    {format(new Date(selectedItem.submitted_at), "PPp")}
                  </p>
                </div>
              </div>
              {activeTab === "activity_data" && (
                <div className="grid grid-cols-3 gap-4">
                  <div>
                    <Label className="text-gray-500">Category</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingActivityData).category}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Quantity</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingActivityData).quantity}{" "}
                      {(selectedItem as PendingActivityData).unit}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Activity Date</Label>
                    <p className="font-medium">
                      {format(
                        new Date((selectedItem as PendingActivityData).activity_date),
                        "PP"
                      )}
                    </p>
                  </div>
                </div>
              )}
              {activeTab === "facilities" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Facility Type</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingFacility).facility_type || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Location</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingFacility).location || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">City</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingFacility).city || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Country</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingFacility).country || "-"}
                    </p>
                  </div>
                </div>
              )}
              {activeTab === "products" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">SKU</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingProduct).sku || "-"}
                    </p>
                  </div>
                  <div className="col-span-2">
                    <Label className="text-gray-500">Description</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingProduct).product_description || "-"}
                    </p>
                  </div>
                </div>
              )}
              {activeTab === "suppliers" && (
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label className="text-gray-500">Contact Name</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingSupplier).contact_name || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Contact Email</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingSupplier).contact_email || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">City</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingSupplier).city || "-"}
                    </p>
                  </div>
                  <div>
                    <Label className="text-gray-500">Country</Label>
                    <p className="font-medium">
                      {(selectedItem as PendingSupplier).country || "-"}
                    </p>
                  </div>
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDetailDialog(false)}>
              Close
            </Button>
            <Button
              variant="destructive"
              onClick={() => {
                setShowDetailDialog(false);
                if (selectedItem) openRejectDialog(selectedItem);
              }}
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject
            </Button>
            <Button
              onClick={() => {
                if (selectedItem) handleApprove(selectedItem);
                setShowDetailDialog(false);
              }}
              disabled={processing}
            >
              <CheckCircle className="h-4 w-4 mr-2" />
              Approve
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
