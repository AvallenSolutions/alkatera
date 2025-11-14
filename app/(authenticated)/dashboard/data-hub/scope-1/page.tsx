"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Factory, ArrowRight } from "lucide-react";

export default function Scope1Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scope 1: Direct Emissions</h1>
        <p className="text-muted-foreground mt-2">
          Emissions from sources your organisation owns or directly controls
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-blue-100 dark:bg-blue-900/20">
              <Factory className="h-6 w-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <CardTitle>What are Scope 1 Emissions?</CardTitle>
              <CardDescription>Direct greenhouse gas emissions from your operations</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-base">
              Enter data for emissions from sources your organisation owns or directly controls.
              This includes fuel burned in company vehicles, boilers, or furnaces.
            </p>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Common Scope 1 Sources:
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span><strong>Stationary Combustion:</strong> Natural gas, fuel oil, coal, or other fuels burned in boilers, furnaces, or generators</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span><strong>Mobile Combustion:</strong> Petrol, diesel, or other fuels used in company-owned or leased vehicles</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 dark:text-blue-400 mt-0.5">•</span>
                  <span><strong>Fugitive Emissions:</strong> Refrigerant leakage from air conditioning systems or industrial processes</span>
                </li>
              </ul>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Link href="/company/facilities">
              <Button size="lg" className="gap-2">
                Add Scope 1 Data
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
