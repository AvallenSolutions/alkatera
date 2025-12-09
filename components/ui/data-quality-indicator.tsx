import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { CheckCircle2, AlertCircle, Info, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataQualityIndicatorProps {
  dataQualityGrade?: string;
  confidenceScore?: number;
  gwpDataSource?: string;
  nonGwpDataSource?: string;
  isHybridSource?: boolean;
  methodology?: string;
  dataQualityTag?: string;
  sourceReference?: string;
  variant?: 'card' | 'inline' | 'minimal';
  className?: string;
}

export function DataQualityIndicator({
  dataQualityGrade,
  confidenceScore = 50,
  gwpDataSource,
  nonGwpDataSource,
  isHybridSource,
  methodology,
  dataQualityTag,
  sourceReference,
  variant = 'inline',
  className,
}: DataQualityIndicatorProps) {
  const getQualityConfig = () => {
    if (dataQualityGrade === 'HIGH') {
      return {
        icon: CheckCircle2,
        color: 'text-green-600',
        bgColor: 'bg-green-50',
        borderColor: 'border-green-200',
        progressColor: 'bg-green-600',
        label: 'High Quality',
        description: 'Supplier verified with third-party certification',
      };
    }

    if (dataQualityGrade === 'MEDIUM') {
      return {
        icon: TrendingUp,
        color: 'text-amber-600',
        bgColor: 'bg-amber-50',
        borderColor: 'border-amber-200',
        progressColor: 'bg-amber-600',
        label: 'Medium Quality',
        description: 'Regional standard or industry average data',
      };
    }

    return {
      icon: AlertCircle,
      color: 'text-red-600',
      bgColor: 'bg-red-50',
      borderColor: 'border-red-200',
      progressColor: 'bg-red-600',
      label: 'Low Quality',
      description: 'Generic proxy data with broad assumptions',
    };
  };

  const config = getQualityConfig();
  const Icon = config.icon;

  if (variant === 'minimal') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <div className={cn('inline-flex items-center gap-2', className)}>
              <Icon className={cn('h-4 w-4', config.color)} />
              <span className="text-sm font-medium">{confidenceScore}%</span>
            </div>
          </TooltipTrigger>
          <TooltipContent>
            <div className="space-y-1">
              <p className="text-xs font-medium">{config.label}</p>
              <p className="text-xs text-muted-foreground">{config.description}</p>
              {methodology && (
                <p className="text-xs text-muted-foreground mt-2">
                  <span className="font-medium">Method:</span> {methodology}
                </p>
              )}
            </div>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (variant === 'inline') {
    return (
      <div className={cn('flex items-center gap-3 p-3 rounded-lg border', config.borderColor, config.bgColor, className)}>
        <Icon className={cn('h-5 w-5 flex-shrink-0', config.color)} />
        <div className="flex-1 min-w-0 space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">{config.label}</span>
            <Badge variant="outline" className="text-xs">
              {confidenceScore}% confidence
            </Badge>
            {isHybridSource && (
              <Badge variant="outline" className="text-xs bg-purple-50 text-purple-700">
                Hybrid
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Progress value={confidenceScore} className="h-1.5 flex-1" indicatorClassName={config.progressColor} />
          </div>
          {methodology && (
            <p className="text-xs text-muted-foreground truncate">
              {methodology}
            </p>
          )}
        </div>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Info className="h-4 w-4 text-muted-foreground cursor-help flex-shrink-0" />
            </TooltipTrigger>
            <TooltipContent className="max-w-xs">
              <div className="space-y-2">
                <div>
                  <p className="text-xs font-medium">{config.description}</p>
                </div>
                {gwpDataSource && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">GWP Source:</p>
                    <p className="text-xs">{gwpDataSource}</p>
                  </div>
                )}
                {nonGwpDataSource && nonGwpDataSource !== gwpDataSource && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Non-GWP Source:</p>
                    <p className="text-xs">{nonGwpDataSource}</p>
                  </div>
                )}
                {dataQualityTag && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Quality Tag:</p>
                    <p className="text-xs">{dataQualityTag}</p>
                  </div>
                )}
                {sourceReference && (
                  <div>
                    <p className="text-xs font-medium text-muted-foreground">Reference:</p>
                    <p className="text-xs">{sourceReference}</p>
                  </div>
                )}
              </div>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
    );
  }

  return (
    <Card className={cn('p-4 space-y-3', className)}>
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Icon className={cn('h-5 w-5', config.color)} />
          <h4 className="text-sm font-semibold">Data Quality</h4>
        </div>
        <Badge variant="outline" className={cn(config.bgColor, config.color)}>
          {config.label}
        </Badge>
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Confidence Score</span>
          <span className="font-mono font-semibold">{confidenceScore}%</span>
        </div>
        <Progress value={confidenceScore} className="h-2" indicatorClassName={config.progressColor} />
        <p className="text-xs text-muted-foreground">{config.description}</p>
      </div>

      {isHybridSource && (
        <div className="pt-3 border-t space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="bg-purple-50 text-purple-700">
              Hybrid Source
            </Badge>
          </div>
          <div className="space-y-1 text-xs">
            {gwpDataSource && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">GWP Data:</span>
                <span className="font-medium">{gwpDataSource}</span>
              </div>
            )}
            {nonGwpDataSource && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Non-GWP Data:</span>
                <span className="font-medium">{nonGwpDataSource}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {methodology && (
        <div className="pt-3 border-t">
          <p className="text-xs text-muted-foreground">
            <span className="font-medium">Methodology:</span> {methodology}
          </p>
        </div>
      )}

      {(dataQualityTag || sourceReference) && (
        <div className="pt-3 border-t space-y-1 text-xs">
          {dataQualityTag && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Quality Tag:</span>
              <span className="font-medium">{dataQualityTag}</span>
            </div>
          )}
          {sourceReference && (
            <div className="flex justify-between">
              <span className="text-muted-foreground">Reference:</span>
              <span className="font-medium truncate ml-2 max-w-[200px]">{sourceReference}</span>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}
