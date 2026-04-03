"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Zap, Info } from "lucide-react";
import Link from "next/link";

interface UsePhaseCardProps {
  reportId: string;
  organizationId: string;
  year: number;
  totalCO2eTonnes: number;
}

/**
 * GHG Protocol Scope 3 Category 11: Use of Sold Products
 *
 * Displays use-phase emissions from product LCAs that include
 * Cradle-to-Consumer or Cradle-to-Grave boundaries.
 * Shows refrigeration energy and carbonation CO2 release.
 */
export function UsePhaseCard({
  year,
  totalCO2eTonnes,
}: UsePhaseCardProps) {
  const hasData = totalCO2eTonnes > 0;

  if (!hasData) {
    return (
      <Card className="relative overflow-hidden opacity-70">
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
          </div>
        </CardHeader>
        <CardContent>
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-900 border border-dashed border-slate-200 dark:border-slate-700">
            <div className="flex items-start gap-2">
              <Info className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
              <p className="text-xs text-muted-foreground">
                Use-phase emissions are calculated from product LCAs with <strong>Cradle-to-Consumer</strong> or <strong>Cradle-to-Grave</strong> boundaries.
                {' '}
                <Link href="/products" className="underline">
                  Set up product LCAs
                </Link>
                {' '}to populate this category.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-green-200 dark:border-green-900">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-green-100 dark:bg-green-900/30 flex items-center justify-center">
              <Zap className="h-5 w-5 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Use of Products</CardTitle>
              <CardDescription>Category 11: Customer use phase</CardDescription>
            </div>
          </div>
          <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300 text-xs">
            Tier 1
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <div>
          <div className="text-3xl font-bold">
            {totalCO2eTonnes.toFixed(3)} <span className="text-sm font-normal text-muted-foreground">tCO₂e</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            Customer refrigeration and carbonation emissions for {year}
          </p>
        </div>

        <div className="p-3 rounded-lg bg-muted/50 text-xs text-muted-foreground">
          <div className="flex items-start gap-2">
            <Info className="h-3.5 w-3.5 mt-0.5 shrink-0" />
            <span>
              Calculated from product LCAs with Cradle-to-Consumer or Cradle-to-Grave boundaries. Includes consumer refrigeration energy and dissolved CO₂ release.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
