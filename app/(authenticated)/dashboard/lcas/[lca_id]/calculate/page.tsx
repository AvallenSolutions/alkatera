import { fetchLcaMaterials, fetchLcaStagesWithSubStages } from "@/lib/lca";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CalculationForm } from "./components/CalculationForm";
import Link from "next/link";
import type { ProductLcaMaterial, LcaStageWithSubStages } from "@/lib/types/lca";

interface CalculatePageProps {
  params: {
    lca_id: string;
  };
}

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateStaticParams() {
  return [];
}

export default async function CalculatePage({ params }: CalculatePageProps) {
  let materials: ProductLcaMaterial[] | undefined;
  let stages: LcaStageWithSubStages[] | undefined;
  let error: string | null = null;

  try {
    [materials, stages] = await Promise.all([
      fetchLcaMaterials(params.lca_id),
      fetchLcaStagesWithSubStages(),
    ]);
  } catch (err) {
    error = err instanceof Error ? err.message : "Failed to load data";
  }

  if (error || !materials || !stages) {
    return (
      <div className="container mx-auto p-6 max-w-5xl">
        <Alert variant="destructive">
          <AlertDescription>
            {error || "Failed to load LCA data"}
          </AlertDescription>
        </Alert>
        <Link href="/dashboard/products">
          <Button className="mt-4">Back to Products</Button>
        </Link>
      </div>
    );
  }

  const getSubStageName = (subStageId: number | null | undefined) => {
    if (!subStageId || !stages) return "Not classified";

    for (const stage of stages) {
      const subStage = stage.sub_stages.find(sub => sub.id === Number(subStageId));
      if (subStage) {
        return `${stage.name} > ${subStage.name}`;
      }
    }
    return "Unknown";
  };

  const materialsByStage = stages?.map(stage => ({
    stage,
    materials: materials?.filter(m => {
      const subStage = stage.sub_stages.find(sub => sub.id === m.lca_sub_stage_id);
      return !!subStage;
    }) || [],
  })) || [];

  const totalMaterials = materials?.length || 0;

  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold">Step 3: Review & Calculate</h1>
        <p className="text-muted-foreground mt-2">
          Review your materials and run the LCA calculation
        </p>
      </div>

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Materials Summary</CardTitle>
          <CardDescription>
            {totalMaterials} material{totalMaterials !== 1 ? "s" : ""} ready for calculation
          </CardDescription>
        </CardHeader>
        <CardContent>
          {totalMaterials === 0 ? (
            <Alert>
              <AlertDescription>
                No materials found. Please go back and add materials before calculating.
              </AlertDescription>
            </Alert>
          ) : (
            <div className="space-y-6">
              {materialsByStage.map(({ stage, materials: stageMaterials }) => {
                if (stageMaterials.length === 0) return null;

                return (
                  <div key={stage.id}>
                    <div className="flex items-center gap-2 mb-3">
                      <h3 className="font-semibold">{stage.name}</h3>
                      <Badge variant="secondary">
                        {stageMaterials.length} material{stageMaterials.length !== 1 ? "s" : ""}
                      </Badge>
                    </div>
                    <div className="rounded-md border">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Material Name</TableHead>
                            <TableHead>Quantity</TableHead>
                            <TableHead>Unit</TableHead>
                            <TableHead>Sub-Stage</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {stageMaterials.map((material) => (
                            <TableRow key={material.id}>
                              <TableCell className="font-medium">
                                {material.name || "Unnamed"}
                              </TableCell>
                              <TableCell>{material.quantity}</TableCell>
                              <TableCell>{material.unit || "-"}</TableCell>
                              <TableCell className="text-sm text-muted-foreground">
                                {stage.sub_stages.find(sub => sub.id === Number(material.lca_sub_stage_id))?.name || "Not classified"}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <CalculationForm lcaId={params.lca_id} hasMaterials={totalMaterials > 0} />
    </div>
  );
}
