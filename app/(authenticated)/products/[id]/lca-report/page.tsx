'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { ArrowLeft, ClipboardCheck } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabaseClient';
import { LcaReportGenerator } from '@/components/lca/LcaReportGenerator';

export default function LcaReportPage() {
  const params = useParams();
  const productId = params?.id as string;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [productName, setProductName] = useState('');
  const [pcfId, setPcfId] = useState<string | null>(null);

  useEffect(() => {
    if (!productId) return;
    loadData();
  }, [productId]);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Fetch the product
      const { data: product, error: productError } = await supabase
        .from('products')
        .select('id, name')
        .eq('id', productId)
        .single();

      if (productError || !product) {
        setError('Product not found');
        return;
      }

      setProductName(product.name);

      // Fetch the latest completed PCF for this product
      const { data: pcf, error: pcfError } = await supabase
        .from('product_carbon_footprints')
        .select('id, status')
        .eq('product_id', productId)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (pcfError) {
        setError('Failed to load LCA data');
        return;
      }

      if (!pcf) {
        setError('no-lca');
        return;
      }

      setPcfId(pcf.id);
    } catch (err) {
      console.error('Error loading LCA report data:', err);
      setError('An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto py-8 space-y-6">
      {/* Navigation */}
      <div className="flex items-center gap-2">
        <Link href={`/products/${productId}`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Back to Product
          </Button>
        </Link>
        <Link href={`/products/${productId}/compliance-wizard`}>
          <Button variant="ghost" size="sm" className="gap-2">
            <ClipboardCheck className="h-4 w-4" />
            Compliance Wizard
          </Button>
        </Link>
      </div>

      {/* Loading */}
      {loading && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-64" />
          <Skeleton className="h-4 w-96" />
          <Skeleton className="h-64 w-full" />
        </div>
      )}

      {/* Error: No LCA */}
      {!loading && error === 'no-lca' && (
        <div className="text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold">No LCA Data Available</h2>
          <p className="text-muted-foreground max-w-md mx-auto">
            You need to run a Life Cycle Assessment calculation before generating a report.
            Complete your product data and run the LCA calculation first.
          </p>
          <Link href={`/products/${productId}/calculate-lca`}>
            <Button className="bg-[#ccff00] hover:bg-[#b8e600] text-black font-semibold">
              Run LCA Calculation
            </Button>
          </Link>
        </div>
      )}

      {/* Error: Generic */}
      {!loading && error && error !== 'no-lca' && (
        <div className="text-center py-16 space-y-4">
          <h2 className="text-2xl font-bold text-destructive">Error</h2>
          <p className="text-muted-foreground">{error}</p>
          <Button variant="outline" onClick={loadData}>
            Try Again
          </Button>
        </div>
      )}

      {/* Report Generator */}
      {!loading && !error && pcfId && (
        <LcaReportGenerator
          pcfId={pcfId}
          productId={productId}
          productName={productName}
        />
      )}
    </div>
  );
}
