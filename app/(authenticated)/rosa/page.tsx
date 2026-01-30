'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RosaChat } from '@/components/gaia';

function RosaPageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;

  return (
    <div className="h-full overflow-hidden">
      <RosaChat fullPage initialPrompt={initialPrompt} />
    </div>
  );
}

export default function RosaPage() {
  return (
    <Suspense fallback={<div className="h-full" />}>
      <RosaPageContent />
    </Suspense>
  );
}
