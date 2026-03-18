"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Standalone billing page - redirects to the main settings billing tab.
 * All billing functionality is consolidated in /settings?tab=billing.
 */
export default function BillingRedirectPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/settings?tab=billing");
  }, [router]);

  return null;
}
