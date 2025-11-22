"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CheckCircle2, TrendingUp, ShieldCheck, FileText } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";

interface LatestLCAResultsProps {
  productId: string;
  lcaId: string | null;
  totalCo2e: number | null;
  unit: string | null;
  calculatedAt: string | null;
  status: string | null;
  lcaVersion?: string | null;
  scopeType?: string | null;
  hasDraft?: boolean;
  draftLcaId?: string | null;
}

export function LatestLCAResults({
  productId,
  lcaId,
  totalCo2e,
  unit,
  calculatedAt,
  status,
  lcaVersion,
  scopeType,
  hasDraft,
  draftLcaId,
}: LatestLCAResultsProps) {
  const router = useRouter();

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const getScopeLabel = (scope: string | null | undefined) => {
    if (scope === "cradle-to-grave") return "Cradle-to-Grave";
    return "Cradle-to-Gate";
  };

  if (!lcaId || !totalCo2e) {
    return (
      <Card className="border-2 border-dashed">
        <CardHeader className="text-center pb-4">
          <div className="flex justify-center mb-4">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900/20">
              <ShieldCheck className="h-10 w-10 text-blue-600" />
            </div>
          </div>
          <CardTitle className="text-2xl">Create Your First LCA</CardTitle>
          <CardDescription className="text-base">
            Start your ISO 14044 compliant life cycle assessment
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4 text-center">
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            A Life Cycle Assessment (LCA) measures the environmental impact of your product
            from raw materials through manufacturing, following international standards.
          </p>

          {hasDraft && draftLcaId ? (
            <div className="space-y-2">
              <Button
                onClick={() => router.push(`/products/${productId}/lca/${draftLcaId}/data-capture`)}
                size="lg"
                className="w-full max-w-sm"
              >
                <FileText className="mr-2 h-5 w-5" />
                Resume Draft LCA
              </Button>
              <p className="text-xs text-muted-foreground">
                You have an LCA in progress
              </p>
            </div>
          ) : (
            <Button
              onClick={() => router.push(`/products/${productId}/lca/initiate`)}
              size="lg"
              className="w-full max-w-sm"
            >
              <ShieldCheck className="mr-2 h-5 w-5" />
              Create New LCA
            </Button>
          )}

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground">
              You'll define your functional unit and system boundary first
            </p>
          </div>
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
          <div className="flex gap-2">
            {lcaVersion && (
              <Badge variant="secondary" className="text-xs">
                v{lcaVersion}
              </Badge>
            )}
            {scopeType && (
              <Badge
                className={
                  scopeType === "cradle-to-grave"
                    ? "bg-green-600"
                    : "bg-amber-600"
                }
              >
                {getScopeLabel(scopeType)}
              </Badge>
            )}
            {status && (
              <Badge className="bg-green-600">
                <CheckCircle2 className="mr-1 h-3 w-3" />
                {status}
              </Badge>
            )}
          </div>
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
