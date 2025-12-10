"use client";

import { Suspense } from "react";
import SupplierOnboardingContent from "./content";

function SupplierOnboardingLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900">
      <div className="flex flex-col items-center gap-4">
        <div className="h-12 w-12 bg-blue-500/20 rounded-full animate-pulse" />
        <p className="text-slate-400">Loading...</p>
      </div>
    </div>
  );
}

export default function SupplierOnboardingPage() {
  return (
    <Suspense fallback={<SupplierOnboardingLoading />}>
      <SupplierOnboardingContent />
    </Suspense>
  );
}
