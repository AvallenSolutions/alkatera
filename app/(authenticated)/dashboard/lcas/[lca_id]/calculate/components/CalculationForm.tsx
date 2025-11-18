"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Calculator } from "lucide-react";
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

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!hasMaterials) {
      toast.error("No materials found. Please add materials before calculating.");
      return;
    }

    try {
      setIsCalculating(true);
      const result = await runLcaCalculation(lcaId);

      if (!result.success) {
        throw new Error(result.error);
      }

      toast.success("Calculation completed successfully!");
      router.push(`/dashboard/lcas/${lcaId}/results`);
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to run calculation";
      toast.error(errorMessage);
    } finally {
      setIsCalculating(false);
    }
  };

  return (
    <form onSubmit={handleCalculate}>
      <div className="flex justify-between items-center">
        <Link href={`/dashboard/lcas/${lcaId}/ingredients`}>
          <Button type="button" variant="outline" disabled={isCalculating}>
            Back to Materials
          </Button>
        </Link>
        <Button type="submit" size="lg" disabled={!hasMaterials || isCalculating}>
          <Calculator className="mr-2 h-5 w-5" />
          {isCalculating ? "Calculating..." : "Run Calculation"}
        </Button>
      </div>
    </form>
  );
}
