'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';
import { EnhancedComplianceWizard } from '@/components/lca/EnhancedComplianceWizard';
import { PillButton } from '@/components/studio/pill-button';
import { PageLoader } from '@/components/ui/page-loader';
import { ArrowLeft } from 'lucide-react';
import { useRosaPageContext } from '@/lib/rosa/RosaContextProvider';

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
    router.push(`/products/${productId}`);
  };

  const handleBack = () => {
    router.back();
  };

  // Tell Rosa what the user is doing in the LCA wizard so questions like
  // "what does cradle-to-grave mean?" or "which methodology applies to
  // me?" can be answered without the user copy-pasting their product
  // name and current step.
  const rosaSlice = useMemo(() => {
    if (!productId) return null
    return {
      id: 'compliance-wizard',
      label: `LCA wizard${productName ? ` for ${productName}` : ''}`,
      priority: 9,
      data: {
        product_id: productId,
        product_name: productName || null,
        pcf_id: pcfId,
        has_existing_pcf: !!pcfId,
      },
    }
  }, [productId, productName, pcfId])
  useRosaPageContext(rosaSlice)

  // ============================================================================
  // LOADING STATE
  // ============================================================================

  if (loading) {
    return (
      <div className="min-h-screen bg-studio-paper px-6 py-16">
        <PageLoader />
      </div>
    );
  }

  // ============================================================================
  // ERROR STATE
  // ============================================================================

  if (error) {
    return (
      <div className="mx-auto min-h-screen max-w-2xl space-y-5 bg-studio-paper px-6 py-16">
        <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-studio-stale">
          The cellar · LCA wizard
        </div>
        <h1 className="font-display text-3xl font-bold tracking-tight text-foreground">
          The wizard could not load.
        </h1>
        <p className="text-sm text-studio-dim">{error}</p>
        <div className="flex gap-3 pt-1">
          <PillButton variant="outline" onClick={handleBack}>
            <ArrowLeft className="h-4 w-4" />
            Go back
          </PillButton>
          <PillButton variant="room" onClick={() => window.location.reload()}>
            Try again
          </PillButton>
        </div>
      </div>
    );
  }

  // ============================================================================
  // MAIN RENDER
  // ============================================================================

  return (
    <div className="min-h-screen bg-studio-paper">
      {/* Statement header */}
      <header className="border-b border-studio-hairline bg-studio-paper">
        <div className="container mx-auto flex flex-col gap-3 px-6 py-5">
          <button
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 self-start font-mono text-[10px] font-bold uppercase tracking-[0.18em] text-studio-dim transition-colors duration-150 ease-studio hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to product
          </button>
          <div className="font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-room-accent">
            The cellar · LCA wizard
          </div>
          <h1 className="font-display text-3xl font-bold leading-none tracking-tight text-foreground">
            {productName || 'Lifecycle assessment.'}
          </h1>
        </div>
      </header>

      {/* Wizard */}
      <main className="h-[calc(100vh-129px)]">
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
