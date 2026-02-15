'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import {
  CheckCircle2,
  ChevronRight,
  Sparkles,
  X,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { CategoryStatus } from '@/lib/calculations/footprint-completeness';

interface FootprintProgressBannerProps {
  categories: CategoryStatus[];
  completedCount: number;
  totalCount: number;
  score: number;
  firstIncompleteCategory: CategoryStatus | null;
  onScrollToCategory?: (key: string) => void;
}

export function FootprintProgressBanner({
  categories,
  completedCount,
  totalCount,
  score,
  firstIncompleteCategory,
  onScrollToCategory,
}: FootprintProgressBannerProps) {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem('footprint-progress-banner-dismissed');
    if (stored === 'true') setDismissed(true);
  }, []);

  const handleDismiss = () => {
    setDismissed(true);
    localStorage.setItem('footprint-progress-banner-dismissed', 'true');
  };

  // Don't show if dismissed or all categories are complete
  if (dismissed || completedCount >= totalCount) return null;

  // Only show trackable (non-coming-soon) categories
  const trackableCategories = categories.filter(c => !c.isComingSoon);

  return (
    <Card className="border border-slate-200 dark:border-slate-700 bg-gradient-to-r from-slate-50 to-white dark:from-slate-900/50 dark:to-slate-900">
      <CardContent className="py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 space-y-3">
            {/* Header row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-emerald-500" />
                <span className="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {completedCount} of {totalCount} categories tracked
                </span>
              </div>
              <div className="flex-1 max-w-32">
                <Progress value={score} className="h-1.5" />
              </div>
              <span className="text-xs text-muted-foreground">{score}%</span>
            </div>

            {/* Category pills */}
            <div className="flex flex-wrap gap-1.5">
              {trackableCategories.map((cat) => (
                <Badge
                  key={cat.key}
                  variant="outline"
                  className={cn(
                    'text-[11px] font-normal cursor-default transition-colors',
                    cat.hasData
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300 dark:border-emerald-800'
                      : cat.isAutoCalculated
                        ? 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/30 dark:text-amber-300 dark:border-amber-800'
                        : 'bg-slate-50 text-slate-500 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700',
                  )}
                >
                  {cat.hasData && <CheckCircle2 className="h-3 w-3 mr-0.5" />}
                  {cat.shortLabel}
                </Badge>
              ))}
            </div>

            {/* Next action prompt */}
            {firstIncompleteCategory && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">Next:</span>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 text-xs text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 px-2"
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
