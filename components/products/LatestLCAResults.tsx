"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { CheckCircle2, AlertCircle, TrendingUp } from "lucide-react";
import Link from "next/link";

interface LatestLCAResultsProps {
  lcaId: string | null;
  totalCo2e: number | null;
  unit: string | null;
  calculatedAt: string | null;
  status: string | null;
}

export function LatestLCAResults({
  lcaId,
  totalCo2e,
  unit,
  calculatedAt,
  status,
}: LatestLCAResultsProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (!lcaId || !totalCo2e) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Current LCA Results</CardTitle>
          <CardDescription>Most recently completed life cycle assessment</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              No completed LCA calculations yet. Create and complete an LCA to see results here.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle>Current LCA Results</CardTitle>
            <CardDescription>Most recently completed life cycle assessment</CardDescription>
          </div>
          {status && (
            <Badge className="bg-green-600">
              <CheckCircle2 className="mr-1 h-3 w-3" />
              {status}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/20">
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold">{totalCo2e.toFixed(2)}</span>
              <span className="text-lg text-muted-foreground">{unit || "kg CO2e"}</span>
            </div>
            <p className="text-sm text-muted-foreground mt-1">Total carbon footprint</p>
          </div>
        </div>

        {calculatedAt && (
          <div className="text-sm text-muted-foreground border-t pt-4">
            Calculated on {formatDate(calculatedAt)} (Most recent completed calculation)
          </div>
        )}

        <Link href={`/dashboard/lcas/${lcaId}/results`}>
          <Button className="w-full" variant="outline">
            View Full Results
          </Button>
        </Link>
      </CardContent>
    </Card>
  );
}
