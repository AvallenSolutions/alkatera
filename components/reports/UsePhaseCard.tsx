"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Clock } from "lucide-react";

interface UsePhaseCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries?: any[]; // Kept for API compatibility
  onUpdate?: () => void;
}

/**
 * GHG Protocol Scope 3 Category 11: Use of Sold Products
 *
 * COMING SOON - Cradle to Grave calculations
 *
 * This category will include:
 * - Energy used by customers when using the product
 * - Refrigeration emissions for beverages
 * - Processing energy (e.g., brewing tea, heating)
 *
 * Currently greyed out as the platform calculates Cradle to Gate only.
 */
export function UsePhaseCard({
  reportId,
  organizationId,
  year,
}: UsePhaseCardProps) {
  return (
    <Card className="relative overflow-hidden opacity-60">
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-100 dark:bg-slate-800 rounded-full -mr-16 -mt-16 opacity-50" />

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-slate-200 dark:bg-slate-700 flex items-center justify-center">
              <Zap className="h-5 w-5 text-slate-400 dark:text-slate-500" />
            </div>
            <div>
              <CardTitle className="text-lg text-slate-500 dark:text-slate-400">
                Use of Products
              </CardTitle>
              <CardDescription>Category 11: Customer use phase</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 text-xs">
            <Clock className="h-3 w-3 mr-1" />
            Coming Soon
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="py-8 text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">
            <Zap className="h-8 w-8 text-slate-300 dark:text-slate-600" />
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400 mb-2">
            Cradle to Grave Calculations
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Track emissions from customer use of your products, including refrigeration energy and storage.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700">
          <p className="text-xs text-muted-foreground text-center">
            Currently calculating <strong>Cradle to Gate</strong> emissions. Use phase calculations will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
