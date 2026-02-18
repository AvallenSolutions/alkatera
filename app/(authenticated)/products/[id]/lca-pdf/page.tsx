"use client";

/**
 * @deprecated This page used the old print-to-PDF approach.
 * Redirects to the new LCA Report Generator at /products/[id]/lca-report.
 */

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

export default function LCAPDFPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params?.id as string;

  useEffect(() => {
    if (productId) {
      router.replace(`/products/${productId}/lca-report`);
    }
  }, [productId, router]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <p className="text-muted-foreground">Redirecting to LCA Report Generator...</p>
    </div>
  );
}
