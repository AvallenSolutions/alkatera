'use client';

import { Badge } from '@/components/ui/badge';
import { CheckCircle2, Circle, ChevronRight } from 'lucide-react';

interface ProgressionModel {
  years: number[];
  labels: string[];
}

interface RequirementCount {
  total: number;
  passed: number;
}

interface YearProgressionStepperProps {
  progressionModel: ProgressionModel;
  currentYear: number;
  requirementCountsByYear: Record<number, RequirementCount>;
  onYearSelect?: (year: number) => void;
  selectedYear?: number;
}

export function YearProgressionStepper({
  progressionModel,
  currentYear,
  requirementCountsByYear,
  onYearSelect,
  selectedYear,
}: YearProgressionStepperProps) {
  const { years, labels } = progressionModel;

  return (
    <div className="flex items-center gap-0 w-full overflow-x-auto pb-2">
      {years.map((year, index) => {
        const counts = requirementCountsByYear[year] || { total: 0, passed: 0 };
        const isActive = year <= currentYear;
        const isCurrent = year === currentYear;
        const isSelected = year === selectedYear;
        const allPassed = counts.total > 0 && counts.passed === counts.total;
        const label = labels[index] || `Year ${year}`;

        return (
          <div key={year} className="flex items-center">
            {index > 0 && (
              <ChevronRight
                className={`h-4 w-4 mx-1 shrink-0 ${
                  isActive ? 'text-emerald-500' : 'text-muted-foreground/40'
                }`}
              />
            )}
            <button
              onClick={() => onYearSelect?.(year)}
              className={`
                flex flex-col items-center gap-1.5 px-4 py-3 rounded-lg border-2 transition-all min-w-[140px]
                ${isSelected
                  ? 'border-primary bg-primary/5'
                  : isCurrent
                    ? 'border-amber-500 bg-amber-50 dark:bg-amber-900/10'
                    : isActive
                      ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-900/10'
                      : 'border-muted bg-muted/30'
                }
                ${onYearSelect ? 'cursor-pointer hover:border-primary/70' : 'cursor-default'}
              `}
            >
              <div className="flex items-center gap-1.5">
                {allPassed ? (
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                ) : isActive ? (
                  <Circle className="h-4 w-4 text-amber-500 fill-amber-500/20" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    isCurrent
                      ? 'text-amber-700 dark:text-amber-400'
                      : isActive
                        ? 'text-emerald-700 dark:text-emerald-400'
                        : 'text-muted-foreground'
                  }`}
                >
                  Year {year}
                </span>
              </div>
              <span className="text-xs text-muted-foreground text-center leading-tight">
                {label.replace(/^Year \d+ — /, '')}
              </span>
              {counts.total > 0 && (
                <Badge
                  variant={allPassed ? 'default' : 'secondary'}
                  className={`text-xs ${allPassed ? 'bg-emerald-600' : ''}`}
                >
                  {counts.passed}/{counts.total} passed
                </Badge>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
