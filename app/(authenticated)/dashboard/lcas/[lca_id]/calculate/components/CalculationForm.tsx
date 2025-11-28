"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Calculator, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { runLcaCalculation } from "@/lib/lca-calculation";
import Link from "next/link";

interface CalculationFormProps {
  lcaId: string;
  hasMaterials: boolean;
}

export function CalculationForm({ lcaId, hasMaterials }: CalculationFormProps) {
  const router = useRouter();
  const [isCalculating, setIsCalculating] = useState(false);
  const [calculationProgress, setCalculationProgress] = useState(0);
  const [calculationStage, setCalculationStage] = useState("");

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMaterials) {
      toast.error("No materials found. Please add materials before calculating.");
      return;
    }

    try {
      setIsCalculating(true);
      setCalculationProgress(0);
      setCalculationStage("Preparing calculation...");

      // Stage 1: Start
      setCalculationProgress(20);
      setCalculationStage("Loading material data...");

      // Stage 2: Calculate
      setCalculationProgress(40);
      setCalculationStage("Running calculation engine...");
      const result = await runLcaCalculation(lcaId);

      if (!result.success) {
        throw new Error(result.error);
      }

      // Stage 3: Processing results
      setCalculationProgress(70);
      setCalculationStage("Processing results...");

      // Stage 4: Complete
      setCalculationProgress(100);
      setCalculationStage("Calculation complete!");
      toast.success("Calculation completed successfully!");
      router.push(`/dashboard/lcas/${lcaId}/results`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run calculation";
      toast.error(errorMessage);
    } finally {
      setTimeout(() => {
        setIsCalculating(false);
        setCalculationProgress(0);
        setCalculationStage("");
      }, 500);
    }
  };

  return (
    <form onSubmit={handleCalculate} className="space-y-6">
      <div className="flex justify-between items-center">
        <Link href={`/dashboard/lcas/${lcaId}/ingredients`}>
          <Button type="button" variant="outline" disabled={isCalculating}>
            Back to Materials
          </Button>
        </Link>
        <Button type="submit" size="lg" disabled={!hasMaterials || isCalculating}>
          {isCalculating ? (
            <>
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
              Calculating...
            </>
          ) : (
            <>
              <Calculator className="mr-2 h-5 w-5" />
              Run Calculation
            </>
          )}
        </Button>
      </div>

      {isCalculating && (
        <Card>
          <CardContent className="pt-6 space-y-3">
            <div className="relative h-2 w-full overflow-hidden rounded-full bg-secondary">
              <div
                className="h-full bg-primary transition-all duration-300 ease-in-out"
                style={{ width: `${calculationProgress}%` }}
              />
            </div>
            <p className="text-sm text-muted-foreground text-center font-medium">
              {calculationStage}
            </p>
            <p className="text-xs text-muted-foreground text-center">
              {calculationProgress}% complete
            </p>
          </CardContent>
        </Card>
      )}
    </form>
  );
}
