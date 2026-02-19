"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";

/**
 * Legacy supplier-onboarding page.
 * Old invitation emails linked to /supplier-onboarding?token=xxx.
 * This component now redirects to the new /supplier-invite/{token} page.
 */
export default function SupplierOnboardingContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams?.get("token");

  useEffect(() => {
    if (token) {
      router.replace(`/supplier-invite/${token}`);
    } else {
      // No token — redirect to home
      router.replace("/");
    }
  }, [token, router]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="h-12 w-12 animate-spin text-blue-500" />
        <p className="text-slate-400">Redirecting...</p>
      </div>
    </div>
  );
}
