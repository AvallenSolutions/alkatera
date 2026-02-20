'use client';

import React, { useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { EnhancedComplianceWizard } from '@/components/lca/EnhancedComplianceWizard';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Loader2, ArrowLeft, AlertTriangle } from 'lucide-react';

// ============================================================================
// PAGE COMPONENT
// ============================================================================

export default function ComplianceWizardPage() {
  const params = useParams();
  const productId = params?.id as string;
  const router = useRouter();

  const [pcfId, setPcfId] = useState<string | null>(null);
  const [productName, setProductName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ============================================================================
  // FETCH PRODUCT + OPTIONAL PCF
  // ============================================================================

  useEffect(() => {
    async function fetchData() {
      setLoading(true);
      setError(null);

      try {
        // Fetch product
        const { data: product, error: productError } = await supabase
          .from('products')
          .select('id, name')
          .eq('id', productId)
          .single();

        if (productError) throw productError;
        if (!product) throw new Error('Product not found');

        setProductName(product.name);

        // Optionally find existing PCF (may not exist for new LCAs)
        const { data: pcf } = await supabase
          .from('product_carbon_footprints')
          .select('id')
          .eq('product_id', productId)
          .order('updated_at', { ascending: false })
          .limit(1)
          .maybeSingle();

        setPcfId(pcf?.id || null);
      } catch (err: any) {
        console.error('[ComplianceWizardPage] Error:', err);
        setError(err.message || 'Failed to load product data');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [productId]);

  // ============================================================================
  // HANDLERS
  // ============================================================================

  const handleComplete = () => {
    router.push(`/products/${productId}/lca-report`);
  };

  const handleBack = () => {
    router.back();
  };

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading wizard...</p>
        </div>
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (error) {
    return (
      <div className="container mx-auto max-w-2xl py-12">
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Error Loading Wizard</AlertTitle>
          <AlertDescription className="mt-2">{error}</AlertDescription>
        </Alert>
        <div className="mt-6 flex gap-3">
          <Button variant="outline" onClick={handleBack}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Go Back
          </Button>
          <Button onClick={() => window.location.reload()}>Try Again</Button>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-muted/30">
      {/* Header */}
      <header className="border-b bg-background">
        <div className="container mx-auto flex items-center justify-between px-4 py-4">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" onClick={handleBack}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Product
            </Button>
            <div className="h-6 w-px bg-border" />
            <div>
              <h1 className="text-lg font-semibold">LCA Wizard</h1>
              <p className="text-sm text-muted-foreground">{productName}</p>
            </div>
          </div>
        </div>
      </header>

      {/* Wizard */}
      <main className="h-[calc(100vh-73px)]">
        <EnhancedComplianceWizard
          productId={productId}
          pcfId={pcfId}
          onComplete={handleComplete}
          onClose={handleBack}
        />
      </main>
    </div>
  );
}
