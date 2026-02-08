'use client'

import Link from 'next/link'
import { X, Leaf, CheckCircle2, Circle, PartyPopper } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import type { SetupProgress } from '@/hooks/data/useSetupProgress'

interface SetupProgressBannerProps {
  progress: SetupProgress
}

export function SetupProgressBanner({ progress }: SetupProgressBannerProps) {
  const { milestones, completedCount, totalCount, percentage, isComplete, dismiss } = progress

  // Find the first incomplete milestone to suggest as the next action
  const nextMilestone = milestones.find(m => !m.done)

  if (isComplete) {
    return (
      <Card className="border-emerald-400/20 bg-emerald-500/5">
        <CardContent className="py-4 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <PartyPopper className="h-4 w-4 text-emerald-400" />
              </div>
              <div>
                <p className="text-sm font-medium">You&apos;re all set!</p>
                <p className="text-xs text-muted-foreground">
                  Your sustainability dashboard is ready to go. Great work!
                </p>
              </div>
            </div>
            <Button variant="ghost" size="icon" onClick={dismiss} className="h-7 w-7 text-muted-foreground hover:text-foreground">
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>
    )
  }

  const getMessage = () => {
    if (completedCount === 0) return "Let's get your account set up — it only takes a few minutes."
    if (nextMilestone) {
      const actionMap: Record<string, string> = {
        facilities: 'add your first facility',
        products: 'create your first product',
        suppliers: 'add a supplier',
        team: 'invite a team member',
      }
      return `Nice progress! Next up: ${actionMap[nextMilestone.key] || nextMilestone.label.toLowerCase()}.`
    }
    return "You're almost there — just a few more steps."
  }

  return (
    <Card className="border-emerald-400/10 bg-gradient-to-r from-emerald-500/5 to-transparent">
      <CardContent className="py-4 px-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3 flex-1 min-w-0">
            <div className="h-8 w-8 rounded-full bg-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-0.5">
              <Leaf className="h-4 w-4 text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-medium">
                  You&apos;re {percentage}% set up
                </p>
                <span className="text-xs text-muted-foreground">
                  {completedCount} of {totalCount} complete
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1.5 bg-muted rounded-full mb-3 overflow-hidden">
                <div
                  className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
                  style={{ width: `${percentage}%` }}
                />
              </div>

              {/* Rosa message */}
              <p className="text-xs text-muted-foreground mb-3">
                {getMessage()}
              </p>

              {/* Milestone pills */}
              <div className="flex flex-wrap gap-2">
                {milestones.map(m => (
                  <Link
                    key={m.key}
                    href={m.href}
                    className={`inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-full transition-colors ${
                      m.done
                        ? 'bg-emerald-500/10 text-emerald-500 dark:text-emerald-400'
                        : 'bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground'
                    }`}
                  >
                    {m.done ? (
                      <CheckCircle2 className="h-3 w-3" />
                    ) : (
                      <Circle className="h-3 w-3" />
                    )}
                    {m.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>

          <Button variant="ghost" size="icon" onClick={dismiss} className="h-7 w-7 text-muted-foreground hover:text-foreground flex-shrink-0">
            <X className="h-4 w-4" />
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
