'use client';

import Link from 'next/link';
import { RecipeManager } from '@/components/hospitality/RecipeManager';
import { RECIPE_KINDS } from '@/lib/hospitality/recipe-kinds';

export default function HospitalityMealsPage() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <Link
        href="/hospitality/"
        className="inline-flex font-mono text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground transition-colors hover:text-foreground"
      >
        ← Hospitality
      </Link>
      <RecipeManager cfg={RECIPE_KINDS.meal} />
    </div>
  );
}
