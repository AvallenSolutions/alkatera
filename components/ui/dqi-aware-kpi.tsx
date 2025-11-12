import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DqiBreakdown {
  high_quality_percentage: number;
  medium_quality_percentage: number;
  low_quality_percentage: number;
}

interface DqiAwareKpiProps {
  title: string;
  value: string | number;
  unit?: string;
  description?: string;
  dqiBreakdown?: DqiBreakdown;
  className?: string;
  trend?: {
    value: number;
    label: string;
  };
}

export function DqiAwareKpi({
  title,
  value,
  unit,
  description,
  dqiBreakdown,
  className,
  trend,
}: DqiAwareKpiProps) {
  const hasDqiData = dqiBreakdown && (
    dqiBreakdown.high_quality_percentage > 0 ||
    dqiBreakdown.medium_quality_percentage > 0 ||
    dqiBreakdown.low_quality_percentage > 0
  );

  return (
    <Card className={cn('', className)}>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="text-sm font-medium text-muted-foreground">
              {title}
            </CardTitle>
            {description && (
              <CardDescription className="text-xs mt-1">{description}</CardDescription>
            )}
          </div>
          {hasDqiData && (
            <TooltipProvider>
              <Tooltip>
                <TooltipTrigger asChild>
                  <button className="ml-2">
                    <AlertCircle className="h-4 w-4 text-muted-foreground" />
                  </button>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <div className="space-y-2">
                    <p className="font-semibold text-xs">Data Quality Breakdown</p>
                    <div className="space-y-1 text-xs">
                      {dqiBreakdown.high_quality_percentage > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="flex items-center gap-1">
                            <Badge variant="default" className="bg-green-600 h-4 px-1 text-[10px]">
                              High
                            </Badge>
                          </span>
                          <span>{dqiBreakdown.high_quality_percentage.toFixed(0)}%</span>
                        </div>
                      )}
                      {dqiBreakdown.medium_quality_percentage > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="flex items-center gap-1">
                            <Badge variant="secondary" className="bg-amber-500 text-white h-4 px-1 text-[10px]">
                              Medium
                            </Badge>
                          </span>
                          <span>{dqiBreakdown.medium_quality_percentage.toFixed(0)}%</span>
                        </div>
                      )}
                      {dqiBreakdown.low_quality_percentage > 0 && (
                        <div className="flex justify-between gap-2">
                          <span className="flex items-center gap-1">
                            <Badge variant="destructive" className="h-4 px-1 text-[10px]">
                              Low
                            </Badge>
                          </span>
                          <span>{dqiBreakdown.low_quality_percentage.toFixed(0)}%</span>
                        </div>
                      )}
                    </div>
                  </div>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
        </div>
      </CardHeader>
      <CardContent>
        <div className="flex items-baseline gap-2">
          <div className="text-3xl font-bold tracking-tight">
            {value}
          </div>
          {unit && (
            <div className="text-sm text-muted-foreground">{unit}</div>
          )}
        </div>
        {trend && (
          <p className="text-xs text-muted-foreground mt-2">
            <span className={cn(
              'font-medium',
              trend.value > 0 ? 'text-red-600' : 'text-green-600'
            )}>
              {trend.value > 0 ? '+' : ''}{trend.value}%
            </span>{' '}
            {trend.label}
          </p>
        )}
        {hasDqiData && (
          <div className="mt-3 h-2 w-full rounded-full bg-muted overflow-hidden flex">
            {dqiBreakdown.high_quality_percentage > 0 && (
              <div
                className="bg-green-600"
                style={{ width: `${dqiBreakdown.high_quality_percentage}%` }}
              />
            )}
            {dqiBreakdown.medium_quality_percentage > 0 && (
              <div
                className="bg-amber-500"
                style={{ width: `${dqiBreakdown.medium_quality_percentage}%` }}
              />
            )}
            {dqiBreakdown.low_quality_percentage > 0 && (
              <div
                className="bg-red-600"
                style={{ width: `${dqiBreakdown.low_quality_percentage}%` }}
              />
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
