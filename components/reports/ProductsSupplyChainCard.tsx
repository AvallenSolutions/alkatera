"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ProductsSupplyChainCardProps {
  totalCO2e: number;
  productsCO2e?: number;
  year: number;
  productCount?: number;
  isLoading?: boolean;
  report?: any;
}

export function ProductsSupplyChainCard({
  totalCO2e,
  productsCO2e,
  year,
  productCount = 0,
  isLoading,
  report,
}: ProductsSupplyChainCardProps) {
  const formatEmissions = (value: number) => {
    // Always display in tonnes
    return `${(value / 1000).toFixed(3)} tCO₂e`;
  };

  return (
    <Card className="relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50 dark:bg-blue-950 rounded-full -mr-16 -mt-16 opacity-50" />

      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
              <Package className="h-5 w-5 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle className="text-lg">Scope 3 Emissions</CardTitle>
              <CardDescription>All Indirect Value Chain Emissions</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Calculated</Badge>
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
                Total Scope 3 for {year}
              </div>
            </div>

            {report?.breakdown_json?.scope3 ? (
              <div className="pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">Category Breakdown</div>
                <div className="space-y-1 text-sm">
                  {report.breakdown_json.scope3.products > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 1: Purchased Goods</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.products)}</span>
                    </div>
                  )}
                  {report.breakdown_json.scope3.capital_goods > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 2: Capital Goods</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.capital_goods)}</span>
                    </div>
                  )}
                  {report.breakdown_json.scope3.operational_waste > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 5: Waste</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.operational_waste)}</span>
                    </div>
                  )}
                  {report.breakdown_json.scope3.business_travel > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 6: Business Travel</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.business_travel)}</span>
                    </div>
                  )}
                  {report.breakdown_json.scope3.employee_commuting > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 7: Commuting</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.employee_commuting)}</span>
                    </div>
                  )}
                  {report.breakdown_json.scope3.downstream_logistics > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 9: Distribution</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.downstream_logistics)}</span>
                    </div>
                  )}
                  {report.breakdown_json.scope3.purchased_services > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Services & Other</span>
                      <span className="font-medium">{formatEmissions(report.breakdown_json.scope3.purchased_services)}</span>
                    </div>
                  )}
                </div>
              </div>
            ) : productsCO2e !== undefined ? (
              <div className="pt-4 border-t">
                <div className="text-xs text-muted-foreground mb-2">Preliminary Breakdown</div>
                <div className="space-y-1 text-sm">
                  {productsCO2e > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Cat 1: Purchased Goods</span>
                      <span className="font-medium">{formatEmissions(productsCO2e)}</span>
                    </div>
                  )}
                  {(totalCO2e - productsCO2e) > 0 && (
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Other Categories</span>
                      <span className="font-medium">{formatEmissions(totalCO2e - productsCO2e)}</span>
                    </div>
                  )}
                </div>
                <div className="mt-3 text-xs text-muted-foreground italic">
                  Generate report to see full breakdown
                </div>
              </div>
            ) : null}
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-sm text-muted-foreground mb-4">
              No Scope 3 data found for {year}
            </div>
          </div>
        )}

        <Link href="/products" passHref>
          <Button variant="outline" className="w-full" size="sm">
            <ExternalLink className="h-4 w-4 mr-2" />
            Manage Products
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
