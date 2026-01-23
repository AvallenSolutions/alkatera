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

interface PEIInfoTooltipProps {
  /** Show the full explanation or just a brief version */
  variant?: 'brief' | 'detailed';
  /** Custom trigger element (defaults to info icon) */
  children?: React.ReactNode;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Product Environmental Impact (PEI) Information Tooltip
 *
 * Provides users with context about what PEI means and how it covers multiple impact categories.
 * Aligns with ISO 14044/14067 and GHG Protocol methodology.
 */
export function PEIInfoTooltip({
  variant = 'brief',
  children,
  className
}: PEIInfoTooltipProps) {
  const briefContent = (
    <div className="max-w-xs space-y-2">
      <p className="font-medium">Product Environmental Impact (PEI)</p>
      <p className="text-muted-foreground text-xs">
        A comprehensive assessment of environmental impacts associated with a product throughout its lifecycle,
        including carbon, water, land use, and other critical factors.
      </p>
      <p className="text-muted-foreground text-xs">
        Calculated using <span className="font-medium">ISO 14044</span> and{' '}
        <span className="font-medium">GHG Protocol</span> methodology.
      </p>
    </div>
  );

  const detailedContent = (
    <div className="max-w-sm space-y-3 p-1">
      <p className="font-medium">Product Environmental Impact (PEI)</p>
      <p className="text-muted-foreground text-xs">
        A Product Environmental Impact assessment measures multiple environmental factors
        associated with a product across its entire lifecycle - from raw material
        extraction through manufacturing, distribution, use, and disposal.
      </p>
      <div className="space-y-1.5">
        <p className="text-xs font-medium">Impact categories include:</p>
        <ul className="text-muted-foreground text-xs list-disc pl-4 space-y-0.5">
          <li>Climate change (carbon footprint)</li>
          <li>Water consumption and scarcity</li>
          <li>Land use and biodiversity</li>
          <li>Resource depletion</li>
          <li>Ecotoxicity and eutrophication</li>
        </ul>
      </div>
      <div className="space-y-1.5">
        <p className="text-xs font-medium">Our methodology aligns with:</p>
        <ul className="text-muted-foreground text-xs list-disc pl-4 space-y-0.5">
          <li><span className="font-medium">ISO 14044:2006</span> - Life cycle assessment</li>
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
              <span className="sr-only">Product Environmental Impact information</span>
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
 * Inline PEI label with tooltip
 * Use this when displaying "Product Environmental Impact" as a label with explanation
 */
export function PEILabel({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1 ${className}`}>
      Product Environmental Impact
      <PEIInfoTooltip variant="brief" />
    </span>
  );
}

/**
 * PEI badge for use in headers and cards
 */
export function PEIBadge({ className }: { className?: string }) {
  return (
    <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 text-xs font-medium bg-primary/10 text-primary rounded-full ${className}`}>
      PEI
      <PEIInfoTooltip variant="brief" />
    </span>
  );
}

// Legacy exports for backward compatibility during transition
/** @deprecated Use PEIInfoTooltip instead */
export const PCFInfoTooltip = PEIInfoTooltip;
/** @deprecated Use PEILabel instead */
export const PCFLabel = PEILabel;
/** @deprecated Use PEIBadge instead */
export const PCFBadge = PEIBadge;
