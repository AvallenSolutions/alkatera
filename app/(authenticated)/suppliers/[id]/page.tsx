"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageLoader } from "@/components/ui/page-loader";
import {
  ArrowLeft,
  Building2,
  Mail,
  MapPin,
  Package,
  FileText,
  Edit,
  Trash2,
  Phone,
  Globe,
  Calendar,
  TrendingUp
} from "lucide-react";
import { supabase } from "@/lib/supabaseClient";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

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
  updated_at: string;
}

interface SupplierEngagement {
  status: string;
  invited_date: string | null;
  accepted_date: string | null;
  data_submitted_date: string | null;
  last_contact_date: string | null;
  data_quality_score: number | null;
}

interface SupplierProduct {
  id: string;
  name: string;
  description: string | null;
  category: string | null;
  unit: string;
  carbon_intensity: number | null;
  product_code: string | null;
  is_active: boolean;
  created_at: string;
}

export default function SupplierDetailPage() {
  const params = useParams();
  const router = useRouter();
  const supplierId = params.id as string;

  const [supplier, setSupplier] = useState<Supplier | null>(null);
  const [engagement, setEngagement] = useState<SupplierEngagement | null>(null);
  const [products, setProducts] = useState<SupplierProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    if (supplierId) {
      fetchSupplierData();
    }
  }, [supplierId]);

  const fetchSupplierData = async () => {
    try {
      setLoading(true);

      // Fetch supplier details
      const { data: supplierData, error: supplierError } = await supabase
        .from("suppliers")
        .select("*")
        .eq("id", supplierId)
        .maybeSingle();

      if (supplierError) throw supplierError;
      if (!supplierData) {
        toast.error("Supplier not found");
        router.push("/suppliers");
        return;
      }

      setSupplier(supplierData);

      // Fetch engagement data
      const { data: engagementData } = await supabase
        .from("supplier_engagements")
        .select("*")
        .eq("supplier_id", supplierId)
        .maybeSingle();

      setEngagement(engagementData);

      // Fetch products
      const { data: productsData } = await supabase
        .from("supplier_products")
        .select("*")
        .eq("supplier_id", supplierId)
        .order("created_at", { ascending: false });

      setProducts(productsData || []);

    } catch (error: any) {
      console.error("Error fetching supplier:", error);
      toast.error(error.message || "Failed to load supplier data");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async () => {
    setIsDeleting(true);

    try {
      const { error } = await supabase
        .from("suppliers")
        .delete()
        .eq("id", supplierId);

      if (error) throw error;

      toast.success("Supplier deleted successfully");
      router.push("/suppliers");
    } catch (error: any) {
      console.error("Error deleting supplier:", error);
      toast.error(error.message || "Failed to delete supplier");
      setIsDeleting(false);
    }
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "Not set";
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
        return <Badge className="bg-green-600">Data Provided</Badge>;
      case "active":
        return <Badge className="bg-blue-600">Active</Badge>;
      case "invited":
        return <Badge className="bg-amber-600 text-white">Invited</Badge>;
      case "inactive":
        return <Badge variant="secondary">Inactive</Badge>;
      default:
        return <Badge variant="outline">No Engagement</Badge>;
    }
  };

  if (loading) {
    return <PageLoader message="Loading supplier details..." />;
  }

  if (!supplier) {
    return null;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="space-y-2 flex-1">
          <Link href="/suppliers">
            <Button variant="ghost" size="sm" className="gap-2 mb-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Suppliers
            </Button>
          </Link>
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-lg bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
              <Building2 className="h-8 w-8 text-muted-foreground" />
            </div>
            <div>
              <h1 className="text-3xl font-bold">{supplier.name}</h1>
              <p className="text-muted-foreground">
                {supplier.industry_sector || "No industry specified"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm">
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="outline" size="sm" className="text-red-600 hover:text-red-700">
                <Trash2 className="h-4 w-4 mr-2" />
                Delete
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete Supplier</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete "{supplier.name}"? This action cannot be undone and will remove all associated products and data.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={isDeleting}>Cancel</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  disabled={isDeleting}
                  className="bg-red-600 hover:bg-red-700"
                >
                  {isDeleting ? "Deleting..." : "Delete Supplier"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>
      </div>

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="products">
            Products ({products.length})
          </TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="location">Location</TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-6 md:grid-cols-2">
            {/* Company Profile */}
            <Card>
              <CardHeader>
                <CardTitle>Company Profile</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Company Name</p>
                    <p className="text-sm text-muted-foreground">{supplier.name}</p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <TrendingUp className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Industry Sector</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.industry_sector || "Not specified"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <MapPin className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Country</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.country || "Not specified"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Contact Information */}
            <Card>
              <CardHeader>
                <CardTitle>Contact Information</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-start gap-3">
                  <Mail className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Email</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.contact_email || "Not provided"}
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <Building2 className="h-5 w-5 text-muted-foreground mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium">Contact Person</p>
                    <p className="text-sm text-muted-foreground">
                      {supplier.contact_name || "Not provided"}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Engagement Status */}
            <Card>
              <CardHeader>
                <CardTitle>Engagement Status</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Current Status</p>
                  {engagement && getEngagementBadge(engagement.status)}
                </div>

                {engagement && (
                  <>
                    <div className="space-y-2 pt-2 border-t">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Invited:</span>
                        <span>{formatDate(engagement.invited_date)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Accepted:</span>
                        <span>{formatDate(engagement.accepted_date)}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-muted-foreground">Data Submitted:</span>
                        <span>{formatDate(engagement.data_submitted_date)}</span>
                      </div>
                      {engagement.data_quality_score && (
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-muted-foreground">Data Quality:</span>
                          <span className="font-semibold">{engagement.data_quality_score}/100</span>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Business Metrics */}
            <Card>
              <CardHeader>
                <CardTitle>Business Metrics</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Annual Spend</p>
                  <p className="text-sm font-semibold">
                    {formatCurrency(supplier.annual_spend, supplier.spend_currency)}
                  </p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Products in Portfolio</p>
                  <p className="text-sm font-semibold">{products.length}</p>
                </div>

                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">Active Products</p>
                  <p className="text-sm font-semibold">
                    {products.filter(p => p.is_active).length}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Notes */}
          {supplier.notes && (
            <Card>
              <CardHeader>
                <CardTitle>Notes</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                  {supplier.notes}
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* Products Tab */}
        <TabsContent value="products" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>Product Portfolio</CardTitle>
                <CardDescription>
                  Products and materials provided by this supplier
                </CardDescription>
              </div>
              <Button>
                <Package className="h-4 w-4 mr-2" />
                Add Product
              </Button>
            </CardHeader>
            <CardContent>
              {products.length === 0 ? (
                <div className="text-center py-12">
                  <Package className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                  <p className="text-sm text-muted-foreground">
                    No products added yet. Start building this supplier's product portfolio.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <h4 className="font-medium">{product.name}</h4>
                          {!product.is_active && (
                            <Badge variant="secondary" className="text-xs">Inactive</Badge>
                          )}
                        </div>
                        {product.description && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {product.description}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          {product.category && <span>Category: {product.category}</span>}
                          <span>Unit: {product.unit}</span>
                          {product.carbon_intensity && (
                            <span>Carbon: {product.carbon_intensity} kg CO₂e/{product.unit}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Evidence Tab */}
        <TabsContent value="evidence" className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle>LCA Evidence & Documentation</CardTitle>
                <CardDescription>
                  EPDs, LCA reports, and certificates from this supplier
                </CardDescription>
              </div>
              <Button>
                <FileText className="h-4 w-4 mr-2" />
                Upload Document
              </Button>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <FileText className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground">
                  No documents uploaded yet. Upload EPDs, LCA reports, or certificates.
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Location Tab */}
        <TabsContent value="location" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Supplier Location</CardTitle>
              <CardDescription>
                Geographic location and facilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-12">
                <MapPin className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <p className="text-sm text-muted-foreground mb-2">
                  Location mapping coming soon
                </p>
                <p className="text-xs text-muted-foreground">
                  Country: {supplier.country || "Not specified"}
                </p>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
