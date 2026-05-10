'use client'

import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'
import { RosaCanvas } from '@/components/rosa/RosaCanvas'

function RosaPageContent() {
  const searchParams = useSearchParams()
  const initialPrompt = searchParams.get('prompt') || undefined
  return <RosaCanvas initialPrompt={initialPrompt} />
}

export default function RosaPage() {
  return (
    <Suspense fallback={<div className="h-[calc(100vh-4rem)]" />}>
      <RosaPageContent />
    </Suspense>
  )
}
