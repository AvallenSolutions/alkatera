"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Progress } from "@/components/ui/progress";
import { Shield, Clock, Check, X, AlertCircle, Building2, Package, RotateCcw } from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { toast } from "sonner";
import { PageLoader } from "@/components/ui/page-loader";
import { ESG_SECTIONS, ESG_QUESTIONS, getQuestionsBySection, type EsgResponse } from "@/lib/supplier-esg/questions";
import { getRatingLabel } from "@/lib/supplier-esg/scoring";
import type { EsgAssessmentForVerification } from "@/lib/types/supplier-esg";

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
  const [selectedProduct, setSelectedProduct] = useState<SupplierProductForVerification | null>(null);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [showDialog, setShowDialog] = useState(false);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    checkAdminStatus();
  }, []);

  useEffect(() => {
    if (isAlkateraAdmin) {
      fetchUnverifiedProducts();
    }
  }, [isAlkateraAdmin]);

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

  if (!isAlkateraAdmin) {
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
          <h1 className="text-3xl font-bold tracking-tight">Supplier Verification</h1>
        </div>
        <p className="text-muted-foreground mt-2">
          Review and verify supplier products and ESG assessments
        </p>
      </div>

      <Tabs defaultValue="products">
        <TabsList>
          <TabsTrigger value="products">Products</TabsTrigger>
          <TabsTrigger value="esg">ESG Assessments</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-6">
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
        </TabsContent>

        <TabsContent value="esg" className="space-y-6">
          <EsgVerificationTab />
        </TabsContent>
      </Tabs>

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

/** ESG Assessment Verification Tab */
function EsgVerificationTab() {
  const [assessments, setAssessments] = useState<EsgAssessmentForVerification[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAssessment, setSelectedAssessment] = useState<EsgAssessmentForVerification | null>(null);
  const [showReviewDialog, setShowReviewDialog] = useState(false);
  const [verificationNotes, setVerificationNotes] = useState("");
  const [processing, setProcessing] = useState(false);

  const supabase = getSupabaseBrowserClient();

  useEffect(() => {
    fetchAssessments();
  }, []);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('supplier_esg_assessments')
        .select(`
          *,
          supplier:suppliers(name)
        `)
        .eq('submitted', true)
        .eq('is_verified', false)
        .order('submitted_at', { ascending: false });

      if (error) throw error;

      const transformed = (data || []).map((item: any) => ({
        ...item,
        supplier: Array.isArray(item.supplier) ? item.supplier[0] : item.supplier,
      }));

      setAssessments(transformed);
    } catch (err: any) {
      console.error('Error fetching ESG assessments:', err);
      toast.error('Failed to load ESG assessments');
    } finally {
      setLoading(false);
    }
  };

  const handleReview = (assessment: EsgAssessmentForVerification) => {
    setSelectedAssessment(assessment);
    setVerificationNotes("");
    setShowReviewDialog(true);
  };

  const handleAction = async (action: 'verify' | 'request_revision') => {
    if (!selectedAssessment) return;

    try {
      setProcessing(true);
      const res = await fetch('/api/supplier-esg/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          assessment_id: selectedAssessment.id,
          action,
          notes: verificationNotes || undefined,
        }),
      });

      if (!res.ok) {
        const body = await res.json();
        throw new Error(body.error || 'Failed to process');
      }

      toast.success(
        action === 'verify'
          ? 'ESG assessment verified successfully'
          : 'Revision requested'
      );
      setShowReviewDialog(false);
      setSelectedAssessment(null);
      await fetchAssessments();
    } catch (err: any) {
      console.error('Error processing ESG verification:', err);
      toast.error(err.message || 'Failed to process');
    } finally {
      setProcessing(false);
    }
  };

  const getRatingBadge = (rating: string | null) => {
    if (!rating) return null;
    const styles: Record<string, string> = {
      leader: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30',
      progressing: 'bg-amber-500/20 text-amber-400 border-amber-500/30',
      needs_improvement: 'bg-red-500/20 text-red-400 border-red-500/30',
      not_assessed: 'bg-slate-500/20 text-slate-400 border-slate-500/30',
    };
    return (
      <Badge className={`text-xs ${styles[rating] || ''}`}>
        {getRatingLabel(rating as any)}
      </Badge>
    );
  };

  if (loading) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center text-muted-foreground">Loading ESG assessments...</div>
        </CardContent>
      </Card>
    );
  }

  if (assessments.length === 0) {
    return (
      <Card>
        <CardContent className="py-12">
          <div className="text-center">
            <Shield className="h-12 w-12 mx-auto text-emerald-600 mb-4" />
            <h3 className="text-lg font-semibold mb-2">All Assessments Reviewed</h3>
            <p className="text-muted-foreground">
              There are no pending ESG assessments requiring verification
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Pending ESG Verification ({assessments.length})
          </CardTitle>
          <CardDescription>
            ESG self-assessments submitted by suppliers awaiting review
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Supplier</TableHead>
                <TableHead>Score</TableHead>
                <TableHead>Rating</TableHead>
                <TableHead>Submitted</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assessments.map((a) => (
                <TableRow key={a.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <Building2 className="h-4 w-4 text-muted-foreground" />
                      {a.supplier?.name || 'Unknown'}
                    </div>
                  </TableCell>
                  <TableCell>
                    <span className="font-mono text-sm font-semibold">
                      {a.score_total ?? '—'}
                    </span>
                  </TableCell>
                  <TableCell>{getRatingBadge(a.score_rating)}</TableCell>
                  <TableCell>
                    <span className="text-sm text-muted-foreground">
                      {a.submitted_at
                        ? new Date(a.submitted_at).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                          })
                        : '—'}
                    </span>
                  </TableCell>
                  <TableCell>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleReview(a)}
                    >
                      Review
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      <Dialog open={showReviewDialog} onOpenChange={setShowReviewDialog}>
        <DialogContent className="max-w-3xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Shield className="h-5 w-5 text-emerald-600" />
              Review ESG Assessment
            </DialogTitle>
            <DialogDescription>
              {selectedAssessment?.supplier?.name} — Score: {selectedAssessment?.score_total ?? 'N/A'}
            </DialogDescription>
          </DialogHeader>

          {selectedAssessment && (
            <div className="space-y-6">
              {/* Score breakdown */}
              <div className="grid gap-3">
                {ESG_SECTIONS.map((section) => {
                  const scoreKey = {
                    labour_human_rights: 'score_labour',
                    environment: 'score_environment',
                    ethics: 'score_ethics',
                    health_safety: 'score_health_safety',
                    management_systems: 'score_management',
                  }[section.key] as keyof typeof selectedAssessment;
                  const score = (selectedAssessment[scoreKey] as number) ?? 0;

                  return (
                    <div key={section.key} className="space-y-1">
                      <div className="flex items-center justify-between text-sm">
                        <span>{section.label}</span>
                        <span className="font-medium">{score}%</span>
                      </div>
                      <Progress value={score} className="h-2" />
                    </div>
                  );
                })}
              </div>

              {/* Questions and answers */}
              {ESG_SECTIONS.map((section) => {
                const questions = getQuestionsBySection(section.key);
                const answers = (selectedAssessment.answers || {}) as Record<string, EsgResponse>;

                return (
                  <div key={section.key}>
                    <h4 className="font-semibold text-sm mb-2">{section.label}</h4>
                    <div className="space-y-2">
                      {questions.map((q) => {
                        const answer = answers[q.id];
                        const answerStyles: Record<string, string> = {
                          yes: 'bg-emerald-500/20 text-emerald-400',
                          partial: 'bg-amber-500/20 text-amber-400',
                          no: 'bg-red-500/20 text-red-400',
                          na: 'bg-slate-500/20 text-slate-400',
                        };
                        const answerLabels: Record<string, string> = {
                          yes: 'Yes',
                          partial: 'Partial',
                          no: 'No',
                          na: 'N/A',
                        };

                        return (
                          <div key={q.id} className="flex items-start justify-between gap-4 text-sm py-1.5 border-b border-border/50 last:border-0">
                            <span className="text-muted-foreground flex-1">{q.text}</span>
                            {answer ? (
                              <Badge className={`text-xs ${answerStyles[answer] || ''}`}>
                                {answerLabels[answer] || answer}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}

              {/* Notes */}
              <div className="space-y-2">
                <Label htmlFor="esg_verification_notes">Verification Notes (Optional)</Label>
                <Textarea
                  id="esg_verification_notes"
                  value={verificationNotes}
                  onChange={(e) => setVerificationNotes(e.target.value)}
                  placeholder="Add notes about the review, any concerns, or conditions..."
                  rows={3}
                />
              </div>
            </div>
          )}

          <DialogFooter className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => setShowReviewDialog(false)}
              disabled={processing}
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={() => handleAction('request_revision')}
              disabled={processing}
              className="text-amber-600 hover:text-amber-700"
            >
              <RotateCcw className="h-4 w-4 mr-1" />
              Request Revision
            </Button>
            <Button
              onClick={() => handleAction('verify')}
              disabled={processing}
              className="bg-emerald-600 hover:bg-emerald-700"
            >
              {processing ? (
                <>Processing...</>
              ) : (
                <>
                  <Check className="h-4 w-4 mr-1" />
                  Verify Assessment
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
