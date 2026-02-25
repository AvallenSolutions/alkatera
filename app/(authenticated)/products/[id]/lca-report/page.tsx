'use client';

/**
 * @deprecated This page has been replaced by the LCA Wizard's integrated Report step.
 * Redirects to the compliance wizard where PDF generation now lives.
 */

import { useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';

export default function LcaReportPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  useEffect(() => {
    if (productId) {
      router.replace(`/products/${productId}/compliance-wizard`);
    }
  }, [productId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to LCA Wizard...</p>
    </div>
  );
}
