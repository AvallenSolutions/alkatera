"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { CalculationForm } from "./components/CalculationForm";
import { MaterialsDebugger } from "./components/MaterialsDebugger";
import { MaterialsSummary } from "./components/MaterialsSummary";
import { supabase } from "@/lib/supabaseClient";
import Link from "next/link";
import { useParams } from "next/navigation";

export default function CalculatePage() {
  const params = useParams();
  const lcaId = params.lca_id as string;
  const [hasMaterials, setHasMaterials] = useState(false);

  useEffect(() => {
    async function checkMaterials() {
      const { data } = await supabase
        .from('product_lca_materials')
        .select('id')
        .eq('product_lca_id', lcaId)
        .limit(1);

      setHasMaterials((data?.length || 0) > 0);
    }

    checkMaterials();
  }, [lcaId]);

  return (
    <div className="container mx-auto p-6 max-w-5xl space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Step 3: Review & Calculate</h1>
          <p className="text-muted-foreground mt-2">
            Review your materials and run the LCA calculation
          </p>
        </div>
        <Link href={`/dashboard/lcas/${lcaId}/ingredients`}>
          <Button variant="outline">Back to Materials</Button>
        </Link>
      </div>

      <MaterialsDebugger lcaId={lcaId} />

      <MaterialsSummary lcaId={lcaId} />

      <CalculationForm lcaId={lcaId} hasMaterials={hasMaterials} />
    </div>
  );
}
