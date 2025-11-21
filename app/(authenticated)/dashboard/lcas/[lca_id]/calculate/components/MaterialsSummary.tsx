"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/lib/supabaseClient";
import type { ProductLcaMaterial, LcaStageWithSubStages } from "@/lib/types/lca";

interface MaterialsSummaryProps {
  lcaId: string;
}

export function MaterialsSummary({ lcaId }: MaterialsSummaryProps) {
  const [materials, setMaterials] = useState<ProductLcaMaterial[]>([]);
  const [stages, setStages] = useState<LcaStageWithSubStages[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchData() {
      try {
        setIsLoading(true);
        setError(null);

        // Fetch materials
        const { data: materialsData, error: materialsError } = await supabase
          .from('product_lca_materials')
          .select('*')
          .eq('product_lca_id', lcaId)
          .order('created_at');

        if (materialsError) throw materialsError;

        // Fetch stages and sub-stages
        const [stagesResult, subStagesResult] = await Promise.all([
          supabase.from('lca_life_cycle_stages').select('*').order('display_order'),
          supabase.from('lca_sub_stages').select('*').order('display_order'),
        ]);

        if (stagesResult.error) throw stagesResult.error;
        if (subStagesResult.error) throw subStagesResult.error;

        const stagesWithSubs: LcaStageWithSubStages[] = (stagesResult.data || []).map(stage => ({
          ...stage,
          sub_stages: (subStagesResult.data || []).filter(sub => sub.lca_stage_id === stage.id),
        }));

        setMaterials(materialsData || []);
        setStages(stagesWithSubs);
      } catch (err) {
        console.error('[MaterialsSummary] Error fetching data:', err);
        setError(err instanceof Error ? err.message : 'Failed to load materials');
      } finally {
        setIsLoading(false);
      }
    }

    fetchData();
  }, [lcaId]);

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

  const materialsByStage = stages.map(stage => ({
    stage,
    materials: materials.filter(m => {
      const subStage = stage.sub_stages.find(sub => sub.id === m.lca_sub_stage_id);
      return !!subStage;
    }),
  }));

  const totalMaterials = materials.length;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Materials Summary</CardTitle>
          <CardDescription>Loading materials...</CardDescription>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-32 w-full" />
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (totalMaterials === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Materials Summary</CardTitle>
          <CardDescription>0 materials ready for calculation</CardDescription>
        </CardHeader>
        <CardContent>
          <p className="text-center text-muted-foreground py-8">
            No materials found. Please go back and add materials before calculating.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Materials Summary</CardTitle>
        <CardDescription>
          {totalMaterials} material{totalMaterials !== 1 ? 's' : ''} ready for calculation
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Material</TableHead>
              <TableHead>Quantity</TableHead>
              <TableHead>Life Cycle Stage</TableHead>
              <TableHead>Data Source</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {materials.map((material) => (
              <TableRow key={material.id}>
                <TableCell className="font-medium">{material.name}</TableCell>
                <TableCell>
                  {material.quantity} {material.unit}
                </TableCell>
                <TableCell>
                  <span className="text-sm">{getSubStageName(material.lca_sub_stage_id)}</span>
                </TableCell>
                <TableCell>
                  <Badge variant={material.data_source === 'openlca' ? 'default' : 'secondary'}>
                    {material.data_source === 'openlca' ? 'OpenLCA' : 'Supplier'}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>

        {materialsByStage.some(group => group.materials.length > 0) && (
          <div className="mt-6 space-y-4">
            <h3 className="text-sm font-semibold">Breakdown by Life Cycle Stage</h3>
            {materialsByStage
              .filter(group => group.materials.length > 0)
              .map(({ stage, materials: stageMaterials }) => (
                <div key={stage.id} className="text-sm">
                  <span className="font-medium">{stage.name}:</span>{' '}
                  <span className="text-muted-foreground">
                    {stageMaterials.length} material{stageMaterials.length !== 1 ? 's' : ''}
                  </span>
                </div>
              ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
