'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { StateChip } from '@/components/studio';
import { CategoryStatus } from '@/lib/calculations/footprint-completeness';

interface FootprintProgressBannerProps {
  categories: CategoryStatus[];
  completedCount: number;
  totalCount: number;
  score: number;
  firstIncompleteCategory: CategoryStatus | null;
  onScrollToCategory?: (key: string) => void;
  year?: number;
}

export function FootprintProgressBanner({
  categories,
  completedCount,
  totalCount,
  score,
  firstIncompleteCategory,
  onScrollToCategory,
  year,
}: FootprintProgressBannerProps) {
  const [dismissed, setDismissed] = useState(false);
  const storageKey = year
    ? `footprint-progress-banner-dismissed-${year}`
    : 'footprint-progress-banner-dismissed';

  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored === 'true') setDismissed(true);
  }, [storageKey]);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem(storageKey, 'true');
  };

  // Don't show if dismissed or all categories are complete
  if (dismissed || completedCount >= totalCount) return null;

  // Show trackable (non-coming-soon) categories; N/A categories show with a distinct style
  const trackableCategories = categories.filter(c => !c.isComingSoon);

  return (
    <Card className="border-studio-hairline bg-studio-cream">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-room-accent" />
                <span className="text-sm font-medium text-foreground">
                  {completedCount} of {totalCount} categories tracked
                </span>
              </div>
              <div className="flex-1 max-w-32">
                <Progress value={score} className="h-1.5" />
              </div>
              <span className="text-xs text-muted-foreground">{score}%</span>
            </div>

            {/* Category chips */}
            <div className="flex flex-wrap gap-x-3 gap-y-1.5">
              {trackableCategories.map((cat) => {
                const tone = cat.isNotApplicable
                  ? 'quiet'
                  : cat.hasData
                    ? 'good'
                    : cat.isAutoCalculated
                      ? 'attention'
                      : 'quiet';
                return (
                  <StateChip
                    key={cat.key}
                    tone={tone}
                    className={cn(
                      'inline-flex items-center cursor-default',
                      cat.isNotApplicable && 'line-through',
                    )}
                  >
                    {cat.hasData && !cat.isNotApplicable && (
                      <CheckCircle2 className="h-3 w-3 mr-0.5 text-current" />
                    )}
                    {cat.shortLabel}
                    {cat.isNotApplicable && <span className="ml-0.5 not-italic">N/A</span>}
                  </StateChip>
                );
              })}
            </div>

            {/* Next action prompt */}
            {firstIncompleteCategory && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Next:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-room-accent px-2"
                  onClick={() => onScrollToCategory?.(firstIncompleteCategory.key)}
                >
                  Add {firstIncompleteCategory.label}
                  <ChevronRight className="h-3 w-3 ml-0.5" />
                </Button>
              </div>
            )}
          </div>

          {/* Dismiss button */}
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-muted-foreground hover:text-foreground shrink-0"
            onClick={handleDismiss}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
