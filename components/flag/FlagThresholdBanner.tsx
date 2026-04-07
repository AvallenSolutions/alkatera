'use client'

import { AlertTriangle, ArrowRight, X } from 'lucide-react'
import { useState } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { useFlagThreshold } from '@/hooks/data/useFlagThreshold'

export function FlagThresholdBanner() {
  const { loading, flagExceeded, maxFlagPct, flagTargetsSet } = useFlagThreshold()
  const [dismissed, setDismissed] = useState(false)

  if (loading || !flagExceeded || flagTargetsSet || dismissed) {
    return null
  }

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-5 w-5 text-amber-400 mt-0.5 flex-shrink-0" />

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">FLAG Target Required</p>
          <p className="text-sm text-zinc-400 mt-1">
            Your land-based emissions represent {maxFlagPct}% of total Scope 1+2+3 emissions.
            Under SBTi FLAG Guidance v1.2, you must set separate FLAG science-based targets.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <Button asChild variant="outline" size="sm" className="border-amber-500/30 text-amber-400 hover:bg-amber-500/10">
            <Link href="/certifications/sbti">
              Set FLAG Targets
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </Button>
          <button
            onClick={() => setDismissed(true)}
            className="text-zinc-500 hover:text-zinc-300 transition-colors p-1 rounded"
            aria-label="Dismiss banner"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}
