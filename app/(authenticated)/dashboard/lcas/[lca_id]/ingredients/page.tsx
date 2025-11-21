import { IngredientsForm } from "@/components/lca/IngredientsForm";
import { fetchLcaStagesWithSubStages, fetchLcaMaterials } from "@/lib/lca-server";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import Link from "next/link";

interface IngredientsPageProps {
  params: {
    lca_id: string;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateStaticParams() {
  return [];
}

export default async function IngredientsPage({ params }: IngredientsPageProps) {
  let stages;
  let materials;
  let error: string | null = null;

  try {
    [stages, materials] = await Promise.all([
      fetchLcaStagesWithSubStages(),
      fetchLcaMaterials(params.lca_id),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  if (error || !stages) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>
            {error || "Failed to load LCA stages and materials"}
          </AlertDescription>
        </Alert>
        <Link href="/dashboard/products">
          <Button className="mt-4">Back to Products</Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Ingredients & Materials</h1>
        <p className="text-muted-foreground mt-2">
          Add all materials, ingredients, and process inputs for your product, organised by life cycle stage
        </p>
      </div>

      <IngredientsForm
        lcaId={params.lca_id}
        stages={stages}
        initialMaterials={materials || []}
      />
    </div>
  );
}
