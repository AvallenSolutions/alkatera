"use client";

import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { CheckCircle2 } from "lucide-react";
import { useLcaStages, type LcaSubStage } from "@/hooks/data/useLcaStages";

interface LcaStageClassifierModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (subStage: LcaSubStage) => void;
  currentSubStageId?: number | null;
}

export function LcaStageClassifierModal({
  open,
  onOpenChange,
  onSelect,
  currentSubStageId,
}: LcaStageClassifierModalProps) {
  const { stages, isLoading, error } = useLcaStages();
  const [selectedSubStageId, setSelectedSubStageId] = useState<number | null>(
    currentSubStageId || null
  );

  const handleSubStageSelect = (subStage: LcaSubStage) => {
    setSelectedSubStageId(subStage.id);
    onSelect(subStage);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Select LCA Life Cycle Stage</DialogTitle>
          <DialogDescription>
            Choose the appropriate life cycle assessment stage for this material
          </DialogDescription>
        </DialogHeader>

        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full" />
            ))}
          </div>
        )}

        {error && (
          <Alert variant="destructive">
            <AlertDescription>
              Failed to load LCA stages: {error.message}
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && stages.length === 0 && (
          <Alert>
            <AlertDescription>
              No LCA stages found. Please contact your administrator.
            </AlertDescription>
          </Alert>
        )}

        {!isLoading && !error && stages.length > 0 && (
          <Accordion type="single" collapsible className="w-full">
            {stages.map((stage) => {
              const hasSelectedSubStage = stage.sub_stages.some(
                (sub) => sub.id === selectedSubStageId
              );

              return (
                <AccordionItem key={stage.id} value={`stage-${stage.id}`}>
                  <AccordionTrigger className="hover:no-underline">
                    <div className="flex items-center gap-3 text-left">
                      <div
                        className={`flex h-8 w-8 items-center justify-center rounded-full border-2 text-sm font-semibold transition-colours ${
                          hasSelectedSubStage
                            ? "border-green-600 bg-green-50 text-green-700"
                            : "border-slate-300 bg-slate-50 text-slate-600"
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
                          const isSelected = selectedSubStageId === subStage.id;

                          return (
                            <Button
                              key={subStage.id}
                              variant={isSelected ? "default" : "outline"}
                              className="w-full justify-start text-left h-auto py-3"
                              onClick={() => handleSubStageSelect(subStage)}
                            >
                              <div className="flex-1">
                                <div className="font-medium">{subStage.name}</div>
                                {subStage.description && (
                                  <div className="text-xs mt-1 opacity-80">
                                    {subStage.description}
                                  </div>
                                )}
                              </div>
                              {isSelected && (
                                <CheckCircle2 className="h-4 w-4 ml-2" />
                              )}
                            </Button>
                          );
                        })}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        )}
      </DialogContent>
    </Dialog>
  );
}
