'use client';

import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { RosaChat } from '@/components/gaia';

function RosaPageContent() {
  const searchParams = useSearchParams();
  const initialPrompt = searchParams.get('prompt') || undefined;

  return (
    <div className="-mx-4 -my-6 sm:-mx-6 lg:-mx-8 h-[calc(100vh-4rem)] overflow-hidden">
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
