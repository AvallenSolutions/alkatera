/**
 * Example usage of the LcaClassifier component
 *
 * This file demonstrates how to integrate the LcaClassifier component
 * into your application to enable users to classify emissions data
 * against the two-tiered LCA stage hierarchy.
 */

"use client";

import { useState } from "react";
import { LcaClassifier } from "@/components/lca/LcaClassifier";
import type { LcaSubStage } from "@/hooks/data/useLcaStages";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function LcaClassifierExample() {
  const [selectedSubStage, setSelectedSubStage] = useState<LcaSubStage | null>(null);

  const handleSubStageSelect = (subStage: LcaSubStage | null) => {
    setSelectedSubStage(subStage);
    console.log("Selected sub-stage:", subStage);
  };

  const handleSubmit = () => {
    if (selectedSubStage) {
      console.log("Submitting with LCA classification:", {
        subStageId: selectedSubStage.id,
        subStageName: selectedSubStage.name,
        stageId: selectedSubStage.lca_stage_id,
      });
      // Here you would typically save this to your database or pass it to a parent component
    }
  };

  return (
    <div className="container mx-auto max-w-4xl space-y-6 p-6">
      <Card>
        <CardHeader>
          <CardTitle>Example: LCA Classification Form</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* The LcaClassifier component */}
          <LcaClassifier
            onSubStageSelect={handleSubStageSelect}
            selectedSubStageId={selectedSubStage?.id ?? null}
            title="Classify Your Emissions Data"
            description="Select the life cycle stage that best describes this emissions activity"
          />

          {/* Display selected classification */}
          {selectedSubStage && (
            <Card className="bg-slate-50 dark:bg-slate-900">
              <CardContent className="pt-6">
                <div className="space-y-2">
                  <div className="text-sm font-medium">Selected Classification:</div>
                  <div className="text-lg font-semibold">{selectedSubStage.name}</div>
                  {selectedSubStage.description && (
                    <div className="text-sm text-muted-foreground">
                      {selectedSubStage.description}
                    </div>
                  )}
                  <div className="pt-2 text-xs text-muted-foreground">
                    Sub-stage ID: {selectedSubStage.id} | Stage ID: {selectedSubStage.lca_stage_id}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {/* Action buttons */}
          <div className="flex justify-end gap-3">
            <Button
              variant="outline"
              onClick={() => setSelectedSubStage(null)}
              disabled={!selectedSubStage}
            >
              Clear Selection
            </Button>
            <Button onClick={handleSubmit} disabled={!selectedSubStage}>
              Submit Classification
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
