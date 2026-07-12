'use client';

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
                  isActive ? 'text-studio-good' : 'text-muted-foreground/40'
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
                    ? 'border-studio-attention bg-studio-cream'
                    : isActive
                      ? 'border-studio-good/50 bg-studio-cream'
                      : 'border-muted bg-muted/30'
                }
                ${onYearSelect ? 'cursor-pointer hover:border-primary/70' : 'cursor-default'}
              `}
            >
              <div className="flex items-center gap-1.5">
                {allPassed ? (
                  <CheckCircle2 className="h-4 w-4 text-studio-good" />
                ) : isActive ? (
                  <Circle className="h-4 w-4 text-studio-attention fill-studio-attention/20" />
                ) : (
                  <Circle className="h-4 w-4 text-muted-foreground/40" />
                )}
                <span
                  className={`text-sm font-semibold ${
                    isCurrent
                      ? 'text-studio-attention'
                      : isActive
                        ? 'text-studio-good'
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
                <span
                  className={`font-mono text-[10px] font-bold uppercase tracking-[0.18em] tabular-nums ${
                    allPassed ? 'text-studio-good' : 'text-muted-foreground'
                  }`}
                >
                  {counts.passed}/{counts.total} passed
                </span>
              )}
            </button>
          </div>
        );
      })}
    </div>
  );
}
