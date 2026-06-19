'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { VenuesManager } from '@/components/hospitality/VenuesManager';

export default function HospitalityVenuesPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <Link
        href="/hospitality/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Hospitality
      </Link>
      <VenuesManager />
    </div>
  );
}
