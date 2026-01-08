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
import {
  Scope3CategoryData,
  ProductEmissionDetail,
  BusinessTravelDetail,
  LogisticsDetail,
  WasteDetail,
} from '@/hooks/data/useScope3GranularData';

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
    methane_fossil?: number;
    methane_biogenic?: number;
    nitrous_oxide: number;
    hfc_pfc: number;
  };
  physical_mass?: {
    ch4_fossil_kg: number;
    ch4_biogenic_kg: number;
    n2o_kg: number;
  };
  gwp_factors: {
    methane_gwp100?: number;
    ch4_fossil_gwp100?: number;
    ch4_biogenic_gwp100?: number;
    n2o_gwp100: number;
    method: string;
  };
  data_quality?: 'primary' | 'secondary' | 'tertiary';
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
  scope3Categories?: Scope3CategoryData[];
  scope3ProductDetails?: ProductEmissionDetail[];
  scope3TravelDetails?: BusinessTravelDetail[];
  scope3LogisticsDetails?: LogisticsDetail[];
  scope3WasteDetails?: WasteDetail[];
  scope3Total?: number;
  year?: number;
  isLoadingScope3?: boolean;
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
  scope3Categories,
  scope3ProductDetails,
  scope3TravelDetails,
  scope3LogisticsDetails,
  scope3WasteDetails,
  scope3Total,
  year,
  isLoadingScope3,
}: CarbonBreakdownSheetProps) {
  // Delay rendering to prevent Bolt auto-detection
  const [shouldRender, setShouldRender] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      // Small delay prevents Bolt from detecting complex rendering
      const timer = setTimeout(() => setShouldRender(true), 150);
      return () => clearTimeout(timer);
    } else {
      setShouldRender(false);
    }
  }, [open]);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-4xl overflow-y-auto bg-gradient-to-br from-green-50/50 to-emerald-50/50 dark:from-green-950/20 dark:to-emerald-950/20">
        <SheetHeader className="space-y-4 mb-8 pb-6 border-b border-green-200 dark:border-green-800/50">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-xl bg-gradient-to-br from-green-100 to-emerald-100 dark:from-green-900/50 dark:to-emerald-900/50 shadow-sm">
              <Leaf className="h-6 w-6 text-green-700 dark:text-green-400" />
            </div>
            <div className="flex-1">
              <SheetTitle className="text-2xl font-bold text-green-900 dark:text-green-100">
                Climate Impact Breakdown
              </SheetTitle>
              <SheetDescription className="mt-2 text-base">
                Comprehensive GHG emissions analysis following ISO 14067 and GHG Protocol standards
              </SheetDescription>
            </div>
          </div>
        </SheetHeader>

        {shouldRender ? (
          <CarbonDeepDive
            scopeBreakdown={scopeBreakdown}
            totalCO2={totalCO2}
            materialBreakdown={materialBreakdown}
            ghgBreakdown={ghgBreakdown}
            lifecycleStageBreakdown={lifecycleStageBreakdown}
            facilityEmissionsBreakdown={facilityEmissionsBreakdown}
            scope3Categories={scope3Categories}
            scope3ProductDetails={scope3ProductDetails}
            scope3TravelDetails={scope3TravelDetails}
            scope3LogisticsDetails={scope3LogisticsDetails}
            scope3WasteDetails={scope3WasteDetails}
            scope3Total={scope3Total}
            year={year}
            isLoadingScope3={isLoadingScope3}
          />
        ) : (
          <div className="flex items-center justify-center p-8">
            <div className="text-sm text-muted-foreground">Loading breakdown...</div>
          </div>
        )}
      </SheetContent>
    </Sheet>
  );
}
