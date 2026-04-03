'use client'

import { useState } from 'react'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Dog, X } from 'lucide-react'

const SCOPE_TIPS: Record<number, string> = {
  1: 'Scope 1 covers direct emissions from fuel you burn on site. Add utility data at your facilities to populate this automatically.',
  2: 'Scope 2 covers purchased electricity and heat. Your grid electricity data flows here from facility utilities.',
  3: 'Scope 3 is your value chain. For most drinks companies, this is 80%+ of total emissions. Start with the categories where you have the best data.',
}

interface ScopeTipBannerProps {
  scope: 1 | 2 | 3
  hasData: boolean
}

export function ScopeTipBanner({ scope, hasData }: ScopeTipBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  if (hasData || dismissed) return null

  const tip = SCOPE_TIPS[scope]

  return (
    <Alert className="mb-4 border-emerald-400/20 bg-emerald-400/5">
      <div className="flex items-start gap-2">
        <Dog className="h-4 w-4 text-emerald-400 mt-0.5 shrink-0" />
        <AlertDescription className="flex-1 text-sm">
          {tip}
        </AlertDescription>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 shrink-0 text-muted-foreground hover:text-foreground -mt-0.5"
          onClick={() => setDismissed(true)}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
    </Alert>
  )
}
