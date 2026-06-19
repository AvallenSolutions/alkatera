'use client'

import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { UniversalDropzone } from '@/components/layouts/UniversalDropzone'

/**
 * Reusable "Smart upload" trigger for data-entry pages. Opens the shared
 * UniversalDropzone (one classifier, one review UI) so the feature is
 * discoverable from the main journeys, not just the Rosa hub.
 */
export function SmartUploadButton({
  size = 'lg',
  className,
}: {
  size?: 'sm' | 'lg' | 'default'
  className?: string
}) {
  return (
    <UniversalDropzone
      trigger={
        <Button variant="outline" size={size} className={className}>
          <Sparkles className="mr-2 h-4 w-4 text-[#8da300] dark:text-[#ccff00]" />
          Smart upload
        </Button>
      }
    />
  )
}
