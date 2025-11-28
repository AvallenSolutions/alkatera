"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { Database, Building2, Sprout, TrendingUp, CheckCircle2 } from "lucide-react";
import { getAuditSummary, calculateDataQualityLabel } from "@/lib/ingredientAudit";
import { markIngredientsComplete } from "@/lib/ingredientOperations";
import type { IngredientMaterial } from "@/lib/ingredientOperations";
import { toast } from "sonner";

interface IngredientsSummaryProps {
  ingredients: IngredientMaterial[];
  lcaId: string;
  organizationId: string;
  organizationName: string;
  onMarkComplete?: () => void;
}

export function IngredientsSummary({
  ingredients,
  lcaId,
  organizationId,
  organizationName,
  onMarkComplete,
}: IngredientsSummaryProps) {
  const [summary, setSummary] = useState({
    total: 0,
    primary: 0,
    supplier: 0,
    database: 0,
    qualityScore: 0,
  });
  const [isMarking, setIsMarking] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadSummary();
  }, [lcaId, ingredients.length]);

  const loadSummary = async () => {
    try {
      setLoading(true);

      const primaryCount = ingredients.filter(i => i.data_source === 'primary').length;
      const supplierCount = ingredients.filter(i => i.data_source === 'supplier').length;
      const databaseCount = ingredients.filter(i => i.data_source === 'openlca').length;

      let qualityScore = 0;
      if (ingredients.length > 0) {
        qualityScore = (
          (primaryCount * 100) +
          (supplierCount * 75) +
          (databaseCount * 25)
        ) / ingredients.length;
      }

      setSummary({
        total: ingredients.length,
        primary: primaryCount,
        supplier: supplierCount,
        database: databaseCount,
        qualityScore: Math.round(qualityScore),
      });
    } catch (error) {
      console.error('[IngredientsSummary] Error loading summary:', error);
    } finally {
      setLoading(false);
    }
  };

  const qualityInfo = calculateDataQualityLabel(summary.qualityScore);

  const getPrimaryPercentage = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.primary / summary.total) * 100);
  };

  const getSupplierPercentage = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.supplier / summary.total) * 100);
  };

  const getDatabasePercentage = () => {
    if (summary.total === 0) return 0;
    return Math.round((summary.database / summary.total) * 100);
  };

  const handleMarkComplete = async () => {
    if (ingredients.length === 0) {
      toast.error('Add at least one ingredient before marking complete');
      return;
    }

    try {
      setIsMarking(true);
      const result = await markIngredientsComplete(lcaId, organizationId);

      if (result.success) {
        toast.success('Ingredients section marked complete');
        onMarkComplete?.();
      } else {
        toast.error(result.error || 'Failed to mark complete');
      }
    } catch (error: any) {
      console.error('Error marking complete:', error);
      toast.error(error.message || 'Failed to mark complete');
    } finally {
      setIsMarking(false);
    }
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Data Quality Summary</CardTitle>
          <CardDescription>Loading...</CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Data Quality Summary</CardTitle>
        <CardDescription>
          Ingredient data for {organizationName}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex justify-between items-center">
          <span className="text-sm font-medium">Total Ingredients:</span>
          <Badge variant="secondary" className="text-base">
            {summary.total}
          </Badge>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Sprout className="h-4 w-4 text-green-600" />
              <span className="text-sm">Primary Data:</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800 dark:bg-green-800 dark:text-green-100">
                {summary.primary} ({getPrimaryPercentage()}%)
              </Badge>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Building2 className="h-4 w-4 text-blue-600" />
              <span className="text-sm">Supplier Data:</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-800 dark:text-blue-100">
                {summary.supplier} ({getSupplierPercentage()}%)
              </Badge>
            </div>
          </div>

          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Database className="h-4 w-4 text-grey-600" />
              <span className="text-sm">Generic Database:</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-grey-100 text-grey-800 dark:bg-grey-800 dark:text-grey-100">
                {summary.database} ({getDatabasePercentage()}%)
              </Badge>
            </div>
          </div>
        </div>

        <Separator />

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="h-4 w-4" />
              <span className="text-sm font-medium">Data Quality Score:</span>
            </div>
            <Badge className={qualityInfo.color}>
              {summary.qualityScore}% - {qualityInfo.label}
            </Badge>
          </div>

          <div className="w-full h-2 bg-grey-200 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-600 transition-all"
              style={{ width: `${summary.qualityScore}%` }}
            />
          </div>

          <p className="text-xs text-muted-foreground">
            {qualityInfo.description}
          </p>
        </div>

        {summary.total === 0 ? (
          <div className="text-center py-4 text-sm text-muted-foreground">
            Add ingredients to see data quality metrics
          </div>
        ) : (
          <Button
            onClick={handleMarkComplete}
            disabled={isMarking}
            className="w-full"
            size="lg"
          >
            <CheckCircle2 className="mr-2 h-4 w-4" />
            {isMarking ? 'Marking Complete...' : 'Mark Ingredients Complete'}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
