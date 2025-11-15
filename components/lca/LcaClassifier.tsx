"use client";

import { useState } from "react";
import { useLcaStages, type LcaSubStage } from "@/hooks/data/useLcaStages";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, Layers } from "lucide-react";

interface LcaClassifierProps {
  onSubStageSelect?: (subStage: LcaSubStage | null) => void;
  selectedSubStageId?: number | null;
  title?: string;
  description?: string;
}

export function LcaClassifier({
  onSubStageSelect,
  selectedSubStageId = null,
  title = "LCA Stage Classification",
  description = "Select the appropriate life cycle assessment stage for your emissions data",
}: LcaClassifierProps) {
  const { stages, isLoading, error } = useLcaStages();
  const [selectedSubStage, setSelectedSubStage] = useState<number | null>(selectedSubStageId);
  const [expandedStage, setExpandedStage] = useState<string>("");

  const handleSubStageSelect = (subStage: LcaSubStage, isChecked: boolean) => {
    const newSelection = isChecked ? subStage.id : null;
    setSelectedSubStage(newSelection);

    if (onSubStageSelect) {
      onSubStageSelect(isChecked ? subStage : null);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-full" />
        </CardHeader>
        <CardContent className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Skeleton key={i} className="h-12 w-full" />
          ))}
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load LCA stages: {error.message}
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (stages.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertDescription>
              No LCA stages found. Please contact your administrator.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Layers className="h-5 w-5" />
          {title}
        </CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion
          type="single"
          collapsible
          value={expandedStage}
          onValueChange={setExpandedStage}
          className="w-full"
        >
          {stages.map((stage) => {
            const hasSelectedSubStage = stage.sub_stages.some(
              (sub) => sub.id === selectedSubStage
            );

            return (
              <AccordionItem key={stage.id} value={`stage-${stage.id}`} className="border-b">
                <AccordionTrigger className="hover:no-underline">
                  <div className="flex items-center gap-3 text-left">
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colors ${
                        hasSelectedSubStage
                          ? "border-green-600 bg-green-50 text-green-700 dark:border-green-500 dark:bg-green-950 dark:text-green-400"
                          : "border-slate-300 bg-slate-50 text-slate-600 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-400"
                      }`}
                    >
                      {hasSelectedSubStage ? (
                        <CheckCircle2 className="h-5 w-5" />
                      ) : (
                        stage.id
                      )}
                    </div>
                    <span className="font-medium">{stage.name}</span>
                  </div>
                </AccordionTrigger>
                <AccordionContent className="pb-4 pt-2">
                  {stage.sub_stages.length === 0 ? (
                    <div className="pl-11 text-sm text-muted-foreground">
                      No sub-stages available for this stage.
                    </div>
                  ) : (
                    <div className="space-y-2 pl-11">
                      {stage.sub_stages.map((subStage) => {
                        const isSelected = selectedSubStage === subStage.id;

                        return (
                          <div
                            key={subStage.id}
                            className={`flex items-start gap-3 rounded-lg border p-3 transition-all ${
                              isSelected
                                ? "border-green-500 bg-green-50 dark:border-green-600 dark:bg-green-950/30"
                                : "border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-slate-600 dark:hover:bg-slate-800"
                            }`}
                          >
                            <Checkbox
                              id={`substage-${subStage.id}`}
                              checked={isSelected}
                              onCheckedChange={(checked) =>
                                handleSubStageSelect(subStage, checked === true)
                              }
                              className="mt-0.5"
                            />
                            <div className="flex-1">
                              <Label
                                htmlFor={`substage-${subStage.id}`}
                                className="cursor-pointer font-medium"
                              >
                                {subStage.name}
                              </Label>
                              {subStage.description && (
                                <p className="mt-1 text-xs text-muted-foreground">
                                  {subStage.description}
                                </p>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
}
