"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { BarChart3 } from "lucide-react";
import type { FeatureAdoption } from "../types";

interface FeatureAdoptionCardProps {
  data: FeatureAdoption | null;
  loading: boolean;
}

const modules = [
  { key: "products_module" as const, label: "Products Module", color: "bg-blue-500" },
  { key: "facilities_module" as const, label: "Facilities Module", color: "bg-green-500" },
  { key: "suppliers_module" as const, label: "Suppliers Module", color: "bg-amber-500" },
  { key: "lca_module" as const, label: "LCA Module", color: "bg-cyan-500" },
];

export function FeatureAdoptionCard({ data, loading }: FeatureAdoptionCardProps) {
  if (loading) {
    return <Skeleton className="h-64" />;
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-500" />
          Feature Adoption
        </CardTitle>
        <CardDescription>
          Module usage across {data?.total_organizations || 0} organisations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {modules.map((mod) => (
            <div key={mod.key}>
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm">{mod.label}</span>
                <span className="text-sm font-medium">
                  {data?.[mod.key].adoption_rate || 0}%
                </span>
              </div>
              <div className="h-2 bg-gray-100 dark:bg-gray-800 rounded-full overflow-hidden">
                <div
                  className={`h-full ${mod.color} rounded-full transition-all duration-500`}
                  style={{ width: `${data?.[mod.key].adoption_rate || 0}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
