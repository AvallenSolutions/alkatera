'use client';

import Link from 'next/link';
import { VenuesManager } from '@/components/hospitality/VenuesManager';

export default function HospitalityVenuesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <Link
        href="/hospitality/"
        className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Hospitality
      </Link>
      <VenuesManager />
    </div>
  );
}
