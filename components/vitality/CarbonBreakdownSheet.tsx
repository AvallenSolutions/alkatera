import React from 'react';
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet';
import { Leaf } from 'lucide-react';
import { CarbonDeepDive } from './CarbonDeepDive';
import { ScopeBreakdown } from '@/hooks/data/useCompanyMetrics';

interface CarbonBreakdownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
}

export function CarbonBreakdownSheet({
  open,
  onOpenChange,
  scopeBreakdown,
  totalCO2,
}: CarbonBreakdownSheetProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto">
        <SheetHeader className="space-y-4 mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <Leaf className="h-5 w-5 text-orange-600" />
            </div>
            <div className="flex-1">
              <SheetTitle>Carbon Footprint Breakdown</SheetTitle>
              <SheetDescription className="mt-1">
                Detailed GHG emissions breakdown by scope and category following GHG Protocol
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        <CarbonDeepDive scopeBreakdown={scopeBreakdown} totalCO2={totalCO2} />
      </SheetContent>
    </Sheet>
  );
}
