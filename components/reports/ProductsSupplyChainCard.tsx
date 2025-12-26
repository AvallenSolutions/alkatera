"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Package, ExternalLink } from "lucide-react";
import Link from "next/link";

interface ProductsSupplyChainCardProps {
  totalCO2e: number;
  year: number;
  productCount?: number;
  isLoading?: boolean;
}

export function ProductsSupplyChainCard({
  totalCO2e,
  year,
  productCount = 0,
  isLoading,
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
              <CardTitle className="text-lg">Products & Supply Chain</CardTitle>
              <CardDescription>Scope 3 Product Emissions</CardDescription>
            </div>
          </div>
          <Badge variant="secondary">Read-Only</Badge>
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
                From {productCount} {productCount === 1 ? "product" : "products"} in {year}
              </div>
            </div>

            <div className="pt-4 border-t">
              <div className="text-xs text-muted-foreground mb-2">Data Sources</div>
              <div className="space-y-1 text-sm">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Production logs</span>
                  <span className="font-medium">Volume tracked</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">Product LCAs</span>
                  <span className="font-medium">Impact calculated</span>
                </div>
              </div>
            </div>
          </>
        ) : (
          <div className="py-8 text-center">
            <div className="text-sm text-muted-foreground mb-4">
              No production data found for {year}
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
