"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Factory, Bolt, ExternalLink } from "lucide-react";
import Link from "next/link";

interface OperationsEnergyCardProps {
  totalCO2e: number;
  year: number;
  isLoading?: boolean;
}

export function OperationsEnergyCard({ totalCO2e, year, isLoading }: OperationsEnergyCardProps) {
  const formatEmissions = (value: number) => {
    if (value >= 1000) {
      return `${(value / 1000).toFixed(2)} tCO₂e`;
    }
    return `${value.toFixed(2)} kgCO₂e`;
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-red-50 dark:bg-red-950 rounded-full -mr-16 -mt-16 opacity-50" />

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-red-100 dark:bg-red-900 flex items-center justify-center">
              <Factory className="h-5 w-5 text-red-600 dark:text-red-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Operations & Energy</CardTitle>
              <CardDescription>Scope 1 & 2 Emissions</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="flex items-center gap-1">
            <Bolt className="h-3 w-3" />
            Read-Only
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Calculating...
          </div>
        ) : totalCO2e > 0 ? (
          <>
            <div className="text-center py-4">
              <div className="text-4xl font-bold text-slate-900 dark:text-slate-100">
                {formatEmissions(totalCO2e)}
              </div>
              <div className="text-sm text-muted-foreground mt-1">
                From facility operations in {year}
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-2">Data Sources</div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Utility bills</span>
                  <span className="font-medium">Auto-aggregated</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Facility emissions</span>
                  <span className="font-medium">Calculated</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-sm text-muted-foreground mb-4">
              No facility data found for {year}
            </div>
          </div>
        )}

        <Link href="/operations" passHref>
          <Button variant="outline" className="w-full" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Facilities
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
