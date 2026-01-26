"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Shield, Clock, Check, X, AlertCircle, Building2, Package } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";

interface SupplierProductForVerification {
  id: string;
  name: string;
  category: string | null;
  unit: string;
  carbon_intensity: number | null;
  product_code: string | null;
  created_at: string;
  is_verified: boolean;
  organization: {
    name: string;
  };
  supplier: {
    name: string;
  };
}

export default function SupplierVerificationPage() {
  const [products, setProducts] = useState<SupplierProductForVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAlkateraAdmin, setIsAlkateraAdmin] = useState(false);
  const isDevelopment = process.env.NODE_ENV === 'development';
  const hasAccess = isAlkateraAdmin || isDevelopment;
  const [selectedProduct, setSelectedProduct] = useState<SupplierProductForVerification | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (hasAccess) {
      fetchUnverifiedProducts();
    }
  }, [hasAccess]);

  const checkAdminStatus = async () => {
    try {
      const { data, error } = await supabase.rpc('is_alkatera_admin');

      if (error) {
        console.error('Error checking admin status:', error);
        setIsAlkateraAdmin(false);
      } else {
        setIsAlkateraAdmin(data === true);
      }
    } catch (err) {
      console.error('Error:', err);
      setIsAlkateraAdmin(false);
    } finally {
      setLoading(false);
    }
  };

  const fetchUnverifiedProducts = async () => {
    try {
      setLoading(true);

      const { data, error } = await supabase
        .from('supplier_products')
        .select(`
          id,
          name,
          category,
          unit,
          carbon_intensity,
          product_code,
          created_at,
          is_verified,
          organization:organizations(name),
          supplier:suppliers(name)
        `)
        .eq('is_verified', false)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Transform the data to match our interface
      const transformedData = (data || []).map((item: any) => ({
        ...item,
        organization: Array.isArray(item.organization) ? item.organization[0] : item.organization,
        supplier: Array.isArray(item.supplier) ? item.supplier[0] : item.supplier,
      }));

      setProducts(transformedData);
    } catch (err: any) {
      console.error('Error fetching products:', err);
      toast.error('Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = (product: SupplierProductForVerification) => {
    setSelectedProduct(product);
    setVerificationNotes("");
    setShowDialog(true);
  };

  const confirmVerification = async () => {
    if (!selectedProduct) return;

    try {
      setVerifying(true);

      const { data: user } = await supabase.auth.getUser();
      if (!user.user) throw new Error('Not authenticated');

      const { error } = await (supabase
        .from('supplier_products') as any)
        .update({
          is_verified: true,
          verified_by: user.user.id,
          verified_at: new Date().toISOString(),
          verification_notes: verificationNotes || null,
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      toast.success('Product verified successfully');
      setShowDialog(false);
      setSelectedProduct(null);
      setVerificationNotes("");
      await fetchUnverifiedProducts();
    } catch (err: any) {
      console.error('Error verifying product:', err);
      toast.error(err.message || 'Failed to verify product');
    } finally {
      setVerifying(false);
    }
  };

  if (loading && products.length === 0) {
    return <PageLoader />;
  }

  if (!hasAccess) {
    return (
      <div className="flex items-center justify-center min-h-screen p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-destructive" />
              Access Denied
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              This page is only accessible to Alkatera administrators. If you believe you should have access, please contact your system administrator.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-3xl font-bold tracking-tight">Supplier Product Verification</h1>
          {isDevelopment && !isAlkateraAdmin && (
            <Badge variant="secondary" className="text-xs">
              Development Mode
            </Badge>
          )}
        </div>
        <p className="text-muted-foreground mt-2">
          Review and verify supplier products to enable them in material search results
        </p>
      </div>

      {products.length === 0 ? (
        <Card>
          <CardContent className="py-12">
            <div className="text-center">
              <Shield className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
              <h3 className="text-lg font-semibold mb-2">All Products Verified</h3>
              <p className="text-muted-foreground">
                There are no pending supplier products requiring verification
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Pending Verification ({products.length})
            </CardTitle>
            <CardDescription>
              Products awaiting verification before appearing in material search
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Organisation</TableHead>
                  <TableHead>Supplier</TableHead>
                  <TableHead>Product Name</TableHead>
                  <TableHead>Category</TableHead>
                  <TableHead>Carbon Intensity</TableHead>
                  <TableHead>Submitted</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products.map((product) => (
                  <TableRow key={product.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Building2 className="h-4 w-4 text-muted-foreground" />
                        {product.organization?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Package className="h-4 w-4 text-muted-foreground" />
                        {product.supplier?.name || 'Unknown'}
                      </div>
                    </TableCell>
                    <TableCell>
                      <div>
                        <div className="font-medium">{product.name}</div>
                        {product.product_code && (
                          <div className="text-xs text-muted-foreground">
                            SKU: {product.product_code}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {product.category ? (
                        <Badge variant="outline">{product.category}</Badge>
                      ) : (
                        <span className="text-muted-foreground text-sm">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {product.carbon_intensity !== null ? (
                        <span className="font-mono text-sm">
                          {product.carbon_intensity.toFixed(4)} kg CO₂e/{product.unit}
                        </span>
                      ) : (
                        <span className="text-muted-foreground text-sm">Not provided</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <span className="text-sm text-muted-foreground">
                        {new Date(product.created_at).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric'
                        })}
                      </span>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        onClick={() => handleVerify(product)}
                        className="bg-emerald-600 hover:bg-emerald-700"
                      >
                        <Check className="h-4 w-4 mr-1" />
                        Verify
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}

      <Dialog open={showDialog} onOpenChange={setShowDialog}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Verify Supplier Product
            </DialogTitle>
            <DialogDescription>
              Confirm that this product data meets quality standards for material search
            </DialogDescription>
          </DialogHeader>

          {selectedProduct && (
            <div className="space-y-4">
              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  <strong>Organisation:</strong> {selectedProduct.organization?.name}
                  <br />
                  <strong>Supplier:</strong> {selectedProduct.supplier?.name}
                  <br />
                  <strong>Product:</strong> {selectedProduct.name}
                  {selectedProduct.product_code && (
                    <>
                      <br />
                      <strong>SKU:</strong> {selectedProduct.product_code}
                    </>
                  )}
                  <br />
                  <strong>Unit:</strong> {selectedProduct.unit}
                  {selectedProduct.carbon_intensity !== null && (
                    <>
                      <br />
                      <strong>Carbon Intensity:</strong> {selectedProduct.carbon_intensity.toFixed(4)} kg CO₂e/{selectedProduct.unit}
                    </>
                  )}
                </AlertDescription>
              </Alert>

              <div className="space-y-2">
                <Label htmlFor="verification_notes">Verification Notes (Optional)</Label>
                <Textarea
                  id="verification_notes"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add any notes about data quality checks performed, sources verified, or conditions of approval..."
                  rows={4}
                />
              </div>

              <Alert className="bg-emerald-50 border-emerald-200 dark:bg-emerald-950 dark:border-emerald-800">
                <Shield className="h-4 w-4 text-emerald-600" />
                <AlertDescription className="text-emerald-800 dark:text-emerald-100">
                  Once verified, this product will immediately appear in material search results for the organisation&apos;s users.
                </AlertDescription>
              </Alert>
            </div>
          )}

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDialog(false)}
              disabled={verifying}
            >
              Cancel
            </Button>
            <Button
              onClick={confirmVerification}
              disabled={verifying}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {verifying ? (
                <>Verifying...</>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Confirm Verification
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
