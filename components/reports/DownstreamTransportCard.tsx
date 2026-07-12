"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowDownToLine } from "lucide-react";
import { StateChip } from "@/components/studio";

interface DownstreamTransportCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  entries?: any[]; // Kept for API compatibility
  onUpdate?: () => void;
}

/**
 * GHG Protocol Scope 3 Category 9: Downstream Transportation & Distribution
 *
 * COMING SOON - Cradle to Grave calculations
 *
 * This category will include:
 * - Transportation of sold products to end customers
 * - Third-party distribution services (outbound logistics)
 * - Retailer to consumer delivery
 *
 * Currently greyed out as the platform calculates Cradle to Gate only.
 */
export function DownstreamTransportCard({
  reportId,
  organizationId,
  year,
}: DownstreamTransportCardProps) {
  return (
    <Card className="opacity-60">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-secondary flex items-center justify-center">
              <ArrowDownToLine className="h-5 w-5 text-studio-dim" />
            </div>
            <div>
              <CardTitle className="text-lg text-studio-dim">
                Downstream Transport
              </CardTitle>
              <CardDescription>Category 9: Outbound delivery</CardDescription>
            </div>
          </div>
          <StateChip tone="quiet">Coming soon</StateChip>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        <div className="py-8 text-center">
          <div className="h-16 w-16 mx-auto mb-4 rounded-full bg-secondary flex items-center justify-center">
            <ArrowDownToLine className="h-8 w-8 text-studio-dim" />
          </div>
          <div className="text-sm font-medium text-studio-dim mb-2">
            Cradle to Grave Calculations
          </div>
          <p className="text-xs text-muted-foreground max-w-xs mx-auto">
            Track emissions from delivering products to end customers. This feature will extend your calculations beyond the factory gate.
          </p>
        </div>

        <div className="p-3 rounded-lg bg-secondary border border-dashed border-studio-hairline">
          <p className="text-xs text-muted-foreground text-center">
            Currently calculating <strong>Cradle to Gate</strong> emissions. Downstream transport will be available in a future update.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
