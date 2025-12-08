"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { PageLoader } from "@/components/ui/page-loader";
import { Input } from "@/components/ui/input";
import { Plus, Users, AlertCircle, Trash2, MoreVertical, Search, Building2, MapPin, Package, Lock } from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { useOrganization } from "@/lib/organizationContext";
import { useSupplierPermissions } from "@/hooks/useSupplierPermissions";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "sonner";

interface Supplier {
  id: string;
  name: string;
  contact_email: string | null;
  contact_name: string | null;
  industry_sector: string | null;
  country: string | null;
  annual_spend: number | null;
  spend_currency: string | null;
  notes: string | null;
  created_at: string;
}

interface SupplierWithEngagement extends Supplier {
  engagement_status?: string;
  product_count?: number;
}

export default function SuppliersPage() {
  const { currentOrganization } = useOrganization();
  const { canCreateSuppliers, canDeleteSuppliers } = useSupplierPermissions();
  const [suppliers, setSuppliers] = useState<SupplierWithEngagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [supplierToDelete, setSupplierToDelete] = useState<Supplier | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    if (currentOrganization?.id) {
      fetchSuppliers();
    } else {
      setLoading(false);
    }
  }, [currentOrganization?.id]);

  const fetchSuppliers = async () => {
    try {
      const { data: suppliersData, error: suppliersError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("organization_id", currentOrganization!.id)
        .order("created_at", { ascending: false });

      if (suppliersError) throw suppliersError;

      // Fetch engagement status for each supplier
      const suppliersWithEngagement = await Promise.all(
        (suppliersData || []).map(async (supplier) => {
          const { data: engagement } = await supabase
            .from("supplier_engagements")
            .select("status")
            .eq("supplier_id", supplier.id)
            .maybeSingle();

          const { count: productCount } = await supabase
            .from("supplier_products")
            .select("*", { count: "exact", head: true })
            .eq("supplier_id", supplier.id);

          return {
            ...supplier,
            engagement_status: engagement?.status || "no_engagement",
            product_count: productCount || 0,
          };
        })
      );

      setSuppliers(suppliersWithEngagement);
    } catch (error) {
      console.error("Error fetching suppliers:", error);
      toast.error("Failed to load suppliers");
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatCurrency = (amount: number | null, currency: string | null) => {
    if (!amount) return "Not specified";
    const currencySymbol = currency === "GBP" ? "£" : currency === "USD" ? "$" : "€";
    return `${currencySymbol}${amount.toLocaleString()}`;
  };

  const getEngagementBadge = (status: string) => {
    switch (status) {
      case "data_provided":
        return (
          <Badge variant="default" className="bg-green-600">
            Data Provided
          </Badge>
        );
      case "active":
        return (
          <Badge variant="default" className="bg-blue-600">
            Active
          </Badge>
        );
      case "invited":
        return (
          <Badge variant="secondary" className="bg-amber-600 text-white">
            Invited
          </Badge>
        );
      case "inactive":
        return (
          <Badge variant="secondary" className="bg-grey-600 text-white">
            Inactive
          </Badge>
        );
      default:
        return (
          <Badge variant="outline">
            No Engagement
          </Badge>
        );
    }
  };

  const handleDeleteClick = (supplier: Supplier, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setSupplierToDelete(supplier);
    setDeleteDialogOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!supplierToDelete) return;

    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierToDelete.id);

      if (error) throw error;

      toast.success(`Supplier "${supplierToDelete.name}" deleted successfully`);
      await fetchSuppliers();
      setDeleteDialogOpen(false);
      setSupplierToDelete(null);
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error(error.message || "Failed to delete supplier");
    } finally {
      setIsDeleting(false);
    }
  };

  const filteredSuppliers = suppliers.filter((supplier) => {
    if (!searchQuery) return true;

    const query = searchQuery.toLowerCase();
    return (
      supplier.name.toLowerCase().includes(query) ||
      supplier.country?.toLowerCase().includes(query) ||
      supplier.industry_sector?.toLowerCase().includes(query) ||
      supplier.contact_name?.toLowerCase().includes(query)
    );
  });

  if (loading) {
    return <PageLoader message="Loading suppliers..." />;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Suppliers</h1>
          <p className="text-muted-foreground mt-2">
            Manage your supply chain and supplier network
          </p>
        </div>
        {canCreateSuppliers ? (
          <Link href="/suppliers/new">
            <Button size="lg" className="gap-2">
              <Plus className="h-5 w-5" />
              Add New Supplier
            </Button>
          </Link>
        ) : (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button size="lg" className="gap-2" disabled>
                  <Lock className="h-5 w-5" />
                  Add New Supplier
                </Button>
              </TooltipTrigger>
              <TooltipContent>
                <p>Only administrators can add suppliers</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        )}
      </div>

      {suppliers.length > 0 && (
        <div className="relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search suppliers by name, country, industry, or contact..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
      )}

      {suppliers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No suppliers found. Add your first supplier to start building your supply chain network.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : filteredSuppliers.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                No suppliers match your search. Try adjusting your search terms.
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredSuppliers.map((supplier) => (
            <Card key={supplier.id} className="h-full hover:shadow-lg transition-shadow relative group">
              {canDeleteSuppliers && (
                <div className="absolute top-4 right-4 z-10">
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 opacity-0 group-hover:opacity-100 transition-opacity bg-white dark:bg-slate-800 shadow-sm"
                      >
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-red-600 focus:text-red-600"
                        onClick={(e) => handleDeleteClick(supplier, e)}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Delete Supplier
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              )}

              <Link href={`/suppliers/${supplier.id}`}>
                <CardHeader>
                  <div className="mb-4 aspect-video rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
                    <Building2 className="h-12 w-12 text-muted-foreground" />
                  </div>
                  <div className="space-y-1">
                    <CardTitle className="line-clamp-1">{supplier.name}</CardTitle>
                    <CardDescription className="line-clamp-1">
                      {supplier.industry_sector || "No industry specified"}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <MapPin className="h-3.5 w-3.5" />
                      Country:
                    </span>
                    <span className="font-medium">{supplier.country || "Not specified"}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Annual Spend:</span>
                    <span className="font-medium">{formatCurrency(supplier.annual_spend, supplier.spend_currency)}</span>
                  </div>

                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground flex items-center gap-1">
                      <Package className="h-3.5 w-3.5" />
                      Products:
                    </span>
                    <span className="font-medium">{supplier.product_count || 0}</span>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Status:</span>
                    {getEngagementBadge(supplier.engagement_status || "no_engagement")}
                  </div>

                  <div className="text-xs text-muted-foreground pt-2 border-t">
                    Added {formatDate(supplier.created_at)}
                  </div>
                </CardContent>
              </Link>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{supplierToDelete?.name}"? This action cannot be undone and will remove all associated data including products, engagement records, and uploaded documents.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              disabled={isDeleting}
              className="bg-red-600 hover:bg-red-700"
            >
              {isDeleting ? "Deleting..." : "Delete Supplier"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
