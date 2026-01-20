'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import {
  Leaf,
  ThumbsUp,
  ThumbsDown,
  ChevronDown,
  ChevronUp,
  Copy,
  Check,
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';
import { cn } from '@/lib/utils';
import { GaiaChartRenderer } from './GaiaChartRenderer';
import { GaiaDataGapResponse } from './GaiaDataGapResponse';
import { GaiaDataQualityBadge } from './GaiaDataQualityBadge';
import type { GaiaChartData, GaiaDataSource, GaiaDataQualityLevel, GaiaDataQualityIssue, GaiaIssueReport } from '@/lib/types/gaia';
import type { DataGapResponse } from '@/lib/gaia';

interface GaiaResponseLayoutProps {
  content: string;
  chartData?: GaiaChartData | null;
  dataSources?: GaiaDataSource[];
  timestamp: string;
  feedbackSubmitted?: boolean;
  onFeedback?: (rating: 'positive' | 'negative') => void;
  followUpSuggestions?: string[];
  onSuggestionClick?: (question: string) => void;
  // Data gap enhancement
  dataGapResponse?: DataGapResponse | null;
  onExplainClick?: (topic: string) => void;
  // Data quality
  dataQuality?: GaiaDataQualityLevel;
  dataQualityIssues?: GaiaDataQualityIssue[];
  onReportIssue?: (report: Omit<GaiaIssueReport, 'id' | 'user_id' | 'organization_id' | 'created_at' | 'status'>) => void;
  messageContext?: {
    query?: string;
    response?: string;
    dataType?: string;
  };
  // Display options
  maxInitialWords?: number;
  className?: string;
}

const MAX_WORDS_DEFAULT = 200;

export function GaiaResponseLayout({
  content,
  chartData,
  dataSources = [],
  timestamp,
  feedbackSubmitted = false,
  onFeedback,
  followUpSuggestions = [],
  onSuggestionClick,
  dataGapResponse,
  onExplainClick,
  dataQuality,
  dataQualityIssues,
  onReportIssue,
  messageContext,
  maxInitialWords = MAX_WORDS_DEFAULT,
  className,
}: GaiaResponseLayoutProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [copied, setCopied] = useState(false);
  const contentRef = useRef<HTMLDivElement>(null);

  const words = content.split(' ');
  const isLongContent = words.length > maxInitialWords;
  const displayContent = isExpanded || !isLongContent
    ? content
    : words.slice(0, maxInitialWords).join(' ') + '...';

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-GB', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleCopyContent = async () => {
    await navigator.clipboard.writeText(content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={cn('flex gap-3', className)}>
      {/* Gaia Avatar */}
      <div className="flex-shrink-0 h-8 w-8 rounded-full bg-gradient-to-br from-emerald-500 to-teal-500 flex items-center justify-center">
        <Leaf className="h-4 w-4 text-white" />
      </div>

      <div className="max-w-[85%] space-y-2 flex-1">
        <Card className="bg-card border-border">
          <CardContent className="p-3">
            {/* Data Quality Badge (if applicable) */}
            {dataQuality && (
              <div className="mb-3">
                <GaiaDataQualityBadge
                  quality={dataQuality}
                  issues={dataQualityIssues}
                  onReportIssue={onReportIssue}
                  messageContext={messageContext}
                />
              </div>
            )}

            {/* Main Content */}
            {dataGapResponse ? (
              <GaiaDataGapResponse
                response={dataGapResponse}
                onSuggestionClick={onSuggestionClick || (() => {})}
                onExplainClick={onExplainClick}
              />
            ) : (
              <div ref={contentRef}>
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => (
                        <p className="mb-2 text-sm whitespace-pre-wrap">{children}</p>
                      ),
                      strong: ({ children }) => (
                        <strong className="font-semibold">{children}</strong>
                      ),
                      ul: ({ children }) => (
                        <ul className="list-disc list-inside mb-2 text-sm space-y-1">{children}</ul>
                      ),
                      ol: ({ children }) => (
                        <ol className="list-decimal list-inside mb-2 text-sm space-y-1">{children}</ol>
                      ),
                      li: ({ children }) => <li className="text-sm">{children}</li>,
                      table: ({ children }) => (
                        <div className="overflow-x-auto my-2">
                          <table className="min-w-full border-collapse text-sm">{children}</table>
                        </div>
                      ),
                      th: ({ children }) => (
                        <th className="border border-border bg-muted px-3 py-1.5 text-left font-medium">
                          {children}
                        </th>
                      ),
                      td: ({ children }) => (
                        <td className="border border-border px-3 py-1.5">{children}</td>
                      ),
                    }}
                  >
                    {displayContent}
                  </ReactMarkdown>
                </div>

                {/* Expand/Collapse button for long content */}
                {isLongContent && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-2 text-xs text-emerald-600 hover:text-emerald-700 hover:bg-emerald-500/10"
                    onClick={() => setIsExpanded(!isExpanded)}
                  >
                    {isExpanded ? (
                      <>
                        <ChevronUp className="h-3 w-3 mr-1" />
                        Show less
                      </>
                    ) : (
                      <>
                        <ChevronDown className="h-3 w-3 mr-1" />
                        Show more ({words.length - maxInitialWords} more words)
                      </>
                    )}
                  </Button>
                )}
              </div>
            )}

            {/* Chart rendering */}
            {chartData && (
              <div className="mt-4">
                <GaiaChartRenderer chartData={chartData} />
              </div>
            )}

            {/* Footer: Timestamp, Copy, and Feedback */}
            <div className="flex items-center justify-between mt-3 pt-3 border-t border-border">
              <span className="text-xs text-muted-foreground">{formatTime(timestamp)}</span>

              <div className="flex items-center gap-1">
                {/* Copy button */}
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6"
                        onClick={handleCopyContent}
                      >
                        {copied ? (
                          <Check className="h-3 w-3 text-emerald-500" />
                        ) : (
                          <Copy className="h-3 w-3" />
                        )}
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>{copied ? 'Copied!' : 'Copy response'}</TooltipContent>
                  </Tooltip>
                </TooltipProvider>

                {/* Feedback buttons */}
                {onFeedback && (
                  feedbackSubmitted ? (
                    <span className="text-xs text-muted-foreground">Thanks for feedback!</span>
                  ) : (
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onFeedback('positive')}
                          >
                            <ThumbsUp className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Helpful</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-6 w-6"
                            onClick={() => onFeedback('negative')}
                          >
                            <ThumbsDown className="h-3 w-3" />
                          </Button>
                        </TooltipTrigger>
                        <TooltipContent>Not helpful</TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  )
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Data sources */}
        {dataSources && dataSources.length > 0 && (
          <div className="flex flex-wrap gap-1 px-1">
            {dataSources.map((source, i) => (
              <Badge key={i} variant="secondary" className="text-xs">
                {source.description}
              </Badge>
            ))}
          </div>
        )}

        {/* Follow-up suggestions - ALWAYS visible without scrolling */}
        {followUpSuggestions.length > 0 && onSuggestionClick && (
          <div className="pt-2">
            <div className="flex flex-wrap gap-2">
              {followUpSuggestions.slice(0, 3).map((suggestion, idx) => (
                <Button
                  key={idx}
                  variant="outline"
                  size="sm"
                  className="text-xs bg-emerald-500/5 border-emerald-500/20 hover:bg-emerald-500/10 hover:border-emerald-500/40"
                  onClick={() => onSuggestionClick(suggestion)}
                >
                  {suggestion}
                </Button>
              ))}
            </div>

            {/* Show more suggestions if available */}
            {followUpSuggestions.length > 3 && (
              <Button
                variant="ghost"
                size="sm"
                className="mt-2 text-xs text-emerald-600"
                onClick={() => {
                  // Could expand to show all, for now just show count
                }}
              >
                <ChevronDown className="h-3 w-3 mr-1" />
                {followUpSuggestions.length - 3} more suggestions
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default GaiaResponseLayout;
