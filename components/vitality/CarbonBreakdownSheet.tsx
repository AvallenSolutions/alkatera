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
import { ScopeBreakdown, LifecycleStageBreakdown, FacilityEmissionsBreakdown } from '@/hooks/data/useCompanyMetrics';

export interface MaterialBreakdownItem {
  name: string;
  quantity: number;
  unit: string;
  climate: number;
  water?: number;
  land?: number;
  waste?: number;
  source?: string;
  warning?: string;
}

export interface GHGBreakdown {
  carbon_origin: {
    fossil: number;
    biogenic: number;
    land_use_change: number;
  };
  gas_inventory: {
    co2_fossil: number;
    co2_biogenic: number;
    methane: number;
    nitrous_oxide: number;
    hfc_pfc: number;
  };
  gwp_factors: {
    methane_gwp100: number;
    n2o_gwp100: number;
    method: string;
  };
}

interface CarbonBreakdownSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scopeBreakdown: ScopeBreakdown | null;
  totalCO2: number;
  materialBreakdown?: MaterialBreakdownItem[];
  ghgBreakdown?: GHGBreakdown | null;
  lifecycleStageBreakdown?: LifecycleStageBreakdown[];
  facilityEmissionsBreakdown?: FacilityEmissionsBreakdown[];
}

export function CarbonBreakdownSheet({
  open,
  onOpenChange,
  scopeBreakdown,
  totalCO2,
  materialBreakdown,
  ghgBreakdown,
  lifecycleStageBreakdown,
  facilityEmissionsBreakdown,
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

        <CarbonDeepDive
          scopeBreakdown={scopeBreakdown}
          totalCO2={totalCO2}
          materialBreakdown={materialBreakdown}
          ghgBreakdown={ghgBreakdown}
          lifecycleStageBreakdown={lifecycleStageBreakdown}
          facilityEmissionsBreakdown={facilityEmissionsBreakdown}
        />
      </SheetContent>
    </Sheet>
  );
}
