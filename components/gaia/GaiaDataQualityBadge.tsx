'use client';

import React, { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, AlertTriangle, AlertCircle, Flag, X } from 'lucide-react';
import type { GaiaDataQualityLevel, GaiaDataQualityIssue, GaiaIssueReport } from '@/lib/types/gaia';
import { cn } from '@/lib/utils';

interface GaiaDataQualityBadgeProps {
  quality: GaiaDataQualityLevel;
  issues?: GaiaDataQualityIssue[];
  onReportIssue?: (report: Omit<GaiaIssueReport, 'id' | 'user_id' | 'organization_id' | 'created_at' | 'status'>) => void;
  messageContext?: {
    query?: string;
    response?: string;
    dataType?: string;
  };
  className?: string;
}

const qualityConfig: Record<
  GaiaDataQualityLevel,
  {
    icon: React.ComponentType<{ className?: string }>;
    label: string;
    color: string;
    bgColor: string;
  }
> = {
  high: {
    icon: CheckCircle,
    label: 'High Quality',
    color: 'text-emerald-600 dark:text-emerald-400',
    bgColor: 'bg-emerald-500/10',
  },
  medium: {
    icon: AlertTriangle,
    label: 'Medium Quality',
    color: 'text-yellow-600 dark:text-yellow-400',
    bgColor: 'bg-yellow-500/10',
  },
  low: {
    icon: AlertCircle,
    label: 'Needs Review',
    color: 'text-red-600 dark:text-red-400',
    bgColor: 'bg-red-500/10',
  },
};

const issueTypes = [
  { value: 'duplicate', label: 'Duplicate data' },
  { value: 'incorrect', label: 'Incorrect values' },
  { value: 'missing', label: 'Missing data' },
  { value: 'outdated', label: 'Outdated information' },
  { value: 'other', label: 'Other' },
];

export function GaiaDataQualityBadge({
  quality,
  issues = [],
  onReportIssue,
  messageContext,
  className,
}: GaiaDataQualityBadgeProps) {
  const [showReportDialog, setShowReportDialog] = useState(false);
  const [issueType, setIssueType] = useState<string>('');
  const [description, setDescription] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const config = qualityConfig[quality];
  const IconComponent = config.icon;

  const handleSubmitReport = async () => {
    if (!issueType || !onReportIssue) return;

    setIsSubmitting(true);
    try {
      await onReportIssue({
        issue_type: issueType as GaiaIssueReport['issue_type'],
        description,
        context: messageContext || {},
      });
      setShowReportDialog(false);
      setIssueType('');
      setDescription('');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <div className={cn('flex items-center gap-2', className)}>
        <Popover>
          <PopoverTrigger asChild>
            <Badge
              variant="secondary"
              className={cn(
                'cursor-pointer hover:opacity-80 transition-opacity',
                config.bgColor,
                config.color
              )}
            >
              <IconComponent className="h-3 w-3 mr-1" />
              {config.label}
              {issues.length > 0 && (
                <span className="ml-1 px-1.5 py-0.5 text-xs rounded-full bg-background/50">
                  {issues.length}
                </span>
              )}
            </Badge>
          </PopoverTrigger>
          <PopoverContent className="w-80" align="start">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-sm">Data Quality</h4>
                <Badge variant="outline" className={cn('text-xs', config.color)}>
                  {config.label}
                </Badge>
              </div>

              {issues.length > 0 ? (
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">Issues detected:</p>
                  <ul className="space-y-1">
                    {issues.map((issue, idx) => (
                      <li
                        key={idx}
                        className="text-xs flex items-start gap-2 text-muted-foreground"
                      >
                        <span
                          className={cn(
                            'mt-0.5 h-1.5 w-1.5 rounded-full flex-shrink-0',
                            issue.severity === 'high' && 'bg-red-500',
                            issue.severity === 'medium' && 'bg-yellow-500',
                            issue.severity === 'low' && 'bg-blue-500'
                          )}
                        />
                        {issue.message}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="text-xs text-muted-foreground">
                  No data quality issues detected.
                </p>
              )}

              {onReportIssue && (
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => setShowReportDialog(true)}
                >
                  <Flag className="h-3 w-3 mr-1.5" />
                  Report an Issue
                </Button>
              )}
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Report Issue Dialog */}
      <Dialog open={showReportDialog} onOpenChange={setShowReportDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Report Data Quality Issue</DialogTitle>
            <DialogDescription>
              Help us improve by reporting any data quality issues you've noticed.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="issue-type">Issue Type</Label>
              <Select value={issueType} onValueChange={setIssueType}>
                <SelectTrigger id="issue-type">
                  <SelectValue placeholder="Select issue type" />
                </SelectTrigger>
                <SelectContent>
                  {issueTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Please describe the issue you've noticed..."
                rows={4}
              />
            </div>

            {messageContext && (
              <div className="rounded-md bg-muted p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">Context:</p>
                {messageContext.query && (
                  <p className="text-xs text-muted-foreground truncate">
                    Query: {messageContext.query}
                  </p>
                )}
                {messageContext.dataType && (
                  <p className="text-xs text-muted-foreground">
                    Data type: {messageContext.dataType}
                  </p>
                )}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowReportDialog(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSubmitReport}
              disabled={!issueType || isSubmitting}
              className="bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-600 hover:to-teal-600"
            >
              {isSubmitting ? 'Submitting...' : 'Submit Report'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default GaiaDataQualityBadge;
