'use client';

import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { RecipeManager } from '@/components/hospitality/RecipeManager';
import { BenchmarkingExport } from '@/components/hospitality/BenchmarkingExport';
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds';

export default function HospitalityRoomsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-4 p-4 sm:p-6">
      <Link
        href="/hospitality/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground"
      >
        <ChevronLeft className="mr-1 h-4 w-4" />
        Hospitality
      </Link>
      <RecipeManager cfg={RECIPE_KINDS.room_night} />
      <BenchmarkingExport />
    </div>
  );
}
