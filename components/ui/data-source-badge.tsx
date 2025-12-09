import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Database, Award, Layers, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface DataSourceBadgeProps {
  dataSource?: string;
  gwpDataSource?: string;
  nonGwpDataSource?: string;
  isHybridSource?: boolean;
  dataQualityGrade?: string;
  confidenceScore?: number;
  showTooltip?: boolean;
  variant?: 'default' | 'outline' | 'compact';
  className?: string;
}

export function DataSourceBadge({
  dataSource,
  gwpDataSource,
  nonGwpDataSource,
  isHybridSource,
  dataQualityGrade,
  confidenceScore,
  showTooltip = true,
  variant = 'default',
  className,
}: DataSourceBadgeProps) {
  const getSourceInfo = () => {
    if (isHybridSource && gwpDataSource && nonGwpDataSource) {
      return {
        label: 'Hybrid',
        icon: Layers,
        color: 'bg-purple-50 text-purple-700 border-purple-200',
        tooltip: `GWP from ${gwpDataSource}, other impacts from ${nonGwpDataSource}`,
      };
    }

    const source = gwpDataSource || dataSource;

    if (source?.includes('Supplier') || dataQualityGrade === 'HIGH') {
      return {
        label: 'Supplier EPD',
        icon: Award,
        color: 'bg-green-50 text-green-700 border-green-200',
        tooltip: 'Third-party verified supplier data (95% confidence)',
      };
    }

    if (source?.includes('DEFRA')) {
      return {
        label: 'DEFRA 2025',
        icon: Database,
        color: 'bg-blue-50 text-blue-700 border-blue-200',
        tooltip: 'UK Government emission factors for regulatory compliance',
      };
    }

    if (source?.includes('Ecoinvent')) {
      return {
        label: 'Ecoinvent',
        icon: Database,
        color: 'bg-teal-50 text-teal-700 border-teal-200',
        tooltip: 'Ecoinvent 3.12 lifecycle inventory database',
      };
    }

    return {
      label: 'Unknown',
      icon: AlertCircle,
      color: 'bg-gray-50 text-gray-700 border-gray-200',
      tooltip: 'Data source not specified',
    };
  };

  const getQualityInfo = () => {
    if (dataQualityGrade === 'HIGH') {
      return {
        label: 'High',
        color: 'bg-green-50 text-green-700',
        tooltip: `High quality data (${confidenceScore || 95}% confidence)`,
      };
    }

    if (dataQualityGrade === 'MEDIUM') {
      return {
        label: 'Medium',
        color: 'bg-amber-50 text-amber-700',
        tooltip: `Medium quality data (${confidenceScore || 70}% confidence)`,
      };
    }

    if (dataQualityGrade === 'LOW') {
      return {
        label: 'Low',
        color: 'bg-red-50 text-red-700',
        tooltip: `Low quality data (${confidenceScore || 50}% confidence)`,
      };
    }

    return null;
  };

  const sourceInfo = getSourceInfo();
  const qualityInfo = getQualityInfo();
  const Icon = sourceInfo.icon;

  if (variant === 'compact') {
    const badge = (
      <Badge
        variant="outline"
        className={cn(
          'text-xs font-normal gap-1',
          sourceInfo.color,
          className
        )}
      >
        <Icon className="h-3 w-3" />
        {sourceInfo.label}
      </Badge>
    );

    if (showTooltip) {
      return (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>{badge}</TooltipTrigger>
            <TooltipContent>
              <p className="text-xs">{sourceInfo.tooltip}</p>
              {qualityInfo && (
                <p className="text-xs text-muted-foreground mt-1">{qualityInfo.tooltip}</p>
              )}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      );
    }

    return badge;
  }

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge variant="outline" className={cn('gap-1.5', sourceInfo.color)}>
              <Icon className="h-3.5 w-3.5" />
              {sourceInfo.label}
            </Badge>
          </TooltipTrigger>
          {showTooltip && (
            <TooltipContent>
              <p className="text-xs font-medium">{sourceInfo.tooltip}</p>
            </TooltipContent>
          )}
        </Tooltip>
      </TooltipProvider>

      {qualityInfo && (
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="outline" className={cn('text-xs', qualityInfo.color)}>
                {qualityInfo.label}
                {confidenceScore && <span className="ml-1">({confidenceScore}%)</span>}
              </Badge>
            </TooltipTrigger>
            {showTooltip && (
              <TooltipContent>
                <p className="text-xs">{qualityInfo.tooltip}</p>
              </TooltipContent>
            )}
          </Tooltip>
        </TooltipProvider>
      )}
    </div>
  );
}
