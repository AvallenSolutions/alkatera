"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageLoader } from "@/components/ui/page-loader";
import {
  ArrowLeft,
  AlertCircle,
  CheckCircle2,
  Loader2,
  Shield,
  Info,
  TrendingUp,
  Database
} from "lucide-react";
import { getSupabaseBrowserClient } from "@/lib/supabase/browser-client";
import { validateMaterialsBeforeCalculation, type ProductMaterial } from "@/lib/impact-waterfall-resolver";
import { calculateProductLCA } from "@/lib/product-lca-calculator";
import { toast } from "sonner";

interface MaterialWithValidation extends ProductMaterial {
  hasData: boolean;
  dataQuality?: string;
  confidenceScore?: number;
  error?: string;
}

export default function CalculateLCAPage() {
  const router = useRouter();
  const params = useParams();
  const productId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [product, setProduct] = useState<any>(null);
  const [materials, setMaterials] = useState<MaterialWithValidation[]>([]);
  const [canCalculate, setCanCalculate] = useState(false);
  const [missingCount, setMissingCount] = useState(0);

  useEffect(() => {
    async function loadAndValidate() {
      const supabase = getSupabaseBrowserClient();

      try {
        setLoading(true);

        // Fetch product
        const { data: productData, error: productError } = await supabase
          .from('products')
          .select('*')
          .eq('id', productId)
          .maybeSingle();

        if (productError || !productData) {
          toast.error('Product not found');
          router.push('/products');
          return;
        }

        setProduct(productData);

        // Fetch materials
        const { data: materialsData, error: materialsError } = await supabase
          .from('product_materials')
          .select('*')
          .eq('product_id', productId);

        if (materialsError) {
          throw materialsError;
        }

        if (!materialsData || materialsData.length === 0) {
          toast.error('No materials found. Please add ingredients and packaging first.');
          router.push(`/products/${productId}`);
          return;
        }

        // Validate each material
        const validation = await validateMaterialsBeforeCalculation(materialsData as ProductMaterial[]);

        const materialsWithStatus: MaterialWithValidation[] = materialsData.map((mat) => {
          const validMaterial = validation.validMaterials.find((v) => v.material.id === mat.id);
          const missingMaterial = validation.missingData.find((m) => m.material.id === mat.id);

          if (validMaterial) {
            return {
              ...mat,
              hasData: true,
              dataQuality: validMaterial.resolved.data_quality_tag,
              confidenceScore: validMaterial.resolved.confidence_score
            };
          } else if (missingMaterial) {
            return {
              ...mat,
              hasData: false,
              error: missingMaterial.error
            };
          } else {
            return {
              ...mat,
              hasData: false,
              error: 'Unknown validation error'
            };
          }
        });

        setMaterials(materialsWithStatus);
        setCanCalculate(validation.valid);
        setMissingCount(validation.missingData.length);

      } catch (error: any) {
        console.error('Error loading materials:', error);
        toast.error(error.message || 'Failed to load materials');
      } finally {
        setLoading(false);
      }
    }

    loadAndValidate();
  }, [productId, router]);

  const handleCalculate = async () => {
    if (!canCalculate) {
      toast.error('Cannot calculate: some materials are missing emission data');
      return;
    }

    setCalculating(true);

    try {
      toast.info('Starting LCA calculation...');

      const result = await calculateProductLCA({
        productId,
        functionalUnit: `1 ${product.unit || 'unit'} of ${product.name}`,
        systemBoundary: 'cradle-to-gate',
        referenceYear: new Date().getFullYear()
      });

      if (!result.success) {
        throw new Error(result.error || 'Calculation failed');
      }

      toast.success('LCA calculation completed successfully');
      router.push(`/products/${productId}/report`);

    } catch (error: any) {
      console.error('Calculation error:', error);
      toast.error(error.message || 'Failed to calculate impact');
    } finally {
      setCalculating(false);
    }
  };

  const getQualityBadgeProps = (tag: string) => {
    switch (tag) {
      case 'Primary_Verified':
        return { variant: 'default' as const, className: 'bg-green-600 hover:bg-green-700', icon: Shield };
      case 'Regional_Standard':
        return { variant: 'default' as const, className: 'bg-blue-600 hover:bg-blue-700', icon: TrendingUp };
      case 'Secondary_Modelled':
        return { variant: 'secondary' as const, className: '', icon: Database };
      default:
        return { variant: 'secondary' as const, className: '', icon: Info };
    }
  };

  const getConfidenceColor = (score: number) => {
    if (score >= 85) return 'text-green-600 dark:text-green-400';
    if (score >= 70) return 'text-blue-600 dark:text-blue-400';
    return 'text-slate-600 dark:text-slate-400';
  };

  if (loading) {
    return <PageLoader message="Validating materials..." />;
  }

  return (
    <div className="container mx-auto p-6 max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Calculate Product Impact</h1>
          <p className="text-muted-foreground mt-1">
            ISO 14067 compliant carbon footprint calculation
          </p>
        </div>
        <Button variant="outline" onClick={() => router.push(`/products/${productId}`)}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Product
        </Button>
      </div>

      {/* Product Info */}
      {product && (
        <Card>
          <CardHeader>
            <CardTitle>{product.name}</CardTitle>
            <CardDescription>
              {product.product_description || 'No description'}
            </CardDescription>
          </CardHeader>
        </Card>
      )}

      {/* Validation Status */}
      {!canCalculate && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Missing Emission Data</AlertTitle>
          <AlertDescription>
            {missingCount} material{missingCount !== 1 ? 's are' : ' is'} missing emission factors.
            Please add emission data, select verified supplier products, or choose materials
            from the database before calculating.
          </AlertDescription>
        </Alert>
      )}

      {canCalculate && (
        <Alert className="border-green-200 bg-green-50 dark:bg-green-950/20">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertTitle className="text-green-900 dark:text-green-100">Ready to Calculate</AlertTitle>
          <AlertDescription className="text-green-800 dark:text-green-200">
            All materials have verified emission data. You can proceed with the calculation.
          </AlertDescription>
        </Alert>
      )}

      {/* Materials Table */}
      <Card>
        <CardHeader>
          <CardTitle>Materials Data Quality ({materials.length} items)</CardTitle>
          <CardDescription>
            Review data sources and quality before calculating impact
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Material Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Data Quality</TableHead>
                <TableHead className="text-right">Confidence</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {materials.map((material) => {
                const badgeProps = material.dataQuality ? getQualityBadgeProps(material.dataQuality) : null;
                const Icon = badgeProps?.icon;

                return (
                  <TableRow key={material.id}>
                    <TableCell className="font-medium">{material.material_name}</TableCell>
                    <TableCell className="capitalize">{material.material_type}</TableCell>
                    <TableCell className="text-right font-mono">
                      {material.quantity} {material.unit}
                    </TableCell>
                    <TableCell>
                      {material.hasData && badgeProps ? (
                        <Badge variant={badgeProps.variant} className={badgeProps.className}>
                          {Icon && <Icon className="h-3 w-3 mr-1" />}
                          {material.dataQuality?.replace('_', ' ')}
                        </Badge>
                      ) : (
                        <Badge variant="destructive">Missing Data</Badge>
                      )}
                    </TableCell>
                    <TableCell className="text-right">
                      {material.hasData && material.confidenceScore ? (
                        <span className={`font-semibold ${getConfidenceColor(material.confidenceScore)}`}>
                          {material.confidenceScore}%
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {material.hasData ? (
                        <CheckCircle2 className="h-4 w-4 text-green-600" />
                      ) : (
                        <AlertCircle className="h-4 w-4 text-red-600" />
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Data Quality Legend */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Data Quality Hierarchy</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex items-center gap-2">
            <Shield className="h-4 w-4 text-green-600" />
            <strong>Primary Verified:</strong>
            <span className="text-muted-foreground">
              Direct supplier EPDs and verified product carbon footprints (95% confidence)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-blue-600" />
            <strong>Regional Standard:</strong>
            <span className="text-muted-foreground">
              Government emission factors (DEFRA, EPA) for energy and transport (85% confidence)
            </span>
          </div>
          <div className="flex items-center gap-2">
            <Database className="h-4 w-4 text-slate-600" />
            <strong>Secondary Modelled:</strong>
            <span className="text-muted-foreground">
              Ecoinvent 3.12 life cycle database averages (50-70% confidence)
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Calculate Button */}
      <div className="flex justify-end">
        <Button
          onClick={handleCalculate}
          disabled={!canCalculate || calculating}
          size="lg"
          className="min-w-[200px]"
        >
          {calculating ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <CheckCircle2 className="mr-2 h-4 w-4" />
              Calculate Impact Report
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
