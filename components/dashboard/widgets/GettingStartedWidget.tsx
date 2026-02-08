'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle2, Circle, ArrowRight, Leaf, PartyPopper } from 'lucide-react'
import Link from 'next/link'
import { useSetupProgress } from '@/hooks/data/useSetupProgress'
import { Skeleton } from '@/components/ui/skeleton'

export function GettingStartedWidget() {
  const progress = useSetupProgress()
  const { milestones, completedCount, totalCount, percentage, isComplete, isLoading, isDismissed, dismiss } = progress

  // Don't render if dismissed
  if (isDismissed) return null

  if (isLoading) {
    return (
      <Card>
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Getting Started</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-2 w-full rounded-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </CardContent>
      </Card>
    )
  }

  // Celebration state when all milestones are done
  if (isComplete) {
    return (
      <Card className="border-emerald-400/20 bg-emerald-500/5">
        <CardContent className="flex flex-col items-center justify-center py-8 px-4 text-center">
          <div className="h-12 w-12 rounded-full bg-emerald-500/20 flex items-center justify-center mb-3">
            <PartyPopper className="h-6 w-6 text-emerald-400" />
          </div>
          <h3 className="text-sm font-semibold mb-1">You&apos;re all set!</h3>
          <p className="text-xs text-muted-foreground mb-4 max-w-xs">
            Your sustainability dashboard is fully configured. Time to start uncovering insights.
          </p>
          <Button variant="ghost" size="sm" onClick={dismiss} className="text-xs text-muted-foreground">
            Dismiss checklist
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Leaf className="h-4 w-4 text-emerald-400" />
            Getting Started
          </CardTitle>
          <Badge variant="secondary" className="text-xs">
            {completedCount}/{totalCount} complete
          </Badge>
        </div>
        {/* Progress bar */}
        <div className="h-1.5 bg-muted rounded-full overflow-hidden mt-2">
          <div
            className="h-full bg-emerald-400 rounded-full transition-all duration-500 ease-out"
            style={{ width: `${percentage}%` }}
          />
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {milestones.map((milestone) => (
          <div
            key={milestone.key}
            className={`flex items-center gap-3 p-3 rounded-lg transition-colors ${
              milestone.done
                ? 'bg-emerald-500/5'
                : 'bg-muted/30 hover:bg-muted/50'
            }`}
          >
            {milestone.done ? (
              <CheckCircle2 className="h-5 w-5 text-emerald-500 flex-shrink-0" />
            ) : (
              <Circle className="h-5 w-5 text-muted-foreground/40 flex-shrink-0" />
            )}
            <span className={`text-sm flex-1 ${
              milestone.done
                ? 'text-emerald-600 dark:text-emerald-400 line-through decoration-emerald-500/30'
                : 'font-medium'
            }`}>
              {milestone.label}
            </span>
            {milestone.done ? (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20">
                Done
              </Badge>
            ) : (
              <Button asChild size="sm" className="h-7 px-3 text-xs bg-neon-lime text-black hover:bg-neon-lime/90">
                <Link href={milestone.href}>
                  Go <ArrowRight className="ml-1 h-3 w-3" />
                </Link>
              </Button>
            )}
          </div>
        ))}

        <div className="pt-2 border-t mt-3">
          <button
            onClick={dismiss}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors w-full text-center py-1"
          >
            Dismiss checklist
          </button>
        </div>
      </CardContent>
    </Card>
  )
}
