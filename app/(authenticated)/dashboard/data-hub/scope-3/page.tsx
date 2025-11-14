"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Network, ArrowRight, Building2, Trash2, Plane } from "lucide-react";

export default function Scope3Page() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Scope 3: Value Chain Emissions</h1>
        <p className="text-muted-foreground mt-2">
          All other indirect emissions occurring in your value chain
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/20">
              <Network className="h-6 w-6 text-green-600 dark:text-green-400" />
            </div>
            <div>
              <CardTitle>What are Scope 3 Emissions?</CardTitle>
              <CardDescription>Indirect emissions from your entire value chain</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="prose prose-slate dark:prose-invert max-w-none">
            <p className="text-base">
              Enter data for all other indirect emissions that occur in your value chain.
              This includes purchased goods, waste disposal, and business travel.
            </p>

            <div className="mt-6 space-y-3">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-3">
                Common Scope 3 Categories:
              </h3>
              <ul className="space-y-2 text-sm text-slate-700 dark:text-slate-300">
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                  <span><strong>Purchased Goods & Services:</strong> Emissions from the production of goods and services you buy from suppliers</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                  <span><strong>Waste Generated in Operations:</strong> Emissions from disposal and treatment of waste from your operations</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                  <span><strong>Business Travel:</strong> Emissions from employee travel for business purposes (flights, trains, rental cars)</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                  <span><strong>Employee Commuting:</strong> Emissions from employees travelling between home and work</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-green-600 dark:text-green-400 mt-0.5">•</span>
                  <span><strong>Upstream & Downstream Transportation:</strong> Emissions from transporting purchased and sold products</span>
                </li>
              </ul>
            </div>

            <div className="mt-6 rounded-lg bg-amber-50 dark:bg-amber-950/20 p-4 border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-slate-700 dark:text-slate-300">
                <strong className="text-slate-900 dark:text-slate-100">Important:</strong> For most organisations,
                Scope 3 emissions represent the largest portion of their carbon footprint, often accounting for
                70-90% of total emissions. Accurate Scope 3 reporting is essential for comprehensive carbon management.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 mb-4">
              Select a category to add data:
            </h3>
            <div className="flex flex-wrap gap-3">
              <Link href="/dashboard/company/suppliers">
                <Button size="lg" variant="default" className="gap-2">
                  <Building2 className="h-4 w-4" />
                  Add Purchased Goods Data
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/data/waste-and-circularity">
                <Button size="lg" variant="default" className="gap-2">
                  <Trash2 className="h-4 w-4" />
                  Add Waste Data
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>

              <Link href="/dashboard/company/business-travel">
                <Button size="lg" variant="default" className="gap-2">
                  <Plane className="h-4 w-4" />
                  Add Business Travel Data
                  <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
