'use client';

import { Info } from 'lucide-react';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import Link from 'next/link';

interface PCFInfoTooltipProps {
  /** Show the full explanation or just a brief version */
  variant?: 'brief' | 'detailed';
  /** Custom trigger element (defaults to info icon) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Product Carbon Footprint (PCF) Information Tooltip
 *
 * Provides users with context about what PCF means and how it differs from full LCA.
 * Aligns with ISO 14067 and GHG Protocol Product Standard terminology.
 */
export function PCFInfoTooltip({
  variant = 'brief',
  children,
  className
}: PCFInfoTooltipProps) {
  const briefContent = (
    <div className="max-w-xs space-y-2">
      <p className="font-medium">Product Carbon Footprint (PCF)</p>
      <p className="text-muted-foreground text-xs">
        The total greenhouse gas emissions associated with a product throughout its lifecycle,
        measured in kg CO₂e per unit.
      </p>
      <p className="text-muted-foreground text-xs">
        Calculated using <span className="font-medium">ISO 14067</span> and{' '}
        <span className="font-medium">GHG Protocol Product Standard</span> methodology.
      </p>
    </div>
  );

  const detailedContent = (
    <div className="max-w-sm space-y-3 p-1">
      <p className="font-medium">Product Carbon Footprint (PCF)</p>
      <p className="text-muted-foreground text-xs">
        A Product Carbon Footprint measures the total greenhouse gas emissions
        associated with a product across its entire lifecycle - from raw material
        extraction through manufacturing, distribution, use, and disposal.
      </p>
      <div className="space-y-1.5">
        <p className="text-xs font-medium">Our methodology aligns with:</p>
        <ul className="text-muted-foreground text-xs list-disc pl-4 space-y-0.5">
          <li><span className="font-medium">ISO 14067:2018</span> - Carbon footprint of products</li>
          <li><span className="font-medium">GHG Protocol</span> - Product Life Cycle Standard</li>
          <li><span className="font-medium">DEFRA 2025</span> - UK Government emission factors</li>
        </ul>
      </div>
      <div className="pt-1 border-t">
        <Link
          href="/methodology"
          className="text-xs text-primary hover:underline"
        >
          Learn more about our methodology →
        </Link>
      </div>
    </div>
  );

  return (
    <TooltipProvider>
      <Tooltip delayDuration={200}>
        <TooltipTrigger asChild>
          {children || (
            <Button
              variant="ghost"
              size="icon"
              className={`h-5 w-5 rounded-full ${className}`}
            >
              <Info className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="sr-only">Product Carbon Footprint information</span>
            </Button>
          )}
        </TooltipTrigger>
        <TooltipContent side="top" className="bg-background">
          {variant === 'detailed' ? detailedContent : briefContent}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline PCF label with tooltip
 * Use this when displaying "Product Carbon Footprint" as a label with explanation
 */
export function PCFLabel({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      Product Carbon Footprint
      <PCFInfoTooltip variant="brief" />
    </span>
  );
}

/**
 * PCF badge for use in headers and cards
 */
export function PCFBadge({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full ${className}`}>
      PCF
      <PCFInfoTooltip variant="brief" />
    </span>
  );
}
