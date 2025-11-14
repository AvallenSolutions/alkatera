"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Zap, ArrowRight } from "lucide-react";

export default function Scope2Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scope 2: Purchased Energy</h1>
        <p className="text-muted-foreground mt-2">
          Indirect emissions from purchased electricity, heat, steam, and cooling
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-amber-100 dark:bg-amber-900/20">
              <Zap className="h-6 w-6 text-amber-600 dark:text-amber-400" />
            </div>
            <div>
              <CardTitle>What are Scope 2 Emissions?</CardTitle>
              <CardDescription>Indirect emissions from the energy you purchase</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-base">
              Enter data for emissions from purchased energy. This is primarily the electricity,
              heat, steam, or cooling your organisation buys and consumes.
            </p>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Common Scope 2 Sources:
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span><strong>Purchased Grid Electricity:</strong> Electricity bought from the national or regional grid for your facilities</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span><strong>Purchased Heat or Steam:</strong> Heat or steam purchased from district heating systems or external suppliers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-amber-600 dark:text-amber-400 mt-0.5">•</span>
                  <span><strong>Purchased Cooling:</strong> Chilled water or cooling purchased from district cooling systems</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-lg bg-blue-50 dark:bg-blue-950/20 p-4 border border-blue-200 dark:border-blue-800">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">Note:</strong> Scope 2 emissions occur
                at the power plant or facility that generates the energy, not at your premises. However,
                your organisation is responsible for these emissions because you consume the energy.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Link href="/company/facilities">
              <Button size="lg" className="gap-2">
                Add Scope 2 Data
                <ArrowRight className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
