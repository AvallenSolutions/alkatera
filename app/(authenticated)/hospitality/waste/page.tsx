'use client';

import Link from 'next/link';
import { WasteManager } from '@/components/hospitality/WasteManager';

export default function HospitalityWastePage() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <Link
        href="/hospitality/"
        className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Hospitality
      </Link>
      <WasteManager />
    </div>
  );
}
